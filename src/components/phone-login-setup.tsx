"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MessageCircle } from "lucide-react";
import {
  requestPhoneChangeOtpAction,
  verifyPhoneChangeOtpAction,
  type PhoneOtpActionState,
} from "@/app/actions";

const initialState: PhoneOtpActionState = { status: "idle", message: "" };

export function PhoneLoginSetup({ initialPhone, verifiedPhone }: { initialPhone: string; verifiedPhone: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [sendState, sendAction, sending] = useActionState(requestPhoneChangeOtpAction, initialState);
  const [verifyState, verifyAction, verifying] = useActionState(verifyPhoneChangeOtpAction, initialState);

  useEffect(() => {
    if (verifyState.status === "verified") router.refresh();
  }, [router, verifyState.status]);

  const isVerified = Boolean(verifiedPhone && phone.trim().replace(/[\s().-]/g, "") === verifiedPhone);
  return (
    <section className="phone-login-setup" aria-labelledby="phone-login-setup-title">
      <div className="phone-otp-heading"><span className="feature-icon"><MessageCircle size={16} /></span><div><h3 id="phone-login-setup-title">Phone sign-in</h3><p>Verify your number once to use SMS codes when you log in.</p></div></div>
      {isVerified ? <div className="phone-verified-status"><BadgeCheck size={16} /> Verified for phone sign-in: {verifiedPhone}</div> : <>
        <form action={sendAction}>
          <div className="form-field"><label htmlFor="verify_phone">Phone number</label><input id="verify_phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 415 555 2671" maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} required /><span className="form-hint">Enter the full number with country code.</span></div>
          {sendState.message ? <p className={sendState.status === "error" ? "phone-otp-message error" : "phone-otp-message"} role="status" aria-live="polite">{sendState.message}</p> : null}
          <button className="button button-secondary button-small" type="submit" disabled={sending}>{sending ? "Sending…" : "Send verification code"}</button>
        </form>
        {sendState.status === "sent" ? <form className="phone-otp-verify" action={verifyAction}>
          <input type="hidden" name="phone" value={phone} />
          <div className="form-field"><label htmlFor="verify_phone_code">Six-digit code</label><input id="verify_phone_code" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></div>
          {verifyState.message ? <p className={verifyState.status === "error" ? "phone-otp-message error" : "phone-otp-message"} role="status" aria-live="polite">{verifyState.message}</p> : null}
          <button className="button button-primary button-small" type="submit" disabled={verifying}>{verifying ? "Verifying…" : "Verify phone"}</button>
        </form> : null}
      </>}
    </section>
  );
}
