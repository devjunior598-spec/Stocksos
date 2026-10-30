import { Activity, ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminActivityPage() {
  const supabase = await createSupabaseServerClient();
  const { data: entries } = await supabase!.from("audit_logs")
    .select("id,action,target_type,target_id,details,created_at,profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <div className="admin-page-heading"><div><span className="eyebrow"><Activity size={14} /> Audit activity</span><h1>Trace administrative changes.</h1><p>Review recent account decisions, business approvals, support updates and platform configuration changes.</p></div><span className="pill"><ShieldCheck size={12} /> Admin only</span></div>
      <section className="panel dashboard-section">
        <div className="dashboard-section-head"><h2>Recent audit log</h2><Activity size={18} color="#087f71" /></div>
        {entries?.length ? <div className="admin-activity-list">{entries.map((entry) => {
          const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
          const details = entry.details && typeof entry.details === "object" && !Array.isArray(entry.details) ? entry.details as Record<string, unknown> : {};
          const note = typeof details.note === "string" && details.note ? details.note : null;
          return <article className="admin-activity-row" key={entry.id}><span className="order-icon"><Activity size={15} /></span><div><strong>{entry.action.replaceAll("_", " ")}</strong><p>{profile?.full_name || "Administrator"} · {entry.target_type}{entry.target_id ? ` ${entry.target_id.slice(0, 8)}` : ""}</p>{note ? <small>Note: {note}</small> : null}</div><time>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</time></article>;
        })}</div> : <div className="empty-state"><Activity className="empty-state-icon" /><h3>No admin activity yet</h3><p>Review and configuration actions will appear here.</p></div>}
      </section>
    </>
  );
}
