"use client";

import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { useEffect, useRef } from "react";
import { signOutAction } from "@/app/actions";
import { InstallAppButton } from "@/components/install-app-button";

type MobileMenuProps = {
  links: { href: string; label: string }[];
  signedIn: boolean;
  isAdmin: boolean;
  workspaceHref: string;
  workspaceLabel: string;
  isSupplier: boolean;
};

export function MobileMenu({ links, signedIn, isAdmin, workspaceHref, workspaceLabel, isSupplier }: MobileMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = () => { if (menuRef.current) menuRef.current.open = false; };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        close();
        menuRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, []);

  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };

  return <details className="mobile-nav" ref={menuRef}>
    <summary aria-label="Open navigation"><Menu size={22} /></summary>
    <nav aria-label="Mobile navigation">
      {links.map((link) => <Link key={link.href} href={link.href} onClick={closeMenu}>{link.label}</Link>)}
      <InstallAppButton />
      {signedIn
        ? <>{isAdmin ? <Link href="/admin" onClick={closeMenu}>Admin console</Link> : <><Link href={workspaceHref} onClick={closeMenu}>{workspaceLabel}</Link><Link href="/onboarding" onClick={closeMenu}>Account settings</Link></>}<form action={signOutAction} onSubmit={closeMenu}><button className="mobile-nav-action" type="submit">Log out</button></form></>
        : <Link href="/login" onClick={closeMenu}>Log in</Link>}
      {!isAdmin && <Link className="button button-primary" href={isSupplier ? "/supplier" : "/sos"} onClick={closeMenu}>{isSupplier ? "Open workspace" : "Send an SOS"} <ArrowUpRight size={15} /></Link>}
    </nav>
  </details>;
}
