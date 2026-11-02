import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { evidenceContentType } from "@/lib/marketplace-evidence";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return new NextResponse(null, { status: 503 });
  const { data: record, error } = await supabase.from("removal_media")
    .select("evidence_path").eq("id", id).maybeSingle();
  if (error || !record) return new NextResponse(null, { status: 404 });
  const { data: file, error: downloadError } = await admin.storage
    .from("marketplace-evidence").download(record.evidence_path);
  if (downloadError || !file) return new NextResponse(null, { status: 404 });
  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_id: adminUser.id,
    action: "removal_media_viewed",
    target_type: "removal_media",
    target_id: id,
    details: {},
  });
  if (auditError) return new NextResponse(null, { status: 503 });
  return new NextResponse(await file.arrayBuffer(), {
    headers: {
      "Content-Type": evidenceContentType(record.evidence_path),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
