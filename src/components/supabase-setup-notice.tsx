import { CircleAlert } from "lucide-react";

export function SupabaseSetupNotice() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (configured) return null;
  return (
    <div className="notice" role="status">
      <CircleAlert size={18} />
      <div>
        <strong>Some services are temporarily unavailable.</strong>
        <p>Accounts and live marketplace data are unavailable right now. Please try again later.</p>
      </div>
    </div>
  );
}
