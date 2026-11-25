import zlib from "node:zlib";
import { extractText, getDocumentProxy } from "unpdf";
import { LIMITS } from "../config.js";

const STOP_WORDS = new Set([
  "what",
  "the",
  "this",
  "that",
  "from",
  "with",
  "have",
  "about",
  "please",
  "document",
  "pdf",
  "tell",
  "explain",
  "summary",
  "summarize",
  "kya",
  "hai",
  "aur",
  "mein",
  "isko",
  "batao",
]);

function fallbackExtractPdfText(bytes: Uint8Array): string {
  try {
    const binary = Buffer.from(bytes).toString("latin1");
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;
    const lines: string[] = [];

    while ((match = streamRegex.exec(binary)) !== null) {
      const rawBuf = Buffer.from(match[1], "latin1");
      let content = rawBuf.toString("latin1");
      try {
        content = zlib.inflateSync(rawBuf).toString("latin1");
      } catch {
        try {
          content = zlib.inflateRawSync(rawBuf).toString("latin1");
        } catch {
          // Keep raw content
        }
      }

      const btRegex = /BT([\s\S]*?)ET/g;
      let bt: RegExpExecArray | null;
      while ((bt = btRegex.exec(content)) !== null) {
        const parenMatches = bt[1].match(/\((?:\\.|[^()\\])*\)/g);
        if (parenMatches) {
          const text = parenMatches
            .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, "$1"))
            .join(" ")
            .trim();
          if (text) lines.push(text);
        }
      }
    }

    return lines
      .join("\n")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();
  } catch {
    return "";
  }
}

export interface PdfAnalysisResult {
  contextSection: string;
  fullExtractedText: string;
  notices: string[];
}

export async function analyzePdfBuffer(
  fileName: string,
  bytes: Uint8Array,
  question: string,
  preExtractedText?: string
): Promise<PdfAnalysisResult> {
  const notices: string[] = [];
  let pageTexts: { pageNumber: number; text: string }[] = [];

  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    if (pdf.numPages > LIMITS.maxPdfPages) {
      throw new Error(`PDF exceeds the ${LIMITS.maxPdfPages}-page limit.`);
    }
    const extracted = await extractText(pdf, { mergePages: false });
    const rawPages = Array.isArray(extracted.text) ? extracted.text : [String(extracted.text || "")];
    pageTexts = rawPages.map((t, idx) => ({
      pageNumber: idx + 1,
      text: (t || "").trim(),
    }));
  } catch (err) {
    if (err instanceof Error && err.message.includes("-page limit")) {
      throw err;
    }
    const fallback = (preExtractedText || fallbackExtractPdfText(bytes)).trim();
    if (fallback) {
      const chunkSize = 2500;
      for (let i = 0; i < fallback.length; i += chunkSize) {
        pageTexts.push({
          pageNumber: Math.floor(i / chunkSize) + 1,
          text: fallback.slice(i, i + chunkSize).trim(),
        });
      }
    }
  }

  const searchable = pageTexts.filter((p) => p.text.length >= 25);

  if (searchable.length === 0) {
    notices.push(
      `${fileName}: Scanned PDF detected (little selectable text). Try attaching screenshots/images of key pages for visual analysis.`
    );
    return {
      contextSection: `PDF attached: ${fileName} (no selectable text could be extracted).`,
      fullExtractedText: "",
      notices,
    };
  }

  const terms = Array.from(
    new Set((question.toLowerCase().match(/[\w]+/g) || []).filter((w) => w.length > 2 && !STOP_WORDS.has(w)))
  );

  const ranked = [...searchable].sort((a, b) => {
    const scoreA = terms.reduce((acc, term) => acc + (a.text.toLowerCase().split(term).length - 1), 0);
    const scoreB = terms.reduce((acc, term) => acc + (b.text.toLowerCase().split(term).length - 1), 0);
    return scoreB - scoreA || a.pageNumber - b.pageNumber;
  });

  const chosen = ranked.slice(0, 8).sort((a, b) => a.pageNumber - b.pageNumber);
  let remaining = LIMITS.maxPdfTotalChars;
  const sections: string[] = [];

  for (const page of chosen) {
    if (remaining <= 0) break;
    const excerpt = page.text.slice(0, Math.min(LIMITS.maxPdfPageExcerptChars, remaining));
    sections.push(`PDF ${fileName} (Page ${page.pageNumber}):\n${excerpt}`);
    remaining -= excerpt.length;
  }

  if (
    searchable.length > chosen.length ||
    chosen.some((p) => p.text.length > LIMITS.maxPdfPageExcerptChars)
  ) {
    notices.push(
      `${fileName}: Selected the most relevant page excerpts (${chosen.length}/${pageTexts.length} pages). Ask about specific pages or sections for deeper detail.`
    );
  }

  const fullExtractedText = searchable
    .map((p) => `[Page ${p.pageNumber}]\n${p.text}`)
    .join("\n\n")
    .slice(0, 30000);

  return {
    contextSection: sections.join("\n\n"),
    fullExtractedText,
    notices,
  };
}
