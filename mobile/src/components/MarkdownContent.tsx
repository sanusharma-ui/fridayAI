import React, { useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy } from "lucide-react-native";
import { colors } from "../theme/colors";

interface Block {
  type: "code" | "paragraph" | "heading" | "quote" | "list";
  content: string;
  lang?: string;
  level?: number;
  items?: { marker: string; text: string }[];
}

function parseMarkdownBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  const pushTextSection = (section: string) => {
    const lines = section.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Heading
      const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
      if (headingMatch) {
        blocks.push({
          type: "heading",
          level: headingMatch[1].length,
          content: headingMatch[2],
        });
        i++;
        continue;
      }

      // Blockquote
      if (trimmed.startsWith(">")) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        blocks.push({
          type: "quote",
          content: quoteLines.join("\n"),
        });
        continue;
      }

      // Bullet or numbered list
      const listMatch = /^([-*•]|\d+\.)\s+(.+)$/.exec(trimmed);
      if (listMatch) {
        const items: { marker: string; text: string }[] = [];
        while (i < lines.length) {
          const m = /^([-*•]|\d+\.)\s+(.+)$/.exec(lines[i].trim());
          if (!m) break;
          items.push({
            marker: m[1] === "-" || m[1] === "*" ? "•" : m[1],
            text: m[2],
          });
          i++;
        }
        blocks.push({ type: "list", content: "", items });
        continue;
      }

      // Paragraph
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,4})\s+/.test(lines[i].trim()) &&
        !lines[i].trim().startsWith(">") &&
        !/^([-*•]|\d+\.)\s+/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "paragraph",
        content: paraLines.join("\n"),
      });
    }
  };

  while ((match = fenceRegex.exec(markdown)) !== null) {
    if (match.index > lastIdx) {
      pushTextSection(markdown.slice(lastIdx, match.index));
    }
    blocks.push({
      type: "code",
      lang: (match[1] || "CODE").toUpperCase(),
      content: match[2].replace(/\n$/, ""),
    });
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < markdown.length) {
    pushTextSection(markdown.slice(lastIdx));
  }

  return blocks;
}

function renderInlineSpans(text: string): React.ReactNode[] {
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Text key={`t-${key++}`}>{text.slice(lastIndex, match.index)}</Text>);
    }

    const tok = match[0];
    if (tok.startsWith("**") && tok.endsWith("**")) {
      nodes.push(
        <Text key={`b-${key++}`} style={styles.bold}>
          {tok.slice(2, -2)}
        </Text>
      );
    } else if (tok.startsWith("`") && tok.endsWith("`")) {
      nodes.push(
        <Text key={`c-${key++}`} style={styles.inlineCode}>
          {tok.slice(1, -1)}
        </Text>
      );
    } else if (tok.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        nodes.push(
          <Text
            key={`l-${key++}`}
            style={styles.link}
            onPress={() => Linking.openURL(url)}
          >
            {label}
          </Text>
        );
      } else {
        nodes.push(<Text key={`r-${key++}`}>{tok}</Text>);
      }
    } else if (tok.startsWith("*") && tok.endsWith("*")) {
      nodes.push(
        <Text key={`i-${key++}`} style={styles.italic}>
          {tok.slice(1, -1)}
        </Text>
      );
    }
    lastIndex = match.index + tok.length;
  }

  if (lastIndex < text.length) {
    nodes.push(<Text key={`e-${key++}`}>{text.slice(lastIndex)}</Text>);
  }

  return nodes;
}

function CodeBlockPanel({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard error
    }
  }

  return (
    <View style={styles.codePanel}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLang}>{lang || "CODE"}</Text>
        <Pressable onPress={handleCopy} style={styles.copyCodeBtn} hitSlop={8}>
          {copied ? (
            <Check size={13} color={colors.sage} />
          ) : (
            <Copy size={13} color={colors.muted} />
          )}
          <Text style={[styles.copyCodeText, copied && { color: colors.sage }]}>
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text selectable style={styles.codeText}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <CodeBlockPanel
              key={`blk-${index}`}
              lang={block.lang || "CODE"}
              code={block.content}
            />
          );
        }

        if (block.type === "heading") {
          const fontSize =
            block.level === 1 ? 19 : block.level === 2 ? 17 : 15;
          return (
            <Text
              key={`blk-${index}`}
              selectable
              style={[styles.heading, { fontSize }]}
            >
              {renderInlineSpans(block.content)}
            </Text>
          );
        }

        if (block.type === "quote") {
          return (
            <View key={`blk-${index}`} style={styles.quoteBox}>
              <Text selectable style={styles.quoteText}>
                {renderInlineSpans(block.content)}
              </Text>
            </View>
          );
        }

        if (block.type === "list" && block.items) {
          return (
            <View key={`blk-${index}`} style={styles.listWrap}>
              {block.items.map((item, idx) => (
                <View key={`li-${idx}`} style={styles.listRow}>
                  <Text style={styles.listMarker}>{item.marker}</Text>
                  <Text selectable style={styles.paragraph}>
                    {renderInlineSpans(item.text)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={`blk-${index}`} selectable style={styles.paragraph}>
            {renderInlineSpans(block.content)}
          </Text>
        );
      })}
    </View>
  );
}

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  paragraph: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 23,
    color: colors.text,
  },
  heading: {
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
  },
  bold: {
    fontWeight: "700",
    color: "#ffffff",
  },
  italic: {
    fontStyle: "italic",
  },
  inlineCode: {
    fontFamily: monoFont,
    fontSize: 12.5,
    backgroundColor: colors.surfaceElevated,
    color: colors.accent,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  link: {
    color: colors.accent,
    textDecorationLine: "underline",
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  listWrap: {
    gap: 6,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  listMarker: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.sage,
    fontWeight: "600",
    minWidth: 14,
  },
  codePanel: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.codeBg,
    marginVertical: 2,
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.codeHeader,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSubtle,
  },
  codeLang: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: "700",
    color: colors.muted,
  },
  copyCodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  copyCodeText: {
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: "500",
  },
  codeText: {
    fontFamily: monoFont,
    fontSize: 12.5,
    lineHeight: 19,
    color: "#dfe4d8",
    padding: 12,
  },
});
