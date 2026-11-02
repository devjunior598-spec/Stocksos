import Link from "next/link";
import { Boxes, ClipboardList, LayoutDashboard, Package, Search, ShieldAlert, Store } from "lucide-react";
import { getAuthenticatedUser, getMarketplaceRole, getPlatformRole } from "@/lib/auth";

export async function MobileBottomNav() {
  const user = await getAuthenticatedUser();
  if (user && await getPlatformRole(user.id) === "admin") return null;
  const role = user ? await getMarketplaceRole(user.id) : null;
  if (role === "supplier") return <nav className="mobile-bottom-nav" aria-label="Supplier quick navigation">
    <Link href="/supplier"><Store size={18} /><span>Workspace</span></Link>
    <Link href="/supplier/marketplace"><Package size={18} /><span>Products</span></Link>
    <Link href="/supplier/requests"><ClipboardList size={18} /><span>Requests</span></Link>
    <Link href="/supplier/orders"><Boxes size={18} /><span>Orders</span></Link>
  </nav>;
  if (role === "buyer") return <nav className="mobile-bottom-nav" aria-label="Buyer quick navigation">
    <Link href="/find-stock"><Search size={18} /><span>Browse</span></Link>
    <Link href="/sos"><ShieldAlert size={18} /><span>SOS</span></Link>
    <Link href="/saved-suppliers"><Boxes size={18} /><span>Saved</span></Link>
    <Link href="/dashboard"><LayoutDashboard size={18} /><span>Dashboard</span></Link>
  </nav>;
  return <nav className="mobile-bottom-nav" aria-label="Quick navigation">
    <Link href="/find-stock"><Search size={18} /><span>Browse</span></Link>
    <Link href="/sos"><ShieldAlert size={18} /><span>SOS</span></Link>
    <Link href="/suppliers"><Boxes size={18} /><span>Suppliers</span></Link>
    <Link href="/become-supplier"><Store size={18} /><span>Sell stock</span></Link>
  </nav>;
}
