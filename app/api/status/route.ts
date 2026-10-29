import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NGROK_BASE_URL?.trim();
  const apiKey = process.env.COLAB_API_KEY?.trim();
  if (!url || !apiKey) return NextResponse.json({ status: "unconfigured" });

  try {
    const endpoint = new URL(`${url.replace(/\/+$/, "")}/health`);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1") {
      throw new Error("Invalid URL protocol");
    }
    const response = await fetch(endpoint, {
      headers: { "ngrok-skip-browser-warning": "true" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    return NextResponse.json({ status: response.ok ? "online" : "offline" });
  } catch {
    return NextResponse.json({ status: "offline" });
  }
}
