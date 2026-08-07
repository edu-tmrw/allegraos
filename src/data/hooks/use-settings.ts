/**
 * Settings data hooks: event types, services (+ variants), transaction
 * categories, and the CRM pipeline stages. Every list hook returns the full
 * active+inactive list — screens are responsible for filtering by `active`
 * themselves (so an inactive row can still be shown/edited on a settings
 * screen, just not offered as a choice elsewhere).
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { canInactivateStage, crud } from "@/data/store";
import type { EventType, PipelineStage, Service, ServiceVariant, TransactionCategory } from "@/domain/types";
import { MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";

// ---- Event types ----------------------------------------------------------

export function useEventTypes() {
  return useQuery({
    queryKey: queryKeys.eventTypes,
    queryFn: () => crud("eventTypes").list(),
    ...QUERY_DEFAULTS,
  });
}

export function useCreateEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EventType, "id">) => crud("eventTypes").create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EventType> }) =>
      crud("eventTypes").update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes }),
    ...MUTATION_DEFAULTS,
  });
}

// ---- Services ---------------------------------------------------------------

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: () => crud("services").list(),
    ...QUERY_DEFAULTS,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Service, "id">) => crud("services").create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.services }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Service> }) =>
      crud("services").update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.services }),
    ...MUTATION_DEFAULTS,
  });
}

// ---- Service variants ---------------------------------------------------

/** Full active+inactive variant list, filtered to `serviceId`'s own variants when given. */
export function useServiceVariants(serviceId?: string) {
  return useQuery({
    queryKey: [...queryKeys.serviceVariants, serviceId],
    queryFn: () => {
      const all = crud("serviceVariants").list();
      return serviceId ? all.filter((variant) => variant.serviceId === serviceId) : all;
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateServiceVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ServiceVariant, "id">) => crud("serviceVariants").create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.serviceVariants }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateServiceVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ServiceVariant> }) =>
      crud("serviceVariants").update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.serviceVariants }),
    ...MUTATION_DEFAULTS,
  });
}

// ---- Transaction categories ----------------------------------------------

/** Full active+inactive category list, filtered to `kind` when given. */
export function useCategories(kind?: "in" | "out") {
  return useQuery({
    queryKey: [...queryKeys.categories, kind],
    queryFn: () => {
      const all = crud("transactionCategories").list();
      return kind ? all.filter((category) => category.kind === kind) : all;
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TransactionCategory, "id">) => crud("transactionCategories").create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TransactionCategory> }) =>
      crud("transactionCategories").update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
    ...MUTATION_DEFAULTS,
  });
}

// ---- Pipeline stages --------------------------------------------------------

/** Full active+inactive stage list, sorted by `position` ascending. */
export function useStages() {
  return useQuery({
    queryKey: queryKeys.stages,
    queryFn: () => crud("pipelineStages").list().sort((a, b) => a.position - b.position),
    ...QUERY_DEFAULTS,
  });
}

export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<PipelineStage, "id">) => crud("pipelineStages").create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stages }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PipelineStage> }) =>
      crud("pipelineStages").update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stages }),
    ...MUTATION_DEFAULTS,
  });
}

/** Reassigns `position` (1-indexed) to match `orderedIds`'s order — a drag-and-drop reorder. */
export function useReorderStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      orderedIds.forEach((id, index) => {
        crud("pipelineStages").update(id, { position: index + 1 });
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stages }),
    ...MUTATION_DEFAULTS,
  });
}

/**
 * A live (non-cached) check, not a query: whether `stageId` currently has
 * no non-archived contact sitting on it, so a settings screen can decide
 * whether "inactivate" is allowed at the moment the user clicks it.
 */
export function useCanInactivateStage(): (stageId: string) => boolean {
  return useCallback((stageId: string) => canInactivateStage(stageId), []);
}
