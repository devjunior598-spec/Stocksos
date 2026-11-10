import { describe, expect, it } from "vitest";
import { getProductDistributionReadiness } from "./product-quality";

describe("product distribution readiness", () => {
  it("marks a complete, public and in-stock listing ready to share", () => {
    expect(getProductDistributionReadiness({
      name: "Industrial water pump",
      image_path: "business-id/pump.jpg",
      specifications: "Durable industrial water pump with a 2-inch outlet for commercial water transfer.",
      visibility: "public",
      inventory: { quantity_available: 12, unit_price_kobo: 450000 },
    })).toMatchObject({ score: 100, ready: true, issues: [] });
  });

  it("identifies the missing details that would weaken a social post or product feed", () => {
    const readiness = getProductDistributionReadiness({
      name: "Product",
      image_path: null,
      specifications: "",
      visibility: "public",
      inventory: { quantity_available: 0, unit_price_kobo: 0 },
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues).toContain("Add a cover photo before publishing publicly.");
    expect(readiness.issues).toContain("Add at least a short description so customers understand the product.");
    expect(readiness.issues).toContain("Add a current unit price before sharing this listing.");
    expect(readiness.issues).toContain("Update available stock before promoting this listing.");
  });
});
