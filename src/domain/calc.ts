/**
 * Pure financial/derivation calculations for AllegraOS. No storage, no
 * I/O, no `Date.now()` — every "today" is passed in explicitly as
 * `todayISO` so results are deterministic and testable. These functions
 * are the oracle later SQL views must match.
 */
import type {
  Evento,
  EventService,
  Service,
  Transaction,
  TransactionCategory,
} from "@/domain/types";

/**
 * Derives an event's status. `canceled` always wins over the date check;
 * otherwise an event dated strictly before today is "concluido", and an
 * event dated today or in the future is "ativo".
 */
export function eventStatus(
  ev: Evento,
  todayISO: string,
): "ativo" | "concluido" | "cancelado" {
  if (ev.canceled) return "cancelado";
  return ev.eventDate < todayISO ? "concluido" : "ativo";
}

/** Sum of item prices minus the discount, clamped so it never goes below 0. */
export function contractCents(
  items: Pick<EventService, "priceCents">[],
  discountCents: number,
): number {
  const total = items.reduce((sum, item) => sum + item.priceCents, 0);
  return Math.max(total - discountCents, 0);
}

/**
 * Financial summary for one event. `txs` may contain transactions from
 * other events (or none) — only those matching `ev.id` count towards
 * received/cost. `receivableCents` is 0 for a canceled event and never
 * negative (an overpayment doesn't produce a negative receivable).
 */
export function eventFinancials(
  ev: Evento,
  items: EventService[],
  txs: Transaction[],
): {
  contractCents: number;
  receivedCents: number;
  costCents: number;
  profitCents: number;
  receivableCents: number;
} {
  const ownTxs = txs.filter((tx) => tx.eventId === ev.id);
  const receivedCents = ownTxs
    .filter((tx) => tx.kind === "in")
    .reduce((sum, tx) => sum + tx.amountCents, 0);
  const costCents = ownTxs
    .filter((tx) => tx.kind === "out")
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  const contract = contractCents(items, ev.discountCents);
  const profitCents = receivedCents - costCents;
  const receivableCents = ev.canceled ? 0 : Math.max(contract - receivedCents, 0);

  return { contractCents: contract, receivedCents, costCents, profitCents, receivableCents };
}

/** Net cash position: sum of all "in" minus all "out", across every event (and admin/no-event entries). */
export function cashPositionCents(txs: Transaction[]): number {
  return txs.reduce(
    (sum, tx) => sum + (tx.kind === "in" ? tx.amountCents : -tx.amountCents),
    0,
  );
}

/**
 * Sum of receivable across every non-canceled event. An event with no
 * entry in `itemsByEvent` is treated as having no items (contract 0).
 */
export function totalReceivableCents(
  events: Evento[],
  itemsByEvent: Record<string, EventService[]>,
  txs: Transaction[],
): number {
  return events
    .filter((ev) => !ev.canceled)
    .reduce((sum, ev) => {
      const items = itemsByEvent[ev.id] ?? [];
      return sum + eventFinancials(ev, items, txs).receivableCents;
    }, 0);
}

/**
 * Shifts a "YYYY-MM" month string by `delta` months (negative goes back).
 * Plain integer arithmetic on year*12+month — no `Date` involved, so
 * there's no timezone or month-length overflow to worry about.
 */
function shiftMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/**
 * Revenue/expenses/profit per month, for a continuous window of
 * `monthsBack` months ending at `todayISO`'s month (oldest first). Months
 * with no matching transactions are zeroed; transactions outside the
 * window are ignored.
 */
export function monthlyFlow(
  txs: Transaction[],
  monthsBack: number,
  todayISO: string,
): { month: string; revenueCents: number; expensesCents: number; profitCents: number }[] {
  const currentMonth = todayISO.slice(0, 7);
  const months = Array.from({ length: monthsBack }, (_, i) =>
    shiftMonth(currentMonth, i - (monthsBack - 1)),
  );

  const buckets = new Map<string, { revenueCents: number; expensesCents: number }>(
    months.map((month) => [month, { revenueCents: 0, expensesCents: 0 }]),
  );

  for (const tx of txs) {
    const bucket = buckets.get(tx.date.slice(0, 7));
    if (!bucket) continue;
    if (tx.kind === "in") bucket.revenueCents += tx.amountCents;
    else bucket.expensesCents += tx.amountCents;
  }

  return months.map((month) => {
    const { revenueCents, expensesCents } = buckets.get(month)!;
    return { month, revenueCents, expensesCents, profitCents: revenueCents - expensesCents };
  });
}

/**
 * One row per sold item of each non-canceled event, carrying the event's
 * own date (not the item's `createdAt`) — the shape the dashboard donut
 * groups and filters by period.
 */
export function serviceSalesRows(
  events: Evento[],
  items: EventService[],
): { serviceId: string; priceCents: number; eventDate: string }[] {
  const activeEventDateById = new Map(
    events.filter((ev) => !ev.canceled).map((ev) => [ev.id, ev.eventDate]),
  );

  return items
    .filter((item) => activeEventDateById.has(item.eventId))
    .map((item) => ({
      serviceId: item.serviceId,
      priceCents: item.priceCents,
      eventDate: activeEventDateById.get(item.eventId)!,
    }));
}

/**
 * Whether an ISO date string falls within `[period.from, period.to]`
 * (each bound inclusive and optional). An undefined `period` matches
 * everything. "YYYY-MM-DD" strings compare correctly with `<`/`>`.
 */
function inPeriod(dateISO: string, period?: { from?: string; to?: string }): boolean {
  if (period?.from && dateISO < period.from) return false;
  if (period?.to && dateISO > period.to) return false;
  return true;
}

/**
 * Groups sales rows by service within an optional period, filtering by
 * `eventDate`. Names come from `services`; services with no matching
 * sales are omitted. Sorted by total descending.
 */
export function groupSalesByService(
  rows: ReturnType<typeof serviceSalesRows>,
  services: Service[],
  period?: { from?: string; to?: string },
): { serviceId: string; name: string; totalCents: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!inPeriod(row.eventDate, period)) continue;
    totals.set(row.serviceId, (totals.get(row.serviceId) ?? 0) + row.priceCents);
  }

  const nameById = new Map(services.map((service) => [service.id, service.name]));

  return Array.from(totals.entries())
    .map(([serviceId, totalCents]) => ({
      serviceId,
      name: nameById.get(serviceId) ?? "",
      totalCents,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/** Lexicographic compare, `<0`/`0`/`>0`, for strings that are already known to differ or be equal. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Expenses (`kind === "out"` only) grouped by category within an optional
 * period, filtering by `tx.date`. Names come from `categories`; categories
 * with no expenses are omitted. Sorted by total descending.
 */
export function categoryExpenses(
  txs: Transaction[],
  categories: TransactionCategory[],
  period?: { from?: string; to?: string },
): { categoryId: string; name: string; totalCents: number }[] {
  const totals = new Map<string, number>();
  for (const tx of txs) {
    if (tx.kind !== "out") continue;
    if (!inPeriod(tx.date, period)) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amountCents);
  }

  const nameById = new Map(categories.map((category) => [category.id, category.name]));

  return Array.from(totals.entries())
    .map(([categoryId, totalCents]) => ({
      categoryId,
      name: nameById.get(categoryId) ?? "",
      totalCents,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/**
 * Non-canceled events dated today or later, soonest first: sorted by
 * `eventDate` ascending, then `eventTime` ascending with a null time
 * (no scheduled time yet) sorted last, then `name` ascending. Returns at
 * most `limit` events.
 */
export function upcomingEvents(events: Evento[], todayISO: string, limit: number): Evento[] {
  return events
    .filter((ev) => !ev.canceled && ev.eventDate >= todayISO)
    .sort((a, b) => {
      if (a.eventDate !== b.eventDate) return compareStrings(a.eventDate, b.eventDate);
      if (a.eventTime !== b.eventTime) {
        if (a.eventTime === null) return 1;
        if (b.eventTime === null) return -1;
        return compareStrings(a.eventTime, b.eventTime);
      }
      return compareStrings(a.name, b.name);
    })
    .slice(0, limit);
}
