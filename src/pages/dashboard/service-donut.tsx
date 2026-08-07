import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type PieLabelRenderProps,
  type TooltipContentProps,
} from "recharts";
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

/** Fixed slot order, assigned once by descending rank — never re-cycled. */
const SLICE_FILLS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
/**
 * Best-available ink (foreground vs. background) for text drawn *inside*
 * each fixed slot's own fill, picked once against the validated palette
 * (gold and "Outros" read better with dark ink; the rest with light ink).
 */
const SLICE_INKS = [
  "var(--foreground)",
  "var(--background)",
  "var(--background)",
  "var(--background)",
  "var(--background)",
];
const OTHER_FILL = "var(--chart-other)";
const OTHER_INK = "var(--foreground)";

function fillFor(slice: DonutSlice, index: number): string {
  return slice.id === OTHER_ID ? OTHER_FILL : SLICE_FILLS[index] ?? OTHER_FILL;
}

function inkFor(slice: DonutSlice, index: number): string {
  return slice.id === OTHER_ID ? OTHER_INK : SLICE_INKS[index] ?? OTHER_INK;
}

/** Direct % label, mid-ring, only for slices >= 8% — text color is picked for contrast against that slice's own fill, never the fill color itself. */
function makeSliceLabel(slices: DonutSlice[]) {
  return function SliceLabel(props: PieLabelRenderProps) {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, index } = props;
    if (percent == null || percent < 0.08 || midAngle == null || index == null) return null;
    const slice = slices[index];
    if (!slice) return null;

    const RAD = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + radius * Math.cos(-midAngle * RAD);
    const y = cy + radius * Math.sin(-midAngle * RAD);

    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill={inkFor(slice, index)}>
        {Math.round(percent * 100)}%
      </text>
    );
  };
}

function makeDonutTooltip(totalCents: number) {
  return function DonutTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const slice = payload[0]?.payload as DonutSlice | undefined;
    if (!slice) return null;
    const pct = totalCents > 0 ? Math.round((slice.totalCents / totalCents) * 100) : 0;
    return (
      <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
        <p className="font-medium text-foreground">{slice.name}</p>
        <p className="text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">{formatBRL(slice.totalCents)}</span> · {pct}%
        </p>
      </div>
    );
  };
}

/**
 * Contribuição por serviço: top-5 + "Outros", fixed hue slots, a total
 * overlaid on the donut hole, and a legend (name + %) that carries identity
 * through a swatch — never through colored text.
 */
export function ServiceDonut({ serviceSales }: { serviceSales: ServiceSaleRow[] }) {
  const slices = buildDonutData(serviceSales);
  const totalCents = slices.reduce((sum, slice) => sum + slice.totalCents, 0);

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
            >
              {slices.map((slice, index) => (
                <Cell key={slice.id} fill={fillFor(slice, index)} />
              ))}
            </Pie>
            <Tooltip content={makeDonutTooltip(totalCents)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-2xl text-foreground">{formatBRL(totalCents)}</span>
          <span className="text-xs text-muted-foreground">vendido</span>
        </div>
      </div>

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 md:flex-col md:items-start md:justify-center">
        {slices.map((slice, index) => {
          const pct = totalCents > 0 ? Math.round((slice.totalCents / totalCents) * 100) : 0;
          return (
            <li key={slice.id} className="flex items-center gap-2 text-sm">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: fillFor(slice, index) }} />
              <span className="text-foreground">{slice.name}</span>
              <span className="text-muted-foreground">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
