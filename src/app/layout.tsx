import type { Metadata } from "next";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-url";
import "./globals.css";
import "./experience.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ProfileCompletionBanner } from "@/components/profile-completion-banner";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  title: {
    default: "StockSOS — Find stock. Keep business moving.",
    template: "%s · StockSOS",
  },
  description:
    "Search approved supplier inventory, request stock, and publish products for business buyers with StockSOS.",
  applicationName: "StockSOS",
  appleWebApp: {
    capable: true,
    title: "StockSOS",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <ProfileCompletionBanner />
        <main>{children}</main>
        <MobileBottomNav />
        <SiteFooter />
      </body>
    </html>
  );
}
