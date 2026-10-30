import Link from "next/link";
import { Boxes, Search, ShieldAlert, Store } from "lucide-react";
import { getAuthenticatedUser, getPlatformRole } from "@/lib/auth";

export async function MobileBottomNav() {
  const user = await getAuthenticatedUser();
  if (user && await getPlatformRole(user.id) === "admin") return null;
  return <nav className="mobile-bottom-nav" aria-label="Quick navigation">
    <Link href="/find-stock"><Search size={18} /><span>Browse</span></Link>
    <Link href="/sos"><ShieldAlert size={18} /><span>SOS</span></Link>
    <Link href="/suppliers"><Boxes size={18} /><span>Suppliers</span></Link>
    <Link href="/become-supplier"><Store size={18} /><span>Sell stock</span></Link>
  </nav>;
}
