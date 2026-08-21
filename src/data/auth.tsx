import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate } from "react-router";
import type { Profile, Role } from "@/domain/types";
import { supabase } from "@/data/supabase/client";
import { toProfile, toRole } from "@/data/supabase/rows";

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

const PROFILE_WITH_ROLE_SELECT = `
  user_id,
  name,
  role_id,
  active,
  created_at,
  role:roles!profiles_role_id_fkey (
    id,
    name,
    manage_finance,
    manage_events,
    manage_crm,
    manage_team,
    manage_settings,
    created_at
  )
`;

/** The boolean permission flags on `Role` — what a `<RequirePerm>` can gate on. */
type PermFlag = {
  [K in keyof Role]: Role[K] extends boolean ? K : never;
}[keyof Role];

interface AuthUser {
  profile: Profile;
  role: Role;
}

interface SignInCredentials {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signInWithPassword: (credentials: SignInCredentials) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthErrorLike {
  code?: string;
  message: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthMessage(error: AuthErrorLike): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email ou senha inválidos.";
    case "email_not_confirmed":
      return "Confirme seu email antes de entrar.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    default:
      console.error("Erro inesperado do Supabase Auth.", error);
      return "Não foi possível concluir a autenticação. Tente novamente.";
  }
}

/** Sends the native Supabase recovery email back to the app's login route. */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = new URL("/login", window.location.origin).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(toAuthMessage(error));
}

/** Provides the real Supabase session and its active Allegra profile to the app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let sessionRevision = 0;

    async function applySession(userId: string | null, revision: number) {
      if (userId === null) {
        if (disposed || revision !== sessionRevision) return;
        setUser(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_WITH_ROLE_SELECT)
        .eq("user_id", userId)
        .maybeSingle();

      if (disposed || revision !== sessionRevision) return;

      if (error) {
        console.error("Não foi possível carregar o perfil autenticado.", error);
      }

      if (error || !data || !data.active || !data.role) {
        setUser(null);
        setIsLoading(false);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) console.error("Não foi possível encerrar a sessão inválida.", signOutError);
        return;
      }

      setUser({ profile: toProfile(data), role: toRole(data.role) });
      setIsLoading(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const revision = ++sessionRevision;
      setIsLoading(true);

      // Defer further Supabase calls until Auth releases its internal session lock.
      queueMicrotask(() => {
        void applySession(session?.user.id ?? null, revision);
      });
    });

    return () => {
      disposed = true;
      sessionRevision += 1;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (credentials: SignInCredentials) => {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw new Error(toAuthMessage(error));
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await requestPasswordReset(email);
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(toAuthMessage(error));
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signInWithPassword,
      requestPasswordReset: sendPasswordReset,
      logout,
    }),
    [user, isLoading, signInWithPassword, sendPasswordReset, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {isLoading ? (
        <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
          Carregando sessão…
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

/** The authenticated Supabase session. Must be used inside an `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth() must be used within an <AuthProvider>.");
  return context;
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

/** Redirects logged-out or unauthorized users without weakening database RLS. */
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
