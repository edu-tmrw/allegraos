import { toUserMessage, type SupabaseErrorLike } from "./errors";

/** Unwraps a Supabase result while keeping database details out of user-facing errors. */
export function unwrap<T>(result: { data: T | null; error: SupabaseErrorLike | null }): T {
  if (result.error) {
    throw new Error(toUserMessage(result.error), { cause: result.error });
  }
  if (result.data === null) {
    throw new Error("O servidor não retornou os dados esperados.");
  }
  return result.data;
}

/** Variant for maybeSingle queries, where an absent row is a valid result. */
export function unwrapNullable<T>(result: { data: T | null; error: SupabaseErrorLike | null }): T | null {
  if (result.error) {
    throw new Error(toUserMessage(result.error), { cause: result.error });
  }
  return result.data;
}

/** Checks mutations/RPCs whose successful contract intentionally has no response body. */
export function ensureSuccess(result: { error: SupabaseErrorLike | null }): void {
  if (result.error) {
    throw new Error(toUserMessage(result.error), { cause: result.error });
  }
}
