import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <section className="auth-shell">
      <div className="form-panel auth-panel" style={{ textAlign: "center" }}>
        <div className="empty-state-icon"><SearchX size={22} /></div>
        <span className="eyebrow">404 · Page not found</span>
        <h1 style={{ fontSize: 34, marginTop: 12 }}>That page has moved</h1>
        <p className="muted">Try the marketplace or return to the StockSOS homepage.</p>
        <Link className="button button-primary" href="/"><ArrowLeft size={15} /> Back home</Link>
      </div>
    </section>
  );
}
