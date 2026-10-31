import { NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/pdf";
import type { Attachment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  message?: string;
  attachments?: Attachment[];
}

export async function POST(request: Request) {
  const baseUrl = process.env.NGROK_BASE_URL?.trim();
  const apiKey = process.env.COLAB_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Colab connection isn't configured. Check .env.local." },
      { status: 503 }
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/chat`);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1") {
      throw new Error("Invalid URL protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid NGROK_BASE_URL setting." }, { status: 503 });
  }

  let userText = "";
  let attachments: Attachment[] = [];

  try {
    const bodyText = await request.text();
    // Allow up to 25MB for file attachments (images / base64)
    if (bodyText.length > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Payload is too large (max 25MB)." }, { status: 413 });
    }

    const body = JSON.parse(bodyText) as ChatRequestBody;
    if (typeof body.message === "string") {
      userText = body.message.trim();
    }

    if (Array.isArray(body.attachments)) {
      attachments = body.attachments;
    }

    if (!userText && attachments.length === 0) {
      return NextResponse.json({ error: "A message or attachment is required." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Extract text from any PDF attachments that don't have extracted text yet
  for (const att of attachments) {
    if (att.type === "application/pdf" && !att.extractedText && att.dataUrl) {
      try {
        const base64Index = att.dataUrl.indexOf("base64,");
        if (base64Index !== -1) {
          const rawBase64 = att.dataUrl.slice(base64Index + 7);
          const buf = Buffer.from(rawBase64, "base64");
          att.extractedText = await extractTextFromPdf(buf);
        }
      } catch (err) {
        console.error("Failed to extract PDF text in API route:", err);
      }
    }
  }

  // Build the message to send to the backend model
  let fullPrompt = "";

  if (attachments.length > 0) {
    const fileSummaries: string[] = [];
    for (const att of attachments) {
      if (att.type === "application/pdf") {
        if (att.extractedText && att.extractedText.trim().length > 0) {
          // Truncate cleanly if text is very long to prevent overflowing model token limits
          const textPreview = att.extractedText.length > 2800
            ? `${att.extractedText.slice(0, 2800)}…\n[Note: Document truncated to fit context]`
            : att.extractedText;
          fileSummaries.push(`[Attached PDF: "${att.name}"]\n--- Document Text ---\n${textPreview}\n--- End Document ---`);
        } else {
          fileSummaries.push(`[Attached PDF: "${att.name}" (${Math.round(att.size / 1024)} KB, no selectable text or scanned)]`);
        }
      } else if (att.type.startsWith("image/")) {
        fileSummaries.push(`[Attached Image: "${att.name}" (${att.type}, ${Math.round(att.size / 1024)} KB)]`);
      } else {
        fileSummaries.push(`[Attached File: "${att.name}"]`);
      }
    }

    const contextBlock = fileSummaries.join("\n\n");
    const userPrompt = userText || "Please analyze and summarize the attached file(s).";
    fullPrompt = `${contextBlock}\n\nUser Question/Instruction:\n${userPrompt}`;
  } else {
    fullPrompt = userText;
  }

  // Ensure prompt fits within safety bounds (safe for Colab 4000 limit while keeping maximum context)
  if (fullPrompt.length > 3900) {
    fullPrompt = `${fullPrompt.slice(0, 3880)}…\n[Context truncated]`;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        message: fullPrompt,
        attachments: attachments.map((a) => ({
          name: a.name,
          type: a.type,
          size: a.size,
          extracted_text: a.extractedText,
        })),
      }),
      signal: AbortSignal.timeout(120_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: response.status === 401 ? "Colab API key was rejected." : `Colab service returned HTTP ${response.status}.` },
        { status: 502 }
      );
    }

    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("response" in data) ||
      typeof (data as { response: unknown }).response !== "string"
    ) {
      return NextResponse.json({ error: "Unexpected Colab response format." }, { status: 502 });
    }

    return NextResponse.json({
      response: (data as { response: string }).response,
      extractedTexts: attachments.reduce<Record<string, string>>((acc, att) => {
        if (att.extractedText) acc[att.id] = att.extractedText;
        return acc;
      }, {}),
    });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      { error: timeout ? "Model request timed out. Try a shorter prompt or smaller file." : "Cannot reach Colab. Check the running notebook and Ngrok URL." },
      { status: 502 }
    );
  }
}
