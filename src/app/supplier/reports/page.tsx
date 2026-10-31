import Link from "next/link";
import { ArrowLeft, BarChart3, Boxes, ClipboardCheck, DollarSign } from "lucide-react";
import { requireSupplier } from "@/lib/auth";
import { formatMoney } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupplierReportsPage() {
  const user = await requireSupplier();
  const supabase = await createSupabaseServerClient();
  const membershipResult = await supabase!.from("business_memberships").select("business_id").eq("user_id", user.id);
  const businessIds = (membershipResult.data ?? []).map((item) => item.business_id);
  const [productsResult, ordersResult, quotesResult] = businessIds.length ? await Promise.all([
    supabase!.from("products").select("id,is_active,inventory(quantity_available)").in("business_id", businessIds),
    supabase!.from("orders").select("id,status,total_kobo,currency").in("business_id", businessIds),
    supabase!.from("quotations").select("id,status").in("business_id", businessIds),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const products = (productsResult.data ?? []) as unknown as { is_active: boolean; inventory: { quantity_available: number } | { quantity_available: number }[] | null }[];
  const orders = ordersResult.data ?? [];
  const quotes = quotesResult.data ?? [];
  const activeProducts = products.filter((product) => product.is_active).length;
  const lowStock = products.filter((product) => { const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory; return product.is_active && (stock?.quantity_available ?? 0) <= 5; }).length;
  const completed = orders.filter((order) => ["completed", "delivered", "paid", "preparing", "ready_for_pickup"].includes(order.status));
  const sales = completed.reduce((sum, order) => sum + order.total_kobo, 0);
  const currency = completed[0]?.currency ?? "USD";
  return <section className="supplier-marketplace-page"><div className="page-container"><Link className="text-link marketplace-back" href="/supplier"><ArrowLeft size={15} /> Supplier workspace</Link><div className="marketplace-page-heading"><div><span className="eyebrow"><BarChart3 size={14} /> Reports</span><h1>A clear view of your supplier activity.</h1><p className="lead">Use these live marketplace numbers to decide what to restock, promote, and follow up on.</p></div></div><div className="supplier-report-grid"><article className="stat-card"><Boxes size={18} /><span>Active products</span><strong>{activeProducts}</strong><small>Listings available to buyers</small></article><article className="stat-card"><ClipboardCheck size={18} /><span>Quotes sent</span><strong>{quotes.filter((quote) => quote.status === "submitted").length}</strong><small>Open buyer offers</small></article><article className="stat-card"><DollarSign size={18} /><span>Order value</span><strong>{formatMoney(sales, currency)}</strong><small>Orders in progress or completed</small></article><article className="stat-card"><Boxes size={18} /><span>Low stock</span><strong>{lowStock}</strong><small>Active listings at 5 or fewer</small></article></div><div className="panel report-next-steps"><h2>Next actions</h2><Link href="/supplier/marketplace/new">Add a product</Link><Link href="/supplier/orders">Review orders</Link><Link href="/supplier/marketplace">Update stock or pricing</Link></div></div></section>;
}
