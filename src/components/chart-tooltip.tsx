import type { ReactNode } from "react";

/**
 * Moldura padrão dos tooltips de gráfico (linha, donut e barras usam a
 * mesma). shadow-sm de propósito: o teto de sombras do design é sm.
 */
export function ChartTooltipFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      {children}
    </div>
  );
}
