/**
 * Transaction (cash ledger) data hooks: the filterable list the Financeiro
 * screen drives, and the event-scoped view an event's detail screen uses.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@/domain/types";
import { MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";
import { getSupabase } from "@/data/supabase/client";
import type { Tables } from "@/data/supabase/database.types";
import { unwrap } from "@/data/supabase/result";
import { toTransaction, toTransactionInsert, toTransactionUpdate } from "@/data/supabase/rows";

export interface TransactionFilter {
  /** "YYYY-MM" */
  month?: string;
  kind?: "in" | "out";
  categoryId?: string;
  /** 'all' (default behavior) | 'general' (no event) | a specific event. */
  scope?: "all" | "general" | { eventId: string };
}

function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    from: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    to: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

export function useTransactions(filter?: TransactionFilter) {
  return useQuery({
    queryKey: [...queryKeys.transactions, filter],
    queryFn: async () => {
      let query = getSupabase().from("transactions").select("*").is("deleted_at", null);

      if (filter?.month) {
        const range = monthRange(filter.month);
        query = query.gte("date", range.from).lt("date", range.to);
      }
      if (filter?.kind) query = query.eq("kind", filter.kind);
      if (filter?.categoryId) query = query.eq("category_id", filter.categoryId);
      if (filter?.scope === "general") query = query.is("event_id", null);
      if (filter?.scope && filter.scope !== "all" && filter.scope !== "general") {
        query = query.eq("event_id", filter.scope.eventId);
      }

      const rows = unwrap(
        await query.order("date", { ascending: false }).order("created_at", { ascending: false }),
      );
      return rows.map(toTransaction);
    },
    ...QUERY_DEFAULTS,
  });
}

/** This event's transactions only, same ordering as `useTransactions`. */
export function useEventTransactions(eventId: string) {
  return useTransactions({ scope: { eventId } });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Transaction, "id" | "createdAt" | "createdBy">) =>
      toTransaction(
        unwrap(await getSupabase().from("transactions").insert(toTransactionInsert(input)).select("*").single<Tables<"transactions">>()),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // `TransactionFormDialog`'s create branch already toasts its own error —
    // see `src/main.tsx`'s global `MutationCache` for what this flag means.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Transaction> }) =>
      toTransaction(
        unwrap(
          await getSupabase()
            .from("transactions")
            .update(toTransactionUpdate(patch))
            .eq("id", id)
            .select("*")
            .single<Tables<"transactions">>(),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // `TransactionFormDialog`'s edit branch already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useRemoveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await getSupabase().rpc("void_transaction", { p_transaction_id: id }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // Both call sites (`detalhe-lancamentos.tsx`, `financeiro/index.tsx`) already toast their own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}
