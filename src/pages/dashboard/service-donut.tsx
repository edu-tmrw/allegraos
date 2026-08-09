import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, type PieLabelRenderProps } from "recharts";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";

export interface ServiceSaleRow {
  serviceId: string;
  name: string;
  totalCents: number;
}

export interface DonutSlice {
  id: string;
  name: string;
  totalCents: number;
}

const TOP_N = 5;
const OTHER_ID = "outros";
const OTHER_NAME = "Outros";

/**
 * Top-5 service sales as individual slices, in the order given (callers —
 * `groupSalesByService` — already sort by total descending; this never
 * re-sorts), with the remainder folded into a single "Outros" slice. Pure
 * and exported on its own so the top5+"Outros" aggregation is unit-testable
 * without rendering a chart.
 */
export function buildDonutData(serviceSales: ServiceSaleRow[]): DonutSlice[] {
  const top = serviceSales
    .slice(0, TOP_N)
    .map((row) => ({ id: row.serviceId, name: row.name, totalCents: row.totalCents }));

  if (serviceSales.length <= TOP_N) return top;

  const othersTotal = serviceSales.slice(TOP_N).reduce((sum, row) => sum + row.totalCents, 0);
  return [...top, { id: OTHER_ID, name: OTHER_NAME, totalCents: othersTotal }];
}

/**
 * Monochrome ordinal ramp (decisão pós-F1): rank 1 = biggest slice = deepest
 * bronze, lightening down the rank — fixed by rank, never re-cycled. The
 * ramp is validated (`--ordinal`: monotone lightness, visible step gaps,
 * light end ≥2:1 vs surface); "Outros" stays the neutral gray.
 */
const SLICE_FILLS = [
  "var(--chart-gold-1)",
  "var(--chart-gold-2)",
  "var(--chart-gold-3)",
  "var(--chart-gold-4)",
  "var(--chart-gold-5)",
];
const OTHER_FILL = "var(--chart-other)";

function fillFor(slice: DonutSlice, index: number): string {
  return slice.id === OTHER_ID ? OTHER_FILL : SLICE_FILLS[index] ?? OTHER_FILL;
}

/** Direct % label, mid-ring, only for slices >= 8% — always white by design (decisão pós-F1: um único ink nas fatias; a legenda ao lado repete o dado com contraste pleno). */
function makeSliceLabel(slices: DonutSlice[]) {
  return function SliceLabel(props: PieLabelRenderProps) {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, index } = props;
    if (percent == null || percent < 0.08 || midAngle == null || index == null) return null;
    if (!slices[index]) return null;

    const RAD = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + radius * Math.cos(-midAngle * RAD);
    const y = cy + radius * Math.sin(-midAngle * RAD);

    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="#ffffff">
        {Math.round(percent * 100)}%
      </text>
    );
  };
}

/**
 * Contribuição por serviço: top-5 + "Outros", fixed hue slots, legend with
 * a swatch per row. Interaction (decisão pós-F1, no Recharts Tooltip):
 * hovering a slice highlights its legend row and vice-versa — the
 * non-focused slices/rows dim, and the donut hole swaps from the period
 * total to the focused service's name + BRL + share.
 */
export function ServiceDonut({ serviceSales }: { serviceSales: ServiceSaleRow[] }) {
  const slices = buildDonutData(serviceSales);
  const totalCents = slices.reduce((sum, slice) => sum + slice.totalCents, 0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hovered = slices.find((slice) => slice.id === hoveredId) ?? null;
  const hoveredPct =
    hovered && totalCents > 0 ? Math.round((hovered.totalCents / totalCents) * 100) : 0;

  if (slices.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sem vendas no período.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:justify-center">
      <div className="relative size-[260px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="totalCents"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="85%"
              stroke="var(--background)"
              strokeWidth={2}
              label={makeSliceLabel(slices)}
              labelLine={false}
              isAnimationActive={false}
              onMouseEnter={(_, index) => setHoveredId(slices[index]?.id ?? null)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {slices.map((slice, index) => (
                <Cell
                  key={slice.id}
                  fill={fillFor(slice, index)}
                  fillOpacity={hoveredId !== null && hoveredId !== slice.id ? 0.35 : 1}
                  style={{ transition: "fill-opacity 150ms ease" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          {hovered ? (
            <>
              <span className="w-full truncate text-xs text-muted-foreground" title={hovered.name}>
                {hovered.name}
              </span>
              <span className="font-sans text-lg font-semibold tabular-nums text-foreground">
                {formatBRL(hovered.totalCents)}
              </span>
              <span className="text-xs text-muted-foreground">{hoveredPct}% do período</span>
            </>
          ) : (
            <>
              <span className="font-sans text-lg font-semibold tabular-nums text-foreground">
                {formatBRL(totalCents)}
              </span>
              <span className="text-xs text-muted-foreground">vendido</span>
            </>
          )}
        </div>
      </div>

      {/* `min-w-0 md:flex-1` gives this block a definite, shrinkable width
          once it shares the row with the fixed 260px donut (rather than the
          shrink-to-fit default that let a long service name push past the
          card's edge) — the actual ellipsis then happens per-item below. */}
      <ul className="flex min-w-0 flex-wrap justify-center gap-x-4 gap-y-1 md:flex-1 md:flex-col md:items-stretch md:justify-center">
        {slices.map((slice, index) => {
          const pct = totalCents > 0 ? Math.round((slice.totalCents / totalCents) * 100) : 0;
          return (
            <li
              key={slice.id}
              onMouseEnter={() => setHoveredId(slice.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                "-mx-2 flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm transition-[background-color,opacity] duration-150",
                hoveredId === slice.id && "bg-muted",
                hoveredId !== null && hoveredId !== slice.id && "opacity-50",
              )}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: fillFor(slice, index) }} />
              <span className="min-w-0 flex-1 truncate text-foreground" title={slice.name}>
                {slice.name}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
