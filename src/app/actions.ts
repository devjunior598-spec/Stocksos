"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccountHome, getAuthenticatedUser, requireAdmin, requireBuyer, requireSupplier, requireSupportStaff, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { moneyToMinorUnits } from "@/lib/money";
import { isMarketplaceImagePathForBusiness } from "@/lib/image-path";

function value(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export async function signInAction(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: value(formData, "email").toLowerCase(),
    password: value(formData, "password"),
  });
  if (!parsed.success) redirect("/login?error=invalid");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?setup=required");
  const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=invalid");
  revalidatePath("/", "layout");
  redirect(await getAccountHome(signInData.user.id));
}

export async function signUpAction(formData: FormData) {
  const parsed = z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.email(),
    password: z.string().min(10).max(128),
    marketplaceRole: z.enum(["buyer", "supplier"]),
  }).safeParse({
    fullName: value(formData, "full_name"),
    email: value(formData, "email").toLowerCase(),
    password: value(formData, "password"),
    marketplaceRole: value(formData, "marketplace_role"),
  });
  if (!parsed.success) redirect("/register?error=invalid");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/register?setup=required");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: signUpData, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, marketplace_role: parsed.data.marketplaceRole },
      emailRedirectTo: new URL("/auth/callback?next=/onboarding", baseUrl).toString(),
    },
  });
  if (error) redirect(error.message.toLowerCase().includes("already") ? "/register?error=duplicate" : "/register?error=signup");
  if (signUpData.user && signUpData.user.identities?.length === 0) redirect("/register?error=duplicate");
  redirect("/check-email");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  if (!z.email().safeParse(email).success) redirect("/forgot-password?error=invalid");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/forgot-password?setup=required");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/auth/callback?next=/reset-password&type=recovery", baseUrl).toString(),
  });
  // Use the same response whether the account exists or not.
  redirect("/forgot-password?sent=1");
}

export async function updatePasswordAction(formData: FormData) {
  const password = value(formData, "password");
  if (!z.string().min(10).max(128).safeParse(password).success) {
    redirect("/reset-password?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/reset-password?setup=required");
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=update");
  redirect(await getAccountHome(data.claims.sub));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) redirect("/dashboard?error=logout");
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function saveOnboardingAction(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).optional(),
    city: z.string().trim().max(100).optional(),
    country: z.string().trim().length(2).regex(/^[A-Z]{2}$/).optional(),
    region: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
    area: z.string().trim().max(100).optional(),
    address: z.string().trim().max(240).optional(),
    defaultDeliveryMethod: z.enum(["pickup", "delivery", "flexible", "both"]),
  }).safeParse({
    fullName: value(formData, "full_name"),
    phone: value(formData, "phone"),
    city: value(formData, "city"),
    country: value(formData, "country").toUpperCase(),
    region: value(formData, "region"),
    postalCode: value(formData, "postal_code"),
    area: value(formData, "area"),
    address: value(formData, "address"),
    defaultDeliveryMethod: value(formData, "default_delivery_method"),
  });
  if (!parsed.success) redirect("/onboarding?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("profiles").update({
    full_name: parsed.data.fullName,
    phone: parsed.data.phone || null,
    home_city: parsed.data.city || null,
    home_country: parsed.data.country || null,
    home_region: parsed.data.region || null,
    home_postal_code: parsed.data.postalCode || null,
    home_area: parsed.data.area || null,
    home_address: parsed.data.address || null,
    default_delivery_method: parsed.data.defaultDeliveryMethod,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (error) redirect("/onboarding?error=save");
  revalidatePath("/dashboard");
  redirect(await getAccountHome(user.id));
}

export async function createBusinessApplicationAction(formData: FormData) {
  // New supplier accounts are pending until their business is reviewed, but
  // they must be able to submit the business application that starts review.
  await requireSupplier({ allowPending: true });
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    categoryId: z.uuid(),
    country: z.string().trim().length(2).regex(/^[A-Z]{2}$/),
    region: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().max(20).optional(),
    area: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(30).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    description: z.string().trim().max(1000).optional(),
    registrationNumber: z.string().trim().max(100).optional(),
  }).safeParse({
    name: value(formData, "name"),
    slug: value(formData, "slug"),
    categoryId: value(formData, "category_id"),
    country: value(formData, "country").toUpperCase(),
    region: value(formData, "region"),
    city: value(formData, "city"),
    postalCode: value(formData, "postal_code"),
    area: value(formData, "area"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    description: value(formData, "description"),
    registrationNumber: value(formData, "registration_number"),
  });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = typeof firstIssue?.path[0] === "string" ? firstIssue.path[0] : "details";
    redirect(`/become-supplier?error=invalid&field=${encodeURIComponent(field)}`);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("create_business_application", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_category_id: parsed.data.categoryId,
    p_country: parsed.data.country,
    p_region: parsed.data.region,
    p_city: parsed.data.city,
    p_postal_code: parsed.data.postalCode || null,
    p_area: parsed.data.area || null,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_description: parsed.data.description || null,
    p_registration_number: parsed.data.registrationNumber || null,
  });
  if (error) {
    if (error.code === "23505") redirect("/become-supplier?error=slug");
    if (error.code === "42501") redirect("/become-supplier?error=role");
    if (error.code === "22023") redirect("/become-supplier?error=invalid&field=details");
    redirect("/become-supplier?error=save");
  }
  revalidatePath("/supplier");
  revalidatePath("/become-supplier");
  redirect("/become-supplier?applied=1");
}

export async function createSOSAction(formData: FormData) {
  await requireBuyer();
  const parsed = z.object({
    categoryId: z.uuid(),
    productName: z.string().trim().min(2).max(180),
    quantity: z.coerce.number().int().min(1).max(1000000),
    country: z.string().trim().length(2).regex(/^[A-Z]{2}$/),
    region: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().max(20).optional(),
    area: z.string().trim().max(100).optional(),
    address: z.string().trim().max(240).optional(),
    deliveryMethod: z.enum(["pickup", "delivery", "flexible", "both"]),
    urgency: z.enum(["immediately", "within_30_minutes", "within_2_hours", "today", "scheduled"]),
    specifications: z.string().trim().max(1000).optional(),
    condition: z.enum(["new", "used", "refurbished", "any"]),
    scheduledAt: z.string().optional(),
    notes: z.string().trim().max(1000).optional(),
  }).safeParse({
    categoryId: value(formData, "category_id"),
    productName: value(formData, "product_name"),
    quantity: value(formData, "quantity"),
    country: value(formData, "country").toUpperCase(),
    region: value(formData, "region"),
    city: value(formData, "city"),
    postalCode: value(formData, "postal_code"),
    area: value(formData, "area"),
    address: value(formData, "address"),
    deliveryMethod: value(formData, "delivery_method"),
    urgency: value(formData, "urgency"),
    specifications: value(formData, "specifications"),
    condition: value(formData, "condition"),
    scheduledAt: value(formData, "scheduled_at"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success) redirect("/sos?error=invalid");
  const schedule = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  if (parsed.data.urgency === "scheduled" && (!schedule || Number.isNaN(schedule.getTime()))) {
    redirect("/sos?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const notes = [parsed.data.address ? `Delivery address: ${parsed.data.address}` : "", parsed.data.notes]
    .filter(Boolean).join("\n");
  const { data: requestId, error } = await supabase!.rpc("create_sos_request", {
    p_category_id: parsed.data.categoryId,
    p_product_name: parsed.data.productName,
    p_quantity: parsed.data.quantity,
    p_country: parsed.data.country,
    p_region: parsed.data.region,
    p_city: parsed.data.city,
    p_postal_code: parsed.data.postalCode || null,
    p_area: parsed.data.area || null,
    p_delivery_method: parsed.data.deliveryMethod,
    p_urgency: parsed.data.urgency,
    p_specifications: parsed.data.specifications || null,
    p_preferred_condition: parsed.data.condition,
    p_scheduled_at: schedule?.toISOString() ?? null,
    p_notes: notes || null,
    p_photo_path: null,
  });
  if (error || !requestId) redirect("/sos?error=save");
  revalidatePath("/dashboard");
  redirect("/dashboard?request=created");
}

export async function cancelSOSAction(formData: FormData) {
  await requireBuyer();
  const id = value(formData, "request_id");
  if (!z.uuid().safeParse(id).success) redirect("/dashboard?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("cancel_sos_request", { p_request_id: id });
  if (error) redirect("/dashboard?error=cancel");
  revalidatePath("/dashboard");
  redirect("/dashboard?request=cancelled");
}

export async function submitQuotationAction(formData: FormData) {
  await requireSupplier();
  const parsed = z.object({
    requestId: z.uuid(),
    businessId: z.uuid(),
    productId: z.union([z.uuid(), z.literal("")]),
    price: z.string().trim(),
    quantity: z.coerce.number().int().min(1).max(1000000),
    deliveryFee: z.string().trim(),
    deliveryAvailable: z.enum(["yes", "no"]),
    preparationMinutes: z.string().trim(),
    note: z.string().trim().max(500).optional(),
  }).safeParse({
    requestId: value(formData, "request_id"),
    businessId: value(formData, "business_id"),
    productId: value(formData, "product_id"),
    price: value(formData, "price"),
    quantity: value(formData, "quantity"),
    deliveryFee: value(formData, "delivery_fee") || "0",
    deliveryAvailable: value(formData, "delivery_available"),
    preparationMinutes: value(formData, "preparation_minutes"),
    note: value(formData, "note"),
  });
  const priceKobo = parsed.success ? moneyToMinorUnits(parsed.data.price) : null;
  const deliveryFeeKobo = parsed.success
    ? (parsed.data.deliveryFee === "0" ? 0 : moneyToMinorUnits(parsed.data.deliveryFee, true))
    : null;
  const preparation = parsed.success && parsed.data.preparationMinutes
    ? Number(parsed.data.preparationMinutes)
    : null;
  if (!parsed.success || !priceKobo || deliveryFeeKobo === null
    || (preparation !== null && (!Number.isInteger(preparation) || preparation < 0 || preparation > 10080))) {
    redirect("/supplier?error=quote");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("submit_quotation", {
    p_request_id: parsed.data.requestId,
    p_business_id: parsed.data.businessId,
    p_product_id: parsed.data.productId || null,
    p_unit_price_kobo: priceKobo,
    p_quantity_offered: parsed.data.quantity,
    p_delivery_fee_kobo: deliveryFeeKobo,
    p_delivery_available: parsed.data.deliveryAvailable === "yes",
    p_preparation_minutes: preparation,
    p_note: parsed.data.note || null,
  });
  if (error) redirect("/supplier?error=quote");
  revalidatePath("/supplier");
  revalidatePath("/dashboard");
  redirect("/supplier?quote=sent");
}

export async function acceptQuotationAction(formData: FormData) {
  await requireBuyer();
  const id = value(formData, "quotation_id");
  if (!z.uuid().safeParse(id).success) redirect("/dashboard?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { data: orderId, error } = await supabase!.rpc("accept_quotation", { p_quotation_id: id });
  if (error || !orderId) redirect("/dashboard?error=accept");
  revalidatePath("/dashboard");
  redirect("/orders/" + orderId);
}

export async function createSupplierProductAction(formData: FormData) {
  await requireSupplier();
  const parsed = z.object({
    businessId: z.uuid(),
    categoryId: z.uuid(),
    name: z.string().trim().min(2).max(180),
    brand: z.string().trim().max(120).optional(),
    specifications: z.string().trim().max(1000).optional(),
    condition: z.enum(["new", "used", "refurbished"]),
    quantity: z.coerce.number().int().min(0).max(1000000),
    price: z.string().trim(),
    visibility: z.enum(["public", "private"]),
    imagePath: z.string().trim().max(200).optional(),
  }).safeParse({
    businessId: value(formData, "business_id"),
    categoryId: value(formData, "category_id"),
    name: value(formData, "name"),
    brand: value(formData, "brand"),
    specifications: value(formData, "specifications"),
    condition: value(formData, "condition"),
    quantity: value(formData, "quantity"),
    price: value(formData, "price") || "0",
    visibility: value(formData, "visibility"),
    imagePath: value(formData, "image_path"),
  });
  const unitPriceKobo = parsed.success ? moneyToMinorUnits(parsed.data.price, true) : null;
  if (!parsed.success || unitPriceKobo === null
    || (parsed.data.imagePath && !isMarketplaceImagePathForBusiness(parsed.data.imagePath, parsed.data.businessId))) {
    redirect("/supplier?error=product");
  }
  const supabase = await createSupabaseServerClient();
  const { data: productId, error } = await supabase!.rpc("create_supplier_product", {
    p_business_id: parsed.data.businessId,
    p_category_id: parsed.data.categoryId,
    p_name: parsed.data.name,
    p_brand: parsed.data.brand || null,
    p_specifications: parsed.data.specifications || null,
    p_condition: parsed.data.condition,
    p_quantity: parsed.data.quantity,
    p_unit_price_kobo: unitPriceKobo,
    p_visibility: parsed.data.visibility,
  });
  if (error || !productId) redirect("/supplier?error=product");
  if (parsed.data.imagePath) {
    const { error: imageError } = await supabase!.from("products")
      .update({ image_path: parsed.data.imagePath }).eq("id", productId).eq("business_id", parsed.data.businessId);
    if (imageError) redirect("/supplier?product=created&image=error");
  }
  revalidatePath("/supplier");
  redirect("/supplier?product=created");
}

export async function updateSupplierProductAction(formData: FormData) {
  await requireSupplier();
  const parsed = z.object({
    productId: z.uuid(),
    name: z.string().trim().min(2).max(180),
    brand: z.string().trim().max(120).optional(),
    specifications: z.string().trim().max(1000).optional(),
    condition: z.enum(["new", "used", "refurbished"]),
    quantity: z.coerce.number().int().min(0).max(1000000),
    price: z.string().trim(),
    visibility: z.enum(["public", "private"]),
    isActive: z.enum(["yes", "no"]),
    imagePath: z.string().trim().max(200).optional(),
  }).safeParse({
    productId: value(formData, "product_id"),
    name: value(formData, "name"),
    brand: value(formData, "brand"),
    specifications: value(formData, "specifications"),
    condition: value(formData, "condition"),
    quantity: value(formData, "quantity"),
    price: value(formData, "price"),
    visibility: value(formData, "visibility"),
    isActive: value(formData, "is_active"),
    imagePath: value(formData, "image_path"),
  });
  const priceKobo = parsed.success ? moneyToMinorUnits(parsed.data.price, true) : null;
  if (!parsed.success || priceKobo === null) redirect("/supplier?error=product");
  const supabase = await createSupabaseServerClient();
  const { data: currentProduct } = await supabase!.from("products")
    .select("business_id,image_path").eq("id", parsed.data.productId).maybeSingle();
  if (!currentProduct || (parsed.data.imagePath
    && !isMarketplaceImagePathForBusiness(parsed.data.imagePath, currentProduct.business_id))) {
    redirect("/supplier?error=product");
  }
  const { error } = await supabase!.rpc("update_supplier_product", {
    p_product_id: parsed.data.productId,
    p_name: parsed.data.name,
    p_brand: parsed.data.brand || null,
    p_specifications: parsed.data.specifications || null,
    p_condition: parsed.data.condition,
    p_quantity_available: parsed.data.quantity,
    p_unit_price_kobo: priceKobo,
    p_visibility: parsed.data.visibility,
    p_is_active: parsed.data.isActive === "yes",
  });
  if (error) redirect("/supplier?error=product");
  const nextImagePath = parsed.data.imagePath || null;
  const { error: imageError } = await supabase!.from("products")
    .update({ image_path: nextImagePath }).eq("id", parsed.data.productId).eq("business_id", currentProduct.business_id);
  if (imageError) redirect("/supplier?product=updated&image=error");
  if (currentProduct.image_path && currentProduct.image_path !== nextImagePath) {
    await supabase!.storage.from("marketplace-images").remove([currentProduct.image_path]);
  }
  revalidatePath("/supplier");
  revalidatePath("/find-stock");
  revalidatePath("/business/[slug]", "page");
  redirect("/supplier?product=updated");
}

export async function deleteSupplierProductAction(formData: FormData) {
  const user = await requireSupplier();
  const productId = value(formData, "product_id");
  if (!z.uuid().safeParse(productId).success) redirect("/supplier?error=product");
  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase!.from("products")
    .select("business_id,image_path").eq("id", productId).maybeSingle();
  if (!product) redirect("/supplier?error=product");
  const { data: membership } = await supabase!.from("business_memberships")
    .select("role").eq("business_id", product.business_id).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) redirect("/supplier?error=delete");

  const references = await Promise.all([
    supabase!.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", productId),
    supabase!.from("quotations").select("id", { count: "exact", head: true }).eq("product_id", productId),
    supabase!.from("stock_reservations").select("id", { count: "exact", head: true }).eq("product_id", productId),
  ]);
  const hasHistory = references.some((reference) => reference.error || (reference.count ?? 0) > 0);
  if (hasHistory) {
    const { error } = await supabase!.from("products").update({ is_active: false, visibility: "private" }).eq("id", productId);
    if (error) redirect("/supplier?error=delete");
    revalidatePath("/supplier");
    revalidatePath("/find-stock");
    revalidatePath("/suppliers");
    redirect("/supplier?product=archived");
  }

  const { error } = await supabase!.from("products").delete().eq("id", productId);
  if (error) {
    const { error: archiveError } = await supabase!.from("products")
      .update({ is_active: false, visibility: "private" }).eq("id", productId);
    if (archiveError) redirect("/supplier?error=delete");
    revalidatePath("/supplier");
    revalidatePath("/find-stock");
    revalidatePath("/suppliers");
    redirect("/supplier?product=archived");
  }
  if (product.image_path) await supabase!.storage.from("marketplace-images").remove([product.image_path]);
  revalidatePath("/supplier");
  revalidatePath("/find-stock");
  revalidatePath("/suppliers");
  revalidatePath("/business/[slug]", "page");
  redirect("/supplier?product=deleted");
}

export async function adminReviewBusinessAction(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "business_id");
  const status = value(formData, "status");
  const note = value(formData, "note");
  if (!z.uuid().safeParse(id).success || !["approved", "rejected", "suspended"].includes(status)) {
    redirect("/admin/accounts?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("admin_review_business", {
    p_business_id: id,
    p_status: status,
    p_note: note || null,
  });
  if (error) redirect("/admin/accounts?error=review");
  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  revalidatePath("/suppliers");
  redirect("/admin/accounts?reviewed=business");
}

export async function adminReviewAccountAction(formData: FormData) {
  await requireAdmin();
  const userId = value(formData, "user_id");
  const status = value(formData, "status");
  const note = value(formData, "note");
  if (!z.uuid().safeParse(userId).success || !["approved", "rejected", "suspended"].includes(status)) {
    redirect("/admin/accounts?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("admin_review_account", {
    p_user_id: userId,
    p_status: status,
    p_note: note || null,
  });
  if (error) redirect("/admin/accounts?error=account");
  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  redirect("/admin/accounts?reviewed=account");
}

export async function applyDeliveryPartnerAction(formData: FormData) {
  await requireUser();
  const parsed = z.object({
    city: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(30).optional(),
  }).safeParse({ city: value(formData, "city"), phone: value(formData, "phone") });
  if (!parsed.success) redirect("/delivery?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("apply_delivery_partner", {
    p_city: parsed.data.city,
    p_phone: parsed.data.phone || null,
  });
  if (error) redirect("/delivery?error=application");
  revalidatePath("/delivery");
  redirect("/delivery?applied=1");
}

export async function adminReviewDeliveryPartnerAction(formData: FormData) {
  await requireAdmin();
  const partnerId = value(formData, "partner_id");
  const status = value(formData, "status");
  if (!z.uuid().safeParse(partnerId).success || !["approved", "rejected", "suspended"].includes(status)) {
    redirect("/admin/accounts?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("admin_review_delivery_partner", {
    p_partner_id: partnerId,
    p_status: status,
  });
  if (error) redirect("/admin/accounts?error=review");
  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  revalidatePath("/delivery");
  redirect("/admin/accounts?reviewed=delivery");
}

export async function adminUpdatePlanAction(formData: FormData) {
  await requireAdmin();
  const planId = value(formData, "plan_id");
  const price = value(formData, "price");
  const benefits = value(formData, "benefits").split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 12);
  const isActive = value(formData, "is_active") === "yes";
  const monthlyPriceKobo = price === "0" ? 0 : moneyToMinorUnits(price, true);
  if (!/^[a-z0-9-]{2,60}$/.test(planId) || monthlyPriceKobo === null || benefits.some((item) => item.length > 120)) {
    redirect("/admin/settings?error=plan");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("admin_update_subscription_plan", {
    p_plan_id: planId,
    p_monthly_price_kobo: monthlyPriceKobo,
    p_benefits: benefits,
    p_is_active: isActive,
  });
  if (error) redirect("/admin/settings?error=plan");
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/pricing");
  redirect("/admin/settings?plan=updated");
}

export async function adminUpdateMarketplaceFeeAction(formData: FormData) {
  await requireAdmin();
  const fee = value(formData, "fee_percent");
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(fee)) redirect("/admin/settings?error=fee");
  const feeBps = Math.round(Number(fee) * 100);
  if (!Number.isSafeInteger(feeBps) || feeBps > 2000) redirect("/admin/settings?error=fee");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("admin_update_marketplace_fee", { p_fee_bps: feeBps });
  if (error) redirect("/admin/settings?error=fee");
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?fee=updated");
}

export async function updateSupplierOrderStatusAction(formData: FormData) {
  await requireSupplier();
  const orderId = value(formData, "order_id");
  const status = value(formData, "status");
  if (!z.uuid().safeParse(orderId).success || !["preparing", "ready_for_pickup"].includes(status)) {
    redirect("/supplier?error=order");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("update_supplier_order_status", { p_order_id: orderId, p_status: status });
  if (error) redirect("/supplier?error=order");
  revalidatePath("/supplier");
  revalidatePath("/dashboard");
  revalidatePath("/delivery");
  redirect("/supplier?order=updated");
}

export async function acceptDeliveryJobAction(formData: FormData) {
  await requireUser();
  const deliveryId = value(formData, "delivery_id");
  if (!z.uuid().safeParse(deliveryId).success) redirect("/delivery?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("accept_delivery_job", { p_delivery_id: deliveryId });
  if (error) redirect("/delivery?error=job");
  revalidatePath("/delivery");
  redirect("/delivery?job=accepted");
}

export async function updateDeliveryJobStatusAction(formData: FormData) {
  await requireUser();
  const deliveryId = value(formData, "delivery_id");
  const status = value(formData, "status");
  if (!z.uuid().safeParse(deliveryId).success || !["picked_up", "in_transit", "delivered"].includes(status)) {
    redirect("/delivery?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("update_delivery_job_status", { p_delivery_id: deliveryId, p_status: status });
  if (error) redirect("/delivery?error=status");
  revalidatePath("/delivery");
  revalidatePath("/dashboard");
  revalidatePath("/supplier");
  redirect("/delivery?updated=1");
}

export async function buyerConfirmReceiptAction(formData: FormData) {
  await requireBuyer();
  const orderId = value(formData, "order_id");
  if (!z.uuid().safeParse(orderId).success) redirect("/dashboard?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("buyer_confirm_receipt", { p_order_id: orderId });
  if (error) redirect("/orders/" + orderId + "?error=receipt");
  revalidatePath("/dashboard");
  redirect("/orders/" + orderId + "?received=1");
}

export async function createSupportCaseAction(formData: FormData) {
  // Pending or rejected applicants must still be able to contact support.
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=%2Fcontact");
  const orderId = value(formData, "order_id");
  const parsed = z.object({
    subject: z.string().trim().min(3).max(160),
    message: z.string().trim().min(10).max(5000),
  }).safeParse({ subject: value(formData, "subject"), message: value(formData, "message") });
  if (!parsed.success || (orderId && !z.uuid().safeParse(orderId).success)) redirect("/contact?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("support_cases").insert({
    user_id: user.id,
    order_id: orderId || null,
    subject: parsed.data.subject,
    message: parsed.data.message,
  });
  if (error) redirect("/contact?error=save");
  revalidatePath("/admin");
  revalidatePath("/admin/support");
  redirect("/contact?sent=1");
}

export async function createBusinessEnquiryAction(formData: FormData) {
  await requireBuyer();
  const parsed = z.object({
    businessId: z.uuid(),
    productName: z.string().trim().min(2).max(180),
    quantity: z.coerce.number().int().min(1).max(1000000),
    consentToReferral: z.boolean(),
  }).safeParse({
    businessId: value(formData, "business_id"),
    productName: value(formData, "product_name"),
    quantity: value(formData, "quantity"),
    consentToReferral: value(formData, "consent_to_referral") === "yes",
  });
  if (!parsed.success) redirect("?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("create_business_enquiry", {
    p_business_id: parsed.data.businessId,
    p_product_name: parsed.data.productName,
    p_quantity: parsed.data.quantity,
    p_consent_to_referral: parsed.data.consentToReferral,
  });
  if (error) redirect("?error=send");
  revalidatePath("/supplier");
  redirect("?enquiry=sent");
}

export async function updateBusinessEnquiryStatusAction(formData: FormData) {
  await requireSupplier();
  const enquiryId = value(formData, "enquiry_id");
  const status = value(formData, "status");
  if (!z.uuid().safeParse(enquiryId).success || !["sourcing", "referred", "closed"].includes(status)) {
    redirect("?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("update_business_enquiry_status", {
    p_enquiry_id: enquiryId,
    p_status: status,
  });
  if (error) redirect("?error=update");
  revalidatePath("/supplier");
  revalidatePath("/business");
  redirect("?updated=1");
}

export async function saveSupplierAction(formData: FormData) {
  const user = await requireBuyer();
  const businessId = value(formData, "business_id");
  const slug = value(formData, "slug");
  const intent = value(formData, "intent");
  if (!z.uuid().safeParse(businessId).success || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || !["save", "remove"].includes(intent)) redirect("/suppliers?error=invalid");
  const supabase = await createSupabaseServerClient();
  const result = intent === "save"
    ? await supabase!.from("saved_suppliers").upsert({ buyer_id: user.id, business_id: businessId }, { onConflict: "buyer_id,business_id" })
    : await supabase!.from("saved_suppliers").delete().eq("buyer_id", user.id).eq("business_id", businessId);
  if (result.error) redirect("/business/" + slug + "?error=save");
  revalidatePath("/business/" + slug);
  revalidatePath("/saved-suppliers");
  redirect("/business/" + slug + (intent === "save" ? "?saved=1" : "?saved=0"));
}

export async function updateSupportCaseStatusAction(formData: FormData) {
  await requireSupportStaff();
  const caseId = value(formData, "case_id");
  const status = value(formData, "status");
  const returnTo = value(formData, "return_to");
  const destination = returnTo === "/admin/support" ? "/admin/support" : "/support";
  if (!z.uuid().safeParse(caseId).success || !["open", "in_progress", "resolved", "closed"].includes(status)) {
    redirect(destination + "?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("update_support_case_status", { p_case_id: caseId, p_status: status });
  if (error) redirect(destination + "?error=update");
  revalidatePath("/support");
  revalidatePath("/admin");
  revalidatePath("/admin/support");
  redirect(destination + "?updated=1");
}

export async function markNotificationReadAction(formData: FormData) {
  await requireUser();
  const id = value(formData, "notification_id");
  const returnTo = value(formData, "return_to");
  const destination = returnTo === "/supplier" ? "/supplier" : "/dashboard";
  if (!z.uuid().safeParse(id).success) redirect(destination + "?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect(destination + "?error=notification");
  revalidatePath("/dashboard");
  revalidatePath("/supplier");
  redirect(destination);
}

export async function createOrderDisputeAction(formData: FormData) {
  await requireBuyer();
  const parsed = z.object({
    orderId: z.uuid(),
    caseType: z.enum(["cancellation", "refund", "missing_item", "incorrect_product", "damaged_product", "supplier_non_fulfilment"]),
    message: z.string().trim().min(10).max(5000),
  }).safeParse({
    orderId: value(formData, "order_id"),
    caseType: value(formData, "case_type"),
    message: value(formData, "message"),
  });
  if (!parsed.success) redirect("/dashboard?error=case");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("create_order_dispute", {
    p_order_id: parsed.data.orderId,
    p_case_type: parsed.data.caseType,
    p_message: parsed.data.message,
    p_evidence_paths: [],
  });
  if (error) redirect("/orders/" + parsed.data.orderId + "?error=case");
  revalidatePath("/orders/" + parsed.data.orderId);
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirect("/orders/" + parsed.data.orderId + "?case=created");
}

export async function createOrderReviewAction(formData: FormData) {
  await requireBuyer();
  const parsed = z.object({
    orderId: z.uuid(),
    productAccuracy: z.coerce.number().int().min(1).max(5),
    communication: z.coerce.number().int().min(1).max(5),
    fulfilment: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(1000),
  }).safeParse({
    orderId: value(formData, "order_id"),
    productAccuracy: value(formData, "product_accuracy"),
    communication: value(formData, "communication"),
    fulfilment: value(formData, "fulfilment"),
    comment: value(formData, "comment"),
  });
  if (!parsed.success) redirect("/dashboard?error=review");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("create_order_review", {
    p_order_id: parsed.data.orderId,
    p_product_accuracy: parsed.data.productAccuracy,
    p_communication: parsed.data.communication,
    p_fulfilment: parsed.data.fulfilment,
    p_comment: parsed.data.comment || null,
  });
  if (error) redirect("/orders/" + parsed.data.orderId + "?error=review");
  revalidatePath("/orders/" + parsed.data.orderId);
  redirect("/orders/" + parsed.data.orderId + "?review=created");
}
