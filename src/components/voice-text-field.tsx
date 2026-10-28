"use client";

import { Mic, MicOff } from "lucide-react";
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
      return "Your browser could not reach its speech service. Check your connection or type the request instead.";
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

export function VoiceTextField({ id, name, defaultValue = "", placeholder, maxLength, required = false }: {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const stopping = useRef(false);

  useEffect(() => () => {
    stopping.current = true;
    recognition.current?.stop();
  }, []);

  function toggleVoice() {
    if (listening) {
      stopping.current = true;
      recognition.current?.stop();
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
      setError("This browser does not support voice input. Use the latest Chrome, Edge, Safari, or Samsung Internet, or type the request instead.");
      return;
    }
    const next = new RecognitionConstructor();
    next.lang = "en-NG";
    next.interimResults = false;
    next.continuous = false;
    next.onstart = () => {
      stopping.current = false;
      setListening(true);
      setError("");
    };
    next.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (transcript) setValue((current) => current ? `${current} ${transcript}` : transcript);
    };
    next.onerror = (event) => {
      setListening(false);
      if (!stopping.current || event.error !== "aborted") setError(recognitionErrorMessage(event.error));
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

  return <div className="voice-field"><div className="voice-field-row"><input id={id} name={name} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} maxLength={maxLength} required={required} /><button className="button button-secondary button-small voice-button" type="button" onClick={toggleVoice} aria-pressed={listening} aria-label={listening ? "Stop voice input" : "Start voice input"}>{listening ? <MicOff size={15} /> : <Mic size={15} />}{listening ? "Stop" : "Speak"}</button></div><span className={`form-hint voice-status${listening ? " voice-status-listening" : ""}`} role={error ? "alert" : "status"}>{error || (listening ? "Listening… speak clearly, then tap Stop when finished." : "Tap Speak to start. Your words will appear here for review before you submit.")}</span></div>;
}
