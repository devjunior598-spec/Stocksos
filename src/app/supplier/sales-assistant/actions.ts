"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSupplier } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPaidAssistantAccess } from "@/lib/sales-assistant";

const settingsSchema = z.object({
  businessId: z.uuid(),
  greeting: z.string().trim().min(10).max(240),
  deliveryNotes: z.string().trim().max(800),
  returnsNotes: z.string().trim().max(800),
  handoffNotes: z.string().trim().max(500),
  enabled: z.boolean(),
});

export async function saveSalesAssistantSettings(formData: FormData) {
  const user = await requireSupplier();
  const parsed = settingsSchema.safeParse({
    businessId: formData.get("business_id"),
    greeting: formData.get("greeting"),
    deliveryNotes: formData.get("delivery_notes") ?? "",
    returnsNotes: formData.get("returns_notes") ?? "",
    handoffNotes: formData.get("handoff_notes") ?? "",
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) redirect("/supplier/sales-assistant?error=invalid");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/supplier/sales-assistant?error=unavailable");
  const businessId = parsed.data.businessId;
  const { data: membership, error: membershipError } = await supabase.from("business_memberships")
    .select("role,businesses(verification_status)")
    .eq("business_id", businessId).eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
    redirect("/supplier/sales-assistant?error=access");
  }
  const business = Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses;
  if (business?.verification_status !== "approved") redirect("/supplier/sales-assistant?error=access");

  if (parsed.data.enabled) {
    const { data: entitlement, error } = await supabase.from("sales_assistant_entitlements")
      .select("status,paid_through").eq("business_id", businessId).maybeSingle();
    if (error || !hasPaidAssistantAccess(entitlement)) {
      redirect(`/supplier/sales-assistant?business=${businessId}&error=subscription`);
    }
    if (!process.env.OPENAI_API_KEY) redirect(`/supplier/sales-assistant?business=${businessId}&error=model`);
  }

  const { error } = await supabase.from("sales_assistant_settings").upsert({
    business_id: businessId,
    enabled: parsed.data.enabled,
    greeting: parsed.data.greeting,
    delivery_notes: parsed.data.deliveryNotes,
    returns_notes: parsed.data.returnsNotes,
    handoff_notes: parsed.data.handoffNotes,
    updated_at: new Date().toISOString(),
  }, { onConflict: "business_id" });
  if (error) {
    console.error("Sales assistant settings save failed", { code: error.code });
    redirect(`/supplier/sales-assistant?business=${businessId}&error=save`);
  }
  revalidatePath("/supplier/sales-assistant");
  revalidatePath("/product/[id]", "page");
  redirect(`/supplier/sales-assistant?business=${businessId}&saved=1`);
}
