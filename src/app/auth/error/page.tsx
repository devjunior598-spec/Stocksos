import Link from "next/link";
import { CircleAlert } from "lucide-react";

export default function AuthErrorPage() {
  return (
    <section className="auth-shell">
      <div className="form-panel auth-panel" style={{ textAlign: "center" }}>
        <div className="empty-state-icon"><CircleAlert size={22} /></div>
        <span className="eyebrow">Authentication link</span>
        <h1 style={{ fontSize: 34, marginTop: 12 }}>This link could not be verified</h1>
        <p className="muted">It may have expired or already been used. Request a fresh link and try again.</p>
        <Link className="button button-primary" href="/login">Back to log in</Link>
      </div>
    </section>
  );
}
