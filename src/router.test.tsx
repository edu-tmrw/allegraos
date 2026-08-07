import { beforeEach, describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AuthProvider } from "@/data/auth";
import { resetDB } from "@/data/store";
import { routes } from "@/router";

const SESSION_KEY = "allegra-session";

function renderAt(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("routes", () => {
  test("an unauthenticated visit to a protected path redirects to /login", async () => {
    renderAt("/dashboard");

    expect(await screen.findByText("Onde cada detalhe fala de amor")).toBeInTheDocument();
  });

  test("a logged-in comercial landing on '/' redirects to /crm (their defaultRouteFor)", async () => {
    localStorage.setItem(SESSION_KEY, "profile-bia");

    renderAt("/");

    expect(await screen.findByRole("heading", { name: "CRM" })).toBeInTheDocument();
  });
});
