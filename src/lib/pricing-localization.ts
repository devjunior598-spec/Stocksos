import "server-only";

type RateRow = { date?: unknown; base?: unknown; quote?: unknown; rate?: unknown };

export type ReferenceRates = { perUsd: Record<string, number> };

/** Display estimates only. Paystack's charged currency remains the checkout quote. */
export async function getReferenceRates(): Promise<ReferenceRates> {
  const fallback: ReferenceRates = { perUsd: { USD: 1 } };
  try {
    const response = await fetch("https://api.frankfurter.dev/v2/rates?base=usd", {
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return fallback;
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return fallback;
    const perUsd: Record<string, number> = { USD: 1 };
    for (const item of payload as RateRow[]) {
      if (item.base !== "USD" || typeof item.quote !== "string"
        || !/^[A-Z]{3}$/.test(item.quote) || typeof item.rate !== "number"
        || !Number.isFinite(item.rate) || item.rate <= 0) continue;
      perUsd[item.quote] = item.rate;
    }
    return { perUsd };
  } catch {
    return fallback;
  }
}
