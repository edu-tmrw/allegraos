/**
 * Eventos: search + filter (tipo/ano/status) list of every event, desktop
 * table / mobile cards, and the "Novo evento" create dialog. Row order is
 * always exactly what `useEvents()` returns (eventDate/eventTime/name asc)
 * — filtering narrows the array but never re-sorts it.
 */
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePerms } from "@/data/auth";
import { useEvents } from "@/data/hooks/use-events";
import { useEventTypes } from "@/data/hooks/use-settings";
import { eventStatus } from "@/domain/calc";
import type { Evento } from "@/domain/types";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import { EventCardFinancials, EventRowFinancials } from "@/pages/eventos/event-financials";
import { NovoEventoDialog } from "@/pages/eventos/novo-evento-dialog";
import { StatusBadge } from "@/pages/eventos/status-badge";

type StatusFilter = "all" | "ativo" | "concluido" | "cancelado";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "ativo", label: "Ativos" },
  { value: "concluido", label: "Concluídos" },
  { value: "cancelado", label: "Cancelados" },
];

/** Diacritics/case-insensitive comparable form of a string, for the client-side name search. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** "12/09/2026 · 19h30", or just the date when no time is scheduled yet. */
function formatDateHora(ev: Evento): string {
  const date = formatDate(ev.eventDate);
  return ev.eventTime ? `${date} · ${formatTime(ev.eventTime)}` : date;
}

/** Label + shadcn `<Select>` pair, so the three filter dropdowns don't repeat the same five lines each. */
function FilterField({
  id,
  label,
  value,
  onValueChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
        <p>{title}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export function EventosPage() {
  const { manageEvents, manageFinance } = usePerms();
  const navigate = useNavigate();
  const today = todayISO();

  const { data: events } = useEvents();
  const { data: eventTypes } = useEventTypes();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ativo");
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!events || !eventTypes) {
    return (
      <div className="space-y-2">
        <h1 className="font-serif text-3xl text-foreground">Eventos</h1>
      </div>
    );
  }

  const eventTypesById = new Map(eventTypes.map((type) => [type.id, type.name]));
  const activeEventTypes = eventTypes.filter((type) => type.active);
  const years = Array.from(new Set(events.map((ev) => ev.eventDate.slice(0, 4)))).sort(
    (a, b) => Number(b) - Number(a),
  );

  const query = normalize(search.trim());
  const filtered = events.filter((ev) => {
    if (query && !normalize(ev.name).includes(query)) return false;
    if (typeFilter !== "all" && ev.eventTypeId !== typeFilter) return false;
    if (yearFilter !== "all" && ev.eventDate.slice(0, 4) !== yearFilter) return false;
    if (statusFilter !== "all" && eventStatus(ev, today) !== statusFilter) return false;
    return true;
  });

  const hasAnyEvents = events.length > 0;
  const hasResults = filtered.length > 0;

  const novoEventoButton = (
    <Button type="button" onClick={() => setDialogOpen(true)}>
      <Plus className="size-4" />
      Novo evento
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-3xl text-foreground">Eventos</h1>
        {manageEvents && novoEventoButton}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <Label htmlFor="eventos-busca" className="text-xs text-muted-foreground">
            Buscar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="eventos-busca"
              placeholder="Buscar por nome"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <FilterField id="eventos-tipo" label="Tipo" value={typeFilter} onValueChange={setTypeFilter}>
          <SelectItem value="all">Todos</SelectItem>
          {activeEventTypes.map((type) => (
            <SelectItem key={type.id} value={type.id}>
              {type.name}
            </SelectItem>
          ))}
        </FilterField>

        <FilterField id="eventos-ano" label="Ano" value={yearFilter} onValueChange={setYearFilter}>
          <SelectItem value="all">Todos</SelectItem>
          {years.map((year) => (
            <SelectItem key={year} value={year}>
              {year}
            </SelectItem>
          ))}
        </FilterField>

        <FilterField
          id="eventos-status"
          label="Status"
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </FilterField>
      </div>

      {!hasAnyEvents ? (
        <EmptyState title="Nenhum evento ainda." action={manageEvents ? novoEventoButton : undefined} />
      ) : !hasResults ? (
        <EmptyState title="Nenhum evento encontrado com esses filtros." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  {manageFinance && (
                    <>
                      <TableHead className="text-right">Contrato</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">A receber</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ev) => (
                  <TableRow
                    key={ev.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/eventos/${ev.id}`)}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">{ev.name}</span>
                        <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
                          {eventTypesById.get(ev.eventTypeId) ?? ""}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateHora(ev)}</TableCell>
                    <TableCell>
                      <StatusBadge status={eventStatus(ev, today)} />
                    </TableCell>
                    {manageFinance && <EventRowFinancials eventId={ev.id} />}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((ev) => (
              <Card
                key={ev.id}
                className="cursor-pointer transition-colors hover:border-primary/40"
                onClick={() => navigate(`/eventos/${ev.id}`)}
              >
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{ev.name}</span>
                      <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
                        {eventTypesById.get(ev.eventTypeId) ?? ""}
                      </Badge>
                    </div>
                    <StatusBadge status={eventStatus(ev, today)} />
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDateHora(ev)}</p>
                  {manageFinance && <EventCardFinancials eventId={ev.id} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <NovoEventoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
