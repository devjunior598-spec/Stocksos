import { ArrowRight, BadgeCheck, Boxes, PackageSearch } from "lucide-react";

export function AuthStory({ mode }: { mode: "login" | "register" }) {
  const returning = mode === "login";
  return (
    <aside className="auth-story" aria-label="About StockSOS">
      <span className="auth-story-kicker"><span /> STOCKSOS MARKETPLACE</span>
      <h2>{returning ? "Your business, back in motion." : "A better way to move stock."}</h2>
      <p>{returning
        ? "Pick up where you left off. Your sourcing requests, supplier listings and orders are in your workspace."
        : "Join a marketplace built for businesses that source inventory and suppliers ready to sell it."}</p>
      <div className="auth-story-steps">
        <div><span><PackageSearch size={18} /></span><div><strong>Find available stock</strong><small>Explore live listings from approved suppliers.</small></div><ArrowRight size={15} /></div>
        <div><span><Boxes size={18} /></span><div><strong>Manage your work</strong><small>Keep requests, quotations and orders together.</small></div><ArrowRight size={15} /></div>
        <div><span><BadgeCheck size={18} /></span><div><strong>Choose your role</strong><small>Buyer and supplier accounts have dedicated workspaces.</small></div><ArrowRight size={15} /></div>
      </div>
      <span className="auth-story-footnote">StockSOS · Global business marketplace</span>
    </aside>
  );
}
