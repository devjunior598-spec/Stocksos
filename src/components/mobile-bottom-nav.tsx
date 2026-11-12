import { getAuthenticatedUser, getMarketplaceRole, getPlatformRole } from "@/lib/auth";
import { MobileBottomNavLinks } from "@/components/mobile-bottom-nav-links";

export async function MobileBottomNav() {
  const user = await getAuthenticatedUser();
  if (user && await getPlatformRole(user.id) === "admin") return null;
  const role = user ? await getMarketplaceRole(user.id) : null;
  return <MobileBottomNavLinks role={role === "supplier" || role === "buyer" ? role : null} />;
}
