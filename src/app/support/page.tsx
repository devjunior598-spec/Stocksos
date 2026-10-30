import Link from "next/link";
import { ArrowLeft, CircleAlert, LifeBuoy, ShieldCheck } from "lucide-react";
import { updateSupportCaseStatusAction } from "@/app/actions";
import { requireSupportStaff } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "resolved" || status === "closed") return "pill pill-green";
  if (status === "in_progress") return "pill pill-orange";
  return "pill";
}

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  await requireSupportStaff();
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: cases } = await supabase!.from("support_cases")
    .select("id,user_id,order_id,subject,message,status,created_at,updated_at")
    .in("status", ["open", "in_progress"]).order("created_at", { ascending: true }).limit(50);

  return <section className="dashboard-shell"><div className="page-container">
    <Link className="text-link small" href="/admin"><ArrowLeft size={14} /> Platform admin</Link>
    <div className="dashboard-top support-top"><div><span className="eyebrow"><LifeBuoy size={14} /> Support workspace</span><h1>Support cases</h1><p className="muted">Account and marketplace requests awaiting a response.</p></div><span className="pill">{cases?.length ?? 0} open</span></div>
    {query.updated ? <div className="notice success-notice"><ShieldCheck size={17} /><div><strong>Case updated.</strong></div></div> : null}
    {query.error ? <div className="notice error-notice"><CircleAlert size={17} /><div><strong>We couldn’t update that case.</strong><p>Refresh the queue and try again.</p></div></div> : null}
    {cases?.length ? <div className="support-case-list">{cases.map((supportCase) => <article className="panel support-case" key={supportCase.id}>
      <div className="support-case-head"><div><span className={statusClass(supportCase.status)}>{supportCase.status.replaceAll("_", " ")}</span><h2>{supportCase.subject}</h2></div><time className="muted small">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(supportCase.created_at))}</time></div>
      <p className="support-case-message">{supportCase.message}</p>
      <div className="support-case-meta"><span className="small muted">Account reference: {supportCase.user_id.slice(0, 8)}{supportCase.order_id ? ` · Order ${supportCase.order_id.slice(0, 8)}` : ""}</span>
        <div className="support-case-actions">{supportCase.status === "open" ? <form action={updateSupportCaseStatusAction}><input type="hidden" name="case_id" value={supportCase.id} /><input type="hidden" name="status" value="in_progress" /><button className="button button-secondary button-small" type="submit">Start review</button></form> : null}<form action={updateSupportCaseStatusAction}><input type="hidden" name="case_id" value={supportCase.id} /><input type="hidden" name="status" value="resolved" /><button className="button button-primary button-small" type="submit">Resolve case</button></form></div>
      </div>
    </article>)}</div> : <div className="empty-state"><div className="empty-state-icon"><LifeBuoy size={22} /></div><h3>No open support cases</h3><p>New user requests will appear here.</p></div>}
  </div></section>;
}
