"use client";

import { useState, type ReactNode } from "react";
import { KeyRound, Mail } from "lucide-react";

export function SignInMethods({ emailForm, phoneForm }: { emailForm: ReactNode; phoneForm: ReactNode }) {
  const [method, setMethod] = useState<"email" | "phone">("email");

  return (
    <>
      <div className="sign-in-methods" role="group" aria-label="Choose a sign-in method">
        <button type="button" aria-pressed={method === "email"} onClick={() => setMethod("email")}><Mail size={16} aria-hidden="true" /> Email</button>
        <button type="button" aria-pressed={method === "phone"} onClick={() => setMethod("phone")}><KeyRound size={16} aria-hidden="true" /> Phone code</button>
      </div>
      <div className="sign-in-method-panel" hidden={method !== "email"}>{emailForm}</div>
      <div className="sign-in-method-panel" hidden={method !== "phone"}>{phoneForm}</div>
    </>
  );
}
