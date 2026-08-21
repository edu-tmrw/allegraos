import { afterEach, expect, test, vi } from "vitest";
import { toUserMessage } from "./errors";

afterEach(() => {
  vi.restoreAllMocks();
});

test.each([
  ["23505", "Já existe um registro com esses dados."],
  ["23514", "Os dados informados não são válidos."],
  ["22023", "Os dados informados não são válidos."],
  ["42501", "Você não tem permissão para esta ação."],
  ["P0002", "Registro não encontrado."],
  ["PGRST200", "Não foi possível carregar os dados relacionados."],
  ["PGRST201", "Não foi possível carregar os dados relacionados."],
  ["PGRST116", "Registro não encontrado."],
])("maps database error %s to a stable Portuguese message", (code, expected) => {
  expect(toUserMessage({ code, message: "sensitive database detail" })).toBe(expected);
});

test("returns a safe fallback and keeps an unexpected error diagnosable", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const error = { code: "XX999", message: 'relation "private.payroll" does not exist' };

  expect(toUserMessage(error)).toBe("Não foi possível concluir a ação. Tente novamente.");
  expect(consoleError).toHaveBeenCalledWith("Erro inesperado do Supabase.", error);
});
