import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { useCreateEventType, useEventTypes, useUpdateEventType } from "@/data/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { EventType } from "@/domain/types";
import { SettingsCard } from "@/pages/configuracoes/settings-card";
import { SettingsRow } from "@/pages/configuracoes/settings-row";

const schema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(60, "O nome pode ter até 60 caracteres."),
});
type FormValues = z.infer<typeof schema>;

/** Tipos de evento: the simplest cadastro — just a name list, no extra fields. */
export function TiposEventoTab() {
  const { data, isLoading } = useEventTypes();
  const eventTypes = data ?? [];
  const createMutation = useCreateEventType();
  const updateMutation = useUpdateEventType();

  const [editing, setEditing] = useState<EventType | null>(null);
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "" });
    setOpen(true);
  }

  function openEdit(eventType: EventType) {
    setEditing(eventType);
    form.reset({ name: eventType.name });
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setEditing(null);
      form.reset({ name: "" });
    }
  }

  function onSubmit(values: FormValues) {
    const name = values.name.trim();
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, patch: { name } },
        {
          onSuccess: () => {
            toast.success("Tipo de evento salvo!");
            handleOpenChange(false);
          },
        },
      );
    } else {
      createMutation.mutate(
        { name, active: true },
        {
          onSuccess: () => {
            toast.success("Tipo de evento criado!");
            handleOpenChange(false);
          },
        },
      );
    }
  }

  return (
    <>
      <SettingsCard
        title="Tipos de evento"
        description="Usados ao cadastrar um evento ou lead."
        onAdd={openCreate}
        isLoading={isLoading}
        isEmpty={eventTypes.length === 0}
        emptyMessage="Nenhum tipo cadastrado ainda."
      >
        {eventTypes.map((eventType) => (
          <SettingsRow
            key={eventType.id}
            active={eventType.active}
            onToggleActive={(active) => updateMutation.mutate({ id: eventType.id, patch: { active } })}
            toggleLabel={`${eventType.active ? "Inativar" : "Ativar"} ${eventType.name}`}
            onEdit={() => openEdit(eventType)}
            editLabel={`Editar ${eventType.name}`}
          >
            <span className={cn("truncate text-sm font-medium", !eventType.active && "text-muted-foreground")}>
              {eventType.name}
            </span>
          </SettingsRow>
        ))}
      </SettingsCard>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {editing ? "Editar tipo de evento" : "Novo tipo de evento"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Altere o nome deste tipo de evento."
                : "Cadastre um novo tipo para usar em eventos e leads."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-type-name">Nome</Label>
              <Input id="event-type-name" maxLength={60} autoFocus {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
