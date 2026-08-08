import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AuthProvider } from "@/data/auth";
import { resetDB } from "@/data/store";
import { routes } from "@/router";

const SESSION_KEY = "allegra-session";

/**
 * Mirrors `main.tsx`'s provider nesting: every routed page can assume a
 * `QueryClient` is present (as of Task 18's CRM, `/crm` genuinely reads
 * through `@tanstack/react-query` hooks, not just static placeholder JSX).
 */
function renderAt(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
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
