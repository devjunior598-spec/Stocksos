import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ source: "anonymous-catalog" })) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPublicCatalogClient, hasPreviewCatalog, publicCatalogUrl } from "./public-catalog";

const accountClient = vi.mocked(createSupabaseServerClient);
const anonymousClient = vi.mocked(createClient);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("public catalogue preview isolation", () => {
  it("uses the normal account client when configured", async () => {
    const client = { source: "account" };
    accountClient.mockResolvedValue(client as never);
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://accounts.example");
    expect(await createPublicCatalogClient()).toBe(client);
    expect(publicCatalogUrl()).toBe("https://accounts.example");
    expect(anonymousClient).not.toHaveBeenCalled();
  });

  it("uses only an anonymous client for preview catalogue reads", async () => {
    accountClient.mockResolvedValue(null);
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PREVIEW_CATALOG_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("PREVIEW_CATALOG_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(hasPreviewCatalog()).toBe(true);
    expect(publicCatalogUrl()).toBe("https://catalog.example");
    expect(await createPublicCatalogClient()).toEqual({ source: "anonymous-catalog" });
    expect(anonymousClient).toHaveBeenCalledWith("https://catalog.example", "sb_publishable_test", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("uses preview-scoped catalogue settings when Vercel system variables are not exposed", async () => {
    accountClient.mockResolvedValue(null);
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("PREVIEW_CATALOG_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("PREVIEW_CATALOG_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(hasPreviewCatalog()).toBe(true);
    expect(await createPublicCatalogClient()).toEqual({ source: "anonymous-catalog" });
  });

  it("does not use a preview catalogue when only one account setting is missing", async () => {
    accountClient.mockResolvedValue(null);
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://accounts.example");
    vi.stubEnv("PREVIEW_CATALOG_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("PREVIEW_CATALOG_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(hasPreviewCatalog()).toBe(false);
    expect(await createPublicCatalogClient()).toBeNull();
  });

  it("never uses the preview catalogue connection in production", async () => {
    accountClient.mockResolvedValue(null);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PREVIEW_CATALOG_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("PREVIEW_CATALOG_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(hasPreviewCatalog()).toBe(false);
    expect(publicCatalogUrl()).toBeUndefined();
    expect(await createPublicCatalogClient()).toBeNull();
    expect(anonymousClient).not.toHaveBeenCalled();
  });
});
