import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let message: string;
  try {
    // Avoid unbounded request bodies. FastAPI currently accepts a max of 4000 chars.
    const bodyText = await request.text();
    if (bodyText.length > 12000) {
      return NextResponse.json({ error: "Message is too large." }, { status: 413 });
    }
    const body: unknown = JSON.parse(bodyText);
    if (!body || typeof body !== "object" || !("message" in body)) {
      return NextResponse.json({ error: "A message is required." }, { status: 400 });
    }
    const candidate = (body as { message: unknown }).message;
    if (typeof candidate !== "string" || !candidate.trim() || candidate.length > 4000) {
      return NextResponse.json(
        { error: "Message must be between 1 and 4000 characters." },
        { status: 400 }
      );
    }
    message = candidate.trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ message }),
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

    return NextResponse.json({ response: (data as { response: string }).response });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      { error: timeout ? "Model request timed out. Try a shorter prompt." : "Cannot reach Colab. Check the running notebook and Ngrok URL." },
      { status: 502 }
    );
  }
}
