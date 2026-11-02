import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("keeps an internal product request across sign-in", () => {
    expect(safeNextPath("/sos?product=123e4567-e89b-42d3-a456-426614174000"))
      .toBe("/sos?product=123e4567-e89b-42d3-a456-426614174000");
  });
  it("rejects redirects to another origin", () => {
    expect(safeNextPath("//example.com")).toBeNull();
    expect(safeNextPath("/\\example.com")).toBeNull();
    expect(safeNextPath("https://example.com")).toBeNull();
  });
});
