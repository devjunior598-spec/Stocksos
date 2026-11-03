"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Send } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export function SalesAssistantChat({ productId, greeting, canChat, signedIn }: {
  productId: string;
  greeting: string;
  canChat: boolean;
  signedIn: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: greeting }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const history = messages.slice(-6);
    setMessages((current) => [...current, { role: "user", content: message }]);
    setDraft("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/sales-assistant/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, message, history }),
      });
      const result = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !result.reply) {
        setError(result.error ?? "The assistant could not answer. Please try again or send an enquiry.");
      } else {
        setMessages((current) => [...current, { role: "assistant", content: result.reply! }]);
      }
    } catch {
      setError("Connection lost. Please try again or send an enquiry.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel sales-chat" aria-label="Product sales assistant">
    <div className="sales-chat-head"><span className="sales-chat-icon"><Bot size={18} /></span><div><h3>Ask about this product</h3><p>AI answers from the current listing and supplier details.</p></div></div>
    <div className="sales-chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`sales-chat-message ${message.role}`} key={index}>{message.content}</div>)}{busy ? <div className="sales-chat-message assistant">Checking the listing…</div> : null}</div>
    {error ? <p className="sales-chat-error" role="alert">{error}</p> : null}
    {canChat ? <form className="sales-chat-form" onSubmit={send}><label className="sr-only" htmlFor="sales-chat-input">Ask a product question</label><input id="sales-chat-input" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder="Ask about stock, delivery, or the product" disabled={busy} /><button type="submit" className="button button-primary" disabled={busy || draft.trim().length < 2} aria-label="Send question"><Send size={16} /></button></form> : signedIn ? <p className="muted small">Chat is available to approved buyer accounts.</p> : <Link className="button button-secondary form-submit" href={`/login?next=${encodeURIComponent(`/product/${productId}`)}`}>Sign in as a buyer to chat <ArrowRight size={14} /></Link>}
    <p className="muted small">Your questions are sent to an AI provider for a reply. Do not enter payment details. Prices and stock may change; confirm final terms with the supplier. The assistant cannot accept payment.</p>
  </section>;
}
