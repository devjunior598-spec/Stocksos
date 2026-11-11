import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "./rate-limit";

const adminClient = vi.mocked(createSupabaseAdminClient);
const request = { scope: "register-ip", identifier: "test-client", limit: 3, windowSeconds: 60 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("hosted rate-limit failure behavior", () => {
  it("denies requests when a hosted deployment lacks its server key", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    adminClient.mockReturnValue(null);
    expect(await consumeRateLimit(request)).toMatchObject({ allowed: false, configured: true, error: true });
  });

  it("denies requests when the database counter fails", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    adminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } }) } as never);
    expect(await consumeRateLimit(request)).toMatchObject({ allowed: false, configured: true, error: true });
  });

  it("honors the database decision when the counter works", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    adminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: false, error: null }) } as never);
    expect(await consumeRateLimit(request)).toMatchObject({ allowed: false, configured: true });
  });

  it("keeps keyless local development usable", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    adminClient.mockReturnValue(null);
    expect(await consumeRateLimit(request)).toMatchObject({ allowed: true, configured: false });
  });
});
