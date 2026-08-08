import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * One of the dashboard's 4 top-row tiles: a muted label over a big serif
 * value. Deliberately dumb about the value itself — callers decide what
 * goes inside (usually a `<Money>`), including any color rule (e.g. "lucro
 * do mês" turning red when negative) — so this component only owns layout.
 */
export function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="gap-2 overflow-hidden py-5">
      <CardContent className="space-y-1 px-3 sm:px-5">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        {/* text-3xl per spec from sm: up; the 2x2 mobile grid is too narrow at
            text-3xl for a 6-figure BRL value, so it steps down one size below
            that breakpoint rather than overflow the card. The grid itself
            (dashboard/index.tsx) also delays 4-across to `xl:` so the 2-col
            layout gets real room on tablet/laptop widths; `truncate` is only
            the last-resort safety net for whatever's still too tight (e.g. a
            7-figure value at the very smallest 2-col width). */}
        <div className="truncate font-serif text-2xl sm:text-3xl">{children}</div>
      </CardContent>
    </Card>
  );
}
