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

  test("unlocked mode shows the same soft cancellation warning as lockEvent when the selected event was canceled since, and still allows submit", async () => {
    // Casamento Camila & Pedro — canceled, kept its 2 historical
    // transactions (see seed.ts). Editing one of them opens the dialog
    // UNLOCKED (no lockEvent) with the Select pre-selecting this canceled
    // event, mirroring what `lockEvent` mode already warned about.
    const CANCELED_EVENT_ID = "event-casamento-cancelado";
    const existingTx = crud("transactions").list().find((tx) => tx.eventId === CANCELED_EVENT_ID)!;

    renderDialog({ transaction: existingTx });

    expect(
      await screen.findByText("Este evento está cancelado — o lançamento entra no histórico (ex.: devolução)."),
    ).toBeInTheDocument();
    // Spec §9: the warning is a heads-up, never a submit block.
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
  });

  test("unlocked mode's Evento select includes a canceled event (suffixed '(cancelado)'), and selecting it still shows the aviso and allows submit", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    // Casamento Camila & Pedro — canceled, kept its 2 historical transactions
    // (see seed.ts). Before this fix, an UNSELECTED canceled event was
    // filtered out of the options entirely; now every event is offered, a
    // canceled one just carries the same "(cancelado)" suffix
    // `financeiro/index.tsx`'s own escopo-evento filter already uses.
    const CANCELED_EVENT_ID = "event-casamento-cancelado";
    const canceledEvent = crud("events").get(CANCELED_EVENT_ID)!;

    renderDialog({ onOpenChange });

    await user.click(screen.getByRole("combobox", { name: "Evento" }));
    const canceledOption = await screen.findByRole("option", { name: `${canceledEvent.name} (cancelado)` });
    await user.click(canceledOption);

    expect(
      await screen.findByText("Este evento está cancelado — o lançamento entra no histórico (ex.: devolução)."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Valor*"), "10000");
    await user.click(screen.getByRole("button", { name: "Registrar lançamento" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    const created = crud("transactions")
      .list()
      .find((tx) => tx.eventId === CANCELED_EVENT_ID && tx.amountCents === 10_000);
    expect(created).toBeDefined();
  });

  test("edit-submit flow: changing amount and description, then submitting, updates the transaction while preserving createdBy and createdAt", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    // Find an existing transaction to edit.
    const existingTx = crud("transactions").list().find((tx) => tx.eventId === SEEDED_EVENT_ID)!;
    const originalCreatedBy = existingTx.createdBy;
    const originalCreatedAt = existingTx.createdAt;

    // `defaultEventId` mirrors how `detalhe-lancamentos.tsx` actually opens
    // this dialog (`lockEvent` always paired with a real event id) — omitting
    // it here previously meant `onSubmit`'s `defaultEventId ?? null` sent a
    // `null` eventId on every edit, silently detaching the transaction from
    // its event.
    renderDialog({ transaction: existingTx, defaultEventId: SEEDED_EVENT_ID, lockEvent: true, onOpenChange });

    // Wait for the dialog to be ready — the categoria combobox should load the actual category name.
    const categoriaCombobox = screen.getByRole("combobox", { name: "Categoria*" });
    const categoryInStore = crud("transactionCategories").get(existingTx.categoryId)!;
    await waitFor(() => expect(categoriaCombobox).toHaveTextContent(categoryInStore.name));

    // Change the amount — clear the input and type a new value.
    const amountInput = screen.getByLabelText("Valor*") as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, "250000"); // R$2,500.00

    // Change the description.
    const descriptionField = screen.getByLabelText("Descrição") as HTMLTextAreaElement;
    await user.clear(descriptionField);
    await user.type(descriptionField, "Updated description");

    // Submit the form.
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    // Wait for the mutation to complete.
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    // Verify the transaction was updated in the store.
    const updatedTx = crud("transactions").get(existingTx.id)!;
    expect(updatedTx.amountCents).toBe(250_000);
    expect(updatedTx.description).toBe("Updated description");

    // Verify createdBy and createdAt are preserved (unchanged).
    expect(updatedTx.createdBy).toBe(originalCreatedBy);
    expect(updatedTx.createdAt).toBe(originalCreatedAt);

    // Verify eventId is preserved — a locked dialog must never detach the
    // transaction from its event just because the user only meant to edit
    // its amount/description.
    expect(updatedTx.eventId).toBe(SEEDED_EVENT_ID);
  });
});
