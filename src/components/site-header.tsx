import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Menu } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { getAuthenticatedUser, getMarketplaceRole, getPlatformRole } from "@/lib/auth";
import { AccountMenu } from "@/components/account-menu";

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
          <span className="brand-logo-mark"><Image src="/stocksos-logo.png" width={42} height={42} alt="" priority /></span>
          <span>Stock<span className="brand-accent">SOS</span></span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation">
          {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </nav>
        <div className="header-actions">
          {user
            ? <AccountMenu workspaceHref={accountLink.href} workspaceLabel={accountLink.label} isAdmin={isAdmin} />
            : <Link className="header-login" href="/login">Log in</Link>}
          {!isAdmin && <Link className="button button-small button-primary" href={marketplaceRole === "supplier" ? "/supplier" : "/sos"}>
            {marketplaceRole === "supplier" ? "Open workspace" : "Send an SOS"} <ArrowUpRight size={15} />
          </Link>}
        </div>
        <details className="mobile-nav">
          <summary aria-label="Open navigation"><Menu size={22} /></summary>
          <nav aria-label="Mobile navigation">
            {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
            {user
              ? <>{isAdmin ? <Link href="/admin">Admin console</Link> : <><Link href={accountLink.href}>{accountLink.label}</Link><Link href="/onboarding">Account settings</Link></>}<form action={signOutAction}><button className="mobile-nav-action" type="submit">Log out</button></form></>
              : <Link href="/login">Log in</Link>}
            {!isAdmin && <Link className="button button-primary" href={marketplaceRole === "supplier" ? "/supplier" : "/sos"}>{marketplaceRole === "supplier" ? "Open workspace" : "Send an SOS"} <ArrowUpRight size={15} /></Link>}
          </nav>
        </details>
      </div>
    </header>
  );
}
