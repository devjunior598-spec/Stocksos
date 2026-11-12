"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, Megaphone, Search, Settings, ShieldAlert, Store } from "lucide-react";

type Role = "supplier" | "buyer" | null;

const guestItems = [
  { href: "/find-stock", label: "Browse", icon: Search, paths: ["/find-stock", "/categories", "/product/"] },
  { href: "/sos", label: "SOS", icon: ShieldAlert, paths: ["/sos"] },
  { href: "/suppliers", label: "Suppliers", icon: Boxes, paths: ["/suppliers", "/business/"] },
  { href: "/become-supplier", label: "Sell stock", icon: Store, paths: ["/become-supplier"] },
];

const buyerItems = [
  guestItems[0],
  guestItems[1],
  { href: "/saved-suppliers", label: "Saved", icon: Boxes, paths: ["/saved-suppliers"] },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, paths: ["/dashboard", "/orders/"] },
];

const supplierItems = [
  { href: "/supplier", label: "Workspace", icon: Store, paths: ["/supplier"] },
  { href: "/supplier/reach", label: "Reach", icon: Megaphone, paths: ["/supplier/reach"] },
  { href: "/pricing", label: "Plans", icon: Boxes, paths: ["/pricing"] },
  { href: "/onboarding", label: "Settings", icon: Settings, paths: ["/onboarding"] },
];

export function MobileBottomNavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = role === "supplier" ? supplierItems : role === "buyer" ? buyerItems : guestItems;
  const label = role === "supplier" ? "Supplier quick navigation" : role === "buyer" ? "Buyer quick navigation" : "Quick navigation";
  const matches = (path: string) => pathname === path || pathname.startsWith(path.endsWith("/") ? path : `${path}/`);
  const activeHref = items.flatMap((item) => item.paths.map((path) => ({ href: item.href, path })))
    .filter(({ path }) => matches(path))
    .sort((a, b) => b.path.length - a.path.length)[0]?.href;

  return <nav className="mobile-bottom-nav" aria-label={label}>
    {items.map(({ href, label: itemLabel, icon: Icon }) => {
      return <Link key={href} href={href} aria-current={activeHref === href ? "page" : undefined}>
        <Icon size={18} /><span>{itemLabel}</span>
      </Link>;
    })}
  </nav>;
}
