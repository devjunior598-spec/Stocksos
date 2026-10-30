"use client";

import Link from "next/link";
import { Check, ChevronDown, Clock3, MapPin, Send, Sparkles, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { parseSearchIntent } from "@/lib/search-intent";
import type { Category } from "@/lib/data";
import { VoiceTextField } from "@/components/voice-text-field";

type Location = {
  country: string;
  region: string;
  city: string;
  postalCode: string;
  area: string;
  address: string;
  defaultDeliveryMethod: "pickup" | "delivery" | "flexible" | "both";
};

type Product = { name: string; supplier: string; city: string; price: string | null; quantityAvailable: number; supplierUrl: string };

export function SOSAIRequest({ categories, location, action, error }: { categories: Category[]; location: Location; action: (formData: FormData) => void; error?: string }) {
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState(location.defaultDeliveryMethod || "both");
  const [urgency, setUrgency] = useState("");
  const [condition, setCondition] = useState("any");
  const [specifications, setSpecifications] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [assistant, setAssistant] = useState("Tell me what stock you need, in your own words.");
  const [searched, setSearched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [searching, setSearching] = useState(false);

  const intent = useMemo(() => {
    try { return parseSearchIntent(query, categories, location.city); }
    catch { return { q: query.trim().slice(0, 80), city: location.city, category: "", min: undefined, max: undefined, locationSource: location.city ? "profile" : "unspecified" }; }
  }, [query, categories, location.city]);
  const effectiveCategory = intent.category || selectedCategory;
  const parsedQuantity = query.match(/\b(\d[\d,]*)\s*(?:units?|pieces?|pcs?|bags?|boxes?|cartons?|packs?)?\b/i)?.[1]?.replace(/,/g, "") ?? "";
  const effectiveQuantity = quantity || parsedQuantity;
  const locationReady = Boolean(location.city && location.region);
  const canConfirm = Boolean(intent.q && effectiveQuantity && intent.city && effectiveCategory && locationReady && urgency && (urgency !== "scheduled" || scheduledAt) && confirmed);
  const locationLabel = [location.area, location.city, location.region, location.country].filter(Boolean).join(", ") || "Add your sourcing location";

  async function searchInventory() {
    const clean = query.trim();
    if (!clean) return;
    setSearching(true);
    setSearched(true);
    setConfirmed(false);
    try {
      const response = await fetch("/api/voice/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: clean }) });
      const result = await response.json() as { message?: string; error?: string; products?: Product[]; filters?: { q?: string; city?: string; category?: string } };
      setProducts(result.products ?? []);
      setAssistant(response.ok ? `${result.message ?? "I understood your request."} When do you need it?` : result.error ?? "I could not check live supplier stock yet.");
    } catch {
      setAssistant("I could not reach live supplier inventory right now. You can still review and send the request.");
    } finally {
      setSearching(false);
    }
  }

  return <div className="sos-ai-shell">
    {error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t submit that request.</strong><p>Review the missing details and try again.</p></div></div> : null}
    <div className="sos-ai-topbar"><div><span className="eyebrow"><Sparkles size={14} /> StockSOS AI</span><h2>Your sourcing copilot</h2><p className="muted small">Describe what you need. I’ll check approved suppliers and prepare the request for your confirmation.</p></div><Link className="location-chip" href="/onboarding"><MapPin size={14} /><span>{locationLabel}</span><span className="location-edit">Edit</span></Link></div>
    {!locationReady ? <div className="notice"><MapPin size={15} /><div><strong>Complete your sourcing location</strong><p>Add your state and city in <Link className="text-link" href="/onboarding">account settings</Link> so suppliers can match nearby stock.</p></div></div> : null}
    <div className="sos-chat panel">
      <div className="sos-message sos-message-assistant"><span className="sos-avatar"><Zap size={14} /></span><div><strong>StockSOS AI</strong><p>{assistant}</p></div></div>
      {searched && products.length ? <div className="sos-match-strip"><span className="pill pill-green"><Check size={12} /> Live matches</span>{products.slice(0, 3).map((product) => <a href={product.supplierUrl} key={`${product.supplier}-${product.name}`}><strong>{product.name}</strong><small>{product.supplier} · {product.price ?? "Price on request"}</small></a>)}</div> : null}
      {searched && !products.length ? <div className="sos-no-match"><Clock3 size={15} /> No exact inventory is available right now. Sending an SOS will notify matched suppliers to quote.</div> : null}
      <div className="sos-composer"><VoiceTextField id="sos_query" name="sos_query" placeholder="e.g. I need 20 cases of bottled water in Houston" maxLength={180} fallbackAvailable={false} onValueChange={setQuery} /><button className="button button-primary sos-ask" type="button" onClick={() => void searchInventory()} disabled={searching || !query.trim()}>{searching ? "Checking…" : "Ask StockSOS"}<Send size={15} /></button></div>
      <div className="sos-followup"><label htmlFor="sos_quantity">Quantity</label><input id="sos_quantity" type="number" min="1" max="1000000" value={quantity || parsedQuantity} onChange={(event) => setQuantity(event.target.value)} placeholder="How many?" /><span className="sos-followup-label">When do you need it?</span><div className="sos-option-row">{[["immediately", "Immediately"], ["within_2_hours", "Within 2 hours"], ["today", "Today"], ["scheduled", "Later"]].map(([value, label]) => <button type="button" key={value} className={`sos-option${urgency === value ? " is-selected" : ""}`} onClick={() => setUrgency(value)}><Clock3 size={13} />{label}</button>)}</div>{urgency === "scheduled" ? <input className="sos-scheduled" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} aria-label="Scheduled date and time" /> : null}</div>
      <details className="sos-advanced"><summary><span>Advanced options</span><ChevronDown size={15} /></summary><div className="form-grid"><div className="form-field"><label htmlFor="sos_condition">Condition</label><select id="sos_condition" value={condition} onChange={(event) => setCondition(event.target.value)}><option value="any">Any condition</option><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div><div className="form-field"><label htmlFor="sos_delivery">Fulfilment</label><select id="sos_delivery" value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value as typeof deliveryMethod)}><option value="flexible">I’m flexible</option><option value="delivery">I need delivery</option><option value="pickup">I can pick up</option></select></div></div><div className="form-field"><label htmlFor="sos_specs">Specifications <span className="muted">(optional)</span></label><input id="sos_specs" value={specifications} onChange={(event) => setSpecifications(event.target.value)} maxLength={1000} placeholder="Brand, size or model" /></div><p className="form-hint">Category is inferred from your description. If it is unclear, choose a category below before confirming.</p>{!intent.category ? <select className="search-input" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="" disabled>Choose a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select> : <span className="pill">Category: {categories.find((category) => category.id === intent.category)?.name}</span>}</details>
      <div className="form-field sos-fulfilment-quick"><label htmlFor="sos_delivery_quick">Fulfilment preference</label><select id="sos_delivery_quick" value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value as typeof deliveryMethod)}><option value="both">Both: pickup or delivery</option><option value="delivery">Delivery to me</option><option value="pickup">I can pick it up</option><option value="flexible">No preference</option></select><span className="form-hint">Both means the supplier can deliver or you can collect.</span></div>
      <form action={action} className="sos-confirm-form">
        <input type="hidden" name="product_name" value={intent.q} /><input type="hidden" name="category_id" value={effectiveCategory} /><input type="hidden" name="quantity" value={effectiveQuantity} /><input type="hidden" name="country" value={location.country} /><input type="hidden" name="region" value={location.region} /><input type="hidden" name="city" value={intent.city} /><input type="hidden" name="postal_code" value={location.postalCode} /><input type="hidden" name="area" value={location.area} /><input type="hidden" name="address" value={location.address} /><input type="hidden" name="delivery_method" value={deliveryMethod} /><input type="hidden" name="urgency" value={urgency} /><input type="hidden" name="condition" value={condition} /><input type="hidden" name="specifications" value={specifications} /><input type="hidden" name="notes" value="" /><input type="hidden" name="scheduled_at" value={scheduledAt} />
        <div className="sos-review"><div><span className="small muted">Ready to send</span><strong>{intent.q || "Your stock request"}</strong><small>{effectiveQuantity ? `${effectiveQuantity} requested` : "Quantity needed"} · {locationLabel} · {urgency ? urgency.replaceAll("_", " ") : "Choose timing"}</small></div><button className="button button-primary" type="submit" disabled={!canConfirm}><Zap size={15} /> Send SOS request</button></div>
        <label className="consent-line"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I’ve reviewed the request details and confirm that StockSOS can share this sourcing request with approved suppliers.</label>
      </form>
    </div>
  </div>;
}
