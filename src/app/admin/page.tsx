import Link from "next/link";
import { Activity, ArrowRight, BadgeCheck, CircleAlert, Settings2, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/data";

function countValue(result: { count: number | null }) { return result.count ?? 0; }

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const [accounts, pendingAccounts, approvedBusinesses, pendingBusinesses, openOrders, openSupport, recentOrders, recentAudit] = await Promise.all([
    supabase!.from("profiles").select("id", { count: "exact", head: true }),
    supabase!.from("profiles").select("id", { count: "exact", head: true }).eq("account_status", "pending"),
    supabase!.from("businesses").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
    supabase!.from("businesses").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase!.from("orders").select("id", { count: "exact", head: true }).not("status", "in", "(completed,cancelled,refunded)"),
    supabase!.from("support_cases").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase!.from("orders").select("id,status,total_kobo,currency,created_at,businesses(name)").order("created_at", { ascending: false }).limit(6),
    supabase!.from("audit_logs").select("id,action,target_type,target_id,created_at,profiles(full_name)").order("created_at", { ascending: false }).limit(6),
  ]);

  return (
    <>
      <div className="dashboard-top">
        <div><span className="eyebrow"><ShieldCheck size={14} /> Platform administration</span><h1>Marketplace control center.</h1><p className="muted">Review accounts, monitor orders, resolve support cases and manage platform settings from dedicated pages.</p></div>
        <span className="pill pill-green"><BadgeCheck size={12} /> Admin access</span>
      </div>

      <div className="dashboard-grid admin-summary-grid">
        <article className="stat-card"><span>Registered accounts</span><strong>{countValue(accounts)}</strong><Link href="/admin/accounts">Open accounts <ArrowRight size={13} /></Link></article>
        <article className="stat-card"><span>Pending accounts</span><strong>{countValue(pendingAccounts)}</strong><Link href="/admin/accounts?status=pending">Review queue <ArrowRight size={13} /></Link></article>
        <article className="stat-card"><span>Approved suppliers</span><strong>{countValue(approvedBusinesses)}</strong><Link href="/admin/accounts#suppliers">Supplier directory <ArrowRight size={13} /></Link></article>
        <article className="stat-card"><span>Pending businesses</span><strong>{countValue(pendingBusinesses)}</strong><Link href="/admin/accounts#supplier-applications">Review applications <ArrowRight size={13} /></Link></article>
        <article className="stat-card"><span>Active orders</span><strong>{countValue(openOrders)}</strong><Link href="/admin/orders">Open orders <ArrowRight size={13} /></Link></article>
        <article className="stat-card"><span>Open support cases</span><strong>{countValue(openSupport)}</strong><Link href="/admin/support">Open support <ArrowRight size={13} /></Link></article>
      </div>

      <div className="admin-page-links" aria-label="Admin workspaces">
        <Link href="/admin/accounts"><span className="feature-icon"><Users size={20} /></span><strong>Accounts & approvals</strong><small>Approve or reject buyer accounts, supplier accounts and business applications.</small><span>Manage accounts <ArrowRight size={14} /></span></Link>
        <Link href="/admin/orders"><span className="feature-icon"><ShoppingBag size={20} /></span><strong>Order operations</strong><small>See every marketplace order, value, supplier and current fulfilment status.</small><span>View orders <ArrowRight size={14} /></span></Link>
        <Link href="/admin/support"><span className="feature-icon"><CircleAlert size={20} /></span><strong>Support center</strong><small>Work through open, in-progress, resolved and closed customer cases.</small><span>Handle support <ArrowRight size={14} /></span></Link>
        <Link href="/admin/settings"><span className="feature-icon"><Settings2 size={20} /></span><strong>Platform settings</strong><small>Manage subscription plans and the configured marketplace fee.</small><span>Open settings <ArrowRight size={14} /></span></Link>
      </div>

      <div className="dashboard-columns admin-columns">
        <section className="panel dashboard-section">
          <div className="dashboard-section-head"><h2>Recent orders</h2><Link className="text-link" href="/admin/orders">View all <ArrowRight size={14} /></Link></div>
          {recentOrders.data?.length ? <div className="order-list">{recentOrders.data.map((order) => { const business = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses; return <article className="order-row" key={order.id}><span className="order-icon"><ShoppingBag size={16} /></span><span className="order-copy"><strong>Order {order.id.slice(0, 8)} · {business?.name ?? "Supplier"}</strong><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(order.created_at))} · {formatMoney(order.total_kobo, order.currency)}</small></span><span className="pill">{order.status.replaceAll("_", " ")}</span></article>; })}</div> : <p className="muted small">No orders have been recorded.</p>}
        </section>
        <section className="panel dashboard-section">
          <div className="dashboard-section-head"><h2>Recent admin activity</h2><Link className="text-link" href="/admin/activity">View all <ArrowRight size={14} /></Link></div>
          {recentAudit.data?.length ? <div className="order-list">{recentAudit.data.map((entry) => { const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles; return <article className="order-row" key={entry.id}><span className="order-icon"><Activity size={16} /></span><span className="order-copy"><strong>{entry.action.replaceAll("_", " ")}</strong><small>{profile?.full_name || "Administrator"} · {entry.target_type}</small></span></article>; })}</div> : <p className="muted small">Admin actions will appear here.</p>}
        </section>
      </div>
    </>
  );
}
