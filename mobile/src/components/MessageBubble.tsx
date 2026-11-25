import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy } from "lucide-react-native";
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

export function MessageBubble({
  message,
  onOpenImage,
}: {
  message: ChatMessage;
  onOpenImage: (att: Attachment) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard error
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

  return (
    <View style={styles.aiRow}>
      <View style={styles.avatar}>
        <FridayMark size={17} color={colors.accent} />
      </View>
      <View style={styles.aiBody}>
        <View style={styles.aiHeader}>
          <Text style={styles.aiName}>Friday</Text>
          <Text style={styles.aiTime}>{formatTime(message.createdAt)}</Text>
          {message.modelUsed ? (
            <Text style={styles.modelTag} numberOfLines={1}>
              · {message.modelUsed}
            </Text>
          ) : null}
        </View>

        <MarkdownContent content={message.content} />

        <View style={styles.aiTools}>
          <Pressable onPress={handleCopy} style={styles.copyBtn} hitSlop={6}>
            {copied ? (
              <Check size={13} color={colors.sage} />
            ) : (
              <Copy size={13} color={colors.muted} />
            )}
            <Text style={[styles.copyText, copied && { color: colors.sage }]}>
              {copied ? "Copied" : "Copy"}
            </Text>
          </Pressable>
        </View>
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
    marginBottom: 24,
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
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
  },
  aiName: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.text,
  },
  aiTime: {
    fontSize: 10.5,
    color: colors.subtle,
  },
  modelTag: {
    fontSize: 10,
    color: colors.subtle,
    flexShrink: 1,
  },
  aiTools: {
    flexDirection: "row",
    marginTop: 9,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
  },
  copyText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "500",
  },
});
