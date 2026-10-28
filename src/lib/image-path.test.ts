import { describe, expect, it } from "vitest";
import { isMarketplaceImagePathForBusiness } from "@/lib/image-path";

describe("marketplace image object paths", () => {
  const businessId = "123e4567-e89b-42d3-a456-426614174000";
  const imageId = "b2f34cde-65f1-4a36-9f29-45b8b1fdf820";

  it("accepts image paths scoped to the supplier business", () => {
    expect(isMarketplaceImagePathForBusiness(`${businessId}/${imageId}.webp`, businessId)).toBe(true);
  });

  it("rejects another business, traversal, and unsupported file types", () => {
    expect(isMarketplaceImagePathForBusiness(`${imageId}/${imageId}.jpg`, businessId)).toBe(false);
    expect(isMarketplaceImagePathForBusiness(`${businessId}/../${imageId}.jpg`, businessId)).toBe(false);
    expect(isMarketplaceImagePathForBusiness(`${businessId}/${imageId}.svg`, businessId)).toBe(false);
  });
});
