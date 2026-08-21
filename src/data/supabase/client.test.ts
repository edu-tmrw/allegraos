import { afterEach, expect, test, vi } from "vitest";

vi.unmock("@/data/supabase/client");

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

test("rejects a missing Supabase publishable key", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

  const { requireSupabaseEnv } = await import("./client");

  expect(() => requireSupabaseEnv()).toThrow("VITE_SUPABASE_PUBLISHABLE_KEY");
});

test("exposes a lazy client without requiring configuration at import time", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

  const clientModule = await import("./client");

  expect(Reflect.get(clientModule, "supabase")).toBeDefined();
});

test("validates lazy configuration only when the shared client is first used", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

  const { getSupabase } = await import("./client");

  expect(() => getSupabase()).toThrow("VITE_SUPABASE_URL");
});
