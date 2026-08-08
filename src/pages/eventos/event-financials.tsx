/**
 * Per-event financial cells for the Eventos list. Split into their own
 * components (rather than computed inline in a `.map()`) so each row's
 * `useEventFinancials` is its own hook call tied to its own component
 * instance — calling it directly inside a loop body would violate the
 * Rules of Hooks the moment the list's length changes between renders.
 */
import { Money } from "@/components/money";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell } from "@/components/ui/table";
import { useEventFinancials } from "@/data/hooks/use-events";

/** Desktop table's Contrato / Recebido / A receber cells for one event. */
export function EventRowFinancials({ eventId }: { eventId: string }) {
  const financials = useEventFinancials(eventId);

  if (!financials) {
    return (
      <>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
      </>
    );
  }

  return (
    <>
      <TableCell className="text-right">
        <Money cents={financials.contractCents} className="text-muted-foreground" />
      </TableCell>
      <TableCell className="text-right">
        <Money cents={financials.receivedCents} className="text-muted-foreground" />
      </TableCell>
      <TableCell className="text-right">
        <Money cents={financials.receivableCents} />
      </TableCell>
    </>
  );
}

/** Mobile card's inline Contrato / A receber summary for one event. */
export function EventCardFinancials({ eventId }: { eventId: string }) {
  const financials = useEventFinancials(eventId);

  if (!financials) {
    return <Skeleton className="h-4 w-40" />;
  }

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">
        Contrato <Money cents={financials.contractCents} className="text-muted-foreground" />
      </span>
      <span className="text-muted-foreground">
        A receber <Money cents={financials.receivableCents} />
      </span>
    </div>
  );
}
