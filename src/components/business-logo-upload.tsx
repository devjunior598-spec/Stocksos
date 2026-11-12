"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, ShieldCheck, X } from "lucide-react";

const MAX_LOGO_SIZE = 4 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function BusinessLogoUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); };
  }, []);

  function clearPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
  }

  function chooseFile(selected: File | null) {
    setError("");
    if (!selected) {
      setFile(null);
      clearPreview();
      return;
    }
    if (!ACCEPTED_TYPES.has(selected.type)) {
      setError("Choose a JPG, PNG or WebP image.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      clearPreview();
      return;
    }
    if (selected.size > MAX_LOGO_SIZE) {
      setError("The business image must be 4 MB or smaller.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      clearPreview();
      return;
    }
    clearPreview();
    const nextPreviewUrl = URL.createObjectURL(selected);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setFile(selected);
  }

  return <div className="form-field business-logo-field">
    <label htmlFor="business_logo">Business logo or storefront photo <span className="muted">(optional)</span></label>
    <div className="business-logo-picker">
      <div className="business-logo-preview" aria-label={file ? `Selected image: ${file.name}` : "Business image preview"} role="img">
        {previewUrl ? <span className="business-logo-preview-image" style={{ backgroundImage: `url("${previewUrl}")` }} /> : <span className="business-logo-placeholder"><ImagePlus size={24} /><small>Your image appears here</small></span>}
      </div>
      <div className="business-logo-copy">
        <strong>Add a real image of your business</strong>
        <p>Use your company logo, storefront, workshop or warehouse. A clear image helps buyers recognize the supplier behind a listing.</p>
        <div className="business-logo-actions">
          <label className="button button-secondary button-small" htmlFor="business_logo">{file ? "Change image" : "Choose image"}</label>
          {file ? <button className="button button-quiet button-small" type="button" onClick={() => { setFile(null); setError(""); clearPreview(); if (inputRef.current) inputRef.current.value = ""; }}> <X size={13} /> Remove</button> : null}
        </div>
        <span className="form-hint">JPG, PNG or WebP · up to 4 MB. The image is shown publicly only with your approved public business profile. Upload only an image you have permission to use.</span>
      </div>
    </div>
    <input ref={inputRef} className="business-logo-input" id="business_logo" name="business_logo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="business-logo-status" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
    <span className="business-logo-security"><ShieldCheck size={13} /> Your contact details and registration reference remain private.</span>
    <span id="business-logo-status" className="form-hint business-logo-error" role={error ? "alert" : "status"} aria-live="polite">{error}</span>
  </div>;
}
