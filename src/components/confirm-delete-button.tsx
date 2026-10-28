"use client";

import type { ReactNode } from "react";

export function ConfirmDeleteButton({ children, message }: { children: ReactNode; message: string }) {
  return <button className="text-link small danger-link" type="submit" onClick={(event) => {
    if (!window.confirm(message)) event.preventDefault();
  }}>{children}</button>;
}
