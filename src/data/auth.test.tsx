import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthProvider, RequirePerm, defaultRouteFor, usePerms } from "@/data/auth";
import type { Role } from "@/domain/types";

const auth = vi.hoisted(() => {
  let callback: ((event: string, session: { user: { id: string } } | null) => void) | undefined;
  const rows = new Map<string, Record<string, unknown>>();
  const maybeSingle = vi.fn(async () => ({ data: null as Record<string, unknown> | null, error: null }));
  const eq = vi.fn((_column: string, userId: string) => {
    maybeSingle.mockResolvedValueOnce({ data: rows.get(userId) ?? null, error: null });
    return { maybeSingle };
  });
  const select = vi.fn(() => ({ eq }));

  return {
    rows,
    emit(session: { user: { id: string } } | null) {
      callback?.("INITIAL_SESSION", session);
    },
    reset() {
      rows.clear();
      callback = undefined;
      maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
      eq.mockClear();
      select.mockClear();
    },
    supabase: {
      auth: {
        onAuthStateChange: vi.fn((next: typeof callback) => {
          callback = next;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
        resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      },
      from: vi.fn(() => ({ select })),
    },
  };
});

vi.mock("@/data/supabase/client", () => ({ supabase: auth.supabase }));

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const COMMERCIAL_ID = "22222222-2222-2222-2222-222222222222";

function roleRow(id: string, name: string, overrides: Partial<Record<string, boolean>> = {}) {
  return {
    id,
    name,
    manage_finance: false,
    manage_events: false,
    manage_crm: false,
    manage_team: false,
    manage_settings: false,
    created_at: "2026-08-21T12:00:00Z",
    ...overrides,
  };
}

function profileRow(userId: string, name: string, role: ReturnType<typeof roleRow>) {
  return {
    user_id: userId,
    name,
    role_id: role.id,
    active: true,
    created_at: "2026-08-21T12:00:00Z",
    role,
  };
}

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: "role-x",
    name: "Role X",
    manageFinance: false,
    manageEvents: false,
    manageCrm: false,
    manageTeam: false,
    manageSettings: false,
    ...overrides,
  };
}

function PermsProbe() {
  return <span data-testid="perms">{JSON.stringify(usePerms())}</span>;
}

function renderProtected() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequirePerm perm="manageFinance">
                <div>Conteúdo protegido</div>
              </RequirePerm>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/crm" element={<div>CRM</div>} />
          <Route path="/eventos" element={<div>Eventos</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  auth.reset();
  auth.rows.set(
    ADMIN_ID,
    profileRow(ADMIN_ID, "Ana Admin", roleRow("role-admin", "Admin", { manage_finance: true })),
  );
  auth.rows.set(
    COMMERCIAL_ID,
    profileRow(
      COMMERCIAL_ID,
      "Bia Comercial",
      roleRow("role-commercial", "Comercial", { manage_crm: true }),
    ),
  );
});

describe("defaultRouteFor", () => {
  test("prioritizes Finance, then CRM, then Eventos", () => {
    expect(defaultRouteFor(makeRole({ manageFinance: true, manageCrm: true }))).toBe("/dashboard");
    expect(defaultRouteFor(makeRole({ manageCrm: true }))).toBe("/crm");
    expect(defaultRouteFor(makeRole())).toBe("/eventos");
  });
});

describe("usePerms", () => {
  test("returns the active session role and remains fail-closed when signed out", async () => {
    const view = render(
      <AuthProvider>
        <PermsProbe />
      </AuthProvider>,
    );
    await act(async () => auth.emit({ user: { id: COMMERCIAL_ID } }));
    expect(JSON.parse(await screen.findByTestId("perms").then((node) => node.textContent!))).toMatchObject({
      name: "Comercial",
      manageCrm: true,
      manageFinance: false,
    });

    view.unmount();
    render(
      <AuthProvider>
        <PermsProbe />
      </AuthProvider>,
    );
    await act(async () => auth.emit(null));
    expect(JSON.parse((await screen.findByTestId("perms")).textContent!)).toMatchObject({
      id: "",
      name: "",
      manageFinance: false,
      manageCrm: false,
    });
  });
});

describe("RequirePerm", () => {
  test("redirects a signed-out user to login", async () => {
    renderProtected();
    await act(async () => auth.emit(null));
    expect(await screen.findByText("Login")).toBeInTheDocument();
  });

  test("redirects Comercial away from Finance to CRM", async () => {
    renderProtected();
    await act(async () => auth.emit({ user: { id: COMMERCIAL_ID } }));
    expect(await screen.findByText("CRM")).toBeInTheDocument();
  });

  test("renders the protected content for Admin", async () => {
    renderProtected();
    await act(async () => auth.emit({ user: { id: ADMIN_ID } }));
    expect(await screen.findByText("Conteúdo protegido")).toBeInTheDocument();
  });
});
