export const colors = {
  // Deep Obsidian Canvas & Surfaces
  bg: "#0B0E13",
  sidebar: "#0F131A",
  surface: "#151A23",
  surfaceElevated: "#1C2330",
  surfaceHover: "#242D3D",

  // User Bubble (Rich Cobalt Slate)
  userBubble: "#1E3658",
  userBubbleBorder: "rgba(96, 152, 235, 0.32)",

  // Code & Table Surfaces
  codeBg: "#0D1117",
  codeHeader: "#141A24",

  // Borders & Dividers
  line: "rgba(255, 255, 255, 0.08)",
  lineSubtle: "rgba(255, 255, 255, 0.05)",
  lineStrong: "rgba(255, 255, 255, 0.15)",

  // Typography
  text: "#F3F5F8",
  textSecondary: "#C7CFD9",
  muted: "#8B95A5",
  subtle: "#647082",

  // Brand Primary: Warm Terracotta Coral
  accent: "#F27D52",
  accentSoft: "rgba(242, 125, 82, 0.14)",
  accentBorder: "rgba(242, 125, 82, 0.34)",

  // Emerald Mint (Calls, Receivable Money, Verified, Online)
  sage: "#2DD4A0",
  sageSoft: "rgba(45, 212, 160, 0.13)",
  sageBorder: "rgba(45, 212, 160, 0.32)",

  // Sky Blue (Contacts, SMS, Links, Info)
  sky: "#58A6FF",
  skySoft: "rgba(88, 166, 255, 0.13)",
  skyBorder: "rgba(88, 166, 255, 0.32)",

  // Warm Amber (Birthdays, Reminders, Warnings)
  warning: "#F5B041",
  warningBg: "rgba(245, 176, 65, 0.13)",
  warningBorder: "rgba(245, 176, 65, 0.32)",

  // Rose Coral (Payable Dues, Stop, Delete, Errors)
  danger: "#F87171",
  dangerBg: "rgba(248, 113, 113, 0.13)",
  dangerBorder: "rgba(248, 113, 113, 0.32)",

  // Primary CTA Buttons
  ctaBg: "#F27D52",
  ctaText: "#FFFFFF",

  overlay: "rgba(4, 6, 10, 0.74)",
} as const;

const AVATAR_PALETTES = [
  { bg: "rgba(242, 125, 82, 0.18)", border: "rgba(242, 125, 82, 0.38)", text: "#F6936E" },
  { bg: "rgba(88, 166, 255, 0.18)", border: "rgba(88, 166, 255, 0.38)", text: "#74B4FF" },
  { bg: "rgba(45, 212, 160, 0.18)", border: "rgba(45, 212, 160, 0.38)", text: "#4CE0B3" },
  { bg: "rgba(245, 176, 65, 0.18)", border: "rgba(245, 176, 65, 0.38)", text: "#F7C065" },
  { bg: "rgba(244, 114, 182, 0.18)", border: "rgba(244, 114, 182, 0.38)", text: "#F68BC2" },
  { bg: "rgba(56, 189, 248, 0.18)", border: "rgba(56, 189, 248, 0.38)", text: "#67CEF9" },
] as const;

export function getAvatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}
