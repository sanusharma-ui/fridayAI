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
  FileText,
  Image as ImageIcon,
  KeyRound,
  Paperclip,
  RefreshCw,
  Square,
  WifiOff,
  X,
} from "lucide-react-native";
import { ComposerAttachmentChip } from "./src/components/AttachmentChips";
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
import {
  DEFAULT_MODELS,
  DEFAULT_SETTINGS,
  loadCachedModels,
  loadSettings,
  saveCachedModels,
  saveSettings,
} from "./src/services/settingsStorage";
import { colors } from "./src/theme/colors";
import type {
  AppSettings,
  Attachment,
  ChatMessage,
  ConnectionState,
  Conversation,
  GroqModelOption,
} from "./src/types";

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

function FridayWorkspace() {
  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [availableModels, setAvailableModels] =
    useState<GroqModelOption[]>(DEFAULT_MODELS);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pickingFiles, setPickingFiles] = useState(false);

  const [pendingChatId, setPendingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<Attachment | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const sendingRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const userScrolledUpRef = useRef(false);

  const activeConversation =
    conversations.find((c) => c.id === activeId) || null;
  const isStreamingAny = pendingChatId !== null;
  const hasUsableKey = Boolean(settings.groqApiKey.trim() || hasServerKey);

  const connectionState: ConnectionState = (() => {
    if (backendOnline === null) return "checking";
    if (!backendOnline) return "backend_offline";
    if (!hasUsableKey) return "missing_key";
    return "ready";
  })();

  // Load saved state
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
    })();
  }, []);

  // Persist chats when not mid-stream (avoids heavy AsyncStorage writes every 30ms!)
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
      // Remove the trailing assistant message so we regenerate fresh
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
      // Retry or Regenerate: append fresh streaming assistant placeholder
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

    // Smooth adaptive streaming buffer so ultra-fast Groq bursts flow smoothly at ~35fps
    let rawReceivedContent = "";
    let displayedContent = "";
    let rawReasoning = "";
    let displayedReasoning = "";
    let collectedNotices: string[] = [];
    let finalModelUsed: string | undefined;
    let finalDurationMs: number | undefined;
    let networkFinished = false;

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
        // Adaptive step: smooth word-by-word feel without falling behind long streams
        const step = abortController.signal.aborted
          ? rem
          : Math.max(4, Math.ceil(rem * 0.26));
        let nextEnd = Math.min(
          rawReceivedContent.length,
          displayedContent.length + step
        );
        // Snap gently to whitespace boundary if within 4 chars for cleaner word reveal
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
        });
        if (!userScrolledUpRef.current) {
          scrollRef.current?.scrollToEnd({ animated: false });
        }
      }

      if (
        networkFinished &&
        displayedContent.length >= rawReceivedContent.length &&
        displayedReasoning.length >= rawReasoning.length
      ) {
        clearInterval(tickInterval);
        drainResolve?.();
      }
    }, 28);

    try {
      await streamChatMessage(
        {
          backendUrl: settings.backendUrl,
          apiKey: settings.groqApiKey,
          message: content,
          history,
          attachments: contextAttachments,
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
            rawReceivedContent += delta;
          },
          onDone: (info) => {
            finalModelUsed = info.modelUsed;
            finalDurationMs = info.durationMs;
          },
        },
        abortController.signal
      );

      networkFinished = true;
      await drainPromise;

      const wasStopped = abortController.signal.aborted;

      if (!rawReceivedContent.trim() && wasStopped) {
        // User stopped before any content arrived — remove empty placeholder
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
          modelUsed: finalModelUsed || settings.selectedModel,
          durationMs: finalDurationMs,
          isStreaming: false,
          stopped: wasStopped,
        });
      }

      setBackendOnline(true);
    } catch (err) {
      clearInterval(tickInterval);
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);

      // Remove empty assistant placeholder if request failed before streaming content
      if (!rawReceivedContent.trim()) {
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <TopBar
        title={activeConversation?.title || "New conversation"}
        connectionState={connectionState}
        hasApiKey={hasUsableKey}
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
      >
        <View style={styles.flex}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              !activeConversation?.messages.length && styles.scrollWelcome,
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
            {!activeConversation?.messages.length ? (
              <WelcomeView
                hasApiKey={hasUsableKey}
                disabled={isStreamingAny}
                onSelectPrompt={(prompt) =>
                  void handleSend({ overrideText: prompt })
                }
                onOpenSettings={() => setSettingsOpen(true)}
              />
            ) : (
              <View style={styles.streamWrap}>
                <View style={styles.streamIntro}>
                  <View style={styles.introLine} />
                  <Text style={styles.introText}>CONVERSATION</Text>
                  <View style={styles.introLine} />
                </View>

                {activeConversation.messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isLatestAssistant={msg.id === lastAssistantMsgId}
                    onOpenImage={(att) => setPreviewImage(att)}
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

          {showScrollBottom && activeConversation && (
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

        {/* Composer Region */}
        <View style={styles.composerOuter}>
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
                    <KeyRound size={12} color={colors.accent} />
                    <Text
                      style={[styles.errorActionLabel, { color: colors.accent }]}
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
            <View style={styles.attachPopover}>
              <Pressable onPress={handlePickImages} style={styles.attachOption}>
                <ImageIcon size={17} color={colors.sage} />
                <Text style={styles.attachOptionText}>Attach Photo / Image</Text>
              </Pressable>
              <View style={styles.attachDivider} />
              <Pressable onPress={handlePickPdfs} style={styles.attachOption}>
                <FileText size={17} color={colors.accent} />
                <Text style={styles.attachOptionText}>Attach PDF Document</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.composerCard}>
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
                <Text style={styles.pickingText}>Preparing attachment…</Text>
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
                <Paperclip
                  size={18}
                  color={showAttachMenu ? colors.accent : colors.muted}
                />
              </Pressable>

              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={
                  attachments.length > 0
                    ? "Ask Friday about attached file(s)…"
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
                    size={14}
                    color={colors.danger}
                    fill={colors.danger}
                  />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void handleSend()}
                  disabled={
                    (!draft.trim() && attachments.length === 0) || pickingFiles
                  }
                  style={({ pressed }) => [
                    styles.sendBtn,
                    ((!draft.trim() && attachments.length === 0) ||
                      pickingFiles) &&
                      styles.sendBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel="Send message"
                >
                  <ArrowUp
                    size={18}
                    color={colors.ctaText}
                    strokeWidth={2.5}
                  />
                </Pressable>
              )}
            </View>

            <View style={styles.composerFooter}>
              <Pressable
                onPress={() => setSettingsOpen(true)}
                style={styles.modelPill}
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
                <Text style={styles.modelPillText} numberOfLines={1}>
                  {settings.selectedModel} · Groq Stream
                </Text>
              </Pressable>
              {isStreamingAny ? (
                <Text style={styles.streamingHint}>Tap ■ to stop</Text>
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
        selectedModel={settings.selectedModel}
        onClose={() => setDrawerOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onOpenSettings={() => setSettingsOpen(true)}
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
    paddingBottom: 18,
  },
  scrollWelcome: {
    flexGrow: 1,
    justifyContent: "center",
  },
  streamWrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  streamIntro: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  introLine: {
    width: 32,
    height: 1,
    backgroundColor: colors.line,
  },
  introText: {
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.subtle,
    fontWeight: "600",
  },
  scrollBottomBtn: {
    position: "absolute",
    right: 16,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  composerOuter: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: colors.bg,
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 11,
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
    borderRadius: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  errorActionLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.text,
  },
  attachPopover: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    marginBottom: 8,
    overflow: "hidden",
  },
  attachOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  attachOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
  },
  attachDivider: {
    height: 1,
    backgroundColor: colors.line,
  },
  composerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
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
    borderRadius: 10,
    backgroundColor: colors.sidebar,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
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
    maxHeight: 115,
    color: colors.text,
    fontSize: 14.5,
    lineHeight: 20,
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.ctaBg,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.38,
  },
  stopBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
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
    marginTop: 7,
    paddingHorizontal: 4,
  },
  modelPill: {
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
  modelPillText: {
    fontSize: 11,
    color: colors.muted,
  },
  streamingHint: {
    fontSize: 10.5,
    color: colors.danger,
    fontWeight: "500",
  },
  charCounter: {
    fontSize: 10.5,
    color: colors.warning,
  },
  pressed: {
    opacity: 0.8,
  },
});
