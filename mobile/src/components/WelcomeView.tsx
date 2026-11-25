import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ArrowRight,
  BrainCircuit,
  Code2,
  FileText,
  KeyRound,
  ShieldCheck,
  Terminal,
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
    icon: Code2,
    iconColor: colors.sage,
    title: "Code + Architecture Table",
    subtitle: "Compare REST vs GraphQL + code",
    prompt: "Compare REST vs GraphQL vs tRPC in a clean Markdown table, then show a TypeScript Express route example with a tip callout.",
  },
  {
    icon: FileText,
    iconColor: colors.accent,
    title: "Analyze PDFs & images",
    subtitle: "Attach docs or photos below",
    prompt: "Summarize the key points I should look for when reviewing a technical contract PDF.",
  },
  {
    icon: BrainCircuit,
    iconColor: "#c89b84",
    title: "Learn something new",
    subtitle: "Hinglish, Hindi or English",
    prompt: "React Native me state management aur hooks kaise kaam karte hain? Simple example ke saath samjhao.",
  },
  {
    icon: Terminal,
    iconColor: "#9fb7b5",
    title: "Solve a bug",
    subtitle: "Debug step by step",
    prompt: "Give me a step-by-step checklist for debugging a failing mobile API request.",
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
        <Text style={styles.eyebrowText}>A LITTLE SPACE TO THINK</Text>
      </View>

      <Text style={styles.title}>What&apos;s on your mind?</Text>
      <Text style={styles.description}>
        Start with a thought, or attach a PDF or photo. Powered by ultra-fast Groq inference using your own API key.
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
        <Text style={styles.sectionLabel}>A FEW PLACES TO START</Text>
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
          Chats & API keys stay securely on your device
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 26,
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
    marginBottom: 16,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  eyebrowLine: {
    width: 16,
    height: 1,
    backgroundColor: colors.accent,
  },
  eyebrowText: {
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.accent,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: colors.text,
    letterSpacing: -0.8,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 22,
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
    marginBottom: 24,
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
    gap: 9,
  },
  starterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
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
    marginTop: 20,
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
