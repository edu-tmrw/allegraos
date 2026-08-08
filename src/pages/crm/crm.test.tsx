import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test } from "vitest";
import { AuthProvider } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { CrmPage } from "@/pages/crm";

/** Every hook CrmPage uses needs `QueryClientProvider`; `useCreateContact` also needs `useAuth()`'s `<AuthProvider>`. */
function renderCrmPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <CrmPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB(); // fresh seed relative to today — also clears store.ts's in-memory cache between tests
});

describe("CrmPage — kanban", () => {
  test("renders the 4 seeded stage columns with seeded leads distributed correctly", async () => {
    renderCrmPage();

    const novoContato = await screen.findByTestId("stage-column-stage-novo-contato");
    const emConversa = screen.getByTestId("stage-column-stage-em-conversa");
    const propostaEnviada = screen.getByTestId("stage-column-stage-proposta-enviada");
    const negociacao = screen.getByTestId("stage-column-stage-negociacao");

    expect(within(novoContato).getByRole("heading", { name: "Novo contato" })).toBeInTheDocument();
    expect(within(emConversa).getByRole("heading", { name: "Em conversa" })).toBeInTheDocument();
    expect(within(propostaEnviada).getByRole("heading", { name: "Proposta enviada" })).toBeInTheDocument();
    expect(within(negociacao).getByRole("heading", { name: "Negociação" })).toBeInTheDocument();

    // "Novo contato" -> Fernanda only
    expect(within(novoContato).getByText("Fernanda Lima")).toBeInTheDocument();

    // "Em conversa" -> Rafael, Juliana, Beatriz
    expect(within(emConversa).getByText("Rafael Souza")).toBeInTheDocument();
    expect(within(emConversa).getByText("Juliana Prado")).toBeInTheDocument();
    expect(within(emConversa).getByText("Beatriz Nunes")).toBeInTheDocument();

    // "Proposta enviada" -> Marcos only
    expect(within(propostaEnviada).getByText("Marcos Andrade")).toBeInTheDocument();

    // "Negociação" -> Patrícia only
    expect(within(negociacao).getByText("Patrícia Gomes")).toBeInTheDocument();

    // Lucas is archived — never shows up on the board
    expect(screen.queryByText("Lucas Tavares")).not.toBeInTheDocument();
  });
});

describe("CrmPage — follow-ups banner", () => {
  test("shows the due-today and the overdue follow-up, with only the overdue one flagged negative", async () => {
    renderCrmPage();

    const banner = await screen.findByTestId("followups-banner");
    expect(within(banner).getByText("2 follow-ups pendentes")).toBeInTheDocument();

    expect(within(banner).getByTestId("followup-act-juliana-1")).toBeInTheDocument();
    expect(within(banner).getByTestId("followup-act-marcos-1")).toBeInTheDocument();

    // act-marcos-1 is 3 days overdue -> negative-flagged; act-juliana-1 is due today -> not overdue
    expect(screen.getByTestId("followup-date-act-marcos-1")).toHaveClass("text-negative");
    expect(screen.getByTestId("followup-date-act-juliana-1")).not.toHaveClass("text-negative");
  });
});

describe("CrmPage — lista view", () => {
  test("changing a lead's stage via the inline select moves it", async () => {
    const user = userEvent.setup();
    renderCrmPage();

    // findBy, not getBy: the page now renders a loading skeleton for the one
    // tick before `useStages()`/`useEventTypes()` resolve, so the real tab
    // isn't necessarily there synchronously on mount.
    await user.click(await screen.findByRole("tab", { name: "Lista" }));

    const trigger = await screen.findByRole("combobox", { name: "Etapa de Fernanda Lima" });
    expect(trigger).toHaveTextContent("Novo contato");

    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "Em conversa" }));

    await waitFor(() => expect(trigger).toHaveTextContent("Em conversa"));
  });

  test("a won lead (linked event) is absent from every kanban column and from the lista's stage <Select>, but shows with a GANHO badge in the lista", async () => {
    const user = userEvent.setup();

    // contact-patricia sits in "Negociação" — link her to a new event via
    // the store-oracle technique this suite already uses (mirrors
    // lead-panel.test.tsx's own GANHO fixture): an Evento whose contactId
    // points back at her is exactly the "ganho" signal both the lead panel
    // and this page's kanban filtering key off.
    crud("events").create({
      name: "Casamento Patrícia & João",
      eventTypeId: "type-casamento",
      eventDate: "2026-12-05",
      eventTime: null,
      contactId: "contact-patricia",
      discountCents: 0,
      canceled: false,
      notes: null,
    });

    renderCrmPage();

    // Kanban (default view): every column renders, but Patrícia is in none
    // of them — not even her own "Negociação" column.
    const negociacao = await screen.findByTestId("stage-column-stage-negociacao");
    expect(within(negociacao).queryByText("Patrícia Gomes")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lead-card-contact-patricia")).not.toBeInTheDocument();

    // Lista: she's still there — timeline/data stays reachable via the
    // panel — with the GANHO badge and her stage as plain text, not a <Select>.
    await user.click(await screen.findByRole("tab", { name: "Lista" }));

    const nameButton = await screen.findByRole("button", { name: "Patrícia Gomes" });
    const row = nameButton.closest("tr")!;
    expect(within(row).getByTestId("ganho-badge-contact-patricia")).toHaveTextContent("GANHO");
    expect(within(row).getByText("Negociação")).toBeInTheDocument();
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("inline select offers only active stages, not inactive ones", async () => {
    const user = userEvent.setup();

    // Create an inactive stage via the test-only store oracle
    const { crud } = await import("@/data/store");
    crud("pipelineStages").create({ name: "Antiga", position: 99, active: false });

    renderCrmPage();

    // findBy, not getBy: the page now renders a loading skeleton for the one
    // tick before `useStages()`/`useEventTypes()` resolve, so the real tab
    // isn't necessarily there synchronously on mount.
    await user.click(await screen.findByRole("tab", { name: "Lista" }));

    const trigger = await screen.findByRole("combobox", { name: "Etapa de Fernanda Lima" });
    await user.click(trigger);

    // Verify that only the 4 active stages are offered, not the inactive one
    expect(screen.getByRole("option", { name: "Novo contato" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Em conversa" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Proposta enviada" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Negociação" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Antiga" })).not.toBeInTheDocument();
  });
});
