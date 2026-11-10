"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Archive, ChartNoAxesCombined, Home, LifeBuoy, Package, Settings2, ShoppingBag, Users } from "lucide-react";

const items = [
  { href: "/admin", label: "Overview", icon: Home },
  { href: "/admin/growth", label: "Growth", icon: ChartNoAxesCombined },
  { href: "/admin/accounts", label: "Accounts", icon: Users },
  { href: "/admin/products", label: "Listings", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/removed", label: "Removed records", icon: Archive },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="admin-console-nav" aria-label="Admin navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return <Link href={href} key={href} aria-current={active ? "page" : undefined}>
          <Icon size={17} aria-hidden="true" /><span>{label}</span>
        </Link>;
      })}
    </nav>
  );
}
