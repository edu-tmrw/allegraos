/**
 * Settings data hooks: event types, services (+ variants), transaction
 * categories, and the CRM pipeline stages. Every list hook returns the full
 * active+inactive list — screens are responsible for filtering by `active`
 * themselves (so an inactive row can still be shown/edited on a settings
 * screen, just not offered as a choice elsewhere).
 */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventType, PipelineStage, Service, ServiceVariant, TransactionCategory } from "@/domain/types";
import { MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";
import { getSupabase } from "@/data/supabase/client";
import type { Tables } from "@/data/supabase/database.types";
import { ensureSuccess, unwrap } from "@/data/supabase/result";
import {
  toEventType,
  toEventTypeInsert,
  toEventTypeUpdate,
  toPipelineStage,
  toPipelineStageInsert,
  toPipelineStageUpdate,
  toService,
  toServiceInsert,
  toServiceUpdate,
  toServiceVariant,
  toServiceVariantInsert,
  toServiceVariantUpdate,
  toTransactionCategory,
  toTransactionCategoryInsert,
  toTransactionCategoryUpdate,
} from "@/data/supabase/rows";

// ---- Event types ----------------------------------------------------------

export function useEventTypes() {
  return useQuery({
    queryKey: queryKeys.eventTypes,
    queryFn: async () => {
      const rows = unwrap(await getSupabase().from("event_types").select("*").order("name", { ascending: true }));
      return rows.map(toEventType);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EventType, "id">) => {
      const row = unwrap(
        await getSupabase().from("event_types").insert(toEventTypeInsert(input)).select("*").single<Tables<"event_types">>(),
      );
      return toEventType(row);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EventType> }) => {
      const row = unwrap(
        await getSupabase().from("event_types").update(toEventTypeUpdate(patch)).eq("id", id).select("*").single<Tables<"event_types">>(),
      );
      return toEventType(row);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes }),
    ...MUTATION_DEFAULTS,
  });
}

// ---- Services ---------------------------------------------------------------

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: async () => {
      const rows = unwrap(await getSupabase().from("services").select("*").order("name", { ascending: true }));
      return rows.map(toService);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Service, "id">) => {
      const row = unwrap(
        await getSupabase().from("services").insert(toServiceInsert(input)).select("*").single<Tables<"services">>(),
      );
      return toService(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Service> }) => {
      const row = unwrap(
        await getSupabase().from("services").update(toServiceUpdate(patch)).eq("id", id).select("*").single<Tables<"services">>(),
      );
      return toService(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    ...MUTATION_DEFAULTS,
  });
}

// ---- Service variants ---------------------------------------------------

/** Full active+inactive variant list, filtered to `serviceId`'s own variants when given. */
export function useServiceVariants(serviceId?: string) {
  return useQuery({
    queryKey: [...queryKeys.serviceVariants, serviceId],
    queryFn: async () => {
      let query = getSupabase().from("service_variants").select("*");
      if (serviceId) query = query.eq("service_id", serviceId);
      const rows = unwrap(await query.order("name", { ascending: true }));
      return rows.map(toServiceVariant);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateServiceVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ServiceVariant, "id">) => {
      const row = unwrap(
        await getSupabase().from("service_variants").insert(toServiceVariantInsert(input)).select("*").single<Tables<"service_variants">>(),
      );
      return toServiceVariant(row);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.serviceVariants }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateServiceVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ServiceVariant> }) => {
      const row = unwrap(
        await getSupabase().from("service_variants").update(toServiceVariantUpdate(patch)).eq("id", id).select("*").single<Tables<"service_variants">>(),
      );
      return toServiceVariant(row);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.serviceVariants }),
    ...MUTATION_DEFAULTS,
  });
}

// ---- Transaction categories ----------------------------------------------

/** Full active+inactive category list, filtered to `kind` when given. */
export function useCategories(kind?: "in" | "out") {
  return useQuery({
    queryKey: [...queryKeys.categories, kind],
    queryFn: async () => {
      let query = getSupabase().from("transaction_categories").select("*");
      if (kind) query = query.eq("kind", kind);
      const rows = unwrap(await query.order("name", { ascending: true }));
      return rows.map(toTransactionCategory);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TransactionCategory, "id">) => {
      const row = unwrap(
        await getSupabase().from("transaction_categories").insert(toTransactionCategoryInsert(input)).select("*").single<Tables<"transaction_categories">>(),
      );
      return toTransactionCategory(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TransactionCategory> }) => {
      const row = unwrap(
        await getSupabase().from("transaction_categories").update(toTransactionCategoryUpdate(patch)).eq("id", id).select("*").single<Tables<"transaction_categories">>(),
      );
      return toTransactionCategory(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    ...MUTATION_DEFAULTS,
  });
}

// ---- Pipeline stages --------------------------------------------------------

/** Full active+inactive stage list, sorted by `position` ascending. */
export function useStages() {
  return useQuery({
    queryKey: queryKeys.stages,
    queryFn: async () => {
      const rows = unwrap(
        await getSupabase().from("pipeline_stages").select("*").order("position", { ascending: true }),
      );
      return rows.map(toPipelineStage);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<PipelineStage, "id">) => {
      const row = unwrap(
        await getSupabase().from("pipeline_stages").insert(toPipelineStageInsert(input)).select("*").single<Tables<"pipeline_stages">>(),
      );
      return toPipelineStage(row);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stages }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PipelineStage> }) => {
      const { active, ...ordinaryPatch } = patch;
      if (active !== undefined) {
        if (Object.keys(ordinaryPatch).length > 0) {
          throw new Error("A ativação da etapa deve ser salva separadamente dos demais campos.");
        }
        const row = unwrap(
          await getSupabase().rpc("set_pipeline_stage_active", {
            p_stage_id: id,
            p_active: active,
          }),
        );
        return toPipelineStage(row);
      }
      const row = unwrap(
        await getSupabase().from("pipeline_stages").update(toPipelineStageUpdate(ordinaryPatch)).eq("id", id).select("*").single<Tables<"pipeline_stages">>(),
      );
      return toPipelineStage(row);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stages }),
    ...MUTATION_DEFAULTS,
  });
}

/** Reassigns `position` (1-indexed) to match `orderedIds`'s order — a drag-and-drop reorder. */
export function useReorderStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      ensureSuccess(await getSupabase().rpc("reorder_stages", { p_ordered_ids: orderedIds }));
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
export function useCanInactivateStage(): (stageId: string) => Promise<boolean> {
  return useCallback(async (stageId: string) => {
    const result = await getSupabase()
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", stageId)
      .eq("archived", false);
    ensureSuccess(result);
    return result.count === 0;
  }, []);
}
