import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { crud, resetDB } from "@/data/store";
import type { Transaction } from "@/domain/types";
import { formatBRL, formatDate } from "@/lib/format";
import { FinanceiroPage } from "@/pages/financeiro";


/** See `service-items-editor.test.tsx` for why a plain-string `getByText(formatBRL(cents))` is unsafe (NBSP vs. Testing Library's DOM-side-only whitespace normalizer). */
function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Only valid for a non-negative `cents` — mirrors `<Money>`'s own contract. Use a direct `formatBRL` comparison for a value that may be negative (Saldo). */
function expectMoneyText(element: HTMLElement, cents: number): void {
  expect(normalizeSpace(element.textContent ?? "")).toContain(normalizeSpace(formatBRL(cents)));
}

/** Mirrors `useTransactions`'s own ordering contract: date desc, `createdAt` desc as the tiebreak. */
function sortDesc(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });
}

function sumByKind(txs: Transaction[]): { inCents: number; outCents: number } {
  return txs.reduce(
    (acc, tx) => {
      if (tx.kind === "in") acc.inCents += tx.amountCents;
      else acc.outCents += tx.amountCents;
      return acc;
    },
    { inCents: 0, outCents: 0 },
  );
}

/**
 * `FinanceiroPage` navigates nowhere (editing is a dialog, not a route) —
 * unlike `EventosPage`'s own render helper, no `MemoryRouter` is needed
 * here, only the query client. Transaction ownership is database-assigned.
 */
function renderFinanceiro() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FinanceiroPage />
    </QueryClientProvider>,
  );
}

/** Switches the Mês filter to "Todos os meses" — every test uses this first so its own oracle can read the whole store without guessing which month the smart default landed on. */
async function selectTodosOsMeses(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("combobox", { name: "Mês" }));
  await user.click(await screen.findByRole("option", { name: "Todos os meses" }));
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("FinanceiroPage", () => {
  test("month filter Todos renders every seeded transaction date desc, with null-event rows labeled Administração central", async () => {
    const user = userEvent.setup();
    renderFinanceiro();

    await selectTodosOsMeses(user);

    const table = await screen.findByRole("table");
    const expected = sortDesc(crud("transactions").list());

    await waitFor(() => {
      const domRows = within(table).getAllByTestId(/^lancamento-/);
      expect(domRows.map((row) => row.getAttribute("data-testid"))).toEqual(
        expected.map((tx) => `lancamento-${tx.id}`),
      );
    });

    const generalTx = expected.find((tx) => tx.eventId === null)!;
    const generalRow = within(table).getByTestId(`lancamento-${generalTx.id}`);
    expect(within(generalRow).getByText("Administração central")).toBeInTheDocument();
  });

  test("filtering Saídas + Sala / Escritório narrows the rows and recomputes the totals footer", async () => {
    const user = userEvent.setup();
    renderFinanceiro();

    await selectTodosOsMeses(user);

    await user.click(screen.getByRole("combobox", { name: "Tipo" }));
    await user.click(await screen.findByRole("option", { name: "Saídas" }));

    await user.click(screen.getByRole("combobox", { name: "Categoria" }));
    await user.click(await screen.findByRole("option", { name: "Sala / Escritório" }));

    // Oracle straight from the store — every seeded "Aluguel da sala" saída,
    // regardless of month.
    const categoryId = crud("transactionCategories")
      .list()
      .find((category) => category.name === "Sala / Escritório")!.id;
    const expected = crud("transactions")
      .list()
      .filter((tx) => tx.kind === "out" && tx.categoryId === categoryId);
    expect(expected.length).toBeGreaterThan(1);

    const table = await screen.findByRole("table");
    await waitFor(() => {
      expect(within(table).getAllByTestId(/^lancamento-/)).toHaveLength(expected.length);
    });
    within(table)
      .getAllByTestId(/^lancamento-/)
      .forEach((row) => expect(within(row).getByText("Sala / Escritório")).toBeInTheDocument());

    const { outCents } = sumByKind(expected);
    expectMoneyText(screen.getByTestId("financeiro-totais-saidas"), outCents);
    expectMoneyText(screen.getByTestId("financeiro-totais-entradas"), 0);
    // Saldo can be negative here (all rows are saídas) — compare against
    // `formatBRL` directly rather than the non-negative-only helper above.
    expect(normalizeSpace(screen.getByTestId("financeiro-totais-saldo").textContent ?? "")).toContain(
      normalizeSpace(formatBRL(-outCents)),
    );
  });

  test("creating a saída on Administração central via the unlocked dialog adds it to the list and updates the totals", async () => {
    const user = userEvent.setup();
    renderFinanceiro();

    await selectTodosOsMeses(user);

    const before = crud("transactions").list();
    const beforeTotals = sumByKind(before);

    await user.click(await screen.findByRole("button", { name: "Novo lançamento" }));
    await user.click(await screen.findByRole("button", { name: "Saída" }));
    await user.type(screen.getByLabelText("Valor*"), "10000"); // R$100,00
    await user.click(screen.getByRole("button", { name: "Registrar lançamento" }));

    await waitFor(() => expect(crud("transactions").list()).toHaveLength(before.length + 1));

    const after = crud("transactions").list();
    const created = after.find((tx) => !before.some((b) => b.id === tx.id))!;
    expect(created.kind).toBe("out");
    expect(created.eventId).toBeNull();
    expect(created.amountCents).toBe(10_000);

    const table = await screen.findByRole("table");
    await waitFor(() => expect(within(table).getByTestId(`lancamento-${created.id}`)).toBeInTheDocument());
    const newRow = within(table).getByTestId(`lancamento-${created.id}`);
    expect(within(newRow).getByText("Administração central")).toBeInTheDocument();

    expectMoneyText(screen.getByTestId("financeiro-totais-saidas"), beforeTotals.outCents + 10_000);
    const expectedBalance = beforeTotals.inCents - (beforeTotals.outCents + 10_000);
    expect(normalizeSpace(screen.getByTestId("financeiro-totais-saldo").textContent ?? "")).toContain(
      normalizeSpace(formatBRL(expectedBalance)),
    );
  });

  test("delete flow: clicking the trash button, confirming the AlertDialog, removes the row and updates the totals", async () => {
    const user = userEvent.setup();
    renderFinanceiro();

    await selectTodosOsMeses(user);

    const table = await screen.findByRole("table");
    const allTransactionsBefore = crud("transactions").list();
    const beforeTotals = sumByKind(allTransactionsBefore);

    // Pick the first seeded transaction to delete.
    const txToDelete = allTransactionsBefore[0]!;
    const categoryName = crud("transactionCategories")
      .list()
      .find((category) => category.id === txToDelete.categoryId)?.name ?? "";
    const rowLabel = `${formatDate(txToDelete.date)} — ${categoryName} — ${formatBRL(txToDelete.amountCents)}`;

    // Find and click the trash button for this row.
    const row = within(table).getByTestId(`lancamento-${txToDelete.id}`);
    const trashButton = within(row).getByRole("button", { name: `Excluir lançamento: ${rowLabel}` });

    await user.click(trashButton);

    // Confirm the deletion in the AlertDialog.
    const confirmButton = await screen.findByRole("button", { name: "Excluir" });
    await user.click(confirmButton);

    // Wait for the row to disappear from the DOM.
    await waitFor(() => {
      expect(within(table).queryByTestId(`lancamento-${txToDelete.id}`)).not.toBeInTheDocument();
    });

    // Assert the transaction is gone from the store.
    expect(crud("transactions").get(txToDelete.id)).toBeNull();

    // Assert the totals footer updated correctly.
    const expectedOutCents = txToDelete.kind === "out" ? beforeTotals.outCents - txToDelete.amountCents : beforeTotals.outCents;
    const expectedInCents = txToDelete.kind === "in" ? beforeTotals.inCents - txToDelete.amountCents : beforeTotals.inCents;
    expectMoneyText(screen.getByTestId("financeiro-totais-saidas"), expectedOutCents);
    expectMoneyText(screen.getByTestId("financeiro-totais-entradas"), expectedInCents);
    const expectedBalance = expectedInCents - expectedOutCents;
    expect(normalizeSpace(screen.getByTestId("financeiro-totais-saldo").textContent ?? "")).toContain(
      normalizeSpace(formatBRL(expectedBalance)),
    );
  });
});
