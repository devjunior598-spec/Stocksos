/** Display-only conversion using reference rates quoted per USD. Never a checkout quote. */
export function estimateLocalMinor(
  amountMinor: number,
  chargedCurrency: string,
  displayCurrency: string,
  perUsd: Record<string, number>,
): number | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) return null;
  if (chargedCurrency === displayCurrency) return amountMinor;
  const chargedPerUsd = perUsd[chargedCurrency];
  const displayPerUsd = perUsd[displayCurrency];
  if (!Number.isFinite(chargedPerUsd) || !Number.isFinite(displayPerUsd)
    || chargedPerUsd <= 0 || displayPerUsd <= 0) return null;
  const estimate = Math.round(amountMinor / chargedPerUsd * displayPerUsd);
  return Number.isSafeInteger(estimate) && estimate >= 0 ? estimate : null;
}
