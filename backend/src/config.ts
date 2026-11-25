import dotenv from "dotenv";
import type { GroqModelOption } from "./types.js";

dotenv.config();

export const PORT = Number(process.env.PORT || 4000);
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export const DEFAULT_TEXT_MODEL =
  process.env.DEFAULT_TEXT_MODEL?.trim() || "llama-3.3-70b-versatile";

export const DEFAULT_VISION_MODEL =
  process.env.DEFAULT_VISION_MODEL?.trim() || "qwen/qwen3.8-27b";

export const SERVER_FALLBACK_GROQ_KEY = process.env.GROQ_API_KEY?.trim() || "";

export const FRIDAY_SYSTEM_PROMPT = `You are Friday, a personal AI assistant.
You are helpful, practical, friendly, reliable, and calm.
Automatically respond in the language the user uses. If they use Hinglish,
respond in natural Hinglish. If they use English or Hindi, follow that language.
Give clear, useful answers. Be concise by default, but explain technical topics
step by step when helpful. For code, prioritize correctness and runnable examples.
If you don't know something, admit uncertainty instead of inventing facts.
Do not pretend to have tools, access, memory, or capabilities you don't have.`;

export const CURATED_GROQ_MODELS: GroqModelOption[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile (Recommended)",
    ownedBy: "Meta",
    contextWindow: 131072,
    supportsVision: false,
    recommended: true,
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant (Ultra Fast)",
    ownedBy: "Meta",
    contextWindow: 131072,
    supportsVision: false,
    recommended: true,
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B (Deep Reasoning)",
    ownedBy: "OpenAI",
    contextWindow: 131072,
    supportsVision: false,
    recommended: true,
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B (Fast Reasoning)",
    ownedBy: "OpenAI",
    contextWindow: 131072,
    supportsVision: false,
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen 3.8 27B (Vision + Multimodal)",
    ownedBy: "Alibaba Cloud",
    contextWindow: 131072,
    supportsVision: true,
    recommended: true,
  },
];

export const LIMITS = {
  maxMessageChars: 4000,
  maxHistoryTurns: 12,
  maxTurnChars: 3000,
  maxAttachments: 4,
  maxSingleFileBytes: 20 * 1024 * 1024,
  maxGroqVisionImages: 3,
  maxPdfPages: 200,
  maxPdfTotalChars: 18000,
  maxPdfPageExcerptChars: 3000,
};
