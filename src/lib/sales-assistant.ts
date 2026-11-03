export type AssistantEntitlement = { status: string; paid_through: string } | null;

export function hasPaidAssistantAccess(entitlement: AssistantEntitlement, now = Date.now()) {
  return entitlement?.status === "active"
    && Number.isFinite(new Date(entitlement.paid_through).getTime())
    && new Date(entitlement.paid_through).getTime() > now;
}

export function safeAssistantReply(reply: string) {
  const normalized = reply.trim();
  if (!normalized) return null;
  // Payment remains paused. Never relay a model-generated payment destination.
  if (/(?:https?:\/\/|www\.|(?:bank|account|routing|iban|wallet|crypto|usdt|bitcoin)\s+(?:number|details|address)|(?:pay|transfer|send money)\s+(?:to|into|via)|payment (?:has been |is )?(?:received|confirmed|complete)|(?:order|sale) (?:has been |is )?(?:confirmed|complete)|receipt (?:has been |is )?issued)/i.test(normalized)) {
    return "I can help with the listing details, but payment and custom terms need confirmation through StockSOS. Please send the supplier an enquiry.";
  }
  return normalized.slice(0, 1400);
}
