"use client";

import { useState } from "react";
import { Download, ExternalLink, Eye, FileText, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { formatFileSize } from "@/lib/pdf";
import type { Attachment } from "@/lib/types";

interface ComposerAttachmentChipProps {
  attachment: Attachment;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function ComposerAttachmentChip({
  attachment,
  onRemove,
  disabled,
}: ComposerAttachmentChipProps) {
  const isImage = attachment.type.startsWith("image/");
  const isPdf = attachment.type === "application/pdf";

  return (
    <div className={`composer-chip ${isPdf ? "chip-pdf" : "chip-img"}`} title={attachment.name}>
      {isImage ? (
        <div className="chip-thumb-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.dataUrl} alt={attachment.name} className="chip-thumb" />
        </div>
      ) : (
        <div className="chip-icon-wrap">
          <FileText size={16} className="chip-pdf-icon" />
        </div>
      )}

      <div className="chip-info">
        <span className="chip-name">{attachment.name}</span>
        <span className="chip-size">
          {formatFileSize(attachment.size)}
          {attachment.extractedText ? " · Text ready" : ""}
        </span>
      </div>

      <button
        type="button"
        className="chip-remove"
        onClick={() => onRemove(attachment.id)}
        disabled={disabled}
        aria-label={`Remove ${attachment.name}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface MessageAttachmentsProps {
  attachments: Attachment[];
  onOpenImage?: (att: Attachment) => void;
}

export function MessageAttachments({
  attachments,
  onOpenImage,
}: MessageAttachmentsProps) {
  const [expandedPdfs, setExpandedPdfs] = useState<Record<string, boolean>>({});

  if (!attachments || attachments.length === 0) return null;

  function togglePdf(id: string) {
    setExpandedPdfs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="msg-attachments-container">
      {attachments.map((att) => {
        const isImage = att.type.startsWith("image/");
        const isPdf = att.type === "application/pdf";
        const isExpanded = !!expandedPdfs[att.id];

        if (isImage) {
          return (
            <div key={att.id} className="msg-image-card">
              <button
                type="button"
                className="msg-image-btn"
                onClick={() => onOpenImage?.(att)}
                title="Click to expand image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={att.dataUrl} alt={att.name} className="msg-image-preview" />
                <span className="msg-image-overlay">
                  <Eye size={16} />
                  <span>Expand</span>
                </span>
              </button>
              <div className="msg-image-footer">
                <span className="msg-att-name" title={att.name}>
                  {att.name}
                </span>
                <span className="msg-att-size">{formatFileSize(att.size)}</span>
              </div>
            </div>
          );
        }

        if (isPdf) {
          return (
            <div key={att.id} className="msg-pdf-card">
              <div className="msg-pdf-header">
                <div className="msg-pdf-icon-box">
                  <FileText size={20} />
                  <span className="pdf-tag">PDF</span>
                </div>
                <div className="msg-pdf-meta">
                  <span className="msg-pdf-name" title={att.name}>
                    {att.name}
                  </span>
                  <span className="msg-pdf-size">
                    {formatFileSize(att.size)}
                    {att.extractedText
                      ? ` · ~${att.extractedText.length.toLocaleString()} chars`
                      : ""}
                  </span>
                </div>
                <div className="msg-pdf-actions">
                  <a
                    href={att.dataUrl}
                    download={att.name}
                    className="msg-pdf-action-btn"
                    title="Download PDF"
                    aria-label={`Download ${att.name}`}
                  >
                    <Download size={15} />
                  </a>
                  <a
                    href={att.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="msg-pdf-action-btn"
                    title="Open PDF in new tab"
                    aria-label={`Open ${att.name} in new tab`}
                  >
                    <ExternalLink size={15} />
                  </a>
                </div>
              </div>

              {att.extractedText && (
                <div className="msg-pdf-extracted-box">
                  <button
                    type="button"
                    className="msg-pdf-toggle"
                    onClick={() => togglePdf(att.id)}
                  >
                    <span>
                      {isExpanded ? "Hide extracted document text" : "View extracted document text"}
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {isExpanded && (
                    <div className="msg-pdf-text-content">
                      <pre>{att.extractedText}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }

        // Generic file fallback
        return (
          <div key={att.id} className="msg-generic-file-card">
            <FileText size={18} />
            <span className="msg-att-name">{att.name}</span>
            <span className="msg-att-size">{formatFileSize(att.size)}</span>
            <a href={att.dataUrl} download={att.name} className="msg-pdf-action-btn">
              <Download size={14} />
            </a>
          </div>
        );
      })}
    </div>
  );
}
