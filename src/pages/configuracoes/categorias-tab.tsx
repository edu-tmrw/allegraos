import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
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
import { useCategories, useCreateCategory, useUpdateCategory } from "@/data/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { TransactionCategory } from "@/domain/types";
import { SettingsCard } from "@/pages/configuracoes/settings-card";
import { SettingsRow } from "@/pages/configuracoes/settings-row";

const schema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(60, "O nome pode ter até 60 caracteres."),
  kind: z.enum(["in", "out"]),
});
type FormValues = z.infer<typeof schema>;

/** Entrada -> text-positive, Saída -> text-negative, both with a matching soft background. */
function KindBadge({ kind }: { kind: TransactionCategory["kind"] }) {
  return (
    <Badge
      className={cn(
        "border-transparent",
        kind === "in" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
      )}
    >
      {kind === "in" ? "Entrada" : "Saída"}
    </Badge>
  );
}

/**
 * Categorias: name + kind (Entrada/Saída). `kind` can't change after
 * creation — simpler and safer than reclassifying transactions already
 * booked under it — so the select is disabled (not hidden, so the current
 * value stays visible) once a row is being edited.
 */
export function CategoriasTab() {
  const { data, isLoading } = useCategories();
  // Entradas antes de saídas — mais fácil de escanear que a ordem crua do store.
  const categories = [...(data ?? [])].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "in" ? -1 : 1));
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const [editing, setEditing] = useState<TransactionCategory | null>(null);
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", kind: "out" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", kind: "out" });
    setOpen(true);
  }

  function openEdit(category: TransactionCategory) {
    setEditing(category);
    form.reset({ name: category.name, kind: category.kind });
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setEditing(null);
      form.reset({ name: "", kind: "out" });
    }
  }

  function onSubmit(values: FormValues) {
    const name = values.name.trim();
    if (editing) {
      // kind is intentionally left out of the patch — it's read-only once created.
      updateMutation.mutate(
        { id: editing.id, patch: { name } },
        {
          onSuccess: () => {
            toast.success("Categoria salva!");
            handleOpenChange(false);
          },
        },
      );
    } else {
      createMutation.mutate(
        { name, kind: values.kind, active: true },
        {
          onSuccess: () => {
            toast.success("Categoria criada!");
            handleOpenChange(false);
          },
        },
      );
    }
  }

  return (
    <>
      <SettingsCard
        title="Categorias"
        description="Classificam entradas e saídas no financeiro."
        onAdd={openCreate}
        isLoading={isLoading}
        isEmpty={categories.length === 0}
        emptyMessage="Nenhuma categoria cadastrada ainda."
      >
        {categories.map((category) => (
          <SettingsRow
            key={category.id}
            active={category.active}
            onToggleActive={(active) => updateMutation.mutate({ id: category.id, patch: { active } })}
            toggleLabel={`${category.active ? "Inativar" : "Ativar"} ${category.name}`}
            onEdit={() => openEdit(category)}
            editLabel={`Editar ${category.name}`}
          >
            <span className={cn("truncate text-sm font-medium", !category.active && "text-muted-foreground")}>
              {category.name}
            </span>
            <KindBadge kind={category.kind} />
          </SettingsRow>
        ))}
      </SettingsCard>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {editing ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Altere o nome desta categoria."
                : "Cadastre uma nova categoria de entrada ou saída."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-name">Nome</Label>
              <Input id="category-name" maxLength={60} autoFocus {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-kind">Tipo</Label>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(editing)}>
                    <SelectTrigger id="category-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Entrada</SelectItem>
                      <SelectItem value="out">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {editing && (
                <p className="text-xs text-muted-foreground">Não é possível alterar o tipo após a criação.</p>
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
