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
import { useResponsive } from "../theme/responsive";
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
  const { drawerWidth } = useResponsive();
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
        <View style={[styles.drawer, { width: drawerWidth }]}>
          <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <View style={styles.brandHead}>
              <View style={styles.brandRow}>
                <View style={styles.logoBox}>
                  <FridayMark size={19} color={colors.accent} />
                </View>
                <Text style={styles.brandName}>Friday</Text>
                <Pressable
                  onPress={onClose}
                  style={styles.closeBtn}
                  accessibilityLabel="Close drawer"
                >
                  <ChevronLeft size={20} color={colors.muted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.actionsWrap}>
              <Pressable
                onPress={() => {
                  onNewChat();
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.newChatBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Plus size={17} color={colors.ctaText} strokeWidth={2.5} />
                <Text style={styles.newChatText}>New chat</Text>
              </Pressable>

              <View style={styles.searchBox}>
                <Search size={15} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search chats…"
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

            <View style={styles.historyHeader}>
              <Text style={styles.historyLabel}>Recent chats</Text>
              <Text style={styles.historyCount}>{conversations.length}</Text>
            </View>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
            >
              {filtered.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    {query ? "No matching chats" : "No chats yet"}
                  </Text>
                </View>
              ) : (
                filtered.map((chat) => {
                  const isActive = chat.id === activeId;
                  const isEditing = editingId === chat.id;

                  return (
                    <View
                      key={chat.id}
                      style={[
                        styles.chatRow,
                        isActive && styles.chatRowActive,
                      ]}
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
                              color={isActive ? colors.accent : colors.muted}
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
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenContacts();
                }}
                style={({ pressed }) => [
                  styles.navCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.contactsIconBox}>
                  <Users size={16} color={colors.sky} />
                </View>
                <View style={styles.navCardCopy}>
                  <Text style={styles.navCardTitle}>Contacts & Hisaab</Text>
                  <Text style={styles.navCardSub} numberOfLines={1}>
                    {contactsCount} {contactsCount === 1 ? "person" : "people"} saved
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  onClose();
                  onOpenSettings();
                }}
                style={({ pressed }) => [
                  styles.navCard,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.settingsIconBox,
                    !groqApiKey && { backgroundColor: colors.warningBg },
                  ]}
                >
                  {groqApiKey ? (
                    <Settings size={16} color={colors.sage} />
                  ) : (
                    <KeyRound size={16} color={colors.warning} />
                  )}
                </View>
                <View style={styles.navCardCopy}>
                  <Text style={styles.navCardTitle}>
                    {groqApiKey ? "Settings" : "Connect Groq Key"}
                  </Text>
                  <Text style={styles.navCardSub} numberOfLines={1}>
                    {groqApiKey
                      ? `${maskApiKey(groqApiKey)} · ${selectedModel}`
                      : "Set up your API key"}
                  </Text>
                </View>
              </Pressable>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
  },
  closeBtn: {
    marginLeft: "auto",
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsWrap: {
    paddingHorizontal: 14,
    gap: 9,
  },
  newChatBtn: {
    height: 43,
    borderRadius: 12,
    backgroundColor: colors.ctaBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newChatText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.ctaText,
  },
  searchBox: {
    height: 40,
    borderRadius: 11,
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
    fontSize: 13,
    paddingVertical: 0,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
  },
  historyLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
  },
  historyCount: {
    fontSize: 11.5,
    color: colors.subtle,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 3,
  },
  emptyBox: {
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 12.5,
    color: colors.subtle,
  },
  chatRow: {
    minHeight: 44,
    borderRadius: 11,
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
    fontSize: 13.5,
    color: colors.muted,
  },
  chatTitleActive: {
    color: colors.text,
    fontWeight: "600",
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
    borderRadius: 7,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    paddingHorizontal: 9,
    color: colors.text,
    fontSize: 12.5,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.lineSubtle,
    gap: 8,
  },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  contactsIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.skySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.sageSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  navCardCopy: {
    flex: 1,
  },
  navCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  navCardSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.82,
  },
});
