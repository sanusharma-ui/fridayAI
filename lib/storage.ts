import type { Conversation } from "@/lib/types";

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
      const item = message as Partial<ChatMessageLike>;
      return (
        typeof item.id === "string" &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        typeof item.createdAt === "number"
      );
    })
  );
}

type ChatMessageLike = Conversation["messages"][number];

export function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch {
    // Storage can be unavailable or full; the UI still works for this session.
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
