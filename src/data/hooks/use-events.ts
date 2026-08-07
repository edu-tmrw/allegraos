/**
 * Event data hooks: the event list/detail, its sold services, and the
 * derived per-event financial summary.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventFinancials } from "@/domain/calc";
import { crud } from "@/data/store";
import type { EventService, Evento } from "@/domain/types";
import { MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";
import { useTransactions } from "@/data/hooks/use-transactions";

/** `<`/`>`-comparable strings that are already known to differ or be equal (mirrors `calc.ts`'s private helper — not exported there). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Same tie-break chain as `calc.ts`'s `upcomingEvents` (date asc, time asc
 * with null last, then name), but over every event — no date/cancel
 * filtering, since this is the plain "list everything" query.
 */
function compareEvents(a: Evento, b: Evento): number {
  if (a.eventDate !== b.eventDate) return compareStrings(a.eventDate, b.eventDate);
  if (a.eventTime !== b.eventTime) {
    if (a.eventTime === null) return 1;
    if (b.eventTime === null) return -1;
    return compareStrings(a.eventTime, b.eventTime);
  }
  return compareStrings(a.name, b.name);
}

export function useEvents() {
  return useQuery({
    queryKey: queryKeys.events,
    queryFn: () => crud("events").list().sort(compareEvents),
    ...QUERY_DEFAULTS,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: [...queryKeys.events, id],
    queryFn: () => crud("events").get(id),
    ...QUERY_DEFAULTS,
  });
}

/** This event's own sold services only — never the whole `eventServices` table. */
export function useEventServices(eventId: string) {
  return useQuery({
    queryKey: [...queryKeys.eventServices, eventId],
    queryFn: () => crud("eventServices").list().filter((item) => item.eventId === eventId),
    ...QUERY_DEFAULTS,
  });
}

/**
 * The event's contract/received/cost/profit/receivable, or `undefined`
 * while any of its three source queries is still loading. Only ever hands
 * `eventFinancials` the items already scoped to this event by
 * `useEventServices` — `calc.ts`'s `eventFinancials` trusts its `items`
 * input completely (no internal filter by event, unlike its `txs` param),
 * so passing the unfiltered table here would silently blend in every other
 * event's line items.
 */
export function useEventFinancials(eventId: string) {
  const eventQuery = useEvent(eventId);
  const itemsQuery = useEventServices(eventId);
  const txsQuery = useTransactions();

  return useMemo(() => {
    const event = eventQuery.data;
    const items = itemsQuery.data;
    const txs = txsQuery.data;
    if (!event || !items || !txs) return undefined;
    return eventFinancials(event, items, txs);
  }, [eventQuery.data, itemsQuery.data, txsQuery.data]);
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<Evento, "name" | "eventTypeId" | "eventDate" | "eventTime">) =>
      crud("events").create({
        ...input,
        contactId: null,
        discountCents: 0,
        canceled: false,
        notes: null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Evento> }) => crud("events").update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events }),
    ...MUTATION_DEFAULTS,
  });
}

export function useCancelEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => crud("events").update(id, { canceled: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events }),
    ...MUTATION_DEFAULTS,
  });
}

export function useReactivateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => crud("events").update(id, { canceled: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events }),
    ...MUTATION_DEFAULTS,
  });
}

export function useSetEventDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, discountCents }: { eventId: string; discountCents: number }) =>
      crud("events").update(eventId, { discountCents }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events }),
    ...MUTATION_DEFAULTS,
  });
}

export function useAddEventService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EventService, "id" | "createdAt">) => crud("eventServices").create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventServices });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateEventService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EventService> }) =>
      crud("eventServices").update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventServices });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
    ...MUTATION_DEFAULTS,
  });
}

export function useRemoveEventService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => crud("eventServices").remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventServices });
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
    ...MUTATION_DEFAULTS,
  });
}
