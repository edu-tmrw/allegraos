import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test } from "vitest";
import { crud, resetDB, saveDB } from "@/data/store";
import type { MockDB } from "@/data/seed";
import { todayISO } from "@/lib/format";
import type { EventService, Evento } from "@/domain/types";
import { useEventFinancials } from "@/data/hooks/use-events";
import { useCreateTransaction, useTransactions } from "@/data/hooks/use-transactions";
import { useConvertLead, useDueFollowups } from "@/data/hooks/use-crm";

/** A `MockDB` with every resource empty — override just what a test needs (mirrors `store.test.ts`'s `makeDB`). */
function makeEmptyDB(overrides: Partial<MockDB> = {}): MockDB {
  return {
    profiles: [],
    roles: [],
    eventTypes: [],
    services: [],
    serviceVariants: [],
    transactionCategories: [],
    pipelineStages: [],
    events: [],
    eventServices: [],
    transactions: [],
    teamMembers: [],
    contacts: [],
    proposals: [],
    proposalServices: [],
    activities: [],
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useEventFinancials", () => {
  test("only counts its own event's items — a regression for calc.ts's eventFinancials trusting an unfiltered items input", async () => {
    const eventA: Evento = {
      id: "ev-a",
      name: "Evento A",
      eventTypeId: "type-x",
      eventDate: "2026-01-10",
      eventTime: null,
      contactId: null,
      discountCents: 0,
      canceled: false,
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const eventB: Evento = { ...eventA, id: "ev-b", name: "Evento B" };
    const itemA: EventService = {
      id: "es-a",
      eventId: "ev-a",
      serviceId: "svc-1",
      variantId: null,
      priceCents: 100_000,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const itemB: EventService = {
      id: "es-b",
      eventId: "ev-b",
      serviceId: "svc-1",
      variantId: null,
      priceCents: 999_000,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    saveDB(makeEmptyDB({ events: [eventA, eventB], eventServices: [itemA, itemB] }));

    const { result } = renderHook(() => ({ a: useEventFinancials("ev-a"), b: useEventFinancials("ev-b") }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.a).not.toBeUndefined());
    await waitFor(() => expect(result.current.b).not.toBeUndefined());

    // If the hook (wrongly) passed the whole eventServices table to calc's
    // eventFinancials, both events would report the same inflated total.
    expect(result.current.a?.contractCents).toBe(100_000);
    expect(result.current.b?.contractCents).toBe(999_000);
  });
});

describe("useCreateTransaction / useTransactions", () => {
  test("a created transaction shows up in useTransactions once the mutation invalidates the list", async () => {
    resetDB();
    const { result } = renderHook(() => ({ create: useCreateTransaction(), list: useTransactions() }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const before = result.current.list.data!.length;

    act(() => {
      result.current.create.mutate({
        kind: "in",
        amountCents: 12_345,
        date: todayISO(),
        categoryId: "cat-outras-receitas",
        eventId: null,
        description: "Teste de criação via hook",
      });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.list.data!.length).toBe(before + 1));
    expect(result.current.list.data!.some((tx) => tx.description === "Teste de criação via hook")).toBe(true);
  });
});

describe("useConvertLead", () => {
  test("surfaces the store's pt-BR error message when the proposal isn't accepted", async () => {
    resetDB(); // seed's "proposal-marcos" is status "sent", not "accepted"
    const { result } = renderHook(() => useConvertLead(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        contactId: "contact-marcos",
        proposalId: "proposal-marcos",
        eventName: "Não deveria converter",
        eventTypeId: "type-casamento",
        eventDate: "2026-12-01",
        eventTime: null,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/dados informados/i);
  });
});

describe("useDueFollowups", () => {
  test("joins each due activity with its contact and only includes due-today/overdue, not future, activities", async () => {
    resetDB(); // seed guarantees a due-today and an overdue follow-up, plus a future one
    const { result } = renderHook(() => useDueFollowups(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current).not.toBeUndefined());
    const followups = result.current!;

    const dueToday = followups.find((f) => f.activity.id === "act-juliana-1");
    const overdue = followups.find((f) => f.activity.id === "act-marcos-1");
    expect(dueToday?.contact.id).toBe("contact-juliana");
    expect(overdue?.contact.id).toBe("contact-marcos");
    // act-beatriz-1 is due 5 days from now — must not show up as "due".
    expect(followups.some((f) => f.activity.id === "act-beatriz-1")).toBe(false);
  });

  test("skips a due/overdue activity whose contact is archived", async () => {
    resetDB();
    // contact-lucas is seeded already archived. Give them an overdue
    // follow-up via the store oracle — same technique the seed's own
    // act-marcos-1/act-juliana-1 fixtures stand in for elsewhere in this
    // suite — one that would otherwise show up as due.
    crud("activities").create({
      contactId: "contact-lucas",
      content: "Follow-up de um lead já arquivado — não deve aparecer no banner.",
      dueDate: todayISO(),
      done: false,
      createdBy: "profile-bia",
    });

    const { result } = renderHook(() => useDueFollowups(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current).not.toBeUndefined());
    const followups = result.current!;

    expect(followups.some((f) => f.contact.id === "contact-lucas")).toBe(false);
  });
});
