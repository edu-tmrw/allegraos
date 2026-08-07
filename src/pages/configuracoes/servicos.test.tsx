import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { resetDB } from "@/data/store";
import { ServicosTab } from "@/pages/configuracoes/servicos-tab";

/**
 * `<Toaster/>` alongside the tab mirrors `main.tsx`'s real mount point, same
 * as `configuracoes.test.tsx` — kept here even though no test currently
 * asserts on a toast, so a future one doesn't have to remember to add it.
 */
function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ServicosTab />
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("ServicosTab", () => {
  test("lists the 8 seeded services; Orquestra shows 'por variação' and expands to its 3 priced variants", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByText("Orquestra");
    expect(screen.getAllByRole("group")).toHaveLength(8);

    const orquestraRow = screen.getByRole("group", { name: "Orquestra" });
    expect(within(orquestraRow).getByText("por variação")).toBeInTheDocument();

    await user.click(within(orquestraRow).getByRole("button", { name: "Expandir Orquestra" }));

    expect(within(orquestraRow).getByText("Trio")).toBeInTheDocument();
    expect(within(orquestraRow).getByText("R$ 3.500,00")).toBeInTheDocument();
    expect(within(orquestraRow).getByText("Quarteto")).toBeInTheDocument();
    expect(within(orquestraRow).getByText("R$ 4.500,00")).toBeInTheDocument();
    expect(within(orquestraRow).getByText("Sexteto")).toBeInTheDocument();
    expect(within(orquestraRow).getByText("R$ 6.500,00")).toBeInTheDocument();
  });

  test("creating a service with an empty price shows '—' (persists null)", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Orquestra");

    await user.click(screen.getByRole("button", { name: "Adicionar serviço" }));
    await user.type(await screen.findByLabelText("Nome"), "Cabine de Fotos 360");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const row = await screen.findByRole("group", { name: "Cabine de Fotos 360" });
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  test("adding a variant to a priced service flips its price column to 'por variação'", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Foto Polaroid");

    const row = screen.getByRole("group", { name: "Foto Polaroid" });
    expect(within(row).getByText("R$ 1.200,00")).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Expandir Foto Polaroid" }));
    await user.click(within(row).getByRole("button", { name: "Adicionar variação" }));
    await user.type(await screen.findByLabelText("Nome"), "Instantânea");
    await user.type(screen.getByLabelText("Preço"), "50000");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(within(row).getByText("por variação")).toBeInTheDocument();
    expect(within(row).queryByText("R$ 1.200,00")).not.toBeInTheDocument();
  });
});
