import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loadDB, resetDB } from "@/data/store";
import { EquipePage } from "@/pages/equipe";

function renderEquipe() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EquipePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
});

describe("EquipePage", () => {
  test("renders the 3 seeded members with roleLabel", async () => {
    renderEquipe();

    // Scoped to the desktop <table> — the mobile card list renders the same
    // rows in parallel (hidden only via a CSS media query, which jsdom/happy-dom
    // doesn't evaluate), so unscoped queries would see every name/role twice.
    const table = await screen.findByRole("table");

    expect(within(table).getByText("Bia Costa")).toBeInTheDocument();
    expect(within(table).getByText("Comercial")).toBeInTheDocument();
    expect(within(table).getByText("Carla Mendes")).toBeInTheDocument();
    expect(within(table).getByText("Social media")).toBeInTheDocument();
    expect(within(table).getByText("Dudu Alves")).toBeInTheDocument();
    expect(within(table).getByText("Freelancer cerimonial")).toBeInTheDocument();
  });

  test("create dialog adds a member (store gains it, row appears)", async () => {
    const user = userEvent.setup();
    renderEquipe();
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Adicionar pessoa" }));

    await user.type(screen.getByLabelText("Nome *"), "Fernanda Rocha");
    await user.type(screen.getByLabelText("Função *"), "Cerimonialista");
    await user.type(screen.getByLabelText("Forma de pagamento"), "R$ 200 por evento");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    const table = await screen.findByRole("table");
    await waitFor(() => expect(within(table).getByText("Fernanda Rocha")).toBeInTheDocument());
    expect(within(table).getByText("Cerimonialista")).toBeInTheDocument();
    expect(within(table).getByText("R$ 200 por evento")).toBeInTheDocument();

    // The dialog closes and the store itself (not just the rendered row) gained the row.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(loadDB().teamMembers.some((m) => m.name === "Fernanda Rocha" && m.active)).toBe(true);
  });

  test("toggling Ativa off keeps the row listed but muted/switch unchecked", async () => {
    const user = userEvent.setup();
    renderEquipe();

    const table = await screen.findByRole("table");
    const toggle = within(table).getByRole("switch", { name: "Ativa: Bia Costa" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await user.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));

    // Still listed, never removed...
    const nameCell = within(table).getByText("Bia Costa");
    expect(nameCell).toBeInTheDocument();
    // ...but the whole row is now muted (name/função inherit this — only
    // telefone/pagamento carry their own always-muted color independently).
    expect(nameCell.closest("tr")).toHaveClass("text-muted-foreground");

    expect(loadDB().teamMembers.find((m) => m.name === "Bia Costa")?.active).toBe(false);
  });
});
