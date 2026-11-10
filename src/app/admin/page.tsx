import Link from "next/link";
import { Activity, ArrowRight, BadgeCheck, Building2, ChartNoAxesCombined, CircleAlert, LifeBuoy, ShieldCheck, ShoppingBag, Truck, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/data";

function countValue(result: { count: number | null }) { return result.count ?? 0; }

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const [accounts, pendingAccounts, approvedBusinesses, pendingBusinesses, pendingDrivers, openOrders, openSupport, recentOrders, recentAudit] = await Promise.all([
    supabase!.from("profiles").select("id", { count: "exact", head: true }),
    supabase!.from("profiles").select("id", { count: "exact", head: true }).eq("account_status", "pending"),
    supabase!.from("businesses").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
    supabase!.from("businesses").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase!.from("delivery_partners").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase!.from("orders").select("id", { count: "exact", head: true }).not("status", "in", "(completed,cancelled,refunded)"),
    supabase!.from("support_cases").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase!.from("orders").select("id,status,total_kobo,currency,created_at,businesses(name)").order("created_at", { ascending: false }).limit(6),
    supabase!.from("audit_logs").select("id,action,target_type,target_id,created_at,profiles(full_name)").order("created_at", { ascending: false }).limit(6),
  ]);
  const dataUnavailable = [accounts, pendingAccounts, approvedBusinesses, pendingBusinesses, pendingDrivers, openOrders, openSupport, recentOrders, recentAudit].some((result) => result.error);
  const attention = [
    { href: "/admin/accounts?status=pending", label: "Account approvals", count: countValue(pendingAccounts), icon: Users, detail: "Review new buyers and suppliers" },
    { href: "/admin/accounts#supplier-applications", label: "Business reviews", count: countValue(pendingBusinesses), icon: Building2, detail: "Verify supplier businesses" },
    { href: "/admin/accounts#delivery-applications", label: "Delivery applications", count: countValue(pendingDrivers), icon: Truck, detail: "Review delivery partners" },
    { href: "/admin/support", label: "Support cases", count: countValue(openSupport), icon: LifeBuoy, detail: "Respond to open requests" },
  ];

  return (
    <>
      <div className="dashboard-top">
        <div><span className="eyebrow"><ShieldCheck size={14} /> Platform administration</span><h1>Good day, admin.</h1><p className="muted">Start with items that need a decision, then review marketplace activity below.</p></div>
        <span className="pill pill-green"><BadgeCheck size={12} /> Admin access</span>
      </div>
      {dataUnavailable ? <div className="notice error-notice" role="alert"><CircleAlert size={18} /><div><strong>Some dashboard data could not be loaded.</strong><p>Refresh this page before making an operational decision.</p></div></div> : null}

      <section className="admin-attention-section" aria-labelledby="admin-attention-title">
        <div className="dashboard-section-head"><div><span className="eyebrow">Today&apos;s work</span><h2 id="admin-attention-title">Needs your attention</h2></div><span className="pill pill-orange">{attention.reduce((total, item) => total + item.count, 0)} waiting</span></div>
        <div className="admin-attention-grid">
          {attention.map(({ href, label, count, icon: Icon, detail }) => <Link className="admin-attention-card" href={href} key={href}>
            <span className="admin-attention-icon"><Icon size={20} /></span>
            <span><strong>{count}</strong><b>{label}</b><small>{detail}</small></span>
            <ArrowRight size={17} className="admin-attention-arrow" />
          </Link>)}
        </div>
      </section>

      <div className="dashboard-section-head admin-snapshot-heading"><h2>Marketplace snapshot</h2><Link className="text-link" href="/admin/growth"><ChartNoAxesCombined size={14} /> Growth report <ArrowRight size={14} /></Link></div>
      <div className="dashboard-grid admin-summary-grid">
        <article className="stat-card"><span>Registered accounts</span><strong>{countValue(accounts)}</strong><Link href="/admin/accounts">Open accounts <ArrowRight size={13} /></Link></article>
        <article className="stat-card"><span>Approved suppliers</span><strong>{countValue(approvedBusinesses)}</strong><Link href="/admin/accounts#suppliers">Supplier directory <ArrowRight size={13} /></Link></article>
        <article className="stat-card"><span>Active orders</span><strong>{countValue(openOrders)}</strong><Link href="/admin/orders">Open orders <ArrowRight size={13} /></Link></article>
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
