import Link from "next/link";
import { MailCheck } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <section className="auth-shell">
      <div className="form-panel">
        <div className="auth-panel" style={{ textAlign: "center" }}>
          <div className="empty-state-icon"><MailCheck size={23} /></div>
          <span className="eyebrow">One quick step</span>
          <h1 style={{ fontSize: 34, marginTop: 12 }}>Verify your email</h1>
          <p className="muted">We sent a verification link to your inbox. Open it to finish creating your account.</p>
          <p className="form-hint">If the email doesn’t arrive, check your spam folder or try registering again.</p>
          <div className="form-bottom"><Link href="/login">Go to log in</Link></div>
        </div>
      </div>
    </section>
  );
}
