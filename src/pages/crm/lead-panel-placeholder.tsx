import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useContact } from "@/data/hooks/use-crm";

/**
 * Stand-in for Task 19's real lead panel. Owns just enough Sheet plumbing
 * (open/close wiring + the contact's name) so every entry point that should
 * open a lead — kanban card, lista row, follow-ups banner row — already has
 * somewhere to go. `contactId === null` means closed; Task 19 replaces the
 * body with editable fields, timeline, archive toggle, and the GANHO badge.
 */
export function LeadPanelPlaceholder({
  contactId,
  onOpenChange,
}: {
  contactId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const contactQuery = useContact(contactId ?? "");
  const contact = contactId ? contactQuery.data : null;

  return (
    <Sheet open={contactId !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{contact?.name ?? "Lead"}</SheetTitle>
        </SheetHeader>
        <p className="px-4 text-muted-foreground">Detalhes do lead em construção.</p>
      </SheetContent>
    </Sheet>
  );
}
