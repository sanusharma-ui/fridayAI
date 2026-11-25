import React from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { colors } from "../theme/colors";
import type { Attachment } from "../types";

export function ImagePreviewModal({
  attachment,
  onClose,
}: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  if (!attachment) return null;

  return (
    <Modal
      visible={Boolean(attachment)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.topBar}>
          <Text style={styles.title} numberOfLines={1}>
            {attachment.name}
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.imageWrap}>
          <Image
            source={{ uri: attachment.uri || attachment.dataUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 12, 11, 0.96)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  title: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
    marginRight: 12,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrap: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
