import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import { Money } from "@/components/money";

function moneyEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-slot="money"]');
  if (!el) throw new Error('expected an element with [data-slot="money"]');
  return el;
}

describe("Money", () => {
  test("kind='in' renders a + prefix and text-positive", () => {
    const { container } = render(<Money cents={150000} kind="in" />);
    const el = moneyEl(container);
    // Raw textContent check (not jest-dom's whitespace-normalizing
    // toHaveTextContent) so the NBSP (U+00A0) Intl inserts after "R$" is
    // actually verified, not silently collapsed to a plain space.
    expect(el.textContent).toBe("+R$ 1.500,00");
    expect(el).toHaveClass("text-positive");
    expect(el).not.toHaveClass("text-negative");
  });

  test("kind='out' renders a U+2212 minus sign and text-negative", () => {
    const { container } = render(<Money cents={150000} kind="out" />);
    const el = moneyEl(container);
    expect(el.textContent).toBe("−R$ 1.500,00");
    expect(el).toHaveClass("text-negative");
    expect(el).not.toHaveClass("text-positive");
  });

  test("no kind renders a plain neutral value", () => {
    const { container } = render(<Money cents={150000} />);
    const el = moneyEl(container);
    expect(el.textContent).toBe("R$ 1.500,00");
    expect(el).not.toHaveClass("text-positive");
    expect(el).not.toHaveClass("text-negative");
  });

  test("kind=null behaves the same as an omitted kind", () => {
    const { container } = render(<Money cents={150000} kind={null} />);
    const el = moneyEl(container);
    expect(el.textContent).toBe("R$ 1.500,00");
    expect(el).not.toHaveClass("text-positive");
    expect(el).not.toHaveClass("text-negative");
  });

  test("is semibold with tabular numerals regardless of kind", () => {
    const { container } = render(<Money cents={150000} kind="in" />);
    const el = moneyEl(container);
    expect(el).toHaveClass("font-semibold");
    expect(el).toHaveClass("tabular-nums");
  });

  test("merges an extra className", () => {
    const { container } = render(<Money cents={150000} className="text-lg" />);
    const el = moneyEl(container);
    expect(el).toHaveClass("text-lg");
  });
});
