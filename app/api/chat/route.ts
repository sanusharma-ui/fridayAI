import { NextResponse } from "next/server";
import type { Attachment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const baseUrl = process.env.NGROK_BASE_URL?.trim();
  const apiKey = process.env.COLAB_API_KEY?.trim();
  if (!baseUrl || !apiKey) return NextResponse.json({ error: "Colab connection isn't configured. Check .env.local." }, { status: 503 });
  let endpoint: URL;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/chat`);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1") throw new Error("Invalid protocol");
  } catch {
    return NextResponse.json({ error: "Invalid NGROK_BASE_URL setting." }, { status: 503 });
  }

  let message: string;
  let attachments: Attachment[];
  let history: { role: "user" | "assistant"; content: string }[];
  try {
    const text = await request.text();
    if (text.length > 25 * 1024 * 1024) return NextResponse.json({ error: "Attachments exceed the 25 MB request limit. Try smaller files." }, { status: 413 });
    const body = JSON.parse(text);
    message = typeof body.message === "string" ? body.message.trim() : "";
    attachments = Array.isArray(body.attachments) ? body.attachments : [];
    history = Array.isArray(body.history) ? body.history.slice(-12).filter((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      const turn = item as { role?: unknown; content?: unknown };
      return (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string" && turn.content.length <= 3000;
    }) : [];
    if (message.length > 4000 || attachments.length > 4) return NextResponse.json({ error: "Use a message under 4,000 characters and at most four attachments." }, { status: 400 });
    if (!message && !attachments.length) return NextResponse.json({ error: "A message or attachment is required." }, { status: 400 });
    if (attachments.some((a) => !a || typeof a.name !== "string" || typeof a.type !== "string" || typeof a.dataUrl !== "string" || !/^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,/i.test(a.dataUrl))) {
      return NextResponse.json({ error: "An attachment is unavailable or invalid. Please attach it again." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({ message: message || "Please analyze the attached files.", history, attachments: attachments.map(({ name, type, dataUrl }) => ({ name, type, data_url: dataUrl })) }),
      signal: AbortSignal.timeout(180_000),
      cache: "no-store",
    });
    if (!response.ok) {
      let detail = "";
      try { const data = await response.json(); if (typeof data.detail === "string") detail = data.detail; } catch { /* Non-JSON upstream error. */ }
      return NextResponse.json({ error: response.status === 401 ? "Colab API key was rejected." : detail || `Colab service returned HTTP ${response.status}.` }, { status: 502 });
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("response" in data) || typeof (data as { response: unknown }).response !== "string") return NextResponse.json({ error: "Unexpected Colab response format." }, { status: 502 });
    const result = data as { response: string; notices?: unknown; protocol?: number };
    if (result.protocol !== 2) return NextResponse.json({ error: "Your Colab backend is outdated. Run the updated Friday notebook and reconnect." }, { status: 502 });
    return NextResponse.json({ response: result.response, notices: Array.isArray(result.notices) ? result.notices.filter((n): n is string => typeof n === "string") : [] });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json({ error: timeout ? "Model request timed out. Try a shorter prompt or smaller file." : "Cannot reach Colab. Check the running notebook and Ngrok URL." }, { status: 502 });
  }
}
