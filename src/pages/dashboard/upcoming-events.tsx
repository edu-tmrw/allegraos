import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router";
import { Money } from "@/components/money";
import { Skeleton } from "@/components/ui/skeleton";
import { useEventFinancials } from "@/data/hooks/use-events";
import { formatTime, todayISO } from "@/lib/format";
import type { Evento } from "@/domain/types";

/**
 * One event's row, including its own "a receber" figure. This is its own
 * component (not a `.map()` callback body) specifically so `useEventFinancials`
 * — a hook — is called once per row/component-instance, never inside a loop
 * within a single component.
 */
function UpcomingEventRow({ evento }: { evento: Evento }) {
  const financials = useEventFinancials(evento.id);
  const date = parseISO(evento.eventDate);
  const diffDays = differenceInCalendarDays(date, parseISO(todayISO()));

  return (
    <li>
      {/* A real `<Link>`, not a `<button onClick={navigate}>` — this is a
          plain row-to-page link (no drag/table semantics in the way, unlike
          `eventos/index.tsx`'s rows), so it can and should support
          middle-click/"open in new tab" like any other link. */}
      <Link
        to={`/eventos/${evento.id}`}
        className="flex w-full items-start gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <div className="w-11 shrink-0 pt-0.5 text-center font-serif">
          <div className="text-lg leading-none text-foreground">{format(date, "dd")}</div>
          <div className="text-[11px] uppercase text-muted-foreground">{format(date, "MMM", { locale: ptBR })}</div>
        </div>

        {/* Name owns its own full-width line — sharing one line with the
            receivable figure left almost no room for it on narrow screens.
            Time/dias and the receivable wrap onto their own line below and
            drop to separate lines themselves if that still doesn't fit. */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{evento.name}</p>
          <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
            <span className="text-muted-foreground">
              {formatTime(evento.eventTime)} · em {diffDays} dias
            </span>
            <span className="text-muted-foreground">
              A receber: {financials ? <Money cents={financials.receivableCents} /> : <Skeleton className="inline-block h-4 w-20 align-middle" />}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

/** Próximos eventos: `upcoming` arrives already sorted (soonest first) and capped at 5 by `useDashboardData` — this component only renders it. */
export function UpcomingEvents({ upcoming }: { upcoming: Evento[] }) {
  if (upcoming.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum evento futuro.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {upcoming.map((evento) => (
        <UpcomingEventRow key={evento.id} evento={evento} />
      ))}
    </ul>
  );
}
