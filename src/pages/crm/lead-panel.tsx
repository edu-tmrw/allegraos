import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, MessageSquare } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddActivity,
  useArchiveContact,
  useContact,
  useContactActivities,
  useContactEvent,
  useToggleActivityDone,
  useUnarchiveContact,
  useUpdateContact,
} from "@/data/hooks/use-crm";
import { useEventTypes, useStages } from "@/data/hooks/use-settings";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LeadProposals } from "@/pages/crm/lead-proposals";
import type { Activity, Contact, EventType, PipelineStage } from "@/domain/types";

/** Sentinel for "Interesse" left unset — Radix `<Select.Item>` can't take an empty-string value. */
const NONE_EVENT_TYPE = "none";

/** Mirrors `new-lead-dialog.tsx`'s validation exactly — same field limits, same pt-BR messages. */
const leadDetailSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(80, "Máximo de 80 caracteres."),
  phone: z.string().trim().max(30, "Telefone muito longo."),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\S+@\S+\.\S+$/.test(value), { message: "E-mail inválido." }),
  eventTypeId: z.string(),
  stageId: z.string().min(1, "Selecione uma etapa."),
});

type LeadDetailValues = z.infer<typeof leadDetailSchema>;

function valuesFromContact(contact: Contact): LeadDetailValues {
  return {
    name: contact.name,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    eventTypeId: contact.eventTypeId ?? NONE_EVENT_TYPE,
    stageId: contact.stageId,
  };
}

/**
 * The real lead detail panel (replaces T18's `LeadPanelPlaceholder`): editable
 * data, a note/follow-up timeline, archive/unarchive, and a GANHO badge +
 * link once the lead has converted into an event. Every query this needs
 * (contact, its event, its activities, plus the settings lists the edit form
 * offers) is fetched unconditionally up front, together, so the loading
 * skeleton covers one single tick rather than flashing section-by-section as
 * each nested query resolves.
 */
export function LeadPanel({
  contactId,
  onOpenChange,
}: {
  contactId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const effectiveId = contactId ?? "";
  const contactQuery = useContact(effectiveId);
  const eventQuery = useContactEvent(effectiveId);
  const activitiesQuery = useContactActivities(effectiveId);
  const stagesQuery = useStages();
  const eventTypesQuery = useEventTypes();

  const contact = contactQuery.data ?? null;
  const loading =
    contactQuery.isLoading ||
    eventQuery.isLoading ||
    activitiesQuery.isLoading ||
    stagesQuery.isLoading ||
    eventTypesQuery.isLoading;

  return (
    <Sheet open={contactId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-full md:w-[480px] md:max-w-[480px]">
        {contactId === null ? null : loading ? (
          <PanelSkeleton />
        ) : !contact ? (
          <>
            <SheetHeader>
              <SheetTitle className="font-serif text-2xl">Lead</SheetTitle>
            </SheetHeader>
            <p className="px-4 text-muted-foreground">Lead não encontrado.</p>
          </>
        ) : (
          <LeadPanelContent
            contact={contact}
            evento={eventQuery.data ?? null}
            activities={activitiesQuery.data ?? []}
            stages={stagesQuery.data ?? []}
            eventTypes={eventTypesQuery.data ?? []}
            onOpenChange={onOpenChange}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function LeadPanelContent({
  contact,
  evento,
  activities,
  stages,
  eventTypes,
  onOpenChange,
}: {
  contact: Contact;
  evento: { id: string } | null;
  activities: Activity[];
  stages: PipelineStage[];
  eventTypes: EventType[];
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const activeStages = useMemo(() => stages.filter((stage) => stage.active), [stages]);
  const activeEventTypes = useMemo(() => eventTypes.filter((type) => type.active), [eventTypes]);

  const updateContact = useUpdateContact();
  const archiveContact = useArchiveContact();
  const unarchiveContact = useUnarchiveContact();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<LeadDetailValues>({
    resolver: zodResolver(leadDetailSchema),
    // `contact` is already loaded by the time this component mounts (the
    // parent gates on it), so seeding straight from it — rather than an
    // empty shape corrected a tick later — means Radix's <Select> never
    // renders a "selected" value that doesn't match any <SelectItem>: that
    // mismatch is what left the Interesse/Etapa triggers showing no text at
    // all on first paint.
    defaultValues: valuesFromContact(contact),
  });

  // Defensive re-seed if a *different* contact's id ever flows into an
  // already-mounted panel (e.g. a future "next lead" action). A successful
  // save re-seeds too (see `onSubmit`), so the form's own dirty state — not
  // a refetch racing the user's edits — is what clears "Salvar".
  useEffect(() => {
    reset(valuesFromContact(contact));
  }, [contact.id, reset]);

  function onSubmit(values: LeadDetailValues) {
    updateContact.mutate(
      {
        id: contact.id,
        patch: {
          name: values.name.trim(),
          phone: values.phone.trim() ? values.phone.trim() : null,
          email: values.email.trim() ? values.email.trim() : null,
          eventTypeId: values.eventTypeId === NONE_EVENT_TYPE ? null : values.eventTypeId,
          stageId: values.stageId,
        },
      },
      {
        onSuccess: () => {
          toast.success("Lead atualizado com sucesso.");
          reset(values);
        },
        onError: () => toast.error("Não foi possível atualizar o lead."),
      },
    );
  }

  function handleViewEvent() {
    if (!evento) return;
    onOpenChange(false);
    navigate(`/eventos/${evento.id}`);
  }

  function handleArchive() {
    archiveContact.mutate(contact.id, {
      onSuccess: () => onOpenChange(false),
      onError: () => toast.error("Não foi possível arquivar o lead."),
    });
  }

  function handleUnarchive() {
    unarchiveContact.mutate(contact.id, {
      onError: () => toast.error("Não foi possível desarquivar o lead."),
    });
  }

  return (
    <>
      <SheetHeader>
        {/* pr-8 keeps this row's right-aligned content clear of the Sheet's own absolutely-positioned close button (top-4 right-4). */}
        <div className="flex items-start justify-between gap-3 pr-8">
          <div>
            <SheetTitle className="font-serif text-2xl">{contact.name}</SheetTitle>
            <p className="text-sm text-muted-foreground">desde {formatDate(contact.createdAt)}</p>
          </div>
          {evento && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge data-testid="ganho-badge">GANHO</Badge>
              <button
                type="button"
                onClick={handleViewEvent}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Ver evento
              </button>
            </div>
          )}
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Dados</h3>
            {contact.archived && <Badge variant="outline">Arquivado</Badge>}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="panel-lead-name">Nome</Label>
              <Input
                id="panel-lead-name"
                disabled={contact.archived}
                {...register("name")}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="panel-lead-phone">Telefone</Label>
              <Input
                id="panel-lead-phone"
                disabled={contact.archived}
                {...register("phone")}
                aria-invalid={!!errors.phone}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="panel-lead-email">Email</Label>
              {/* Not type="email" — same reasoning as new-lead-dialog.tsx: Zod is the single source of truth. */}
              <Input
                id="panel-lead-email"
                disabled={contact.archived}
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="panel-lead-event-type">Interesse</Label>
              <Controller
                control={control}
                name="eventTypeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={contact.archived}>
                    <SelectTrigger id="panel-lead-event-type" className="w-full" aria-label="Interesse">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_EVENT_TYPE}>Sem interesse definido</SelectItem>
                      {activeEventTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="panel-lead-stage">Etapa</Label>
              <Controller
                control={control}
                name="stageId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={contact.archived}>
                    <SelectTrigger
                      id="panel-lead-stage"
                      className="w-full"
                      aria-label="Etapa"
                      aria-invalid={!!errors.stageId}
                    >
                      <SelectValue placeholder="Selecione a etapa" />
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
              />
              {errors.stageId && <p className="text-sm text-destructive">{errors.stageId.message}</p>}
            </div>

            <Button type="submit" size="sm" disabled={contact.archived || !isDirty || updateContact.isPending}>
              Salvar
            </Button>
          </form>
        </section>

        <TimelineSection contactId={contact.id} activities={activities} />

        <LeadProposals />
      </div>

      <SheetFooter className="border-t border-border">
        {contact.archived ? (
          <Button type="button" variant="outline" onClick={handleUnarchive} disabled={unarchiveContact.isPending}>
            Desarquivar
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Arquivar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar este lead?</AlertDialogTitle>
                <AlertDialogDescription>Ele sai do funil; o histórico permanece.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleArchive}>
                  Arquivar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </SheetFooter>
    </>
  );
}

function TimelineSection({ contactId, activities }: { contactId: string; activities: Activity[] }) {
  const addActivity = useAddActivity();
  const toggleDone = useToggleActivityDone();

  const [content, setContent] = useState("");
  const [showFollowupDate, setShowFollowupDate] = useState(false);
  const [followupDate, setFollowupDate] = useState(todayISO());

  function handleAddNote() {
    const trimmed = content.trim();
    if (!trimmed) return;
    addActivity.mutate(
      { contactId, content: trimmed, dueDate: null },
      {
        onSuccess: () => setContent(""),
        onError: () => toast.error("Não foi possível adicionar a nota."),
      },
    );
  }

  function handleAddFollowup() {
    const trimmed = content.trim();
    if (!trimmed || !followupDate) return;
    addActivity.mutate(
      { contactId, content: trimmed, dueDate: followupDate },
      {
        onSuccess: () => {
          setContent("");
          setFollowupDate(todayISO());
          setShowFollowupDate(false);
        },
        onError: () => toast.error("Não foi possível agendar o follow-up."),
      },
    );
  }

  function handleToggleDone(activity: Activity, done: boolean) {
    toggleDone.mutate({ id: activity.id, done }, { onError: () => toast.error("Não foi possível atualizar o follow-up.") });
  }

  return (
    <section className="space-y-3">
      <h3 className="font-medium text-foreground">Histórico</h3>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={2}
          placeholder="Registrar uma nota sobre este lead..."
          aria-label="Nova nota"
        />
        {showFollowupDate ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={followupDate}
              onChange={(event) => setFollowupDate(event.target.value)}
              aria-label="Data do follow-up"
              className="w-auto"
            />
            <Button type="button" size="sm" onClick={handleAddFollowup} disabled={!content.trim() || addActivity.isPending}>
              Confirmar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowFollowupDate(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleAddNote} disabled={!content.trim() || addActivity.isPending}>
              Anotar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setShowFollowupDate(true)}>
              Agendar follow-up
            </Button>
          </div>
        )}
      </div>

      <ul className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} onToggleDone={handleToggleDone} />
          ))
        )}
      </ul>
    </section>
  );
}

function ActivityRow({
  activity,
  onToggleDone,
}: {
  activity: Activity;
  onToggleDone: (activity: Activity, done: boolean) => void;
}) {
  const dueDate = activity.dueDate;
  const overdue = dueDate !== null && !activity.done && dueDate < todayISO();

  return (
    <li className="flex items-start gap-3" data-testid={`activity-${activity.id}`}>
      {dueDate !== null ? (
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      ) : (
        <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={cn("text-sm text-foreground", dueDate !== null && activity.done && "text-muted-foreground line-through")}>
          {activity.content}
        </p>
        <p
          className={cn(
            "text-xs text-muted-foreground",
            overdue && "font-medium text-negative",
            dueDate !== null && activity.done && "line-through",
          )}
        >
          {dueDate !== null ? `para ${formatDate(dueDate)}` : formatDate(activity.createdAt)}
        </p>
      </div>
      {dueDate !== null && (
        <Checkbox
          checked={activity.done}
          onCheckedChange={(checked) => onToggleDone(activity, checked === true)}
          aria-label={activity.done ? "Marcar follow-up como não concluído" : "Marcar follow-up como concluído"}
          className="mt-0.5"
        />
      )}
    </li>
  );
}
