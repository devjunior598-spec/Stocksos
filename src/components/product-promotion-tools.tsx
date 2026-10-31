"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";

type Product = { id: string; name: string; businessName: string; price: string };

export function ProductPromotionTools({ product, publicOrigin }: { product: Product; publicOrigin: string }) {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const caption = message.trim() || `${product.name} from ${product.businessName} — ${product.price}. See current availability on StockSOS:`;
  const productPath = `/product/${product.id}`;
  const productUrl = () => `${publicOrigin}${productPath}`;
  const postText = () => `${caption}\n${productUrl()}`;

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(`${label} copied`);
    } catch {
      setFeedback("Copy is unavailable in this browser. Select and copy the text above.");
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copy(postText(), "Post text");
      return;
    }
    try {
      await navigator.share({ title: product.name, text: caption, url: productUrl() });
      setFeedback("Share menu opened");
    } catch (error) {
      if ((error as Error).name !== "AbortError") setFeedback("Sharing did not open. Copy the post text instead.");
    }
  }

  function openShare(platform: "facebook" | "linkedin" | "x" | "whatsapp") {
    const url = productUrl();
    const destination = platform === "facebook"
      ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
      : platform === "linkedin"
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
        : platform === "x"
          ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(url)}`
          : `https://wa.me/?text=${encodeURIComponent(postText())}`;
    window.open(destination, "_blank", "noopener,noreferrer");
    setFeedback(`Opened ${platform === "x" ? "X" : platform} sharing. Review the post before publishing.`);
  }

  return <div className="promotion-tools">
    <label htmlFor={`promotion-message-${product.id}`}>Post message</label>
    <textarea id={`promotion-message-${product.id}`} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder={caption} />
    <p className="promotion-link">{productUrl()}</p>
    <div className="promotion-actions">
      <button type="button" onClick={() => openShare("facebook")}>Facebook <ExternalLink size={13} /></button>
      <button type="button" onClick={() => openShare("linkedin")}>LinkedIn <ExternalLink size={13} /></button>
      <button type="button" onClick={() => openShare("x")}>X <ExternalLink size={13} /></button>
      <button type="button" onClick={() => openShare("whatsapp")}>WhatsApp <ExternalLink size={13} /></button>
      <button type="button" onClick={nativeShare}><Share2 size={13} /> Phone share menu</button>
      <button type="button" onClick={() => copy(postText(), "Post text")}><Copy size={13} /> Copy for Instagram or TikTok</button>
    </div>
    {feedback ? <p className="promotion-feedback" role="status"><Check size={13} /> {feedback}</p> : null}
  </div>;
}
