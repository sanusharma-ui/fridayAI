import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Menu, Plus, Settings, Users } from "lucide-react-native";
import { colors } from "../theme/colors";
import { useResponsive } from "../theme/responsive";
import type { ConnectionState } from "../types";
import { FridayMark } from "./FridayMark";

interface TopBarProps {
  title: string;
  isHome: boolean;
  connectionState: ConnectionState;
  hasApiKey: boolean;
  contactsCount: number;
  onOpenDrawer: () => void;
  onNewChat: () => void;
  onOpenContacts: () => void;
  onOpenSettings: () => void;
}

export function TopBar({
  title,
  isHome,
  connectionState,
  hasApiKey,
  contactsCount,
  onOpenDrawer,
  onNewChat,
  onOpenContacts,
  onOpenSettings,
}: TopBarProps) {
  const { isCompact, horizontalPad } = useResponsive();

  const statusDotColor = (() => {
    if (!hasApiKey || connectionState === "missing_key") return colors.warning;
    if (connectionState === "ready") return colors.sage;
    if (connectionState === "checking") return colors.muted;
    return colors.danger;
  })();

  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPad - 2 }]}>
      <View style={styles.left}>
        <Pressable
          onPress={onOpenDrawer}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityLabel="Open menu"
        >
          <Menu size={21} color={colors.text} />
        </Pressable>

        <View style={styles.brandTitleWrap}>
          {isHome ? (
            <View style={styles.brandInline}>
              <FridayMark size={18} color={colors.accent} />
              <Text style={styles.brandTitle}>Friday</Text>
            </View>
          ) : (
            <Text style={styles.chatTitle} numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.right}>
        {!isHome && (
          <Pressable
            onPress={onNewChat}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityLabel="Start new chat"
          >
            <Plus size={20} color={colors.textSecondary} />
          </Pressable>
        )}

        <Pressable
          onPress={onOpenContacts}
          style={({ pressed }) => [
            styles.contactsPill,
            isCompact && styles.contactsPillCompact,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Open Contacts and Hisaab"
        >
          <Users size={15} color={colors.sky} />
          {!isCompact && <Text style={styles.contactsPillLabel}>Vault</Text>}
          {contactsCount > 0 && (
            <View style={styles.countChip}>
              <Text style={styles.countChipText}>
                {contactsCount > 99 ? "99+" : contactsCount}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={onOpenSettings}
          style={({ pressed }) => [
            styles.settingsBtn,
            !hasApiKey && styles.settingsBtnWarn,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Open settings"
        >
          <Settings
            size={18}
            color={!hasApiKey ? colors.warning : colors.textSecondary}
          />
          <View
            style={[styles.statusBadgeDot, { backgroundColor: statusDotColor }]}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSubtle,
    backgroundColor: colors.bg,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitleWrap: {
    flex: 1,
  },
  brandInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.4,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  contactsPill: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 11,
    backgroundColor: colors.skySoft,
    borderWidth: 1,
    borderColor: colors.skyBorder,
  },
  contactsPillCompact: {
    paddingHorizontal: 9,
  },
  contactsPillLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.sky,
  },
  countChip: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.sky,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  countChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#09111E",
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  settingsBtnWarn: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  statusBadgeDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.2,
    borderColor: colors.surface,
  },
  pressed: {
    opacity: 0.76,
  },
});
