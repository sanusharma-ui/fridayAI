import type { Request } from "express";
import {
  CURATED_GROQ_MODELS,
  DEFAULT_TEXT_MODEL,
  DEFAULT_VISION_MODEL,
  FRIDAY_SYSTEM_PROMPT,
  GROQ_BASE_URL,
  SERVER_FALLBACK_GROQ_KEY,
} from "../config.js";
import type { ConversationTurn, GroqModelOption } from "../types.js";

export class GroqApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = "GROQ_ERROR") {
    super(message);
    this.name = "GroqApiError";
    this.status = status;
    this.code = code;
  }
}

export function resolveGroqApiKey(req: Request, bodyKey?: string): string {
  const headerKey = req.header("x-groq-api-key")?.trim();
  if (headerKey) return headerKey;

  const authHeader = req.header("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  if (bodyKey?.trim()) return bodyKey.trim();
  if (SERVER_FALLBACK_GROQ_KEY) return SERVER_FALLBACK_GROQ_KEY;

  throw new GroqApiError(
    "Groq API key setup nahi hai. Settings window me apni Groq API key add karein.",
    401,
    "MISSING_API_KEY"
  );
}

const NON_CHAT_MODEL_PATTERNS = [
  "whisper",
  "tts",
  "playai",
  "orpheus",
  "guard",
  "safeguard",
  "embed",
  "rerank",
];

const VISION_MODEL_PATTERNS = [
  "vision",
  "vl",
  "qwen3.8",
  "qwen3.6",
  "qwen2.5-vl",
  "llama-4-scout",
  "llama-4-maverick",
  "pixtral",
];

export function isLikelyVisionModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return VISION_MODEL_PATTERNS.some((pat) => lower.includes(pat));
}

function isChatCapableModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return !NON_CHAT_MODEL_PATTERNS.some((pat) => lower.includes(pat));
}

function formatModelLabel(id: string): string {
  const curated = CURATED_GROQ_MODELS.find((m) => m.id === id);
  if (curated) return curated.label;
  return id;
}

export async function fetchGroqModels(apiKey: string): Promise<GroqModelOption[]> {
  let response: Response;
  try {
    response = await fetch(`${GROQ_BASE_URL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new GroqApiError(
      isTimeout
        ? "Groq API timed out while checking your key."
        : "Unable to connect to Groq API. Check internet connection.",
      502,
      "UPSTREAM_UNREACHABLE"
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new GroqApiError(
      "Invalid Groq API key. Please check your key in Settings (starts with gsk_).",
      401,
      "INVALID_API_KEY"
    );
  }

  if (!response.ok) {
    throw new GroqApiError(
      `Groq API returned HTTP ${response.status} while fetching models.`,
      502,
      "GROQ_UPSTREAM_ERROR"
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{
      id?: string;
      owned_by?: string;
      context_window?: number;
      active?: boolean;
    }>;
  };

  const rawList = Array.isArray(payload.data) ? payload.data : [];
  const mapped: GroqModelOption[] = rawList
    .filter((item) => typeof item.id === "string" && item.active !== false && isChatCapableModel(item.id))
    .map((item) => {
      const id = item.id!;
      const curated = CURATED_GROQ_MODELS.find((c) => c.id === id);
      return {
        id,
        label: formatModelLabel(id),
        ownedBy: item.owned_by || curated?.ownedBy,
        contextWindow: item.context_window || curated?.contextWindow,
        supportsVision: curated?.supportsVision ?? isLikelyVisionModel(id),
        recommended: Boolean(curated?.recommended),
      };
    });

  mapped.sort((a, b) => {
    if (Boolean(a.recommended) !== Boolean(b.recommended)) {
      return a.recommended ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

  return mapped.length > 0 ? mapped : CURATED_GROQ_MODELS;
}

function stripReasoningBlocks(raw: string): { cleanText: string; reasoning?: string } {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const thoughts: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = thinkRegex.exec(raw)) !== null) {
    if (match[1]?.trim()) thoughts.push(match[1].trim());
  }
  const cleanText = raw.replace(thinkRegex, "").trim();
  return {
    cleanText: cleanText || raw.trim(),
    reasoning: thoughts.length > 0 ? thoughts.join("\n\n") : undefined,
  };
}

function buildMessagesPayload(params: {
  userMessage: string;
  history: ConversationTurn[];
  imageDataUrls: string[];
  contextSections: string[];
  requestedModel?: string;
  requestedVisionModel?: string;
}): { chosenModel: string; hasImages: boolean; messages: unknown[] } {
  const {
    userMessage,
    history,
    imageDataUrls,
    contextSections,
    requestedModel,
    requestedVisionModel,
  } = params;

  const hasImages = imageDataUrls.length > 0;
  let chosenModel = requestedModel?.trim() || DEFAULT_TEXT_MODEL;
  if (hasImages && !isLikelyVisionModel(chosenModel)) {
    chosenModel = requestedVisionModel?.trim() || DEFAULT_VISION_MODEL;
  }

  const combinedText =
    (contextSections.length > 0 ? `${contextSections.join("\n\n")}\n\n` : "") +
    (userMessage || "Please analyze the attached file(s).");

  const messages: unknown[] = [
    { role: "system", content: FRIDAY_SYSTEM_PROMPT },
    ...history
      .filter((t) => t.content.trim().length > 0)
      .map((t) => ({ role: t.role, content: t.content })),
  ];

  if (hasImages) {
    const userContent: unknown[] = [{ type: "text", text: combinedText }];
    for (const url of imageDataUrls) {
      userContent.push({
        type: "image_url",
        image_url: { url },
      });
    }
    messages.push({ role: "user", content: userContent });
  } else {
    messages.push({ role: "user", content: combinedText });
  }

  return { chosenModel, hasImages, messages };
}

function isModelFallbackCandidateError(err: unknown): err is GroqApiError {
  if (!(err instanceof GroqApiError) || err.status !== 400) return false;
  const lower = err.message.toLowerCase();
  return (
    lower.includes("model") ||
    lower.includes("decommissioned") ||
    lower.includes("image") ||
    lower.includes("vision")
  );
}

async function parseFailedGroqResponse(res: Response): Promise<GroqApiError> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  const upstreamMsg =
    (data as { error?: { message?: string; code?: string } } | null)?.error?.message ||
    `Groq API returned HTTP ${res.status}.`;
  const upstreamCode =
    (data as { error?: { code?: string } } | null)?.error?.code || "GROQ_ERROR";

  if (res.status === 401 || res.status === 403) {
    return new GroqApiError(
      "Invalid Groq API key. Please update your key in Settings.",
      401,
      "INVALID_API_KEY"
    );
  }
  if (res.status === 429) {
    return new GroqApiError(
      "Groq rate limit reached. Wait a few seconds or switch models in Settings.",
      429,
      "RATE_LIMITED"
    );
  }

  return new GroqApiError(
    upstreamMsg,
    res.status >= 400 && res.status < 500 ? 400 : 502,
    upstreamCode
  );
}

export interface GenerateGroqReplyParams {
  apiKey: string;
  userMessage: string;
  history: ConversationTurn[];
  imageDataUrls: string[];
  contextSections: string[];
  requestedModel?: string;
  requestedVisionModel?: string;
}

export interface GenerateGroqReplyResult {
  response: string;
  reasoning?: string;
  modelUsed: string;
  notices: string[];
}

async function callGroqChatCompletions(
  apiKey: string,
  model: string,
  messages: unknown[]
): Promise<{ content: string; reasoning?: string; modelUsed: string }> {
  let res: Response;
  try {
    res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_completion_tokens: 4096,
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new GroqApiError(
      isTimeout
        ? "Groq request timed out. Try a shorter message or smaller attachment."
        : "Cannot reach Groq API. Check internet connection.",
      502,
      "UPSTREAM_TIMEOUT"
    );
  }

  if (!res.ok) {
    throw await parseFailedGroqResponse(res);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string; reasoning?: string };
    }>;
    model?: string;
  };

  const msg = data?.choices?.[0]?.message;
  const content = msg?.content || "";
  if (!content.trim()) {
    throw new GroqApiError("Groq returned an empty response.", 502, "EMPTY_RESPONSE");
  }

  return {
    content,
    reasoning: typeof msg?.reasoning === "string" ? msg.reasoning : undefined,
    modelUsed: data?.model || model,
  };
}

export async function generateGroqReply(
  params: GenerateGroqReplyParams
): Promise<GenerateGroqReplyResult> {
  const notices: string[] = [];
  const { chosenModel, hasImages, messages } = buildMessagesPayload(params);

  try {
    const { content, reasoning: apiReasoning, modelUsed } = await callGroqChatCompletions(
      params.apiKey,
      chosenModel,
      messages
    );
    const { cleanText, reasoning: tagReasoning } = stripReasoningBlocks(content);
    return {
      response: cleanText,
      reasoning: apiReasoning || tagReasoning,
      modelUsed,
      notices,
    };
  } catch (err) {
    if (isModelFallbackCandidateError(err)) {
      const liveModels = await fetchGroqModels(params.apiKey);
      const fallbackCandidate = hasImages
        ? liveModels.find((m) => m.supportsVision && m.id !== chosenModel)?.id
        : liveModels.find((m) => m.id === DEFAULT_TEXT_MODEL && m.id !== chosenModel)?.id ||
          liveModels.find((m) => m.id !== chosenModel)?.id;

      if (fallbackCandidate) {
        const { content, reasoning: apiReasoning, modelUsed } = await callGroqChatCompletions(
          params.apiKey,
          fallbackCandidate,
          messages
        );
        notices.push(`Switched automatically to active Groq model: ${modelUsed}`);
        const { cleanText, reasoning: tagReasoning } = stripReasoningBlocks(content);
        return {
          response: cleanText,
          reasoning: apiReasoning || tagReasoning,
          modelUsed,
          notices,
        };
      }
    }
    throw err;
  }
}

/**
 * State machine that separates inline `<think>...</think>` blocks from main content
 * safely across arbitrary token boundaries during SSE streaming.
 */
class ThinkTagStreamFilter {
  private inThink = false;
  private carry = "";
  private startedContent = false;
  private onContent: (delta: string) => void;
  private onReasoning: (delta: string) => void;

  constructor(
    onContent: (delta: string) => void,
    onReasoning: (delta: string) => void
  ) {
    this.onContent = onContent;
    this.onReasoning = onReasoning;
  }

  private emitContent(text: string) {
    if (!text) return;
    if (!this.startedContent) {
      const trimmed = text.replace(/^\s+/, "");
      if (!trimmed) return;
      this.startedContent = true;
      this.onContent(trimmed);
      return;
    }
    this.onContent(text);
  }

  push(chunk: string) {
    let buf = this.carry + chunk;
    this.carry = "";

    while (buf.length > 0) {
      if (!this.inThink) {
        const openIdx = buf.indexOf("<think>");
        if (openIdx !== -1) {
          this.emitContent(buf.slice(0, openIdx));
          this.inThink = true;
          buf = buf.slice(openIdx + 7);
          continue;
        }
        // Hold back a potential partial `<think>` prefix at the very end
        const partialIdx = this.findPartialSuffix(buf, "<think>");
        if (partialIdx !== -1) {
          this.emitContent(buf.slice(0, partialIdx));
          this.carry = buf.slice(partialIdx);
          return;
        }
        this.emitContent(buf);
        return;
      } else {
        const closeIdx = buf.indexOf("</think>");
        if (closeIdx !== -1) {
          const thought = buf.slice(0, closeIdx);
          if (thought) this.onReasoning(thought);
          this.inThink = false;
          buf = buf.slice(closeIdx + 8);
          continue;
        }
        const partialIdx = this.findPartialSuffix(buf, "</think>");
        if (partialIdx !== -1) {
          const thought = buf.slice(0, partialIdx);
          if (thought) this.onReasoning(thought);
          this.carry = buf.slice(partialIdx);
          return;
        }
        this.onReasoning(buf);
        return;
      }
    }
  }

  flush() {
    if (!this.carry) return;
    if (this.inThink) {
      this.onReasoning(this.carry);
    } else {
      this.emitContent(this.carry);
    }
    this.carry = "";
  }

  private findPartialSuffix(text: string, tag: string): number {
    const maxLen = Math.min(text.length, tag.length - 1);
    for (let len = maxLen; len >= 1; len--) {
      if (tag.startsWith(text.slice(text.length - len))) {
        return text.length - len;
      }
    }
    return -1;
  }
}

export interface StreamGroqCallbacks {
  onNotice?: (notice: string) => void;
  onContentDelta: (delta: string) => void;
  onReasoningDelta: (delta: string) => void;
}

async function openGroqStreamResponse(
  apiKey: string,
  model: string,
  messages: unknown[],
  signal?: AbortSignal
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(95_000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  let res: Response;
  try {
    res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_completion_tokens: 4096,
        stream: true,
      }),
      signal: combinedSignal,
    });
  } catch (err) {
    if (signal?.aborted) {
      throw new GroqApiError("Generation stopped by user.", 499, "CLIENT_ABORTED");
    }
    const isTimeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new GroqApiError(
      isTimeout
        ? "Groq stream timed out. Try a shorter message or smaller attachment."
        : "Cannot reach Groq API. Check internet connection.",
      502,
      "UPSTREAM_TIMEOUT"
    );
  }

  if (!res.ok) {
    throw await parseFailedGroqResponse(res);
  }

  if (!res.body) {
    throw new GroqApiError("Groq stream body unavailable.", 502, "EMPTY_STREAM");
  }

  return res;
}

export async function streamGroqReply(
  params: GenerateGroqReplyParams,
  callbacks: StreamGroqCallbacks,
  signal?: AbortSignal
): Promise<{ modelUsed: string }> {
  const { chosenModel, hasImages, messages } = buildMessagesPayload(params);

  let res: Response;
  let activeModel = chosenModel;

  try {
    res = await openGroqStreamResponse(params.apiKey, activeModel, messages, signal);
  } catch (err) {
    if (isModelFallbackCandidateError(err)) {
      const liveModels = await fetchGroqModels(params.apiKey);
      const fallbackCandidate = hasImages
        ? liveModels.find((m) => m.supportsVision && m.id !== activeModel)?.id
        : liveModels.find((m) => m.id === DEFAULT_TEXT_MODEL && m.id !== activeModel)?.id ||
          liveModels.find((m) => m.id !== activeModel)?.id;

      if (fallbackCandidate) {
        activeModel = fallbackCandidate;
        res = await openGroqStreamResponse(params.apiKey, activeModel, messages, signal);
        callbacks.onNotice?.(`Switched automatically to active Groq model: ${activeModel}`);
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder("utf-8");
  const filter = new ThinkTagStreamFilter(
    callbacks.onContentDelta,
    callbacks.onReasoningDelta
  );

  let sseBuffer = "";
  let modelUsed = activeModel;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split(/\r?\n/);
      sseBuffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith("data:")) continue;

        const dataPayload = line.slice(5).trim();
        if (dataPayload === "[DONE]") {
          filter.flush();
          return { modelUsed };
        }

        try {
          const parsed = JSON.parse(dataPayload) as {
            model?: string;
            choices?: Array<{
              delta?: {
                content?: string | null;
                reasoning?: string | null;
              };
            }>;
          };

          if (parsed.model) {
            modelUsed = parsed.model;
          }

          const delta = parsed.choices?.[0]?.delta;
          if (delta?.reasoning) {
            callbacks.onReasoningDelta(delta.reasoning);
          }
          if (delta?.content) {
            filter.push(delta.content);
          }
        } catch {
          // Ignore malformed partial comment/keepalive lines
        }
      }
    }
  } finally {
    filter.flush();
    reader.releaseLock();
  }

  return { modelUsed };
}
