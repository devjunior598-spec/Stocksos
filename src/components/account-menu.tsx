"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { signOutAction } from "@/app/actions";

type AccountMenuProps = {
  workspaceHref: string;
  workspaceLabel: string;
  isAdmin: boolean;
};

export function AccountMenu({ workspaceHref, workspaceLabel, isAdmin }: AccountMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        if (menuRef.current) menuRef.current.open = false;
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    const closeOnScroll = () => { if (menuRef.current) menuRef.current.open = false; };
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll);
    };
  }, []);

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  return (
    <details className="account-menu" ref={menuRef}>
      <summary className="header-login">My account</summary>
      <nav aria-label="Account navigation">
        {isAdmin
          ? <Link href="/admin" onClick={closeMenu}>Admin console</Link>
          : <Link href={workspaceHref} onClick={closeMenu}>{workspaceLabel}</Link>}
        {!isAdmin ? <Link href="/onboarding" onClick={closeMenu}>Account Settings</Link> : null}
        <form action={signOutAction} onSubmit={closeMenu}>
          <button type="submit">Logout</button>
        </form>
      </nav>
    </details>
  );
}
