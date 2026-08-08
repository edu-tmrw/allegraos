/**
 * "Lançamentos" section of the event detail page: this event's own
 * transactions (`useEventTransactions`), backed by the SHARED
 * `TransactionFormDialog` (`src/components/transaction-form-dialog.tsx` —
 * the same dialog Task 16's Financeiro page reuses with its event selector
 * unlocked) locked to this event.
 *
 * The caller (`detalhe.tsx`) already only mounts this whole section when the
 * viewer has `manageFinance` (money movements are never shown to a
 * Comercial profile) — the internal `manageFinance` check below only gates
 * the write affordances (the "Novo lançamento" button, and each row's
 * edit/excluir icons), kept self-contained the same way `DetalheServicos`
 * computes its own `readOnly` rather than trusting the page never to change.
 * Deliberately `manageFinance`, not `manageEvents` — transactions are the
 * FINANCE domain, not the events one.
 */
import { useState } from "react";
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/money";
import { TransactionFormDialog } from "@/components/transaction-form-dialog";
import { usePerms } from "@/data/auth";
import { useCategories } from "@/data/hooks/use-settings";
import { useEventTransactions, useRemoveTransaction } from "@/data/hooks/use-transactions";
import type { Transaction } from "@/domain/types";
import { formatBRL, formatDate } from "@/lib/format";

/** One lançamento row: date / categoria / description (truncated) / signed Money / edit+excluir. */
function TransactionRow({
  tx,
  categoryName,
  canManage,
  onEdit,
  onRemove,
}: {
  tx: Transaction;
  categoryName: string;
  canManage: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  // Date + categoria + valor together are unlikely to collide across two
  // different rows even when two entries share a date or a categoria alone
  // — mirrors Task 14's fix for `ServiceItemsEditor`'s own duplicate-name
  // aria-label bug, without needing the raw (unreadable) row id.
  const rowLabel = `${formatDate(tx.date)} — ${categoryName} — ${formatBRL(tx.amountCents)}`;

  return (
    <div
      data-testid={`lancamento-${tx.id}`}
      className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0"
    >
      <span className="shrink-0 text-sm text-muted-foreground">{formatDate(tx.date)}</span>
      <span className="font-medium text-foreground">{categoryName}</span>
      {tx.description && (
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{tx.description}</span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Money cents={tx.amountCents} kind={tx.kind} />
        {canManage && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar lançamento: ${rowLabel}`} onClick={onEdit}>
              <Pencil className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Excluir lançamento: ${rowLabel}`}
                >
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
        )}
      </div>
    </div>
  );
}

export function DetalheLancamentos({ eventId }: { eventId: string }) {
  const { manageFinance } = usePerms();
  const { data: transactions } = useEventTransactions(eventId);
  const { data: categories } = useCategories();
  const removeTransaction = useRemoveTransaction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | undefined>(undefined);

  const categoryNameById = new Map((categories ?? []).map((category) => [category.id, category.name]));

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

  const rows = transactions ?? [];

  return (
    <Card data-event-id={eventId}>
      <CardHeader>
        <CardTitle className="font-serif text-xl">Lançamentos</CardTitle>
        {manageFinance && (
          <CardAction>
            <Button type="button" size="sm" onClick={handleNew}>
              <Plus className="size-4" />
              Novo lançamento
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">Nenhum lançamento ainda.</p>
        ) : (
          <div className="flex flex-col">
            {rows.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                categoryName={categoryNameById.get(tx.categoryId) ?? ""}
                canManage={manageFinance}
                onEdit={() => handleEdit(tx)}
                onRemove={() => handleRemove(tx.id)}
              />
            ))}
          </div>
        )}
      </CardContent>

      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultEventId={eventId}
        lockEvent
        transaction={editingTx}
      />
    </Card>
  );
}
