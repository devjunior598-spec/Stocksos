"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Check, ShoppingBag } from "lucide-react";
import { signUpAction, type SignUpState } from "@/app/actions";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { PasswordInput } from "@/components/password-input";

type Category = { id: string; name: string };
type Step = "role" | "contact" | "location" | "business" | "review";
const labels: Record<Step, string> = { role: "Account type", contact: "Your details", location: "Location", business: "Business", review: "Review" };

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
  const [step, setStep] = useState<Step>("role");
  const [deliveryMethod, setDeliveryMethod] = useState("both");
  const [review, setReview] = useState<Record<string, string>>({});
  const [state, setState] = useState<SignUpState>({ error: "" });
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const pendingInvalid = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);
  const navigated = useRef(false);
  const router = useRouter();
  const message = state.error ? errorMessages[state.error] : null;
  const steps: Step[] = role === "supplier" ? ["role", "contact", "location", "business", "review"] : ["role", "contact", "location", "review"];
  const index = steps.indexOf(step);

  useEffect(() => {
    if (!navigated.current) return;
    if (pendingInvalid.current) {
      pendingInvalid.current.reportValidity();
      pendingInvalid.current = null;
    } else {
      formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"] h2`)?.focus();
    }
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  function moveTo(target: Step) {
    if (formRef.current) {
      const entries = Array.from(new FormData(formRef.current).entries())
        .filter((entry): entry is [string, string] => typeof entry[1] === "string");
      setReview(Object.fromEntries(entries));
    }
    navigated.current = true;
    setStep(target);
  }

  function invalidField(target: Step) {
    const form = formRef.current;
    if (!form) return null;
    if (target === "contact") {
      const phone = form.elements.namedItem("phone") as HTMLInputElement;
      phone.setCustomValidity("");
      const normalized = phone.value.trim().replace(/[\s().-]/g, "");
      if (normalized && !/^\+[1-9]\d{7,14}$/.test(normalized)) {
        phone.setCustomValidity("Enter a phone number with its country calling code, such as +14155552671.");
      }
    }
    if (target === "review") {
      const password = form.elements.namedItem("password") as HTMLInputElement;
      const confirm = form.elements.namedItem("confirm_password") as HTMLInputElement;
      confirm.setCustomValidity("");
      if (password.value && confirm.value && password.value !== confirm.value) confirm.setCustomValidity("Passwords do not match.");
    }
    const panel = form.querySelector(`[data-step="${target}"]`);
    return Array.from(panel?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea") ?? [])
      .find((field) => !field.disabled && !field.checkValidity()) ?? null;
  }

  function validate(target: Step) {
    const invalid = invalidField(target);
    if (!invalid) return true;
    if (target === step) invalid.reportValidity();
    else { pendingInvalid.current = invalid; moveTo(target); }
    return false;
  }

  function next() {
    if (validate(step)) moveTo(steps[index + 1]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    for (const item of steps) if (!validate(item)) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setState({ error: "" });
    startTransition(async () => {
      try {
        const result = await signUpAction({ error: "" }, formData);
        if (result.next) { router.push(result.next); return; }
        setState(result);
        if (result.error === "business" || result.error === "category") moveTo("business");
        if (result.error) form.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        setState({ error: "signup" });
      }
    });
  }

  const field = (name: string) => review[name]?.trim() ?? "";

  return <form ref={formRef} onSubmit={submit} noValidate className="register-form register-wizard" aria-busy={pending}>
    <div className="register-progress-head"><span>ACCOUNT SETUP</span><strong>Step {index + 1} of {steps.length}</strong></div>
    <ol className="register-progress" aria-label="Registration progress">{steps.map((item, position) => <li key={item} aria-current={step === item ? "step" : undefined} className={position < index ? "is-complete" : step === item ? "is-current" : ""}><span>{position < index ? <Check size={13} /> : position + 1}</span><small>{labels[item]}</small></li>)}</ol>
    <div className="register-progress-track" aria-hidden="true"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
    {message ? <div className="notice error-notice" role="alert"><div><strong>{message.title}</strong><p>{message.detail}</p></div></div> : null}
    <section data-step="role" className="register-step" hidden={step !== "role"}>
    <h2 tabIndex={-1}>Choose how you will use StockSOS</h2><p>We’ll tailor your setup and workspace to your account type.</p>
    <fieldset className="account-role-picker">
      <legend>Choose your account type</legend>
      <label><input type="radio" name="marketplace_role" value="buyer" checked={role === "buyer"} onChange={() => setRole("buyer")} /><span><ShoppingBag size={19} /><strong>Buyer</strong><small>Find stock, request quotes, and manage orders.</small></span></label>
      <label><input type="radio" name="marketplace_role" value="supplier" checked={role === "supplier"} onChange={() => setRole("supplier")} /><span><Building2 size={19} /><strong>Supplier</strong><small>Set up a business and publish products after approval.</small></span></label>
    </fieldset>
    <p className="register-followup-note">Buyer accounts source stock and request quotes. Supplier accounts create a storefront and publish products after account and business approval.</p>
    </section>

    <section data-step="contact" className="register-step" hidden={step !== "contact"}>
    <h2 tabIndex={-1}>Your contact details</h2><p>Use an email and phone number you can access. We’ll send your verification link to your email.</p>
    <div className="register-section-heading"><strong>1. Your account</strong><span>All fields in this section are required.</span></div>
    <div className="form-field"><label htmlFor="full_name">Your full name</label><input id="full_name" name="full_name" autoComplete="name" required minLength={2} maxLength={120} /></div>
    <div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /><span className="form-hint">We’ll send the account verification link here.</span></div>
    <div className="form-field"><label htmlFor="phone">Mobile phone</label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 415 555 2671" maxLength={24} required /><span className="form-hint">Include your country calling code. SMS sign-in works after you verify this number in Account Settings.</span></div>
    </section>

    <section data-step="location" className="register-step" hidden={step !== "location"}>
    <h2 tabIndex={-1}>Where are you based?</h2><p>We use your location to match relevant stock and suppliers. You can update it later in Account Settings.</p>
    <div className="register-section-heading"><strong>2. Your location</strong><span>Country, region, and city are required. Other address fields are optional.</span></div>
    <GlobalLocationFields description={role === "buyer" ? "Used to match suppliers and prefill your sourcing requests." : "Your account location. You can review your business storefront location separately."} />
    {role === "buyer" ? <div className="form-field"><label htmlFor="default_delivery_method">How do you prefer to receive stock?</label><select id="default_delivery_method" name="default_delivery_method" value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value)}><option value="both">Pickup or delivery</option><option value="delivery">Delivery to me</option><option value="pickup">I can pick up</option><option value="flexible">No preference</option></select><span className="form-hint">You can change this for each request.</span></div>
      : <input type="hidden" name="default_delivery_method" value="both" />}
    </section>

    <section data-step="business" className="register-step" hidden={step !== "business" || role !== "supplier"}>
    <h2 tabIndex={-1}>Start your business profile</h2><p>Give buyers a clear picture of what you supply. Finish your storefront after email verification.</p>
    <fieldset className="register-supplier-fields" disabled={role !== "supplier"}>
      <div className="register-section-heading"><strong>3. Your business</strong><span>Start your business profile now. You can review it after email verification.</span></div>
      <div className="form-field"><label htmlFor="business_name">Business name</label><input id="business_name" name="business_name" autoComplete="organization" minLength={2} maxLength={120} required /></div>
      <div className="form-field"><label htmlFor="business_category_id">Main product category</label><select id="business_category_id" name="business_category_id" defaultValue="" required><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>{!categoriesAvailable ? <span className="form-hint upload-error" role="alert">Categories could not be loaded. Refresh before signing up as a supplier.</span> : null}</div>
      <div className="form-field"><label htmlFor="business_description">Business introduction <span className="muted">(optional)</span></label><textarea id="business_description" name="business_description" maxLength={1000} placeholder="What products do you supply, and who do you serve?" /></div>
      <p className="register-followup-note">After verification, you can add a logo, shareable business link, and any registration reference before submitting your business profile.</p>
    </fieldset>
    </section>

    <section data-step="review" className="register-step" hidden={step !== "review"}>
    <h2 tabIndex={-1}>Review and secure your account</h2><p>Check your details, then choose a password. Your password is never shown in this summary.</p>
    <div className="register-review">
      <div><span>ACCOUNT</span><strong>{role === "buyer" ? "Buyer" : "Supplier"}</strong><small>{field("full_name") || "Your name"} · {field("email") || "Your email"}</small><button type="button" onClick={() => moveTo("contact")}>Edit</button></div>
      <div><span>LOCATION</span><strong>{[field("city"), field("region"), field("country")].filter(Boolean).join(", ") || "Your location"}</strong><button type="button" onClick={() => moveTo("location")}>Edit</button></div>
      {role === "supplier" ? <div><span>BUSINESS</span><strong>{field("business_name") || "Your business"}</strong><button type="button" onClick={() => moveTo("business")}>Edit</button></div> : null}
    </div>
    <div className="register-section-heading"><strong>{role === "buyer" ? "3" : "4"}. Secure sign-in</strong><span>Choose a password of at least 10 characters.</span></div>
    <PasswordInput autoComplete="new-password" minLength={10} />
    <PasswordInput id="confirm_password" name="confirm_password" label="Confirm password" autoComplete="new-password" minLength={10} />
    <p className="register-followup-note">We’ll email a verification link before you can use your workspace. Supplier storefront details are reviewed separately before appearing publicly.</p>
    </section>
    <div className="register-wizard-actions">
      {index > 0 ? <button className="button button-secondary" type="button" disabled={pending} onClick={() => moveTo(steps[index - 1])}><ArrowLeft size={16} /> Back</button> : null}
      {step === "review" ? <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"} <ArrowRight size={16} /></button> : <button className="button button-primary" type="button" onClick={next} disabled={pending}>Continue <ArrowRight size={16} /></button>}
    </div>
  </form>;
}
