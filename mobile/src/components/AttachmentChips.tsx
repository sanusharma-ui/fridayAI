import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Eye, FileText, X } from "lucide-react-native";
import { formatFileSize } from "../services/attachments";
import { colors } from "../theme/colors";
import type { Attachment } from "../types";

export function ComposerAttachmentChip({
  attachment,
  onRemove,
  disabled,
}: {
  attachment: Attachment;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const isImage = attachment.type.startsWith("image/");

  return (
    <View style={styles.chip}>
      {isImage ? (
        <Image
          source={{ uri: attachment.uri || attachment.dataUrl }}
          style={styles.chipThumb}
        />
      ) : (
        <View style={styles.chipPdfIcon}>
          <FileText size={15} color={colors.accent} />
        </View>
      )}

      <View style={styles.chipMeta}>
        <Text style={styles.chipName} numberOfLines={1}>
          {attachment.name}
        </Text>
        <Text style={styles.chipSize}>{formatFileSize(attachment.size)}</Text>
      </View>

      <Pressable
        onPress={() => onRemove(attachment.id)}
        disabled={disabled}
        style={styles.chipRemove}
        hitSlop={8}
      >
        <X size={13} color={colors.muted} />
      </Pressable>
    </View>
  );
}

export function MessageAttachmentsList({
  attachments,
  onOpenImage,
}: {
  attachments: Attachment[];
  onOpenImage: (att: Attachment) => void;
}) {
  if (!attachments.length) return null;

  return (
    <View style={styles.msgAttWrap}>
      {attachments.map((att) => {
        const isImage = att.type.startsWith("image/");
        if (isImage) {
          return (
            <Pressable
              key={att.id}
              onPress={() => onOpenImage(att)}
              style={styles.imageCard}
            >
              <Image
                source={{ uri: att.uri || att.dataUrl }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <View style={styles.imageFooter}>
                <Text style={styles.attName} numberOfLines={1}>
                  {att.name}
                </Text>
                <Eye size={13} color={colors.muted} />
              </View>
            </Pressable>
          );
        }

        return (
          <View key={att.id} style={styles.pdfCard}>
            <View style={styles.pdfBadge}>
              <FileText size={17} color={colors.accent} />
            </View>
            <View style={styles.pdfInfo}>
              <Text style={styles.attName} numberOfLines={1}>
                {att.name}
              </Text>
              <Text style={styles.attSub}>
                PDF · {formatFileSize(att.size)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.sidebar,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: 6,
    maxWidth: 210,
  },
  chipThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  chipPdfIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  chipMeta: {
    flexShrink: 1,
  },
  chipName: {
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.text,
  },
  chipSize: {
    fontSize: 10,
    color: colors.muted,
  },
  chipRemove: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  msgAttWrap: {
    gap: 8,
    alignItems: "flex-end",
  },
  imageCard: {
    width: 210,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  imagePreview: {
    width: "100%",
    height: 145,
    backgroundColor: colors.sidebar,
  },
  imageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  pdfCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    maxWidth: 240,
  },
  pdfBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfInfo: {
    flexShrink: 1,
  },
  attName: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.text,
    flexShrink: 1,
  },
  attSub: {
    fontSize: 10.5,
    color: colors.muted,
    marginTop: 2,
  },
});
