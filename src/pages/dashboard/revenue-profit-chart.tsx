import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { ChartTooltipFrame } from "@/components/chart-tooltip";
import { formatBRL, formatMonthShort } from "@/lib/format";

interface FlowPoint {
  month: string;
  revenueCents: number;
  expensesCents: number;
  profitCents: number;
}

const compactBRL = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  style: "currency",
  currency: "BRL",
});

/** cents -> compact BRL for the y-axis ticks, e.g. 1_250_000 -> "R$ 12,5 mil". */
function formatCompactBRL(cents: number): string {
  return compactBRL.format(cents / 100);
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

/**
 * Direct end-labels for both series, positioned from the chart's *real*
 * pixel scales (`useXAxisScale`/`useYAxisScale` — Recharts v3 renders
 * arbitrary children directly inside a chart and exposes its computed
 * scales via hooks; a plain `<Line label={...}>` custom element turned out
 * not to reliably reach the DOM in this version, so the labels are drawn
 * here instead, as a sibling that reads the same scale the lines themselves
 * are plotted with). `dy` separates the two series' labels vertically so
 * they don't collide when faturamento and lucro end close together.
 */
function FlowEndLabels({ data }: { data: FlowPoint[] }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const lastPoint = data[data.length - 1];
  if (!xScale || !yScale || !lastPoint) return null;

  const x = xScale(lastPoint.month);
  const yRevenue = yScale(lastPoint.revenueCents);
  const yProfit = yScale(lastPoint.profitCents);
  if (x == null || yRevenue == null || yProfit == null) return null;

  return (
    <g aria-hidden="true">
      <text x={x} y={yRevenue} dx={8} dy={-8} textAnchor="start" fontSize={12} fill="var(--foreground)">
        Faturamento
      </text>
      <text x={x} y={yProfit} dx={8} dy={16} textAnchor="start" fontSize={12} fill="var(--foreground)">
        Lucro
      </text>
    </g>
  );
}

/** Line keys (a short stroke, not a filled box) + full BRL values, one row per series. */
function FlowTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipFrame>
      <p className="mb-1 font-medium text-foreground">{formatMonthShort(String(label ?? ""))}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <p key={index} className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-3 shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium tabular-nums text-foreground">{formatBRL(toNumber(entry.value))}</span>
          </p>
        ))}
      </div>
    </ChartTooltipFrame>
  );
}

/**
 * Faturamento × Lucro over the last 12 months. One shared y-axis (never a
 * dual axis) — both series are BRL, so they read on the same scale. Colors
 * come only from `--chart-1`/`--chart-2`; identity also lives in the top
 * legend and the direct end-labels, never in text color.
 */
export function RevenueProfitChart({ data }: { data: FlowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 24, right: 84, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(value: string) => formatMonthShort(value)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => formatCompactBRL(value)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          // Wide enough for the longest realistic tick, "-R$ 3,5 mil" (a
          // loss month) — 56 clipped its leading "-R$" once a monthly value
          // actually went negative.
          width={76}
        />
        <Tooltip content={FlowTooltip} />
        <Legend
          verticalAlign="top"
          height={32}
          iconType="plainline"
          labelStyle={{ color: "var(--muted-foreground)" }}
        />
        <Line
          type="monotone"
          dataKey="revenueCents"
          name="Faturamento"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="profitCents"
          name="Lucro"
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
          isAnimationActive={false}
        />
        <FlowEndLabels data={data} />
      </LineChart>
    </ResponsiveContainer>
  );
}
