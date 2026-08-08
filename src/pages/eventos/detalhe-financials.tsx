/**
 * The event detail page's 5 financial stat cards (Contrato/Recebido/A
 * receber/Custo/Lucro), driven entirely by `useEventFinancials` — no math
 * lives here, only presentation. The caller (`detalhe.tsx`) is responsible
 * for only mounting this when the viewer has `manageFinance`.
 */
import type { ReactNode } from "react";
import { Money } from "@/components/money";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEventFinancials } from "@/data/hooks/use-events";

const GRID_CLASSNAME = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";

function StatCard({
  testId,
  label,
  note,
  children,
}: {
  testId: string;
  label: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="text-lg">{children}</div>
        {note}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-24" />
      </CardContent>
    </Card>
  );
}

export function EventoFinancialCards({ eventId }: { eventId: string }) {
  const financials = useEventFinancials(eventId);

  if (!financials) {
    return (
      <div className={GRID_CLASSNAME}>
        {Array.from({ length: 5 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const { contractCents, receivedCents, costCents, profitCents, receivableCents } = financials;
  // Spec §9: overpaying isn't blocked anywhere — just surfaced as a note.
  const excessCents = receivedCents - contractCents;

  return (
    <div className={GRID_CLASSNAME}>
      <StatCard testId="stat-contrato" label="Contrato">
        <Money cents={contractCents} />
      </StatCard>
      <StatCard testId="stat-recebido" label="Recebido">
        <Money cents={receivedCents} />
      </StatCard>
      <StatCard
        testId="stat-a-receber"
        label="A receber"
        note={
          excessCents > 0 ? (
            <p className="text-xs text-muted-foreground">
              Recebido excede o contrato em <Money cents={excessCents} className="text-xs" />
            </p>
          ) : undefined
        }
      >
        <Money cents={receivableCents} />
      </StatCard>
      <StatCard testId="stat-custo" label="Custo">
        <Money cents={costCents} />
      </StatCard>
      <StatCard testId="stat-lucro" label="Lucro">
        <Money cents={profitCents} className={profitCents < 0 ? "text-negative" : undefined} />
      </StatCard>
    </div>
  );
}
