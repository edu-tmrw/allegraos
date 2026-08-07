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
 */
export function CurrencyInput({
  valueCents,
  onChangeCents,
  placeholder,
}: {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  placeholder?: string;
}) {
  const display = valueCents === 0 ? "" : maskFormatter.format(valueCents / 100);

  return (
    <Input
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      onChange={(event) => onChangeCents(inputToCents(event.target.value))}
    />
  );
}
