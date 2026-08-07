import { useMemo } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { useMoveContactStage } from "@/data/hooks/use-crm";
import { cn } from "@/lib/utils";
import type { Contact, EventType, PipelineStage } from "@/domain/types";

/**
 * One column per active pipeline stage (position order), each a dnd-kit
 * droppable; cards are draggable between columns and call
 * `useMoveContactStage` on drop. The board scrolls horizontally as a whole
 * (columns never wrap) so it stays usable down to a 375px viewport.
 */
export function KanbanBoard({
  stages,
  contacts,
  eventTypesById,
  overdueContactIds,
  onOpenContact,
}: {
  stages: PipelineStage[];
  contacts: Contact[];
  eventTypesById: Map<string, EventType>;
  overdueContactIds: Set<string>;
  onOpenContact: (contactId: string) => void;
}) {
  const moveStage = useMoveContactStage();
  // A short drag threshold lets the same pointer-down-and-up that starts a
  // drag also register as a plain click when the pointer never moves —
  // this is what makes "click opens the lead, drag moves the card" work
  // off the very same element without any extra bookkeeping.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const contactsByStage = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const contact of contacts) {
      map.get(contact.stageId)?.push(contact);
    }
    return map;
  }, [stages, contacts]);

  if (stages.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        Configure as etapas do funil em Configurações.
      </p>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    const contactId = String(event.active.id);
    const stageId = String(event.over.id);
    const contact = contacts.find((candidate) => candidate.id === contactId);
    if (!contact || contact.stageId === stageId) return;
    moveStage.mutate({ contactId, stageId });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            contacts={contactsByStage.get(stage.id) ?? []}
            eventTypesById={eventTypesById}
            overdueContactIds={overdueContactIds}
            onOpenContact={onOpenContact}
          />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  stage,
  contacts,
  eventTypesById,
  overdueContactIds,
  onOpenContact,
}: {
  stage: PipelineStage;
  contacts: Contact[];
  eventTypesById: Map<string, EventType>;
  overdueContactIds: Set<string>;
  onOpenContact: (contactId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="w-[260px] min-w-[260px] shrink-0 snap-start" data-testid={`stage-column-${stage.id}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="font-medium text-foreground">{stage.name}</h3>
        <Badge variant="secondary">{contacts.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-col gap-2 rounded-lg border border-border bg-muted/40 p-2 transition-colors",
          isOver && "border-primary bg-accent/40",
        )}
      >
        {contacts.length === 0 ? (
          <p className="p-3 text-center text-sm text-muted-foreground">Vazio</p>
        ) : (
          contacts.map((contact) => (
            <KanbanCard
              key={contact.id}
              contact={contact}
              eventType={contact.eventTypeId ? eventTypesById.get(contact.eventTypeId) : undefined}
              overdue={overdueContactIds.has(contact.id)}
              onOpen={onOpenContact}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  contact,
  eventType,
  overdue,
  onOpen,
}: {
  contact: Contact;
  eventType: EventType | undefined;
  overdue: boolean;
  onOpen: (contactId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: contact.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(contact.id)}
      data-testid={`lead-card-${contact.id}`}
      className={cn(
        "block w-full cursor-grab rounded-lg border border-border bg-card p-3 text-left shadow-sm active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground">{contact.name}</span>
        {overdue && (
          <span
            role="img"
            aria-label="Follow-up vencido"
            title="Follow-up vencido"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-negative"
          />
        )}
      </div>
      {eventType && (
        <Badge variant="secondary" className="mt-2">
          {eventType.name}
        </Badge>
      )}
    </button>
  );
}
