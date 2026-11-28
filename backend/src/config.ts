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

/**
 * Lightweight prompt used when NO device/vault tools are relevant (normal chat, coding, Q&A, docs).
 * Keeps prompt overhead under ~110 tokens!
 */
export const FRIDAY_CHAT_SYSTEM_PROMPT = `You are Friday, a sharp, friendly personal AI assistant.
Respond naturally in the user's language (Hinglish, Hindi, or English).
Use clean GitHub-Flavored Markdown, fenced code blocks with language tags, and Markdown tables when helpful. Keep answers clear, accurate, and concise unless detail is requested.`;

/**
 * Compact, high-precision system prompt used ONLY when device/vault tools are attached.
 */
export const FRIDAY_SYSTEM_PROMPT = `You are Friday, an intelligent personal AI assistant & On-Device Phone Controller.
Reply naturally in the user's language (Hinglish, Hindi, or English).

## Smart Tool Rules
1. **Only call tools when needed**: For general questions, coding, math, or casual chat, answer directly WITHOUT calling any tool.
2. **Lookup before acting**: When a person/relation is mentioned for call, WhatsApp, SMS, UPI, birthday, or hisaab, call \`search_contacts_and_memories\` first.
3. **Smart Pagination (CRITICAL)**:
   - List tools (contacts, phonebook, memories, calendar, reminders) return small paginated batches (\`hasMore\`, \`nextOffset\`).
   - NEVER call a list tool repeatedly in the same turn to fetch all pages!
   - Show ONLY the returned items cleanly, mention total count if large, and politely ask if the user wants to see more (\`aur dikhao\`) or filter by name.
4. **Confirmation Cards**:
   - Call, WhatsApp, SMS, Email, UPI, Phonebook Save, and Calendar Add display confirmation cards on screen.
   - Never claim the call/message/payment was already sent — say the card is ready below and ask the user to tap **Confirm**.
   - For UPI, require a valid \`@\` VPA (ask the user if unknown).
5. Emit valid JSON tool calls only — never raw \`<function=...>\` XML tags.`;

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
    label: "Llama 3.1 8B Instant (High Rate-Limit / Fast)",
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
  maxHistoryTurns: 20,
  maxTurnChars: 3000,
  maxAgentMessages: 16,
  maxAttachments: 4,
  maxSingleFileBytes: 20 * 1024 * 1024,
  maxGroqVisionImages: 3,
  maxPdfPages: 200,
  maxPdfTotalChars: 12000,
  maxPdfPageExcerptChars: 2400,
};

export const BALANCED_TOKEN_DEFAULTS = {
  maxInputTokens: 2800,
  maxOutputTokensQuick: 640,
  maxOutputTokensDetailed: 1400,
  maxOutputTokensReasoning: 1600,
  maxHistoryTurns: 6,
  maxToolOutputChars: 2800,
  toolPageSize: 8,
} as const;
