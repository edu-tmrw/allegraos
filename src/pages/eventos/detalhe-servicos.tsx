/**
 * "Serviços contratados" section of the event detail page. Placeholder body
 * only, for now — Task 14 (`ServiceItemsEditor`: items table + desconto
 * editor) replaces the `CardContent` below with the real editor. The
 * `Card`/`CardHeader` shell is the seam: keep it, swap what's inside
 * `CardContent`. Not gated by `manageFinance` — everyone who can see the
 * event can see what services were sold on it.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DetalheServicos({ eventId }: { eventId: string }) {
  return (
    <Card data-event-id={eventId}>
      <CardHeader>
        <CardTitle className="font-serif text-xl">Serviços contratados</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Em construção.</p>
      </CardContent>
    </Card>
  );
}
