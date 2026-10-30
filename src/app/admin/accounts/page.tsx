import { BadgeCheck, Building2, ShieldCheck, Truck, UserCheck, Users } from "lucide-react";
import { adminReviewAccountAction, adminReviewBusinessAction, adminReviewDeliveryPartnerAction } from "@/app/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AccountStatus = "pending" | "approved" | "rejected" | "suspended";

const statusPriority: Record<AccountStatus, number> = { pending: 0, rejected: 1, suspended: 2, approved: 3 };

export default async function AdminAccountsPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; error?: string; reviewed?: string }> }) {
  const params = await searchParams;
  const search = params.q?.trim().replace(/[,%()]/g, "").slice(0, 80) ?? "";
  const role = params.role === "buyer" || params.role === "supplier" ? params.role : "all";
  const status = ["pending", "approved", "rejected", "suspended"].includes(params.status ?? "") ? params.status as AccountStatus : "all";
  const supabase = await createSupabaseServerClient();

  let accountQuery = supabase!.from("profiles")
    .select("id,full_name,phone,home_city,home_country,marketplace_role,platform_role,account_status,account_review_note,account_reviewed_at,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (search) accountQuery = accountQuery.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,home_city.ilike.%${search}%`);
  if (role !== "all") accountQuery = accountQuery.eq("marketplace_role", role);
  if (status !== "all") accountQuery = accountQuery.eq("account_status", status);

  const [accountList, buyerCount, supplierCount, pendingCount, businessList, pendingBusinesses, pendingDrivers] = await Promise.all([
    accountQuery,
    supabase!.from("profiles").select("id", { count: "exact", head: true }).eq("marketplace_role", "buyer"),
    supabase!.from("profiles").select("id", { count: "exact", head: true }).eq("marketplace_role", "supplier"),
    supabase!.from("profiles").select("id", { count: "exact", head: true }).eq("account_status", "pending"),
    supabase!.from("businesses").select("id,name,slug,city,country,verification_status,visibility,created_at").order("created_at", { ascending: false }).limit(50),
    supabase!.rpc("admin_pending_businesses"),
    supabase!.from("delivery_partners").select("id,user_id,city,phone,created_at,profiles(full_name)").eq("verification_status", "pending").order("created_at").limit(30),
  ]);

  const accounts = (accountList.data ?? []).sort((a, b) => {
    const statusDifference = statusPriority[a.account_status as AccountStatus] - statusPriority[b.account_status as AccountStatus];
    return statusDifference || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const supplierApplications = (pendingBusinesses.data ?? []) as { id: string; name: string; city: string; area: string | null; phone: string | null; email: string | null; registration_number: string | null; created_at: string; category_name: string | null }[];

  return (
    <>
      <div className="admin-page-heading"><div><span className="eyebrow"><Users size={14} /> Accounts & approvals</span><h1>Review who can use the marketplace.</h1><p>Approve or reject buyer and supplier accounts, then separately verify supplier businesses before their inventory becomes public.</p></div><span className="pill pill-orange">{pendingCount.count ?? 0} pending</span></div>
      {params.error ? <div className="notice error-notice"><div><strong>The review was not saved.</strong><p>Check the account or application and try again.</p></div></div> : null}
      {params.reviewed ? <div className="notice success-notice"><div><strong>Review saved.</strong><p>The account owner was notified and the action was added to the audit log.</p></div></div> : null}

      <div className="dashboard-grid admin-account-stats">
        <article className="stat-card"><span>Buyer accounts</span><strong>{buyerCount.count ?? 0}</strong></article>
        <article className="stat-card"><span>Supplier accounts</span><strong>{supplierCount.count ?? 0}</strong></article>
        <article className="stat-card"><span>Pending account reviews</span><strong>{pendingCount.count ?? 0}</strong></article>
        <article className="stat-card"><span>Pending business reviews</span><strong>{supplierApplications.length}</strong></article>
      </div>

      <section className="panel dashboard-section">
        <div className="dashboard-section-head"><h2>Account review queue</h2><UserCheck size={18} color="#087f71" /></div>
        <form className="admin-filter-bar" action="/admin/accounts">
          <input name="q" defaultValue={search} placeholder="Search name, phone or city" aria-label="Search accounts" />
          <select name="role" defaultValue={role} aria-label="Filter by account type"><option value="all">All account types</option><option value="buyer">Buyers</option><option value="supplier">Suppliers</option></select>
          <select name="status" defaultValue={status} aria-label="Filter by review status"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select>
          <button className="button button-secondary button-small" type="submit">Apply filters</button>
        </form>
        {accounts.length ? <div className="admin-account-list">{accounts.map((account) => (
          <article className="admin-account-card" key={account.id}>
            <div className="admin-account-summary">
              <div><span className={`pill${account.account_status === "approved" ? " pill-green" : account.account_status === "rejected" || account.account_status === "suspended" ? " pill-red" : " pill-orange"}`}>{account.account_status}</span><h3>{account.full_name || "New account"}</h3><p>{account.marketplace_role} · {account.phone || "No phone"} · {[account.home_city, account.home_country].filter(Boolean).join(", ") || "Location not completed"}</p></div>
              <small>Joined {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(account.created_at))}</small>
            </div>
            {account.account_review_note ? <p className="admin-review-note"><strong>Latest review note:</strong> {account.account_review_note}</p> : null}
            {account.platform_role === "admin" ? <div className="notice"><ShieldCheck size={17} /><div><strong>Administrator account</strong><p>Administrator access cannot be changed from this review queue.</p></div></div> : <form className="admin-action-row" action={adminReviewAccountAction}><input type="hidden" name="user_id" value={account.id} /><input name="note" maxLength={500} placeholder="Optional note for the account owner" aria-label={`Review note for ${account.full_name || "account"}`} />{account.account_status !== "approved" ? <button className="button button-primary button-small" name="status" value="approved" type="submit">Approve</button> : null}{account.account_status !== "rejected" ? <button className="button button-danger button-small" name="status" value="rejected" type="submit">Reject</button> : null}{account.account_status !== "suspended" && account.account_status !== "pending" ? <button className="button button-secondary button-small" name="status" value="suspended" type="submit">Suspend</button> : null}</form>}
          </article>
        ))}</div> : <div className="empty-state"><Users className="empty-state-icon" /><h3>No matching accounts</h3><p>Try changing the role, status or search filters.</p></div>}
      </section>

      <div className="dashboard-columns admin-columns">
        <section className="panel dashboard-section" id="supplier-applications">
          <div className="dashboard-section-head"><h2>Supplier business applications</h2><Building2 size={18} color="#087f71" /></div>
          {supplierApplications.length ? <div className="admin-review-list">{supplierApplications.map((business) => <article className="admin-review-card" key={business.id}><div className="request-summary-head"><div><span className="pill pill-orange">Pending</span><h3>{business.name}</h3><p className="muted small">{[business.area, business.city].filter(Boolean).join(", ")} · {business.category_name ?? "Category"}</p></div><small className="muted">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(business.created_at))}</small></div><p className="small muted">{business.email || "No business email"} · {business.phone || "No phone"}{business.registration_number ? " · Registration: " + business.registration_number : ""}</p><form className="admin-action-row" action={adminReviewBusinessAction}><input type="hidden" name="business_id" value={business.id} /><input name="note" maxLength={500} placeholder="Optional review note" aria-label="Supplier review note" /><button className="button button-primary button-small" name="status" value="approved" type="submit">Approve supplier + business</button><button className="button button-danger button-small" name="status" value="rejected" type="submit">Reject supplier</button></form></article>)}</div> : <div className="empty-state"><BadgeCheck className="empty-state-icon" /><h3>No pending supplier applications</h3><p>New business applications will appear here.</p></div>}
        </section>
        <section className="panel dashboard-section">
          <div className="dashboard-section-head"><h2>Delivery partner applications</h2><Truck size={18} color="#087f71" /></div>
          {pendingDrivers.data?.length ? <div className="admin-review-list">{pendingDrivers.data.map((partner) => { const profile = Array.isArray(partner.profiles) ? partner.profiles[0] : partner.profiles; return <article className="admin-review-card" key={partner.id}><span className="pill pill-orange">Pending</span><h3>{profile?.full_name || "Delivery applicant"}</h3><p className="muted small">{partner.city} · {partner.phone || "No phone"}</p><form className="admin-action-row" action={adminReviewDeliveryPartnerAction}><input type="hidden" name="partner_id" value={partner.id} /><button className="button button-primary button-small" name="status" value="approved" type="submit">Approve</button><button className="button button-danger button-small" name="status" value="rejected" type="submit">Reject</button></form></article>; })}</div> : <p className="muted small">No delivery applications need review.</p>}
        </section>
      </div>

      <section className="panel dashboard-section" id="suppliers">
        <div className="dashboard-section-head"><h2>Supplier business directory</h2><Building2 size={18} color="#087f71" /></div>
        {businessList.data?.length ? <div className="admin-directory">{businessList.data.map((business) => <article className="admin-directory-row" key={business.id}><div><strong>{business.name}</strong><small>{business.city}, {business.country} · {business.visibility}</small></div><span className={`pill${business.verification_status === "approved" ? " pill-green" : business.verification_status === "rejected" || business.verification_status === "suspended" ? " pill-red" : " pill-orange"}`}>{business.verification_status}</span></article>)}</div> : <p className="muted small">No supplier businesses have been created.</p>}
      </section>
    </>
  );
}
