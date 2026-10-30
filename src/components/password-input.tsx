"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({ id = "password", name = "password", autoComplete, minLength = 8, required = true, label = "Password" }: {
  id?: string; name?: string; autoComplete: string; minLength?: number; required?: boolean; label?: string;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="form-field"><label htmlFor={id}>{label}</label><div className="password-input-wrap"><input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} required={required} /><button className="password-toggle" type="button" onClick={() => setVisible((current) => !current)} aria-controls={id} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}<span>{visible ? "Hide" : "Show"}</span></button></div></div>;
}
