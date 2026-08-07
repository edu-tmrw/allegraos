/**
 * "Editar evento" dialog: the same nome/tipo/data/horário fields and
 * validation as `NovoEventoDialog` (Task 12), but pre-filled from an
 * existing `Evento` and calling `useUpdateEvent` on submit instead of
 * creating a new row — no navigation on success, since we're already on
 * that event's own detail page.
 */
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateEvent } from "@/data/hooks/use-events";
import { useEventTypes } from "@/data/hooks/use-settings";
import type { Evento } from "@/domain/types";

const eventoSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do evento.").max(80, "Máximo de 80 caracteres."),
  eventTypeId: z.string().min(1, "Selecione o tipo de evento."),
  eventDate: z.string().min(1, "Selecione a data do evento."),
  eventTime: z.string(),
});

type EventoFormValues = z.infer<typeof eventoSchema>;

function valuesFor(evento: Evento): EventoFormValues {
  return {
    name: evento.name,
    eventTypeId: evento.eventTypeId,
    eventDate: evento.eventDate,
    eventTime: evento.eventTime ?? "",
  };
}

export function EditarEventoDialog({
  evento,
  open,
  onOpenChange,
}: {
  evento: Evento;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: eventTypes } = useEventTypes();
  const updateEvent = useUpdateEvent();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventoFormValues>({
    resolver: zodResolver(eventoSchema),
    defaultValues: valuesFor(evento),
  });

  // Re-seed from this event's *current* values every time the dialog opens.
  // `evento` is deliberately left out of the deps: reacting to it directly
  // would re-run this on every unrelated background refetch (e.g. another
  // mutation on the same page) and stomp on whatever the user is mid-typing
  // while the dialog is open.
  useEffect(() => {
    if (open) reset(valuesFor(evento));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The event's current type might have since been deactivated — keep it
  // selectable here even though it's filtered out of "Novo evento".
  const activeEventTypes = (eventTypes ?? []).filter(
    (type) => type.active || type.id === evento.eventTypeId,
  );

  function onSubmit(values: EventoFormValues) {
    updateEvent.mutate(
      {
        id: evento.id,
        patch: {
          name: values.name,
          eventTypeId: values.eventTypeId,
          eventDate: values.eventDate,
          eventTime: values.eventTime === "" ? null : values.eventTime,
        },
      },
      {
        onSuccess: () => {
          toast.success("Evento atualizado.");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Não foi possível atualizar o evento. Tente novamente.");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Editar evento</DialogTitle>
          <DialogDescription>
            Altere o essencial do evento — serviços e lançamentos ficam nas seções abaixo.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-evento-nome">Nome*</Label>
            <Input id="editar-evento-nome" maxLength={80} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-evento-tipo">Tipo*</Label>
            <Controller
              control={control}
              name="eventTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="editar-evento-tipo" className="w-full">
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
              <Label htmlFor="editar-evento-data">Data*</Label>
              <Input id="editar-evento-data" type="date" {...register("eventDate")} />
              {errors.eventDate && <p className="text-sm text-destructive">{errors.eventDate.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editar-evento-horario">Horário</Label>
              <Input id="editar-evento-horario" type="time" {...register("eventTime")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateEvent.isPending}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
