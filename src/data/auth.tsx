/**
 * Fake authentication + RBAC guards for AllegraOS. There is no real
 * security here — any caller can `loginAs` any profile id; this exists
 * only to drive the permission-gated UX (nav, routes) over the mock store
 * until the Supabase phase replaces it with real auth + RLS.
 *
 * A session is just a `Profile.userId` persisted in `localStorage` under
 * `allegra-session`. Every time it's read (initial load or an explicit
 * `loginAs`) the id is resolved against the store; anything that doesn't
 * resolve to an active profile with a role — unknown id, stale/deleted
 * profile, `active: false` — is treated as logged out.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate } from "react-router";
import { crud } from "@/data/store";
import type { Profile, Role } from "@/domain/types";

const SESSION_KEY = "allegra-session";

/** `usePerms()`'s answer when nobody is logged in: every gate closed. */
const EMPTY_ROLE: Role = {
  id: "",
  name: "",
  manageFinance: false,
  manageEvents: false,
  manageCrm: false,
  manageTeam: false,
  manageSettings: false,
};

/** The boolean permission flags on `Role` — what a `<RequirePerm>` can gate on. */
type PermFlag = {
  [K in keyof Role]: Role[K] extends boolean ? K : never;
}[keyof Role];

interface AuthUser {
  profile: Profile;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  loginAs: (profileId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Resolves a profile id to `{profile, role}` via the store, or `null` when
 * the id doesn't resolve to a profile, that profile is inactive, or its
 * role is missing.
 */
function resolveUser(profileId: string): AuthUser | null {
  const profile = crud("profiles").get(profileId);
  if (!profile || !profile.active) return null;

  const role = crud("roles").get(profile.roleId);
  if (!role) return null;

  return { profile, role };
}

/** Provides the fake session to the app. Mount once, near the root. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const storedProfileId = localStorage.getItem(SESSION_KEY);
    return storedProfileId ? resolveUser(storedProfileId) : null;
  });

  const loginAs = useCallback((profileId: string) => {
    const resolved = resolveUser(profileId);
    if (!resolved) return; // unknown/inactive profile — refuse silently, no state change
    localStorage.setItem(SESSION_KEY, profileId);
    setUser(resolved);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loginAs, logout }),
    [user, loginAs, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** The current fake session: `{user, loginAs, logout}`. Must be used inside an `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used within an <AuthProvider>.");
  return ctx;
}

/** The current user's `Role`; an all-false `Role` (id "", name "") when logged out. */
export function usePerms(): Role {
  const { user } = useAuth();
  return user ? user.role : EMPTY_ROLE;
}

/** Where to land a user: the highest-ranked area their role can actually use. */
export function defaultRouteFor(role: Role): string {
  if (role.manageFinance) return "/dashboard";
  if (role.manageCrm) return "/crm";
  return "/eventos";
}

/**
 * Gates `children` behind permission `perm`. Logged out -> redirect to
 * `/login`; logged in but missing the flag -> redirect to that user's
 * `defaultRouteFor`; otherwise renders `children`.
 */
export function RequirePerm({
  perm,
  children,
}: {
  perm: PermFlag;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.role[perm]) return <Navigate to={defaultRouteFor(user.role)} replace />;
  return <>{children}</>;
}
