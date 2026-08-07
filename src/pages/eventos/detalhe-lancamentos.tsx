/**
 * "Lançamentos" section of the event detail page. Placeholder body only,
 * for now — Task 15 (`TransactionFormDialog` + the entries list) replaces
 * the `CardContent` below. The `Card`/`CardHeader` shell is the seam: keep
 * it, swap what's inside `CardContent`. The caller (`detalhe.tsx`) is
 * responsible for only rendering this component at all when the viewer has
 * `manageFinance` — money movements are never shown to a Comercial profile.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DetalheLancamentos({ eventId }: { eventId: string }) {
  return (
    <Card data-event-id={eventId}>
      <CardHeader>
        <CardTitle className="font-serif text-xl">Lançamentos</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Em construção.</p>
      </CardContent>
    </Card>
  );
}
