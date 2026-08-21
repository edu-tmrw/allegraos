import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";
import { supabase } from "@/data/supabase/client";
import { unwrap, unwrapNullable } from "@/data/supabase/result";
import {
  toActivity,
  toActivityInsert,
  toActivityUpdate,
  toContact,
  toContactInsert,
  toContactUpdate,
  toEvento,
  toProposal,
  toProposalService,
  toProposalUpdate,
} from "@/data/supabase/rows";
import type { Activity, Contact, Evento, Proposal } from "@/domain/types";
import { todayISO } from "@/lib/format";

export function useContacts(opts?: { archived?: boolean }) {
  const archived = opts?.archived ?? false;
  return useQuery({
    queryKey: [...queryKeys.contacts, { archived }],
    queryFn: async () => {
      const result = await supabase.from("contacts").select("*").eq("archived", archived).order("created_at", { ascending: false });
      return unwrap(result).map(toContact);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: [...queryKeys.contacts, id],
    queryFn: async () => {
      const row = unwrapNullable(await supabase.from("contacts").select("*").eq("id", id).maybeSingle());
      return row ? toContact(row) : undefined;
    },
    ...QUERY_DEFAULTS,
  });
}

export function useContactEvent(contactId: string) {
  return useQuery({
    queryKey: [...queryKeys.events, "byContact", contactId],
    queryFn: async () => {
      const row = unwrapNullable(await supabase.from("events").select("*").eq("contact_id", contactId).maybeSingle());
      return row ? toEvento(row) : null;
    },
    ...QUERY_DEFAULTS,
  });
}

export function useContactActivities(contactId: string) {
  return useQuery({
    queryKey: [...queryKeys.activities, contactId],
    queryFn: async () => {
      const result = await supabase.from("activities").select("*").eq("contact_id", contactId).order("created_at", { ascending: false });
      return unwrap(result).map(toActivity);
    },
    ...QUERY_DEFAULTS,
  });
}

function useDueActivities() {
  const today = todayISO();
  return useQuery({
    queryKey: [...queryKeys.activities, "due", today],
    queryFn: async () => {
      const result = await supabase
        .from("activities")
        .select("*")
        .eq("done", false)
        .not("due_date", "is", null)
        .lte("due_date", today)
        .order("due_date", { ascending: true });
      return unwrap(result).map(toActivity);
    },
    ...QUERY_DEFAULTS,
  });
}

function useActiveContacts() {
  return useQuery({
    queryKey: [...queryKeys.contacts, { archived: false }],
    queryFn: async () => {
      const result = await supabase.from("contacts").select("*").eq("archived", false);
      return unwrap(result).map(toContact);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useDueFollowups(): { activity: Activity; contact: Contact }[] | undefined {
  const activitiesQuery = useDueActivities();
  const contactsQuery = useActiveContacts();
  return useMemo(() => {
    if (!activitiesQuery.data || !contactsQuery.data) return undefined;
    const contacts = new Map(contactsQuery.data.map((contact) => [contact.id, contact]));
    return activitiesQuery.data.flatMap((activity) => {
      const contact = contacts.get(activity.contactId);
      return contact ? [{ activity, contact }] : [];
    });
  }, [activitiesQuery.data, contactsQuery.data]);
}

export function useContactProposals(contactId: string) {
  return useQuery({
    queryKey: [...queryKeys.proposals, contactId],
    queryFn: async () => {
      const result = await supabase.from("proposals").select("*").eq("contact_id", contactId).order("sent_date", { ascending: false });
      return unwrap(result).map(toProposal);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useProposalServices(proposalId: string) {
  return useQuery({
    queryKey: [...queryKeys.proposalServices, proposalId],
    queryFn: async () => {
      const result = await supabase.from("proposal_services").select("*").eq("proposal_id", proposalId);
      return unwrap(result).map(toProposalService);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Contact, "id" | "archived" | "createdBy" | "createdAt">) => {
      const payload = toContactInsert({ ...input, archived: false });
      return toContact(unwrap(await supabase.from("contacts").insert(payload).select("*").single()));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Contact> }) =>
      toContact(unwrap(await supabase.from("contacts").update(toContactUpdate(patch)).eq("id", id).select("*").single())),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useMoveContactStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, stageId }: { contactId: string; stageId: string }) =>
      toContact(unwrap(await supabase.from("contacts").update(toContactUpdate({ stageId })).eq("id", contactId).select("*").single())),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    ...MUTATION_DEFAULTS,
  });
}

function useArchivedMutation(archived: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      toContact(unwrap(await supabase.from("contacts").update(toContactUpdate({ archived })).eq("id", id).select("*").single())),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useArchiveContact() {
  return useArchivedMutation(true);
}

export function useUnarchiveContact() {
  return useArchivedMutation(false);
}

export function useAddActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contactId: string; content: string; dueDate: string | null }) => {
      const payload = toActivityInsert({ ...input, done: input.dueDate === null });
      return toActivity(unwrap(await supabase.from("activities").insert(payload).select("*").single()));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.activities }),
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useToggleActivityDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      toActivity(unwrap(await supabase.from("activities").update(toActivityUpdate({ done })).eq("id", id).select("*").single())),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.activities }),
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export interface CreateProposalInput {
  contactId: string;
  sentDate: string;
  discountCents: number;
  notes: string | null;
  items: { serviceId: string; variantId: string | null; priceCents: number }[];
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      const proposalId = unwrap(await supabase.rpc("create_proposal_with_items", {
        p_contact_id: input.contactId,
        p_sent_date: input.sentDate,
        p_discount_cents: input.discountCents,
        p_items: input.items.map((item) => ({ service_id: item.serviceId, variant_id: item.variantId, price_cents: item.priceCents })),
        ...(input.notes === null ? {} : { p_notes: input.notes }),
      }));
      const [proposalResult, servicesResult] = await Promise.all([
        supabase.from("proposals").select("*").eq("id", proposalId).single(),
        supabase.from("proposal_services").select("*").eq("proposal_id", proposalId),
      ]);
      return { proposal: toProposal(unwrap(proposalResult)), services: unwrap(servicesResult).map(toProposalService) };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proposals });
      queryClient.invalidateQueries({ queryKey: queryKeys.proposalServices });
    },
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useSetProposalStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Proposal["status"] }) =>
      toProposal(unwrap(await supabase.from("proposals").update(toProposalUpdate({ status })).eq("id", id).select("*").single())),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.proposals }),
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export interface ConvertLeadInput {
  contactId: string;
  proposalId: string;
  eventName: string;
  eventTypeId: string;
  eventDate: string;
  eventTime: string | null;
}

export function useConvertLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConvertLeadInput): Promise<Evento> => {
      const eventId = unwrap(await supabase.rpc("convert_lead", {
        p_contact_id: input.contactId,
        p_proposal_id: input.proposalId,
        p_event_name: input.eventName,
        p_event_date: input.eventDate,
        ...(input.eventTime === null ? {} : { p_event_time: input.eventTime }),
      }));
      return toEvento(unwrap(await supabase.from("events").select("*").eq("id", eventId).single()));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.eventServices });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.proposals });
    },
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}
