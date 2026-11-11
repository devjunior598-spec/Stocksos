import { z } from "zod";

export const signupProfileSchema = z.object({
  country: z.string().trim().length(2).regex(/^[A-Z]{2}$/),
  region: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().max(20),
  area: z.string().trim().max(100),
  address: z.string().trim().max(240),
  defaultDeliveryMethod: z.enum(["pickup", "delivery", "flexible", "both"]),
  businessName: z.string().trim().max(120),
  businessCategoryId: z.union([z.uuid(), z.literal("")]),
  businessDescription: z.string().trim().max(1000),
});

export type SignupProfile = z.infer<typeof signupProfileSchema>;

export function readSignupProfile(metadata: unknown): SignupProfile | null {
  const result = signupProfileSchema.safeParse(metadata);
  return result.success ? result.data : null;
}

export function supplierDraftIsComplete(profile: SignupProfile) {
  return profile.businessName.length >= 2 && Boolean(profile.businessCategoryId);
}
