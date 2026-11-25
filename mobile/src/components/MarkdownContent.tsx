import React, { useMemo } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import {
  AlertTriangle,
  CheckSquare,
  Info,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  Square,
} from "lucide-react-native";
import { colors } from "../theme/colors";
import { CodeBlock } from "./CodeBlock";
import {
  isTableSeparatorLine,
  MarkdownTable,
  parseTableLines,
  type ParsedTableData,
} from "./MarkdownTable";

type CalloutKind = "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";

interface ListItemNode {
  indent: number;
  marker: string;
  checked?: boolean;
  text: string;
}

type RichBlock =
  | {
      type: "code";
      lang: string;
      content: string;
      unclosed?: boolean;
    }
  | {
      type: "table";
      table: ParsedTableData;
    }
  | {
      type: "heading";
      level: number;
      content: string;
    }
  | {
      type: "hr";
    }
  | {
      type: "callout";
      kind: CalloutKind;
      content: string;
    }
  | {
      type: "quote";
      content: string;
    }
  | {
      type: "list";
      items: ListItemNode[];
    }
  | {
      type: "paragraph";
      content: string;
    };

const LIST_LINE_REGEX = /^(\s*)([-*•]|\d+\.)\s+(?:\[([ xX])\]\s+)?(.+)$/;
const CALLOUT_HEADER_REGEX = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i;

function parseRichMarkdown(markdown: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const fenceMatch = /^```([a-zA-Z0-9_+#.-]*)\s*$/.exec(trimmed);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      let closed = false;
      while (i < lines.length) {
        if (/^```\s*$/.test(lines[i].trim())) {
          closed = true;
          i++;
          break;
        }
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "code",
        lang,
        content: codeLines.join("\n"),
        unclosed: !closed,
      });
      continue;
    }

    if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      const tableLines: string[] = [lines[i], lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].trim().includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const parsed = parseTableLines(tableLines);
      if (parsed) {
        blocks.push({ type: "table", table: parsed });
        continue;
      }
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }

      const first = quoteLines[0] || "";
      const calloutMatch = CALLOUT_HEADER_REGEX.exec(first);
      if (calloutMatch) {
        const kind = calloutMatch[1].toUpperCase() as CalloutKind;
        const inlineRest = calloutMatch[2]?.trim();
        const bodyLines = inlineRest
          ? [inlineRest, ...quoteLines.slice(1)]
          : quoteLines.slice(1);
        blocks.push({
          type: "callout",
          kind,
          content: bodyLines.join("\n").trim(),
        });
      } else {
        blocks.push({
          type: "quote",
          content: quoteLines.join("\n").trim(),
        });
      }
      continue;
    }

    if (LIST_LINE_REGEX.test(rawLine)) {
      const items: ListItemNode[] = [];
      while (i < lines.length) {
        const m = LIST_LINE_REGEX.exec(lines[i]);
        if (!m) break;
        const indentSpaces = m[1]?.replace(/\t/g, "  ").length || 0;
        const indentLevel = Math.min(2, Math.floor(indentSpaces / 2));
        const rawMarker = m[2];
        const checkFlag = m[3];
        const itemText = m[4];

        items.push({
          indent: indentLevel,
          marker:
            rawMarker === "-" || rawMarker === "*" || rawMarker === "•"
              ? indentLevel > 0
                ? "◦"
                : "•"
              : rawMarker,
          checked:
            checkFlag !== undefined
              ? checkFlag.toLowerCase() === "x"
              : undefined,
          text: itemText,
        });
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      const curTrimmed = cur.trim();
      if (
        !curTrimmed ||
        /^```/.test(curTrimmed) ||
        /^(?:---+|\*\*\*+|___+)$/.test(curTrimmed) ||
        /^(#{1,4})\s+/.test(curTrimmed) ||
        curTrimmed.startsWith(">") ||
        LIST_LINE_REGEX.test(cur) ||
        (curTrimmed.includes("|") &&
          i + 1 < lines.length &&
          isTableSeparatorLine(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(cur);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: paraLines.join("\n"),
      });
    } else {
      i++;
    }
  }

  return blocks;
}

export function renderInlineSpans(text: string): React.ReactNode[] {
  const tokenRegex =
    /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\n]+\*)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Text key={`t-${key++}`}>{text.slice(lastIndex, match.index)}</Text>
      );
    }

    const tok = match[0];
    if (tok.startsWith("***") && tok.endsWith("***")) {
      nodes.push(
        <Text key={`bi-${key++}`} style={[styles.bold, styles.italic]}>
          {tok.slice(3, -3)}
        </Text>
      );
    } else if (tok.startsWith("**") && tok.endsWith("**")) {
      nodes.push(
        <Text key={`b-${key++}`} style={styles.bold}>
          {tok.slice(2, -2)}
        </Text>
      );
    } else if (tok.startsWith("~~") && tok.endsWith("~~")) {
      nodes.push(
        <Text key={`s-${key++}`} style={styles.strike}>
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
            {label} ↗
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

const CALLOUT_THEMES: Record<
  CalloutKind,
  {
    title: string;
    color: string;
    bg: string;
    border: string;
    Icon: typeof Info;
  }
> = {
  NOTE: {
    title: "Note",
    color: colors.sky,
    bg: colors.skySoft,
    border: colors.skyBorder,
    Icon: Info,
  },
  TIP: {
    title: "Tip",
    color: colors.sage,
    bg: colors.sageSoft,
    border: colors.sageBorder,
    Icon: Lightbulb,
  },
  IMPORTANT: {
    title: "Important",
    color: colors.accent,
    bg: colors.accentSoft,
    border: colors.accentBorder,
    Icon: Sparkles,
  },
  WARNING: {
    title: "Warning",
    color: colors.warning,
    bg: colors.warningBg,
    border: colors.warningBorder,
    Icon: AlertTriangle,
  },
  CAUTION: {
    title: "Caution",
    color: colors.danger,
    bg: colors.dangerBg,
    border: colors.dangerBorder,
    Icon: ShieldAlert,
  },
};

export function MarkdownContent({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const blocks = useMemo(() => parseRichMarkdown(content), [content]);

  if (!content && isStreaming) {
    return <Text style={styles.cursorOnly}>▍</Text>;
  }

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        const isLastBlock = index === blocks.length - 1;
        const showInlineCursor = isStreaming && isLastBlock;

        if (block.type === "code") {
          return (
            <CodeBlock
              key={`blk-${index}`}
              lang={block.lang}
              code={block.content}
              isStreamingBlock={Boolean(isStreaming && (block.unclosed || isLastBlock))}
            />
          );
        }

        if (block.type === "table") {
          return (
            <MarkdownTable
              key={`blk-${index}`}
              table={block.table}
              renderInline={renderInlineSpans}
            />
          );
        }

        if (block.type === "hr") {
          return <View key={`blk-${index}`} style={styles.hr} />;
        }

        if (block.type === "heading") {
          const headingStyle =
            block.level === 1
              ? styles.h1
              : block.level === 2
              ? styles.h2
              : block.level === 3
              ? styles.h3
              : styles.h4;

          return (
            <View
              key={`blk-${index}`}
              style={block.level <= 2 ? styles.headingWithDivider : undefined}
            >
              <Text selectable style={[styles.headingBase, headingStyle]}>
                {renderInlineSpans(block.content)}
                {showInlineCursor ? (
                  <Text style={styles.streamCursor}> ▍</Text>
                ) : null}
              </Text>
            </View>
          );
        }

        if (block.type === "callout") {
          const theme = CALLOUT_THEMES[block.kind];
          const IconComp = theme.Icon;
          return (
            <View
              key={`blk-${index}`}
              style={[
                styles.calloutBox,
                { backgroundColor: theme.bg, borderColor: theme.border },
              ]}
            >
              <View style={styles.calloutHeader}>
                <IconComp size={14} color={theme.color} />
                <Text style={[styles.calloutTitle, { color: theme.color }]}>
                  {theme.title}
                </Text>
              </View>
              {block.content ? (
                <Text selectable style={styles.calloutBody}>
                  {renderInlineSpans(block.content)}
                  {showInlineCursor ? (
                    <Text style={styles.streamCursor}> ▍</Text>
                  ) : null}
                </Text>
              ) : null}
            </View>
          );
        }

        if (block.type === "quote") {
          return (
            <View key={`blk-${index}`} style={styles.quoteBox}>
              <Text selectable style={styles.quoteText}>
                {renderInlineSpans(block.content)}
                {showInlineCursor ? (
                  <Text style={styles.streamCursor}> ▍</Text>
                ) : null}
              </Text>
            </View>
          );
        }

        if (block.type === "list") {
          return (
            <View key={`blk-${index}`} style={styles.listWrap}>
              {block.items.map((item, idx) => {
                const isLastItem = showInlineCursor && idx === block.items.length - 1;
                return (
                  <View
                    key={`li-${idx}`}
                    style={[
                      styles.listRow,
                      item.indent > 0 && { paddingLeft: item.indent * 16 },
                    ]}
                  >
                    {item.checked !== undefined ? (
                      <View style={styles.checkboxWrap}>
                        {item.checked ? (
                          <CheckSquare size={15} color={colors.sage} />
                        ) : (
                          <Square size={15} color={colors.muted} />
                        )}
                      </View>
                    ) : (
                      <Text style={styles.listMarker}>{item.marker}</Text>
                    )}
                    <Text
                      selectable
                      style={[
                        styles.paragraph,
                        item.checked && styles.checkedItemText,
                      ]}
                    >
                      {renderInlineSpans(item.text)}
                      {isLastItem ? (
                        <Text style={styles.streamCursor}> ▍</Text>
                      ) : null}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        return (
          <Text key={`blk-${index}`} selectable style={styles.paragraph}>
            {renderInlineSpans(block.content)}
            {showInlineCursor ? (
              <Text style={styles.streamCursor}> ▍</Text>
            ) : null}
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
    gap: 11,
  },
  paragraph: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23.5,
    color: colors.text,
  },
  headingBase: {
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headingWithDivider: {
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginTop: 6,
  },
  h1: {
    fontSize: 20,
    lineHeight: 27,
  },
  h2: {
    fontSize: 17.5,
    lineHeight: 24,
  },
  h3: {
    fontSize: 15.5,
    lineHeight: 22,
    marginTop: 4,
    color: colors.accent,
  },
  h4: {
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: 2,
    color: colors.textSecondary,
  },
  hr: {
    height: 1,
    backgroundColor: colors.lineStrong,
    marginVertical: 6,
  },
  bold: {
    fontWeight: "700",
    color: "#FFFFFF",
  },
  italic: {
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  strike: {
    textDecorationLine: "line-through",
    color: colors.muted,
  },
  inlineCode: {
    fontFamily: monoFont,
    fontSize: 12.5,
    backgroundColor: colors.surfaceElevated,
    color: "#FFA657",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  link: {
    color: colors.sky,
    textDecorationLine: "underline",
    fontWeight: "500",
  },
  calloutBox: {
    borderWidth: 1,
    borderLeftWidth: 3.5,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
  },
  calloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  calloutBody: {
    fontSize: 13.5,
    lineHeight: 20.5,
    color: colors.text,
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.sky,
    backgroundColor: colors.skySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quoteText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  listWrap: {
    gap: 7,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  listMarker: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.accent,
    fontWeight: "700",
    minWidth: 16,
  },
  checkboxWrap: {
    paddingTop: 4,
  },
  checkedItemText: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  streamCursor: {
    color: colors.accent,
    fontSize: 13,
  },
  cursorOnly: {
    color: colors.accent,
    fontSize: 15,
    lineHeight: 22,
  },
});
