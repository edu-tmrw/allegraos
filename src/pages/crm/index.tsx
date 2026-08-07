import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContacts, useDueFollowups } from "@/data/hooks/use-crm";
import { useEventTypes, useStages } from "@/data/hooks/use-settings";
import { todayISO } from "@/lib/format";
import { FollowupsBanner } from "@/pages/crm/followups-banner";
import { KanbanBoard } from "@/pages/crm/kanban-board";
import { LeadPanel } from "@/pages/crm/lead-panel";
import { LeadsTable } from "@/pages/crm/leads-table";
import { NewLeadDialog } from "@/pages/crm/new-lead-dialog";
import type { EventType } from "@/domain/types";

type View = "kanban" | "lista";

/**
 * The CRM pipeline screen: kanban (default) or lista of every non-archived
 * lead, a follow-ups banner on top, "Novo lead", and "Ver arquivados" —
 * which, since archived leads never appear on the board, always forces the
 * lista view while it's on. Selecting a lead (card, row, or banner entry)
 * opens `<LeadPanel>` — the editable data/timeline/archive side panel from
 * Task 19; Task 20 adds the proposals/conversion flow inside it without
 * this page needing to change.
 */
export function CrmPage() {
  const [view, setView] = useState<View>("kanban");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  const stagesQuery = useStages();
  const eventTypesQuery = useEventTypes();
  const contactsQuery = useContacts({ archived: showArchived });
  const followups = useDueFollowups();

  const stages = stagesQuery.data ?? [];
  const eventTypes = eventTypesQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];

  const activeStages = useMemo(() => stages.filter((stage) => stage.active), [stages]);
  const activeEventTypes = useMemo(() => eventTypes.filter((type) => type.active), [eventTypes]);
  const eventTypesById = useMemo(() => {
    const map = new Map<string, EventType>();
    for (const type of eventTypes) map.set(type.id, type);
    return map;
  }, [eventTypes]);

  const overdueContactIds = useMemo(() => {
    const today = todayISO();
    const ids = new Set<string>();
    for (const { activity, contact } of followups ?? []) {
      if (activity.dueDate !== null && activity.dueDate < today) ids.add(contact.id);
    }
    return ids;
  }, [followups]);

  const effectiveView: View = showArchived ? "lista" : view;
  const noLeadsAtAll = !showArchived && contactsQuery.isSuccess && contacts.length === 0;

  function handleOpenContact(contactId: string) {
    setSelectedContactId(contactId);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-3xl text-foreground">CRM</h1>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="ver-arquivados" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="ver-arquivados" className="text-sm text-muted-foreground">
              Ver arquivados
            </Label>
          </div>

          <Tabs value={effectiveView} onValueChange={(value) => setView(value as View)}>
            <TabsList>
              <TabsTrigger value="kanban" disabled={showArchived}>
                Kanban
              </TabsTrigger>
              <TabsTrigger value="lista">Lista</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button type="button" onClick={() => setNewLeadOpen(true)}>
            <Plus className="size-4" />
            Novo lead
          </Button>
        </div>
      </div>

      {followups && followups.length > 0 && (
        <FollowupsBanner followups={followups} onOpenContact={handleOpenContact} />
      )}

      {noLeadsAtAll ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Nenhum lead cadastrado ainda.</p>
          <Button type="button" onClick={() => setNewLeadOpen(true)}>
            <Plus className="size-4" />
            Novo lead
          </Button>
        </div>
      ) : effectiveView === "kanban" ? (
        <KanbanBoard
          stages={activeStages}
          contacts={contacts}
          eventTypesById={eventTypesById}
          overdueContactIds={overdueContactIds}
          onOpenContact={handleOpenContact}
        />
      ) : (
        <LeadsTable
          contacts={contacts}
          stages={stages}
          activeStages={activeStages}
          eventTypesById={eventTypesById}
          archived={showArchived}
          onOpenContact={handleOpenContact}
        />
      )}

      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} stages={activeStages} eventTypes={activeEventTypes} />

      <LeadPanel
        contactId={selectedContactId}
        onOpenChange={(open) => {
          if (!open) setSelectedContactId(null);
        }}
      />
    </div>
  );
}
