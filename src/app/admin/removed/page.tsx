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
type ArchivedMediaRow = {
  id: string;
  product_id: string | null;
  business_id: string | null;
  original_path: string;
  archived_at: string;
};

const pageSize = 50;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RemovedRecordsPage({ searchParams }: { searchParams: Promise<{ removed?: string; protected?: string; error?: string; page?: string; history_page?: string; record_id?: string }> }) {
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const historyPage = Math.min(10000, Math.max(1, Number.parseInt(params.history_page ?? "1", 10) || 1));
  const recordInput = params.record_id?.trim() ?? "";
  const recordId = uuidPattern.test(recordInput) ? recordInput : null;
  const invalidRecordId = Boolean(recordInput && !recordId);
  const lookupId = recordId ?? "00000000-0000-0000-0000-000000000000";
  const offset = recordId || invalidRecordId ? 0 : (page - 1) * pageSize;
  const supabase = await createSupabaseServerClient();
  let accountsQuery = supabase!.rpc("admin_removed_accounts").range(offset, offset + pageSize);
  let productsQuery = supabase!.from("products")
      .select("id,name,business_id,removed_at,removal_reason,removed_by,businesses(name)")
      .not("removed_at", "is", null).order("removed_at", { ascending: false }).range(offset, offset + pageSize);
  let logosQuery = supabase!.from("removal_media")
    .select("id,product_id,business_id,original_path,archived_at")
    .not("business_id", "is", null).order("archived_at", { ascending: false }).range(offset, offset + pageSize);
  if (recordId || invalidRecordId) {
    accountsQuery = accountsQuery.eq("id", lookupId);
    productsQuery = productsQuery.eq("id", lookupId);
    logosQuery = logosQuery.eq("business_id", lookupId);
  }
  const [accountsResult, productsResult, logosResult] = await Promise.all([
    accountsQuery, productsQuery, logosQuery,
  ]);
  const accounts = ((accountsResult.data ?? []) as RemovedAccount[]).slice(0, pageSize);
  const products = (productsResult.data ?? []).slice(0, pageSize);
  const businessLogos = (logosResult.data ?? []).slice(0, pageSize);
  const hasNextPage = !recordId && !invalidRecordId && [accountsResult.data, productsResult.data, logosResult.data]
    .some((items) => (items?.length ?? 0) > pageSize);
  const productIds = products.map((item) => item.id);
  const productMediaResult = productIds.length ? await supabase!.from("removal_media")
    .select("id,product_id,business_id,original_path,archived_at").in("product_id", productIds).limit(1000)
    : { data: [], error: null };
  const subjectIds = [...new Set([
    ...accounts.map((item) => item.id), ...productIds,
    ...products.map((item) => item.business_id),
    ...businessLogos.map((item) => item.business_id).filter((id): id is string => Boolean(id)),
  ])];
  const historyResult = subjectIds.length ? await supabase!.from("record_history")
    .select("id,subject_type,subject_id,actor_id,operation,previous_record,created_at")
    .in("subject_id", subjectIds).order("created_at", { ascending: false })
    .range((historyPage - 1) * pageSize, historyPage * pageSize)
    : { data: [], error: null };
  const history = (historyResult.data ?? []).slice(0, pageSize);
  const hasMoreHistory = (historyResult.data?.length ?? 0) > pageSize;
  const unavailable = Boolean(accountsResult.error || productsResult.error || logosResult.error || productMediaResult.error || historyResult.error || (productMediaResult.data?.length ?? 0) >= 1000);
  const mediaByProduct = new Map<string, ArchivedMediaRow[]>();
  for (const item of productMediaResult.data ?? []) {
    if (!item.product_id) continue;
    const list = mediaByProduct.get(item.product_id) ?? [];
    list.push(item);
    mediaByProduct.set(item.product_id, list);
  }
  const pageHref = (nextPage: number) => `/admin/removed?page=${nextPage}`;
  const historyHref = (nextPage: number) => {
    const query = new URLSearchParams({ history_page: String(nextPage) });
    if (recordId) query.set("record_id", recordId);
    else query.set("page", String(page));
    return `/admin/removed?${query}`;
  };

  return <>
    <div className="admin-page-heading"><div><span className="eyebrow"><Archive size={14} /> Removed records</span><h1>Private case records.</h1><p>Removed accounts and listings remain available to administrators for disputes, investigations and required retention. Access is restricted to administrators.</p></div><span className="pill"><ShieldCheck size={12} /> Admin only</span></div>
    {params.removed ? <div className="notice success-notice" role="status"><div><strong>Account removed from the marketplace.</strong><p>The account is blocked and its records remain in this restricted area.</p></div></div> : null}
    {params.protected ? <div className="notice success-notice" role="status"><div><strong>Protection checked.</strong><p>The account ban and public media cleanup were retried.</p></div></div> : null}
    {params.error ? <div className="notice error-notice" role="alert"><div><strong>Protection needs attention.</strong><p>The private records remain available. Retry the action or review the storage and authentication configuration.</p></div></div> : null}
    {unavailable ? <div className="notice error-notice" role="alert"><CircleAlert size={18} /><div><strong>Removed records could not be loaded.</strong><p>Check that the retention migration has been applied, then refresh.</p></div></div> : null}
    <form className="admin-filter-bar" action="/admin/removed">
      <input name="record_id" defaultValue={recordInput} placeholder="Account, product or business ID" aria-label="Find retained record by ID" />
      <button className="button button-secondary button-small" type="submit">Find record</button>
      {recordInput ? <Link className="text-link" href="/admin/removed">Clear search</Link> : null}
    </form>
    {invalidRecordId ? <p className="muted small" role="alert">Enter a complete record ID to search the archive.</p> : null}
    <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Removed accounts</h2><Archive size={18} /></div>
      {accounts?.length ? <div className="admin-directory">{accounts.map((account) => <article className="admin-directory-row" key={account.id}><div><strong>{account.full_name || "Account"}</strong><p className="muted small">{account.marketplace_role} · {account.email || "No email"} · {account.phone || "No phone"} · {account.id}</p><p className="small">Reason: {account.removal_reason || "Not recorded"}</p><form action={adminRetryRemovalProtectionAction}><input type="hidden" name="record_kind" value="account" /><input type="hidden" name="record_id" value={account.id} /><button className="text-link small" type="submit">Retry account ban and public media cleanup</button></form></div><small className="muted">{account.removed_at ? new Date(account.removed_at).toLocaleString("en-US") : ""}</small></article>)}</div> : <p className="muted small">No accounts have been removed.</p>}
    </section>
    <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Removed products</h2><Archive size={18} /></div>
      {products.length ? <div className="admin-directory">{products.map((product) => {
        const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
        const files = mediaByProduct.get(product.id) ?? [];
        return <article className="admin-directory-row" key={product.id}><div><strong>{product.name}</strong><p className="muted small">{business?.name || "Supplier"} · {product.id}</p><p className="small">Reason: {product.removal_reason || "Not recorded"}</p>{files.length ? <p className="small">Private media: {files.map((file) => <Link className="text-link" key={file.id} href={`/admin/removed/media/${file.id}`} target="_blank" rel="noopener noreferrer">View file</Link>)}</p> : null}<form action={adminRetryRemovalProtectionAction}><input type="hidden" name="record_kind" value="product" /><input type="hidden" name="record_id" value={product.id} /><button className="text-link small" type="submit">Retry public media cleanup</button></form></div><small className="muted">{product.removed_at ? new Date(product.removed_at).toLocaleString("en-US") : ""}</small></article>;
      })}</div> : <p className="muted small">No products have been removed.</p>}
    </section>
    {businessLogos.length ? <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Retained business logos</h2><Archive size={18} /></div><div className="admin-directory">{businessLogos.map((file) => <article className="admin-directory-row" key={file.id}><div><strong>Business {file.business_id?.slice(0, 8)}</strong><p className="muted small">Archived {new Date(file.archived_at).toLocaleString("en-US")}</p></div><Link className="text-link" href={`/admin/removed/media/${file.id}`} target="_blank" rel="noopener noreferrer">View private file</Link></article>)}</div></section> : null}
    {(history.length || historyPage > 1) ? <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Previous record versions</h2><Archive size={18} /></div><p className="muted small">Profile and listing changes for the records on this page.</p><div className="admin-directory">{history.map((entry) => <article className="admin-directory-row" key={entry.id}><details><summary>{entry.subject_type} {entry.subject_id.slice(0, 8)} · {entry.operation.toLowerCase()} · {new Date(entry.created_at).toLocaleString("en-US")}</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(entry.previous_record, null, 2)}</pre></details></article>)}</div>{historyPage > 1 || hasMoreHistory ? <nav className="admin-filter-bar" aria-label="Record history pages">{historyPage > 1 ? <Link className="button button-secondary button-small" href={historyHref(historyPage - 1)}>Newer history</Link> : null}<span className="muted small">History page {historyPage}</span>{hasMoreHistory ? <Link className="button button-secondary button-small" href={historyHref(historyPage + 1)}>Older history</Link> : null}</nav> : null}</section> : null}
    {!recordInput && (page > 1 || hasNextPage) ? <nav className="admin-filter-bar" aria-label="Removed records pages">
      {page > 1 ? <Link className="button button-secondary button-small" href={pageHref(page - 1)}>Previous page</Link> : null}
      <span className="muted small">Page {page}</span>
      {hasNextPage ? <Link className="button button-secondary button-small" href={pageHref(page + 1)}>Next page</Link> : null}
    </nav> : null}
  </>;
}
