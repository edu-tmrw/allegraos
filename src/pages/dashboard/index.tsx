import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import { useDashboardData, type DashboardPeriod } from "@/data/hooks/use-dashboard";
import { CategoryBars } from "@/pages/dashboard/category-bars";
import { RevenueProfitChart } from "@/pages/dashboard/revenue-profit-chart";
import { ServiceDonut } from "@/pages/dashboard/service-donut";
import { StatCard } from "@/pages/dashboard/stat-card";
import { UpcomingEvents } from "@/pages/dashboard/upcoming-events";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[280px] rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[260px] rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

/**
 * The dashboard. `period` only ever reaches `useDashboardData` — it scopes
 * the donut + bars section alone (cards and the 12-month line have fixed
 * windows), so the period `<Select>` lives on that section's own header,
 * not up here next to the page title, to keep its scope honest.
 */
export function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("year");
  const data = useDashboardData(period);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl text-foreground">Dashboard</h1>

      {!data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Caixa atual">
              <Money cents={data.cashCents} />
            </StatCard>
            <StatCard label="A receber">
              <Money cents={data.receivableCents} />
            </StatCard>
            <StatCard label="Faturamento do mês">
              <Money cents={data.monthRevenueCents} />
            </StatCard>
            <StatCard label="Lucro do mês">
              {data.monthProfitCents < 0 ? (
                <Money cents={Math.abs(data.monthProfitCents)} kind="out" />
              ) : (
                <Money cents={data.monthProfitCents} />
              )}
            </StatCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Faturamento × Lucro (12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueProfitChart data={data.flow12} />
            </CardContent>
          </Card>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Período de análise</p>
              <Select value={period} onValueChange={(value) => setPeriod(value as DashboardPeriod)}>
                <SelectTrigger size="sm" className="w-[180px]" aria-label="Período de análise">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">Este ano</SelectItem>
                  <SelectItem value="12m">Últimos 12 meses</SelectItem>
                  <SelectItem value="all">Tudo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Contribuição por serviço</CardTitle>
                </CardHeader>
                <CardContent>
                  <ServiceDonut serviceSales={data.serviceSales} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Saídas por categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryBars categoryExpenses={data.categoryExpenses} />
                </CardContent>
              </Card>
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Próximos eventos</CardTitle>
            </CardHeader>
            <CardContent>
              <UpcomingEvents upcoming={data.upcoming} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
