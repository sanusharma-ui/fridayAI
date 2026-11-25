import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, Terminal, WrapText } from "lucide-react-native";
import { colors } from "../theme/colors";

const LANGUAGE_LABELS: Record<string, { label: string; dot: string }> = {
  ts: { label: "TypeScript", dot: "#58A6FF" },
  typescript: { label: "TypeScript", dot: "#58A6FF" },
  tsx: { label: "TSX · React", dot: "#61DAFB" },
  js: { label: "JavaScript", dot: "#F7DF1E" },
  javascript: { label: "JavaScript", dot: "#F7DF1E" },
  jsx: { label: "JSX · React", dot: "#61DAFB" },
  py: { label: "Python", dot: "#34D399" },
  python: { label: "Python", dot: "#34D399" },
  sh: { label: "Shell", dot: "#2DD4A0" },
  bash: { label: "Bash", dot: "#2DD4A0" },
  zsh: { label: "Shell", dot: "#2DD4A0" },
  powershell: { label: "PowerShell", dot: "#58A6FF" },
  ps1: { label: "PowerShell", dot: "#58A6FF" },
  json: { label: "JSON", dot: "#F5B041" },
  sql: { label: "SQL", dot: "#F27D52" },
  html: { label: "HTML", dot: "#F87171" },
  css: { label: "CSS", dot: "#60A5FA" },
  go: { label: "Go", dot: "#38BDF8" },
  rust: { label: "Rust", dot: "#FB923C" },
  rs: { label: "Rust", dot: "#FB923C" },
  java: { label: "Java", dot: "#F59E0B" },
  kotlin: { label: "Kotlin", dot: "#C084FC" },
  kt: { label: "Kotlin", dot: "#C084FC" },
  cpp: { label: "C++", dot: "#60A5FA" },
  c: { label: "C", dot: "#60A5FA" },
  yaml: { label: "YAML", dot: "#F5B041" },
  yml: { label: "YAML", dot: "#F5B041" },
};

const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "async",
  "await",
  "import",
  "from",
  "export",
  "default",
  "if",
  "else",
  "elif",
  "for",
  "while",
  "switch",
  "case",
  "break",
  "continue",
  "try",
  "catch",
  "finally",
  "throw",
  "new",
  "class",
  "extends",
  "implements",
  "interface",
  "type",
  "enum",
  "public",
  "private",
  "protected",
  "static",
  "def",
  "lambda",
  "yield",
  "with",
  "as",
  "in",
  "not",
  "and",
  "or",
  "pass",
  "raise",
  "fn",
  "pub",
  "mut",
  "struct",
  "impl",
  "match",
  "package",
  "func",
  "defer",
  "go",
  "SELECT",
  "FROM",
  "WHERE",
  "INSERT",
  "INTO",
  "UPDATE",
  "DELETE",
  "JOIN",
  "LEFT",
  "INNER",
  "GROUP",
  "BY",
  "ORDER",
  "LIMIT",
  "CREATE",
  "TABLE",
]);

const LITERALS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "None",
  "True",
  "False",
  "self",
  "this",
  "super",
  "NULL",
]);

interface TokenSpan {
  text: string;
  kind: "plain" | "comment" | "string" | "keyword" | "literal" | "number" | "func" | "type";
}

function tokenizeLine(line: string, langKey: string): TokenSpan[] {
  if (!line) return [{ text: " ", kind: "plain" }];

  const isHashCommentLang = [
    "py",
    "python",
    "sh",
    "bash",
    "zsh",
    "yaml",
    "yml",
    "powershell",
    "ps1",
  ].includes(langKey);
  const isSql = langKey === "sql";

  const spans: TokenSpan[] = [];
  const tokenRegex =
    /(\/\/.*$|--.*$|#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b(?=\s*\()|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;

  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    const tok = match[0];

    if (tok.startsWith("#") && !isHashCommentLang) continue;
    if (tok.startsWith("--") && !isSql) continue;

    if (match.index > lastIdx) {
      spans.push({ text: line.slice(lastIdx, match.index), kind: "plain" });
    }

    if (tok.startsWith("//") || tok.startsWith("#") || tok.startsWith("--")) {
      spans.push({ text: tok, kind: "comment" });
    } else if (tok.startsWith('"') || tok.startsWith("'") || tok.startsWith("`")) {
      spans.push({ text: tok, kind: "string" });
    } else if (/^\d/.test(tok)) {
      spans.push({ text: tok, kind: "number" });
    } else if (KEYWORDS.has(tok) || (isSql && KEYWORDS.has(tok.toUpperCase()))) {
      spans.push({ text: tok, kind: "keyword" });
    } else if (LITERALS.has(tok)) {
      spans.push({ text: tok, kind: "literal" });
    } else if (line.slice(match.index + tok.length).trimStart().startsWith("(")) {
      spans.push({ text: tok, kind: "func" });
    } else if (/^[A-Z][A-Za-z0-9_]*$/.test(tok)) {
      spans.push({ text: tok, kind: "type" });
    } else {
      spans.push({ text: tok, kind: "plain" });
    }

    lastIdx = match.index + tok.length;
  }

  if (lastIdx < line.length) {
    spans.push({ text: line.slice(lastIdx), kind: "plain" });
  }

  return spans;
}

export interface CodeBlockProps {
  lang?: string;
  code: string;
  isStreamingBlock?: boolean;
}

export function CodeBlock({ lang = "", code, isStreamingBlock }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);

  const normalizedLang = lang.trim().toLowerCase();
  const meta = LANGUAGE_LABELS[normalizedLang] || {
    label: normalizedLang ? normalizedLang.toUpperCase() : "Code",
    dot: colors.accent,
  };

  const lines = useMemo(() => {
    const clean = code.replace(/\n$/, "");
    return clean ? clean.split("\n") : [""];
  }, [code]);

  const highlightedLines = useMemo(() => {
    if (lines.length > 300) {
      return lines.map((l) => [{ text: l || " ", kind: "plain" as const }]);
    }
    return lines.map((l) => tokenizeLine(l, normalizedLang));
  }, [lines, normalizedLang]);

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard error
    }
  }

  const codeContent = (
    <View style={styles.codeInner}>
      {highlightedLines.map((tokens, idx) => (
        <View key={`ln-${idx}`} style={styles.codeLineRow}>
          <Text selectable={false} style={styles.lineNumber}>
            {idx + 1}
          </Text>
          <Text
            selectable
            style={[styles.codeLineText, wrapLines && styles.codeLineWrapped]}
          >
            {tokens.map((span, sIdx) => (
              <Text key={`sp-${sIdx}`} style={tokenStyles[span.kind]}>
                {span.text}
              </Text>
            ))}
            {isStreamingBlock && idx === highlightedLines.length - 1 ? (
              <Text style={styles.streamCursor}>▍</Text>
            ) : null}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Terminal size={13} color={meta.dot} />
          <Text style={styles.langLabel}>{meta.label}</Text>
          <Text style={styles.lineCount}>
            {isStreamingBlock ? "· writing…" : `· ${lines.length}L`}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setWrapLines((w) => !w)}
            style={[styles.actionBtn, wrapLines && styles.actionBtnActive]}
            hitSlop={6}
          >
            <WrapText size={12} color={wrapLines ? colors.sky : colors.muted} />
            <Text
              style={[styles.actionText, wrapLines && { color: colors.sky }]}
            >
              Wrap
            </Text>
          </Pressable>

          <Pressable onPress={handleCopy} style={styles.actionBtn} hitSlop={6}>
            {copied ? (
              <Check size={12} color={colors.sage} />
            ) : (
              <Copy size={12} color={colors.muted} />
            )}
            <Text style={[styles.actionText, copied && { color: colors.sage }]}>
              {copied ? "Copied" : "Copy"}
            </Text>
          </Pressable>
        </View>
      </View>

      {wrapLines ? (
        codeContent
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.horizontalContent}
        >
          {codeContent}
        </ScrollView>
      )}
    </View>
  );
}

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

// Crisp GitHub-Dark inspired syntax palette
const tokenStyles = StyleSheet.create({
  plain: { color: "#E6EDF3" },
  comment: { color: "#7D8590", fontStyle: "italic" },
  string: { color: "#A5D6FF" },
  keyword: { color: "#FF7B72", fontWeight: "600" },
  literal: { color: "#79C0FF", fontWeight: "600" },
  number: { color: "#FFA657" },
  func: { color: "#D2A8FF" },
  type: { color: "#FFA657" },
});

const styles = StyleSheet.create({
  panel: {
    borderRadius: 13,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.codeBg,
    marginVertical: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.codeHeader,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },
  langLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  lineCount: {
    fontSize: 11,
    color: colors.subtle,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
  },
  actionBtnActive: {
    borderColor: colors.skyBorder,
    backgroundColor: colors.skySoft,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  horizontalContent: {
    minWidth: "100%",
  },
  codeInner: {
    paddingVertical: 10,
    paddingRight: 14,
    minWidth: "100%",
  },
  codeLineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 1,
  },
  lineNumber: {
    width: 34,
    paddingRight: 10,
    textAlign: "right",
    fontFamily: monoFont,
    fontSize: 11,
    lineHeight: 19,
    color: "#485262",
  },
  codeLineText: {
    fontFamily: monoFont,
    fontSize: 12.5,
    lineHeight: 19,
    color: "#E6EDF3",
  },
  codeLineWrapped: {
    flex: 1,
    flexWrap: "wrap",
  },
  streamCursor: {
    color: colors.accent,
    fontSize: 12,
  },
});
