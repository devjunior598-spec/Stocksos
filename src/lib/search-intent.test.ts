import { describe, expect, it } from "vitest";
import { parseSearchIntent } from "./search-intent";
const categories = [{ id: "building", name: "Building materials", slug: "building-materials" }];
describe("spoken search filters", () => {
  it("extracts the product, real category, location and budget", () => {
    expect(parseSearchIntent("Find cement in Houston between $8,000 and $12,000", categories)).toMatchObject({ q: "cement", category: "building", city: "Houston", min: 8000, max: 12000 });
  });
  it("uses the saved city without inventing prices", () => {
    expect(parseSearchIntent("I need cement", categories, "Dallas")).toMatchObject({ city: "Dallas", min: undefined, max: undefined, locationSource: "profile" });
  });
  it("keeps product dimensions and prioritizes spoken location", () => {
    expect(parseSearchIntent("Find 12 mm plywood in London under 20k", categories, "Dallas")).toMatchObject({ q: "12 mm plywood", city: "London", max: 20000 });
  });
  it("rejects reversed budgets and unsupported currency", () => {
    expect(() => parseSearchIntent("cement between 12000 and 8000", categories)).toThrow();
    expect(() => parseSearchIntent("cement under €20", categories)).toThrow();
  });
  it("does not assign a category or city without evidence", () => {
    expect(parseSearchIntent("special widget", categories)).toMatchObject({ category: "", city: "" });
  });
});
