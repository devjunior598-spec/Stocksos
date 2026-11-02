import Link from "next/link";
import { Archive, CircleAlert, ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminRetryRemovalProtectionAction } from "@/app/actions";

export const dynamic = "force-dynamic";

type RemovedAccount = {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  marketplace_role: string;
  removed_at: string | null;
  removal_reason: string | null;
};

export default async function RemovedRecordsPage({ searchParams }: { searchParams: Promise<{ removed?: string; protected?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [accountsResult, productsResult, mediaResult] = await Promise.all([
    supabase!.rpc("admin_removed_accounts"),
    supabase!.from("products")
      .select("id,name,business_id,removed_at,removal_reason,removed_by,businesses(name)")
      .not("removed_at", "is", null).order("removed_at", { ascending: false }).limit(100),
    supabase!.from("removal_media")
      .select("id,product_id,business_id,original_path,archived_at").order("archived_at", { ascending: false }).limit(500),
  ]);
  const accounts = accountsResult.data as RemovedAccount[] | null;
  const subjectIds = [...new Set([...(accounts ?? []).map((item) => item.id), ...(productsResult.data ?? []).map((item) => item.id)])];
  const historyResult = subjectIds.length ? await supabase!.from("record_history")
    .select("id,subject_type,subject_id,actor_id,operation,previous_record,created_at")
    .in("subject_id", subjectIds).order("created_at", { ascending: false }).limit(100)
    : { data: [], error: null };
  const unavailable = Boolean(accountsResult.error || productsResult.error || mediaResult.error || historyResult.error);
  const mediaByProduct = new Map<string, NonNullable<typeof mediaResult.data>>();
  const businessLogos = (mediaResult.data ?? []).filter((item) => Boolean(item.business_id));
  for (const item of mediaResult.data ?? []) {
    if (!item.product_id) continue;
    const list = mediaByProduct.get(item.product_id) ?? [];
    list.push(item);
    mediaByProduct.set(item.product_id, list);
  }

  return <>
    <div className="admin-page-heading"><div><span className="eyebrow"><Archive size={14} /> Removed records</span><h1>Private case records.</h1><p>Removed accounts and listings remain available to administrators for disputes, investigations and required retention. Access is restricted to administrators.</p></div><span className="pill"><ShieldCheck size={12} /> Admin only</span></div>
    {params.removed ? <div className="notice success-notice" role="status"><div><strong>Account removed from the marketplace.</strong><p>The account is blocked and its records remain in this restricted area.</p></div></div> : null}
    {params.protected ? <div className="notice success-notice" role="status"><div><strong>Protection checked.</strong><p>The account ban and public media cleanup were retried.</p></div></div> : null}
    {params.error ? <div className="notice error-notice" role="alert"><div><strong>Protection needs attention.</strong><p>The private records remain available. Retry the action or review the storage and authentication configuration.</p></div></div> : null}
    {unavailable ? <div className="notice error-notice" role="alert"><CircleAlert size={18} /><div><strong>Removed records could not be loaded.</strong><p>Check that the retention migration has been applied, then refresh.</p></div></div> : null}
    <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Removed accounts</h2><Archive size={18} /></div>
      {accounts?.length ? <div className="admin-directory">{accounts.map((account) => <article className="admin-directory-row" key={account.id}><div><strong>{account.full_name || "Account"}</strong><p className="muted small">{account.marketplace_role} · {account.email || "No email"} · {account.phone || "No phone"} · {account.id}</p><p className="small">Reason: {account.removal_reason || "Not recorded"}</p><form action={adminRetryRemovalProtectionAction}><input type="hidden" name="record_kind" value="account" /><input type="hidden" name="record_id" value={account.id} /><button className="text-link small" type="submit">Retry account ban and public media cleanup</button></form></div><small className="muted">{account.removed_at ? new Date(account.removed_at).toLocaleString("en-US") : ""}</small></article>)}</div> : <p className="muted small">No accounts have been removed.</p>}
    </section>
    <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Removed products</h2><Archive size={18} /></div>
      {productsResult.data?.length ? <div className="admin-directory">{productsResult.data.map((product) => {
        const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
        const files = mediaByProduct.get(product.id) ?? [];
        return <article className="admin-directory-row" key={product.id}><div><strong>{product.name}</strong><p className="muted small">{business?.name || "Supplier"} · {product.id}</p><p className="small">Reason: {product.removal_reason || "Not recorded"}</p>{files.length ? <p className="small">Private media: {files.map((file) => <Link className="text-link" key={file.id} href={`/admin/removed/media/${file.id}`} target="_blank" rel="noopener noreferrer">View file</Link>)}</p> : null}<form action={adminRetryRemovalProtectionAction}><input type="hidden" name="record_kind" value="product" /><input type="hidden" name="record_id" value={product.id} /><button className="text-link small" type="submit">Retry public media cleanup</button></form></div><small className="muted">{product.removed_at ? new Date(product.removed_at).toLocaleString("en-US") : ""}</small></article>;
      })}</div> : <p className="muted small">No products have been removed.</p>}
    </section>
    {businessLogos.length ? <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Retained business logos</h2><Archive size={18} /></div><div className="admin-directory">{businessLogos.map((file) => <article className="admin-directory-row" key={file.id}><div><strong>Business {file.business_id?.slice(0, 8)}</strong><p className="muted small">Archived {new Date(file.archived_at).toLocaleString("en-US")}</p></div><Link className="text-link" href={`/admin/removed/media/${file.id}`} target="_blank" rel="noopener noreferrer">View private file</Link></article>)}</div></section> : null}
    {historyResult.data?.length ? <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Previous record versions</h2><Archive size={18} /></div><p className="muted small">Recent profile and listing changes are preserved to support investigations.</p><div className="admin-directory">{historyResult.data.map((entry) => <article className="admin-directory-row" key={entry.id}><details><summary>{entry.subject_type} {entry.subject_id.slice(0, 8)} · {entry.operation.toLowerCase()} · {new Date(entry.created_at).toLocaleString("en-US")}</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(entry.previous_record, null, 2)}</pre></details></article>)}</div></section> : null}
  </>;
}
