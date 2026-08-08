import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { eventFinancials } from "@/domain/calc";
import type { Transaction } from "@/domain/types";
import { formatBRL, formatDate } from "@/lib/format";
import { EventoFinancialCards } from "@/pages/eventos/detalhe-financials";
import { DetalheLancamentos } from "@/pages/eventos/detalhe-lancamentos";

const SESSION_KEY = "allegra-session";
// Casamento Patrícia & João: 4 seeded transactions (2 "in", 2 "out") with 4
// distinct dates spanning last month and this month — see seed.ts.
const SEEDED_EVENT_ID = "event-casamento-proximo";

/** See `service-items-editor.test.tsx` for why a plain-string `getByText(formatBRL(cents))` is unsafe (NBSP vs. Testing Library's DOM-side-only whitespace normalizer). */
function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function expectMoneyText(element: HTMLElement, cents: number): void {
  expect(normalizeSpace(element.textContent ?? "")).toContain(normalizeSpace(formatBRL(cents)));
}

/** Mirrors `useEventTransactions`'s own ordering contract: date desc, `createdAt` desc as the tiebreak. */
function sortDesc(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });
}

/**
 * Mounts the lançamentos section next to the financial stat cards — the
 * exact pairing `detalhe.tsx` renders on the real page — so that adding an
 * entry through the section can be proven to also move the Custo/Lucro
 * stats, end-to-end through the real mock store (no mocked hooks either
 * side).
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
        <DetalheLancamentos eventId={eventId} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("DetalheLancamentos", () => {
  test("lists the seeded event's transactions date desc with signed amounts, and adding a saída updates Custo/Lucro", async () => {
    const user = userEvent.setup();
    renderSection(SEEDED_EVENT_ID, "profile-ana");

    const seededTxs = sortDesc(crud("transactions").list().filter((tx) => tx.eventId === SEEDED_EVENT_ID));
    expect(seededTxs.length).toBeGreaterThan(1);

    const rows = await screen.findAllByTestId(/^lancamento-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(
      seededTxs.map((tx) => `lancamento-${tx.id}`),
    );

    rows.forEach((row, index) => {
      const tx = seededTxs[index];
      expect(within(row).getByText(formatDate(tx.date))).toBeInTheDocument();
      expectMoneyText(row, tx.amountCents);
      expect(row.textContent).toContain(tx.kind === "in" ? "+" : "−");
    });

    // Oracle values BEFORE, straight from the domain layer (never re-derived
    // inline) — mirrors `detalhe-servicos.test.tsx`'s own before/after style.
    const eventRow = crud("events").get(SEEDED_EVENT_ID)!;
    const items = crud("eventServices").list().filter((item) => item.eventId === SEEDED_EVENT_ID);
    const txsBefore = crud("transactions").list();
    const before = eventFinancials(eventRow, items, txsBefore);
    expectMoneyText(await screen.findByTestId("stat-custo"), before.costCents);
    expectMoneyText(screen.getByTestId("stat-lucro"), before.profitCents);

    // Add a saída (R$100,00) through the real UI — kind switch auto-selects
    // an active "out" categoria, so no Select interaction is needed for it.
    await user.click(await screen.findByRole("button", { name: "Novo lançamento" }));
    await user.click(await screen.findByRole("button", { name: "Saída" }));
    await user.type(screen.getByLabelText("Valor*"), "10000");
    await user.click(screen.getByRole("button", { name: "Registrar lançamento" }));

    await waitFor(() => expect(crud("transactions").list()).toHaveLength(txsBefore.length + 1));

    const txsAfter = crud("transactions").list();
    const after = eventFinancials(eventRow, items, txsAfter);
    expect(after.costCents).toBe(before.costCents + 10_000);
    expect(after.profitCents).toBe(before.profitCents - 10_000);

    await waitFor(() => expectMoneyText(screen.getByTestId("stat-custo"), after.costCents));
    expectMoneyText(screen.getByTestId("stat-lucro"), after.profitCents);
  });
});
