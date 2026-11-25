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

  // Sort recommended models first, then alphabetically
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
): Promise<{ content: string; modelUsed: string }> {
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
        max_completion_tokens: 2048,
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

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const upstreamMsg =
      (data as { error?: { message?: string; code?: string } } | null)?.error?.message ||
      `Groq API returned HTTP ${res.status}.`;
    const upstreamCode =
      (data as { error?: { code?: string } } | null)?.error?.code || "GROQ_ERROR";

    if (res.status === 401 || res.status === 403) {
      throw new GroqApiError(
        "Invalid Groq API key. Please update your key in Settings.",
        401,
        "INVALID_API_KEY"
      );
    }
    if (res.status === 429) {
      throw new GroqApiError(
        "Groq rate limit reached. Wait a few seconds or switch models in Settings.",
        429,
        "RATE_LIMITED"
      );
    }

    throw new GroqApiError(upstreamMsg, res.status >= 400 && res.status < 500 ? 400 : 502, upstreamCode);
  }

  const content = (
    data as { choices?: Array<{ message?: { content?: string } }>; model?: string } | null
  )?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new GroqApiError("Groq returned an empty response.", 502, "EMPTY_RESPONSE");
  }

  const modelUsed =
    (data as { model?: string } | null)?.model || model;

  return { content, modelUsed };
}

export async function generateGroqReply(
  params: GenerateGroqReplyParams
): Promise<GenerateGroqReplyResult> {
  const {
    apiKey,
    userMessage,
    history,
    imageDataUrls,
    contextSections,
    requestedModel,
    requestedVisionModel,
  } = params;

  const notices: string[] = [];
  const hasImages = imageDataUrls.length > 0;

  let chosenModel = (requestedModel?.trim() || DEFAULT_TEXT_MODEL);
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

  try {
    const { content, modelUsed } = await callGroqChatCompletions(apiKey, chosenModel, messages);
    const { cleanText, reasoning } = stripReasoningBlocks(content);
    return { response: cleanText, reasoning, modelUsed, notices };
  } catch (err) {
    // Automatic fallback if a selected model was deprecated or lacks vision support
    if (
      err instanceof GroqApiError &&
      err.status === 400 &&
      (err.message.toLowerCase().includes("model") ||
        err.message.toLowerCase().includes("decommissioned") ||
        err.message.toLowerCase().includes("image") ||
        err.message.toLowerCase().includes("vision"))
    ) {
      const liveModels = await fetchGroqModels(apiKey);
      const fallbackCandidate = hasImages
        ? liveModels.find((m) => m.supportsVision && m.id !== chosenModel)?.id
        : liveModels.find((m) => m.id === DEFAULT_TEXT_MODEL && m.id !== chosenModel)?.id ||
          liveModels.find((m) => m.id !== chosenModel)?.id;

      if (fallbackCandidate) {
        const { content, modelUsed } = await callGroqChatCompletions(
          apiKey,
          fallbackCandidate,
          messages
        );
        notices.push(`Switched automatically to active Groq model: ${modelUsed}`);
        const { cleanText, reasoning } = stripReasoningBlocks(content);
        return { response: cleanText, reasoning, modelUsed, notices };
      }
    }
    throw err;
  }
}
