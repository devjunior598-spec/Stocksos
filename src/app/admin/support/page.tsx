import { CircleAlert, LifeBuoy, ShieldCheck } from "lucide-react";
import { updateSupportCaseStatusAction } from "@/app/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supportStatuses = ["open", "in_progress", "resolved", "closed"] as const;

function statusClass(status: string) {
  if (status === "resolved" || status === "closed") return "pill pill-green";
  if (status === "in_progress") return "pill pill-orange";
  return "pill";
}

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string; updated?: string }> }) {
  const params = await searchParams;
  const status = supportStatuses.includes(params.status as (typeof supportStatuses)[number]) ? params.status! : "active";
  const supabase = await createSupabaseServerClient();
  let casesQuery = supabase!.from("support_cases")
    .select("id,user_id,order_id,subject,message,status,case_type,created_at,updated_at,profiles(full_name)")
    .order("created_at", { ascending: status !== "active" })
    .limit(100);
  casesQuery = status === "active" ? casesQuery.in("status", ["open", "in_progress"]) : casesQuery.eq("status", status);

  const [casesResult, openCount, progressCount, resolvedCount] = await Promise.all([
    casesQuery,
    supabase!.from("support_cases").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase!.from("support_cases").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase!.from("support_cases").select("id", { count: "exact", head: true }).eq("status", "resolved"),
  ]);
  const supportCases = casesResult.data ?? [];

  return (
    <>
      <div className="admin-page-heading"><div><span className="eyebrow"><LifeBuoy size={14} /> Support center</span><h1>Resolve customer cases.</h1><p>Review marketplace and account requests, track ownership and close resolved cases.</p></div><span className="pill pill-orange">{(openCount.count ?? 0) + (progressCount.count ?? 0)} active</span></div>
      {params.updated ? <div className="notice success-notice"><ShieldCheck size={17} /><div><strong>Case updated.</strong><p>The status change was saved and audited.</p></div></div> : null}
      {params.error ? <div className="notice error-notice"><CircleAlert size={17} /><div><strong>We couldn’t update that case.</strong><p>Refresh the queue and try again.</p></div></div> : null}

      <div className="dashboard-grid admin-account-stats">
        <article className="stat-card"><span>Open</span><strong>{openCount.count ?? 0}</strong></article>
        <article className="stat-card"><span>In progress</span><strong>{progressCount.count ?? 0}</strong></article>
        <article className="stat-card"><span>Resolved</span><strong>{resolvedCount.count ?? 0}</strong></article>
      </div>

      <section className="panel dashboard-section">
        <div className="dashboard-section-head"><h2>Support queue</h2><LifeBuoy size={18} color="#087f71" /></div>
        <form className="admin-filter-bar" action="/admin/support">
          <select name="status" defaultValue={status} aria-label="Filter support cases by status"><option value="active">Active cases</option>{supportStatuses.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select>
          <button className="button button-secondary button-small" type="submit">Apply filter</button>
        </form>
        {supportCases.length ? <div className="support-case-list">{supportCases.map((supportCase) => {
          const profile = Array.isArray(supportCase.profiles) ? supportCase.profiles[0] : supportCase.profiles;
          return <article className="support-case admin-support-case" key={supportCase.id}>
            <div className="support-case-head"><div><span className={statusClass(supportCase.status)}>{supportCase.status.replaceAll("_", " ")}</span><h2>{supportCase.subject}</h2><p className="muted small">{profile?.full_name || `Account ${supportCase.user_id.slice(0, 8)}`} · {supportCase.case_type?.replaceAll("_", " ") || "general"}</p></div><time className="muted small">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(supportCase.created_at))}</time></div>
            <p className="support-case-message">{supportCase.message}</p>
            <div className="support-case-meta"><span className="small muted">{supportCase.order_id ? `Order ${supportCase.order_id.slice(0, 8)} · ` : ""}Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(supportCase.updated_at))}</span><div className="support-case-actions">
              {supportCase.status !== "in_progress" ? <form action={updateSupportCaseStatusAction}><input type="hidden" name="case_id" value={supportCase.id} /><input type="hidden" name="return_to" value="/admin/support" /><button className="button button-secondary button-small" name="status" value="in_progress" type="submit">Start review</button></form> : null}
              {supportCase.status !== "resolved" ? <form action={updateSupportCaseStatusAction}><input type="hidden" name="case_id" value={supportCase.id} /><input type="hidden" name="return_to" value="/admin/support" /><button className="button button-primary button-small" name="status" value="resolved" type="submit">Resolve</button></form> : null}
              {supportCase.status !== "closed" ? <form action={updateSupportCaseStatusAction}><input type="hidden" name="case_id" value={supportCase.id} /><input type="hidden" name="return_to" value="/admin/support" /><button className="button button-secondary button-small" name="status" value="closed" type="submit">Close</button></form> : null}
            </div></div>
          </article>;
        })}</div> : <div className="empty-state"><LifeBuoy className="empty-state-icon" /><h3>No support cases match this filter</h3><p>New customer requests will appear here.</p></div>}
      </section>
    </>
  );
}
