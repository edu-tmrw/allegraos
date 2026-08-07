import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Formats integer cents as a pt-BR BRL string, e.g. 150000 -> "R$ 1.500,00".
 *
 * Note: Intl separates "R$" from the number with a NON-BREAKING SPACE
 * (U+00A0), not a regular space. Domain code always passes cents >= 0;
 * <Money> owns sign presentation, so negative input just follows Intl's
 * default ("-R$ ...").
 */
export function formatBRL(cents: number): string {
  return brlFormatter.format(cents / 100);
}

/**
 * Parses a masked pt-BR money string (as typed into <CurrencyInput>) into
 * integer cents by stripping every non-digit character and reading the
 * remaining digit run directly as cents. Empty/no-digit input is 0.
 */
export function inputToCents(masked: string): number {
  const digits = masked.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/** Formats an ISO date (yyyy-MM-dd) as dd/mm/aaaa. */
export function formatDate(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy");
}

/** Formats "HH:mm" as "HHhMM"; null (no scheduled time) renders as "—". */
export function formatTime(t: string | null): string {
  if (t === null) return "—";
  return t.replace(":", "h");
}

/** Formats an ISO month (yyyy-MM) as an abbreviated pt-BR month + 2-digit year, e.g. "2026-08" -> "ago/26". */
export function formatMonthShort(isoMonth: string): string {
  const [year, month] = isoMonth.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMM/yy", { locale: ptBR });
}

/** Today's date in the local timezone as yyyy-MM-dd. */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}
