import { Input } from "@/components/ui/input";
import { inputToCents } from "@/lib/format";

// Decimal-only pt-BR mask (no currency symbol) — the "R$" affordance, if
// any, is the caller's concern (e.g. a label or an input adornment); this
// field only ever edits the numeric mask itself.
const maskFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Controlled BRL amount input. The user types raw digits; every keystroke
 * is re-parsed as an integer-cents value (last two digits are always the
 * decimal part), so typing "1500" displays "15,00" and "150000" displays
 * "1.500,00". A value of 0 renders as an empty field so `placeholder` can
 * show through.
 *
 * `id` is optional passthrough (needed to pair with a `<Label htmlFor>` —
 * Task 14's `ServiceItemsEditor` is the first real consumer) — flagged back
 * in Task 2's review as a gap to close "quando T15/T16 precisar"; extending
 * it incrementally here rather than adding `disabled`/`aria-*` speculatively
 * before any caller actually needs them.
 */
export function CurrencyInput({
  valueCents,
  onChangeCents,
  placeholder,
  id,
}: {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  placeholder?: string;
  id?: string;
}) {
  const display = valueCents === 0 ? "" : maskFormatter.format(valueCents / 100);

  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      onChange={(event) => onChangeCents(inputToCents(event.target.value))}
    />
  );
}
