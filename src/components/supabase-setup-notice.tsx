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
        <strong>Connect Supabase to enable accounts and live marketplace data.</strong>
        <p>Add the public project URL and publishable key from the project setup instructions.</p>
      </div>
    </div>
  );
}
