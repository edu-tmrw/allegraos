/**
 * "Novo evento" dialog: the minimal fields needed to create an `Evento` —
 * services/valores/pagamentos are all added later, on the event's own detail
 * page (Task 13+). Controlled from the parent (`EventosPage`) so both the
 * header button and the empty-state CTA can open the same dialog instance.
 */
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
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
import { useCreateEvent } from "@/data/hooks/use-events";
import { useEventTypes } from "@/data/hooks/use-settings";

const eventoSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do evento.").max(80, "Máximo de 80 caracteres."),
  eventTypeId: z.string().min(1, "Selecione o tipo de evento."),
  eventDate: z.string().min(1, "Selecione a data do evento."),
  eventTime: z.string(),
});

type EventoFormValues = z.infer<typeof eventoSchema>;

const DEFAULT_VALUES: EventoFormValues = { name: "", eventTypeId: "", eventDate: "", eventTime: "" };

export function NovoEventoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: eventTypes } = useEventTypes();
  const createEvent = useCreateEvent();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventoFormValues>({
    resolver: zodResolver(eventoSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Every field starts blank again the next time the dialog opens.
  useEffect(() => {
    if (!open) reset(DEFAULT_VALUES);
  }, [open, reset]);

  const activeEventTypes = (eventTypes ?? []).filter((type) => type.active);

  function onSubmit(values: EventoFormValues) {
    createEvent.mutate(
      {
        name: values.name,
        eventTypeId: values.eventTypeId,
        eventDate: values.eventDate,
        eventTime: values.eventTime === "" ? null : values.eventTime,
      },
      {
        onSuccess: (created) => {
          toast.success("Evento criado com sucesso.");
          onOpenChange(false);
          navigate(`/eventos/${created.id}`);
        },
        onError: () => {
          toast.error("Não foi possível criar o evento. Tente novamente.");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Novo evento</DialogTitle>
          <DialogDescription>
            Cadastre o essencial agora — serviços e valores entram depois, na página do evento.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="evento-nome">Nome*</Label>
            <Input id="evento-nome" maxLength={80} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="evento-tipo">Tipo*</Label>
            <Controller
              control={control}
              name="eventTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="evento-tipo" className="w-full">
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
              <Label htmlFor="evento-data">Data*</Label>
              <Input id="evento-data" type="date" {...register("eventDate")} />
              {errors.eventDate && <p className="text-sm text-destructive">{errors.eventDate.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evento-horario">Horário</Label>
              <Input id="evento-horario" type="time" {...register("eventTime")} />
              <p className="text-xs text-muted-foreground">Pode definir depois</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              Criar evento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
