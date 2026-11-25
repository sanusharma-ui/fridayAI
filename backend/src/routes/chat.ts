import { Router, type Request } from "express";
import { LIMITS } from "../config.js";
import {
  generateGroqReply,
  GroqApiError,
  resolveGroqApiKey,
  streamGroqReply,
} from "../services/groq.js";
import { analyzePdfBuffer } from "../services/pdf.js";
import type { ChatRequestBody, ConversationTurn, IncomingAttachment } from "../types.js";

export const chatRouter = Router();

const DATA_URL_REGEX =
  /^data:(image\/(png|jpeg|jpg|webp|gif)|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/i;

class RequestValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface ValidatedInput {
  apiKey: string;
  message: string;
  history: ConversationTurn[];
  rawAttachments: IncomingAttachment[];
  requestedModel?: string;
  requestedVisionModel?: string;
}

function validateChatInput(req: Request): ValidatedInput {
  const apiKey = resolveGroqApiKey(req);
  const body = (req.body || {}) as ChatRequestBody;

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const rawAttachments: IncomingAttachment[] = Array.isArray(body.attachments)
    ? body.attachments
    : [];

  const history: ConversationTurn[] = Array.isArray(body.history)
    ? body.history
        .slice(-LIMITS.maxHistoryTurns)
        .filter(
          (turn): turn is ConversationTurn =>
            Boolean(turn) &&
            (turn.role === "user" || turn.role === "assistant") &&
            typeof turn.content === "string"
        )
        .map((turn) => ({
          role: turn.role,
          content: turn.content.slice(0, LIMITS.maxTurnChars),
        }))
    : [];

  if (message.length > LIMITS.maxMessageChars) {
    throw new RequestValidationError(
      `Message must be under ${LIMITS.maxMessageChars.toLocaleString()} characters.`,
      400
    );
  }

  if (rawAttachments.length > LIMITS.maxAttachments) {
    throw new RequestValidationError(
      `At most ${LIMITS.maxAttachments} attachments can be sent per message.`,
      400
    );
  }

  if (!message && rawAttachments.length === 0) {
    throw new RequestValidationError(
      "Please enter a message or attach an image/PDF.",
      400
    );
  }

  return {
    apiKey,
    message,
    history,
    rawAttachments,
    requestedModel: body.model,
    requestedVisionModel: body.visionModel,
  };
}

async function processIncomingAttachments(
  rawAttachments: IncomingAttachment[],
  message: string
): Promise<{
  imageDataUrls: string[];
  contextSections: string[];
  notices: string[];
  extractedTexts: Record<string, string>;
}> {
  const imageDataUrls: string[] = [];
  const contextSections: string[] = [];
  const notices: string[] = [];
  const extractedTexts: Record<string, string> = {};

  for (const att of rawAttachments) {
    const name = typeof att?.name === "string" ? att.name : "attachment";
    const type = typeof att?.type === "string" ? att.type.toLowerCase() : "";
    const dataUrl = (att?.dataUrl || att?.data_url || "").trim();

    if (!dataUrl && att?.extractedText) {
      contextSections.push(
        `PDF ${name} (Cached Excerpt):\n${att.extractedText.slice(0, LIMITS.maxPdfTotalChars)}`
      );
      continue;
    }

    const match = DATA_URL_REGEX.exec(dataUrl);
    if (!match) {
      throw new RequestValidationError(
        `Unsupported or invalid attachment "${name}". Attach PNG, JPG, WEBP, GIF, or PDF.`,
        400
      );
    }

    const mimeType = match[1].toLowerCase();
    const base64Payload = match[3].replace(/\s+/g, "");
    const rawBuffer = Buffer.from(base64Payload, "base64");

    if (rawBuffer.byteLength > LIMITS.maxSingleFileBytes) {
      throw new RequestValidationError(
        `"${name}" exceeds the 20 MB per-file limit.`,
        413
      );
    }

    if (mimeType.startsWith("image/") || type.startsWith("image/")) {
      if (imageDataUrls.length < LIMITS.maxGroqVisionImages) {
        const normalizedMime = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
        imageDataUrls.push(`data:${normalizedMime};base64,${base64Payload}`);
        contextSections.push(`Image attached: ${name}`);
      } else {
        notices.push(
          `Skipped "${name}": Groq vision supports up to ${LIMITS.maxGroqVisionImages} images per request.`
        );
      }
    } else if (mimeType === "application/pdf" || type === "application/pdf") {
      const pdfResult = await analyzePdfBuffer(
        name,
        new Uint8Array(rawBuffer),
        message,
        att.extractedText
      );
      contextSections.push(pdfResult.contextSection);
      notices.push(...pdfResult.notices);
      if (att.id && pdfResult.fullExtractedText) {
        extractedTexts[att.id] = pdfResult.fullExtractedText;
      }
    }
  }

  return { imageDataUrls, contextSections, notices, extractedTexts };
}

// Non-streaming JSON endpoint
chatRouter.post("/chat", async (req, res) => {
  try {
    const input = validateChatInput(req);
    const files = await processIncomingAttachments(input.rawAttachments, input.message);

    const reply = await generateGroqReply({
      apiKey: input.apiKey,
      userMessage: input.message,
      history: input.history,
      imageDataUrls: files.imageDataUrls,
      contextSections: files.contextSections,
      requestedModel: input.requestedModel,
      requestedVisionModel: input.requestedVisionModel,
    });

    res.json({
      response: reply.response,
      reasoning: reply.reasoning,
      modelUsed: reply.modelUsed,
      notices: [...files.notices, ...reply.notices],
      extractedTexts: files.extractedTexts,
      protocol: 3,
    });
  } catch (err) {
    if (err instanceof RequestValidationError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof GroqApiError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "Internal server error.";
    res.status(500).json({ error: msg });
  }
});

// Real-time Server-Sent Events (SSE) Streaming endpoint
chatRouter.post("/chat/stream", async (req, res) => {
  let input: ValidatedInput;
  try {
    input = validateChatInput(req);
  } catch (err) {
    if (err instanceof RequestValidationError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof GroqApiError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(400).json({ error: "Invalid chat request." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const abortController = new AbortController();
  let clientClosed = false;

  res.on("close", () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
    }
  });

  const sendEvent = (payload: Record<string, unknown>) => {
    if (clientClosed || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const startedAt = Date.now();

  try {
    if (input.rawAttachments.length > 0) {
      sendEvent({ type: "status", stage: "processing_attachments" });
    }

    const files = await processIncomingAttachments(input.rawAttachments, input.message);

    sendEvent({
      type: "meta",
      notices: files.notices,
      extractedTexts: files.extractedTexts,
    });

    const result = await streamGroqReply(
      {
        apiKey: input.apiKey,
        userMessage: input.message,
        history: input.history,
        imageDataUrls: files.imageDataUrls,
        contextSections: files.contextSections,
        requestedModel: input.requestedModel,
        requestedVisionModel: input.requestedVisionModel,
      },
      {
        onNotice: (notice) => sendEvent({ type: "notice", notice }),
        onReasoningDelta: (delta) => sendEvent({ type: "reasoning", delta }),
        onContentDelta: (delta) => sendEvent({ type: "content", delta }),
      },
      abortController.signal
    );

    sendEvent({
      type: "done",
      modelUsed: result.modelUsed,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    if (!clientClosed) {
      if (err instanceof RequestValidationError) {
        sendEvent({ type: "error", error: err.message, code: "VALIDATION_ERROR" });
      } else if (err instanceof GroqApiError) {
        sendEvent({ type: "error", error: err.message, code: err.code });
      } else {
        sendEvent({
          type: "error",
          error: err instanceof Error ? err.message : "Streaming failed.",
          code: "STREAM_ERROR",
        });
      }
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});
