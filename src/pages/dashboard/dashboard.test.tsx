import { beforeEach, describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { loadDB, resetDB } from "@/data/store";
import { cashPositionCents, monthlyFlow, totalReceivableCents } from "@/domain/calc";
import { formatBRL, todayISO } from "@/lib/format";
import type { EventService } from "@/domain/types";
import { DashboardPage } from "@/pages/dashboard";
import { buildDonutData } from "@/pages/dashboard/service-donut";

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * The `<Money>` inside the stat card labeled `labelText`, as raw
 * `textContent`. Raw (not jest-dom's whitespace-normalizing matchers) so
 * the NBSP (U+00A0) Intl inserts after "R$" is actually verified — mirrors
 * `money.test.tsx`'s own convention.
 */
function moneyTextInCard(labelText: string): string {
  const label = screen.getByText(labelText);
  const card = label.closest('[data-slot="card"]');
  if (!card) throw new Error(`expected "${labelText}" to sit inside a [data-slot="card"]`);
  const moneyEl = card.querySelector('[data-slot="money"]');
  if (!moneyEl) throw new Error(`expected a [data-slot="money"] inside the "${labelText}" card`);
  return moneyEl.textContent ?? "";
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("DashboardPage", () => {
  test("the 4 stat cards match calc.ts's oracle computed directly on the seed", async () => {
    const db = loadDB();
    const itemsByEvent: Record<string, EventService[]> = {};
    for (const item of db.eventServices) {
      (itemsByEvent[item.eventId] ??= []).push(item);
    }
    const expectedCash = cashPositionCents(db.transactions);
    const expectedReceivable = totalReceivableCents(db.events, itemsByEvent, db.transactions);
    const flow12 = monthlyFlow(db.transactions, 12, todayISO());
    const lastMonth = flow12[flow12.length - 1];
    // Mirrors <Money>'s own sign presentation: kind="out" (negative lucro)
    // prefixes a real U+2212 minus, never a plain hyphen; non-negative is neutral/no prefix.
    const expectedLucro =
      lastMonth.profitCents < 0
        ? `−${formatBRL(Math.abs(lastMonth.profitCents))}`
        : formatBRL(lastMonth.profitCents);

    renderDashboard();
    await screen.findByText("Caixa atual"); // past the initial loading skeleton

    expect(moneyTextInCard("Caixa atual")).toBe(formatBRL(expectedCash));
    expect(moneyTextInCard("A receber")).toBe(formatBRL(expectedReceivable));
    expect(moneyTextInCard("Faturamento do mês")).toBe(formatBRL(lastMonth.revenueCents));
    expect(moneyTextInCard("Lucro do mês")).toBe(expectedLucro);
  });

  test("renders the seeded upcoming events soonest-first, skipping the canceled one", async () => {
    renderDashboard();

    const heading = await screen.findByText("Próximos eventos");
    const card = heading.closest('[data-slot="card"]');
    if (!card) throw new Error('expected "Próximos eventos" to sit inside a [data-slot="card"]');

    const rows = await screen.findAllByRole("listitem");
    const names = rows.filter((row) => card.contains(row)).map((row) => row.textContent ?? "");

    // Seed: "Patrícia & João" (+15d), "AllTech" (+2mo), "Isabela" (+4mo) are
    // the only non-canceled events dated today or later; "Camila & Pedro"
    // (+1mo) is canceled and must not appear even though it'd otherwise sort
    // between the 1st and 2nd.
    expect(names).toHaveLength(3);
    expect(names[0]).toContain("Casamento Patrícia & João");
    expect(names[1]).toContain("Convenção Anual AllTech");
    expect(names[2]).toContain("15 Anos de Isabela Ferreira");
  });
});

describe("buildDonutData", () => {
  test("aggregates everything past the top 5 into one 'Outros' slice, preserving order", () => {
    const rows = [
      { serviceId: "s1", name: "Serviço 1", totalCents: 700 },
      { serviceId: "s2", name: "Serviço 2", totalCents: 600 },
      { serviceId: "s3", name: "Serviço 3", totalCents: 500 },
      { serviceId: "s4", name: "Serviço 4", totalCents: 400 },
      { serviceId: "s5", name: "Serviço 5", totalCents: 300 },
      { serviceId: "s6", name: "Serviço 6", totalCents: 200 },
      { serviceId: "s7", name: "Serviço 7", totalCents: 100 },
    ];

    const slices = buildDonutData(rows);

    expect(slices).toHaveLength(6);
    expect(slices.slice(0, 5)).toEqual([
      { id: "s1", name: "Serviço 1", totalCents: 700 },
      { id: "s2", name: "Serviço 2", totalCents: 600 },
      { id: "s3", name: "Serviço 3", totalCents: 500 },
      { id: "s4", name: "Serviço 4", totalCents: 400 },
      { id: "s5", name: "Serviço 5", totalCents: 300 },
    ]);
    expect(slices[5]).toEqual({ id: "outros", name: "Outros", totalCents: 300 }); // 200 + 100, tail sum
  });

  test("passes rows through unchanged (no 'Outros' slice) when there are 5 or fewer", () => {
    const rows = [
      { serviceId: "s1", name: "Serviço 1", totalCents: 300 },
      { serviceId: "s2", name: "Serviço 2", totalCents: 200 },
    ];

    expect(buildDonutData(rows)).toEqual([
      { id: "s1", name: "Serviço 1", totalCents: 300 },
      { id: "s2", name: "Serviço 2", totalCents: 200 },
    ]);
  });
});
