import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { consumeRateLimit, getRequestIdentifier } from "@/lib/rate-limit";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Secure backup transcription is not configured on this deployment yet." }, { status: 503 });
  }
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Sign in to use secure backup transcription." }, { status: 401 });
  const rateLimit = await consumeRateLimit({
    scope: "voice-transcribe-user",
    identifier: `${user.id}:${getRequestIdentifier(request.headers)}`,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (rateLimit.configured && !rateLimit.allowed) {
    return NextResponse.json({ error: "Transcription is temporarily limited. Please try again later or type your request." }, { status: 429, headers: { "Retry-After": "3600" } });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES + 100_000) return NextResponse.json({ error: "Recording exceeds the 4 MB limit." }, { status: 413 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The audio upload could not be read." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "Choose a short audio recording to transcribe." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Recording exceeds the 4 MB limit." }, { status: 413 });
  if (!audio.type.startsWith("audio/")) return NextResponse.json({ error: "Unsupported audio format." }, { status: 415 });

  const providerForm = new FormData();
  providerForm.set("file", audio, audio.name || "voice.webm");
  providerForm.set("model", "gpt-4o-mini-transcribe");
  providerForm.set("response_format", "json");
  providerForm.set("prompt", "Transcribe a short business stock sourcing request. Preserve product names, brands, quantities, units, and locations.");

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: providerForm,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      console.error("Speech transcription provider returned an error", { status: response.status });
      return NextResponse.json({ error: response.status === 429 ? "Secure transcription is busy. Please try again shortly." : "Secure transcription could not process this recording. Please try again or type your request." }, { status: 502 });
    }
    const result = await response.json() as { text?: string };
    const text = result.text?.trim().slice(0, 500);
    if (!text) return NextResponse.json({ error: "No clear speech was detected. Try again in a quieter place." }, { status: 422 });
    return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Speech transcription request failed", cause instanceof Error ? cause.message : "unknown error");
    return NextResponse.json({ error: "Secure transcription could not be reached. Please try again or type your request." }, { status: 502 });
  }
}
