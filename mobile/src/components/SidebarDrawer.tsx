import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  ChevronLeft,
  KeyRound,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import { maskApiKey } from "../services/settingsStorage";
import { colors } from "../theme/colors";
import type { Conversation } from "../types";
import { FridayMark } from "./FridayMark";

interface SidebarDrawerProps {
  visible: boolean;
  conversations: Conversation[];
  activeId: string | null;
  groqApiKey: string;
  selectedModel: string;
  contactsCount: number;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onOpenContacts: () => void;
  onOpenSettings: () => void;
}

export function SidebarDrawer({
  visible,
  conversations,
  activeId,
  groqApiKey,
  selectedModel,
  contactsCount,
  onClose,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onOpenContacts,
  onOpenSettings,
}: SidebarDrawerProps) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const filtered = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));

  function startRename(chat: Conversation) {
    setEditingId(chat.id);
    setEditValue(chat.title);
  }

  function submitRename(id: string) {
    const trimmed = editValue.trim();
    if (trimmed) {
      onRenameChat(id, trimmed.slice(0, 80));
    }
    setEditingId(null);
  }

  function confirmDelete(chat: Conversation) {
    if (Platform.OS === "web") {
      onDeleteChat(chat.id);
      return;
    }
    Alert.alert(
      "Delete Conversation",
      `Delete "${chat.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDeleteChat(chat.id) },
      ]
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdropWrap}>
        <View style={styles.drawer}>
          <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <View style={styles.brandHead}>
              <View style={styles.brandRow}>
                <FridayMark size={25} color={colors.accent} />
                <Text style={styles.brandName}>
                  friday<Text style={styles.brandDot}>.</Text>
                </Text>
                <Pressable
                  onPress={onClose}
                  style={styles.closeBtn}
                  accessibilityLabel="Close drawer"
                >
                  <ChevronLeft size={20} color={colors.muted} />
                </Pressable>
              </View>
              <Text style={styles.brandCaption}>
                Personal AI, Contacts & Memory Vault.
              </Text>
            </View>

            <View style={styles.actionsWrap}>
              <Pressable
                onPress={() => {
                  onNewChat();
                  onClose();
                }}
                style={({ pressed }) => [styles.newChatBtn, pressed && styles.pressed]}
              >
                <Plus size={17} color={colors.ctaText} strokeWidth={2.4} />
                <Text style={styles.newChatText}>New conversation</Text>
              </Pressable>

              <View style={styles.searchBox}>
                <Search size={15} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search conversations"
                  placeholderTextColor={colors.subtle}
                  style={styles.searchInput}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery("")} hitSlop={8}>
                    <X size={14} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.historyHeader}>
              <Text style={styles.historyLabel}>CONVERSATIONS</Text>
              <Text style={styles.historyCount}>{conversations.length}</Text>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {filtered.length === 0 ? (
                <View style={styles.emptyBox}>
                  <MessageSquare size={18} color={colors.subtle} />
                  <Text style={styles.emptyText}>
                    {query ? "No matching conversations" : "Your conversations will appear here"}
                  </Text>
                </View>
              ) : (
                filtered.map((chat) => {
                  const isActive = chat.id === activeId;
                  const isEditing = editingId === chat.id;

                  return (
                    <View
                      key={chat.id}
                      style={[styles.chatRow, isActive && styles.chatRowActive]}
                    >
                      {isEditing ? (
                        <View style={styles.editWrap}>
                          <TextInput
                            autoFocus
                            value={editValue}
                            onChangeText={setEditValue}
                            onSubmitEditing={() => submitRename(chat.id)}
                            style={styles.editInput}
                            maxLength={80}
                          />
                          <Pressable
                            onPress={() => submitRename(chat.id)}
                            style={styles.rowIconBtn}
                          >
                            <Check size={15} color={colors.sage} />
                          </Pressable>
                          <Pressable
                            onPress={() => setEditingId(null)}
                            style={styles.rowIconBtn}
                          >
                            <X size={15} color={colors.muted} />
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <Pressable
                            onPress={() => {
                              onSelectChat(chat.id);
                              onClose();
                            }}
                            style={styles.chatSelect}
                          >
                            <MessageSquare
                              size={15}
                              color={isActive ? colors.sage : colors.muted}
                            />
                            <Text
                              style={[
                                styles.chatTitle,
                                isActive && styles.chatTitleActive,
                              ]}
                              numberOfLines={1}
                            >
                              {chat.title}
                            </Text>
                          </Pressable>

                          <View style={styles.rowActions}>
                            <Pressable
                              onPress={() => startRename(chat)}
                              style={styles.rowIconBtn}
                              hitSlop={6}
                            >
                              <Pencil size={13} color={colors.subtle} />
                            </Pressable>
                            <Pressable
                              onPress={() => confirmDelete(chat)}
                              style={styles.rowIconBtn}
                              hitSlop={6}
                            >
                              <Trash2 size={13} color={colors.danger} />
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.footerRule} />

              <Pressable
                onPress={() => {
                  onClose();
                  onOpenContacts();
                }}
                style={({ pressed }) => [
                  styles.settingsCard,
                  { marginBottom: 8 },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.contactsCardIcon}>
                  <Users size={16} color={colors.accent} />
                </View>
                <View style={styles.settingsCardCopy}>
                  <Text style={styles.settingsCardTitle}>
                    Contacts & Memories
                  </Text>
                  <Text style={styles.settingsCardSub} numberOfLines={1}>
                    {contactsCount} saved locally in SQLite
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  onClose();
                  onOpenSettings();
                }}
                style={({ pressed }) => [styles.settingsCard, pressed && styles.pressed]}
              >
                <View style={styles.settingsCardIcon}>
                  {groqApiKey ? (
                    <Settings size={16} color={colors.sage} />
                  ) : (
                    <KeyRound size={16} color={colors.warning} />
                  )}
                </View>
                <View style={styles.settingsCardCopy}>
                  <Text style={styles.settingsCardTitle}>
                    {groqApiKey ? "Settings & API Keys" : "Setup Groq API Key"}
                  </Text>
                  <Text style={styles.settingsCardSub} numberOfLines={1}>
                    {groqApiKey
                      ? `${maskApiKey(groqApiKey)} · ${selectedModel}`
                      : "Tap here to configure your Groq key"}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.bottomMeta}>
                <Text style={styles.bottomMetaText}>FRIDAY MOBILE · GROQ</Text>
                <Text style={styles.bottomMetaSparkle}>✦</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <Pressable style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.overlay,
  },
  drawer: {
    width: "82%",
    maxWidth: 310,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  backdrop: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  brandHead: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  brandName: {
    fontSize: 25,
    fontWeight: "600",
    color: colors.text,
    letterSpacing: -1,
  },
  brandDot: {
    color: colors.accent,
  },
  closeBtn: {
    marginLeft: "auto",
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  brandCaption: {
    fontSize: 11,
    color: colors.subtle,
    marginTop: 6,
  },
  actionsWrap: {
    paddingHorizontal: 16,
    gap: 10,
  },
  newChatBtn: {
    height: 42,
    borderRadius: 9,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    gap: 9,
  },
  newChatText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ctaText,
  },
  searchBox: {
    height: 39,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    paddingVertical: 0,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  historyLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.subtle,
    fontWeight: "600",
  },
  historyCount: {
    fontSize: 11,
    color: colors.subtle,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  emptyBox: {
    padding: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: colors.subtle,
    lineHeight: 18,
  },
  chatRow: {
    minHeight: 44,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chatRowActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.lineStrong,
  },
  chatSelect: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  chatTitle: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
  },
  chatTitleActive: {
    color: colors.text,
    fontWeight: "500",
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  rowIconBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  editWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  editInput: {
    flex: 1,
    height: 34,
    backgroundColor: colors.bg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.sageBorder,
    paddingHorizontal: 8,
    color: colors.text,
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  footerRule: {
    height: 1,
    backgroundColor: colors.line,
    marginBottom: 10,
  },
  settingsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 10,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  contactsCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsCardCopy: {
    flex: 1,
  },
  settingsCardTitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.text,
  },
  settingsCardSub: {
    fontSize: 10.5,
    color: colors.muted,
    marginTop: 1,
  },
  bottomMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 11,
    paddingHorizontal: 4,
  },
  bottomMetaText: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.subtle,
  },
  bottomMetaSparkle: {
    fontSize: 11,
    color: colors.accent,
  },
  pressed: {
    opacity: 0.82,
  },
});
