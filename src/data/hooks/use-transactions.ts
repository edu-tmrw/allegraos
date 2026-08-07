/**
 * Transaction (cash ledger) data hooks: the filterable list the Financeiro
 * screen drives, and the event-scoped view an event's detail screen uses.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/data/auth";
import { crud } from "@/data/store";
import type { Transaction } from "@/domain/types";
import { FALLBACK_PROFILE_ID, MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";

export interface TransactionFilter {
  /** "YYYY-MM" */
  month?: string;
  kind?: "in" | "out";
  categoryId?: string;
  /** 'all' (default behavior) | 'general' (no event) | a specific event. */
  scope?: "all" | "general" | { eventId: string };
}

function matchesFilter(tx: Transaction, filter?: TransactionFilter): boolean {
  if (!filter) return true;
  if (filter.month !== undefined && tx.date.slice(0, 7) !== filter.month) return false;
  if (filter.kind !== undefined && tx.kind !== filter.kind) return false;
  if (filter.categoryId !== undefined && tx.categoryId !== filter.categoryId) return false;
  if (filter.scope !== undefined && filter.scope !== "all") {
    if (filter.scope === "general") {
      if (tx.eventId !== null) return false;
    } else if (tx.eventId !== filter.scope.eventId) {
      return false;
    }
  }
  return true;
}

/** Descending by `date`, `createdAt` as the tiebreak (most recent first). */
function compareTransactionsDesc(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return 0;
}

export function useTransactions(filter?: TransactionFilter) {
  return useQuery({
    queryKey: [...queryKeys.transactions, filter],
    queryFn: () =>
      crud("transactions")
        .list()
        .filter((tx) => matchesFilter(tx, filter))
        .sort(compareTransactionsDesc),
    ...QUERY_DEFAULTS,
  });
}

/** This event's transactions only, same ordering as `useTransactions`. */
export function useEventTransactions(eventId: string) {
  return useTransactions({ scope: { eventId } });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<Transaction, "id" | "createdAt" | "createdBy">) =>
      crud("transactions").create({
        ...input,
        createdBy: user?.profile.userId ?? FALLBACK_PROFILE_ID,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Transaction> }) =>
      crud("transactions").update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
    ...MUTATION_DEFAULTS,
  });
}

export function useRemoveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => crud("transactions").remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
    ...MUTATION_DEFAULTS,
  });
}
