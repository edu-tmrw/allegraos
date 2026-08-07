import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { eventFinancials } from "@/domain/calc";
import { formatBRL } from "@/lib/format";
import { EventoFinancialCards } from "@/pages/eventos/detalhe-financials";
import { DetalheServicos } from "@/pages/eventos/detalhe-servicos";

const SESSION_KEY = "allegra-session";
// Casamento Patrícia & João: 5 seeded services (Assessoria Premium,
// Storymaker, Orquestra/Sexteto, Aluguel de Som, Foto Polaroid) + a 100_000
// discount — see seed.ts.
const SEEDED_EVENT_ID = "event-casamento-proximo";

/** See `service-items-editor.test.tsx` for why a plain-string `getByText(formatBRL(cents))` is unsafe (NBSP vs. Testing Library's DOM-side-only whitespace normalizer). */
function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * `toContain`, not `toBe`: `element` here is the whole `data-testid="stat-*"`
 * stat card (label + value together, e.g. "ContratoR$ 18.000,00" as flat
 * `textContent`) — this only needs to prove the money figure is in there
 * somewhere, not that the card contains nothing else.
 */
function expectMoneyText(element: HTMLElement, cents: number): void {
  expect(normalizeSpace(element.textContent ?? "")).toContain(normalizeSpace(formatBRL(cents)));
}

/**
 * Mounts the services section next to the financial stat cards — the exact
 * pairing `detalhe.tsx` renders on the real page — so that adding a service
 * through the section can be proven to also move the "Contrato" stat,
 * end-to-end through the real mock store (no mocked hooks on either side).
 */
function renderSection(eventId: string, profileId: string) {
  localStorage.setItem(SESSION_KEY, profileId);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EventoFinancialCards eventId={eventId} />
        <DetalheServicos eventId={eventId} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("DetalheServicos", () => {
  test("shows the seeded event's services, and adding one persists to the store and updates the Contrato stat", async () => {
    const user = userEvent.setup();
    renderSection(SEEDED_EVENT_ID, "profile-ana");

    expect(await screen.findByText("Assessoria Premium")).toBeInTheDocument();
    expect(screen.getByText("Storymaker")).toBeInTheDocument();
    expect(screen.getByText("Sexteto")).toBeInTheDocument();

    const eventBefore = crud("events").get(SEEDED_EVENT_ID)!;
    const itemsBefore = crud("eventServices").list().filter((item) => item.eventId === SEEDED_EVENT_ID);
    const txs = crud("transactions").list();
    const before = eventFinancials(eventBefore, itemsBefore, txs);
    expectMoneyText(await screen.findByTestId("stat-contrato"), before.contractCents);

    // Celebrante e Mestre de Cerimônia isn't already on this event and has
    // no variants — adding it needs no variant selection, keeping this test
    // focused on the persistence/recompute path rather than re-covering the
    // add-dialog's own flow (already covered in service-items-editor.test.tsx).
    await user.click(screen.getByRole("button", { name: "Adicionar serviço" }));
    await user.click(screen.getByRole("combobox", { name: "Serviço*" }));
    await user.click(await screen.findByRole("option", { name: "Celebrante e Mestre de Cerimônia" }));
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Celebrante e Mestre de Cerimônia")).toBeInTheDocument();

    const itemsAfter = crud("eventServices").list().filter((item) => item.eventId === SEEDED_EVENT_ID);
    expect(itemsAfter).toHaveLength(itemsBefore.length + 1);
    const added = itemsAfter.find((item) => item.serviceId === "svc-celebrante");
    expect(added?.priceCents).toBe(250_000);

    const after = eventFinancials(eventBefore, itemsAfter, txs);
    expect(after.contractCents).toBe(before.contractCents + 250_000);
    await waitFor(() => expectMoneyText(screen.getByTestId("stat-contrato"), after.contractCents));
  });
});
