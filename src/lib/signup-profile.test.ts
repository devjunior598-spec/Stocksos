import { describe, expect, it } from "vitest";
import { readSignupProfile, signupProfileSchema, supplierDraftIsComplete } from "./signup-profile";

const complete = {
  country: "GB", region: "England", city: "London", postalCode: "SW1A 1AA",
  area: "Westminster", address: "10 Example Road", defaultDeliveryMethod: "both",
  businessName: "Example Supplies", businessCategoryId: "11000000-0000-4000-8000-000000000001",
  businessDescription: "Wholesale office supplies",
};

describe("sign-up profile", () => {
  it("requires a real location and never accepts arbitrary saved metadata", () => {
    expect(signupProfileSchema.safeParse(complete).success).toBe(true);
    expect(readSignupProfile({ ...complete, country: "USA" })).toBeNull();
    expect(readSignupProfile({ ...complete, city: "" })).toBeNull();
  });

  it("requires supplier business essentials without making optional details mandatory", () => {
    const parsed = readSignupProfile({ ...complete, postalCode: "", area: "", address: "", businessDescription: "" });
    expect(parsed).not.toBeNull();
    expect(supplierDraftIsComplete(parsed!)).toBe(true);
    expect(supplierDraftIsComplete({ ...parsed!, businessCategoryId: "" })).toBe(false);
    expect(supplierDraftIsComplete({ ...parsed!, businessName: "" })).toBe(false);
  });
});
