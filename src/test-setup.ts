import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("@/data/supabase/client", async () => {
  const { createSupabaseStoreClient } = await import("@/test/supabase-store-client");
  const client = createSupabaseStoreClient();
  return { supabase: client, getSupabase: () => client };
});
