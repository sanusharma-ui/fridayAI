import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ArrowRight,
  Code2,
  KeyRound,
  PhoneCall,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import { FridayMark } from "./FridayMark";

interface WelcomeViewProps {
  hasApiKey: boolean;
  disabled: boolean;
  onSelectPrompt: (prompt: string) => void;
  onOpenSettings: () => void;
}

const STARTERS = [
  {
    icon: UserPlus,
    iconColor: colors.accent,
    title: "Save Contact & Hisaab",
    subtitle: "Natural Hinglish / Hindi / English",
    prompt:
      "Sharma ji ka number 9876543210 save kar lo, aur yaad rakhna unko 500 rupaye electricity bill ke dene hain.",
  },
  {
    icon: Wallet,
    iconColor: colors.sage,
    title: "Check Birthdays & Pending Dues",
    subtitle: "Query your local SQLite vault",
    prompt:
      "Mere saved contacts, birthdays, aur kis-kis ke paise lene ya dene baki hain iska summary batao.",
  },
  {
    icon: PhoneCall,
    iconColor: "#c89b84",
    title: "Smart Call & SMS Draft",
    subtitle: "Always asks confirmation first",
    prompt:
      "Sharma ji ko SMS draft bana do ki kal shaam tak ₹500 bhej dunga.",
  },
  {
    icon: Code2,
    iconColor: "#9fb7b5",
    title: "Normal AI Chat, Code & Tables",
    subtitle: "Same input box for everything",
    prompt:
      "Compare REST vs GraphQL vs tRPC in a clean Markdown table, then show a TypeScript Express route example.",
  },
];

export function WelcomeView({
  hasApiKey,
  disabled,
  onSelectPrompt,
  onOpenSettings,
}: WelcomeViewProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.brandBadge}>
        <FridayMark size={22} color={colors.accent} />
      </View>

      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowLine} />
        <Text style={styles.eyebrowText}>PERSONAL AI · CONTACTS & MEMORY</Text>
      </View>

      <Text style={styles.title}>What&apos;s on your mind?</Text>
      <Text style={styles.description}>
        One smart chat box for everything — save contacts, track paise ka hisaab & birthdays, place calls/SMS with confirmation, or ask any coding & document question.
      </Text>

      {!hasApiKey && (
        <Pressable
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.setupKeyBanner, pressed && styles.pressed]}
        >
          <View style={styles.setupKeyIcon}>
            <KeyRound size={18} color={colors.accent} />
          </View>
          <View style={styles.setupKeyCopy}>
            <Text style={styles.setupKeyTitle}>Setup your Groq API Key</Text>
            <Text style={styles.setupKeySubtitle}>
              Tap to open Settings and connect your personal Groq API key to start chatting.
            </Text>
          </View>
          <ArrowRight size={16} color={colors.accent} />
        </Pressable>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>TRY SAYING ANYTHING NATURALLY</Text>
        <Text style={styles.sectionCounter}>01 — 04</Text>
      </View>

      <View style={styles.grid}>
        {STARTERS.map((item) => {
          const IconComponent = item.icon;
          return (
            <Pressable
              key={item.title}
              disabled={disabled}
              onPress={() => onSelectPrompt(item.prompt)}
              style={({ pressed }) => [
                styles.starterCard,
                disabled && styles.disabled,
                pressed && styles.starterCardPressed,
              ]}
            >
              <View style={styles.starterIconWrap}>
                <IconComponent size={18} color={item.iconColor} />
              </View>
              <View style={styles.starterCopy}>
                <Text style={styles.starterTitle}>{item.title}</Text>
                <Text style={styles.starterSub}>{item.subtitle}</Text>
              </View>
              <ArrowRight size={14} color={colors.subtle} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footerNote}>
        <ShieldCheck size={13} color={colors.sage} />
        <Text style={styles.footerNoteText}>
          100% private — contacts & memories stored locally in SQLite
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  eyebrowLine: {
    width: 16,
    height: 1,
    backgroundColor: colors.accent,
  },
  eyebrowText: {
    fontSize: 9,
    letterSpacing: 1.7,
    color: colors.accent,
    fontWeight: "600",
  },
  title: {
    fontSize: 27,
    fontWeight: "600",
    color: colors.text,
    letterSpacing: -0.8,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 7,
    marginBottom: 20,
  },
  setupKeyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    marginBottom: 22,
  },
  setupKeyIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  setupKeyCopy: {
    flex: 1,
  },
  setupKeyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  },
  setupKeySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: colors.subtle,
    fontWeight: "600",
  },
  sectionCounter: {
    fontSize: 10,
    color: colors.accent,
  },
  grid: {
    gap: 8,
  },
  starterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  starterCardPressed: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.lineStrong,
  },
  starterIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.sidebar,
    alignItems: "center",
    justifyContent: "center",
  },
  starterCopy: {
    flex: 1,
  },
  starterTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  starterSub: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 18,
  },
  footerNoteText: {
    fontSize: 11,
    color: colors.subtle,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
