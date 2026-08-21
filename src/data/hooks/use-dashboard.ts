import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subMonths } from "date-fns";
import { QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";
import { supabase } from "@/data/supabase/client";
import { unwrap } from "@/data/supabase/result";
import { toEvento } from "@/data/supabase/rows";
import type { Evento } from "@/domain/types";
import { todayISO } from "@/lib/format";

export type DashboardPeriod = "year" | "12m" | "all";

interface MonthlyFlowRow {
  month: string;
  revenueCents: number;
  expensesCents: number;
  profitCents: number;
}

interface ServiceSaleRow {
  serviceId: string;
  name: string;
  totalCents: number;
}

interface CategoryExpenseRow {
  categoryId: string;
  name: string;
  totalCents: number;
}

export interface DashboardData {
  cashCents: number;
  receivableCents: number;
  monthRevenueCents: number;
  monthProfitCents: number;
  flow12: MonthlyFlowRow[];
  serviceSales: ServiceSaleRow[];
  categoryExpenses: CategoryExpenseRow[];
  upcoming: Evento[];
}

export function periodToRange(period: DashboardPeriod): { from?: string; to?: string } | undefined {
  if (period === "all") return undefined;
  const today = todayISO();
  if (period === "year") {
    const year = today.slice(0, 4);
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  return { from: format(subMonths(parseISO(today), 12), "yyyy-MM-dd"), to: today };
}

function useCashPosition() {
  return useQuery({
    queryKey: [...queryKeys.dashboard, "cash"],
    queryFn: async () => {
      const rows = unwrap(await supabase.from("v_cash_position").select("cash_cents").limit(1));
      return rows[0]?.cash_cents ?? 0;
    },
    ...QUERY_DEFAULTS,
  });
}

function useReceivableTotal() {
  return useQuery({
    queryKey: [...queryKeys.dashboard, "receivable"],
    queryFn: async () => {
      const rows = unwrap(await supabase.from("v_event_financials").select("receivable_cents"));
      return rows.reduce((total, row) => total + (row.receivable_cents ?? 0), 0);
    },
    ...QUERY_DEFAULTS,
  });
}

function useMonthlyFlow() {
  const today = todayISO();
  const months = Array.from({ length: 12 }, (_, index) => format(subMonths(parseISO(today), 11 - index), "yyyy-MM"));
  return useQuery({
    queryKey: [...queryKeys.dashboard, "monthlyFlow", months[0], months[11]],
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from("v_monthly_flow")
          .select("month, revenue_cents, expenses_cents, profit_cents")
          .gte("month", `${months[0]}-01`)
          .lte("month", `${months[11]}-01`)
          .order("month", { ascending: true }),
      );
      const byMonth = new Map(rows.flatMap((row) => row.month ? [[row.month.slice(0, 7), row] as const] : []));
      return months.map((month) => {
        const row = byMonth.get(month);
        return {
          month,
          revenueCents: row?.revenue_cents ?? 0,
          expensesCents: row?.expenses_cents ?? 0,
          profitCents: row?.profit_cents ?? 0,
        };
      });
    },
    ...QUERY_DEFAULTS,
  });
}

function applyDateRange<T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(
  query: T,
  column: string,
  range: { from?: string; to?: string } | undefined,
): T {
  let filtered = query;
  if (range?.from) filtered = filtered.gte(column, range.from);
  if (range?.to) filtered = filtered.lte(column, range.to);
  return filtered;
}

function useServiceSales(period: DashboardPeriod) {
  const range = periodToRange(period);
  return useQuery({
    queryKey: [...queryKeys.dashboard, "serviceSales", period],
    queryFn: async () => {
      let query = supabase.from("v_service_sales").select("service_id, service_name, price_cents, closed_at");
      if (range?.from) query = query.gte("closed_at", `${range.from}T00:00:00`);
      if (range?.to) query = query.lte("closed_at", `${range.to}T23:59:59.999999`);
      const rows = unwrap(await query);
      const totals = new Map<string, { name: string; totalCents: number }>();
      for (const row of rows) {
        if (!row.service_id || !row.service_name || row.price_cents === null) continue;
        const current = totals.get(row.service_id) ?? { name: row.service_name, totalCents: 0 };
        current.totalCents += row.price_cents;
        totals.set(row.service_id, current);
      }
      return [...totals.entries()]
        .map(([serviceId, value]) => ({ serviceId, ...value }))
        .sort((left, right) => right.totalCents - left.totalCents);
    },
    ...QUERY_DEFAULTS,
  });
}

function useCategoryExpenses(period: DashboardPeriod) {
  const range = periodToRange(period);
  return useQuery({
    queryKey: [...queryKeys.dashboard, "categoryExpenses", period],
    queryFn: async () => {
      let query = supabase.from("v_category_expenses").select("category_id, category_name, date, total_cents");
      query = applyDateRange(query, "date", range);
      const rows = unwrap(await query);
      const totals = new Map<string, { name: string; totalCents: number }>();
      for (const row of rows) {
        if (!row.category_id || !row.category_name || row.total_cents === null) continue;
        const current = totals.get(row.category_id) ?? { name: row.category_name, totalCents: 0 };
        current.totalCents += row.total_cents;
        totals.set(row.category_id, current);
      }
      return [...totals.entries()]
        .map(([categoryId, value]) => ({ categoryId, ...value }))
        .sort((left, right) => right.totalCents - left.totalCents);
    },
    ...QUERY_DEFAULTS,
  });
}

function useUpcomingEvents() {
  const today = todayISO();
  return useQuery({
    queryKey: [...queryKeys.dashboard, "upcoming", today],
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from("events")
          .select("*")
          .eq("canceled", false)
          .gte("event_date", today)
          .order("event_date", { ascending: true })
          .order("event_time", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true })
          .limit(5),
      );
      return rows.map(toEvento);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useDashboardData(period: DashboardPeriod): DashboardData | undefined {
  const cash = useCashPosition();
  const receivable = useReceivableTotal();
  const flow = useMonthlyFlow();
  const serviceSales = useServiceSales(period);
  const categoryExpenses = useCategoryExpenses(period);
  const upcoming = useUpcomingEvents();

  return useMemo(() => {
    if (
      cash.data === undefined || receivable.data === undefined || !flow.data ||
      !serviceSales.data || !categoryExpenses.data || !upcoming.data
    ) return undefined;
    const currentMonth = flow.data[flow.data.length - 1];
    return {
      cashCents: cash.data,
      receivableCents: receivable.data,
      monthRevenueCents: currentMonth.revenueCents,
      monthProfitCents: currentMonth.profitCents,
      flow12: flow.data,
      serviceSales: serviceSales.data,
      categoryExpenses: categoryExpenses.data,
      upcoming: upcoming.data,
    };
  }, [cash.data, receivable.data, flow.data, serviceSales.data, categoryExpenses.data, upcoming.data]);
}
