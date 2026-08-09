import { format, subMonths, parseISO } from "date-fns";
import { periodToRange } from "@/data/hooks/use-dashboard";
import { todayISO } from "@/lib/format";

/**
 * Pina o fix pós-F1: janelas FECHADAS nos dois extremos. A regressão que
 * isto guarda: 'year' sem `to` deixava um evento de um ano futuro contar
 * em "Este ano", e '12m' sem `to` incluía qualquer data futura.
 */
describe("periodToRange", () => {
  const today = todayISO();
  const year = today.slice(0, 4);

  test("'year' cobre exatamente o ano corrente, de 01/01 a 31/12", () => {
    expect(periodToRange("year")).toEqual({ from: `${year}-01-01`, to: `${year}-12-31` });
  });

  test("'year' exclui anos vizinhos pelos dois lados", () => {
    const range = periodToRange("year")!;
    const lastYearDec = `${Number(year) - 1}-12-31`;
    const nextYearJan = `${Number(year) + 1}-01-01`;
    expect(lastYearDec < range.from!).toBe(true);
    expect(nextYearJan > range.to!).toBe(true);
  });

  test("'12m' fecha em hoje — nada de datas futuras", () => {
    const expectedFrom = format(subMonths(parseISO(today), 12), "yyyy-MM-dd");
    expect(periodToRange("12m")).toEqual({ from: expectedFrom, to: today });
  });

  test("'all' não filtra", () => {
    expect(periodToRange("all")).toBeUndefined();
  });
});
