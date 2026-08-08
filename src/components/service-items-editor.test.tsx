import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resetDB } from "@/data/store";
import { ServiceItemsEditor, type ServiceItemRow } from "@/components/service-items-editor";
import { formatBRL } from "@/lib/format";

/** Collapses any whitespace run (regular or non-breaking) to a single space, so a `formatBRL` string (which uses a NBSP between "R$" and the number) can be compared against `textContent` without tripping on which kind of space either side happens to use. */
function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function expectMoneyText(element: HTMLElement, cents: number): void {
  expect(normalizeSpace(element.textContent ?? "")).toBe(normalizeSpace(formatBRL(cents)));
}

/**
 * `ServiceItemsEditor` reads its own services/variants catalog via
 * `useServices`/`useServiceVariants` (data-aware by design, per the
 * component's own doc comment) — every test needs a `QueryClientProvider`
 * over the real seeded mock store, even though items/discount/mutations
 * themselves are plain props supplied by this harness, not the store.
 */
function renderEditor(overrides: {
  items?: ServiceItemRow[];
  onAdd?: (item: { serviceId: string; variantId: string | null; priceCents: number }) => void;
  onRemove?: (id: string) => void;
  discountCents?: number;
  onDiscountChange?: (cents: number) => void;
  readOnly?: boolean;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const props = {
    items: [] as ServiceItemRow[],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    discountCents: 0,
    onDiscountChange: vi.fn(),
    ...overrides,
  };

  const result = render(
    <QueryClientProvider client={queryClient}>
      <ServiceItemsEditor {...props} />
    </QueryClientProvider>,
  );

  return { ...result, ...props };
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("ServiceItemsEditor", () => {
  test("adding a variant service: choosing Trio prefills its price, and a manual edit afterward is what gets submitted", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Adicionar serviço" }));

    await user.click(screen.getByRole("combobox", { name: "Serviço*" }));
    await user.click(await screen.findByRole("option", { name: "Orquestra" }));

    // Orquestra is variant-priced (Service.defaultPriceCents is null) — the
    // variant select only appears once a service with active variants is
    // chosen.
    await user.click(await screen.findByRole("combobox", { name: "Variação*" }));
    await user.click(await screen.findByRole("option", { name: "Trio" }));

    const priceInput = screen.getByLabelText("Valor*");
    expect(priceInput).toHaveValue("3.500,00");

    await user.clear(priceInput);
    await user.type(priceInput, "300000");

    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(onAdd).toHaveBeenCalledWith({
      serviceId: "svc-orquestra",
      variantId: "variant-orquestra-trio",
      priceCents: 300_000,
    });
  });

  test("validation: a variant service blocks submit without a variant, and a zeroed price blocks with a message", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Adicionar serviço" }));

    await user.click(screen.getByRole("combobox", { name: "Serviço*" }));
    await user.click(await screen.findByRole("option", { name: "Orquestra" }));

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(await screen.findByText("Selecione a variação.")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();

    // Switch to a service with no variants (its price auto-prefills), then
    // zero it back out by hand.
    await user.click(screen.getByRole("combobox", { name: "Serviço*" }));
    await user.click(await screen.findByRole("option", { name: "Foto Polaroid" }));

    const priceInput = screen.getByLabelText("Valor*");
    expect(priceInput).toHaveValue("1.200,00");
    await user.clear(priceInput);

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(await screen.findByText("Informe um valor maior que zero.")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("summary math: Valor do contrato is Σ itens − desconto, clamped at 0", () => {
    const items: ServiceItemRow[] = [
      { id: "item-1", serviceId: "svc-foto-polaroid", variantId: null, priceCents: 120_000 },
      { id: "item-2", serviceId: "svc-aluguel-som", variantId: null, priceCents: 150_000 },
    ];
    // Σ = 270_000.

    const first = renderEditor({ items, discountCents: 70_000 });
    expectMoneyText(screen.getByTestId("valor-do-contrato"), 200_000);
    first.unmount();

    renderEditor({ items, discountCents: 400_000 });
    expectMoneyText(screen.getByTestId("valor-do-contrato"), 0);
  });

  test("stale error messages: variant and price errors clear reactively when variant is selected", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Adicionar serviço" }));

    // Select Orquestra (variant-priced service, no default price)
    await user.click(screen.getByRole("combobox", { name: "Serviço*" }));
    await user.click(await screen.findByRole("option", { name: "Orquestra" }));

    // Submit without selecting a variant — both errors appear
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(await screen.findByText("Selecione a variação.")).toBeInTheDocument();
    expect(screen.getByText("Informe um valor maior que zero.")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();

    // Select a variant — both errors should clear (variant chosen + price prefilled and valid)
    await user.click(screen.getByRole("combobox", { name: "Variação*" }));
    await user.click(await screen.findByRole("option", { name: "Trio" }));

    // Both error messages should be gone
    expect(screen.queryByText("Selecione a variação.")).not.toBeInTheDocument();
    expect(screen.queryByText("Informe um valor maior que zero.")).not.toBeInTheDocument();
  });
});
