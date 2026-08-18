import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("rejects a missing Supabase URL", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk_test");

  const { requireSupabaseEnv } = await import("./client");

  expect(() => requireSupabaseEnv()).toThrow("VITE_SUPABASE_URL");
});

test("exposes a lazy client without requiring configuration at import time", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

  const clientModule = await import("./client");

  expect(Reflect.get(clientModule, "supabase")).toBeDefined();
});
