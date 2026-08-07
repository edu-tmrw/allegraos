/** Team member data hooks (the payroll-adjacent roster, not app users/profiles). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crud } from "@/data/store";
import type { TeamMember } from "@/domain/types";
import { MUTATION_DEFAULTS, QUERY_DEFAULTS, queryKeys } from "@/data/hooks/keys";

export function useTeamMembers() {
  return useQuery({
    queryKey: queryKeys.teamMembers,
    queryFn: () => crud("teamMembers").list(),
    ...QUERY_DEFAULTS,
  });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TeamMember, "id">) => crud("teamMembers").create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teamMembers }),
    ...MUTATION_DEFAULTS,
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TeamMember> }) =>
      crud("teamMembers").update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teamMembers }),
    ...MUTATION_DEFAULTS,
  });
}
