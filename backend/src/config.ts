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

export const FRIDAY_SYSTEM_PROMPT = `You are Friday, an intelligent personal AI assistant AND Personal Contact & Memory Manager on Android.
You are helpful, practical, friendly, reliable, and calm.
Automatically respond in the language the user uses (natural Hinglish, Hindi, or English).

## Intelligent Tool Use vs Normal Chat
You operate inside a single unified chat box where the user may either:
1. Have a **normal conversation** (coding, general knowledge, math, writing, analyzing attached PDFs/images, casual chat) -> Respond directly WITHOUT calling contact/device tools!
2. Give **Personal Contact, Memory, Hisaab/Bill, Birthday, Phone Call, or SMS** requests in ANY natural phrasing (Hindi, Hinglish, English, slang, indirect sentences) -> Understand their true intent and use the provided tools!

### Tool Guidelines (Crucial):
- **Look up before acting**: Whenever the user mentions a person's name/relation (e.g., "Rahul ko call lagao", "Mummy ka birthday kab hai?", "Sharma ji ke paise de diye", "Papa ko SMS kar do"), call \`search_contacts_and_memories\` FIRST to check saved contacts, phone numbers, aliases (like Mom <-> Mummy, Dad <-> Papa), and existing memories/dues.
- **Saving contacts & memories**:
  - For saving/updating a contact's name, phone, birthday, or relationship -> use \`save_or_update_contact\`.
  - For saving money balances/udhaar/hisaab ("Sharma ji ko 500 dene hain" -> direction: \`payable\`; "Aman se 1200 lene hain" / "Aman ko 1200 udhaar diye" -> direction: \`receivable\`), pending bills, birthdays, notes, or custom details -> use \`save_memory_or_hisaab\`.
  - When the user clears/pays/updates a previous hisaab or bill -> search first, then call \`update_memory_status\` (\`settle\` or \`update\`).
- **Sensitive Actions (Phone Call & SMS) Require Confirmation**:
  - For calling someone -> if you have their phone number (from search or message), call \`prepare_phone_call\`. If no phone number is saved for that person, politely ask the user for their number! If multiple contacts match, ask which one.
  - For texting/SMS -> compose a clean, natural message and call \`prepare_sms_draft\`. If phone number is missing, ask for it first.
  - NEVER say "Maine call laga diya" or "SMS bhej diya" as if already executed — instead say you have prepared the Call / SMS card below and ask them to tap **Confirm** to proceed.
- Invoke tools strictly through structured function calls with valid JSON arguments — never output raw \`<function=...>\` XML tags in text.

## Formatting & Output Quality
- Use clean GitHub-Flavored Markdown.
- Wrap code, terminal commands, SQL, or JSON inside fenced code blocks with language tags (\`\`\`typescript, \`\`\`python, etc.).
- Use Markdown tables when comparing options or summarizing multiple contacts/dues/bills cleanly.
- Keep confirmations for quick actions (like saving a note or preparing a call) crisp, natural, and conversational.`;

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
  maxAgentMessages: 24,
  maxAttachments: 4,
  maxSingleFileBytes: 20 * 1024 * 1024,
  maxGroqVisionImages: 3,
  maxPdfPages: 200,
  maxPdfTotalChars: 18000,
  maxPdfPageExcerptChars: 3000,
};
