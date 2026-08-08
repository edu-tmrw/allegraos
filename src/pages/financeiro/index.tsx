/**
 * Financeiro: the company's whole ledger — fixed costs (no event) and every
 * event's ins/outs together, with filters (mês/tipo/categoria/escopo) and
 * totals of the filtered set. Backed entirely by `useTransactions`'s own
 * `TransactionFilter` (date desc, `createdAt` tiebreak — never re-sorted or
 * re-filtered here), the same shared `TransactionFormDialog` Task 15 built
 * (unlocked: the user picks Administração central or an event), and
 * `useRemoveTransaction` for the row-level "excluir".
 *
 * `/financeiro` is already `RequirePerm perm="manageFinance"`-gated at the
 * router (see `router.tsx`) — unlike `DetalheLancamentos` (embedded in the
 * event detail page, which ISN'T finance-gated), nothing in here needs its
 * own internal `manageFinance` check: every viewer who reaches this page
 * already has it.
 */
import { type ReactNode, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/money";
import { TransactionFormDialog } from "@/components/transaction-form-dialog";
import { useEvents } from "@/data/hooks/use-events";
import { useCategories } from "@/data/hooks/use-settings";
import { useRemoveTransaction, useTransactions, type TransactionFilter } from "@/data/hooks/use-transactions";
import type { Transaction } from "@/domain/types";
import { formatBRL, formatDate, formatMonthShort, todayISO } from "@/lib/format";

type KindFilterValue = "all" | "in" | "out";
type ScopeFilterValue = "all" | "general" | "event";

/** Label + shadcn `<Select>` pair, so the filter row's dropdowns (four, plus the secondary "Evento" one when Escopo narrows to a single event) don't repeat the same lines each. */
function FilterField({
  id,
  label,
  value,
  onValueChange,
  triggerClassName,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className={triggerClassName ?? "w-[160px]"}>
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

function TotalStat({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg">{children}</span>
    </div>
  );
}

/** Full-page placeholder while the baseline catalogs (transações/categorias/eventos) are still loading. */
function FinanceiroSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-3xl text-foreground">Financeiro</h1>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-40" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Lighter placeholder for just the rows area, while a newly-picked filter combination's own query resolves. */
function RowsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

/** Date + categoria + valor together, for row action aria-labels — mirrors `DetalheLancamentos`'s own `rowLabel` (unlikely to collide even when two rows share a date or a categoria alone). */
function lancamentoRowLabel(tx: Transaction, categoryName: string): string {
  return `${formatDate(tx.date)} — ${categoryName} — ${formatBRL(tx.amountCents)}`;
}

/** Edit pencil + trash (behind an "excluir?" AlertDialog) — shared by the desktop row and the mobile card. */
function LancamentoActions({
  rowLabel,
  onEdit,
  onRemove,
}: {
  rowLabel: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar lançamento: ${rowLabel}`}
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Excluir lançamento: ${rowLabel}`}>
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir este lançamento? Os totais se recalculam automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onRemove}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function FinanceiroPage() {
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilterValue>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilterValue>("all");
  const [scopeEventOverride, setScopeEventOverride] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | undefined>(undefined);

  // Unfiltered baseline: drives the Mês options, the smart default month,
  // and the "no transactions at all" vs. "filter mismatch" empty-state pick.
  const { data: allTransactions } = useTransactions();
  const { data: categories } = useCategories();
  const { data: events } = useEvents();

  const currentMonth = todayISO().slice(0, 7);
  const monthsPresent = Array.from(new Set((allTransactions ?? []).map((tx) => tx.date.slice(0, 7))))
    .sort()
    .reverse();
  const defaultMonth = monthsPresent.includes(currentMonth) ? currentMonth : "all";
  const month = monthOverride ?? defaultMonth;
  const scopeEventId = scopeEventOverride ?? events?.[0]?.id ?? "";

  const filter: TransactionFilter = {};
  if (month !== "all") filter.month = month;
  if (kindFilter !== "all") filter.kind = kindFilter;
  if (categoryFilter !== "all") filter.categoryId = categoryFilter;
  if (scopeFilter === "general") filter.scope = "general";
  else if (scopeFilter === "event" && scopeEventId) filter.scope = { eventId: scopeEventId };

  // Separate query key from the baseline above — its own `undefined` window
  // (whenever the filter combination just changed to one not cached yet) is
  // handled by `RowsSkeleton` below, never by re-showing the full-page
  // skeleton (which would otherwise flash on every filter tweak).
  const { data: rows } = useTransactions(filter);
  const removeTransaction = useRemoveTransaction();

  if (!allTransactions || !categories || !events) {
    return <FinanceiroSkeleton />;
  }

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const eventNameById = new Map(events.map((ev) => [ev.id, ev.name]));
  const activeCategoriesIn = categories.filter((category) => category.active && category.kind === "in");
  const activeCategoriesOut = categories.filter((category) => category.active && category.kind === "out");

  const hasAnyTransactions = allTransactions.length > 0;
  const rowsLoaded = rows !== undefined;
  const visibleRows = rows ?? [];
  const hasResults = rowsLoaded && visibleRows.length > 0;

  const totals = visibleRows.reduce(
    (acc, tx) => {
      if (tx.kind === "in") acc.inCents += tx.amountCents;
      else acc.outCents += tx.amountCents;
      return acc;
    },
    { inCents: 0, outCents: 0 },
  );
  const balanceCents = totals.inCents - totals.outCents;

  function handleNew() {
    setEditingTx(undefined);
    setDialogOpen(true);
  }

  function handleEdit(tx: Transaction) {
    setEditingTx(tx);
    setDialogOpen(true);
  }

  function handleRemove(id: string) {
    removeTransaction.mutate(id, {
      onSuccess: () => toast.success("Lançamento excluído."),
      onError: () => toast.error("Não foi possível excluir o lançamento. Tente novamente."),
    });
  }

  const novoLancamentoButton = (
    <Button type="button" onClick={handleNew}>
      <Plus className="size-4" />
      Novo lançamento
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-3xl text-foreground">Financeiro</h1>
        {novoLancamentoButton}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FilterField id="financeiro-mes" label="Mês" value={month} onValueChange={setMonthOverride}>
          <SelectItem value="all">Todos os meses</SelectItem>
          {monthsPresent.map((m) => (
            <SelectItem key={m} value={m}>
              {formatMonthShort(m)}
            </SelectItem>
          ))}
        </FilterField>

        <FilterField
          id="financeiro-tipo"
          label="Tipo"
          value={kindFilter}
          onValueChange={(value) => setKindFilter(value as KindFilterValue)}
          triggerClassName="w-[130px]"
        >
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="in">Entradas</SelectItem>
          <SelectItem value="out">Saídas</SelectItem>
        </FilterField>

        <FilterField
          id="financeiro-categoria"
          label="Categoria"
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          triggerClassName="w-[210px]"
        >
          <SelectItem value="all">Todas</SelectItem>
          {activeCategoriesIn.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          {activeCategoriesOut.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </FilterField>

        <FilterField
          id="financeiro-escopo"
          label="Escopo"
          value={scopeFilter}
          onValueChange={(value) => setScopeFilter(value as ScopeFilterValue)}
          triggerClassName="w-[190px]"
        >
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="general">Administração central</SelectItem>
          <SelectItem value="event">Evento específico</SelectItem>
        </FilterField>

        {scopeFilter === "event" && (
          <FilterField
            id="financeiro-evento"
            label="Evento"
            value={scopeEventId}
            onValueChange={setScopeEventOverride}
            triggerClassName="w-[220px]"
          >
            {events.map((ev) => (
              <SelectItem key={ev.id} value={ev.id}>
                {ev.name}
                {ev.canceled ? " (cancelado)" : ""}
              </SelectItem>
            ))}
          </FilterField>
        )}
      </div>

      {!rowsLoaded ? (
        <RowsSkeleton />
      ) : !hasResults ? (
        <EmptyState
          title={hasAnyTransactions ? "Nenhum lançamento encontrado com esses filtros." : "Nenhum lançamento ainda."}
          action={hasAnyTransactions ? undefined : novoLancamentoButton}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((tx) => {
                  const categoryName = categoryNameById.get(tx.categoryId) ?? "";
                  const rowLabel = lancamentoRowLabel(tx, categoryName);
                  return (
                    <TableRow key={tx.id} data-testid={`lancamento-${tx.id}`}>
                      <TableCell className="text-muted-foreground">{formatDate(tx.date)}</TableCell>
                      <TableCell className="font-medium text-foreground">{categoryName}</TableCell>
                      <TableCell>
                        {tx.eventId === null ? (
                          <span className="text-muted-foreground">Administração central</span>
                        ) : (
                          eventNameById.get(tx.eventId) ?? ""
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="block max-w-[220px] truncate">{tx.description ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money cents={tx.amountCents} kind={tx.kind} />
                      </TableCell>
                      <TableCell>
                        <LancamentoActions
                          rowLabel={rowLabel}
                          onEdit={() => handleEdit(tx)}
                          onRemove={() => handleRemove(tx.id)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {visibleRows.map((tx) => {
              const categoryName = categoryNameById.get(tx.categoryId) ?? "";
              const rowLabel = lancamentoRowLabel(tx, categoryName);
              const eventoLabel = tx.eventId === null ? "Administração central" : eventNameById.get(tx.eventId) ?? "";
              return (
                <Card key={tx.id} data-testid={`lancamento-${tx.id}`}>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground">{formatDate(tx.date)}</span>
                        <span className="font-medium text-foreground">{categoryName}</span>
                      </div>
                      <Money cents={tx.amountCents} kind={tx.kind} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{eventoLabel}</span>
                      {tx.description && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="min-w-0 flex-1 truncate">{tx.description}</span>
                        </>
                      )}
                    </div>
                    <LancamentoActions
                      rowLabel={rowLabel}
                      onEdit={() => handleEdit(tx)}
                      onRemove={() => handleRemove(tx.id)}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {hasResults && (
        <Card className="border-primary/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 sm:gap-6">
            <TotalStat label="Entradas" testId="financeiro-totais-entradas">
              <Money cents={totals.inCents} kind="in" />
            </TotalStat>
            <TotalStat label="Saídas" testId="financeiro-totais-saidas">
              <Money cents={totals.outCents} kind="out" />
            </TotalStat>
            <TotalStat label="Saldo" testId="financeiro-totais-saldo">
              <Money cents={balanceCents} className={balanceCents < 0 ? "text-negative" : undefined} />
            </TotalStat>
          </CardContent>
        </Card>
      )}

      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultEventId={null}
        transaction={editingTx}
      />
    </div>
  );
}
