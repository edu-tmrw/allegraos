import { describe, expect, test, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrencyInput } from "@/components/currency-input";

/**
 * CurrencyInput is a controlled component (valueCents/onChangeCents owned
 * by the parent) — this harness stands in for that parent so user-event can
 * drive real typing through a real controlled round-trip.
 */
function ControlledHarness({
  initialCents = 0,
  onChangeCents,
  placeholder,
}: {
  initialCents?: number;
  onChangeCents?: (cents: number) => void;
  placeholder?: string;
}) {
  const [cents, setCents] = useState(initialCents);
  return (
    <CurrencyInput
      valueCents={cents}
      onChangeCents={(next) => {
        setCents(next);
        onChangeCents?.(next);
      }}
      placeholder={placeholder}
    />
  );
}

describe("CurrencyInput", () => {
  test("typing '1500' masks to 15,00", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness />);
    const input = screen.getByRole("textbox");
    await user.type(input, "1500");
    expect(input).toHaveValue("15,00");
  });

  test("typing '150000' masks to 1.500,00", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness />);
    const input = screen.getByRole("textbox");
    await user.type(input, "150000");
    expect(input).toHaveValue("1.500,00");
  });

  test("reports the parsed integer cents through onChangeCents", async () => {
    const user = userEvent.setup();
    const onChangeCents = vi.fn();
    render(<ControlledHarness onChangeCents={onChangeCents} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "15");
    expect(onChangeCents).toHaveBeenLastCalledWith(15);
  });

  test("shows the placeholder while the value is zero", () => {
    render(<ControlledHarness placeholder="0,00" />);
    expect(screen.getByPlaceholderText("0,00")).toBeInTheDocument();
  });

  test("pre-fills an existing value as a pt-BR mask with no currency symbol", () => {
    render(<ControlledHarness initialCents={150000} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("1.500,00");
  });

  test("clearing the field back to empty reports zero cents", async () => {
    const user = userEvent.setup();
    const onChangeCents = vi.fn();
    render(
      <ControlledHarness initialCents={1500} onChangeCents={onChangeCents} />,
    );
    const input = screen.getByRole("textbox");
    await user.clear(input);
    expect(onChangeCents).toHaveBeenLastCalledWith(0);
    expect(input).toHaveValue("");
  });
});
