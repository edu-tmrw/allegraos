import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";

/**
 * Displays a BRL amount (integer cents). `kind` controls sign + color only —
 * domain code always passes non-negative cents; `<Money>` is the single
 * place that decides how a value's direction is presented.
 *
 * - "in"  -> "+" prefix, text-positive
 * - "out" -> "−" (minus sign, not a hyphen) prefix, text-negative
 * - null/undefined -> no prefix, neutral color
 */
export function Money({
  cents,
  kind,
  className,
}: {
  cents: number;
  kind?: "in" | "out" | null;
  className?: string;
}) {
  const prefix = kind === "in" ? "+" : kind === "out" ? "−" : "";

  return (
    <span
      data-slot="money"
      className={cn(
        // font-sans de propósito: números nunca herdam a serif estilizada
        // (algarismos old-style da Cormorant são ruins de ler em valores) —
        // regra tipográfica do sistema, válida mesmo dentro de headings.
        "font-sans font-semibold tabular-nums",
        kind === "in" && "text-positive",
        kind === "out" && "text-negative",
        className,
      )}
    >
      {prefix}
      {formatBRL(cents)}
    </span>
  );
}
