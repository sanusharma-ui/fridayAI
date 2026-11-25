import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  KeyRound,
  Menu,
  Settings,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import type { ConnectionState } from "../types";

interface TopBarProps {
  title: string;
  connectionState: ConnectionState;
  hasApiKey: boolean;
  contactsCount: number;
  onOpenDrawer: () => void;
  onOpenContacts: () => void;
  onOpenSettings: () => void;
}

export function TopBar({
  title,
  connectionState,
  hasApiKey,
  contactsCount,
  onOpenDrawer,
  onOpenContacts,
  onOpenSettings,
}: TopBarProps) {
  const statusInfo = (() => {
    if (!hasApiKey || connectionState === "missing_key") {
      return {
        label: "Key",
        dotColor: colors.warning,
        bgColor: colors.warningBg,
        icon: "key" as const,
      };
    }
    if (connectionState === "ready") {
      return {
        label: "Groq",
        dotColor: colors.sage,
        bgColor: colors.sageSoft,
        icon: "online" as const,
      };
    }
    if (connectionState === "checking") {
      return {
        label: "…",
        dotColor: colors.muted,
        bgColor: colors.surface,
        icon: "none" as const,
      };
    }
    return {
      label: "Offline",
      dotColor: colors.danger,
      bgColor: colors.dangerBg,
      icon: "offline" as const,
    };
  })();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Pressable
          onPress={onOpenDrawer}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          accessibilityLabel="Open conversations menu"
        >
          <Menu size={21} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>FRIDAY</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <Pressable
          onPress={onOpenSettings}
          style={({ pressed }) => [
            styles.statusPill,
            { backgroundColor: statusInfo.bgColor },
            pressed && styles.pressedOpacity,
          ]}
          accessibilityLabel="Connection and API key status"
        >
          <View style={[styles.dot, { backgroundColor: statusInfo.dotColor }]} />
          <Text style={styles.statusText}>{statusInfo.label}</Text>
          {statusInfo.icon === "key" && <KeyRound size={11} color={colors.warning} />}
          {statusInfo.icon === "online" && <Wifi size={11} color={colors.sage} />}
          {statusInfo.icon === "offline" && <WifiOff size={11} color={colors.danger} />}
        </Pressable>

        <Pressable
          onPress={onOpenContacts}
          style={({ pressed }) => [
            styles.contactsBtn,
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityLabel="Open Contacts and Memories"
        >
          <Users size={18} color={colors.accent} />
          {contactsCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {contactsCount > 99 ? "99+" : contactsCount}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={onOpenSettings}
          style={({ pressed }) => [
            styles.settingsBtn,
            !hasApiKey && styles.settingsBtnHighlight,
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityLabel="Open settings"
        >
          <Settings size={18} color={!hasApiKey ? colors.accent : colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSubtle,
    backgroundColor: colors.bg,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    gap: 8,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnPressed: {
    backgroundColor: colors.surfaceHover,
  },
  pressedOpacity: {
    opacity: 0.8,
  },
  titleWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.subtle,
    fontWeight: "600",
  },
  title: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
    marginTop: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  contactsBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  countBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.sage,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.ctaText,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  settingsBtnHighlight: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
});
