import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import {
  useCanInactivateStage,
  useCreateStage,
  useReorderStages,
  useStages,
  useUpdateStage,
} from "@/data/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/domain/types";
import { SettingsCard } from "@/pages/configuracoes/settings-card";
import { SettingsRow } from "@/pages/configuracoes/settings-row";

const schema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(60, "O nome pode ter até 60 caracteres."),
});
type FormValues = z.infer<typeof schema>;

/**
 * Etapas do funil: ordered rows (position drives the CRM's kanban column
 * order) with ↑/↓ reordering, plus the one guarded mutation on this whole
 * page — inactivating a stage that still holds a non-archived lead is
 * refused with a toast rather than silently orphaning that lead's column.
 */
export function EtapasTab() {
  const { data, isLoading } = useStages();
  const stages = data ?? [];
  const createMutation = useCreateStage();
  const updateMutation = useUpdateStage();
  const reorderMutation = useReorderStages();
  const canInactivate = useCanInactivateStage();

  const [editing, setEditing] = useState<PipelineStage | null>(null);
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

  function openEdit(stage: PipelineStage) {
    setEditing(stage);
    form.reset({ name: stage.name });
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
            toast.success("Etapa salva!");
            handleOpenChange(false);
          },
        },
      );
    } else {
      // Novas etapas entram ao final da ordem atual (posição = maior + 1).
      const nextPosition = stages.reduce((max, stage) => Math.max(max, stage.position), 0) + 1;
      createMutation.mutate(
        { name, position: nextPosition, active: true },
        {
          onSuccess: () => {
            toast.success("Etapa criada!");
            handleOpenChange(false);
          },
        },
      );
    }
  }

  function handleToggleActive(stage: PipelineStage, active: boolean) {
    if (!active && !canInactivate(stage.id)) {
      toast.error("Mova os leads desta etapa antes de inativá-la");
      return;
    }
    updateMutation.mutate({ id: stage.id, patch: { active } });
  }

  /** Swaps `index` with its neighbor in `direction` and persists the full new order. */
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const orderedIds = stages.map((stage) => stage.id);
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
    reorderMutation.mutate(orderedIds);
  }

  return (
    <>
      <SettingsCard
        title="Etapas do funil"
        description="A ordem das etapas define a ordem das colunas no funil do CRM."
        onAdd={openCreate}
        isLoading={isLoading}
        isEmpty={stages.length === 0}
        emptyMessage="Nenhuma etapa cadastrada ainda."
      >
        {stages.map((stage, index) => (
          <SettingsRow
            key={stage.id}
            active={stage.active}
            onToggleActive={(active) => handleToggleActive(stage, active)}
            toggleLabel={`${stage.active ? "Inativar" : "Ativar"} ${stage.name}`}
            onEdit={() => openEdit(stage)}
            editLabel={`Editar ${stage.name}`}
            leading={
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Mover ${stage.name} para cima`}
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={index === stages.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Mover ${stage.name} para baixo`}
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </>
            }
          >
            <span className={cn("truncate text-sm font-medium", !stage.active && "text-muted-foreground")}>
              {stage.name}
            </span>
          </SettingsRow>
        ))}
      </SettingsCard>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{editing ? "Editar etapa" : "Nova etapa"}</DialogTitle>
            <DialogDescription>
              {editing ? "Altere o nome desta etapa." : "A etapa entra ao final da ordem atual."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="stage-name">Nome</Label>
              <Input id="stage-name" maxLength={60} autoFocus {...form.register("name")} />
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
