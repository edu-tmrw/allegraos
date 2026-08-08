/**
 * The lead panel's "Propostas" section (Task 20 — replaces T19's
 * placeholder): lists the lead's proposals (newest first), lets the user
 * send a new one (built entirely from the SHARED `ServiceItemsEditor`), mark
 * a sent proposal aceita/recusada, and — once at least one proposal is
 * aceita and the lead hasn't converted yet — convert the lead into a real
 * `Evento` that copies the accepted proposal's items and discount.
 *
 * Self-contained on purpose: the panel only ever needs to hand this
 * `contactId` plus its own `onOpenChange` (to close the whole Sheet once a
 * conversion lands, mirroring `handleViewEvent`'s own close-then-navigate in
 * `lead-panel.tsx`) — everything else (the contact itself, event types, this
 * lead's proposals, whether it already has an event) is fetched here via the
 * same data hooks the rest of the CRM feature uses, so `lead-panel.tsx`
 * barely changes to wire this in.
 */
import { useEffect, useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarHeart, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { ServiceItemsEditor, type ServiceItemDraft, type ServiceItemRow } from "@/components/service-items-editor";
import {
  useContact,
  useContactEvent,
  useContactProposals,
  useConvertLead,
  useCreateProposal,
  useProposalServices,
  useSetProposalStatus,
} from "@/data/hooks/use-crm";
import { useEventTypes } from "@/data/hooks/use-settings";
import { contractCents } from "@/domain/calc";
import type { Contact, Evento, EventType, Proposal } from "@/domain/types";
import { formatDate, todayISO } from "@/lib/format";

/**
 * Mirrors `evento-form-schema.ts`'s `eventoSchema` exactly (same field
 * limits, same pt-BR messages) plus the proposal picker — duplicated rather
 * than imported so this file stays inside the CRM feature's own import
 * surface (same reasoning as `lead-panel.tsx`'s own `leadDetailSchema`).
 */
const convertLeadSchema = z.object({
  proposalId: z.string().min(1, "Selecione a proposta."),
  name: z.string().trim().min(1, "Informe o nome do evento.").max(80, "Máximo de 80 caracteres."),
  eventTypeId: z.string().min(1, "Selecione o tipo de evento."),
  eventDate: z.string().min(1, "Selecione a data do evento."),
  eventTime: z.string(),
});

type ConvertLeadValues = z.infer<typeof convertLeadSchema>;

const PROPOSAL_STATUS_LABEL: Record<Proposal["status"], string> = {
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
};

/** Same three-color language as `eventos/status-badge.tsx`'s `StatusBadge`: accent/gold for the "won" state, outline destructive for the "lost" one, secondary for the neutral in-between. */
function ProposalStatusBadge({ status }: { status: Proposal["status"] }) {
  if (status === "accepted") {
    return (
      <Badge className="border-transparent bg-accent text-accent-foreground">{PROPOSAL_STATUS_LABEL.accepted}</Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="outline" className="border-destructive/50 text-destructive">
        {PROPOSAL_STATUS_LABEL.rejected}
      </Badge>
    );
  }
  return <Badge variant="secondary">{PROPOSAL_STATUS_LABEL.sent}</Badge>;
}

export function LeadProposals({
  contactId,
  onOpenChange,
}: {
  contactId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  const { data: contact } = useContact(contactId);
  const { data: eventTypesData } = useEventTypes();
  const { data: proposalsData } = useContactProposals(contactId);
  const { data: eventoData } = useContactEvent(contactId);

  const setStatus = useSetProposalStatus();

  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  // The panel this section lives in already gates on `contact` (and every
  // other query it fetches) before mounting at all — this is only a
  // defensive guard against the one query this component adds on top
  // (`useContactProposals`) racing ahead of a `contact` that hasn't resolved
  // yet in some future reuse of this component.
  if (!contact) return null;

  const eventTypes = eventTypesData ?? [];
  const proposals = proposalsData ?? [];
  const evento = eventoData ?? null;
  const archived = contact.archived;

  const acceptedProposals = proposals.filter((proposal) => proposal.status === "accepted");
  const canConvert = !archived && evento === null && acceptedProposals.length > 0;

  function handleSetStatus(id: string, status: "accepted" | "rejected") {
    setStatus.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast.success(status === "accepted" ? "Proposta marcada como aceita." : "Proposta marcada como recusada."),
        onError: () => toast.error("Não foi possível atualizar a proposta. Tente novamente."),
      },
    );
  }

  function handleConverted(createdEvento: Evento) {
    setConvertOpen(false);
    onOpenChange(false);
    navigate(`/eventos/${createdEvento.id}`);
  }

  const novaPropostaButton = !archived && (
    <Button type="button" size="sm" onClick={() => setNewProposalOpen(true)}>
      <Plus className="size-4" />
      Nova proposta
    </Button>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Propostas</h3>
        {novaPropostaButton}
      </div>

      {canConvert && (
        <Button type="button" className="w-full gap-2" onClick={() => setConvertOpen(true)}>
          <CalendarHeart className="size-4" />
          Converter em evento
        </Button>
      )}

      {proposals.length === 0 ? (
        <EmptyState className="gap-3 p-4" title="Nenhuma proposta ainda." action={novaPropostaButton} />
      ) : (
        <div className="space-y-2">
          {proposals.map((proposal) => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              archived={archived}
              onSetStatus={handleSetStatus}
              statusPending={setStatus.isPending}
            />
          ))}
        </div>
      )}

      <NewProposalDialog open={newProposalOpen} onOpenChange={setNewProposalOpen} contactId={contactId} />

      <ConvertLeadDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        contact={contact}
        eventTypes={eventTypes}
        acceptedProposals={acceptedProposals}
        onConverted={handleConverted}
      />
    </section>
  );
}

/** One proposal row: date sent / total (its own `useProposalServices` — kept in this per-row subcomponent so the list above never calls that hook in a loop) / status badge / notes / aceita-recusada actions. */
function ProposalRow({
  proposal,
  archived,
  onSetStatus,
  statusPending,
}: {
  proposal: Proposal;
  archived: boolean;
  onSetStatus: (id: string, status: "accepted" | "rejected") => void;
  statusPending: boolean;
}) {
  const { data: items } = useProposalServices(proposal.id);
  const totalCents = contractCents(items ?? [], proposal.discountCents);

  return (
    <Card className="gap-2 p-3" data-testid={`proposal-${proposal.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">Enviada em {formatDate(proposal.sentDate)}</p>
          <Money cents={totalCents} />
        </div>
        <ProposalStatusBadge status={proposal.status} />
      </div>

      {proposal.notes && <p className="truncate text-xs text-muted-foreground">{proposal.notes}</p>}

      {proposal.status === "sent" && !archived && (
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => onSetStatus(proposal.id, "accepted")} disabled={statusPending}>
            Marcar aceita
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onSetStatus(proposal.id, "rejected")}
            disabled={statusPending}
          >
            Recusada
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * "Nova proposta" dialog: sends a brand-new proposal in one shot. Items
 * don't exist as their own store resource until submit — they're a local
 * draft array (`ServiceItemRow[]`, ids assigned client-side) fed straight
 * into the SHARED `ServiceItemsEditor`, exactly the way `detalhe-servicos.tsx`
 * feeds it an event's already-persisted items, just uncommitted here until
 * "Enviar proposta".
 */
function NewProposalDialog({
  open,
  onOpenChange,
  contactId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
}) {
  const createProposal = useCreateProposal();

  const [sentDate, setSentDate] = useState(todayISO());
  const [items, setItems] = useState<ServiceItemRow[]>([]);
  const [discountCents, setDiscountCents] = useState(0);
  const [notes, setNotes] = useState("");
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Every field starts fresh the next time the dialog opens — mirrors
  // `AddServiceDialog`'s own reset-on-open inside `service-items-editor.tsx`.
  useEffect(() => {
    if (open) {
      setSentDate(todayISO());
      setItems([]);
      setDiscountCents(0);
      setNotes("");
      setItemsError(null);
    }
  }, [open]);

  function handleAdd(draft: ServiceItemDraft) {
    setItems((previous) => [...previous, { ...draft, id: crypto.randomUUID() }]);
    setItemsError(null);
  }

  function handleRemove(id: string) {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (items.length === 0) {
      setItemsError("Adicione ao menos um serviço.");
      return;
    }

    createProposal.mutate(
      {
        contactId,
        sentDate,
        discountCents,
        notes: notes.trim() ? notes.trim() : null,
        items: items.map(({ serviceId, variantId, priceCents }) => ({ serviceId, variantId, priceCents })),
      },
      {
        onSuccess: () => {
          toast.success("Proposta enviada com sucesso.");
          onOpenChange(false);
        },
        onError: () => toast.error("Não foi possível enviar a proposta. Tente novamente."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nova proposta</DialogTitle>
          <DialogDescription>Monte os serviços e o desconto — o valor do contrato é calculado automaticamente.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5 sm:w-48">
            <Label htmlFor="proposta-data">Data de envio*</Label>
            <Input
              id="proposta-data"
              type="date"
              required
              value={sentDate}
              onChange={(event) => setSentDate(event.target.value)}
            />
          </div>

          <ServiceItemsEditor
            items={items}
            onAdd={handleAdd}
            onRemove={handleRemove}
            discountCents={discountCents}
            onDiscountChange={setDiscountCents}
          />
          {itemsError && <p className="text-sm text-destructive">{itemsError}</p>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proposta-notas">Notas</Label>
            <Textarea
              id="proposta-notas"
              rows={2}
              placeholder="Opcional"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createProposal.isPending}>
              Enviar proposta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Converter em evento" dialog: picks which accepted proposal to convert
 * (moot — and auto-selected — when there's only one), then the same
 * name/tipo/data/horário shape `NovoEventoDialog` collects for any other
 * event, prefilled from the lead itself. `useConvertLead`'s rejections are
 * the store's own pt-BR validation messages, surfaced verbatim.
 */
function ConvertLeadDialog({
  open,
  onOpenChange,
  contact,
  eventTypes,
  acceptedProposals,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
  eventTypes: EventType[];
  acceptedProposals: Proposal[];
  onConverted: (evento: Evento) => void;
}) {
  const convertLead = useConvertLead();
  const activeEventTypes = eventTypes.filter((type) => type.active);

  function defaultValues(): ConvertLeadValues {
    const interestType = contact.eventTypeId
      ? activeEventTypes.find((type) => type.id === contact.eventTypeId)
      : undefined;

    return {
      proposalId: acceptedProposals.length === 1 ? acceptedProposals[0].id : "",
      name: `${interestType?.name ?? "Evento"} ${contact.name}`.slice(0, 80),
      // Only ever prefilled from an ACTIVE type — a value that doesn't match
      // any rendered <SelectItem> is exactly what left other selects in this
      // app showing no text at all (see `lead-panel.tsx`'s own note on this).
      eventTypeId: interestType?.id ?? "",
      eventDate: "",
      eventTime: "",
    };
  }

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConvertLeadValues>({
    resolver: zodResolver(convertLeadSchema),
    defaultValues: defaultValues(),
  });

  // `defaultValues()` is a pure function of the props below — re-seeding is
  // only ever meant to happen when the dialog itself transitions to open
  // (deliberately keyed on just `open`), exactly like `AddServiceDialog`'s
  // own open-keyed reset.
  useEffect(() => {
    if (open) reset(defaultValues());
  }, [open]);

  function onSubmit(values: ConvertLeadValues) {
    convertLead.mutate(
      {
        contactId: contact.id,
        proposalId: values.proposalId,
        eventName: values.name.trim(),
        eventTypeId: values.eventTypeId,
        eventDate: values.eventDate,
        eventTime: values.eventTime === "" ? null : values.eventTime,
      },
      {
        onSuccess: (createdEvento) => {
          toast.success("Lead convertido! Evento criado.");
          onConverted(createdEvento);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Converter em evento</DialogTitle>
          <DialogDescription>Os serviços e o desconto da proposta escolhida são copiados para o novo evento.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="convert-proposta">Proposta*</Label>
            <Controller
              control={control}
              name="proposalId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="convert-proposta" className="w-full">
                    <SelectValue placeholder="Selecione a proposta" />
                  </SelectTrigger>
                  <SelectContent>
                    {acceptedProposals.map((proposal) => (
                      <ProposalOption key={proposal.id} proposal={proposal} />
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.proposalId && <p className="text-sm text-destructive">{errors.proposalId.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="convert-nome">Nome do evento*</Label>
            <Input id="convert-nome" maxLength={80} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="convert-tipo">Tipo*</Label>
            <Controller
              control={control}
              name="eventTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="convert-tipo" className="w-full">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEventTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.eventTypeId && <p className="text-sm text-destructive">{errors.eventTypeId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="convert-data">Data*</Label>
              <Input id="convert-data" type="date" {...register("eventDate")} />
              {errors.eventDate && <p className="text-sm text-destructive">{errors.eventDate.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="convert-horario">Horário</Label>
              <Input id="convert-horario" type="time" {...register("eventTime")} />
              <p className="text-xs text-muted-foreground">Pode definir depois</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={convertLead.isPending}>
              Converter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One `<SelectItem>` for the Proposta picker — its own `useProposalServices` call, so offering several accepted proposals never calls that hook in a loop. */
function ProposalOption({ proposal }: { proposal: Proposal }) {
  const { data: items } = useProposalServices(proposal.id);
  const totalCents = contractCents(items ?? [], proposal.discountCents);

  return (
    <SelectItem value={proposal.id}>
      {`Enviada em ${formatDate(proposal.sentDate)} · `}
      <Money cents={totalCents} />
    </SelectItem>
  );
}
