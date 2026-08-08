import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatBRL } from "@/lib/format";

export interface CategoryExpenseRow {
  categoryId: string;
  name: string;
  totalCents: number;
}

const TOP_N = 8;
const ROW_HEIGHT = 34;
const MIN_HEIGHT = 160;

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function truncate(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** Category name tick — identity for this chart lives here, not in bar color, so it stays legible (truncated defensively; the full name is still in the tooltip). */
function CategoryTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (x == null || y == null || !payload) return null;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">
      {truncate(payload.value, 20)}
    </text>
  );
}

function CategoryTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as CategoryExpenseRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{row.name}</p>
      <p className="font-medium tabular-nums text-foreground">{formatBRL(row.totalCents)}</p>
    </div>
  );
}

/**
 * Saídas por categoria: horizontal bars, one uniform gold fill — the
 * category names on the y-axis carry identity, not color. Top 8 by total;
 * values are direct-labeled at each bar's end so the x-axis stays hidden.
 */
export function CategoryBars({ categoryExpenses }: { categoryExpenses: CategoryExpenseRow[] }) {
  const rows = categoryExpenses.slice(0, TOP_N);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sem saídas no período.</p>;
  }

  const height = Math.max(MIN_HEIGHT, rows.length * ROW_HEIGHT);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 72, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={124}
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={<CategoryTick />}
        />
        <Tooltip content={CategoryTooltip} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="totalCents" fill="var(--chart-1)" barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="totalCents"
            position="right"
            formatter={(value) => formatBRL(toNumber(value))}
            fill="var(--foreground)"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
