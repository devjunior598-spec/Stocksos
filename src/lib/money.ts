export function moneyToMinorUnits(input: string, allowZero = false) {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(input)) return null;
  const [majorUnits, minorUnits = ""] = input.split(".");
  const amount = Number(majorUnits) * 100 + Number(minorUnits.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

export function quoteTotalMinorUnits({
  unitPriceKobo,
  quantity,
  deliveryFeeKobo,
  pickup,
  platformFeeBps,
}: {
  unitPriceKobo: number;
  quantity: number;
  deliveryFeeKobo: number;
  pickup: boolean;
  platformFeeBps: number;
}) {
  const subtotal = unitPriceKobo * quantity;
  const delivery = pickup ? 0 : deliveryFeeKobo;
  const platformFee = Math.ceil(subtotal * platformFeeBps / 10_000);
  return { subtotal, delivery, platformFee, total: subtotal + delivery + platformFee };
}
