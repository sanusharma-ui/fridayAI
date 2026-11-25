import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, Table2 } from "lucide-react-native";
import { colors } from "../theme/colors";

export type ColumnAlign = "left" | "center" | "right";

export interface ParsedTableData {
  headers: string[];
  alignments: ColumnAlign[];
  rows: string[][];
}

export function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
}

export function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|") && !trimmed.includes("-")) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(c));
}

export function parseTableLines(lines: string[]): ParsedTableData | null {
  if (lines.length < 2) return null;
  const headers = splitTableRow(lines[0]);
  if (headers.length === 0) return null;

  const sepCells = splitTableRow(lines[1]);
  const alignments: ColumnAlign[] = headers.map((_, idx) => {
    const spec = sepCells[idx] || "---";
    if (spec.startsWith(":") && spec.endsWith(":")) return "center";
    if (spec.endsWith(":")) return "right";
    return "left";
  });

  const rows = lines.slice(2).map((rowLine) => {
    const rawCells = splitTableRow(rowLine);
    return headers.map((_, idx) => rawCells[idx] ?? "");
  });

  return { headers, alignments, rows };
}

interface MarkdownTableProps {
  table: ParsedTableData;
  renderInline: (text: string) => React.ReactNode;
}

export function MarkdownTable({ table, renderInline }: MarkdownTableProps) {
  const [copied, setCopied] = useState(false);

  const columnWidths = useMemo(() => {
    return table.headers.map((header, colIdx) => {
      let maxChars = header.replace(/[*`~]/g, "").length;
      for (const row of table.rows) {
        const cellLen = (row[colIdx] || "").replace(/[*`~]/g, "").length;
        if (cellLen > maxChars) maxChars = cellLen;
      }
      // Responsive bounded column widths (min 105px, max 250px so long descriptions wrap cleanly!)
      return Math.max(105, Math.min(250, maxChars * 8 + 28));
    });
  }, [table]);

  async function handleCopyTable() {
    try {
      const headerTsv = table.headers.join("\t");
      const rowsTsv = table.rows.map((r) => r.join("\t")).join("\n");
      await Clipboard.setStringAsync(`${headerTsv}\n${rowsTsv}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard error
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.topStrip}>
        <View style={styles.topLeft}>
          <Table2 size={13} color={colors.sage} />
          <Text style={styles.topTitle}>
            TABLE · {table.rows.length} {table.rows.length === 1 ? "ROW" : "ROWS"}
          </Text>
        </View>
        <Pressable onPress={handleCopyTable} style={styles.copyBtn} hitSlop={6}>
          {copied ? (
            <Check size={12} color={colors.sage} />
          ) : (
            <Copy size={12} color={colors.muted} />
          )}
          <Text style={[styles.copyText, copied && { color: colors.sage }]}>
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>
          {/* Header Row */}
          <View style={styles.headerRow}>
            {table.headers.map((header, colIdx) => (
              <View
                key={`th-${colIdx}`}
                style={[
                  styles.cell,
                  styles.headerCell,
                  { width: columnWidths[colIdx] },
                  colIdx < table.headers.length - 1 && styles.cellRightBorder,
                ]}
              >
                <Text
                  selectable
                  style={[
                    styles.headerText,
                    { textAlign: table.alignments[colIdx] },
                  ]}
                >
                  {renderInline(header)}
                </Text>
              </View>
            ))}
          </View>

          {/* Body Rows */}
          {table.rows.map((row, rowIdx) => (
            <View
              key={`tr-${rowIdx}`}
              style={[
                styles.bodyRow,
                rowIdx % 2 === 1 && styles.bodyRowAlt,
                rowIdx === table.rows.length - 1 && styles.lastRow,
              ]}
            >
              {row.map((cell, colIdx) => (
                <View
                  key={`td-${rowIdx}-${colIdx}`}
                  style={[
                    styles.cell,
                    { width: columnWidths[colIdx] },
                    colIdx < row.length - 1 && styles.cellRightBorder,
                  ]}
                >
                  <Text
                    selectable
                    style={[
                      styles.cellText,
                      { textAlign: table.alignments[colIdx] },
                    ]}
                  >
                    {renderInline(cell)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.codeBg,
    marginVertical: 4,
  },
  topStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.codeHeader,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.muted,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
  },
  copyText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.muted,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#1d221c",
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
  },
  bodyRow: {
    flexDirection: "row",
    backgroundColor: "#141714",
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSubtle,
  },
  bodyRowAlt: {
    backgroundColor: "#181c18",
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  headerCell: {
    paddingVertical: 11,
  },
  cellRightBorder: {
    borderRightWidth: 1,
    borderRightColor: colors.lineSubtle,
  },
  headerText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 18,
  },
  cellText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
