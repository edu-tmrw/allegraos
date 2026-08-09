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
 * Closed windows on both ends (fix pós-F1 — a janela aberta deixava um
 * evento de 2027 contar em "Este ano"):
 * - 'year': 1º de janeiro a 31 de dezembro do ano corrente — eventos
 *   futuros DESTE ano contam como vendidos no ano; de outros anos, não.
 * - '12m': de hoje−12 meses até hoje, inclusivo — "últimos 12 meses"
 *   literal, sem datas futuras.
 * - 'all': sem filtro.
 */
export function periodToRange(period: DashboardPeriod): { from?: string; to?: string } | undefined {
  if (period === "all") return undefined;
  const today = todayISO();
  if (period === "year") {
    const year = today.slice(0, 4);
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  return { from: format(subMonths(parseISO(today), 12), "yyyy-MM-dd"), to: today };
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
