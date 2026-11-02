import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { AdminNavigation } from "@/components/admin-navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <section className="dashboard-shell admin-console">
      <div className="admin-console-frame">
        <aside className="admin-console-sidebar">
          <Link href="/admin" className="brand">
            <span className="brand-mark"><ShieldCheck size={17} /></span>
            <span>StockSOS <span className="brand-accent">Admin</span></span>
          </Link>
          <p className="admin-console-sidebar-label">Workspace</p>
          <AdminNavigation />
          <p className="admin-console-sidebar-note">Protected admin workspace. Actions are recorded in the activity log.</p>
        </aside>
        <div className="admin-console-main">
          <header className="admin-console-header">
            <span><ShieldCheck size={15} /> Platform operations</span>
            <form action={signOutAction}><button className="button button-secondary button-small" type="submit">Log out</button></form>
          </header>
          <div className="admin-console-content">{children}</div>
        </div>
      </div>
    </section>
  );
}
