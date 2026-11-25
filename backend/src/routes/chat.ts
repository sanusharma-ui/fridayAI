import { Router } from "express";
import { LIMITS } from "../config.js";
import {
  generateGroqReply,
  GroqApiError,
  resolveGroqApiKey,
} from "../services/groq.js";
import { analyzePdfBuffer } from "../services/pdf.js";
import type { ChatRequestBody, ConversationTurn, IncomingAttachment } from "../types.js";

export const chatRouter = Router();

const DATA_URL_REGEX =
  /^data:(image\/(png|jpeg|jpg|webp|gif)|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/i;

chatRouter.post("/chat", async (req, res) => {
  try {
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
      res.status(400).json({
        error: `Message must be under ${LIMITS.maxMessageChars.toLocaleString()} characters.`,
      });
      return;
    }

    if (rawAttachments.length > LIMITS.maxAttachments) {
      res.status(400).json({
        error: `At most ${LIMITS.maxAttachments} attachments can be sent per message.`,
      });
      return;
    }

    if (!message && rawAttachments.length === 0) {
      res.status(400).json({
        error: "Please enter a message or attach an image/PDF.",
      });
      return;
    }

    const imageDataUrls: string[] = [];
    const contextSections: string[] = [];
    const notices: string[] = [];
    const extractedTexts: Record<string, string> = {};

    for (const att of rawAttachments) {
      const name = typeof att?.name === "string" ? att.name : "attachment";
      const type = typeof att?.type === "string" ? att.type.toLowerCase() : "";
      const dataUrl = (att?.dataUrl || att?.data_url || "").trim();

      // If a follow-up PDF already has cached extractedText and its large dataUrl was pruned locally
      if (!dataUrl && att?.extractedText) {
        contextSections.push(
          `PDF ${name} (Cached Excerpt):\n${att.extractedText.slice(0, LIMITS.maxPdfTotalChars)}`
        );
        continue;
      }

      const match = DATA_URL_REGEX.exec(dataUrl);
      if (!match) {
        res.status(400).json({
          error: `Unsupported or invalid attachment "${name}". Attach PNG, JPG, WEBP, GIF, or PDF.`,
        });
        return;
      }

      const mimeType = match[1].toLowerCase();
      const base64Payload = match[3].replace(/\s+/g, "");
      const rawBuffer = Buffer.from(base64Payload, "base64");

      if (rawBuffer.byteLength > LIMITS.maxSingleFileBytes) {
        res.status(413).json({
          error: `"${name}" exceeds the 20 MB per-file limit.`,
        });
        return;
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

    const reply = await generateGroqReply({
      apiKey,
      userMessage: message,
      history,
      imageDataUrls,
      contextSections,
      requestedModel: body.model,
      requestedVisionModel: body.visionModel,
    });

    res.json({
      response: reply.response,
      reasoning: reply.reasoning,
      modelUsed: reply.modelUsed,
      notices: [...notices, ...reply.notices],
      extractedTexts,
      protocol: 3,
    });
  } catch (err) {
    if (err instanceof GroqApiError) {
      res.status(err.status).json({
        error: err.message,
        code: err.code,
      });
      return;
    }
    const msg = err instanceof Error ? err.message : "Internal server error.";
    res.status(500).json({ error: msg });
  }
});
