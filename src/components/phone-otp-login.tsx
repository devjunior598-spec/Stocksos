"use client";

import { useActionState, useState } from "react";
import { KeyRound, MessageCircle, ShieldCheck } from "lucide-react";
import {
  requestPhoneLoginOtpAction,
  verifyPhoneLoginOtpAction,
  type PhoneOtpActionState,
} from "@/app/actions";

const initialState: PhoneOtpActionState = { status: "idle", message: "" };

export function PhoneOtpLogin() {
  const [phone, setPhone] = useState("");
  const [sendState, sendAction, sending] = useActionState(requestPhoneLoginOtpAction, initialState);
  const [verifyState, verifyAction, verifying] = useActionState(verifyPhoneLoginOtpAction, initialState);

  return (
    <section className="phone-otp-login" aria-labelledby="phone-login-title">
      <div className="phone-otp-heading"><span className="feature-icon"><MessageCircle size={17} /></span><div><h2 id="phone-login-title">Sign in with a phone code</h2><p>Use the phone number you have verified on your account.</p></div></div>
      <form action={sendAction}>
        <div className="form-field"><label htmlFor="login_phone">Verified phone number</label><input id="login_phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 415 555 2671" maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} required /><span className="form-hint">Include your country code, for example +1 415 555 2671.</span></div>
        {sendState.message ? <p className={sendState.status === "error" ? "phone-otp-message error" : "phone-otp-message"} role="status" aria-live="polite">{sendState.message}</p> : null}
        <button className="button button-secondary form-submit" type="submit" disabled={sending}>{sending ? "Sending code…" : "Send one-time code"}</button>
      </form>
      {sendState.status === "sent" ? <form className="phone-otp-verify" action={verifyAction}>
        <input type="hidden" name="phone" value={phone} />
        <div className="form-field"><label htmlFor="login_phone_code">Six-digit verification code</label><input id="login_phone_code" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></div>
        {verifyState.message ? <p className={verifyState.status === "error" ? "phone-otp-message error" : "phone-otp-message"} role="status" aria-live="polite">{verifyState.message}</p> : null}
        <button className="button button-primary form-submit" type="submit" disabled={verifying}><KeyRound size={15} />{verifying ? "Verifying…" : "Verify and sign in"}</button>
      </form> : null}
      <p className="phone-otp-privacy"><ShieldCheck size={13} /> If no code arrives, continue with email and password or check phone authentication setup.</p>
    </section>
  );
}
