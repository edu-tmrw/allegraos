import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { eventFinancials } from "@/domain/calc";
import { formatBRL, formatTime } from "@/lib/format";
import { EventoDetalhePage } from "@/pages/eventos/detalhe";

const SESSION_KEY = "allegra-session";
// Casamento Patrícia & João — active, ~15 days out, scheduled time, partially
// paid: a good oracle case because none of its 5 financial numbers are 0.
const SEEDED_EVENT_ID = "event-casamento-proximo";

/**
 * Renders the real page behind a `QueryClientProvider` + `AuthProvider`
 * (logged in as `profileId`) + a `MemoryRouter` landing straight on the
 * event's own detail route, with a stub `/eventos` so the back-link/"voltar"
 * navigation has somewhere real to land.
 */
function renderDetalhe(eventId: string, profileId: string) {
  localStorage.setItem(SESSION_KEY, profileId);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/eventos/${eventId}`]}>
          <Routes>
            <Route path="/eventos" element={<div data-testid="eventos-lista">Lista</div>} />
            <Route path="/eventos/:id" element={<EventoDetalhePage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

/** Same "d 'de' MMMM 'de' yyyy [· HHhmm]" shape the header's destaque line renders. */
function expectedDateLine(eventDate: string, eventTime: string | null): string {
  const date = format(parseISO(eventDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return eventTime ? `${date} · ${formatTime(eventTime)}` : date;
}

/**
 * `formatBRL` separates "R$" from the number with a non-breaking space
 * (U+00A0). Testing Library's default text normalizer collapses *DOM* text
 * whitespace (nbsp included, since it matches `\s`) before comparing against
 * a `getByText` string matcher, but never touches the matcher string itself
 * — so an un-normalized nbsp here would silently never match. Mirroring
 * that same collapse keeps this an honest byte-for-byte-equivalent
 * expectation, not a loosened one.
 */
function moneyText(cents: number): string {
  return formatBRL(cents).replace(/ /g, " ");
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("EventoDetalhePage", () => {
  test("renders the seeded event's name, date line, and the 5 financial cards matching the calc oracle", async () => {
    renderDetalhe(SEEDED_EVENT_ID, "profile-ana");

    const event = crud("events").get(SEEDED_EVENT_ID)!;
    const items = crud("eventServices").list().filter((item) => item.eventId === SEEDED_EVENT_ID);
    const txs = crud("transactions").list();
    const expected = eventFinancials(event, items, txs);

    expect(await screen.findByRole("heading", { name: event.name, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(expectedDateLine(event.eventDate, event.eventTime))).toBeInTheDocument();

    // `useEventFinancials` composes 3 separate queries (event/items/txs) —
    // give the stat cards' own tick a chance to resolve before asserting on
    // them, instead of assuming they're already in by the time the (single-
    // query) date line above appeared.
    expect(
      within(await screen.findByTestId("stat-contrato")).getByText(moneyText(expected.contractCents)),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("stat-recebido")).getByText(moneyText(expected.receivedCents)),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("stat-a-receber")).getByText(moneyText(expected.receivableCents)),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-custo")).getByText(moneyText(expected.costCents))).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-lucro")).getByText(moneyText(expected.profitCents))).toBeInTheDocument();
  });

  test("canceling via the confirm dialog shows the banner and flips the status badge to Cancelado", async () => {
    const user = userEvent.setup();
    renderDetalhe(SEEDED_EVENT_ID, "profile-ana");
    const event = crud("events").get(SEEDED_EVENT_ID)!;

    await screen.findByRole("heading", { name: event.name, level: 1 });
    expect(screen.queryByText(/Evento cancelado\./)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar evento" }));
    await user.click(await screen.findByRole("button", { name: "Confirmar cancelamento" }));

    expect(await screen.findByText(/Evento cancelado\./)).toBeInTheDocument();
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(crud("events").get(SEEDED_EVENT_ID)?.canceled).toBe(true);
  });

  test("as Comercial (no manageFinance), the financial cards and Lançamentos section are absent but the header still renders", async () => {
    renderDetalhe(SEEDED_EVENT_ID, "profile-bia");
    const event = crud("events").get(SEEDED_EVENT_ID)!;

    expect(await screen.findByRole("heading", { name: event.name, level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Serviços contratados")).toBeInTheDocument();

    expect(screen.queryByTestId("stat-contrato")).not.toBeInTheDocument();
    expect(screen.queryByText("Lançamentos")).not.toBeInTheDocument();
  });
});

describe("EventoDetalhePage — Origem (vínculo lead ↔ evento)", () => {
  test("admin sees the 'Origem' link with the linked lead's name", async () => {
    // The seeded event starts with no contactId — link it to a real seeded
    // lead via the store oracle (mirrors lead-panel.test.tsx's own GANHO
    // fixture), the spec §9 "ganho" signal (`contactId` pointing back at a
    // contact) `useContactEvent`/this page's own `useContact` key off.
    crud("events").update(SEEDED_EVENT_ID, { contactId: "contact-patricia" });

    renderDetalhe(SEEDED_EVENT_ID, "profile-ana");
    const event = crud("events").get(SEEDED_EVENT_ID)!;

    expect(await screen.findByRole("heading", { name: event.name, level: 1 })).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: /Origem: Patrícia Gomes/ });
    expect(link).toHaveAttribute("href", "/crm?lead=contact-patricia");
  });

  test("no Origem link when the event has no linked contact", async () => {
    renderDetalhe(SEEDED_EVENT_ID, "profile-ana");
    const event = crud("events").get(SEEDED_EVENT_ID)!;

    expect(await screen.findByRole("heading", { name: event.name, level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Origem:/ })).not.toBeInTheDocument();
  });

  test("Bia, with manageCrm turned off for her role (Comercial), doesn't see the Origem link even though the event has a linked lead", async () => {
    crud("events").update(SEEDED_EVENT_ID, { contactId: "contact-patricia" });
    // Comercial's own manageCrm is true by default (see seed.ts) — flip it
    // off here via the same store-oracle technique
    // usuarias.test.tsx uses to prove this exact permission is what gates
    // Comercial's CRM access, so this test genuinely exercises `manageCrm:
    // false` rather than relying on a role shape that doesn't exist in the
    // seed.
    crud("roles").update("role-comercial", { manageCrm: false });

    renderDetalhe(SEEDED_EVENT_ID, "profile-bia");
    const event = crud("events").get(SEEDED_EVENT_ID)!;

    expect(await screen.findByRole("heading", { name: event.name, level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Origem:/ })).not.toBeInTheDocument();
  });
});
