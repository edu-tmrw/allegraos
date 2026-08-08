import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { TransactionFormDialog } from "@/components/transaction-form-dialog";
import { todayISO } from "@/lib/format";

const SESSION_KEY = "allegra-session";
// Casamento Patrícia & João — active, non-canceled, already has 4 seeded
// transactions of its own (see seed.ts) — a real event to lock the dialog to.
const SEEDED_EVENT_ID = "event-casamento-proximo";

/**
 * `TransactionFormDialog` calls `useCreateTransaction`/`useUpdateTransaction`,
 * both of which read `useAuth()` internally (for `createdBy`) — every render
 * needs a real `<AuthProvider>` above it, not just a `QueryClientProvider`.
 */
function renderDialog(props: Partial<React.ComponentProps<typeof TransactionFormDialog>> = {}) {
  localStorage.setItem(SESSION_KEY, "profile-ana");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const merged: React.ComponentProps<typeof TransactionFormDialog> = {
    open: true,
    onOpenChange: () => {},
    ...props,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TransactionFormDialog {...merged} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("TransactionFormDialog", () => {
  test("create in event context (lockEvent): defaults to hoje/Entrada/Pagamento de contrato, and a valid submit persists it with the event's id", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ defaultEventId: SEEDED_EVENT_ID, lockEvent: true, onOpenChange });

    expect(screen.getByLabelText("Data*")).toHaveValue(todayISO());
    expect(screen.getByRole("button", { name: "Entrada" })).toHaveAttribute("data-variant", "default");
    expect(screen.getByRole("button", { name: "Saída" })).toHaveAttribute("data-variant", "outline");
    // The combobox itself renders on the very first paint (so `findByRole`
    // resolves immediately, before the categoria catalog query lands) — wait
    // for its TEXT to settle instead of just its existence.
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Categoria*" })).toHaveTextContent("Pagamento de contrato"),
    );

    const before = crud("transactions").list();

    await user.type(screen.getByLabelText("Valor*"), "150000");
    await user.click(screen.getByRole("button", { name: "Registrar lançamento" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    const after = crud("transactions").list();
    expect(after).toHaveLength(before.length + 1);
    const created = after.find((tx) => !before.some((b) => b.id === tx.id))!;
    expect(created.kind).toBe("in");
    expect(created.amountCents).toBe(150_000);
    expect(created.date).toBe(todayISO());
    expect(created.categoryId).toBe("cat-pagamento-contrato");
    expect(created.eventId).toBe(SEEDED_EVENT_ID);
  });

  test("switching to Saída resets the categoria to an active 'out' category, and a zero amount blocks submit", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ defaultEventId: SEEDED_EVENT_ID, lockEvent: true, onOpenChange });

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Categoria*" })).toHaveTextContent("Pagamento de contrato"),
    );

    await user.click(screen.getByRole("button", { name: "Saída" }));

    const categoriaCombobox = screen.getByRole("combobox", { name: "Categoria*" });
    await waitFor(() => expect(categoriaCombobox).toHaveTextContent("Gasolina / Deslocamento"));

    const before = crud("transactions").list();

    // Amount was never touched — still 0 — so submit must block, not persist.
    await user.click(screen.getByRole("button", { name: "Registrar lançamento" }));

    expect(await screen.findByText("Informe um valor maior que zero.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(crud("transactions").list()).toHaveLength(before.length);
  });
});
