/**
 * The dashboard's composed view. Deliberately has no query of its own and
 * no cache key: everything here is either read straight off another
 * exported hook's query, or (for `eventServices`, which every exported
 * hook only ever exposes pre-filtered by a specific event) a private
 * query reusing that resource's own registered key — so an existing
 * mutation's invalidation (of `events`/`transactions`/`eventServices`/...)
 * refreshes the dashboard for free, with nothing dashboard-specific to
 * keep in sync.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subMonths } from "date-fns";
import {
  cashPositionCents,
  categoryExpenses,
  groupSalesByService,
  monthlyFlow,
  serviceSalesRows,
  totalReceivableCents,
  upcomingEvents,
} from "@/domain/calc";
import { crud } from "@/data/store";
import { todayISO } from "@/lib/format";
import type { EventService, Evento } from "@/domain/types";
import { QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";
import { useCategories, useServices } from "@/data/hooks/use-settings";
import { useEvents } from "@/data/hooks/use-events";
import { useTransactions } from "@/data/hooks/use-transactions";

export type DashboardPeriod = "year" | "12m" | "all";

export interface DashboardData {
  cashCents: number;
  receivableCents: number;
  monthRevenueCents: number;
  monthProfitCents: number;
  flow12: ReturnType<typeof monthlyFlow>;
  serviceSales: ReturnType<typeof groupSalesByService>;
  categoryExpenses: ReturnType<typeof categoryExpenses>;
  upcoming: Evento[];
}

/**
 * `'year'`/`'12m'` are open-ended windows (no `to`): a near-future-dated
 * event or transaction still belongs to "this year"/"the last 12 months"
 * even if it hasn't happened yet. `'all'` means no filtering at all.
 */
export function periodToRange(period: DashboardPeriod): { from?: string; to?: string } | undefined {
  if (period === "all") return undefined;
  if (period === "year") {
    const year = todayISO().slice(0, 4);
    return { from: `${year}-01-01` };
  }
  return { from: format(subMonths(parseISO(todayISO()), 12), "yyyy-MM-dd") };
}

/**
 * All `eventServices`, unfiltered. No exported hook offers this shape (
 * `useEventServices` always scopes to one event), so this is the one place
 * the dashboard reads the store directly — under the resource's own
 * `queryKeys.eventServices`, not a new key.
 */
function useAllEventServices() {
  return useQuery({
    queryKey: queryKeys.eventServices,
    queryFn: () => crud("eventServices").list(),
    ...QUERY_DEFAULTS,
  });
}

export function useDashboardData(period: DashboardPeriod): DashboardData | undefined {
  const eventsQuery = useEvents();
  const transactionsQuery = useTransactions();
  const categoriesQuery = useCategories();
  const servicesQuery = useServices();
  const itemsQuery = useAllEventServices();

  return useMemo(() => {
    const events = eventsQuery.data;
    const txs = transactionsQuery.data;
    const categories = categoriesQuery.data;
    const services = servicesQuery.data;
    const items = itemsQuery.data;
    if (!events || !txs || !categories || !services || !items) return undefined;

    const today = todayISO();
    const range = periodToRange(period);

    const itemsByEvent: Record<string, EventService[]> = {};
    for (const item of items) {
      (itemsByEvent[item.eventId] ??= []).push(item);
    }

    const flow12 = monthlyFlow(txs, 12, today);
    const lastMonth = flow12[flow12.length - 1];

    return {
      cashCents: cashPositionCents(txs),
      receivableCents: totalReceivableCents(events, itemsByEvent, txs),
      monthRevenueCents: lastMonth.revenueCents,
      monthProfitCents: lastMonth.profitCents,
      flow12,
      serviceSales: groupSalesByService(serviceSalesRows(events, items), services, range),
      categoryExpenses: categoryExpenses(txs, categories, range),
      upcoming: upcomingEvents(events, today, 5),
    };
  }, [eventsQuery.data, transactionsQuery.data, categoriesQuery.data, servicesQuery.data, itemsQuery.data, period]);
}
