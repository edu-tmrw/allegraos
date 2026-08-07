import { beforeEach, describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider, RequirePerm, defaultRouteFor, useAuth, usePerms } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import type { Role } from "@/domain/types";

const SESSION_KEY = "allegra-session";

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

/** Exposes `useAuth()` to assertions/clicks; `loginAsId`, if given, wires a "login" button to it. */
function AuthConsumer({ loginAsId }: { loginAsId?: string }) {
  const { user, loginAs, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? `${user.profile.name}|${user.role.name}` : "none"}</span>
      {loginAsId && <button onClick={() => loginAs(loginAsId)}>login</button>}
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

function PermsConsumer() {
  const perms = usePerms();
  return <span data-testid="perms">{JSON.stringify(perms)}</span>;
}

/** Renders a route tree with `/protected` gated by `manageFinance`, plus every `defaultRouteFor` destination as a marker page. */
function renderProtected(initialPath: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequirePerm perm="manageFinance">
                <div>Protected Content</div>
              </RequirePerm>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route path="/crm" element={<div>CRM Page</div>} />
          <Route path="/eventos" element={<div>Eventos Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("defaultRouteFor", () => {
  test("a role with manageFinance goes to /dashboard (admin)", () => {
    expect(defaultRouteFor(makeRole({ manageFinance: true }))).toBe("/dashboard");
  });

  test("a role without manageFinance but with manageCrm goes to /crm (comercial)", () => {
    expect(defaultRouteFor(makeRole({ manageCrm: true }))).toBe("/crm");
  });

  test("a role with every flag false goes to /eventos", () => {
    expect(defaultRouteFor(makeRole())).toBe("/eventos");
  });
});

describe("AuthProvider / useAuth", () => {
  test("loginAs logs in a valid, active profile and persists the session id", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <AuthConsumer loginAsId="profile-ana" />
      </AuthProvider>,
    );
    expect(screen.getByTestId("user")).toHaveTextContent("none");

    await user.click(screen.getByRole("button", { name: "login" }));

    expect(screen.getByTestId("user")).toHaveTextContent("Ana Amaral|Admin");
    expect(localStorage.getItem(SESSION_KEY)).toBe("profile-ana");
  });

  test("loginAs with an unknown profile id is refused (stays logged out)", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <AuthConsumer loginAsId="profile-does-not-exist" />
      </AuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: "login" }));

    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  test("loginAs with an inactive profile is refused (inactive profiles may not log in)", async () => {
    crud("profiles").create({
      userId: "profile-inactive",
      name: "Inactive Person",
      roleId: "role-comercial",
      active: false,
    });
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <AuthConsumer loginAsId="profile-inactive" />
      </AuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: "login" }));

    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  test("logout clears the user and the persisted session", async () => {
    localStorage.setItem(SESSION_KEY, "profile-ana");
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId("user")).toHaveTextContent("Ana Amaral|Admin");

    await user.click(screen.getByRole("button", { name: "logout" }));

    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  test("restores the session from localStorage on mount", () => {
    localStorage.setItem(SESSION_KEY, "profile-bia");

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("user")).toHaveTextContent("Bia Costa|Comercial");
  });

  test("a stale profile id in storage is treated as logged out", () => {
    localStorage.setItem(SESSION_KEY, "profile-deleted-long-ago");

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });
});

describe("usePerms", () => {
  test("returns the current user's role when logged in", () => {
    localStorage.setItem(SESSION_KEY, "profile-bia");

    render(
      <AuthProvider>
        <PermsConsumer />
      </AuthProvider>,
    );

    const perms = JSON.parse(screen.getByTestId("perms").textContent!) as Role;
    expect(perms.name).toBe("Comercial");
    expect(perms.manageCrm).toBe(true);
    expect(perms.manageFinance).toBe(false);
  });

  test("returns an all-false Role (id '', name '') when logged out", () => {
    render(
      <AuthProvider>
        <PermsConsumer />
      </AuthProvider>,
    );

    const perms = JSON.parse(screen.getByTestId("perms").textContent!) as Role;
    expect(perms).toEqual({
      id: "",
      name: "",
      manageFinance: false,
      manageEvents: false,
      manageCrm: false,
      manageTeam: false,
      manageSettings: false,
    });
  });
});

describe("RequirePerm", () => {
  test("redirects an unauthenticated user to /login", async () => {
    renderProtected("/protected");

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  test("redirects a user missing the flag to their defaultRouteFor (comercial hitting a manageFinance gate -> /crm)", async () => {
    localStorage.setItem(SESSION_KEY, "profile-bia");

    renderProtected("/protected");

    expect(await screen.findByText("CRM Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  test("renders children when the user has the required flag (admin)", async () => {
    localStorage.setItem(SESSION_KEY, "profile-ana");

    renderProtected("/protected");

    expect(await screen.findByText("Protected Content")).toBeInTheDocument();
  });
});
