import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Conversation } from "../types";

const CONVERSATIONS_KEY = "friday:mobile:conversations:v1";
const ACTIVE_ID_KEY = "friday:mobile:active:v1";

export async function loadSavedChatState(): Promise<{
  conversations: Conversation[];
  activeId: string | null;
}> {
  try {
    const [rawConversations, activeId] = await Promise.all([
      AsyncStorage.getItem(CONVERSATIONS_KEY),
      AsyncStorage.getItem(ACTIVE_ID_KEY),
    ]);

    const parsed = rawConversations ? JSON.parse(rawConversations) : [];
    const conversations: Conversation[] = Array.isArray(parsed)
      ? parsed.map((c: Conversation) => ({
          ...c,
          messages: Array.isArray(c.messages)
            ? c.messages.map((m) => ({
                ...m,
                isStreaming: false,
                activeToolLabel: undefined,
              }))
            : [],
        }))
      : [];
    const validActive = conversations.some((c) => c.id === activeId) ? activeId : null;

    return { conversations, activeId: validActive };
  } catch {
    return { conversations: [], activeId: null };
  }
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  const sanitized = conversations.map((c) => ({
    ...c,
    messages: c.messages.map(
      ({ isStreaming: _s, activeToolLabel: _a, ...rest }) => rest
    ),
  }));

  try {
    await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(sanitized));
  } catch {
    try {
      const pruned = sanitized.map((c) => ({
        ...c,
        messages: c.messages.map((m) => ({
          ...m,
          attachments: m.attachments?.map((a) => ({
            ...a,
            dataUrl: a.dataUrl.length > 250_000 ? "" : a.dataUrl,
          })),
        })),
      }));
      await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(pruned));
    } catch {
      // Ignore storage error
    }
  }
}

export async function saveActiveConversationId(id: string | null): Promise<void> {
  try {
    if (id) {
      await AsyncStorage.setItem(ACTIVE_ID_KEY, id);
    } else {
      await AsyncStorage.removeItem(ACTIVE_ID_KEY);
    }
  } catch {
    // Ignore storage error
  }
}
