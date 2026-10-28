"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const acceptedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function InventoryImageField({ id, currentPath = "" }: { id: string; currentPath?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(currentPath);
  const [preview, setPreview] = useState(() => publicImageUrl(currentPath));
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function uploadSelectedFile() {
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (!file) return;
    const extension = acceptedTypes.get(file.type);
    if (!extension) {
      setError("Choose a JPG, PNG or WebP image.");
      input.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("The image must be 10 MB or smaller.");
      input.value = "";
      return;
    }

    const form = input.form;
    const businessField = form?.elements.namedItem("business_id");
    const businessId = businessField instanceof HTMLInputElement || businessField instanceof HTMLSelectElement
      ? businessField.value
      : "";
    if (!businessId) {
      setError("Choose a business before uploading a product image.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase Storage is not configured for this session.");
      return;
    }

    setUploading(true);
    setError("");
    const objectPath = `${businessId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("marketplace-images")
      .upload(objectPath, file, { contentType: file.type, cacheControl: "3600", upsert: false });
    setUploading(false);
    if (uploadError) {
      setError(uploadError.message || "The image could not be uploaded.");
      return;
    }
    setPath(objectPath);
    setPreview(publicImageUrl(objectPath));
  }

  function clearImage() {
    setPath("");
    setPreview("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="form-field inventory-image-field">
      <label htmlFor={id}>Product photo <span className="muted">(optional)</span></label>
      <input
        ref={fileRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        aria-describedby={`${id}-hint ${id}-status`}
        onChange={uploadSelectedFile}
      />
      <input type="hidden" name="image_path" value={path} />
      <span id={`${id}-hint`} className="form-hint"><ImagePlus size={12} /> JPG, PNG or WebP up to 10 MB. Select the business before uploading.</span>
      {preview ? <div className="inventory-image-preview"><Image src={preview} alt="Product photo preview" fill unoptimized sizes="160px" /><button type="button" className="text-link small" onClick={clearImage} disabled={uploading}><X size={13} /> Remove photo</button></div> : null}
      <span id={`${id}-status`} className={error ? "form-hint upload-error" : "form-hint"} role={error ? "alert" : "status"} aria-live="polite">
        {uploading ? <><LoaderCircle size={12} className="spin" /> Uploading photo…</> : error}
      </span>
    </div>
  );
}

function publicImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/marketplace-images/${safePath}`;
}
