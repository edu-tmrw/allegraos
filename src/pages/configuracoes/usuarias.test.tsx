import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/data/auth";
import { crud, resetDB } from "@/data/store";
import { UsuariasTab } from "@/pages/configuracoes/usuarias-tab";

const SESSION_KEY = "allegra-session";

/**
 * `<AuthProvider>` (the tab reads `useAuth()` for the self-guard) wraps
 * `<UsuariasTab>` directly rather than the whole `<ConfiguracoesPage>` —
 * same reasoning as `servicos.test.tsx` testing `<ServicosTab>` in
 * isolation. `<Toaster/>` mirrors `main.tsx`'s real mount point so
 * `toast.error(...)` from the guards renders something assertable.
 */
function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UsuariasTab />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDB();
  // Logs in as Ana (seeded Admin) before every test, the way a real session would resolve on mount.
  localStorage.setItem(SESSION_KEY, "profile-ana");
});

describe("UsuariasTab", () => {
  test("lists Ana and Bia with their role names; creating Carla with papel Comercial adds a profile row", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByText("Ana Amaral");
    expect(screen.getByText("Bia Costa")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Papel de Ana Amaral" })).toHaveTextContent("Admin");
    expect(screen.getByRole("combobox", { name: "Papel de Bia Costa" })).toHaveTextContent("Comercial");

    await user.click(screen.getByRole("button", { name: "Adicionar usuária" }));
    await user.type(await screen.findByLabelText("Nome"), "Carla");

    await user.click(screen.getByLabelText("Papel"));
    await user.click(await screen.findByRole("option", { name: "Comercial" }));

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Carla")).toBeInTheDocument();

    // The store (not just the UI) gained a real profile row, with a minted userId.
    const created = crud("profiles").list().find((profile) => profile.name === "Carla");
    expect(created).toBeDefined();
    expect(created?.userId).toBeTruthy();
    expect(created?.roleId).toBe("role-comercial");
    expect(created?.active).toBe(true);
  });

  test("self-guard: Ana toggling her own active switch off is refused (toast, stays active)", async () => {
    const user = userEvent.setup();
    renderTab();

    const anaSwitch = await screen.findByRole("switch", { name: "Inativar Ana Amaral" });
    expect(anaSwitch).toHaveAttribute("aria-checked", "true");

    await user.click(anaSwitch);

    expect(await screen.findByText("Você não pode inativar a si mesma")).toBeInTheDocument();
    expect(anaSwitch).toHaveAttribute("aria-checked", "true");
    expect(crud("profiles").get("profile-ana")?.active).toBe(true);
  });

  test("role editor: toggling Comercial's manageCrm off persists; toggling Admin's manageSettings off is blocked (only settings-capable role)", async () => {
    const user = userEvent.setup();
    renderTab();

    const crmSwitch = await screen.findByRole("switch", { name: "CRM de Comercial" });
    expect(crmSwitch).toHaveAttribute("aria-checked", "true");

    await user.click(crmSwitch);

    await waitFor(() => expect(crud("roles").get("role-comercial")?.manageCrm).toBe(false));
    expect(crmSwitch).toHaveAttribute("aria-checked", "false");

    // Admin is the only active role with manageSettings among active profiles — turning it off must be refused.
    const settingsSwitch = screen.getByRole("switch", { name: "Configurações de Admin" });
    expect(settingsSwitch).toHaveAttribute("aria-checked", "true");

    await user.click(settingsSwitch);

    expect(await screen.findByText("Algum papel ativo precisa manter Configurações")).toBeInTheDocument();
    expect(settingsSwitch).toHaveAttribute("aria-checked", "true");
    expect(crud("roles").get("role-admin")?.manageSettings).toBe(true);
  });
});
