"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function SharePageLink({ url, title, text }: { url: string; title: string; text: string }) {
  const [feedback, setFeedback] = useState("");

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        setFeedback("Share menu opened");
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Link copied");
    } catch {
      setFeedback("Copy is unavailable. Select and copy the link below.");
    }
  }

  return <div className="public-share">
    <span className="public-share-url">{url}</span>
    <button className="button button-quiet button-small" type="button" onClick={share} aria-label={`Share ${title}`}>
      {feedback === "Link copied" ? <Check size={14} /> : <Share2 size={14} />}
      {feedback === "Link copied" ? "Copied" : "Share link"}
    </button>
    {feedback ? <span className="public-share-feedback" role="status">{feedback}</span> : null}
  </div>;
}
