"use client";

import { LoaderCircle, Mic, MicOff, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: () => void;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (event: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => Recognition;
type LiveProduct = { name: string; brand: string | null; supplier: string; city: string; price: string | null; quantityAvailable: number; supplierUrl: string };

function recognitionErrorMessage(code: string | undefined) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Tap the lock icon beside the address, allow Microphone for StockSOS, then reload the page and try Speak again.";
    case "audio-capture":
      return "No microphone was found. Check that your phone microphone is available, not being used by another app, and that StockSOS has permission to use it.";
    case "no-speech":
      return "No speech was detected. Move somewhere quiet, tap Speak, and say the product request clearly.";
    case "network":
      return "Your browser’s speech service is unavailable. On Android, try Chrome with Google voice services enabled, or type the request instead.";
    case "language-not-supported":
      return "This browser does not support English (Nigeria) voice input. Type the request instead.";
    case "aborted":
      return "Voice input stopped. Tap Speak when you are ready to try again.";
    default:
      return code
        ? `Voice input failed (${code}). Check microphone permission or type the request instead.`
        : "Voice input failed before the browser returned a reason. Check microphone permission or type the request instead.";
  }
}

export function VoiceTextField({ id, name, defaultValue = "", placeholder, maxLength, required = false, fallbackAvailable = false }: {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  fallbackAvailable?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [liveProducts, setLiveProducts] = useState<LiveProduct[]>([]);
  const [audioConsent, setAudioConsent] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopping = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopping.current = true;
      recognition.current?.stop();
      recorder.current?.stop();
      audioStream.current?.getTracks().forEach((track) => track.stop());
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, []);

  async function askStockSOS(transcript: string) {
    setReply("");
    setLiveProducts([]);
    try {
      const response = await fetch("/api/voice/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: transcript }),
      });
      const result = await response.json() as { message?: string; error?: string; products?: LiveProduct[] };
      setReply(response.ok ? result.message ?? "StockSOS received your request." : result.error ?? "Stock search could not be completed.");
      if (response.ok) setLiveProducts(result.products ?? []);
    } catch {
      setReply("StockSOS could not reach live inventory just now. Your spoken text is saved above; please try Search again.");
    }
  }

  function acceptTranscript(transcript: string) {
    const clean = transcript.trim().slice(0, maxLength ?? 500);
    if (!clean) return;
    setValue(clean);
    void askStockSOS(clean);
  }

  async function startTranscriptionFallback() {
    if (!fallbackAvailable) {
      setError("Secure backup transcription is not configured yet. You can still use device speech or type your request.");
      return;
    }
    if (!audioConsent) {
      setError("To use secure backup transcription, first agree to send this short audio clip to StockSOS for transcription.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("This browser does not support secure backup recording. Try Chrome, Edge, Safari, or Samsung Internet, or type the request.");
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setError("Secure backup transcription requires HTTPS. Open the StockSOS HTTPS address or type the request.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const nextRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunks.current = [];
      nextRecorder.ondataavailable = (event) => { if (event.data.size) audioChunks.current.push(event.data); };
      nextRecorder.onerror = () => setError("The microphone recording stopped unexpectedly. Check microphone permissions and try again.");
      nextRecorder.onstop = async () => {
        if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
        stream.getTracks().forEach((track) => track.stop());
        audioStream.current = null;
        if (!mounted.current) return;
        setListening(false);
        const blob = new Blob(audioChunks.current, { type: nextRecorder.mimeType || "audio/webm" });
        if (!blob.size) { setError("No audio was captured. Tap Speak and try again."); return; }
        if (blob.size > 4 * 1024 * 1024) { setError("That recording was too large. Please record a shorter request."); return; }
        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.set("audio", blob, `voice.${blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm"}`);
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
          const result = await response.json() as { text?: string; error?: string };
          if (!response.ok || !result.text) { setError(result.error ?? "Secure transcription is unavailable right now. You can type your request."); return; }
          acceptTranscript(result.text);
          setError("");
        } catch {
          setError("Secure transcription could not be reached. Your audio was not saved; please try again or type the request.");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.current = nextRecorder;
      nextRecorder.start();
      setListening(true);
      setError("");
      fallbackTimer.current = setTimeout(() => {
        if (nextRecorder.state === "recording") nextRecorder.stop();
      }, 15000);
    } catch (cause) {
      const code = cause instanceof DOMException ? cause.name : undefined;
      setError(code === "NotAllowedError" ? "Microphone permission was blocked. Allow microphone access for StockSOS in your browser settings, then try again." : code === "NotFoundError" ? "No microphone was found. Check the microphone on your device." : "The microphone could not start. Check browser permissions and try again.");
    }
  }

  async function toggleVoice() {
    if (listening) {
      if (recorder.current?.state === "recording") recorder.current.stop();
      else { stopping.current = true; recognition.current?.stop(); }
      return;
    }
    setError("");
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setError("Voice input requires a secure HTTPS connection. Open the StockSOS HTTPS address or type the request instead.");
      return;
    }
    const speechWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const RecognitionConstructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!RecognitionConstructor) {
      if (audioConsent) await startTranscriptionFallback();
      else setError(fallbackAvailable ? "This browser does not support built-in voice input. Select secure backup transcription below, or type the request." : "This browser does not support built-in voice input. Secure backup transcription is not configured yet; please type the request.");
      return;
    }
    const next = new RecognitionConstructor();
    // en-US is supported by the Android speech service more consistently than
    // en-NG. The transcript remains editable, so users can speak naturally.
    next.lang = "en-US";
    next.interimResults = false;
    next.continuous = false;
    next.onstart = () => {
      stopping.current = false;
      setListening(true);
      setError("");
    };
    next.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (transcript) acceptTranscript(transcript);
    };
    next.onerror = (event) => {
      setListening(false);
      if (stopping.current && event.error === "aborted") return;
      if ((event.error === "network" || event.error === "service-not-allowed") && audioConsent) {
        setError("Device speech is unavailable. Starting secure backup transcription; speak your request now.");
        void startTranscriptionFallback();
      } else {
        setError(recognitionErrorMessage(event.error));
      }
    };
    next.onend = () => {
      setListening(false);
      recognition.current = null;
    };
    recognition.current = next;
    try {
      next.start();
    } catch (cause) {
      setListening(false);
      const code = cause instanceof DOMException ? cause.name : undefined;
      setError(code === "InvalidStateError" ? "Voice input is already starting. Wait a moment and try again." : recognitionErrorMessage(code));
    }
  }

  return <div className="voice-field"><div className="voice-field-row"><input id={id} name={name} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} maxLength={maxLength} required={required} /><button className="button button-secondary button-small voice-button" type="button" onClick={toggleVoice} disabled={transcribing} aria-pressed={listening} aria-label={listening ? "Stop voice input" : "Start voice input"}>{transcribing ? <LoaderCircle size={15} className="spin" /> : listening ? <MicOff size={15} /> : <Mic size={15} />}{transcribing ? "Transcribing" : listening ? "Stop" : "Speak"}</button></div>
    <span className={`form-hint voice-status${listening ? " voice-status-listening" : ""}`} role={error ? "alert" : "status"}>{error || (transcribing ? "Securely transcribing your short recording…" : listening ? "Listening… speak clearly, then tap Stop when finished." : "Tap Speak to start. Your words will appear here for review before you submit.")}</span>
    <label className="voice-consent"><input type="checkbox" checked={audioConsent} onChange={(event) => setAudioConsent(event.target.checked)} /> If device speech fails, allow a short recording to be sent securely to StockSOS for transcription. Audio is processed for text and not stored by StockSOS.</label>
    {fallbackAvailable ? <label className="voice-consent"><input type="checkbox" checked={audioConsent} onChange={(event) => setAudioConsent(event.target.checked)} /> If device speech fails, allow a short recording to be sent securely to our transcription provider. StockSOS does not store the recording.</label> : <span className="form-hint">Device speech is tried first. Secure audio backup can be enabled by configuring the server transcription key.</span>}
    {reply ? <div className="voice-reply" role="status"><Search size={15} /><span>{reply}</span>{typeof window !== "undefined" && "speechSynthesis" in window ? <button type="button" className="voice-read-reply" onClick={() => { const speech = new SpeechSynthesisUtterance(reply); speech.lang = "en-US"; window.speechSynthesis.cancel(); window.speechSynthesis.speak(speech); }}>Read reply</button> : null}</div> : null}
    {liveProducts.length ? <div className="voice-results" aria-label="Live supplier matches">{liveProducts.map((product) => <a href={product.supplierUrl} className="voice-result" key={`${product.supplier}-${product.name}`}><span><strong>{product.name}</strong>{product.brand ? <small>{product.brand}</small> : null}<small>{product.supplier} · {product.city} · {product.quantityAvailable} available</small></span><b>{product.price ?? "Price on request"}</b></a>)}</div> : null}
  </div>;
}
