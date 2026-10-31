"use client";

import { useEffect } from "react";
import { Download, X } from "lucide-react";
import { formatFileSize } from "@/lib/pdf";
import type { Attachment } from "@/lib/types";

interface ImageLightboxProps {
  attachment: Attachment | null;
  onClose: () => void;
}

export function ImageLightbox({ attachment, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!attachment) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [attachment, onClose]);

  if (!attachment) return null;

  return (
    <div
      className="lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lightbox-content">
        <header className="lightbox-header">
          <div className="lightbox-meta">
            <span className="lightbox-filename" title={attachment.name}>
              {attachment.name}
            </span>
            <span className="lightbox-filesize">{formatFileSize(attachment.size)}</span>
          </div>
          <div className="lightbox-actions">
            <a
              href={attachment.dataUrl}
              download={attachment.name}
              className="lightbox-btn"
              title="Download image"
              aria-label="Download image"
            >
              <Download size={18} />
            </a>
            <button
              type="button"
              className="lightbox-btn"
              onClick={onClose}
              title="Close preview"
              aria-label="Close image preview"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="lightbox-media-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.dataUrl}
            alt={attachment.name}
            className="lightbox-img"
          />
        </div>
      </div>
    </div>
  );
}
