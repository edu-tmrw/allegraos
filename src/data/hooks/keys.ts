/**
 * Shared plumbing for every hook in `src/data/hooks/`: the query key
 * registry and the two option bundles every `useQuery`/`useMutation` call
 * binds. Kept here (rather than duplicated per file) so every hook agrees
 * on the exact key for a resource — a mutation in one file can invalidate a
 * key "owned" by a query in another file without retyping the string.
 *
 * Every key is a one-element tuple named after its resource. Parameterized
 * variants append the param (e.g. `[...queryKeys.eventServices, eventId]`)
 * — since React Query's default `invalidateQueries` matches by *prefix*,
 * invalidating the bare resource key also invalidates every parameterized
 * variant built on top of it.
 */

function key<Name extends string>(name: Name): readonly [Name] {
  return [name] as const;
}

export const queryKeys = {
  profiles: key("profiles"),
  roles: key("roles"),
  eventTypes: key("eventTypes"),
  services: key("services"),
  serviceVariants: key("serviceVariants"),
  categories: key("categories"),
  stages: key("stages"),
  events: key("events"),
  eventServices: key("eventServices"),
  transactions: key("transactions"),
  contacts: key("contacts"),
  activities: key("activities"),
  proposals: key("proposals"),
  proposalServices: key("proposalServices"),
  teamMembers: key("teamMembers"),
  dashboard: key("dashboard"),
};

/**
 * Every query reads a synchronous, already-in-memory local store — there's
 * no server that can produce fresher data on its own, so nothing should
 * ever go stale on a timer. Freshness only ever comes from an explicit
 * `invalidateQueries()` after a mutation. `retry` is off for the same
 * reason: retrying a local read/write can't paper over a transient network
 * blip that doesn't exist here, it would just repeat the same outcome.
 */
export const QUERY_DEFAULTS = { staleTime: Infinity, retry: false } as const;

/** Mirrors `QUERY_DEFAULTS`'s `retry: false` for `useMutation` callers. */
export const MUTATION_DEFAULTS = { retry: false } as const;

/**
 * `createdBy` for mutations that stamp the acting user: `useAuth()`'s
 * current profile, falling back to Gabi's seeded admin profile. Every real
 * route in the app is already permission-gated, so `user` should never
 * actually be `null` here — this only guards a mutation hook called before
 * the session finishes resolving.
 */
export const FALLBACK_PROFILE_ID = "profile-ana";
