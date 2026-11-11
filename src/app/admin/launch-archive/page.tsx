import { Archive } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LaunchArchivePage() {
  const supabase = await createSupabaseServerClient();
  const { data: records, error } = await supabase!.from("audit_logs")
    .select("id,target_id,details,created_at")
    .eq("action", "launch_store_removed")
    .order("created_at", { ascending: false });

  return <>
    <div className="admin-page-heading"><div><span className="eyebrow"><Archive size={14} /> Restricted archive</span><h1>Removed stores</h1><p>Private snapshots retained from the launch marketplace reset. These records are visible only to administrators with MFA.</p></div></div>
    <section className="panel dashboard-section">
      {error ? <div className="notice notice-error" role="alert">The archive could not be loaded. Try again.</div> : records?.length ? <div className="admin-directory">{records.map((record) => {
        const snapshot = record.details && typeof record.details === "object" && !Array.isArray(record.details) ? record.details as Record<string, unknown> : {};
        const business = snapshot.business && typeof snapshot.business === "object" && !Array.isArray(snapshot.business) ? snapshot.business as Record<string, unknown> : {};
        return <article className="admin-directory-row" key={record.id}><details><summary><strong>{typeof business.name === "string" ? business.name : "Removed store"}</strong> · {new Date(record.created_at).toLocaleString("en-US")}</summary><p className="muted small">Store ID: {record.target_id}</p><pre className="launch-archive-record">{JSON.stringify(snapshot, null, 2)}</pre></details></article>;
      })}</div> : <p className="muted small">No removed stores are archived.</p>}
    </section>
  </>;
}
