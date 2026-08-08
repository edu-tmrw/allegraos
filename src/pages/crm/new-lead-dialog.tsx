import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateContact } from "@/data/hooks/use-crm";
import type { EventType, PipelineStage } from "@/domain/types";

/** Sentinel for "Interesse" left unset — Radix `<Select.Item>` can't take an empty-string value. */
const NONE_EVENT_TYPE = "none";

const leadSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(80, "Máximo de 80 caracteres."),
  phone: z.string().trim().max(30, "Telefone muito longo."),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\S+@\S+\.\S+$/.test(value), { message: "E-mail inválido." }),
  eventTypeId: z.string(),
  stageId: z.string().min(1, "Selecione uma etapa."),
});

type LeadFormValues = z.infer<typeof leadSchema>;

function emptyValues(defaultStageId: string): LeadFormValues {
  return { name: "", phone: "", email: "", eventTypeId: NONE_EVENT_TYPE, stageId: defaultStageId };
}

/**
 * "Novo lead" dialog. Fully controlled (`open`/`onOpenChange`) so the page
 * can trigger it both from the header button and from the "sem leads"
 * empty-state CTA without mounting two independent dialogs. `stages` and
 * `eventTypes` are expected pre-filtered to active-only by the caller —
 * the default stage is simply the first one, matching the pipeline's own
 * `position` order.
 */
export function NewLeadDialog({
  open,
  onOpenChange,
  stages,
  eventTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStage[];
  eventTypes: EventType[];
}) {
  const createContact = useCreateContact();
  const defaultStageId = stages[0]?.id ?? "";

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: emptyValues(defaultStageId),
  });

  // `open` can flip to `true` from outside Radix's own control (the header
  // button and the empty-state CTA both just flip this component's `open`
  // prop directly, there's no `<DialogTrigger>`), so re-seeding the form
  // has to watch the prop itself rather than piggyback on `onOpenChange` —
  // that callback only fires for changes Radix itself detects (Escape,
  // overlay click, its own trigger), never for an externally-driven open.
  useEffect(() => {
    if (open) reset(emptyValues(defaultStageId));
  }, [open, defaultStageId, reset]);

  function onSubmit(values: LeadFormValues) {
    createContact.mutate(
      {
        name: values.name.trim(),
        phone: values.phone.trim() ? values.phone.trim() : null,
        email: values.email.trim() ? values.email.trim() : null,
        eventTypeId: values.eventTypeId === NONE_EVENT_TYPE ? null : values.eventTypeId,
        stageId: values.stageId,
        notes: null,
      },
      {
        onSuccess: () => {
          toast.success("Lead criado com sucesso.");
          onOpenChange(false);
        },
        onError: () => toast.error("Não foi possível criar o lead."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Novo lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Nome</Label>
            <Input id="lead-name" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-phone">Telefone</Label>
            <Input id="lead-phone" {...register("phone")} aria-invalid={!!errors.phone} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            {/*
              Deliberately not type="email": the browser's own native
              constraint validation would race Zod's, and — worse — block
              `requestSubmit()`/a real click's default action silently
              (no submit event at all) whenever it disagrees with Zod,
              with no visible feedback. Zod is the single source of truth.
            */}
            <Input id="lead-email" {...register("email")} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-event-type">Interesse</Label>
            <Controller
              control={control}
              name="eventTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="lead-event-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_EVENT_TYPE}>Sem interesse definido</SelectItem>
                    {eventTypes.map((type) => (
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
            <Label htmlFor="lead-stage">Etapa</Label>
            <Controller
              control={control}
              name="stageId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="lead-stage" className="w-full" aria-invalid={!!errors.stageId}>
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
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

          <DialogFooter>
            <Button type="submit" disabled={createContact.isPending}>
              Criar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
