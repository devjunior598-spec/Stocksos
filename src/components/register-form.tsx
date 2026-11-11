"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, ShoppingBag } from "lucide-react";
import { signUpAction, type SignUpState } from "@/app/actions";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { PasswordInput } from "@/components/password-input";

type Category = { id: string; name: string };

const errorMessages: Record<Exclude<SignUpState["error"], "">, { title: string; detail: string }> = {
  invalid: { title: "Check your account details.", detail: "Complete the required fields, including a country, region, city, and phone number with its country calling code." },
  business: { title: "Complete your supplier details.", detail: "Add your business name and select its main product category." },
  category: { title: "Business categories are unavailable.", detail: "Refresh and select a current category before creating a supplier account." },
  password: { title: "Passwords do not match.", detail: "Enter the same password in both password fields." },
  duplicate: { title: "This email is already registered.", detail: "Log in with this email or use a different address for another account." },
  disposable: { title: "Use a permanent email address.", detail: "Temporary email domains cannot be used for StockSOS accounts." },
  rate: { title: "Too many registration attempts.", detail: "Wait before trying again." },
  signup: { title: "Your account could not be created.", detail: "Check your connection and try again. Your entries remain on this page." },
  setup: { title: "Registration is unavailable.", detail: "The account service is not configured for this deployment." },
};

export function RegisterForm({ categories, categoriesAvailable }: { categories: Category[]; categoriesAvailable: boolean }) {
  const [role, setRole] = useState<"buyer" | "supplier">("buyer");
  const [deliveryMethod, setDeliveryMethod] = useState("both");
  const [state, setState] = useState<SignUpState>({ error: "" });
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const message = state.error ? errorMessages[state.error] : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setState({ error: "" });
    startTransition(async () => {
      try {
        const result = await signUpAction({ error: "" }, formData);
        if (result.next) { router.push(result.next); return; }
        setState(result);
        if (result.error) form.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        setState({ error: "signup" });
      }
    });
  }

  return <form onSubmit={submit} className="register-form" aria-busy={pending}>
    {message ? <div className="notice error-notice" role="alert"><div><strong>{message.title}</strong><p>{message.detail}</p></div></div> : null}
    <fieldset className="account-role-picker">
      <legend>Choose your account type</legend>
      <label><input type="radio" name="marketplace_role" value="buyer" checked={role === "buyer"} onChange={() => setRole("buyer")} /><span><ShoppingBag size={19} /><strong>Buyer</strong><small>Find stock, request quotes, and manage orders.</small></span></label>
      <label><input type="radio" name="marketplace_role" value="supplier" checked={role === "supplier"} onChange={() => setRole("supplier")} /><span><Building2 size={19} /><strong>Supplier</strong><small>Set up a business and publish products after approval.</small></span></label>
    </fieldset>

    <div className="register-section-heading"><strong>1. Your account</strong><span>All fields in this section are required.</span></div>
    <div className="form-field"><label htmlFor="full_name">Your full name</label><input id="full_name" name="full_name" autoComplete="name" required minLength={2} maxLength={120} /></div>
    <div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /><span className="form-hint">We’ll send the account verification link here.</span></div>
    <div className="form-field"><label htmlFor="phone">Mobile phone</label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 415 555 2671" maxLength={24} required /><span className="form-hint">Include your country calling code. SMS sign-in works after you verify this number in Account Settings.</span></div>

    <div className="register-section-heading"><strong>2. Your location</strong><span>Country, region, and city are required. Other address fields are optional.</span></div>
    <GlobalLocationFields description={role === "buyer" ? "Used to match suppliers and prefill your sourcing requests." : "Your account location. You can review your business storefront location separately."} />
    {role === "buyer" ? <div className="form-field"><label htmlFor="default_delivery_method">How do you prefer to receive stock?</label><select id="default_delivery_method" name="default_delivery_method" value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value)}><option value="both">Pickup or delivery</option><option value="delivery">Delivery to me</option><option value="pickup">I can pick up</option><option value="flexible">No preference</option></select><span className="form-hint">You can change this for each request.</span></div>
      : <input type="hidden" name="default_delivery_method" value="both" />}

    <fieldset className="register-supplier-fields" hidden={role !== "supplier"} disabled={role !== "supplier"}>
      <div className="register-section-heading"><strong>3. Your business</strong><span>Start your business profile now. You can review it after email verification.</span></div>
      <div className="form-field"><label htmlFor="business_name">Business name</label><input id="business_name" name="business_name" autoComplete="organization" minLength={2} maxLength={120} required /></div>
      <div className="form-field"><label htmlFor="business_category_id">Main product category</label><select id="business_category_id" name="business_category_id" defaultValue="" required><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>{!categoriesAvailable ? <span className="form-hint upload-error" role="alert">Categories could not be loaded. Refresh before signing up as a supplier.</span> : null}</div>
      <div className="form-field"><label htmlFor="business_description">Business introduction <span className="muted">(optional)</span></label><textarea id="business_description" name="business_description" maxLength={1000} placeholder="What products do you supply, and who do you serve?" /></div>
      <p className="register-followup-note">After verification, you can add a logo, shareable business link, and any registration reference before submitting your business profile.</p>
    </fieldset>

    <div className="register-section-heading"><strong>{role === "buyer" ? "3" : "4"}. Secure sign-in</strong><span>Choose a password of at least 10 characters.</span></div>
    <PasswordInput autoComplete="new-password" minLength={10} />
    <PasswordInput id="confirm_password" name="confirm_password" label="Confirm password" autoComplete="new-password" minLength={10} />
    <button className="button button-primary form-submit" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"} <ArrowRight size={16} /></button>
  </form>;
}
