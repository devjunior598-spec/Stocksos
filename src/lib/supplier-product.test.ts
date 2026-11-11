import { describe, expect, it } from "vitest";
import { publicProductRequirements, validProductMedia } from "./supplier-product";

describe("supplier listing publication", () => {
  const photo = "business/photo.jpg";

  it("keeps an incomplete public listing from being advertised as available", () => {
    expect(publicProductRequirements({ visibility: "public", priceMinor: 1200, quantity: 2, coverPath: "" })).toBe("photo");
    expect(publicProductRequirements({ visibility: "public", priceMinor: 0, quantity: 2, coverPath: photo })).toBe("price");
    expect(publicProductRequirements({ visibility: "public", priceMinor: 1200, quantity: 0, coverPath: photo })).toBe("stock");
    expect(publicProductRequirements({ visibility: "public", priceMinor: 1200, quantity: 2, coverPath: photo })).toBeNull();
  });

  it("allows a private or hidden draft while details are being prepared", () => {
    expect(publicProductRequirements({ visibility: "private", priceMinor: 0, quantity: 0, coverPath: "" })).toBeNull();
    expect(publicProductRequirements({ visibility: "public", active: false, priceMinor: 0, quantity: 0, coverPath: "" })).toBeNull();
  });

  it("enforces ten photos, one video, a valid cover and no duplicate media", () => {
    const photos = Array.from({ length: 10 }, (_, index) => `business/${index}.jpg`);
    expect(validProductMedia([...photos, "business/demo.mp4"], photos[0])).toBe(true);
    expect(validProductMedia([...photos, "business/extra.png"], photos[0])).toBe(false);
    expect(validProductMedia([photo, "business/demo.mp4", "business/demo2.webm"], photo)).toBe(false);
    expect(validProductMedia([photo, photo], photo)).toBe(false);
    expect(validProductMedia([photo], "business/other.jpg")).toBe(false);
  });
});
