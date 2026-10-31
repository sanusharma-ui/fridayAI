import type { Attachment, Conversation } from "@/lib/types";

const CONVERSATIONS_KEY = "friday:conversations:v1";
const ACTIVE_KEY = "friday:active:v1";

export function loadSavedState(): {
  conversations: Conversation[];
  activeId: string | null;
} {
  if (typeof window === "undefined") return { conversations: [], activeId: null };

  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) ?? "[]");
    const conversations = Array.isArray(parsed)
      ? (parsed.filter(isConversation) as Conversation[])
      : [];
    const activeId = localStorage.getItem(ACTIVE_KEY);

    return {
      conversations,
      activeId: conversations.some((chat) => chat.id === activeId) ? activeId : null,
    };
  } catch {
    return { conversations: [], activeId: null };
  }
}

function isAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== "object") return false;
  const att = value as Partial<Attachment>;
  return (
    typeof att.id === "string" &&
    typeof att.name === "string" &&
    typeof att.type === "string" &&
    typeof att.size === "number" &&
    typeof att.dataUrl === "string" &&
    (att.extractedText === undefined || typeof att.extractedText === "string")
  );
}

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const chat = value as Partial<Conversation>;
  return (
    typeof chat.id === "string" &&
    typeof chat.title === "string" &&
    typeof chat.createdAt === "number" &&
    typeof chat.updatedAt === "number" &&
    Array.isArray(chat.messages) &&
    chat.messages.every((message: unknown) => {
      if (!message || typeof message !== "object") return false;
      const item = message as Partial<Conversation["messages"][number]>;
      return (
        typeof item.id === "string" &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        typeof item.createdAt === "number" &&
        (item.attachments === undefined ||
          (Array.isArray(item.attachments) && item.attachments.every(isAttachment)))
      );
    })
  );
}

export function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch {
    // If quota exceeded, try saving with compressed/pruned attachments
    try {
      const lightweight = conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) => ({
          ...m,
          attachments: m.attachments?.map((a) => ({
            ...a,
            // If dataUrl is excessively large, truncate to avoid blocking storage
            dataUrl: a.dataUrl.length > 300_000 ? "" : a.dataUrl,
          })),
        })),
      }));
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(lightweight));
    } catch {
      // Storage can be full or disabled; the UI still works for this session
    }
  }
}

export function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
