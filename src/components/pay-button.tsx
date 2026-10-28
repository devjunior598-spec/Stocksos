"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function PayButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) {
        setError(result.error ?? "Checkout could not be started.");
        setLoading(false);
        return;
      }
      window.location.assign(result.checkoutUrl);
    } catch {
      setError("Checkout could not be reached. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button button-primary" type="button" onClick={startCheckout} disabled={loading}>
        {loading ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />}
        {loading ? "Connecting to Paystack…" : "Continue to secure payment"}
      </button>
      {error ? <p className="notice error-notice" role="alert">{error}</p> : null}
    </div>
  );
}
