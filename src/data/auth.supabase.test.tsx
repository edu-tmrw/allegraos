import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthProvider,
  requestPasswordReset,
  useAuth,
} from "@/data/auth";
import {
  useCreateProfile,
  useCreateRole,
  useProfiles,
  useRoles,
  useUpdateProfile,
  useUpdateRole,
} from "@/data/hooks/use-access";

const mocks = vi.hoisted(() => {
  const profileRows = new Map<string, Record<string, unknown>>();
  const roleRows: Record<string, unknown>[] = [];
  let authCallback: ((event: string, session: unknown) => void) | undefined;
  const maybeSingle = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const order = vi.fn();
  const insert = vi.fn();
  const update = vi.fn();
  const single = vi.fn();
  const from = vi.fn((table: string) => {
    let requestedId: string | undefined;
    let insertedValue: Record<string, unknown> | undefined;
    let updatedValue: Record<string, unknown> | undefined;

    const builder = {
      select(columns: string) {
        select(columns);
        return builder;
      },
      eq(column: string, value: unknown) {
        eq(column, value);
        if ((column === "user_id" || column === "id") && typeof value === "string") {
          requestedId = value;
        }
        return builder;
      },
      order(column: string) {
        order(column);
        return Promise.resolve({
          data: table === "profiles" ? [...profileRows.values()] : [...roleRows],
          error: null,
        });
      },
      insert(value: Record<string, unknown>) {
        insert(value);
        insertedValue = value;
        return builder;
      },
      update(value: Record<string, unknown>) {
        update(value);
        updatedValue = value;
        return builder;
      },
      async single() {
        single();
        if (table === "profiles") {
          const existing = requestedId ? profileRows.get(requestedId) : undefined;
          return { data: existing ? { ...existing, ...updatedValue } : null, error: null };
        }
        const existing = requestedId
          ? roleRows.find((row) => row.id === requestedId)
          : undefined;
        return {
          data: {
            id: requestedId ?? "cccccccc-cccc-cccc-cccc-cccccccccccc",
            name: "Novo papel",
            manage_finance: false,
            manage_events: false,
            manage_crm: false,
            manage_team: false,
            manage_settings: false,
            created_at: "2026-08-21T12:00:00Z",
            ...(existing ?? {}),
            ...(insertedValue ?? updatedValue),
          },
          error: null,
        };
      },
      async maybeSingle() {
        maybeSingle();
        return {
          data: requestedId ? (profileRows.get(requestedId) ?? null) : null,
          error: null,
        };
      },
    };

    return builder;
  });

  const unsubscribe = vi.fn();
  const onAuthStateChange = vi.fn((callback: (event: string, session: unknown) => void) => {
    authCallback = callback;
    return { data: { subscription: { unsubscribe } } };
  });
  const signInWithPassword = vi.fn(async () => ({ data: { session: null, user: null }, error: null }));
  const signOut = vi.fn(async () => ({ error: null }));
  const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
  const invoke = vi.fn(async () => ({
    data: { userId: "99999999-9999-9999-9999-999999999999" },
    error: null,
  }));

  return {
    profileRows,
    roleRows,
    emitAuth(event: string, session: unknown) {
      authCallback?.(event, session);
    },
    resetState() {
      profileRows.clear();
      roleRows.splice(0);
      authCallback = undefined;
      for (const mock of [
        maybeSingle,
        eq,
        select,
        order,
        insert,
        update,
        single,
        from,
        unsubscribe,
        onAuthStateChange,
        signInWithPassword,
        signOut,
        resetPasswordForEmail,
        invoke,
      ]) {
        mock.mockClear();
      }
    },
    maybeSingle,
    eq,
    select,
    order,
    insert,
    update,
    single,
    from,
    unsubscribe,
    onAuthStateChange,
    signInWithPassword,
    signOut,
    resetPasswordForEmail,
    invoke,
  };
});

vi.mock("@/data/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
    from: mocks.from,
    functions: { invoke: mocks.invoke },
  },
}));

const ADMIN_USER_ID = "11111111-1111-1111-1111-111111111111";

function sessionFor(userId: string) {
  return { user: { id: userId } };
}

function Probe() {
  const { user, signInWithPassword, logout } = useAuth();
  return (
    <div>
      <span>{user ? `${user.profile.name}|${user.role.name}` : "sem sessão"}</span>
      <button onClick={() => void signInWithPassword({ email: "ana@allegra.com.br", password: "secret" })}>
        entrar
      </button>
      <button onClick={() => void logout()}>sair</button>
    </div>
  );
}

function queryWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mocks.resetState();
  mocks.roleRows.push({
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    name: "Admin",
    manage_finance: true,
    manage_events: true,
    manage_crm: true,
    manage_team: true,
    manage_settings: true,
    created_at: "2026-08-21T12:00:00Z",
  });
  mocks.profileRows.set(ADMIN_USER_ID, {
    user_id: ADMIN_USER_ID,
    name: "Ana Admin",
    role_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    active: true,
    created_at: "2026-08-21T12:00:00Z",
    role: {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Admin",
      manage_finance: true,
      manage_events: true,
      manage_crm: true,
      manage_team: true,
      manage_settings: true,
      created_at: "2026-08-21T12:00:00Z",
    },
  });
});

describe("AuthProvider with Supabase Auth", () => {
  test("subscribes once and loads the signed-in active profile joined to its role before rendering", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "entrar" })).not.toBeInTheDocument();

    await act(async () => {
      mocks.emitAuth("INITIAL_SESSION", sessionFor(ADMIN_USER_ID));
    });

    expect(await screen.findByText("Ana Admin|Admin")).toBeVisible();
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.select).toHaveBeenCalledWith(expect.stringContaining("roles"));
  });

  test("signs out a session whose profile is missing", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      mocks.emitAuth("INITIAL_SESSION", sessionFor("22222222-2222-2222-2222-222222222222"));
    });

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("sem sessão")).toBeVisible();
  });

  test("delegates password sign-in and logout to Supabase Auth", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => mocks.emitAuth("INITIAL_SESSION", null));

    await user.click(await screen.findByRole("button", { name: "entrar" }));
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@allegra.com.br",
      password: "secret",
    });

    await user.click(screen.getByRole("button", { name: "sair" }));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});

test("sends password-reset email through Supabase Auth", async () => {
  await requestPasswordReset("ana@allegra.com.br");

  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
    "ana@allegra.com.br",
    expect.objectContaining({ redirectTo: expect.stringContaining("/login") }),
  );
});

test("invites a profile through the invite-user Edge Function without minting a local UUID", async () => {
  const { result } = renderHook(() => useCreateProfile(), { wrapper: queryWrapper });

  await act(async () => {
    await result.current.mutateAsync({
      email: "carla@allegra.com.br",
      name: "Carla",
      roleId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    });
  });

  expect(mocks.invoke).toHaveBeenCalledWith("invite-user", {
    body: {
      email: "carla@allegra.com.br",
      name: "Carla",
      roleId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    },
  });
});

test("loads profiles and roles through Supabase and maps their snake_case rows", async () => {
  const { result } = renderHook(
    () => ({ profiles: useProfiles(), roles: useRoles() }),
    { wrapper: queryWrapper },
  );

  await waitFor(() => {
    expect(result.current.profiles.isSuccess).toBe(true);
    expect(result.current.roles.isSuccess).toBe(true);
  });

  expect(result.current.profiles.data).toEqual([
    {
      userId: ADMIN_USER_ID,
      name: "Ana Admin",
      roleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      active: true,
    },
  ]);
  expect(result.current.roles.data?.[0]).toMatchObject({
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    name: "Admin",
    manageFinance: true,
    manageSettings: true,
  });
  expect(mocks.from).toHaveBeenCalledWith("profiles");
  expect(mocks.from).toHaveBeenCalledWith("roles");
});

test("updates profiles and creates and updates roles with typed database payloads", async () => {
  const { result } = renderHook(
    () => ({
      updateProfile: useUpdateProfile(),
      createRole: useCreateRole(),
      updateRole: useUpdateRole(),
    }),
    { wrapper: queryWrapper },
  );

  await act(async () => {
    await result.current.updateProfile.mutateAsync({
      userId: ADMIN_USER_ID,
      patch: { active: false },
    });
    await result.current.createRole.mutateAsync({
      name: "Operação",
      manageFinance: false,
      manageEvents: true,
      manageCrm: false,
      manageTeam: true,
      manageSettings: false,
    });
    await result.current.updateRole.mutateAsync({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      patch: { manageCrm: false },
    });
  });

  expect(mocks.update).toHaveBeenCalledWith({ active: false });
  expect(mocks.insert).toHaveBeenCalledWith({
    name: "Operação",
    manage_finance: false,
    manage_events: true,
    manage_crm: false,
    manage_team: true,
    manage_settings: false,
  });
  expect(mocks.update).toHaveBeenCalledWith({ manage_crm: false });
});
