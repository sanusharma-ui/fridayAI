

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Decodes a PDF hex string (e.g. `<00480065006c006c006f>` or `<48656c6c6f>`)
 */
function decodePdfHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  // If UTF-16BE BOM is present
  if (clean.toLowerCase().startsWith("feff")) {
    const bytes: number[] = [];
    for (let i = 4; i < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (!isNaN(code)) bytes.push(code);
    }
    return String.fromCharCode(...bytes);
  }

  // Check if it's 2-byte hex per char (UTF-16BE without BOM)
  if (clean.length >= 4 && clean.length % 4 === 0 && clean.startsWith("00")) {
    const chars: string[] = [];
    for (let i = 0; i < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (!isNaN(code)) chars.push(String.fromCharCode(code));
    }
    return chars.join("");
  }

  // 1-byte hex per char
  let result = "";
  for (let i = 0; i < clean.length; i += 2) {
    const byte = clean.slice(i, i + 2);
    if (byte.length === 2) {
      result += String.fromCharCode(parseInt(byte, 16));
    }
  }
  return result;
}

/**
 * Decompresses a raw byte stream using DecompressionStream or node:zlib.
 */
async function decompressFlate(bytes: Uint8Array): Promise<string> {
  // First attempt: Node.js zlib if available in runtime
  try {
    // Dynamic import to avoid browser bundling issues
    const zlibModule = await import("node:zlib");
    try {
      return zlibModule.inflateSync(bytes).toString("latin1");
    } catch {
      try {
        return zlibModule.inflateRawSync(bytes).toString("latin1");
      } catch {
        // Fall back to DecompressionStream or raw
      }
    }
  } catch {
    // Not in Node or dynamic import failed, try Web Streams API
  }

  // Web Streams DecompressionStream
  if (typeof DecompressionStream !== "undefined") {
    for (const format of ["deflate", "deflate-raw"] as const) {
      try {
        const ds = new DecompressionStream(format);
        const writer = ds.writable.getWriter();
        writer.write(bytes as unknown as BufferSource);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const combined = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          combined.set(c, offset);
          offset += c.length;
        }
        let res = "";
        for (let i = 0; i < combined.length; i++) {
          res += String.fromCharCode(combined[i]);
        }
        return res;
      } catch {
        // Try next format
      }
    }
  }

  // Fallback: return raw bytes as latin1 string
  let fallback = "";
  for (let i = 0; i < bytes.length; i++) {
    fallback += String.fromCharCode(bytes[i]);
  }
  return fallback;
}

/**
 * Parses text operators from a decompressed PDF content stream.
 */
function extractTextFromStream(content: string): string[] {
  const lines: string[] = [];

  // Match text blocks: BT ... ET
  const btRegex = /BT([\s\S]*?)ET/g;
  let btMatch: RegExpExecArray | null;

  while ((btMatch = btRegex.exec(content)) !== null) {
    const block = btMatch[1];
    let currentLine: string[] = [];

    // Find all text and layout tokens inside BT ... ET
    // Token types:
    // (text) Tj
    // <hex> Tj
    // [(...) 100 (...)] TJ
    // (text) '
    // T*, Td, TD (line breaks)
    const tokenRegex = /\((?:\\.|[^()\\])*\)\s*Tj|<[0-9a-fA-F\s]+>\s*Tj|\[((?:\\.|[^[\]\\])*)\]\s*TJ|\((?:\\.|[^()\\])*\)\s*'|T\*|(?:\d+(?:\.\d+)?\s+){2}Td/g;
    let tok: RegExpExecArray | null;

    while ((tok = tokenRegex.exec(block)) !== null) {
      const match = tok[0];

      if (match.endsWith("Tj")) {
        if (match.startsWith("(")) {
          const raw = match.slice(1, match.lastIndexOf(")"));
          currentLine.push(decodePdfLiteralString(raw));
        } else if (match.startsWith("<")) {
          const raw = match.slice(1, match.indexOf(">"));
          currentLine.push(decodePdfHexString(raw));
        }
      } else if (match.endsWith("TJ") && tok[1] !== undefined) {
        // Array of strings and numbers
        const inner = tok[1];
        const partRegex = /\(((?:\\.|[^()\\])*)\)|<([0-9a-fA-F\s]+)>/g;
        let part: RegExpExecArray | null;
        let segment = "";
        while ((part = partRegex.exec(inner)) !== null) {
          if (part[1] !== undefined) {
            segment += decodePdfLiteralString(part[1]);
          } else if (part[2] !== undefined) {
            segment += decodePdfHexString(part[2]);
          }
        }
        if (segment) {
          currentLine.push(segment);
        }
      } else if (match.endsWith("'")) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(" "));
          currentLine = [];
        }
        const raw = match.slice(1, match.lastIndexOf(")"));
        currentLine.push(decodePdfLiteralString(raw));
      } else if (match === "T*" || match.endsWith("Td")) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(" "));
          currentLine = [];
        }
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.join(" "));
    }
  }

  return lines;
}

/**
 * Extracts visible text content from a PDF ArrayBuffer or Uint8Array.
 * Returns clean plain text extracted from streams.
 */
export async function extractTextFromPdf(data: ArrayBuffer | Uint8Array): Promise<string> {
  try {
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    let binary = "";
    // Build binary string in chunks to prevent stack overflow on large buffers
    const chunkSize = 32768;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, uint8.length);
      const sub = uint8.subarray(i, end);
      binary += String.fromCharCode.apply(null, Array.from(sub));
    }

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;
    const extractedLines: string[] = [];

    while ((match = streamRegex.exec(binary)) !== null) {
      const rawString = match[1];
      const rawBytes = new Uint8Array(rawString.length);
      for (let i = 0; i < rawString.length; i++) {
        rawBytes[i] = rawString.charCodeAt(i) & 0xff;
      }

      const decompressed = await decompressFlate(rawBytes);
      const lines = extractTextFromStream(decompressed);
      if (lines.length > 0) {
        extractedLines.push(...lines);
      }
    }

    // Clean up result
    const joined = extractedLines
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n")
      // Remove unprintable binary artifacts
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    return joined;
  } catch (error) {
    console.error("PDF text extraction error:", error);
    return "";
  }
}

/**
 * Format bytes into human-readable string (e.g. 1.2 MB, 340 KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
