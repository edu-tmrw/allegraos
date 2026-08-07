import { describe, expect, test } from "vitest";
import {
  formatBRL,
  formatDate,
  formatMonthShort,
  formatTime,
  inputToCents,
  todayISO,
} from "@/lib/format";

describe("formatBRL", () => {
  test("formats whole reais with thousands separator", () => {
    // NBSP (U+00A0) between "R$" and the number is Intl's pt-BR default — a
    // plain space here would fail this assertion mysteriously.
    expect(formatBRL(150000)).toBe("R$ 1.500,00");
  });

  test("formats zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });

  test("formats single cents without losing the decimal place", () => {
    expect(formatBRL(1)).toBe("R$ 0,01");
  });

  test("formats values under one thousand", () => {
    expect(formatBRL(12345)).toBe("R$ 123,45");
  });
});

describe("inputToCents", () => {
  test("parses a pt-BR masked string into integer cents", () => {
    expect(inputToCents("1.234,56")).toBe(123456);
  });

  test("empty string is zero", () => {
    expect(inputToCents("")).toBe(0);
  });

  test("strips non-digit characters regardless of separators", () => {
    expect(inputToCents("R$ 1.500,00")).toBe(150000);
  });

  test("a bare digit run is treated as-is (last two digits are cents)", () => {
    expect(inputToCents("1500")).toBe(1500);
  });
});

describe("formatBRL / inputToCents roundtrip", () => {
  test.each([0, 1, 50, 999, 123456, 150000])(
    "roundtrips %i cents through formatBRL then inputToCents",
    (cents) => {
      const masked = formatBRL(cents).replace(/^\D+/, "");
      expect(inputToCents(masked)).toBe(cents);
    },
  );
});

describe("formatDate", () => {
  test("formats an ISO date as dd/mm/aaaa", () => {
    expect(formatDate("2026-08-07")).toBe("07/08/2026");
  });

  test("zero-pads single-digit day and month", () => {
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
  });
});

describe("formatMonthShort", () => {
  test("2026-08 -> ago/26", () => {
    expect(formatMonthShort("2026-08")).toBe("ago/26");
  });

  test("2025-01 -> jan/25", () => {
    expect(formatMonthShort("2025-01")).toBe("jan/25");
  });
});

describe("formatTime", () => {
  test("null renders an em dash", () => {
    expect(formatTime(null)).toBe("—");
  });

  test("HH:mm renders as HHhmm", () => {
    expect(formatTime("19:30")).toBe("19h30");
  });

  test("zero-padded minutes are preserved", () => {
    expect(formatTime("08:05")).toBe("08h05");
  });
});

describe("todayISO", () => {
  test("returns today's date in the local timezone as yyyy-MM-dd", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    expect(todayISO()).toBe(expected);
  });

  test("matches the yyyy-MM-dd shape", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
