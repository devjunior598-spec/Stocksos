import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ProfileCompletionBanner } from "@/components/profile-completion-banner";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://stocksos.ng"),
  title: {
    default: "StockSOS — Find stock. Rescue your business.",
    template: "%s · StockSOS",
  },
  description:
    "Find the stock you need, sell the stock you have, and keep your business moving with StockSOS.",
  applicationName: "StockSOS",
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
