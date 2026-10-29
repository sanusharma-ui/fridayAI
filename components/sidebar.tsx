"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, MessageSquare, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { FridayMark } from "@/components/friday-mark";
import type { Conversation } from "@/lib/types";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function Sidebar({ conversations, activeId, open, onClose, onNew, onSelect, onDelete, onRename }: SidebarProps) {
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const desktop = window.matchMedia("(min-width: 751px)");
    const closeOnDesktop = () => { if (desktop.matches) onClose(); };
    closeOnDesktop();
    sidebarRef.current?.querySelector<HTMLButtonElement>(".sidebar-close")?.focus();
    function handleKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []).filter((el) => el.getClientRects().length > 0);
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", handleKey);
      desktop.removeEventListener("change", closeOnDesktop);
      previous?.focus();
    };
  }, [open, onClose]);

  const filtered = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((chat) => chat.title.toLowerCase().includes(query.toLowerCase()));

  function saveEdit(id: string) {
    const title = editValue.trim();
    if (title) onRename(id, title.slice(0, 100));
    setEditingId(null);
  }

  return (
    <>
      {open && <button type="button" aria-label="Close sidebar" className="sidebar-backdrop" onClick={onClose} />}
      <aside id="conversation-sidebar" ref={sidebarRef} aria-label="Conversation sidebar" className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <div className="brand-row">
            <div className="brand-symbol"><FridayMark size={26} /></div>
            <div className="brand-name">FRIDAY<span className="brand-dot">.</span></div>
            <button type="button" onClick={onClose} className="sidebar-close icon-btn" aria-label="Close menu"><ChevronLeft size={19} /></button>
          </div>
          <div className="brand-caption">YOUR PERSONAL AI WORKSPACE</div>
        </div>

        <div className="sidebar-actions">
          <button type="button" className="new-chat-btn" onClick={() => { onNew(); onClose(); }}>
            <Plus size={18} strokeWidth={2.25} /><span>New conversation</span><span className="new-chat-shortcut">＋</span>
          </button>
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
          </label>
        </div>

        <div className="sidebar-divider" />
        <div className="history-header"><span>CONVERSATIONS</span><span>{conversations.length}</span></div>
        <nav className="history-list" aria-label="Conversations">
          {filtered.length === 0 ? (
            <div className="history-empty">
              <MessageSquare size={18} />
              <p>{query ? "No matching conversations" : "Your conversations will appear here"}</p>
            </div>
          ) : filtered.map((chat) => (
            <div key={chat.id} className={`history-item ${activeId === chat.id ? "history-active" : ""}`}>
              {editingId === chat.id ? (
                <div className="history-edit">
                  <input autoFocus value={editValue} maxLength={100}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(chat.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    aria-label="Rename conversation" />
                  <button type="button" onClick={() => saveEdit(chat.id)} aria-label="Save title"><Check size={15} /></button>
                </div>
              ) : (
                <>
                  <button type="button" className="history-select" onClick={() => { onSelect(chat.id); onClose(); }} title={chat.title}>
                    <MessageSquare size={16} strokeWidth={1.7} />
                    <span>{chat.title}</span>
                  </button>
                  <button type="button" className="history-menu-btn" aria-label={`Options for ${chat.title}`}
                    onClick={() => setMenuId(menuId === chat.id ? null : chat.id)}><MoreHorizontal size={17} /></button>
                  {menuId === chat.id && (
                    <div className="history-menu">
                      <button type="button" onClick={() => { setEditingId(chat.id); setEditValue(chat.title); setMenuId(null); }}><Pencil size={14} />Rename</button>
                      <button type="button" className="danger" onClick={() => { onDelete(chat.id); setMenuId(null); }}><Trash2 size={14} />Delete</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-rule" />
          <div className="privacy-card">
            <div className="privacy-icon"><span className="privacy-pulse" /></div>
            <div><strong>Local workspace</strong><span>Chats saved on this device</span></div>
          </div>
          <div className="sidebar-bottom"><span>FRIDAY / V1.0</span><span>BUILT FOR YOU <span className="footer-sparkle">✦</span></span></div>
        </div>
      </aside>
    </>
  );
}
