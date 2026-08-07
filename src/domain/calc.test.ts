import { describe, expect, test } from "vitest";
import {
  cashPositionCents,
  categoryExpenses,
  contractCents,
  eventFinancials,
  eventStatus,
  groupSalesByService,
  monthlyFlow,
  serviceSalesRows,
  totalReceivableCents,
  upcomingEvents,
} from "@/domain/calc";
import type {
  EventService,
  Evento,
  Service,
  Transaction,
  TransactionCategory,
} from "@/domain/types";

function makeEvento(overrides: Partial<Evento> = {}): Evento {
  return {
    id: "ev-1",
    name: "Casamento Ana & Bruno",
    eventTypeId: "type-1",
    eventDate: "2026-08-07",
    eventTime: null,
    contactId: null,
    discountCents: 0,
    canceled: false,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeEventService(overrides: Partial<EventService> = {}): EventService {
  return {
    id: "es-1",
    eventId: "ev-1",
    serviceId: "svc-1",
    variantId: null,
    priceCents: 100_000,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    kind: "in",
    amountCents: 10_000,
    date: "2026-01-01",
    categoryId: "cat-1",
    eventId: null,
    description: null,
    createdBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("eventStatus", () => {
  test("event date equal to today is ativo", () => {
    const ev = makeEvento({ eventDate: "2026-08-07", canceled: false });
    expect(eventStatus(ev, "2026-08-07")).toBe("ativo");
  });

  test("event date in the past (yesterday) is concluido", () => {
    const ev = makeEvento({ eventDate: "2026-08-06", canceled: false });
    expect(eventStatus(ev, "2026-08-07")).toBe("concluido");
  });

  test("event date in the future is ativo", () => {
    const ev = makeEvento({ eventDate: "2026-08-08", canceled: false });
    expect(eventStatus(ev, "2026-08-07")).toBe("ativo");
  });

  test("canceled wins over a future date", () => {
    const ev = makeEvento({ eventDate: "2026-12-31", canceled: true });
    expect(eventStatus(ev, "2026-08-07")).toBe("cancelado");
  });

  test("canceled wins over a past date", () => {
    const ev = makeEvento({ eventDate: "2020-01-01", canceled: true });
    expect(eventStatus(ev, "2026-08-07")).toBe("cancelado");
  });
});

describe("contractCents", () => {
  test("sums item prices and subtracts the discount", () => {
    const items = [{ priceCents: 100_000 }, { priceCents: 50_000 }];
    expect(contractCents(items, 20_000)).toBe(130_000);
  });

  test("clamps to 0 when the discount exceeds the sum of items", () => {
    const items = [{ priceCents: 10_000 }];
    expect(contractCents(items, 50_000)).toBe(0);
  });

  test("discount exactly equal to the sum is 0, not negative", () => {
    const items = [{ priceCents: 10_000 }, { priceCents: 5_000 }];
    expect(contractCents(items, 15_000)).toBe(0);
  });

  test("no items and no discount is 0", () => {
    expect(contractCents([], 0)).toBe(0);
  });
});

describe("eventFinancials", () => {
  test("computes contract, received, cost, profit and receivable from the event's own transactions", () => {
    const ev = makeEvento({ id: "ev-1", discountCents: 10_000 });
    const items = [makeEventService({ eventId: "ev-1", priceCents: 100_000 })];
    const txs = [
      makeTransaction({ eventId: "ev-1", kind: "in", amountCents: 40_000 }),
      makeTransaction({ eventId: "ev-1", kind: "out", amountCents: 5_000 }),
    ];

    expect(eventFinancials(ev, items, txs)).toEqual({
      contractCents: 90_000,
      receivedCents: 40_000,
      costCents: 5_000,
      profitCents: 35_000,
      receivableCents: 50_000,
    });
  });

  test("ignores transactions belonging to other events or to no event", () => {
    const ev = makeEvento({ id: "ev-1", discountCents: 0 });
    const items = [makeEventService({ eventId: "ev-1", priceCents: 100_000 })];
    const txs = [
      makeTransaction({ eventId: "ev-1", kind: "in", amountCents: 20_000 }),
      makeTransaction({ eventId: "ev-2", kind: "in", amountCents: 999_000 }),
      makeTransaction({ eventId: null, kind: "out", amountCents: 500_000 }),
    ];

    const result = eventFinancials(ev, items, txs);

    expect(result.receivedCents).toBe(20_000);
    expect(result.costCents).toBe(0);
  });

  test("receivable is 0 when canceled, even though the contract exceeds what was received", () => {
    const ev = makeEvento({ id: "ev-1", discountCents: 0, canceled: true });
    const items = [makeEventService({ eventId: "ev-1", priceCents: 100_000 })];
    const txs = [makeTransaction({ eventId: "ev-1", kind: "in", amountCents: 10_000 })];

    expect(eventFinancials(ev, items, txs).receivableCents).toBe(0);
  });

  test("receivable is 0 (not negative) when received exceeds the contract", () => {
    const ev = makeEvento({ id: "ev-1", discountCents: 0, canceled: false });
    const items = [makeEventService({ eventId: "ev-1", priceCents: 100_000 })];
    const txs = [makeTransaction({ eventId: "ev-1", kind: "in", amountCents: 150_000 })];

    const result = eventFinancials(ev, items, txs);

    expect(result.receivableCents).toBe(0);
    expect(result.receivedCents).toBe(150_000);
    expect(result.profitCents).toBe(150_000);
  });
});

describe("cashPositionCents", () => {
  test("sums all in and subtracts all out, across events and administrative (no-event) transactions", () => {
    const txs = [
      makeTransaction({ eventId: "ev-1", kind: "in", amountCents: 100_000 }),
      makeTransaction({ eventId: "ev-2", kind: "in", amountCents: 50_000 }),
      makeTransaction({ eventId: null, kind: "out", amountCents: 20_000 }),
      makeTransaction({ eventId: "ev-1", kind: "out", amountCents: 30_000 }),
    ];

    expect(cashPositionCents(txs)).toBe(100_000 + 50_000 - 20_000 - 30_000);
  });

  test("no transactions is 0", () => {
    expect(cashPositionCents([])).toBe(0);
  });
});

describe("totalReceivableCents", () => {
  test("sums receivable across non-canceled events, treating a missing itemsByEvent entry as no items", () => {
    const ev1 = makeEvento({ id: "ev-1", discountCents: 0, canceled: false });
    const ev2 = makeEvento({ id: "ev-2", discountCents: 0, canceled: true });
    const ev3 = makeEvento({ id: "ev-3", discountCents: 0, canceled: false });

    const itemsByEvent: Record<string, EventService[]> = {
      "ev-1": [makeEventService({ eventId: "ev-1", priceCents: 100_000 })],
      "ev-2": [makeEventService({ eventId: "ev-2", priceCents: 200_000 })],
      // "ev-3" intentionally has no entry at all.
    };

    const txs = [makeTransaction({ eventId: "ev-1", kind: "in", amountCents: 30_000 })];

    // ev-1 receivable = 100_000 - 30_000 = 70_000
    // ev-2 excluded (canceled)
    // ev-3 receivable = 0 (no items → contract 0)
    expect(totalReceivableCents([ev1, ev2, ev3], itemsByEvent, txs)).toBe(70_000);
  });
});

describe("monthlyFlow", () => {
  test("produces continuous months ending at today's month, zeroed when there are no transactions", () => {
    const result = monthlyFlow([], 12, "2026-08-07");

    expect(result.map((r) => r.month)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(
      result.every((r) => r.revenueCents === 0 && r.expensesCents === 0 && r.profitCents === 0),
    ).toBe(true);
  });

  test("buckets transactions by month and computes profit; ignores transactions outside the window", () => {
    const txs = [
      makeTransaction({ date: "2026-08-01", kind: "in", amountCents: 100_000 }),
      makeTransaction({ date: "2026-08-15", kind: "out", amountCents: 30_000 }),
      makeTransaction({ date: "2025-09-10", kind: "in", amountCents: 5_000 }),
      makeTransaction({ date: "2020-01-01", kind: "in", amountCents: 999_999 }), // outside the 12-month window
    ];

    const result = monthlyFlow(txs, 12, "2026-08-07");

    expect(result.find((r) => r.month === "2026-08")).toEqual({
      month: "2026-08",
      revenueCents: 100_000,
      expensesCents: 30_000,
      profitCents: 70_000,
    });
    expect(result.find((r) => r.month === "2025-09")).toEqual({
      month: "2025-09",
      revenueCents: 5_000,
      expensesCents: 0,
      profitCents: 5_000,
    });
    const totalRevenue = result.reduce((sum, r) => sum + r.revenueCents, 0);
    expect(totalRevenue).toBe(105_000); // the 2020 transaction must not land anywhere
  });

  test("monthsBack=1 returns only the current month", () => {
    const result = monthlyFlow([], 1, "2026-08-07");
    expect(result).toEqual([{ month: "2026-08", revenueCents: 0, expensesCents: 0, profitCents: 0 }]);
  });

  test("profit is not clamped and can be negative", () => {
    const txs = [makeTransaction({ date: "2026-08-05", kind: "out", amountCents: 50_000 })];
    const result = monthlyFlow(txs, 1, "2026-08-07");
    expect(result[0].profitCents).toBe(-50_000);
  });
});

describe("serviceSalesRows", () => {
  test("emits one row per item of a non-canceled event, using the event's date", () => {
    const ev = makeEvento({ id: "ev-1", eventDate: "2026-03-15", canceled: false });
    const items = [
      makeEventService({ eventId: "ev-1", serviceId: "svc-1", priceCents: 100_000 }),
      makeEventService({ eventId: "ev-1", serviceId: "svc-2", priceCents: 50_000 }),
    ];

    expect(serviceSalesRows([ev], items)).toEqual([
      { serviceId: "svc-1", priceCents: 100_000, eventDate: "2026-03-15" },
      { serviceId: "svc-2", priceCents: 50_000, eventDate: "2026-03-15" },
    ]);
  });

  test("excludes items belonging to a canceled event", () => {
    const active = makeEvento({ id: "ev-1", eventDate: "2026-03-15", canceled: false });
    const canceled = makeEvento({ id: "ev-2", eventDate: "2026-04-01", canceled: true });
    const items = [
      makeEventService({ eventId: "ev-1", serviceId: "svc-1", priceCents: 100_000 }),
      makeEventService({ eventId: "ev-2", serviceId: "svc-2", priceCents: 999_000 }),
    ];

    const rows = serviceSalesRows([active, canceled], items);

    expect(rows).toEqual([{ serviceId: "svc-1", priceCents: 100_000, eventDate: "2026-03-15" }]);
  });
});

describe("groupSalesByService", () => {
  test("groups rows by service, looks up names, sorts by total desc; services with no sales are omitted", () => {
    const rows = [
      { serviceId: "svc-1", priceCents: 100_000, eventDate: "2026-01-10" },
      { serviceId: "svc-1", priceCents: 50_000, eventDate: "2026-02-10" },
      { serviceId: "svc-2", priceCents: 200_000, eventDate: "2026-01-15" },
      { serviceId: "svc-3", priceCents: 10_000, eventDate: "2025-01-01" },
    ];
    const services: Service[] = [
      { id: "svc-1", name: "Buffet", defaultPriceCents: null, active: true },
      { id: "svc-2", name: "Orquestra", defaultPriceCents: null, active: true },
      { id: "svc-3", name: "Decoração", defaultPriceCents: 10_000, active: true },
      { id: "svc-4", name: "DJ", defaultPriceCents: 50_000, active: true },
    ];

    expect(groupSalesByService(rows, services)).toEqual([
      { serviceId: "svc-2", name: "Orquestra", totalCents: 200_000 },
      { serviceId: "svc-1", name: "Buffet", totalCents: 150_000 },
      { serviceId: "svc-3", name: "Decoração", totalCents: 10_000 },
    ]);
  });

  test("filters rows by eventDate within an inclusive [from, to] period", () => {
    const rows = [
      { serviceId: "svc-1", priceCents: 100_000, eventDate: "2026-01-01" }, // == from, included
      { serviceId: "svc-1", priceCents: 50_000, eventDate: "2026-01-31" }, // == to, included
      { serviceId: "svc-1", priceCents: 999_000, eventDate: "2025-12-31" }, // before from, excluded
      { serviceId: "svc-1", priceCents: 999_000, eventDate: "2026-02-01" }, // after to, excluded
    ];
    const services: Service[] = [{ id: "svc-1", name: "Buffet", defaultPriceCents: null, active: true }];

    expect(
      groupSalesByService(rows, services, { from: "2026-01-01", to: "2026-01-31" }),
    ).toEqual([{ serviceId: "svc-1", name: "Buffet", totalCents: 150_000 }]);
  });
});

describe("categoryExpenses", () => {
  test("counts only 'out' transactions, grouped by category, sorted desc; categories with no expenses are omitted", () => {
    const txs = [
      makeTransaction({ kind: "out", categoryId: "cat-1", amountCents: 50_000, date: "2026-01-10" }),
      makeTransaction({ kind: "out", categoryId: "cat-1", amountCents: 20_000, date: "2026-01-20" }),
      makeTransaction({ kind: "out", categoryId: "cat-2", amountCents: 100_000, date: "2026-01-05" }),
      makeTransaction({ kind: "in", categoryId: "cat-1", amountCents: 999_000, date: "2026-01-10" }),
    ];
    const categories: TransactionCategory[] = [
      { id: "cat-1", name: "Salão", kind: "out", active: true },
      { id: "cat-2", name: "Marketing", kind: "out", active: true },
      { id: "cat-3", name: "Equipe", kind: "out", active: true },
    ];

    expect(categoryExpenses(txs, categories)).toEqual([
      { categoryId: "cat-2", name: "Marketing", totalCents: 100_000 },
      { categoryId: "cat-1", name: "Salão", totalCents: 70_000 },
    ]);
  });

  test("filters by tx.date within an inclusive [from, to] period", () => {
    const txs = [
      makeTransaction({ kind: "out", categoryId: "cat-1", amountCents: 50_000, date: "2026-01-01" }), // == from
      makeTransaction({ kind: "out", categoryId: "cat-1", amountCents: 30_000, date: "2026-01-31" }), // == to
      makeTransaction({ kind: "out", categoryId: "cat-1", amountCents: 999_000, date: "2025-12-31" }), // excluded
      makeTransaction({ kind: "out", categoryId: "cat-1", amountCents: 999_000, date: "2026-02-01" }), // excluded
    ];
    const categories: TransactionCategory[] = [{ id: "cat-1", name: "Salão", kind: "out", active: true }];

    expect(
      categoryExpenses(txs, categories, { from: "2026-01-01", to: "2026-01-31" }),
    ).toEqual([{ categoryId: "cat-1", name: "Salão", totalCents: 80_000 }]);
  });
});

describe("upcomingEvents", () => {
  test("includes only non-canceled events today or later, sorted by date ascending, respecting the limit", () => {
    const past = makeEvento({ id: "past", eventDate: "2026-08-06", name: "Passado" });
    const canceled = makeEvento({
      id: "canceled",
      eventDate: "2026-08-20",
      canceled: true,
      name: "Cancelado",
    });
    const today = makeEvento({ id: "today", eventDate: "2026-08-07", name: "Hoje" });
    const soon = makeEvento({ id: "soon", eventDate: "2026-08-09", name: "Em breve" });
    const later = makeEvento({ id: "later", eventDate: "2026-08-20", name: "Depois" });

    const result = upcomingEvents([past, canceled, today, soon, later], "2026-08-07", 2);

    expect(result.map((ev) => ev.id)).toEqual(["today", "soon"]);
  });

  test("on the same date, sorts by time ascending with a null time last, then by name", () => {
    const withTimeLate = makeEvento({
      id: "late",
      eventDate: "2026-08-09",
      eventTime: "19:00",
      name: "Zulu",
    });
    const withTimeEarly = makeEvento({
      id: "early",
      eventDate: "2026-08-09",
      eventTime: "09:00",
      name: "Alfa",
    });
    const noTimeB = makeEvento({
      id: "no-time-b",
      eventDate: "2026-08-09",
      eventTime: null,
      name: "Bravo",
    });
    const noTimeA = makeEvento({
      id: "no-time-a",
      eventDate: "2026-08-09",
      eventTime: null,
      name: "Alfa2",
    });

    const result = upcomingEvents([withTimeLate, withTimeEarly, noTimeB, noTimeA], "2026-08-07", 10);

    expect(result.map((ev) => ev.id)).toEqual(["early", "late", "no-time-a", "no-time-b"]);
  });
});
