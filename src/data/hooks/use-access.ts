import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile, Role } from "@/domain/types";
import { MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";
import { supabase } from "@/data/supabase/client";
import { unwrap } from "@/data/supabase/result";
import {
  toProfile,
  toProfileUpdate,
  toRole,
  toRoleInsert,
  toRoleUpdate,
} from "@/data/supabase/rows";

interface InviteUserResponse {
  userId: string;
}

function isInviteUserResponse(value: unknown): value is InviteUserResponse {
  if (typeof value !== "object" || value === null || !("userId" in value)) return false;
  return typeof value.userId === "string" && value.userId.length > 0;
}

// ---- Profiles --------------------------------------------------------------

export function useProfiles() {
  return useQuery({
    queryKey: queryKeys.profiles,
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from("profiles").select("*").order("name", { ascending: true }),
      );
      return rows.map(toProfile);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; name: string; roleId: string }) => {
      const result = await supabase.functions.invoke<InviteUserResponse>("invite-user", {
        body: input,
      });
      const data = unwrap(result);
      if (!isInviteUserResponse(data)) {
        throw new Error("O convite foi enviado, mas a resposta recebida é inválida.");
      }

      return {
        userId: data.userId,
        name: input.name,
        roleId: input.roleId,
        active: true,
      } satisfies Profile;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profiles }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, patch }: { userId: string; patch: Partial<Profile> }) => {
      const row = unwrap<Parameters<typeof toProfile>[0]>(
        await supabase
          .from("profiles")
          .update(toProfileUpdate(patch))
          .eq("user_id", userId)
          .select("*")
          .single(),
      );
      return toProfile(row);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profiles }),
    ...MUTATION_DEFAULTS,
  });
}

// ---- Roles ------------------------------------------------------------------

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles,
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from("roles").select("*").order("name", { ascending: true }),
      );
      return rows.map(toRole);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Role, "id">) => {
      const row = unwrap<Parameters<typeof toRole>[0]>(
        await supabase.from("roles").insert(toRoleInsert(input)).select("*").single(),
      );
      return toRole(row);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.roles }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profiles }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
    },
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Role> }) => {
      const row = unwrap<Parameters<typeof toRole>[0]>(
        await supabase
          .from("roles")
          .update(toRoleUpdate(patch))
          .eq("id", id)
          .select("*")
          .single(),
      );
      return toRole(row);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.roles }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profiles }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
    },
    ...MUTATION_DEFAULTS,
  });
}
