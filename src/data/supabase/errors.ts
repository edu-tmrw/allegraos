export interface SupabaseErrorLike {
  code?: string;
  message: string;
}

const MESSAGES_BY_CODE: Readonly<Record<string, string>> = {
  "23505": "Já existe um registro com esses dados.",
  "23514": "Os dados informados não são válidos.",
  "22023": "Os dados informados não são válidos.",
  "42501": "Você não tem permissão para esta ação.",
  P0002: "Registro não encontrado.",
  PGRST116: "Registro não encontrado.",
  PGRST200: "Não foi possível carregar os dados relacionados.",
  PGRST201: "Não foi possível carregar os dados relacionados.",
};

const SAFE_FALLBACK = "Não foi possível concluir a ação. Tente novamente.";

/** Returns a stable user-facing message without exposing SQL or internal details. */
export function toUserMessage(error: SupabaseErrorLike): string {
  if (error.code) {
    const knownMessage = MESSAGES_BY_CODE[error.code];
    if (knownMessage) return knownMessage;
  }

  console.error("Erro inesperado do Supabase.", error);
  return SAFE_FALLBACK;
}
