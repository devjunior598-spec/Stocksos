import Link from "next/link";
import { ArrowUpRight, Menu, Zap } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { getAuthenticatedUser } from "@/lib/auth";

const links = [
  { href: "/find-stock", label: "Find stock" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteHeader() {
  const user = await getAuthenticatedUser();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="StockSOS home">
          <span className="brand-mark"><Zap size={18} fill="currentColor" strokeWidth={2.5} /></span>
          <span>Stock<span className="brand-accent">SOS</span></span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation">
          {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </nav>
        <div className="header-actions">
          {user ? <details className="account-menu">
            <summary className="header-login">My account</summary>
            <nav aria-label="Account navigation">
              <Link href="/dashboard">Buyer dashboard</Link>
              <Link href="/supplier">Supplier workspace</Link>
              <form action={signOutAction}><button type="submit">Log out</button></form>
            </nav>
          </details> : <Link className="header-login" href="/login">Log in</Link>}
          <Link className="button button-small button-primary" href="/sos">
            Send an SOS <ArrowUpRight size={15} />
          </Link>
        </div>
        <details className="mobile-nav">
          <summary aria-label="Open navigation"><Menu size={22} /></summary>
          <nav aria-label="Mobile navigation">
            {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
            {user ? <><Link href="/dashboard">Buyer dashboard</Link><Link href="/supplier">Supplier workspace</Link><form action={signOutAction}><button className="mobile-nav-action" type="submit">Log out</button></form></> : <Link href="/login">Log in</Link>}
            <Link className="button button-primary" href="/sos">Send an SOS <ArrowUpRight size={15} /></Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
