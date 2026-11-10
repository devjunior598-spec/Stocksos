export type VerifiedPayment = {
  id: string;
  status: string;
  amount_kobo: number;
  currency: string;
  verified_at: string | null;
};

/** Return no volume when the result is incomplete or contains an unverified record. */
export function summarizeVerifiedPayments(rows: VerifiedPayment[], expectedCount: number) {
  if (!Number.isSafeInteger(expectedCount) || expectedCount !== rows.length) return null;
  const seen = new Set<string>();
  const totals = new Map<string, number>();
  for (const payment of rows) {
    const currency = payment.currency.trim().toUpperCase();
    if (!payment.id || seen.has(payment.id) || payment.status !== "succeeded" || !payment.verified_at
      || !Number.isSafeInteger(payment.amount_kobo) || payment.amount_kobo < 0
      || !/^[A-Z]{3}$/.test(currency)) return null;
    seen.add(payment.id);
    const total = (totals.get(currency) ?? 0) + payment.amount_kobo;
    if (!Number.isSafeInteger(total)) return null;
    totals.set(currency, total);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amountMinor]) => ({ currency, amountMinor }));
}
