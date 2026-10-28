"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { nairaToKobo } from "@/lib/money";

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
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=invalid");
  const next = value(formData, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signUpAction(formData: FormData) {
  const parsed = z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.email(),
    password: z.string().min(10).max(128),
  }).safeParse({
    fullName: value(formData, "full_name"),
    email: value(formData, "email").toLowerCase(),
    password: value(formData, "password"),
  });
  if (!parsed.success) redirect("/register?error=invalid");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/register?setup=required");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: new URL("/auth/callback?next=/onboarding", baseUrl).toString(),
    },
  });
  if (error) redirect("/register?error=signup");
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
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}

export async function saveOnboardingAction(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).optional(),
    city: z.string().trim().max(100).optional(),
  }).safeParse({
    fullName: value(formData, "full_name"),
    phone: value(formData, "phone"),
    city: value(formData, "city"),
  });
  if (!parsed.success) redirect("/onboarding?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("profiles").update({
    full_name: parsed.data.fullName,
    phone: parsed.data.phone || null,
    home_city: parsed.data.city || null,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (error) redirect("/onboarding?error=save");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createBusinessApplicationAction(formData: FormData) {
  await requireUser();
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    categoryId: z.uuid(),
    city: z.string().trim().min(2).max(100),
    area: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(30).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    description: z.string().trim().max(1000).optional(),
    registrationNumber: z.string().trim().max(100).optional(),
  }).safeParse({
    name: value(formData, "name"),
    slug: value(formData, "slug"),
    categoryId: value(formData, "category_id"),
    city: value(formData, "city"),
    area: value(formData, "area"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    description: value(formData, "description"),
    registrationNumber: value(formData, "registration_number"),
  });
  if (!parsed.success) redirect("/become-supplier?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("create_business_application", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_category_id: parsed.data.categoryId,
    p_city: parsed.data.city,
    p_area: parsed.data.area || null,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_description: parsed.data.description || null,
    p_registration_number: parsed.data.registrationNumber || null,
  });
  if (error) redirect(error.code === "23505" ? "/become-supplier?error=slug" : "/become-supplier?error=save");
  revalidatePath("/supplier");
  redirect("/supplier?applied=1");
}

export async function createSOSAction(formData: FormData) {
  await requireUser();
  const parsed = z.object({
    categoryId: z.uuid(),
    productName: z.string().trim().min(2).max(180),
    quantity: z.coerce.number().int().min(1).max(1000000),
    city: z.string().trim().min(2).max(100),
    area: z.string().trim().max(100).optional(),
    deliveryMethod: z.enum(["pickup", "delivery", "flexible"]),
    urgency: z.enum(["immediately", "within_30_minutes", "within_2_hours", "today", "scheduled"]),
    specifications: z.string().trim().max(1000).optional(),
    condition: z.enum(["new", "used", "refurbished", "any"]),
    scheduledAt: z.string().optional(),
    notes: z.string().trim().max(1000).optional(),
  }).safeParse({
    categoryId: value(formData, "category_id"),
    productName: value(formData, "product_name"),
    quantity: value(formData, "quantity"),
    city: value(formData, "city"),
    area: value(formData, "area"),
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
  const { data: requestId, error } = await supabase!.rpc("create_sos_request", {
    p_category_id: parsed.data.categoryId,
    p_product_name: parsed.data.productName,
    p_quantity: parsed.data.quantity,
    p_city: parsed.data.city,
    p_area: parsed.data.area || null,
    p_delivery_method: parsed.data.deliveryMethod,
    p_urgency: parsed.data.urgency,
    p_specifications: parsed.data.specifications || null,
    p_preferred_condition: parsed.data.condition,
    p_scheduled_at: schedule?.toISOString() ?? null,
    p_notes: parsed.data.notes || null,
    p_photo_path: null,
  });
  if (error || !requestId) redirect("/sos?error=save");
  revalidatePath("/dashboard");
  redirect("/dashboard?request=created");
}

export async function cancelSOSAction(formData: FormData) {
  await requireUser();
  const id = value(formData, "request_id");
  if (!z.uuid().safeParse(id).success) redirect("/dashboard?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("cancel_sos_request", { p_request_id: id });
  if (error) redirect("/dashboard?error=cancel");
  revalidatePath("/dashboard");
  redirect("/dashboard?request=cancelled");
}

export async function submitQuotationAction(formData: FormData) {
  await requireUser();
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
  const priceKobo = parsed.success ? nairaToKobo(parsed.data.price) : null;
  const deliveryFeeKobo = parsed.success
    ? (parsed.data.deliveryFee === "0" ? 0 : nairaToKobo(parsed.data.deliveryFee, true))
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
  await requireUser();
  const id = value(formData, "quotation_id");
  if (!z.uuid().safeParse(id).success) redirect("/dashboard?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { data: orderId, error } = await supabase!.rpc("accept_quotation", { p_quotation_id: id });
  if (error || !orderId) redirect("/dashboard?error=accept");
  revalidatePath("/dashboard");
  redirect("/orders/" + orderId);
}

export async function createSupplierProductAction(formData: FormData) {
  await requireUser();
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
  });
  const unitPriceKobo = parsed.success ? nairaToKobo(parsed.data.price, true) : null;
  if (!parsed.success || unitPriceKobo === null) redirect("/supplier?error=product");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("create_supplier_product", {
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
  if (error) redirect("/supplier?error=product");
  revalidatePath("/supplier");
  redirect("/supplier?product=created");
}

export async function updateSupplierProductAction(formData: FormData) {
  await requireUser();
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
  });
  const priceKobo = parsed.success ? nairaToKobo(parsed.data.price, true) : null;
  if (!parsed.success || priceKobo === null) redirect("/supplier?error=product");
  const supabase = await createSupabaseServerClient();
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
  revalidatePath("/supplier");
  revalidatePath("/find-stock");
  redirect("/supplier?product=updated");
}

export async function adminReviewBusinessAction(formData: FormData) {
  await requireUser();
  const id = value(formData, "business_id");
  const status = value(formData, "status");
  const note = value(formData, "note");
  if (!z.uuid().safeParse(id).success || !["approved", "rejected", "suspended"].includes(status)) {
    redirect("/admin?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("admin_review_business", {
    p_business_id: id,
    p_status: status,
    p_note: note || null,
  });
  if (error) redirect("/admin?error=review");
  revalidatePath("/admin");
  revalidatePath("/suppliers");
  redirect("/admin?reviewed=1");
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
  await requireUser();
  const partnerId = value(formData, "partner_id");
  const status = value(formData, "status");
  if (!z.uuid().safeParse(partnerId).success || !["approved", "rejected", "suspended"].includes(status)) {
    redirect("/admin?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("admin_review_delivery_partner", {
    p_partner_id: partnerId,
    p_status: status,
  });
  if (error) redirect("/admin?error=review");
  revalidatePath("/admin");
  revalidatePath("/delivery");
  redirect("/admin?reviewed=1");
}

export async function adminUpdatePlanAction(formData: FormData) {
  await requireUser();
  const planId = value(formData, "plan_id");
  const price = value(formData, "price");
  const benefits = value(formData, "benefits").split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 12);
  const isActive = value(formData, "is_active") === "yes";
  const monthlyPriceKobo = price === "0" ? 0 : nairaToKobo(price, true);
  if (!/^[a-z0-9-]{2,60}$/.test(planId) || monthlyPriceKobo === null || benefits.some((item) => item.length > 120)) {
    redirect("/admin?error=plan");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("admin_update_subscription_plan", {
    p_plan_id: planId,
    p_monthly_price_kobo: monthlyPriceKobo,
    p_benefits: benefits,
    p_is_active: isActive,
  });
  if (error) redirect("/admin?error=plan");
  revalidatePath("/admin");
  revalidatePath("/pricing");
  redirect("/admin?plan=updated");
}

export async function adminUpdateMarketplaceFeeAction(formData: FormData) {
  await requireUser();
  const fee = value(formData, "fee_percent");
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(fee)) redirect("/admin?error=fee");
  const feeBps = Math.round(Number(fee) * 100);
  if (!Number.isSafeInteger(feeBps) || feeBps > 2000) redirect("/admin?error=fee");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("admin_update_marketplace_fee", { p_fee_bps: feeBps });
  if (error) redirect("/admin?error=fee");
  revalidatePath("/admin");
  redirect("/admin?fee=updated");
}

export async function updateSupplierOrderStatusAction(formData: FormData) {
  await requireUser();
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
  await requireUser();
  const orderId = value(formData, "order_id");
  if (!z.uuid().safeParse(orderId).success) redirect("/dashboard?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("buyer_confirm_receipt", { p_order_id: orderId });
  if (error) redirect("/orders/" + orderId + "?error=receipt");
  revalidatePath("/dashboard");
  redirect("/orders/" + orderId + "?received=1");
}

export async function createSupportCaseAction(formData: FormData) {
  const user = await requireUser();
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
  redirect("/contact?sent=1");
}

export async function createBusinessEnquiryAction(formData: FormData) {
  await requireUser();
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
  await requireUser();
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
  const user = await requireUser();
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
  await requireUser();
  const caseId = value(formData, "case_id");
  const status = value(formData, "status");
  if (!z.uuid().safeParse(caseId).success || !["open", "in_progress", "resolved", "closed"].includes(status)) {
    redirect("/support?error=invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("update_support_case_status", { p_case_id: caseId, p_status: status });
  if (error) redirect("/support?error=update");
  revalidatePath("/support");
  revalidatePath("/admin");
  redirect("/support?updated=1");
}

export async function markNotificationReadAction(formData: FormData) {
  await requireUser();
  const id = value(formData, "notification_id");
  if (!z.uuid().safeParse(id).success) redirect("/dashboard?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/dashboard?error=notification");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
