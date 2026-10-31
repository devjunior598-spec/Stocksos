"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, LoaderCircle, Video, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const acceptedTypes = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
  ["video/mp4", "mp4"], ["video/webm", "webm"],
]);

export function InventoryImageField({ id, currentPath = "", currentPaths = [] }: { id: string; currentPath?: string; currentPaths?: string[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const initialPaths = currentPaths.length ? currentPaths : currentPath ? [currentPath] : [];
  const [paths, setPaths] = useState(initialPaths);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function uploadSelectedFiles() {
    const input = fileRef.current;
    const files = Array.from(input?.files ?? []);
    if (!files.length) return;
    if (paths.length + files.length > 11) {
      setError("Add up to 10 photos and one video per product.");
      if (input) input.value = "";
      return;
    }
    const totalVideos = paths.filter((path) => /\.(mp4|webm)$/i.test(path)).length + files.filter((file) => file.type.startsWith("video/")).length;
    if (totalVideos > 1) {
      setError("Add one product video. Remove the existing video to replace it.");
      if (input) input.value = "";
      return;
    }
    for (const file of files) {
      const extension = acceptedTypes.get(file.type);
      const maxSize = file.type.startsWith("video/") ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (!extension) { setError("Use JPG, PNG or WebP photos, or an MP4 or WebM video."); if (input) input.value = ""; return; }
      if (file.size > maxSize) { setError(file.type.startsWith("video/") ? "The video must be 50 MB or smaller." : "Each photo must be 10 MB or smaller."); if (input) input.value = ""; return; }
    }
    const form = input?.form;
    const businessField = form?.elements.namedItem("business_id");
    const businessId = businessField instanceof HTMLInputElement || businessField instanceof HTMLSelectElement ? businessField.value : "";
    if (!businessId) { setError("Choose a business before uploading product media."); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Supabase Storage is not configured for this session."); return; }

    setUploading(true); setError("");
    const uploaded: string[] = [];
    for (const file of files) {
      const extension = acceptedTypes.get(file.type)!;
      const objectPath = `${businessId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("marketplace-images").upload(objectPath, file, { contentType: file.type, cacheControl: "3600", upsert: false });
      if (uploadError) { setError(uploadError.message || "Some media could not be uploaded. Remove incomplete selections and retry."); break; }
      uploaded.push(objectPath);
    }
    setPaths((current) => [...current, ...uploaded]);
    setUploading(false);
    if (input) input.value = "";
  }

  function removePath(path: string) {
    setPaths((current) => current.filter((item) => item !== path));
  }

  return <div className="form-field inventory-image-field">
    <label htmlFor={id}>Product photos and video <span className="muted">(optional)</span></label>
    <input ref={fileRef} id={id} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple disabled={uploading} aria-describedby={`${id}-hint ${id}-status`} onChange={() => void uploadSelectedFiles()} />
    {paths.map((path) => <input type="hidden" name="media_paths" value={path} key={path} />)}
    <input type="hidden" name="image_path" value={paths.find((path) => /\.(jpg|png|webp)$/i.test(path)) ?? ""} />
    <span id={`${id}-hint`} className="form-hint"><ImagePlus size={12} /> Up to 10 photos (10 MB each) and one MP4 or WebM video (50 MB). Choose the business first.</span>
    {paths.length ? <div className="inventory-media-preview">{paths.map((path) => {
      const url = publicMediaUrl(path);
      const video = /\.(mp4|webm)$/i.test(path);
      return <div className="inventory-media-item" key={path}>{video ? <video src={url} controls muted /> : <Image src={url} alt="Product media preview" fill unoptimized sizes="140px" />}{video ? <span className="media-type"><Video size={12} /> Video</span> : null}<button type="button" className="text-link small" onClick={() => removePath(path)} disabled={uploading}><X size={13} /> Remove</button></div>;
    })}</div> : null}
    <span id={`${id}-status`} className={error ? "form-hint upload-error" : "form-hint"} role={error ? "alert" : "status"} aria-live="polite">{uploading ? <><LoaderCircle size={12} className="spin" /> Uploading product media…</> : error}</span>
  </div>;
}

function publicMediaUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/marketplace-images/${safePath}`;
}
