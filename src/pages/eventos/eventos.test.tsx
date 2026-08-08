import { beforeEach, describe, expect, test } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { EventosPage } from "@/pages/eventos";

const SESSION_KEY = "allegra-session";

/**
 * Renders the real page behind a `QueryClientProvider` + `AuthProvider`
 * (logged in as the seeded admin, so `manageEvents`/`manageFinance` are both
 * true) + a `MemoryRouter` with a stub `/eventos/:id` route — real enough to
 * prove a post-create `navigate()` actually landed, without needing Task
 * 13's real detail page.
 */
function renderEventosPage() {
  localStorage.setItem(SESSION_KEY, "profile-ana");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/eventos"]}>
          <Routes>
            <Route path="/eventos" element={<EventosPage />} />
            <Route path="/eventos/:id" element={<div data-testid="evento-detalhe">Detalhe</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("EventosPage", () => {
  test("default status filter (Ativos) shows only the 3 seeded active events, hiding concluded/canceled", async () => {
    renderEventosPage();

    const table = await screen.findByRole("table");
    // header row + 3 active events
    expect(within(table).getAllByRole("row")).toHaveLength(4);

    expect(within(table).getByText("Casamento Patrícia & João")).toBeInTheDocument();
    expect(within(table).getByText("Convenção Anual AllTech")).toBeInTheDocument();
    expect(within(table).getByText("15 Anos de Isabela Ferreira")).toBeInTheDocument();

    expect(within(table).queryByText("Casamento Beatriz & Thiago")).not.toBeInTheDocument();
    expect(within(table).queryByText("15 Anos de Helena Martins")).not.toBeInTheDocument();
    expect(within(table).queryByText("Casamento Camila & Pedro")).not.toBeInTheDocument();
  });

  test("switching the Status filter to Todos shows all 6 seeded events", async () => {
    const user = userEvent.setup();
    renderEventosPage();

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Todos" }));

    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(7));
    expect(within(table).getByText("Casamento Beatriz & Thiago")).toBeInTheDocument();
    expect(within(table).getByText("15 Anos de Helena Martins")).toBeInTheDocument();
    expect(within(table).getByText("Casamento Camila & Pedro")).toBeInTheDocument();
  });

  test("search is diacritics-insensitive: typing \"joao\" finds \"Casamento Patrícia & João\"", async () => {
    const user = userEvent.setup();
    renderEventosPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Casamento Patrícia & João")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Buscar"), "joao");

    await waitFor(() => {
      expect(within(table).getByText("Casamento Patrícia & João")).toBeInTheDocument();
      expect(within(table).queryByText("Convenção Anual AllTech")).not.toBeInTheDocument();
      expect(within(table).queryByText("15 Anos de Isabela Ferreira")).not.toBeInTheDocument();
    });
  });

  test("creating an event via the dialog adds it to the store and navigates to its detail page", async () => {
    const user = userEvent.setup();
    renderEventosPage();

    await user.click(await screen.findByRole("button", { name: "Novo evento" }));

    await user.type(screen.getByLabelText("Nome*"), "Casamento Teste E2E");

    await user.click(screen.getByRole("combobox", { name: "Tipo*" }));
    await user.click(await screen.findByRole("option", { name: "Casamento" }));

    fireEvent.change(screen.getByLabelText("Data*"), { target: { value: "2026-09-01" } });

    await user.click(screen.getByRole("button", { name: "Criar evento" }));

    expect(await screen.findByTestId("evento-detalhe")).toBeInTheDocument();

    const created = crud("events").list().find((ev) => ev.name === "Casamento Teste E2E");
    expect(created).toBeDefined();
    expect(created?.eventTypeId).toBe("type-casamento");
    expect(created?.eventDate).toBe("2026-09-01");
    expect(created?.eventTime).toBeNull();
  });
});
