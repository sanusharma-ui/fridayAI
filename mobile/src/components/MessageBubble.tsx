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
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  RotateCcw,
  Share2,
  Zap,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import type { Attachment, ChatMessage, PendingDeviceAction } from "../types";
import { ActionConfirmCard } from "./ActionConfirmCard";
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
  onOpenContacts,
  onUpdateAction,
  onRegenerate,
}: {
  message: ChatMessage;
  isLatestAssistant?: boolean;
  onOpenImage: (att: Attachment) => void;
  onOpenContacts?: () => void;
  onUpdateAction?: (
    messageId: string,
    actionId: string,
    patch: Partial<PendingDeviceAction>
  ) => void;
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
    message.isStreaming &&
      !message.content &&
      !message.reasoning &&
      !message.activeToolLabel
  );

  return (
    <View style={styles.aiRow}>
      <View style={styles.avatar}>
        <FridayMark size={16} color={colors.accent} />
      </View>

      <View style={styles.aiBody}>
        <View style={styles.aiHeader}>
          <Text style={styles.aiName}>Friday</Text>
          <Text style={styles.aiTime}>
            {message.isStreaming ? "Writing…" : formatTime(message.createdAt)}
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

        {/* Live Tool Activity Pill */}
        {message.activeToolLabel ? (
          <View style={styles.activeToolPill}>
            <ActivityIndicator size="small" color={colors.sky} />
            <Zap size={12} color={colors.sky} />
            <Text style={styles.activeToolText}>{message.activeToolLabel}</Text>
          </View>
        ) : null}

        {/* Saved Contact / Memory Badges */}
        {message.toolBadges && message.toolBadges.length > 0 ? (
          <View style={styles.badgesWrap}>
            {message.toolBadges.map((b) => (
              <Pressable
                key={b.id}
                onPress={onOpenContacts}
                style={({ pressed }) => [
                  styles.savedBadge,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <CheckCircle2 size={13} color={colors.sage} />
                <Text style={styles.savedBadgeText} numberOfLines={1}>
                  {b.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Notices */}
        {message.notices && message.notices.length > 0 && (
          <View style={styles.noticesWrap}>
            {message.notices.map((notice, idx) => (
              <View key={`nt-${idx}`} style={styles.noticeChip}>
                <Info size={12} color={colors.sky} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Collapsible Reasoning Block */}
        {message.reasoning ? (
          <View style={styles.reasoningCard}>
            <Pressable
              onPress={() => setShowReasoning((v) => !v)}
              style={styles.reasoningHeader}
            >
              <Brain size={13} color={colors.warning} />
              <Text style={styles.reasoningTitle}>
                {isThinkingPhase ? "Thinking…" : "Thought process"}
              </Text>
              {isThinkingPhase ? (
                <ActivityIndicator
                  size="small"
                  color={colors.warning}
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

        {/* Main Content */}
        {isWaitingFirstToken ? (
          <View style={styles.waitingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.waitingText}>Thinking…</Text>
          </View>
        ) : message.content || message.isStreaming ? (
          <MarkdownContent
            content={message.content}
            isStreaming={Boolean(
              message.isStreaming && !message.activeToolLabel
            )}
          />
        ) : null}

        {/* Interactive Call / SMS Confirmation Cards */}
        {message.pendingActions && message.pendingActions.length > 0 ? (
          <View style={styles.actionsList}>
            {message.pendingActions.map((act) => (
              <ActionConfirmCard
                key={act.id}
                action={act}
                onUpdateAction={(actionId, patch) =>
                  onUpdateAction?.(message.id, actionId, patch)
                }
              />
            ))}
          </View>
        ) : null}

        {/* Action Toolbar */}
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
                <Text style={styles.toolText}>Retry</Text>
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
    marginBottom: 20,
  },
  userGroup: {
    maxWidth: "85%",
    alignItems: "flex-end",
    gap: 5,
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    borderWidth: 1,
    borderColor: colors.userBubbleBorder,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 5,
  },
  userText: {
    color: "#F6F8FC",
    fontSize: 15,
    lineHeight: 22,
  },
  userTime: {
    fontSize: 10.5,
    color: colors.subtle,
    paddingRight: 3,
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
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
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
    marginBottom: 7,
  },
  aiName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  aiTime: {
    fontSize: 11,
    color: colors.subtle,
  },
  modelTag: {
    fontSize: 10.5,
    color: colors.subtle,
    maxWidth: 140,
  },
  durationTag: {
    fontSize: 10.5,
    color: colors.sage,
    fontWeight: "600",
  },
  stoppedTag: {
    fontSize: 10.5,
    color: colors.warning,
  },
  activeToolPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.skySoft,
    borderWidth: 1,
    borderColor: colors.skyBorder,
    marginBottom: 9,
  },
  activeToolText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.sky,
  },
  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 9,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: colors.sageSoft,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    maxWidth: "100%",
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.sage,
    flexShrink: 1,
  },
  actionsList: {
    gap: 8,
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
    borderRadius: 9,
    backgroundColor: colors.skySoft,
    borderWidth: 1,
    borderColor: colors.skyBorder,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  reasoningCard: {
    borderRadius: 11,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reasoningTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.warning,
  },
  reasoningBody: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.muted,
    paddingHorizontal: 12,
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
    fontSize: 13,
    color: colors.muted,
  },
  aiTools: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 11,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  toolText: {
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: "500",
  },
});
