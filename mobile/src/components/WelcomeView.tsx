import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Code2,
  KeyRound,
  PhoneCall,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import { useResponsive } from "../theme/responsive";

interface WelcomeViewProps {
  hasApiKey: boolean;
  disabled: boolean;
  contactsCount: number;
  totalPayable: number;
  totalReceivable: number;
  onSelectPrompt: (prompt: string) => void;
  onOpenContacts: () => void;
  onOpenSettings: () => void;
}

const BENTO_CARDS = [
  {
    icon: UserPlus,
    tint: colors.accent,
    tintBg: colors.accentSoft,
    tintBorder: colors.accentBorder,
    title: "Save Contact & Info",
    subtitle: "Phone, birthday, notes",
    prompt:
      "Rahul ka number 9876543210 save kar lo, birthday 18 August hai.",
  },
  {
    icon: Wallet,
    tint: colors.sage,
    tintBg: colors.sageSoft,
    tintBorder: colors.sageBorder,
    title: "Track Hisaab & Bills",
    subtitle: "Lena-dena & reminders",
    prompt:
      "Sharma ji ko 500 rupaye electricity bill ke dene hain, yaad rakhna.",
  },
  {
    icon: PhoneCall,
    tint: colors.sky,
    tintBg: colors.skySoft,
    tintBorder: colors.skyBorder,
    title: "Call or Draft SMS",
    subtitle: "Confirms before sending",
    prompt:
      "Sharma ji ko SMS draft bana do ki kal shaam tak paise bhej dunga.",
  },
  {
    icon: Code2,
    tint: colors.warning,
    tintBg: colors.warningBg,
    tintBorder: colors.warningBorder,
    title: "Code, Docs & Tables",
    subtitle: "Ask any technical topic",
    prompt:
      "Compare SQLite vs Room in a clean Markdown table with a TypeScript example.",
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late?";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function WelcomeView({
  hasApiKey,
  disabled,
  contactsCount,
  totalPayable,
  totalReceivable,
  onSelectPrompt,
  onOpenContacts,
  onOpenSettings,
}: WelcomeViewProps) {
  const { horizontalPad, contentMaxWidth, bentoColumns, isCompact } =
    useResponsive();

  const showVaultStrip =
    contactsCount > 0 || totalPayable > 0 || totalReceivable > 0;

  return (
    <View
      style={[
        styles.outer,
        { paddingHorizontal: horizontalPad },
        contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" } : null,
      ]}
    >
      {/* Hero Greeting */}
      <View style={styles.hero}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={[styles.headline, isCompact && styles.headlineCompact]}>
          How can I help today?
        </Text>
        <Text style={styles.subtext}>
          Manage contacts, paise ka hisaab, calls & SMS, or dive into code and documents — all from one place.
        </Text>
      </View>

      {/* Live Vault Overview Strip */}
      {showVaultStrip && (
        <Pressable
          onPress={onOpenContacts}
          style={({ pressed }) => [
            styles.vaultStrip,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.vaultItem}>
            <Users size={14} color={colors.sky} />
            <Text style={styles.vaultValue}>{contactsCount}</Text>
            <Text style={styles.vaultLabel}>Contacts</Text>
          </View>

          <View style={styles.vaultDivider} />

          <View style={styles.vaultItem}>
            <ArrowUpRight size={14} color={colors.danger} />
            <Text style={[styles.vaultValue, { color: colors.danger }]}>
              ₹{totalPayable}
            </Text>
            <Text style={styles.vaultLabel}>To Pay</Text>
          </View>

          <View style={styles.vaultDivider} />

          <View style={styles.vaultItem}>
            <ArrowDownLeft size={14} color={colors.sage} />
            <Text style={[styles.vaultValue, { color: colors.sage }]}>
              ₹{totalReceivable}
            </Text>
            <Text style={styles.vaultLabel}>To Collect</Text>
          </View>
        </Pressable>
      )}

      {/* Setup Key Banner */}
      {!hasApiKey && (
        <Pressable
          onPress={onOpenSettings}
          style={({ pressed }) => [
            styles.keyBanner,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.keyBannerIcon}>
            <KeyRound size={18} color={colors.warning} />
          </View>
          <View style={styles.keyBannerCopy}>
            <Text style={styles.keyBannerTitle}>Connect your Groq API key</Text>
            <Text style={styles.keyBannerSub}>
              Add your free key in Settings to start chatting
            </Text>
          </View>
          <ArrowRight size={16} color={colors.warning} />
        </Pressable>
      )}

      {/* 2x2 Bento Quick-Start Grid */}
      <View style={styles.bentoGrid}>
        {BENTO_CARDS.map((card) => {
          const IconComponent = card.icon;
          return (
            <Pressable
              key={card.title}
              disabled={disabled}
              onPress={() => onSelectPrompt(card.prompt)}
              style={({ pressed }) => [
                styles.bentoCard,
                bentoColumns === 2 ? styles.bentoHalf : styles.bentoFull,
                disabled && styles.disabled,
                pressed && styles.bentoCardPressed,
              ]}
            >
              <View
                style={[
                  styles.bentoIconBox,
                  {
                    backgroundColor: card.tintBg,
                    borderColor: card.tintBorder,
                  },
                ]}
              >
                <IconComponent size={17} color={card.tint} />
              </View>
              <Text style={styles.bentoTitle}>{card.title}</Text>
              <Text style={styles.bentoSub} numberOfLines={2}>
                {card.subtitle}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingTop: 22,
    paddingBottom: 20,
    gap: 18,
  },
  hero: {
    gap: 4,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
    letterSpacing: 0.1,
  },
  headline: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.9,
    lineHeight: 36,
  },
  headlineCompact: {
    fontSize: 25,
    lineHeight: 31,
  },
  subtext: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 4,
  },
  vaultStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  vaultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  vaultValue: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text,
  },
  vaultLabel: {
    fontSize: 11.5,
    color: colors.muted,
  },
  vaultDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.line,
  },
  keyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 15,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  keyBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  keyBannerCopy: {
    flex: 1,
  },
  keyBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.warning,
  },
  keyBannerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bentoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  bentoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8,
  },
  bentoHalf: {
    flexGrow: 1,
    flexBasis: "46%",
  },
  bentoFull: {
    width: "100%",
  },
  bentoCardPressed: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.lineStrong,
  },
  bentoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bentoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.2,
  },
  bentoSub: {
    fontSize: 12,
    lineHeight: 16.5,
    color: colors.muted,
  },
  pressed: {
    opacity: 0.84,
  },
  disabled: {
    opacity: 0.5,
  },
});
