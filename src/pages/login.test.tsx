import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { LoginPage } from "@/pages/login";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/data/auth", () => ({
  defaultRouteFor: vi.fn(() => "/dashboard"),
  useAuth: () => ({
    user: null,
    isLoading: false,
    signInWithPassword: auth.signInWithPassword,
    requestPasswordReset: auth.requestPasswordReset,
    logout: auth.logout,
  }),
}));

beforeEach(() => {
  auth.signInWithPassword.mockReset().mockResolvedValue(undefined);
  auth.requestPasswordReset.mockReset().mockResolvedValue(undefined);
  auth.logout.mockReset().mockResolvedValue(undefined);
});

test("submits accessible email and password fields through Supabase Auth", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText("Email"), "ana@allegra.com.br");
  await user.type(screen.getByLabelText("Senha"), "segredo123");
  await user.click(screen.getByRole("button", { name: "Entrar" }));

  expect(auth.signInWithPassword).toHaveBeenCalledWith({
    email: "ana@allegra.com.br",
    password: "segredo123",
  });
});

test("renders authentication failures as a Portuguese alert", async () => {
  auth.signInWithPassword.mockRejectedValueOnce(new Error("Email ou senha inválidos."));
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText("Email"), "ana@allegra.com.br");
  await user.type(screen.getByLabelText("Senha"), "senha-errada");
  await user.click(screen.getByRole("button", { name: "Entrar" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Email ou senha inválidos.");
});

test("requests a recovery email and announces success", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText("Email"), "ana@allegra.com.br");
  await user.click(screen.getByRole("button", { name: "Esqueci minha senha" }));

  expect(auth.requestPasswordReset).toHaveBeenCalledWith("ana@allegra.com.br");
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Enviamos as instruções de recuperação para o seu email.",
  );
});
