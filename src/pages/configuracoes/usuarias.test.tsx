import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { UsuariasTab } from "@/pages/configuracoes/usuarias-tab";

const mocks = vi.hoisted(() => ({
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
}));

const profiles = [
  { userId: "user-admin", name: "Gabi Lauria", roleId: "role-admin", active: true },
  { userId: "user-commercial", name: "Bia Costa", roleId: "role-commercial", active: true },
];

const roles = [
  {
    id: "role-admin",
    name: "Admin",
    manageFinance: true,
    manageEvents: true,
    manageCrm: true,
    manageTeam: true,
    manageSettings: true,
  },
  {
    id: "role-commercial",
    name: "Comercial",
    manageFinance: false,
    manageEvents: false,
    manageCrm: true,
    manageTeam: false,
    manageSettings: false,
  },
];

vi.mock("@/data/auth", () => ({
  useAuth: () => ({ user: { profile: profiles[0], role: roles[0] } }),
}));

vi.mock("@/data/hooks/use-access", () => ({
  useProfiles: () => ({ data: profiles, isLoading: false }),
  useRoles: () => ({ data: roles, isLoading: false }),
  useCreateProfile: () => ({ mutate: mocks.createProfile, isPending: false }),
  useUpdateProfile: () => ({ mutate: mocks.updateProfile, isPending: false }),
  useCreateRole: () => ({ mutate: mocks.createRole, isPending: false }),
  useUpdateRole: () => ({ mutate: mocks.updateRole, isPending: false }),
}));

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UsuariasTab />
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
});

describe("UsuariasTab", () => {
  test("submits email, name and role to the invitation mutation", async () => {
    const user = userEvent.setup();
    renderTab();

    expect(await screen.findByText("Gabi Lauria")).toBeInTheDocument();
    expect(screen.getByText("Bia Costa")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Adicionar usuária" }));
    await user.type(await screen.findByLabelText("Email"), "carla@allegra.com.br");
    await user.type(screen.getByLabelText("Nome"), "Carla");
    await user.click(screen.getByLabelText("Papel"));
    await user.click(await screen.findByRole("option", { name: "Comercial" }));
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(mocks.createProfile).toHaveBeenCalledWith(
      {
        email: "carla@allegra.com.br",
        name: "Carla",
        roleId: "role-commercial",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  test("self-guard refuses to inactivate the signed-in profile", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole("switch", { name: "Inativar Gabi Lauria" }));

    expect(await screen.findByText("Você não pode inativar a si mesma")).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  test("updates ordinary role permissions and protects the last settings-capable role", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole("switch", { name: "CRM de Comercial" }));
    expect(mocks.updateRole).toHaveBeenCalledWith({
      id: "role-commercial",
      patch: { manageCrm: false },
    });

    mocks.updateRole.mockClear();
    await user.click(screen.getByRole("switch", { name: "Configurações de Admin" }));
    expect(await screen.findByText("Algum papel ativo precisa manter Configurações")).toBeInTheDocument();
    expect(mocks.updateRole).not.toHaveBeenCalled();
  });
});
