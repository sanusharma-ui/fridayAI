"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Check,
  Code2,
  Copy,
  FileText,
  Lightbulb,
  Menu,
  Paperclip,
  ShieldCheck,
  Terminal,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message";
import { Sidebar } from "@/components/sidebar";
import { FridayMark } from "@/components/friday-mark";
import { ImageLightbox } from "@/components/image-lightbox";
import {
  ComposerAttachmentChip,
  MessageAttachments,
} from "@/components/attachment-view";
import { processUploadedFile } from "@/lib/attachments";
import { loadSavedState, saveActiveId, saveConversations } from "@/lib/storage";
import type { Attachment, BackendStatus, ChatMessage, Conversation } from "@/lib/types";

const EXAMPLES = [
  {
    icon: Code2,
    title: "Write better code",
    subtitle: "Build something great",
    prompt: "Help me design a clean Node.js REST API for a task manager.",
  },
  {
    icon: FileText,
    title: "Analyze documents & images",
    subtitle: "Drop PDFs & pictures",
    prompt: "You can attach PDFs and images directly from the message box below to ask questions about them!",
  },
  {
    icon: BrainCircuit,
    title: "Learn something new",
    subtitle: "Understand any topic",
    prompt: "Explain how JavaScript's event loop works with a simple example.",
  },
  {
    icon: Terminal,
    title: "Solve a problem",
    subtitle: "Debug it step by step",
    prompt: "Give me a step-by-step checklist for debugging a failing API request.",
  },
];

function newId() {
  return crypto.randomUUID();
}

function makeConversation(message: ChatMessage): Conversation {
  const now = Date.now();
  let clean = message.content.replace(/\s+/g, " ").trim();
  if (!clean && message.attachments && message.attachments.length > 0) {
    clean = `File: ${message.attachments[0].name}`;
  }
  if (!clean) clean = "New conversation";

  return {
    id: newId(),
    title: clean.length > 43 ? `${clean.slice(0, 43).trim()}…` : clean,
    createdAt: now,
    updatedAt: now,
    messages: [message],
  };
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* permission denied */
    }
  }
  return (
    <button
      type="button"
      className="message-copy"
      onClick={handleCopy}
      aria-label="Copy message"
      title="Copy response"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<Attachment | null>(null);

  const [pendingChatId, setPendingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const isPendingHere = pendingChatId !== null && pendingChatId === activeId;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [draft]);

  useEffect(() => {
    const saved = loadSavedState();
    setConversations(saved.conversations);
    setActiveId(saved.activeId);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveConversations(conversations);
  }, [conversations, hydrated]);

  useEffect(() => {
    if (hydrated) saveActiveId(activeId);
  }, [activeId, hydrated]);

  useEffect(() => {
    let mounted = true;
    async function checkStatus() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data: { status?: BackendStatus } = await res.json();
        if (mounted) setBackendStatus(data.status ?? "offline");
      } catch {
        if (mounted) setBackendStatus("offline");
      }
    }
    void checkStatus();
    const interval = window.setInterval(checkStatus, 45_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeId, activeConversation?.messages.length, isPendingHere]);

  function onScroll() {
    const el = scrollAreaRef.current;
    if (!el) return;
    setShowScrollButton(el.scrollHeight - el.scrollTop - el.clientHeight > 280);
  }

  function startNewChat() {
    setActiveId(null);
    setDraft("");
    setAttachments([]);
    setError(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function selectChat(id: string) {
    setActiveId(id);
    setDraft("");
    setAttachments([]);
    setError(null);
  }

  function deleteChat(id: string) {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    setConversations((previous) => previous.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function renameChat(id: string, title: string) {
    setConversations((previous) =>
      previous.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsProcessingFiles(true);
    setError(null);

    try {
      const validFiles = files.filter((f) => {
        const isImg = f.type.startsWith("image/");
        const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
        return isImg || isPdf;
      });

      if (validFiles.length === 0) {
        setError("Please select images (PNG, JPG, WEBP, GIF) or PDF files.");
        return;
      }

      // 20MB single-file limit
      const oversized = validFiles.find((f) => f.size > 20 * 1024 * 1024);
      if (oversized) {
        setError(`"${oversized.name}" exceeds the 20MB limit.`);
        return;
      }

      const processed = await Promise.all(validFiles.map((f) => processUploadedFile(f)));
      setAttachments((prev) => [...prev, ...processed]);
    } catch (err) {
      setError("Failed to process file. Please try again.");
      console.error(err);
    } finally {
      setIsProcessingFiles(false);
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      void handleFiles(e.target.files);
    }
    e.target.value = "";
  }

  function onComposerPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      void handleFiles(files);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  async function sendMessage(
    text: string,
    retry = false,
    messageAttachments?: Attachment[]
  ) {
    const content = text.trim();
    const currentAttachments = messageAttachments ?? attachments;

    if ((!content && currentAttachments.length === 0) || sendingRef.current) return;
    if (content.length > 4000) return;

    sendingRef.current = true;
    setError(null);

    const userMessageId = newId();
    let targetId = activeId;

    if (!retry) {
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content,
        createdAt: Date.now(),
        attachments: currentAttachments.length > 0 ? [...currentAttachments] : undefined,
      };

      if (activeConversation) {
        setConversations((previous) =>
          previous.map((c) =>
            c.id === activeConversation.id
              ? { ...c, messages: [...c.messages, userMessage], updatedAt: Date.now() }
              : c
          )
        );
      } else {
        const chat = makeConversation(userMessage);
        targetId = chat.id;
        setConversations((previous) => [chat, ...previous]);
        setActiveId(chat.id);
      }

      setDraft("");
      setAttachments([]);
    }

    if (!targetId) {
      sendingRef.current = false;
      return;
    }
    setPendingChatId(targetId);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          attachments: currentAttachments,
        }),
      });

      const result: {
        response?: string;
        error?: string;
        extractedTexts?: Record<string, string>;
      } = await response.json();

      if (!response.ok || typeof result.response !== "string") {
        throw new Error(result.error || "The model returned an invalid response.");
      }

      // Update message attachments if server extracted additional text
      if (result.extractedTexts && Object.keys(result.extractedTexts).length > 0) {
        setConversations((previous) =>
          previous.map((c) => {
            if (c.id !== targetId) return c;
            return {
              ...c,
              messages: c.messages.map((m) => {
                if (m.id !== userMessageId || !m.attachments) return m;
                return {
                  ...m,
                  attachments: m.attachments.map((att) => ({
                    ...att,
                    extractedText: result.extractedTexts?.[att.id] || att.extractedText,
                  })),
                };
              }),
            };
          })
        );
      }

      const reply: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: result.response,
        createdAt: Date.now(),
      };

      setConversations((previous) =>
        previous.map((c) =>
          c.id === targetId
            ? { ...c, messages: [...c.messages, reply], updatedAt: Date.now() }
            : c
        )
      );
      setBackendStatus("online");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBackendStatus("offline");
    } finally {
      sendingRef.current = false;
      setPendingChatId(null);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void sendMessage(draft);
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage(draft);
    }
  }

  const lastUserMessage = activeConversation?.messages
    .slice()
    .reverse()
    .find((m) => m.role === "user");

  const retryMessage = lastUserMessage?.content || (lastUserMessage?.attachments?.length ? "Retry" : null);
  const retryAttachments = lastUserMessage?.attachments;
  const title = activeConversation?.title ?? "New conversation";

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={closeSidebar}
        onNew={startNewChat}
        onSelect={selectChat}
        onDelete={deleteChat}
        onRename={renameChat}
      />

      <main
        className={`main-content ${!activeConversation?.messages.length ? "is-welcome" : ""}`}
        inert={sidebarOpen}
      >
        <div className="ambient-scene" aria-hidden="true">
          <div className="ambient-sun" />
          <div className="ambient-rings" />
          <div className="ambient-horizon" />
        </div>

        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu icon-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              aria-expanded={sidebarOpen}
              aria-controls="conversation-sidebar"
            >
              <Menu size={22} />
            </button>
            <div className="header-breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{title}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <div
              className={`connection-pill connection-${backendStatus}`}
              title="Checks the Colab /health endpoint"
            >
              <span className="connection-dot" />
              <span>
                {backendStatus === "online"
                  ? "Model online"
                  : backendStatus === "checking"
                  ? "Checking"
                  : backendStatus === "unconfigured"
                  ? "Not configured"
                  : "Model offline"}
              </span>
              {backendStatus === "online" ? (
                <Wifi size={13} />
              ) : backendStatus === "offline" ? (
                <WifiOff size={13} />
              ) : null}
            </div>
            <div className="topbar-divider" />
            <div className="user-badge" title="Personal workspace">
              F
            </div>
          </div>
        </header>

        <section className="chat-layout">
          <div className="chat-scroll" ref={scrollAreaRef} onScroll={onScroll}>
            {!activeConversation?.messages.length ? (
              <div className="welcome-wrap">
                <div className="welcome-content">
                  <div className="welcome-eyebrow">
                    <span /> A LITTLE SPACE TO THINK
                  </div>
                  <h1 className="welcome-title">What&apos;s on your mind?</h1>
                  <p className="welcome-description">
                    Start with a thought, or attach a PDF or image. We&apos;ll take it from here.
                  </p>
                  <div className="suggestions-label">
                    <span>A FEW PLACES TO START</span>
                    <span>01 — 04</span>
                  </div>
                  <div className="starter-grid">
                    {EXAMPLES.map((item) => (
                      <button
                        type="button"
                        key={item.title}
                        className="starter-card"
                        onClick={() => void sendMessage(item.prompt)}
                        disabled={pendingChatId !== null}
                      >
                        <span className="starter-icon">
                          <item.icon size={18} strokeWidth={1.5} />
                        </span>
                        <span className="starter-copy">
                          <strong>{item.title}</strong>
                          <span>{item.subtitle}</span>
                        </span>
                        <ArrowRight size={14} className="starter-arrow" />
                      </button>
                    ))}
                  </div>
                  <div className="welcome-footer">
                    <ShieldCheck size={13} /> History saved in this browser
                  </div>
                </div>
              </div>
            ) : (
              <div className="message-stream">
                <div className="conversation-intro">
                  <span className="intro-line" />
                  <span>CONVERSATION</span>
                  <span className="intro-line" />
                </div>
                {activeConversation.messages.map((message) => (
                  <div
                    className={`message-row ${
                      message.role === "user" ? "message-row-user" : "message-row-ai"
                    }`}
                    key={message.id}
                  >
                    {message.role === "assistant" ? (
                      <>
                        <div className="assistant-avatar">
                          <FridayMark size={21} />
                        </div>
                        <div className="message-content">
                          <div className="message-author">
                            <strong>Friday</strong>
                            <span>{formatTime(message.createdAt)}</span>
                          </div>
                          <MarkdownMessage content={message.content} />
                          <div className="message-tools">
                            <CopyButton text={message.content} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="user-message-group">
                        {message.attachments && message.attachments.length > 0 && (
                          <MessageAttachments
                            attachments={message.attachments}
                            onOpenImage={(att) => setActiveLightboxImage(att)}
                          />
                        )}
                        {message.content && (
                          <div className="user-bubble">{message.content}</div>
                        )}
                        <span className="user-time">{formatTime(message.createdAt)}</span>
                      </div>
                    )}
                  </div>
                ))}
                {isPendingHere && (
                  <div className="message-row message-row-ai" aria-live="polite">
                    <div className="assistant-avatar">
                      <FridayMark size={21} />
                    </div>
                    <div className="message-content">
                      <div className="message-author">
                        <strong>Friday</strong>
                        <span>Thinking…</span>
                      </div>
                      <div className="typing-indicator">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="composer-region">
            {showScrollButton && activeConversation && (
              <button
                type="button"
                className="scroll-bottom-btn"
                aria-label="Scroll to latest message"
                onClick={() =>
                  bottomRef.current?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <ArrowDown size={16} />
              </button>
            )}

            <div className="composer-inner">
              {error && (
                <div className="error-banner" role="alert">
                  <div>
                    <WifiOff size={16} />
                    <span>{error}</span>
                  </div>
                  <div className="error-actions">
                    {retryMessage && (
                      <button
                        type="button"
                        onClick={() => {
                          void sendMessage(retryMessage, true, retryAttachments);
                        }}
                        disabled={pendingChatId !== null}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Dismiss error"
                      onClick={() => setError(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              <form
                className={`composer-card ${isDragging ? "is-dragging" : ""}`}
                onSubmit={onSubmit}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                {/* Drag drop overlay indicator */}
                {isDragging && (
                  <div className="composer-drop-overlay">
                    <Paperclip size={22} />
                    <span>Drop PDF or images here to attach</span>
                  </div>
                )}

                {/* Previews of attached files */}
                {attachments.length > 0 && (
                  <div className="composer-attachments-row">
                    {attachments.map((att) => (
                      <ComposerAttachmentChip
                        key={att.id}
                        attachment={att}
                        onRemove={(id) =>
                          setAttachments((prev) => prev.filter((a) => a.id !== id))
                        }
                        disabled={pendingChatId !== null || isProcessingFiles}
                      />
                    ))}
                  </div>
                )}

                {isProcessingFiles && (
                  <div className="composer-processing-badge">
                    <span className="loading-spin" />
                    <span>Processing file...</span>
                  </div>
                )}

                <div className="composer-input-row">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onFileInputChange}
                    accept="image/*,application/pdf"
                    multiple
                    hidden
                  />
                  <button
                    type="button"
                    className="composer-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach PDF or image"
                    title="Attach PDF or image"
                    disabled={pendingChatId !== null || isProcessingFiles}
                  >
                    <Paperclip size={18} />
                  </button>

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    maxLength={4000}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onComposerKeyDown}
                    onPaste={onComposerPaste}
                    placeholder={
                      attachments.length > 0
                        ? "Ask Friday about the attached file(s)..."
                        : "Ask Friday anything, or attach a PDF / image..."
                    }
                    aria-label="Message Friday"
                    disabled={pendingChatId !== null}
                  />

                  <button
                    type="submit"
                    className="send-btn"
                    aria-label="Send message"
                    disabled={
                      (!draft.trim() && attachments.length === 0) ||
                      pendingChatId !== null ||
                      isProcessingFiles
                    }
                  >
                    {pendingChatId !== null ? (
                      <span className="loading-spin" />
                    ) : (
                      <ArrowRight size={20} strokeWidth={2.3} />
                    )}
                  </button>
                </div>

                <div className="composer-bottom">
                  <div className="composer-model">
                    <span className="model-indicator" />
                    <span>Qwen 2.5 · Colab</span>
                  </div>
                  <div className="composer-controls">
                    <span className="char-count">
                      {draft.length > 3600 ? `${draft.length}/4000` : ""}
                    </span>
                    <span className="composer-hint">
                      Enter to send · Shift + Enter for new line · Drag or paste files
                    </span>
                  </div>
                </div>
              </form>

              <div className="composer-disclaimer">
                Friday can make mistakes. Double-check important information. <span>✦</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Lightbox for viewing full-size images */}
      <ImageLightbox
        attachment={activeLightboxImage}
        onClose={() => setActiveLightboxImage(null)}
      />
    </div>
  );
}
