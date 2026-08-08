/**
 * CRM data hooks: the contact/lead pipeline, activities/follow-ups,
 * proposals, and converting an accepted proposal into a real event.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/data/auth";
import { convertLead, crud } from "@/data/store";
import { todayISO } from "@/lib/format";
import type { Activity, Contact, Proposal } from "@/domain/types";
import { FALLBACK_PROFILE_ID, MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";

// ---- Contacts -----------------------------------------------------------

/** Non-archived contacts by default; pass `{archived: true}` for the archive view. */
export function useContacts(opts?: { archived?: boolean }) {
  const archived = opts?.archived ?? false;
  return useQuery({
    queryKey: [...queryKeys.contacts, { archived }],
    queryFn: () => crud("contacts").list().filter((contact) => contact.archived === archived),
    ...QUERY_DEFAULTS,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: [...queryKeys.contacts, id],
    queryFn: () => crud("contacts").get(id),
    ...QUERY_DEFAULTS,
  });
}

/** The `Evento` this contact converted into (`contactId === id`), or `null` — powers the GANHO badge. */
export function useContactEvent(contactId: string) {
  return useQuery({
    queryKey: [...queryKeys.events, "byContact", contactId],
    queryFn: () => crud("events").list().find((event) => event.contactId === contactId) ?? null,
    ...QUERY_DEFAULTS,
  });
}

// ---- Activities -----------------------------------------------------------

function compareCreatedAtDesc(a: Activity, b: Activity): number {
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? 1 : -1;
}

export function useContactActivities(contactId: string) {
  return useQuery({
    queryKey: [...queryKeys.activities, contactId],
    queryFn: () =>
      crud("activities")
        .list()
        .filter((activity) => activity.contactId === contactId)
        .sort(compareCreatedAtDesc),
    ...QUERY_DEFAULTS,
  });
}

/**
 * Private base queries `useDueFollowups` selects from — there's no
 * exported "all activities"/"all contacts" hook in the contract (the
 * public hooks are always scoped: per-contact, or archived/non-archived),
 * so this reuses the resources' own registered `queryKeys` rather than
 * invent a new key. Any activity/contact mutation invalidates these two
 * keys directly (see `use-crm.ts`'s mutations below), so due-followups
 * refreshes for free.
 */
function useAllActivities() {
  return useQuery({
    queryKey: queryKeys.activities,
    queryFn: () => crud("activities").list(),
    ...QUERY_DEFAULTS,
  });
}

function useAllContacts() {
  return useQuery({
    queryKey: queryKeys.contacts,
    queryFn: () => crud("contacts").list(),
    ...QUERY_DEFAULTS,
  });
}

/**
 * Every not-done activity due today or earlier, joined with its contact,
 * soonest-due first. `undefined` while either source query is loading. An
 * activity whose `contactId` doesn't resolve (shouldn't happen — seed and
 * `useAddActivity` both guarantee it) is silently skipped rather than
 * crashing on a missing join. A resolved contact that's archived is skipped
 * too — an archived lead is off the board entirely, so its follow-ups
 * shouldn't resurface in the banner just because nobody marked them done
 * before archiving.
 */
export function useDueFollowups(): { activity: Activity; contact: Contact }[] | undefined {
  const activitiesQuery = useAllActivities();
  const contactsQuery = useAllContacts();

  return useMemo(() => {
    const activities = activitiesQuery.data;
    const contacts = contactsQuery.data;
    if (!activities || !contacts) return undefined;

    const today = todayISO();
    const contactById = new Map(contacts.map((contact) => [contact.id, contact]));

    const due: { activity: Activity; contact: Contact; dueDate: string }[] = [];
    for (const activity of activities) {
      if (activity.done || activity.dueDate === null || activity.dueDate > today) continue;
      const contact = contactById.get(activity.contactId);
      if (!contact || contact.archived) continue;
      due.push({ activity, contact, dueDate: activity.dueDate });
    }

    due.sort((a, b) => (a.dueDate === b.dueDate ? 0 : a.dueDate < b.dueDate ? -1 : 1));
    return due.map(({ activity, contact }) => ({ activity, contact }));
  }, [activitiesQuery.data, contactsQuery.data]);
}

// ---- Proposals ------------------------------------------------------------

export function useContactProposals(contactId: string) {
  return useQuery({
    queryKey: [...queryKeys.proposals, contactId],
    queryFn: () =>
      crud("proposals")
        .list()
        .filter((proposal) => proposal.contactId === contactId)
        .sort((a, b) => (a.sentDate === b.sentDate ? 0 : a.sentDate < b.sentDate ? 1 : -1)),
    ...QUERY_DEFAULTS,
  });
}

export function useProposalServices(proposalId: string) {
  return useQuery({
    queryKey: [...queryKeys.proposalServices, proposalId],
    queryFn: () => crud("proposalServices").list().filter((item) => item.proposalId === proposalId),
    ...QUERY_DEFAULTS,
  });
}

// ---- Contact mutations ----------------------------------------------------

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<Contact, "id" | "archived" | "createdBy" | "createdAt">) =>
      crud("contacts").create({
        ...input,
        archived: false,
        createdBy: user?.profile.userId ?? FALLBACK_PROFILE_ID,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    // `NewLeadDialog` already toasts its own error — see `src/main.tsx`'s
    // global `MutationCache` for what this flag means.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Contact> }) => crud("contacts").update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    // `lead-panel.tsx`'s `onSubmit` already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useMoveContactStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, stageId }: { contactId: string; stageId: string }) =>
      crud("contacts").update(contactId, { stageId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    ...MUTATION_DEFAULTS,
  });
}

export function useArchiveContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => crud("contacts").update(id, { archived: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    // `lead-panel.tsx`'s `handleArchive` already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useUnarchiveContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => crud("contacts").update(id, { archived: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    // `lead-panel.tsx`'s `handleUnarchive` already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

// ---- Activity mutations ---------------------------------------------------

export function useAddActivity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { contactId: string; content: string; dueDate: string | null }) =>
      crud("activities").create({
        contactId: input.contactId,
        content: input.content,
        dueDate: input.dueDate,
        done: input.dueDate ? false : true,
        createdBy: user?.profile.userId ?? FALLBACK_PROFILE_ID,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.activities }),
    // Both call sites (`handleAddNote`, `handleAddFollowup` in `lead-panel.tsx`) already toast their own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useToggleActivityDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => crud("activities").update(id, { done }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.activities }),
    // `lead-panel.tsx`'s `handleToggleDone` already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

// ---- Proposal mutations ---------------------------------------------------

export interface CreateProposalInput {
  contactId: string;
  sentDate: string;
  discountCents: number;
  notes: string | null;
  items: { serviceId: string; variantId: string | null; priceCents: number }[];
}

/** Creates the proposal (status starts `"sent"` — a `Proposal` row only exists once it's been sent) plus one `proposalService` row per item. */
export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      const proposal = crud("proposals").create({
        contactId: input.contactId,
        sentDate: input.sentDate,
        status: "sent",
        discountCents: input.discountCents,
        notes: input.notes,
      });
      const services = input.items.map((item) =>
        crud("proposalServices").create({
          proposalId: proposal.id,
          serviceId: item.serviceId,
          variantId: item.variantId,
          priceCents: item.priceCents,
        }),
      );
      return { proposal, services };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proposals });
      queryClient.invalidateQueries({ queryKey: queryKeys.proposalServices });
    },
    // `NewProposalDialog` already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

export function useSetProposalStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Proposal["status"] }) =>
      crud("proposals").update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.proposals }),
    // `lead-proposals.tsx`'s `handleSetStatus` already toasts its own error.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}

/**
 * Wraps `store.convertLead` (the store's one multi-table operation): the
 * new event copies the proposal's items, so both `events` and
 * `eventServices` need a refresh, alongside the `contacts`/`proposals` the
 * conversion itself touches. Any rejection (wrong contact, proposal not
 * accepted, contact already converted) is the store's own `Error`, thrown
 * from inside this `async` `mutationFn` — left uncaught here on purpose so
 * it surfaces verbatim (pt-BR message included) as `mutation.error`.
 */
export function useConvertLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Parameters<typeof convertLead>[0]) => convertLead(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events });
      queryClient.invalidateQueries({ queryKey: queryKeys.eventServices });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.proposals });
    },
    // `ConvertLeadDialog` already forwards this error's own message via toast.
    meta: { toastHandled: true },
    ...MUTATION_DEFAULTS,
  });
}
