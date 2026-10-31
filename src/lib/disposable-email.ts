// Known disposable mailbox providers. Keep this list reviewed and updated;
// it cannot identify every temporary domain or privately hosted mailbox.
const disposableDomains = new Set([
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "dispostable.com",
  "emailondeck.com", "fakeinbox.com", "getairmail.com", "getnada.com",
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com",
  "maildrop.cc", "mailinator.com", "mailnesia.com", "mailsac.com",
  "mintemail.com", "moakt.com", "mytemp.email", "sharklasers.com",
  "temp-mail.org", "tempmail.com", "tempmail.net", "temp-mail.io",
  "throwawaymail.com", "trashmail.com", "trashmail.net", "yopmail.com",
  "yopmail.fr", "yopmail.net",
]);

/** Call after validating email syntax; match domain boundaries, including subdomains. */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  const labels = domain.split(".");
  return labels.some((_, index) => disposableDomains.has(labels.slice(index).join(".")));
}
