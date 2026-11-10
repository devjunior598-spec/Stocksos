import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getAuthenticatedUser, getMarketplaceRole, getPlatformRole } from "@/lib/auth";
import { AccountMenu } from "@/components/account-menu";
import { InstallAppButton } from "@/components/install-app-button";
import { MobileMenu } from "@/components/mobile-menu";

const links = [
  { href: "/find-stock", label: "Find stock" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteHeader() {
  const user = await getAuthenticatedUser();
  const isAdmin = user ? await getPlatformRole(user.id) === "admin" : false;
  const marketplaceRole = user && !isAdmin ? await getMarketplaceRole(user.id) : null;
  const accountLink = marketplaceRole === "supplier"
    ? { href: "/supplier", label: "Supplier Workspace" }
    : { href: "/dashboard", label: "Buyer dashboard" };
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="StockSOS home">
          <span className="brand-logo-mark"><Image src="/stocksos-mark.svg" width={42} height={42} alt="" priority unoptimized /></span>
          <span>Stock<span className="brand-accent">SOS</span></span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation">
          {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </nav>
        <div className="header-actions">
          <InstallAppButton />
          {user
            ? <AccountMenu workspaceHref={accountLink.href} workspaceLabel={accountLink.label} isAdmin={isAdmin} />
            : <Link className="header-login" href="/login">Log in</Link>}
          {!isAdmin && <Link className="button button-small button-primary" href={marketplaceRole === "supplier" ? "/supplier" : "/sos"}>
            {marketplaceRole === "supplier" ? "Open workspace" : "Send an SOS"} <ArrowUpRight size={15} />
          </Link>}
        </div>
        <MobileMenu links={links} signedIn={Boolean(user)} isAdmin={isAdmin} workspaceHref={accountLink.href} workspaceLabel={accountLink.label} isSupplier={marketplaceRole === "supplier"} />
      </div>
    </header>
  );
}
