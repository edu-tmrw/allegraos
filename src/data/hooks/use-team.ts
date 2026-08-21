/** Team member data hooks (the payroll-adjacent roster, not app users/profiles). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TeamMember } from "@/domain/types";
import { MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";
import { getSupabase } from "@/data/supabase/client";
import type { Tables } from "@/data/supabase/database.types";
import { unwrap } from "@/data/supabase/result";
import { toTeamMember, toTeamMemberInsert, toTeamMemberUpdate } from "@/data/supabase/rows";

export function useTeamMembers() {
  return useQuery({
    queryKey: queryKeys.teamMembers,
    queryFn: async () => {
      const rows = unwrap(await getSupabase().from("team_members").select("*").order("name", { ascending: true }));
      return rows.map(toTeamMember);
    },
    ...QUERY_DEFAULTS,
  });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TeamMember, "id">) => {
      const row = unwrap(
        await getSupabase().from("team_members").insert(toTeamMemberInsert(input)).select("*").single<Tables<"team_members">>(),
      );
      return toTeamMember(row);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teamMembers }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TeamMember> }) => {
      const row = unwrap(
        await getSupabase().from("team_members").update(toTeamMemberUpdate(patch)).eq("id", id).select("*").single<Tables<"team_members">>(),
      );
      return toTeamMember(row);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teamMembers }),
    ...MUTATION_DEFAULTS,
  });
}
