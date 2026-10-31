"use client";

import { useMemo, useState } from "react";

function toSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

export function BusinessLinkFields() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const suggestedSlug = useMemo(() => toSlug(name), [name]);
  const effectiveSlug = slugEdited ? slug : suggestedSlug;

  return <>
    <div className="form-field">
      <label htmlFor="name">Business name</label>
      <input id="name" name="name" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} autoComplete="organization" />
    </div>
    <div className="form-field">
      <label htmlFor="slug">Shareable business link</label>
      <input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} placeholder="your-business-name" value={effectiveSlug} onChange={(event) => { setSlugEdited(true); setSlug(toSlug(event.target.value)); }} aria-describedby="business-link-preview business-link-hint" />
      <span className="form-hint" id="business-link-preview">{effectiveSlug ? `Shareable link: socksos.vercel.app/business/${effectiveSlug}` : "Your link will appear here as you type your business name."}</span>
      <span className="form-hint" id="business-link-hint">You can edit the suggested link. It becomes public after your business is approved.</span>
    </div>
  </>;
}
