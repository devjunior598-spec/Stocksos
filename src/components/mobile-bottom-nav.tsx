import Link from "next/link";
import { Boxes, Search, ShieldAlert, Store } from "lucide-react";

export function MobileBottomNav() {
  return <nav className="mobile-bottom-nav" aria-label="Quick navigation">
    <Link href="/find-stock"><Search size={18} /><span>Browse</span></Link>
    <Link href="/sos"><ShieldAlert size={18} /><span>SOS</span></Link>
    <Link href="/suppliers"><Boxes size={18} /><span>Suppliers</span></Link>
    <Link href="/become-supplier"><Store size={18} /><span>Sell stock</span></Link>
  </nav>;
}
