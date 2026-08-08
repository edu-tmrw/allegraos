import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMoveContactStage } from "@/data/hooks/use-crm";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Contact, EventType, PipelineStage } from "@/domain/types";

/**
 * The alternate, non-board view of the pipeline — also the only view
 * "Ver arquivados" ever shows, since archived leads never appear in the
 * kanban, and the only place a "ganho" lead (converted into an event) is
 * still visible at all, since the kanban excludes those too. In archived
 * mode, or for a won lead, the stage is plain text (moving either one makes
 * no sense — an archived lead is off the board, a won one has nothing left
 * to negotiate) instead of the live `<Select>` other rows get; a won row
 * also carries a GANHO badge next to its name, mirroring the lead panel's
 * own badge for the exact same signal.
 */
export function LeadsTable({
  contacts,
  stages,
  activeStages,
  eventTypesById,
  archived,
  wonContactIds,
  onOpenContact,
}: {
  contacts: Contact[];
  stages: PipelineStage[];
  activeStages: PipelineStage[];
  eventTypesById: Map<string, EventType>;
  archived: boolean;
  wonContactIds: Set<string>;
  onOpenContact: (contactId: string) => void;
}) {
  const moveStage = useMoveContactStage();

  if (contacts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        {archived ? "Nenhum lead arquivado." : "Nenhum lead encontrado."}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead>Interesse</TableHead>
          <TableHead>Etapa</TableHead>
          <TableHead>Criado em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => {
          const eventType = contact.eventTypeId ? eventTypesById.get(contact.eventTypeId) : undefined;
          const stageName = stages.find((stage) => stage.id === contact.stageId)?.name ?? "—";
          const contactLine = [contact.phone, contact.email].filter((value) => value !== null).join(" · ");
          const won = wonContactIds.has(contact.id);

          return (
            <TableRow key={contact.id} className={cn(archived && "text-muted-foreground")}>
              <TableCell>
                <button
                  type="button"
                  onClick={() => onOpenContact(contact.id)}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {contact.name}
                </button>
                {won && (
                  <Badge
                    data-testid={`ganho-badge-${contact.id}`}
                    className="ml-2 border-transparent bg-accent text-accent-foreground"
                  >
                    GANHO
                  </Badge>
                )}
                {archived && (
                  <Badge variant="outline" className="ml-2">
                    Arquivado
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{contactLine || "—"}</TableCell>
              <TableCell>
                {eventType ? (
                  <Badge variant="secondary">{eventType.name}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {archived || won ? (
                  stageName
                ) : (
                  <Select
                    value={contact.stageId}
                    onValueChange={(stageId) => moveStage.mutate({ contactId: contact.id, stageId })}
                  >
                    <SelectTrigger size="sm" className="w-[180px]" aria-label={`Etapa de ${contact.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(contact.createdAt)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
