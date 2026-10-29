"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowRight, BrainCircuit, Check, Code2, Copy,
  Lightbulb, Menu, ShieldCheck, Terminal, Wifi, WifiOff, X,
} from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message";
import { Sidebar } from "@/components/sidebar";
import { FridayMark } from "@/components/friday-mark";
import { loadSavedState, saveActiveId, saveConversations } from "@/lib/storage";
import type { BackendStatus, ChatMessage, Conversation } from "@/lib/types";

const EXAMPLES = [
  { icon: Code2, title: "Write better code", subtitle: "Build something great", prompt: "Help me design a clean Node.js REST API for a task manager." },
  { icon: BrainCircuit, title: "Learn something new", subtitle: "Understand any topic", prompt: "Explain how JavaScript's event loop works with a simple example." },
  { icon: Lightbulb, title: "Explore an idea", subtitle: "Turn thoughts into plans", prompt: "Suggest three interesting backend projects I could build this weekend." },
  { icon: Terminal, title: "Solve a problem", subtitle: "Debug it step by step", prompt: "Give me a step-by-step checklist for debugging a failing API request." },
];

function newId() { return crypto.randomUUID(); }

function makeConversation(message: ChatMessage): Conversation {
  const now = Date.now();
  const clean = message.content.replace(/\s+/g, " ").trim();
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
    } catch { /* permission denied */ }
  }
  return (
    <button type="button" className="message-copy" onClick={handleCopy} aria-label="Copy message" title="Copy response">
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
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => { if (hydrated) saveConversations(conversations); }, [conversations, hydrated]);
  useEffect(() => { if (hydrated) saveActiveId(activeId); }, [activeId, hydrated]);

  useEffect(() => {
    let mounted = true;
    async function checkStatus() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data: { status?: BackendStatus } = await res.json();
        if (mounted) setBackendStatus(data.status ?? "offline");
      } catch { if (mounted) setBackendStatus("offline"); }
    }
    void checkStatus();
    const interval = window.setInterval(checkStatus, 45_000);
    return () => { mounted = false; window.clearInterval(interval); };
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
    setError(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function selectChat(id: string) {
    setActiveId(id);
    setDraft("");
    setError(null);
  }

  function deleteChat(id: string) {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    setConversations((previous) => previous.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function renameChat(id: string, title: string) {
    setConversations((previous) => previous.map((c) => c.id === id ? { ...c, title } : c));
  }

  async function sendMessage(text: string, retry = false) {
    const content = text.trim();
    if (!content || sendingRef.current || content.length > 4000) return;
    sendingRef.current = true;
    setError(null);

    let targetId = activeId;
    if (!retry) {
      const userMessage: ChatMessage = { id: newId(), role: "user", content, createdAt: Date.now() };
      if (activeConversation) {
        setConversations((previous) => previous.map((c) => c.id === activeConversation.id
          ? { ...c, messages: [...c.messages, userMessage], updatedAt: Date.now() }
          : c));
      } else {
        const chat = makeConversation(userMessage);
        targetId = chat.id;
        setConversations((previous) => [chat, ...previous]);
        setActiveId(chat.id);
      }
      setDraft("");
    }

    if (!targetId) { sendingRef.current = false; return; }
    setPendingChatId(targetId);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const result: { response?: string; error?: string } = await response.json();
      if (!response.ok || typeof result.response !== "string") {
        throw new Error(result.error || "The model returned an invalid response.");
      }
      const reply: ChatMessage = { id: newId(), role: "assistant", content: result.response, createdAt: Date.now() };
      setConversations((previous) => previous.map((c) => c.id === targetId
        ? { ...c, messages: [...c.messages, reply], updatedAt: Date.now() }
        : c));
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

  const lastUserMessage = activeConversation?.messages.at(-1);
  const retryMessage = lastUserMessage?.role === "user" ? lastUserMessage.content : null;
  const title = activeConversation?.title ?? "New conversation";

  return (
    <div className="app-shell">
      <Sidebar conversations={conversations} activeId={activeId} open={sidebarOpen} onClose={closeSidebar}
        onNew={startNewChat} onSelect={selectChat} onDelete={deleteChat} onRename={renameChat} />

      <main className={`main-content ${!activeConversation?.messages.length ? "is-welcome" : ""}`} inert={sidebarOpen}>
        <div className="ambient-scene" aria-hidden="true"><div className="ambient-sun" /><div className="ambient-rings" /><div className="ambient-horizon" /></div>
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-menu icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar" aria-expanded={sidebarOpen} aria-controls="conversation-sidebar"><Menu size={22} /></button>
            <div className="header-breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{title}</strong></div>
          </div>
          <div className="topbar-right">
            <div className={`connection-pill connection-${backendStatus}`} title="Checks the Colab /health endpoint">
              <span className="connection-dot" />
              <span>{backendStatus === "online" ? "Model online" : backendStatus === "checking" ? "Checking" : backendStatus === "unconfigured" ? "Not configured" : "Model offline"}</span>
              {backendStatus === "online" ? <Wifi size={13} /> : backendStatus === "offline" ? <WifiOff size={13} /> : null}
            </div>
            <div className="topbar-divider" />
            <div className="user-badge" title="Personal workspace">F</div>
          </div>
        </header>

        <section className="chat-layout">
          <div className="chat-scroll" ref={scrollAreaRef} onScroll={onScroll}>
            {!activeConversation?.messages.length ? (
              <div className="welcome-wrap">
                <div className="welcome-content">
                  <div className="welcome-eyebrow"><span /> A LITTLE SPACE TO THINK</div>
                  <h1 className="welcome-title">What&apos;s on your mind?</h1>
                  <p className="welcome-description">Start with a thought. We&apos;ll take it from here.</p>
                  <div className="suggestions-label"><span>A FEW PLACES TO START</span><span>01 — 04</span></div>
                  <div className="starter-grid">
                    {EXAMPLES.map((item) => (
                      <button type="button" key={item.title} className="starter-card" onClick={() => void sendMessage(item.prompt)} disabled={pendingChatId !== null}>
                        <span className="starter-icon"><item.icon size={18} strokeWidth={1.5} /></span>
                        <span className="starter-copy"><strong>{item.title}</strong><span>{item.subtitle}</span></span>
                        <ArrowRight size={14} className="starter-arrow" />
                      </button>
                    ))}
                  </div>
                  <div className="welcome-footer"><ShieldCheck size={13} /> History saved in this browser</div>
                </div>
              </div>
            ) : (
              <div className="message-stream">
                <div className="conversation-intro"><span className="intro-line" /><span>CONVERSATION</span><span className="intro-line" /></div>
                {activeConversation.messages.map((message) => (
                  <div className={`message-row ${message.role === "user" ? "message-row-user" : "message-row-ai"}`} key={message.id}>
                    {message.role === "assistant" ? (
                      <>
                        <div className="assistant-avatar"><FridayMark size={21} /></div>
                        <div className="message-content">
                          <div className="message-author"><strong>Friday</strong><span>{formatTime(message.createdAt)}</span></div>
                          <MarkdownMessage content={message.content} />
                          <div className="message-tools"><CopyButton text={message.content} /></div>
                        </div>
                      </>
                    ) : (
                      <div className="user-message-group"><div className="user-bubble">{message.content}</div><span className="user-time">{formatTime(message.createdAt)}</span></div>
                    )}
                  </div>
                ))}
                {isPendingHere && (
                  <div className="message-row message-row-ai" aria-live="polite">
                    <div className="assistant-avatar"><FridayMark size={21} /></div>
                    <div className="message-content"><div className="message-author"><strong>Friday</strong><span>Thinking…</span></div><div className="typing-indicator"><i /><i /><i /></div></div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="composer-region">
            {showScrollButton && activeConversation && (
              <button type="button" className="scroll-bottom-btn" aria-label="Scroll to latest message" onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}><ArrowDown size={16} /></button>
            )}

            <div className="composer-inner">
              {error && (
                <div className="error-banner" role="alert">
                  <div><WifiOff size={16} /><span>{error}</span></div>
                  <div className="error-actions">
                    {retryMessage && <button type="button" onClick={() => { void sendMessage(retryMessage, true); }} disabled={pendingChatId !== null}>Retry</button>}
                    <button type="button" aria-label="Dismiss error" onClick={() => setError(null)}><X size={16} /></button>
                  </div>
                </div>
              )}
              <form className="composer-card" onSubmit={onSubmit}>
                <div className="composer-input-row">
                  <textarea ref={textareaRef} rows={1} maxLength={4000} value={draft}
                    onChange={(e) => setDraft(e.target.value)} onKeyDown={onComposerKeyDown}
                    placeholder="Ask Friday anything..." aria-label="Message Friday" disabled={pendingChatId !== null} />
                  <button type="submit" className="send-btn" aria-label="Send message" disabled={!draft.trim() || pendingChatId !== null}>
                    {pendingChatId !== null ? <span className="loading-spin" /> : <ArrowRight size={20} strokeWidth={2.3} />}
                  </button>
                </div>
                <div className="composer-bottom">
                  <div className="composer-model"><span className="model-indicator" /><span>Qwen 2.5 · Colab</span></div>
                  <div className="composer-controls"><span className="char-count">{draft.length > 3600 ? `${draft.length}/4000` : ""}</span><span className="composer-hint">Enter to send · Shift + Enter for a new line</span></div>
                </div>
              </form>
              <div className="composer-disclaimer">Friday can make mistakes. Double-check important information. <span>✦</span></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
