"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = { nextPath: string; setupRequested: boolean; verifyRequested: boolean };

export function AdminMfaEnrollment({ nextPath, setupRequested, verifyRequested }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError) setError("We could not load your authenticator setup.");
      const factor = data?.totp?.find((item) => item.status === "verified");
      if (factor?.id) setFactorId(factor.id);
    });
  }, [supabase]);

  async function beginEnrollment() {
    if (!supabase) return setError("Supabase authentication is not configured.");
    setBusy(true); setError("");
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "StockSOS Admin" });
    setBusy(false);
    if (enrollError || !data?.id || !data.totp) return setError(enrollError?.message ?? "Authenticator setup could not start.");
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setMessage("Scan the QR code with an authenticator app, then enter the six-digit code.");
  }

  async function verify() {
    if (!supabase || !factorId || !/^\d{6}$/.test(code)) return setError("Enter the six-digit code from your authenticator app.");
    setBusy(true); setError("");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge?.id) { setBusy(false); return setError(challengeError?.message ?? "Could not start MFA verification."); }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    setBusy(false);
    if (verifyError) return setError("That code was not accepted. Check your authenticator and try again.");
    router.replace(nextPath);
    router.refresh();
  }

  return <section className="auth-shell"><div className="form-panel">
    <div className="form-header"><span className="eyebrow">Admin security</span><h1>Protect the admin console.</h1><p>StockSOS requires a time-based authenticator code for administrator access.</p></div>
    {error ? <div className="notice error-notice" role="alert"><strong>{error}</strong></div> : null}
    {message ? <div className="notice success-notice" role="status"><strong>{message}</strong></div> : null}
    {setupRequested && !qrCode && !factorId ? <button className="button button-primary form-submit" type="button" onClick={beginEnrollment} disabled={busy}>{busy ? "Preparing…" : "Set up authenticator"}</button> : null}
    {qrCode ? <div className="auth-panel">
      <img src={qrCode} alt="QR code for StockSOS administrator MFA" style={{ width: 220, height: 220, margin: "0 auto 18px", display: "block" }} />
      <p className="form-hint">Can’t scan? Enter this setup key manually: <strong>{secret}</strong></p>
    </div> : null}
    {(verifyRequested || qrCode || factorId) ? <div className="auth-panel"><div className="form-field"><label htmlFor="mfa-code">Authenticator code</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /></div><button className="button button-primary form-submit" type="button" onClick={verify} disabled={busy}>{busy ? "Verifying…" : "Verify and enter admin"}</button></div> : null}
  </div></section>;
}
