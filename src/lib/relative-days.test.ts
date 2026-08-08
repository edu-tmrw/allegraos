import { describe, expect, test } from "vitest";
import { daysUntilLabel, daysUntilLabelOrToday } from "@/lib/relative-days";

const TODAY = "2026-08-07";

describe("daysUntilLabel", () => {
  test("today (0) is suppressed", () => {
    expect(daysUntilLabel(TODAY, TODAY)).toBeNull();
  });

  test("the past is suppressed", () => {
    expect(daysUntilLabel("2026-08-01", TODAY)).toBeNull();
  });

  test("singular: 1 day out reads 'em 1 dia'", () => {
    expect(daysUntilLabel("2026-08-08", TODAY)).toBe("em 1 dia");
  });

  test("plural: 5 days out reads 'em 5 dias'", () => {
    expect(daysUntilLabel("2026-08-12", TODAY)).toBe("em 5 dias");
  });
});

describe("daysUntilLabelOrToday", () => {
  test("today (0) reads 'hoje'", () => {
    expect(daysUntilLabelOrToday(TODAY, TODAY)).toBe("hoje");
  });

  test("singular: 1 day out reads 'em 1 dia'", () => {
    expect(daysUntilLabelOrToday("2026-08-08", TODAY)).toBe("em 1 dia");
  });

  test("plural: 5 days out reads 'em 5 dias'", () => {
    expect(daysUntilLabelOrToday("2026-08-12", TODAY)).toBe("em 5 dias");
  });

  test("the past falls back to the empty string (unreachable in practice — upcoming events are never dated in the past)", () => {
    expect(daysUntilLabelOrToday("2026-08-01", TODAY)).toBe("");
  });
});
