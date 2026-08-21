import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

interface MockError {
  code?: string;
  message: string;
}

interface MockResponse {
  data: unknown;
  error: MockError | null;
  count?: number | null;
}

interface RecordedCall {
  target: string;
  method: string;
  args: unknown[];
}

const supabaseDouble = vi.hoisted(() => ({
  calls: [] as RecordedCall[],
  responses: [] as MockResponse[],
}));

vi.mock("@/data/supabase/client", () => {
  function nextResponse(): MockResponse {
    const response = supabaseDouble.responses.shift();
    if (!response) throw new Error("Supabase test double ran out of responses.");
    return response;
  }

  function builderFor(table: string) {
    const builder = {
      select: (...args: unknown[]) => record("select", args),
      insert: (...args: unknown[]) => record("insert", args),
      update: (...args: unknown[]) => record("update", args),
      delete: (...args: unknown[]) => record("delete", args),
      eq: (...args: unknown[]) => record("eq", args),
      is: (...args: unknown[]) => record("is", args),
      gte: (...args: unknown[]) => record("gte", args),
      lt: (...args: unknown[]) => record("lt", args),
      order: (...args: unknown[]) => record("order", args),
      limit: (...args: unknown[]) => record("limit", args),
      single: (...args: unknown[]) => record("single", args),
      maybeSingle: (...args: unknown[]) => record("maybeSingle", args),
      then: (
        onFulfilled?: (response: MockResponse) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(nextResponse()).then(onFulfilled, onRejected),
    };

    function record(method: string, args: unknown[]) {
      supabaseDouble.calls.push({ target: table, method, args });
      return builder;
    }

    return builder;
  }

  const client = {
    from: (table: string) => {
      supabaseDouble.calls.push({ target: table, method: "from", args: [] });
      return builderFor(table);
    },
    rpc: (name: string, args: unknown) => {
      supabaseDouble.calls.push({ target: name, method: "rpc", args: [args] });
      return Promise.resolve(nextResponse());
    },
  };

  return { getSupabase: () => client, supabase: client };
});

import {
  useCanInactivateStage,
  useCreateEventType,
  useReorderStages,
  useServiceVariants,
  useUpdateStage,
} from "./use-settings";
import { useCreateTeamMember, useTeamMembers } from "./use-team";
import {
  useCreateEvent,
  useEvent,
  useEventFinancials,
  useEventServices,
  useEvents,
  useRemoveEventService,
} from "./use-events";
import {
  useCreateTransaction,
  useEventTransactions,
  useRemoveTransaction,
  useTransactions,
} from "./use-transactions";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function enqueue(...responses: MockResponse[]) {
  supabaseDouble.responses.push(...responses);
}

function successful(data: unknown, count?: number): MockResponse {
  return { data, error: null, count };
}

beforeEach(() => {
  localStorage.clear();
  supabaseDouble.calls.length = 0;
  supabaseDouble.responses.length = 0;
});

test("filters service variants at PostgREST and maps their database rows", async () => {
  enqueue(successful([
    {
      id: "variant-1",
      service_id: "service-1",
      name: "Trio",
      default_price_cents: 300_000,
      active: true,
      created_at: "2026-08-21T10:00:00+00:00",
    },
  ]));

  const { result } = renderHook(() => useServiceVariants("service-1"), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data).toEqual([
    { id: "variant-1", serviceId: "service-1", name: "Trio", defaultPriceCents: 300_000, active: true },
  ]);
  expect(supabaseDouble.calls).toContainEqual({
    target: "service_variants",
    method: "eq",
    args: ["service_id", "service-1"],
  });
});

test("creates an event type with the explicit database payload and returns the mapped row", async () => {
  enqueue(successful({
    id: "type-1",
    name: "Casamento",
    active: true,
    created_at: "2026-08-21T10:00:00+00:00",
  }));

  const { result } = renderHook(() => useCreateEventType(), { wrapper: createWrapper() });
  let created: unknown;
  await act(async () => {
    created = await result.current.mutateAsync({ name: "Casamento", active: true });
  });

  expect(supabaseDouble.calls).toContainEqual({
    target: "event_types",
    method: "insert",
    args: [{ name: "Casamento", active: true }],
  });
  expect(created).toEqual({ id: "type-1", name: "Casamento", active: true });
});

test("checks active stage contacts on the server before allowing inactivation", async () => {
  enqueue(successful(null, 0));
  const { result } = renderHook(() => useCanInactivateStage(), { wrapper: createWrapper() });

  await expect(result.current("stage-1")).resolves.toBe(true);
  expect(supabaseDouble.calls).toContainEqual({
    target: "contacts",
    method: "eq",
    args: ["stage_id", "stage-1"],
  });
  expect(supabaseDouble.calls).toContainEqual({
    target: "contacts",
    method: "eq",
    args: ["archived", false],
  });
});

test("reorders stages through the atomic database RPC", async () => {
  enqueue(successful(undefined));
  const { result } = renderHook(() => useReorderStages(), { wrapper: createWrapper() });

  await act(() => result.current.mutateAsync(["stage-2", "stage-1"]));
  expect(supabaseDouble.calls).toContainEqual({
    target: "reorder_stages",
    method: "rpc",
    args: [{ p_ordered_ids: ["stage-2", "stage-1"] }],
  });
});

test("changes stage activation through the serialized database RPC", async () => {
  enqueue(successful({
    id: "stage-1",
    name: "Novo lead",
    position: 1,
    active: false,
  }));
  const { result } = renderHook(() => useUpdateStage(), { wrapper: createWrapper() });

  await act(() => result.current.mutateAsync({ id: "stage-1", patch: { active: false } }));
  expect(supabaseDouble.calls).toContainEqual({
    target: "set_pipeline_stage_active",
    method: "rpc",
    args: [{ p_stage_id: "stage-1", p_active: false }],
  });
  expect(supabaseDouble.calls).not.toContainEqual(
    expect.objectContaining({ target: "pipeline_stages", method: "update" }),
  );
});

test("lists team members through the row mapper and creates with the database builder", async () => {
  enqueue(
    successful([
      {
        id: "member-1",
        name: "Bia",
        phone: null,
        role_label: "Comercial",
        pay_notes: null,
        active: true,
        created_at: "2026-08-21T10:00:00+00:00",
      },
    ]),
    successful({
      id: "member-2",
      name: "Carla",
      phone: "11999999999",
      role_label: "Social media",
      pay_notes: null,
      active: true,
      created_at: "2026-08-21T10:00:00+00:00",
    }),
  );

  const { result } = renderHook(
    () => ({ list: useTeamMembers(), create: useCreateTeamMember() }),
    { wrapper: createWrapper() },
  );
  await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
  await act(() => result.current.create.mutateAsync({
    name: "Carla",
    phone: "11999999999",
    roleLabel: "Social media",
    payNotes: null,
    active: true,
  }));

  expect(result.current.list.data?.[0]).toEqual({
    id: "member-1",
    name: "Bia",
    phone: null,
    roleLabel: "Comercial",
    payNotes: null,
    active: true,
  });
  expect(supabaseDouble.calls).toContainEqual({
    target: "team_members",
    method: "insert",
    args: [{ name: "Carla", phone: "11999999999", role_label: "Social media", pay_notes: null, active: true }],
  });
});

test("lists events with server ordering and maps PostgreSQL time to the domain", async () => {
  enqueue(successful([
    {
      id: "event-1",
      name: "Evento",
      event_type_id: "type-1",
      event_date: "2026-10-10",
      event_time: "19:30:00",
      contact_id: null,
      discount_cents: 0,
      canceled: false,
      notes: null,
      created_at: "2026-08-21T10:00:00+00:00",
    },
  ]));
  const { result } = renderHook(() => useEvents(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data?.[0]?.eventTime).toBe("19:30");
  expect(supabaseDouble.calls).toContainEqual({
    target: "events",
    method: "order",
    args: ["event_date", { ascending: true }],
  });
  expect(supabaseDouble.calls).toContainEqual({
    target: "events",
    method: "order",
    args: ["event_time", { ascending: true, nullsFirst: false }],
  });
});

test("keeps a missing event as a successful query with undefined data", async () => {
  enqueue(successful(null));
  const { result } = renderHook(() => useEvent("missing-event"), { wrapper: createWrapper() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toBeUndefined();
});

test("filters event services on the server and removes one with a physical item delete", async () => {
  enqueue(
    successful([
      {
        id: "item-1",
        event_id: "event-1",
        service_id: "service-1",
        variant_id: null,
        price_cents: 120_000,
        created_at: "2026-08-21T10:00:00+00:00",
      },
    ]),
    successful(null),
  );
  const { result } = renderHook(
    () => ({ list: useEventServices("event-1"), remove: useRemoveEventService() }),
    { wrapper: createWrapper() },
  );
  await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
  await act(() => result.current.remove.mutateAsync("item-1"));

  expect(supabaseDouble.calls).toContainEqual({
    target: "event_services",
    method: "eq",
    args: ["event_id", "event-1"],
  });
  expect(supabaseDouble.calls).toContainEqual({
    target: "event_services",
    method: "delete",
    args: [],
  });
});

test("reads event financials from the database view", async () => {
  enqueue(successful({
    event_id: "event-1",
    contract_cents: 200_000,
    received_cents: 75_000,
    cost_cents: 10_000,
    profit_cents: 65_000,
    receivable_cents: 125_000,
  }));
  const { result } = renderHook(() => useEventFinancials("event-1"), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current).toBeDefined());

  expect(result.current).toEqual({
    contractCents: 200_000,
    receivedCents: 75_000,
    costCents: 10_000,
    profitCents: 65_000,
    receivableCents: 125_000,
  });
  expect(supabaseDouble.calls).toContainEqual({ target: "v_event_financials", method: "from", args: [] });
  expect(supabaseDouble.calls).toContainEqual({
    target: "v_event_financials",
    method: "eq",
    args: ["event_id", "event-1"],
  });
});

test("creates an event with server-compatible defaults", async () => {
  enqueue(successful({
    id: "event-1",
    name: "Evento",
    event_type_id: "type-1",
    event_date: "2026-10-10",
    event_time: null,
    contact_id: null,
    discount_cents: 0,
    canceled: false,
    notes: null,
    created_at: "2026-08-21T10:00:00+00:00",
  }));
  const { result } = renderHook(() => useCreateEvent(), { wrapper: createWrapper() });
  await act(() => result.current.mutateAsync({
    name: "Evento",
    eventTypeId: "type-1",
    eventDate: "2026-10-10",
    eventTime: null,
  }));

  expect(supabaseDouble.calls).toContainEqual({
    target: "events",
    method: "insert",
    args: [{
      name: "Evento",
      event_type_id: "type-1",
      event_date: "2026-10-10",
      event_time: null,
      contact_id: null,
      discount_cents: 0,
      canceled: false,
      notes: null,
    }],
  });
});

test("filters live transactions entirely at PostgREST", async () => {
  enqueue(successful([
    {
      id: "tx-1",
      kind: "in",
      amount_cents: 25_000,
      date: "2026-08-20",
      category_id: "cat-1",
      event_id: "event-1",
      description: null,
      created_by: "user-1",
      created_at: "2026-08-21T10:00:00+00:00",
      deleted_at: null,
      deleted_by: null,
    },
  ]));
  const { result } = renderHook(
    () => useTransactions({
      month: "2026-08",
      kind: "in",
      categoryId: "cat-1",
      scope: { eventId: "event-1" },
    }),
    { wrapper: createWrapper() },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data?.[0]).toMatchObject({ id: "tx-1", amountCents: 25_000, eventId: "event-1" });
  expect(supabaseDouble.calls).toEqual(expect.arrayContaining([
    { target: "transactions", method: "is", args: ["deleted_at", null] },
    { target: "transactions", method: "gte", args: ["date", "2026-08-01"] },
    { target: "transactions", method: "lt", args: ["date", "2026-09-01"] },
    { target: "transactions", method: "eq", args: ["kind", "in"] },
    { target: "transactions", method: "eq", args: ["category_id", "cat-1"] },
    { target: "transactions", method: "eq", args: ["event_id", "event-1"] },
  ]));
});

test("filters event transactions server-side by event id", async () => {
  enqueue(successful([]));
  const { result } = renderHook(() => useEventTransactions("event-1"), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(supabaseDouble.calls).toContainEqual({
    target: "transactions",
    method: "eq",
    args: ["event_id", "event-1"],
  });
});

test("creates a transaction without a spoofable created_by payload", async () => {
  enqueue(successful({
    id: "tx-1",
    kind: "out",
    amount_cents: 9_900,
    date: "2026-08-21",
    category_id: "cat-1",
    event_id: null,
    description: null,
    created_by: "user-1",
    created_at: "2026-08-21T10:00:00+00:00",
    deleted_at: null,
    deleted_by: null,
  }));
  const { result } = renderHook(() => useCreateTransaction(), { wrapper: createWrapper() });
  await act(() => result.current.mutateAsync({
    kind: "out",
    amountCents: 9_900,
    date: "2026-08-21",
    categoryId: "cat-1",
    eventId: null,
    description: null,
  }));

  expect(supabaseDouble.calls).toContainEqual({
    target: "transactions",
    method: "insert",
    args: [{
      kind: "out",
      amount_cents: 9_900,
      date: "2026-08-21",
      category_id: "cat-1",
      event_id: null,
      description: null,
    }],
  });
});

test("removes a transaction only through the audited void RPC", async () => {
  enqueue(successful("tx-1"));
  const { result } = renderHook(() => useRemoveTransaction(), { wrapper: createWrapper() });
  await act(() => result.current.mutateAsync("tx-1"));

  expect(supabaseDouble.calls).toContainEqual({
    target: "void_transaction",
    method: "rpc",
    args: [{ p_transaction_id: "tx-1" }],
  });
  expect(supabaseDouble.calls.some((call) => call.target === "transactions" && call.method === "delete")).toBe(false);
});

test("turns an unexpected Supabase failure into a safe production error", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  enqueue({ data: null, error: { code: "XX999", message: "relation private.payroll does not exist" } });
  const { result } = renderHook(() => useTeamMembers(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(result.current.error).toEqual(new Error("Não foi possível concluir a ação. Tente novamente."));
  expect(consoleError).toHaveBeenCalled();
  consoleError.mockRestore();
});
