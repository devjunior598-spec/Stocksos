"use client";

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupplierProductAction, type CreateProductState } from "@/app/actions";

const messages: Record<Exclude<CreateProductState["error"], "">, { title: string; detail: string }> = {
  name: { title: "Add a specific product name.", detail: "Include the product type, model, size, or material so buyers recognize it." },
  photo: { title: "Add a product photo.", detail: "A public listing needs a clear photo of the actual item. You can save it privately without one." },
  price: { title: "Add a selling price.", detail: "A public listing needs a price above zero. Save it privately if pricing is not ready." },
  stock: { title: "Add available stock.", detail: "A public listing needs at least one unit available. Save it privately while out of stock." },
  media: { title: "A photo or video could not be verified.", detail: "Check the uploaded media, remove any broken item, and upload it again before saving." },
  product: { title: "The product could not be saved.", detail: "Check the fields and uploaded media, then try again. Your entries remain on this page." },
};

export function SupplierProductForm({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CreateProductState>({ error: "" });
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const message = state.error ? messages[state.error] : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = submitter instanceof HTMLButtonElement
      ? new FormData(event.currentTarget, submitter)
      : new FormData(event.currentTarget);
    // Keep a defined intent for keyboard submissions without a submitter.
    if (!formData.has("visibility")) formData.set("visibility", "public");
    setState({ error: "" });
    startTransition(async () => {
      try {
        const nextState = await createSupplierProductAction({ error: "" }, formData);
        if (!nextState) return; // Authentication redirects are handled by Next.js.
        if (nextState.redirectTo) { router.push(nextState.redirectTo); return; }
        setState(nextState);
        if (nextState.error) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        if (error && typeof error === "object" && "digest" in error
          && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
        setState({ error: "product" });
      }
    });
  }

  return <form ref={formRef} onSubmit={submit} className="new-product-form panel" aria-busy={pending}>
    {message ? <div className="notice error-notice" role="alert"><div><strong>{message.title}</strong><p>{message.detail}</p></div></div> : null}
    {pending ? <p className="form-hint" role="status">Saving your listing…</p> : null}
    {children}
  </form>;
}
