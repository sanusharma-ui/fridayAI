import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Plus,
  RefreshCw,
  Square,
  WifiOff,
  X,
} from "lucide-react-native";
import { AmbientGlow } from "./src/components/AmbientGlow";
import { ComposerAttachmentChip } from "./src/components/AttachmentChips";
import { ContactsModal } from "./src/components/ContactsModal";
import { ImagePreviewModal } from "./src/components/ImagePreviewModal";
import { MessageBubble } from "./src/components/MessageBubble";
import { SettingsModal } from "./src/components/SettingsModal";
import { SidebarDrawer } from "./src/components/SidebarDrawer";
import { TopBar } from "./src/components/TopBar";
import { WelcomeView } from "./src/components/WelcomeView";
import { checkBackendHealth, streamChatMessage } from "./src/services/api";
import { pickImagesFromLibrary, pickPdfDocuments } from "./src/services/attachments";
import {
  loadSavedChatState,
  saveActiveConversationId,
  saveConversations,
} from "./src/services/chatStorage";
import { getContactsDashboardSummary } from "./src/services/contactsDb";
import {
  DEFAULT_MODELS,
  DEFAULT_SETTINGS,
  loadCachedModels,
  loadSettings,
  saveCachedModels,
  saveSettings,
} from "./src/services/settingsStorage";
import {
  describeToolActivity,
  executeClientToolCalls,
} from "./src/services/toolExecutor";
import { colors } from "./src/theme/colors";
import { useResponsive } from "./src/theme/responsive";
import type {
  AgentLoopMessage,
  AppSettings,
  Attachment,
  ChatMessage,
  ConnectionState,
  Conversation,
  GroqModelOption,
  PendingDeviceAction,
  ToolBadgeItem,
  ToolCallPayload,
} from "./src/types";

const MAX_AGENT_TOOL_ROUNDS = 5;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeConversation(
  firstMessage: ChatMessage,
  assistantPlaceholder: ChatMessage
): Conversation {
  const now = Date.now();
  let clean = firstMessage.content.replace(/\s+/g, " ").trim();
  if (!clean && firstMessage.attachments?.length) {
    clean = `File: ${firstMessage.attachments[0].name}`;
  }
  if (!clean) clean = "New conversation";

  return {
    id: makeId(),
    title: clean.length > 42 ? `${clean.slice(0, 42).trim()}…` : clean,
    createdAt: now,
    updatedAt: now,
    messages: [firstMessage, assistantPlaceholder],
  };
}

function shortModelLabel(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1];
}

function FridayWorkspace() {
  const { horizontalPad, contentMaxWidth } = useResponsive();

  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [vaultStats, setVaultStats] = useState({
    contactsCount: 0,
    totalPayable: 0,
    totalReceivable: 0,
  });

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [availableModels, setAvailableModels] =
    useState<GroqModelOption[]>(DEFAULT_MODELS);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [draft, setDraft] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pickingFiles, setPickingFiles] = useState(false);

  const [pendingChatId, setPendingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<Attachment | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const sendingRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const userScrolledUpRef = useRef(false);

  const activeConversation =
    conversations.find((c) => c.id === activeId) || null;
  const isHome = !activeConversation?.messages.length;
  const isStreamingAny = pendingChatId !== null;
  const hasUsableKey = Boolean(settings.groqApiKey.trim() || hasServerKey);

  const connectionState: ConnectionState = (() => {
    if (backendOnline === null) return "checking";
    if (!backendOnline) return "backend_offline";
    if (!hasUsableKey) return "missing_key";
    return "ready";
  })();

  const refreshContactsSummary = useCallback(async () => {
    try {
      const summary = await getContactsDashboardSummary();
      setVaultStats({
        contactsCount: summary.contactsCount,
        totalPayable: summary.totalPayable,
        totalReceivable: summary.totalReceivable,
      });
    } catch {
      // Ignore initial DB read error
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [chatState, savedSettings, cachedModels] = await Promise.all([
        loadSavedChatState(),
        loadSettings(),
        loadCachedModels(),
      ]);
      setConversations(chatState.conversations);
      setActiveId(chatState.activeId);
      setSettings(savedSettings);
      setAvailableModels(cachedModels);
      setHydrated(true);
      void refreshContactsSummary();
    })();
  }, [refreshContactsSummary]);

  useEffect(() => {
    if (hydrated && !isStreamingAny) {
      void saveConversations(conversations);
    }
  }, [conversations, hydrated, isStreamingAny]);

  useEffect(() => {
    if (hydrated) {
      void saveActiveConversationId(activeId);
    }
  }, [activeId, hydrated]);

  const refreshHealth = useCallback(async (customUrl?: string) => {
    const res = await checkBackendHealth(customUrl);
    setBackendOnline(res.online);
    if (res.online) {
      setHasServerKey(Boolean(res.hasServerFallbackKey));
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshHealth(settings.backendUrl);
    const timer = setInterval(() => {
      void refreshHealth(settings.backendUrl);
    }, 30_000);
    return () => clearInterval(timer);
  }, [hydrated, settings.backendUrl, refreshHealth]);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated });
    }, 50);
  }, []);

  useEffect(() => {
    userScrolledUpRef.current = false;
    if (activeConversation?.messages.length) {
      scrollToBottom(false);
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveSettings(
    next: AppSettings,
    updatedModels?: GroqModelOption[]
  ) {
    setSettings(next);
    await saveSettings(next);
    if (updatedModels && updatedModels.length > 0) {
      setAvailableModels(updatedModels);
      await saveCachedModels(updatedModels);
    }
    setError(null);
    await refreshHealth(next.backendUrl);
  }

  function handleStopGenerating() {
    streamAbortRef.current?.abort();
  }

  function handleNewChat() {
    if (isStreamingAny) handleStopGenerating();
    setActiveId(null);
    setDraft("");
    setAttachments([]);
    setError(null);
    setShowAttachMenu(false);
  }

  function handleSelectChat(id: string) {
    setActiveId(id);
    setDraft("");
    setAttachments([]);
    setError(null);
    setShowAttachMenu(false);
  }

  function handleDeleteChat(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function handleRenameChat(id: string, title: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }

  function handleUpdateMessageAction(
    messageId: string,
    actionId: string,
    patch: Partial<PendingDeviceAction>
  ) {
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        messages: c.messages.map((m) => {
          if (m.id !== messageId || !m.pendingActions) return m;
          return {
            ...m,
            pendingActions: m.pendingActions.map((act) =>
              act.id === actionId ? { ...act, ...patch } : act
            ),
          };
        }),
      }))
    );
  }

  async function handlePickImages() {
    setShowAttachMenu(false);
    setPickingFiles(true);
    setError(null);
    try {
      const picked = await pickImagesFromLibrary();
      if (picked.length > 0) {
        setAttachments((prev) => [...prev, ...picked].slice(0, 4));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pick image.");
    } finally {
      setPickingFiles(false);
    }
  }

  async function handlePickPdfs() {
    setShowAttachMenu(false);
    setPickingFiles(true);
    setError(null);
    try {
      const picked = await pickPdfDocuments();
      if (picked.length > 0) {
        setAttachments((prev) => [...prev, ...picked].slice(0, 4));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pick PDF.");
    } finally {
      setPickingFiles(false);
    }
  }

  async function handleSend(options?: {
    overrideText?: string;
    mode?: "normal" | "retry" | "regenerate";
    explicitAttachments?: Attachment[];
  }) {
    const mode = options?.mode || "normal";
    const content = (options?.overrideText ?? draft).trim();
    const currentAttachments = options?.explicitAttachments ?? attachments;

    if ((!content && currentAttachments.length === 0) || sendingRef.current) {
      return;
    }

    if (!hasUsableKey) {
      setError(
        "Groq API key setup nahi hai. Settings me jaakar apni Groq API key add karein."
      );
      setSettingsOpen(true);
      return;
    }

    sendingRef.current = true;
    userScrolledUpRef.current = false;
    setError(null);
    setShowAttachMenu(false);

    const priorMessages = activeConversation?.messages || [];
    let baseMessages = priorMessages;

    if (mode === "regenerate" && priorMessages.length > 0) {
      const last = priorMessages[priorMessages.length - 1];
      baseMessages =
        last.role === "assistant" ? priorMessages.slice(0, -1) : priorMessages;
    }

    const historyMessages =
      mode === "retry" || mode === "regenerate"
        ? baseMessages.slice(0, -1)
        : baseMessages;

    const history = historyMessages
      .filter((m) => m.content.trim().length > 0)
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));

    const previousFiles =
      [...historyMessages].reverse().find((m) => m.attachments?.length)
        ?.attachments || [];
    const contextAttachments = currentAttachments.length
      ? currentAttachments
      : previousFiles;

    const userMessageId =
      mode === "retry" || mode === "regenerate"
        ? baseMessages[baseMessages.length - 1]?.id || makeId()
        : makeId();

    const assistantMsgId = makeId();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      isStreaming: true,
    };

    let targetId = activeId;

    if (mode === "normal") {
      const userMsg: ChatMessage = {
        id: userMessageId,
        role: "user",
        content,
        createdAt: Date.now(),
        attachments:
          currentAttachments.length > 0 ? [...currentAttachments] : undefined,
      };

      if (activeConversation) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? {
                  ...c,
                  messages: [...c.messages, userMsg, assistantPlaceholder],
                  updatedAt: Date.now(),
                }
              : c
          )
        );
      } else {
        const created = makeConversation(userMsg, assistantPlaceholder);
        targetId = created.id;
        setConversations((prev) => [created, ...prev]);
        setActiveId(created.id);
      }

      setDraft("");
      setAttachments([]);
    } else if (activeConversation) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                messages: [...baseMessages, assistantPlaceholder],
                updatedAt: Date.now(),
              }
            : c
        )
      );
    }

    if (!targetId) {
      sendingRef.current = false;
      return;
    }

    setPendingChatId(targetId);
    scrollToBottom(true);

    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    let rawReceivedContent = "";
    let displayedContent = "";
    let rawReasoning = "";
    let displayedReasoning = "";
    let collectedNotices: string[] = [];
    let collectedActions: PendingDeviceAction[] = [];
    let collectedBadges: ToolBadgeItem[] = [];
    let finalModelUsed: string | undefined;
    let totalDurationMs = 0;
    let allRoundsFinished = false;

    const patchAssistantMessage = (patch: Partial<ChatMessage>) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetId) return c;
          return {
            ...c,
            updatedAt: Date.now(),
            messages: c.messages.map((m) =>
              m.id === assistantMsgId ? { ...m, ...patch } : m
            ),
          };
        })
      );
    };

    let drainResolve: (() => void) | null = null;
    const drainPromise = new Promise<void>((resolve) => {
      drainResolve = resolve;
    });

    const tickInterval = setInterval(() => {
      let changed = false;

      if (displayedReasoning.length < rawReasoning.length) {
        const rem = rawReasoning.length - displayedReasoning.length;
        const step = Math.max(8, Math.ceil(rem * 0.35));
        displayedReasoning = rawReasoning.slice(
          0,
          displayedReasoning.length + step
        );
        changed = true;
      }

      if (displayedContent.length < rawReceivedContent.length) {
        const rem = rawReceivedContent.length - displayedContent.length;
        const step = abortController.signal.aborted
          ? rem
          : Math.max(4, Math.ceil(rem * 0.26));
        let nextEnd = Math.min(
          rawReceivedContent.length,
          displayedContent.length + step
        );
        while (
          nextEnd < rawReceivedContent.length &&
          nextEnd - displayedContent.length < step + 4 &&
          !/\s/.test(rawReceivedContent[nextEnd - 1])
        ) {
          nextEnd++;
        }
        displayedContent = rawReceivedContent.slice(0, nextEnd);
        changed = true;
      }

      if (changed) {
        patchAssistantMessage({
          content: displayedContent,
          reasoning: displayedReasoning || undefined,
          notices: collectedNotices.length ? [...collectedNotices] : undefined,
          pendingActions: collectedActions.length
            ? [...collectedActions]
            : undefined,
          toolBadges: collectedBadges.length ? [...collectedBadges] : undefined,
        });
        if (!userScrolledUpRef.current) {
          scrollRef.current?.scrollToEnd({ animated: false });
        }
      }

      if (
        allRoundsFinished &&
        displayedContent.length >= rawReceivedContent.length &&
        displayedReasoning.length >= rawReasoning.length
      ) {
        clearInterval(tickInterval);
        drainResolve?.();
      }
    }, 28);

    const overallStartedAt = Date.now();

    try {
      const agentMessages: AgentLoopMessage[] = [];

      for (let round = 0; round < MAX_AGENT_TOOL_ROUNDS; round++) {
        if (abortController.signal.aborted) break;

        let pendingRoundToolCalls: ToolCallPayload[] = [];
        let roundAssistantText = "";

        await streamChatMessage(
          {
            backendUrl: settings.backendUrl,
            apiKey: settings.groqApiKey,
            message: content,
            history,
            attachments: contextAttachments,
            agentMessages,
            enableTools: round < MAX_AGENT_TOOL_ROUNDS - 1,
            model: settings.selectedModel,
            visionModel: settings.selectedVisionModel,
          },
          {
            onMeta: (meta) => {
              if (meta.notices?.length) {
                collectedNotices = [...collectedNotices, ...meta.notices];
                patchAssistantMessage({ notices: [...collectedNotices] });
              }
              if (
                meta.extractedTexts &&
                Object.keys(meta.extractedTexts).length > 0
              ) {
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== targetId) return c;
                    return {
                      ...c,
                      messages: c.messages.map((m) => {
                        if (m.id !== userMessageId || !m.attachments) return m;
                        return {
                          ...m,
                          attachments: m.attachments.map((a) => ({
                            ...a,
                            extractedText:
                              meta.extractedTexts?.[a.id] || a.extractedText,
                          })),
                        };
                      }),
                    };
                  })
                );
              }
            },
            onNotice: (notice) => {
              collectedNotices = [...collectedNotices, notice];
              patchAssistantMessage({ notices: [...collectedNotices] });
            },
            onReasoningDelta: (delta) => {
              rawReasoning += delta;
            },
            onContentDelta: (delta) => {
              const cleanDelta = delta.replace(/<function=[\s\S]*$/g, "");
              if (cleanDelta) {
                rawReceivedContent += cleanDelta;
              }
            },
            onToolCalls: (payload) => {
              pendingRoundToolCalls = payload.toolCalls;
              roundAssistantText = payload.assistantContent;
              if (payload.modelUsed) finalModelUsed = payload.modelUsed;
            },
            onDone: (info) => {
              if (info.modelUsed) finalModelUsed = info.modelUsed;
            },
          },
          abortController.signal
        );

        if (pendingRoundToolCalls.length === 0 || abortController.signal.aborted) {
          patchAssistantMessage({ activeToolLabel: undefined });
          break;
        }

        if (rawReceivedContent.includes("<function=")) {
          rawReceivedContent = rawReceivedContent
            .replace(/<function=[\s\S]*?<\/function>/g, "")
            .trim();
          displayedContent = rawReceivedContent;
        } else if (rawReceivedContent.trim()) {
          rawReceivedContent = `${rawReceivedContent.trim()}\n\n`;
        }

        const activityLabel = describeToolActivity(
          pendingRoundToolCalls[0].name
        );
        patchAssistantMessage({ activeToolLabel: activityLabel });

        const executed = await executeClientToolCalls(pendingRoundToolCalls);

        if (executed.pendingActions.length > 0) {
          collectedActions = [...collectedActions, ...executed.pendingActions];
        }
        if (executed.badges.length > 0) {
          collectedBadges = [...collectedBadges, ...executed.badges];
          void refreshContactsSummary();
        }

        patchAssistantMessage({
          pendingActions: collectedActions.length
            ? [...collectedActions]
            : undefined,
          toolBadges: collectedBadges.length ? [...collectedBadges] : undefined,
        });
        if (!userScrolledUpRef.current) {
          scrollToBottom(true);
        }

        agentMessages.push({
          role: "assistant",
          content: roundAssistantText.trim() || null,
          tool_calls: pendingRoundToolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: tc.rawArguments || JSON.stringify(tc.arguments || {}),
            },
          })),
        });

        for (const out of executed.toolOutputs) {
          agentMessages.push({
            role: "tool",
            tool_call_id: out.toolCallId,
            content: out.outputJson,
          });
        }
      }

      patchAssistantMessage({ activeToolLabel: undefined });
      totalDurationMs = Date.now() - overallStartedAt;

      if (!rawReceivedContent.trim() && collectedActions.length > 0) {
        const firstAct = collectedActions[0];
        rawReceivedContent =
          firstAct.type === "call"
            ? `Maine **${firstAct.contactName}** ke liye call card ready kar diya hai. Dial karne ke liye neeche **Confirm Call** tap karein.`
            : `Maine **${firstAct.contactName}** ke liye SMS draft tayyar kar diya hai. Review karke **Confirm & Open SMS** tap karein.`;
      }

      allRoundsFinished = true;
      await drainPromise;

      const wasStopped = abortController.signal.aborted;

      if (
        !rawReceivedContent.trim() &&
        collectedActions.length === 0 &&
        collectedBadges.length === 0 &&
        wasStopped
      ) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? {
                  ...c,
                  messages: c.messages.filter((m) => m.id !== assistantMsgId),
                }
              : c
          )
        );
      } else {
        patchAssistantMessage({
          content: rawReceivedContent,
          reasoning: rawReasoning || undefined,
          notices: collectedNotices.length ? [...collectedNotices] : undefined,
          pendingActions: collectedActions.length
            ? [...collectedActions]
            : undefined,
          toolBadges: collectedBadges.length ? [...collectedBadges] : undefined,
          modelUsed: finalModelUsed || settings.selectedModel,
          durationMs: totalDurationMs,
          activeToolLabel: undefined,
          isStreaming: false,
          stopped: wasStopped,
        });
      }

      setBackendOnline(true);
    } catch (err) {
      clearInterval(tickInterval);
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);

      if (
        !rawReceivedContent.trim() &&
        collectedActions.length === 0 &&
        collectedBadges.length === 0
      ) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? {
                  ...c,
                  messages: c.messages.filter((m) => m.id !== assistantMsgId),
                }
              : c
          )
        );
      } else {
        patchAssistantMessage({
          content: rawReceivedContent,
          pendingActions: collectedActions.length
            ? [...collectedActions]
            : undefined,
          toolBadges: collectedBadges.length ? [...collectedBadges] : undefined,
          activeToolLabel: undefined,
          isStreaming: false,
          stopped: true,
        });
      }
    } finally {
      clearInterval(tickInterval);
      streamAbortRef.current = null;
      sendingRef.current = false;
      setPendingChatId(null);
    }
  }

  const lastUserMsg = activeConversation?.messages
    .slice()
    .reverse()
    .find((m) => m.role === "user");

  const lastAssistantMsgId = activeConversation?.messages
    .slice()
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  const canSend =
    (draft.trim().length > 0 || attachments.length > 0) && !pickingFiles;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <AmbientGlow />

      <TopBar
        title={activeConversation?.title || "Friday"}
        isHome={isHome}
        connectionState={connectionState}
        hasApiKey={hasUsableKey}
        contactsCount={vaultStats.contactsCount}
        onOpenDrawer={() => setDrawerOpen(true)}
        onNewChat={handleNewChat}
        onOpenContacts={() => setContactsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
      >
        <View style={styles.flex}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              isHome && styles.scrollWelcome,
            ]}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } =
                e.nativeEvent;
              const distanceFromBottom =
                contentSize.height - contentOffset.y - layoutMeasurement.height;
              userScrolledUpRef.current = distanceFromBottom > 150;
              setShowScrollBottom(distanceFromBottom > 240);
            }}
            scrollEventThrottle={32}
          >
            {isHome ? (
              <WelcomeView
                hasApiKey={hasUsableKey}
                disabled={isStreamingAny}
                contactsCount={vaultStats.contactsCount}
                totalPayable={vaultStats.totalPayable}
                totalReceivable={vaultStats.totalReceivable}
                onSelectPrompt={(prompt) =>
                  void handleSend({ overrideText: prompt })
                }
                onOpenContacts={() => setContactsOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            ) : (
              <View
                style={[
                  styles.streamWrap,
                  { paddingHorizontal: horizontalPad },
                  contentMaxWidth
                    ? {
                        maxWidth: contentMaxWidth,
                        alignSelf: "center",
                        width: "100%",
                      }
                    : null,
                ]}
              >
                {activeConversation.messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isLatestAssistant={msg.id === lastAssistantMsgId}
                    onOpenImage={(att) => setPreviewImage(att)}
                    onOpenContacts={() => setContactsOpen(true)}
                    onUpdateAction={handleUpdateMessageAction}
                    onRegenerate={
                      lastUserMsg && !isStreamingAny
                        ? () =>
                            void handleSend({
                              overrideText:
                                lastUserMsg.content ||
                                "Analyze attached files",
                              mode: "regenerate",
                              explicitAttachments: lastUserMsg.attachments,
                            })
                        : undefined
                    }
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {showScrollBottom && !isHome && (
            <Pressable
              onPress={() => {
                userScrolledUpRef.current = false;
                scrollToBottom(true);
              }}
              style={styles.scrollBottomBtn}
              accessibilityLabel="Scroll to bottom"
            >
              <ArrowDown size={17} color={colors.text} />
            </Pressable>
          )}
        </View>

        {/* Single Unified Composer Dock */}
        <View
          style={[
            styles.composerOuter,
            { paddingHorizontal: Math.max(10, horizontalPad - 4) },
            contentMaxWidth
              ? { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }
              : null,
          ]}
        >
          {error ? (
            <View style={styles.errorBanner}>
              <View style={styles.errorTextRow}>
                <WifiOff size={15} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
              <View style={styles.errorActions}>
                {(error.toLowerCase().includes("key") ||
                  error.toLowerCase().includes("backend") ||
                  error.toLowerCase().includes("settings")) && (
                  <Pressable
                    onPress={() => setSettingsOpen(true)}
                    style={styles.errorActionBtn}
                  >
                    <KeyRound size={12} color={colors.warning} />
                    <Text
                      style={[
                        styles.errorActionLabel,
                        { color: colors.warning },
                      ]}
                    >
                      Settings
                    </Text>
                  </Pressable>
                )}
                {lastUserMsg && !isStreamingAny && (
                  <Pressable
                    onPress={() =>
                      void handleSend({
                        overrideText:
                          lastUserMsg.content || "Analyze attached files",
                        mode: "retry",
                        explicitAttachments: lastUserMsg.attachments,
                      })
                    }
                    style={styles.errorActionBtn}
                  >
                    <RefreshCw size={12} color={colors.text} />
                    <Text style={styles.errorActionLabel}>Retry</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setError(null)} hitSlop={8}>
                  <X size={16} color={colors.muted} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {showAttachMenu && (
            <View style={styles.attachRowPills}>
              <Pressable onPress={handlePickImages} style={styles.attachPill}>
                <ImageIcon size={16} color={colors.sage} />
                <Text style={styles.attachPillText}>Photo</Text>
              </Pressable>
              <Pressable onPress={handlePickPdfs} style={styles.attachPill}>
                <FileText size={16} color={colors.sky} />
                <Text style={styles.attachPillText}>PDF Document</Text>
              </Pressable>
            </View>
          )}

          <View
            style={[
              styles.composerCard,
              inputFocused && styles.composerCardFocused,
            ]}
          >
            {attachments.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {attachments.map((att) => (
                  <ComposerAttachmentChip
                    key={att.id}
                    attachment={att}
                    onRemove={(id) =>
                      setAttachments((prev) => prev.filter((a) => a.id !== id))
                    }
                    disabled={isStreamingAny}
                  />
                ))}
              </ScrollView>
            )}

            {pickingFiles && (
              <View style={styles.pickingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.pickingText}>Preparing file…</Text>
              </View>
            )}

            <View style={styles.inputRow}>
              <Pressable
                onPress={() => setShowAttachMenu((v) => !v)}
                disabled={isStreamingAny || pickingFiles}
                style={({ pressed }) => [
                  styles.attachBtn,
                  showAttachMenu && styles.attachBtnActive,
                  pressed && styles.pressed,
                ]}
                accessibilityLabel="Attach image or PDF"
              >
                <Plus
                  size={19}
                  color={showAttachMenu ? colors.accent : colors.textSecondary}
                />
              </Pressable>

              <TextInput
                value={draft}
                onChangeText={setDraft}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={
                  attachments.length > 0
                    ? "Ask about attached file…"
                    : "Message Friday…"
                }
                placeholderTextColor={colors.subtle}
                multiline
                maxLength={4000}
                editable={!isStreamingAny}
                style={styles.textInput}
              />

              {isStreamingAny ? (
                <Pressable
                  onPress={handleStopGenerating}
                  style={({ pressed }) => [
                    styles.stopBtn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel="Stop generating"
                >
                  <Square
                    size={13}
                    color={colors.danger}
                    fill={colors.danger}
                  />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void handleSend()}
                  disabled={!canSend}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    !canSend && styles.sendBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel="Send message"
                >
                  <ArrowUp
                    size={18}
                    color={colors.ctaText}
                    strokeWidth={2.6}
                  />
                </Pressable>
              )}
            </View>

            <View style={styles.composerFooter}>
              <Pressable
                onPress={() => setSettingsOpen(true)}
                style={styles.modelSelector}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.modelDot,
                    {
                      backgroundColor: hasUsableKey
                        ? colors.sage
                        : colors.warning,
                    },
                  ]}
                />
                <Text style={styles.modelSelectorText} numberOfLines={1}>
                  {shortModelLabel(settings.selectedModel)}
                </Text>
                <ChevronDown size={12} color={colors.subtle} />
              </Pressable>

              {isStreamingAny ? (
                <Text style={styles.streamingHint}>Stop ■</Text>
              ) : draft.length > 3500 ? (
                <Text style={styles.charCounter}>{draft.length}/4000</Text>
              ) : null}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <SidebarDrawer
        visible={drawerOpen}
        conversations={conversations}
        activeId={activeId}
        groqApiKey={settings.groqApiKey}
        selectedModel={shortModelLabel(settings.selectedModel)}
        contactsCount={vaultStats.contactsCount}
        onClose={() => setDrawerOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onOpenContacts={() => setContactsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <ContactsModal
        visible={contactsOpen}
        onClose={() => setContactsOpen(false)}
        onDataChanged={() => void refreshContactsSummary()}
      />

      <SettingsModal
        visible={settingsOpen}
        settings={settings}
        availableModels={availableModels}
        onClose={() => setSettingsOpen(false)}
        onSaveSettings={handleSaveSettings}
      />

      <ImagePreviewModal
        attachment={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <FridayWorkspace />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  scrollWelcome: {
    flexGrow: 1,
    justifyContent: "center",
  },
  streamWrap: {
    paddingTop: 18,
  },
  scrollBottomBtn: {
    position: "absolute",
    right: 16,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  composerOuter: {
    paddingTop: 6,
    paddingBottom: 8,
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 13,
    padding: 11,
    marginBottom: 8,
    gap: 8,
  },
  errorTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.danger,
    lineHeight: 18,
  },
  errorActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  errorActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  errorActionLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.text,
  },
  attachRowPills: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  attachPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  attachPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  composerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  composerCardFocused: {
    borderColor: colors.accentBorder,
  },
  chipsRow: {
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 2,
  },
  pickingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  pickingText: {
    fontSize: 12,
    color: colors.muted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  attachBtnActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  textInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 118,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.ctaBg,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceElevated,
    opacity: 0.45,
  },
  stopBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  composerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 6,
  },
  modelSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "75%",
  },
  modelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modelSelectorText: {
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: "500",
  },
  streamingHint: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: "600",
  },
  charCounter: {
    fontSize: 11,
    color: colors.warning,
  },
  pressed: {
    opacity: 0.8,
  },
});
