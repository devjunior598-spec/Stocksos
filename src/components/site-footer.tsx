import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link href="/" className="brand">
            <span className="brand-logo-mark"><Image src="/stocksos-logo.png" width={42} height={42} alt="" /></span>
            <span>Stock<span className="brand-accent">SOS</span></span>
          </Link>
          <p>Find the stock you need and connect with businesses ready to supply it.</p>
          <span className="footer-location"><span className="status-dot" /> Connecting businesses and suppliers worldwide.</span>
        </div>
        <div className="footer-links">
          <div><h3>Marketplace</h3><Link href="/find-stock">Find stock</Link><Link href="/suppliers">Suppliers</Link><Link href="/categories">Categories</Link><Link href="/sos">Send an SOS</Link></div>
          <div><h3>For business</h3><Link href="/become-supplier">Become a supplier</Link><Link href="/how-it-works#reach">StockSOS Reach</Link><Link href="/pricing">Plans and pricing</Link><Link href="/how-it-works">How it works</Link></div>
          <div><h3>Company</h3><Link href="/about">About StockSOS</Link><Link href="/contact">Contact</Link><Link href="/help">Help centre</Link></div>
          <div><h3>Legal</h3><Link href="/terms">Terms of service</Link><Link href="/privacy">Privacy</Link><Link href="/refund-policy">Refund policy</Link></div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} StockSOS</span>
        <Link href="/become-supplier">Keep your business moving <ArrowUpRight size={14} /></Link>
      </div>
    </footer>
  );
}
