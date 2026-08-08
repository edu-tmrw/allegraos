import { beforeEach, describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { resetDB } from "@/data/store";
import { ConfiguracoesPage } from "@/pages/configuracoes";

/**
 * `<Toaster/>` is included alongside the page (mirrors `main.tsx`'s real
 * mount point) so `toast.error(...)` from the etapas guard actually renders
 * something assertable — the app never calls `toast` without a mounted
 * `<Toaster/>` in the tree.
 */
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConfiguracoesPage />
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("ConfiguracoesPage", () => {
  test("lists the seeded event types on the default tab", async () => {
    renderPage();

    expect(await screen.findByText("Casamento")).toBeInTheDocument();
    expect(screen.getByText("15 Anos")).toBeInTheDocument();
    expect(screen.getByText("Corporativo")).toBeInTheDocument();
  });

  test("creating an event type via the dialog adds it to the list", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Casamento"); // aguarda a query inicial antes de interagir

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.type(await screen.findByLabelText("Nome"), "Bodas de Prata");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Bodas de Prata")).toBeInTheDocument();
  });

  test("switching off a stage that still holds a lead is refused (guard toast, stage stays active)", async () => {
    const user = userEvent.setup();
    renderPage();

    // O painel de Etapas só monta quando a aba fica ativa (Radix desmonta as inativas).
    await user.click(screen.getByRole("tab", { name: "Etapas do funil" }));

    // Seed: "contact-fernanda" está em stage-novo-contato e não está arquivado.
    const stageSwitch = await screen.findByRole("switch", { name: "Inativar Novo contato" });
    expect(stageSwitch).toHaveAttribute("aria-checked", "true");

    await user.click(stageSwitch);

    expect(
      await screen.findByText("Mova os leads desta etapa antes de inativá-la"),
    ).toBeInTheDocument();
    expect(stageSwitch).toHaveAttribute("aria-checked", "true");
  });
});
