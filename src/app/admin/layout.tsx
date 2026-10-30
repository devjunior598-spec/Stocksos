import Link from "next/link";
import { Activity, Home, LifeBuoy, Settings2, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const adminNavigation = [
  { href: "/admin", label: "Overview", icon: Home },
  { href: "/admin/accounts", label: "Accounts", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <section className="dashboard-shell admin-console">
      <div className="page-container">
        <header className="admin-console-header">
          <Link href="/admin" className="brand">
            <span className="brand-mark"><ShieldCheck size={17} /></span>
            <span>StockSOS <span className="brand-accent">Admin</span></span>
          </Link>
          <form action={signOutAction}><button className="button button-secondary button-small" type="submit">Log out</button></form>
        </header>
        <nav className="admin-console-nav" aria-label="Admin navigation">
          {adminNavigation.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href}><Icon size={16} /> {label}</Link>
          ))}
        </nav>
        <div className="admin-console-content">{children}</div>
      </div>
    </section>
  );
}
