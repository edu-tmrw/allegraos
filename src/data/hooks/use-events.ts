/**
 * Event data hooks: the event list/detail, its sold services, and the
 * derived per-event financial summary.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventService, Evento } from "@/domain/types";
import { MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";
import { getSupabase } from "@/data/supabase/client";
import type { Tables } from "@/data/supabase/database.types";
import { ensureSuccess, unwrap, unwrapNullable } from "@/data/supabase/result";
import {
  toEvento,
  toEventoInsert,
  toEventoUpdate,
  toEventService,
  toEventServiceInsert,
  toEventServiceUpdate,
} from "@/data/supabase/rows";

export function useEvents() {
  return useQuery({
    queryKey: queryKeys.events,
    queryFn: async () => {
      const rows = unwrap(
        await getSupabase()
          .from("events")
          .select("*")
          .order("event_date", { ascending: true })
          .order("event_time", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true }),
      );
      return rows.map(toEvento);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useEvent(id: string) {
  const query = useQuery({
    queryKey: [...queryKeys.events, id],
    queryFn: async () => {
      const row = unwrapNullable(await getSupabase().from("events").select("*").eq("id", id).maybeSingle());
      return row === null ? null : toEvento(row);
    },
    ...QUERY_DEFAULTS,
  });

  return { ...query, data: query.data ?? undefined };
}

/** This event's own sold services only — never the whole `eventServices` table. */
export function useEventServices(eventId: string) {
  return useQuery({
    queryKey: [...queryKeys.eventServices, eventId],
    queryFn: async () => {
      const rows = unwrap(
        await getSupabase()
          .from("event_services")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      );
      return rows.map(toEventService);
    },
    ...QUERY_DEFAULTS,
  });
}

/**
 * The event's contract/received/cost/profit/receivable from the secured
 * database view, or `undefined` while loading/when the event is absent.
 */
export function useEventFinancials(eventId: string) {
  const query = useQuery({
    queryKey: [...queryKeys.events, eventId, "financials"],
    queryFn: async () => {
      const row = unwrapNullable(
        await getSupabase()
          .from("v_event_financials")
          .select("event_id, contract_cents, received_cents, cost_cents, profit_cents, receivable_cents")
          .eq("event_id", eventId)
          .maybeSingle<Tables<"v_event_financials">>(),
      );
      if (row === null) return null;
      return {
        contractCents: row.contract_cents ?? 0,
        receivedCents: row.received_cents ?? 0,
        costCents: row.cost_cents ?? 0,
        profitCents: row.profit_cents ?? 0,
        receivableCents: row.receivable_cents ?? 0,
      };
    },
    ...QUERY_DEFAULTS,
  });

  return query.data ?? undefined;
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<Evento, "name" | "eventTypeId" | "eventDate" | "eventTime">) => {
      const payload = toEventoInsert({
        ...input,
        contactId: null,
        discountCents: 0,
        canceled: false,
        notes: null,
      });
      return toEvento(unwrap(await getSupabase().from("events").insert(payload).select("*").single<Tables<"events">>()));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // Every current call site (`NovoEventoDialog`) already toasts its own
    // error — see `src/main.tsx`'s global `MutationCache` for what this flag means.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Evento> }) =>
      toEvento(unwrap(await getSupabase().from("events").update(toEventoUpdate(patch)).eq("id", id).select("*").single<Tables<"events">>())),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // Both call sites (notes save in `detalhe.tsx`, `EditarEventoDialog`) already toast their own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useCancelEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      toEvento(unwrap(await getSupabase().from("events").update(toEventoUpdate({ canceled: true })).eq("id", id).select("*").single<Tables<"events">>())),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // `detalhe.tsx`'s cancel confirmation already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useReactivateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      toEvento(unwrap(await getSupabase().from("events").update(toEventoUpdate({ canceled: false })).eq("id", id).select("*").single<Tables<"events">>())),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // `detalhe.tsx`'s "Reativar evento" button already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useSetEventDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, discountCents }: { eventId: string; discountCents: number }) =>
      toEvento(unwrap(await getSupabase().from("events").update(toEventoUpdate({ discountCents })).eq("id", eventId).select("*").single<Tables<"events">>())),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // `detalhe-servicos.tsx`'s discount editor already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useAddEventService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EventService, "id" | "createdAt">) =>
      toEventService(
        unwrap(await getSupabase().from("event_services").insert(toEventServiceInsert(input)).select("*").single<Tables<"event_services">>()),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventServices });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // `detalhe-servicos.tsx`'s `handleAdd` already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateEventService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EventService> }) =>
      toEventService(
        unwrap(
          await getSupabase()
            .from("event_services")
            .update(toEventServiceUpdate(patch))
            .eq("id", id)
            .select("*")
            .single<Tables<"event_services">>(),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventServices });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    ...MUTATION_DEFAULTS,
  });
}

export function useRemoveEventService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      ensureSuccess(await getSupabase().from("event_services").delete().eq("id", id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventServices });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    // `detalhe-servicos.tsx`'s `handleRemove` already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}
