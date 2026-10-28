"use client";

import { Mic, MicOff } from "lucide-react";
import { useRef, useState } from "react";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

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

  function toggleVoice() {
    setError("");
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const RecognitionConstructor = (window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!RecognitionConstructor) {
      setError("Voice input is not available in this browser. You can type the request instead.");
      return;
    }
    const next = new RecognitionConstructor();
    next.lang = "en-NG";
    next.interimResults = false;
    next.continuous = false;
    next.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (transcript) setValue((current) => current ? `${current} ${transcript}` : transcript);
    };
    next.onerror = () => { setError("Voice input could not be captured. Please try again or type the request."); setListening(false); };
    next.onend = () => setListening(false);
    recognition.current = next;
    setListening(true);
    next.start();
  }

  return <div className="voice-field"><div className="voice-field-row"><input id={id} name={name} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} maxLength={maxLength} required={required} /><button className="button button-secondary button-small voice-button" type="button" onClick={toggleVoice} aria-label={listening ? "Stop voice input" : "Start voice input"}>{listening ? <MicOff size={15} /> : <Mic size={15} />}{listening ? "Stop" : "Speak"}</button></div><span className="form-hint" role={error ? "alert" : "status"}>{error || "English voice input is transcribed for your review before you submit."}</span></div>;
}
