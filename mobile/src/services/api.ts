import Constants from "expo-constants";
import { Platform } from "react-native";
import type { Attachment, GroqModelOption } from "../types";

export function getAutoDetectedBackendUrl(): string {
  // Automatically extract the dev machine's LAN IP when running in Expo Go / Metro
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:4000`;
    }
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  return "http://localhost:4000";
}

export function resolveBackendBaseUrl(customUrl?: string): string {
  const cleaned = (customUrl || "").trim().replace(/\/+$/, "");
  if (cleaned) return cleaned;
  return getAutoDetectedBackendUrl();
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface HealthCheckResponse {
  online: boolean;
  hasServerFallbackKey?: boolean;
  defaultTextModel?: string;
  defaultVisionModel?: string;
  curatedModels?: GroqModelOption[];
  error?: string;
}

export async function checkBackendHealth(customUrl?: string): Promise<HealthCheckResponse> {
  const baseUrl = resolveBackendBaseUrl(customUrl);
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/health`, { method: "GET" }, 6000);
    if (!res.ok) {
      return { online: false, error: `Backend returned HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      online: data?.status === "online" || data?.status === "running",
      hasServerFallbackKey: Boolean(data?.hasServerFallbackKey),
      defaultTextModel: data?.defaultTextModel,
      defaultVisionModel: data?.defaultVisionModel,
      curatedModels: Array.isArray(data?.curatedModels) ? data.curatedModels : undefined,
    };
  } catch {
    return {
      online: false,
      error: `Cannot reach backend at ${baseUrl}. Make sure the backend server is running.`,
    };
  }
}

export interface VerifyKeyResult {
  valid: boolean;
  models?: GroqModelOption[];
  message?: string;
  error?: string;
}

export async function verifyGroqKeyWithBackend(
  customUrl: string | undefined,
  apiKey: string
): Promise<VerifyKeyResult> {
  const baseUrl = resolveBackendBaseUrl(customUrl);
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return { valid: false, error: "Please enter a Groq API key first." };
  }

  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/verify-key`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Groq-Api-Key": trimmedKey,
        },
        body: JSON.stringify({ apiKey: trimmedKey }),
      },
      15_000
    );

    const data = await res.json();
    if (!res.ok || !data?.valid) {
      return {
        valid: false,
        error: data?.error || `Verification failed (HTTP ${res.status}).`,
      };
    }

    return {
      valid: true,
      models: Array.isArray(data.models) ? data.models : undefined,
      message: data.message || "Groq API key verified!",
    };
  } catch {
    return {
      valid: false,
      error: `Backend unreachable at ${baseUrl}. Start backend ("cd backend && npm run dev") or check Backend URL in Settings.`,
    };
  }
}

export interface SendChatParams {
  backendUrl?: string;
  apiKey: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  attachments: Attachment[];
  model: string;
  visionModel: string;
}

export interface SendChatResult {
  response: string;
  modelUsed?: string;
  notices?: string[];
  extractedTexts?: Record<string, string>;
}

export async function sendChatMessage(params: SendChatParams): Promise<SendChatResult> {
  const baseUrl = resolveBackendBaseUrl(params.backendUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (params.apiKey.trim()) {
    headers["X-Groq-Api-Key"] = params.apiKey.trim();
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${baseUrl}/api/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: params.message,
          history: params.history,
          attachments: params.attachments.map((att) => ({
            id: att.id,
            name: att.name,
            type: att.type,
            size: att.size,
            dataUrl: att.dataUrl,
            extractedText: att.extractedText,
          })),
          model: params.model,
          visionModel: params.visionModel,
        }),
      },
      95_000
    );
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    throw new Error(
      isAbort
        ? "Request timed out. Try a shorter prompt or smaller file."
        : `Cannot connect to Friday backend (${baseUrl}). Ensure backend is running or check Settings.`
    );
  }

  let data: {
    response?: string;
    error?: string;
    code?: string;
    modelUsed?: string;
    notices?: string[];
    extractedTexts?: Record<string, string>;
  } = {};

  try {
    data = await res.json();
  } catch {
    throw new Error(`Invalid response from backend (HTTP ${res.status}).`);
  }

  if (!res.ok || typeof data.response !== "string") {
    throw new Error(data.error || `Request failed with status ${res.status}.`);
  }

  return {
    response: data.response,
    modelUsed: data.modelUsed,
    notices: data.notices,
    extractedTexts: data.extractedTexts,
  };
}
