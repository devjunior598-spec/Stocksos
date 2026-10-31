"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Video } from "lucide-react";

export function ProductMediaGallery({ paths, title }: { paths: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = paths[active];
  const url = current ? publicMediaUrl(current) : "";
  const isVideo = /\.(mp4|webm)$/i.test(current ?? "");

  return <div className="product-gallery">
    <div className="product-gallery-stage">
      {current && isVideo ? <video src={url} controls playsInline preload="metadata" aria-label={`${title} product video`} /> : current ? <Image src={url} alt={`${title} product photo ${active + 1}`} fill unoptimized sizes="(max-width: 700px) 100vw, 55vw" className="product-image" /> : <ImageIcon size={44} />}
      {paths.length > 1 ? <><button className="gallery-arrow gallery-prev" type="button" onClick={() => setActive((active + paths.length - 1) % paths.length)} aria-label="Previous product media"><ChevronLeft size={20} /></button><button className="gallery-arrow gallery-next" type="button" onClick={() => setActive((active + 1) % paths.length)} aria-label="Next product media"><ChevronRight size={20} /></button><span className="gallery-count">{active + 1} / {paths.length}</span></> : null}
    </div>
    {paths.length > 1 ? <div className="product-gallery-thumbs">{paths.map((path, index) => { const itemUrl = publicMediaUrl(path); const video = /\.(mp4|webm)$/i.test(path); return <button type="button" key={path} className={`gallery-thumb${active === index ? " is-active" : ""}`} onClick={() => setActive(index)} aria-label={`View product ${video ? "video" : "photo"} ${index + 1}`} aria-pressed={active === index}>{video ? <span className="gallery-video-thumb"><Video size={20} /></span> : <Image src={itemUrl} alt="" fill unoptimized sizes="78px" />}</button>; })}</div> : null}
  </div>;
}

function publicMediaUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return "";
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/marketplace-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}
