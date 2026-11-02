/** Keep post-login redirects on this application, including a selected product. */
export function safeNextPath(raw: string): string | null {
  if (!raw || raw.length > 512 || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f]/.test(raw)) {
    return null;
  }
  try {
    const url = new URL(raw, "https://stocksos.invalid");
    if (url.origin !== "https://stocksos.invalid" || url.pathname.startsWith("//")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
