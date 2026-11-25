import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  RotateCcw,
  Share2,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import type { Attachment, ChatMessage } from "../types";
import { MessageAttachmentsList } from "./AttachmentChips";
import { FridayMark } from "./FridayMark";
import { MarkdownContent } from "./MarkdownContent";

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function shortModelName(modelId?: string): string {
  if (!modelId) return "";
  const parts = modelId.split("/");
  return parts[parts.length - 1];
}

export function MessageBubble({
  message,
  isLatestAssistant,
  onOpenImage,
  onRegenerate,
}: {
  message: ChatMessage;
  isLatestAssistant?: boolean;
  onOpenImage: (att: Attachment) => void;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard error
    }
  }

  async function handleShare() {
    try {
      await Share.share({
        message: message.content,
      });
    } catch {
      // Ignore dismissed share sheet
    }
  }

  if (message.role === "user") {
    return (
      <View style={styles.userRow}>
        <View style={styles.userGroup}>
          {message.attachments && message.attachments.length > 0 && (
            <MessageAttachmentsList
              attachments={message.attachments}
              onOpenImage={onOpenImage}
            />
          )}
          {message.content ? (
            <View style={styles.userBubble}>
              <Text selectable style={styles.userText}>
                {message.content}
              </Text>
            </View>
          ) : null}
          <Text style={styles.userTime}>{formatTime(message.createdAt)}</Text>
        </View>
      </View>
    );
  }

  const isThinkingPhase = Boolean(
    message.isStreaming && !message.content && message.reasoning
  );
  const isWaitingFirstToken = Boolean(
    message.isStreaming && !message.content && !message.reasoning
  );

  return (
    <View style={styles.aiRow}>
      <View style={styles.avatar}>
        <FridayMark size={17} color={colors.accent} />
      </View>

      <View style={styles.aiBody}>
        {/* Header */}
        <View style={styles.aiHeader}>
          <Text style={styles.aiName}>Friday</Text>
          <Text style={styles.aiTime}>
            {message.isStreaming ? "Streaming…" : formatTime(message.createdAt)}
          </Text>
          {message.modelUsed ? (
            <Text style={styles.modelTag} numberOfLines={1}>
              · {shortModelName(message.modelUsed)}
            </Text>
          ) : null}
          {!message.isStreaming && message.durationMs ? (
            <Text style={styles.durationTag}>
              · {(message.durationMs / 1000).toFixed(1)}s
            </Text>
          ) : null}
          {message.stopped ? (
            <Text style={styles.stoppedTag}>· Stopped</Text>
          ) : null}
        </View>

        {/* Notices (PDF excerpts, vision model auto-switch, etc.) */}
        {message.notices && message.notices.length > 0 && (
          <View style={styles.noticesWrap}>
            {message.notices.map((notice, idx) => (
              <View key={`nt-${idx}`} style={styles.noticeChip}>
                <Info size={12} color={colors.accent} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Collapsible Reasoning / Thought Process Block */}
        {message.reasoning ? (
          <View style={styles.reasoningCard}>
            <Pressable
              onPress={() => setShowReasoning((v) => !v)}
              style={styles.reasoningHeader}
            >
              <Brain size={13} color={colors.sage} />
              <Text style={styles.reasoningTitle}>
                {isThinkingPhase ? "Reasoning…" : "Thought process"}
              </Text>
              {isThinkingPhase ? (
                <ActivityIndicator
                  size="small"
                  color={colors.sage}
                  style={{ marginLeft: 4 }}
                />
              ) : null}
              <View style={{ marginLeft: "auto" }}>
                {showReasoning ? (
                  <ChevronDown size={14} color={colors.muted} />
                ) : (
                  <ChevronRight size={14} color={colors.muted} />
                )}
              </View>
            </Pressable>

            {(showReasoning || isThinkingPhase) && (
              <Text selectable style={styles.reasoningBody}>
                {message.reasoning.trim()}
              </Text>
            )}
          </View>
        ) : null}

        {/* Waiting for very first token */}
        {isWaitingFirstToken ? (
          <View style={styles.waitingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.waitingText}>Connecting to Groq…</Text>
          </View>
        ) : (
          <MarkdownContent
            content={message.content}
            isStreaming={message.isStreaming}
          />
        )}

        {/* Action Toolbar (shown once message has content & finished streaming) */}
        {!message.isStreaming && message.content.length > 0 && (
          <View style={styles.aiTools}>
            <Pressable onPress={handleCopy} style={styles.toolBtn} hitSlop={6}>
              {copied ? (
                <Check size={13} color={colors.sage} />
              ) : (
                <Copy size={13} color={colors.muted} />
              )}
              <Text style={[styles.toolText, copied && { color: colors.sage }]}>
                {copied ? "Copied" : "Copy"}
              </Text>
            </Pressable>

            <Pressable onPress={handleShare} style={styles.toolBtn} hitSlop={6}>
              <Share2 size={13} color={colors.muted} />
              <Text style={styles.toolText}>Share</Text>
            </Pressable>

            {isLatestAssistant && onRegenerate && (
              <Pressable
                onPress={onRegenerate}
                style={styles.toolBtn}
                hitSlop={6}
              >
                <RotateCcw size={13} color={colors.muted} />
                <Text style={styles.toolText}>Regenerate</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 22,
  },
  userGroup: {
    maxWidth: "84%",
    alignItems: "flex-end",
    gap: 6,
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
  },
  userText: {
    color: colors.text,
    fontSize: 14.5,
    lineHeight: 22,
  },
  userTime: {
    fontSize: 10,
    color: colors.subtle,
    paddingRight: 2,
  },
  aiRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 26,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  aiBody: {
    flex: 1,
    minWidth: 0,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 8,
  },
  aiName: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.text,
  },
  aiTime: {
    fontSize: 10.5,
    color: colors.subtle,
  },
  modelTag: {
    fontSize: 10,
    color: colors.subtle,
    maxWidth: 140,
  },
  durationTag: {
    fontSize: 10,
    color: colors.sage,
  },
  stoppedTag: {
    fontSize: 10,
    color: colors.warning,
  },
  noticesWrap: {
    gap: 6,
    marginBottom: 10,
  },
  noticeChip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  noticeText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  reasoningCard: {
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
    overflow: "hidden",
  },
  reasoningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  reasoningTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.sage,
  },
  reasoningBody: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.muted,
    paddingHorizontal: 11,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lineSubtle,
    paddingTop: 8,
  },
  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  waitingText: {
    fontSize: 12.5,
    color: colors.muted,
  },
  aiTools: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: 11,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
  },
  toolText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "500",
  },
});
