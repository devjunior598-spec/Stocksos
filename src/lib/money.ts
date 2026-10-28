export function nairaToKobo(input: string, allowZero = false) {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(input)) return null;
  const [naira, kobo = ""] = input.split(".");
  const amount = Number(naira) * 100 + Number(kobo.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

export function quoteTotalKobo({
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
