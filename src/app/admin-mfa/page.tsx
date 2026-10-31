import { redirect } from "next/navigation";
import { AdminMfaEnrollment } from "@/components/admin-mfa-enrollment";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminMfaPage({ searchParams }: { searchParams: Promise<{ next?: string; setup?: string; verify?: string }> }) {
  await requireAdmin({ enforceMfa: false });
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/admin";
  if (params.setup !== "1" && params.verify !== "1") redirect(nextPath);
  return <AdminMfaEnrollment nextPath={nextPath} setupRequested={params.setup === "1"} verifyRequested={params.verify === "1"} />;
}
