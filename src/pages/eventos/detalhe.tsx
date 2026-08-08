/**
 * Evento: detalhe. Header (nome, badges, data/horário em destaque, "em N
 * dias"), banner quando cancelado, 5 stat cards financeiros, as seções
 * placeholder de serviços/lançamentos (seams for Tasks 14/15), observações,
 * e as ações de editar/cancelar. Gating: stat cards e lançamentos só com
 * `manageFinance`; toda escrita (observações, editar, cancelar/reativar) só
 * com `manageEvents` — qualquer usuário logado pode visualizar a página.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, HeartHandshake, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePerms } from "@/data/auth";
import { useContact } from "@/data/hooks/use-crm";
import { useCancelEvent, useEvent, useReactivateEvent, useUpdateEvent } from "@/data/hooks/use-events";
import { useEventTypes } from "@/data/hooks/use-settings";
import { eventStatus } from "@/domain/calc";
import type { Evento } from "@/domain/types";
import { formatTime, todayISO } from "@/lib/format";
import { daysUntilLabel } from "@/lib/relative-days";
import { usePageTitle } from "@/lib/use-page-title";
import { DetalheLancamentos } from "@/pages/eventos/detalhe-lancamentos";
import { EventoFinancialCards } from "@/pages/eventos/detalhe-financials";
import { DetalheServicos } from "@/pages/eventos/detalhe-servicos";
import { EditarEventoDialog } from "@/pages/eventos/editar-evento-dialog";
import { StatusBadge } from "@/pages/eventos/status-badge";

/** "12 de setembro de 2026 · 19h30" — omits the "· hh" clause with no scheduled time yet. */
function formatEventDateLong(ev: Evento): string {
  const date = format(parseISO(ev.eventDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return ev.eventTime ? `${date} · ${formatTime(ev.eventTime)}` : date;
}

/** `showFinance` mirrors the real page's own `manageFinance` gate on `<EventoFinancialCards>` — a Comercial profile shouldn't see 5 finance-card placeholders flash by for a section it will never actually get. */
function DetalheSkeleton({ showFinance }: { showFinance: boolean }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-28" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-7 w-80" />
      </div>
      {showFinance && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      )}
    </div>
  );
}

export function EventoDetalhePage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const navigate = useNavigate();
  const { manageEvents, manageFinance, manageCrm } = usePerms();

  const { data: event } = useEvent(id);
  const { data: eventTypes } = useEventTypes();
  // Spec §9: "vínculo lead ↔ evento navegável nos dois sentidos" — this is
  // the evento → lead direction (the other already exists via the lead
  // panel's own "Ver evento"). Called unconditionally with the nullable id
  // (hooks can't be conditional) — `useContact` no-ops to `null` on an empty
  // id, exactly like `event?.contactId` is before `event` itself loads.
  const { data: originContact } = useContact(event?.contactId ?? "");
  // The event's own name once it's loaded ("Evento" while loading/missing) —
  // more useful in a browser tab than a static "Evento" when several are open.
  usePageTitle(event ? event.name : "Evento");

  const [editOpen, setEditOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  const updateEvent = useUpdateEvent();
  const cancelEvent = useCancelEvent();
  const reactivateEvent = useReactivateEvent();

  // Re-seed the notes draft whenever we land on a different event, or its
  // saved notes actually change (e.g. our own save just landed) — but not on
  // every unrelated background refetch of the same value, which would wipe
  // whatever the user is mid-typing.
  useEffect(() => {
    setNotesDraft(event?.notes ?? "");
  }, [event?.id, event?.notes]);

  if (event === undefined) {
    return <DetalheSkeleton showFinance={manageFinance} />;
  }

  if (event === null) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Evento não encontrado.</p>
        <Button type="button" variant="outline" onClick={() => navigate("/eventos")}>
          <ArrowLeft className="size-4" />
          Voltar para Eventos
        </Button>
      </div>
    );
  }

  const eventTypesById = new Map((eventTypes ?? []).map((type) => [type.id, type.name]));
  const status = eventStatus(event, todayISO());
  const isCanceled = status === "cancelado";
  // `null` (not just "0 or negative") for a canceled event too — the status
  // badge already says "Cancelado", so a redundant "em N dias" would be noise.
  const diasRestantesLabel = isCanceled ? null : daysUntilLabel(event.eventDate, todayISO());
  const notesUnchanged = notesDraft === (event.notes ?? "");

  // An arrow function, not a `function` declaration: TS's narrowing of
  // `event` (from the guards above) only carries into closures, not into
  // hoisted function declarations.
  const handleSaveNotes = () => {
    updateEvent.mutate(
      { id: event.id, patch: { notes: notesDraft.trim() === "" ? null : notesDraft } },
      {
        onSuccess: () => toast.success("Observações salvas."),
        onError: () => toast.error("Não foi possível salvar as observações. Tente novamente."),
      },
    );
  };

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => navigate("/eventos")}>
        <ArrowLeft className="size-4" />
        Eventos
      </Button>

      <div className="space-y-2">
        <h1 className="font-serif text-3xl text-foreground">{event.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-muted-foreground">
            {eventTypesById.get(event.eventTypeId) ?? ""}
          </Badge>
          <StatusBadge status={status} />
        </div>
        <p className="font-serif text-xl text-foreground sm:text-2xl">{formatEventDateLong(event)}</p>
        {diasRestantesLabel !== null && (
          <p className="text-sm text-muted-foreground">{diasRestantesLabel}</p>
        )}
        {/* Only once the lead itself resolves (never for a tick with no name to show), and only for a role that can actually open the CRM to follow it. */}
        {event.contactId !== null && manageCrm && originContact && (
          <Link
            to={`/crm?lead=${event.contactId}`}
            className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
          >
            <HeartHandshake className="size-3.5" />
            Origem: {originContact.name}
          </Link>
        )}
      </div>

      {isCanceled && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">
              Evento cancelado. Lançamentos continuam no histórico; devoluções podem ser lançadas como saída.
            </p>
            {manageEvents && (
              <Button
                type="button"
                variant="outline"
                className="w-fit shrink-0"
                onClick={() =>
                  reactivateEvent.mutate(event.id, {
                    onSuccess: () => toast.success("Evento reativado."),
                    onError: () => toast.error("Não foi possível reativar o evento. Tente novamente."),
                  })
                }
              >
                Reativar evento
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {manageFinance && <EventoFinancialCards eventId={event.id} />}

      <DetalheServicos eventId={event.id} />
      {manageFinance && <DetalheLancamentos eventId={event.id} />}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">Observações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            disabled={!manageEvents}
            rows={4}
            placeholder={manageEvents ? "Anote detalhes importantes sobre este evento…" : "Nenhuma observação."}
            aria-label="Observações"
          />
          {manageEvents && (
            <Button
              type="button"
              className="self-end"
              disabled={notesUnchanged || updateEvent.isPending}
              onClick={handleSaveNotes}
            >
              Salvar observações
            </Button>
          )}
        </CardContent>
      </Card>

      {manageEvents && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Ações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Editar
            </Button>

            {!isCanceled && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Cancelar evento
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar evento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cancelar este evento? Ele sai do "a receber" e some dos próximos eventos; o histórico
                      financeiro permanece.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() =>
                        cancelEvent.mutate(event.id, {
                          onSuccess: () => toast.success("Evento cancelado."),
                          onError: () => toast.error("Não foi possível cancelar o evento. Tente novamente."),
                        })
                      }
                    >
                      Confirmar cancelamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      )}

      <EditarEventoDialog evento={event} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
