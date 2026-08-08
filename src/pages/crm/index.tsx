import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContacts, useDueFollowups } from "@/data/hooks/use-crm";
import { useEvents } from "@/data/hooks/use-events";
import { useEventTypes, useStages } from "@/data/hooks/use-settings";
import { todayISO } from "@/lib/format";
import { usePageTitle } from "@/lib/use-page-title";
import { FollowupsBanner } from "@/pages/crm/followups-banner";
import { KanbanBoard } from "@/pages/crm/kanban-board";
import { LeadPanel } from "@/pages/crm/lead-panel";
import { LeadsTable } from "@/pages/crm/leads-table";
import { NewLeadDialog } from "@/pages/crm/new-lead-dialog";
import type { EventType } from "@/domain/types";

type View = "kanban" | "lista";

/** Loading placeholder for the first paint. Without this, `stages` defaulted to `[]` before `useStages()` actually resolved, so `<KanbanBoard>`'s own "Configure as etapas do funil" empty state could flash on every fresh page load, before there was any real signal that stages were missing rather than just not-yet-loaded. */
function CrmSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-3xl text-foreground">CRM</h1>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-64 w-[260px] shrink-0 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * The CRM pipeline screen: kanban (default) or lista of every non-archived
 * lead, a follow-ups banner on top, "Novo lead", and "Ver arquivados" —
 * which, since archived leads never appear on the board, always forces the
 * lista view while it's on. A "ganho" lead (converted into an event) is
 * excluded from the kanban the same way — the funil is for open
 * negotiations only — but stays in the lista, marked with a GANHO badge
 * (see `<LeadsTable>`); its timeline/data stays reachable via the panel
 * either way. Selecting a lead (card, row, or banner entry) opens
 * `<LeadPanel>` — the editable data/timeline/archive side panel from Task
 * 19; Task 20 adds the proposals/conversion flow inside it without this
 * page needing to change.
 */
export function CrmPage() {
  usePageTitle("CRM");
  const [view, setView] = useState<View>("kanban");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const stagesQuery = useStages();
  const eventTypesQuery = useEventTypes();
  const eventsQuery = useEvents();
  const contactsQuery = useContacts({ archived: showArchived });
  const followups = useDueFollowups();

  // Deep link from the event detail page's "Origem" link (`/crm?lead=<id>`):
  // open that lead's panel once on mount, then strip the param so it doesn't
  // reopen on a later re-render/refresh. Works for a won lead too — the
  // panel fetches its own contact directly via `useContact`, regardless of
  // the kanban's won-lead filtering below.
  useEffect(() => {
    const leadId = searchParams.get("lead");
    if (!leadId) return;
    setSelectedContactId(leadId);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("lead");
        return next;
      },
      { replace: true },
    );
    // Intentionally mount-only — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stages = stagesQuery.data ?? [];
  const eventTypes = eventTypesQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];

  const activeStages = useMemo(() => stages.filter((stage) => stage.active), [stages]);
  const activeEventTypes = useMemo(() => eventTypes.filter((type) => type.active), [eventTypes]);
  const eventTypesById = useMemo(() => {
    const map = new Map<string, EventType>();
    for (const type of eventTypes) map.set(type.id, type);
    return map;
  }, [eventTypes]);

  // "Ganho" = a linked event exists (an Evento whose `contactId` points back
  // at this lead — see the design spec's §4 CRM section) — no column of its
  // own, just this derived set every render checks against.
  const wonContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const evt of events) {
      if (evt.contactId !== null) ids.add(evt.contactId);
    }
    return ids;
  }, [events]);

  const overdueContactIds = useMemo(() => {
    const today = todayISO();
    const ids = new Set<string>();
    for (const { activity, contact } of followups ?? []) {
      if (activity.dueDate !== null && activity.dueDate < today) ids.add(contact.id);
    }
    return ids;
  }, [followups]);

  // Deliberately not `contactsQuery.isLoading` too: that query re-fires (a
  // genuinely new key) every time "Ver arquivados" flips, and gating the
  // whole page on it would flash this full skeleton on every toggle instead
  // of just updating the list — `noLeadsAtAll` below already handles that
  // query's own loading window without losing the header controls.
  // `eventsQuery` IS included, alongside stages/eventTypes: without it,
  // `wonContactIds` would be empty for one tick on a cold load, and every
  // already-won lead would flash on the kanban before disappearing — the
  // exact bug this fix exists to prevent, just moved from "always" to "for
  // one frame."
  if (stagesQuery.isLoading || eventTypesQuery.isLoading || eventsQuery.isLoading) {
    return <CrmSkeleton />;
  }

  const effectiveView: View = showArchived ? "lista" : view;
  const noLeadsAtAll = !showArchived && contactsQuery.isSuccess && contacts.length === 0;
  const kanbanContacts = contacts.filter((contact) => !wonContactIds.has(contact.id));

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
          contacts={kanbanContacts}
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
          wonContactIds={wonContactIds}
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
