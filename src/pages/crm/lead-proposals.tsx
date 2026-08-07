import { Card } from "@/components/ui/card";

/**
 * The lead panel's "Propostas" section. Placeholder for Task 20 (proposals +
 * conversion) — exported as its own component precisely so Task 20 can swap
 * this body for the real list/create/convert flow without touching
 * `lead-panel.tsx` at all.
 */
export function LeadProposals() {
  return (
    <section className="space-y-3">
      <h3 className="font-medium text-foreground">Propostas</h3>
      <Card className="border-dashed p-4">
        <p className="text-muted-foreground">Em construção.</p>
      </Card>
    </section>
  );
}
