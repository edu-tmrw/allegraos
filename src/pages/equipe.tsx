/**
 * Equipe: a deliberately light CRUD over the team roster (freelancers +
 * staff). Pay is free text on purpose — the spec keeps payroll unstructured
 * here; actual payments still flow through Financeiro by category. Inactive
 * members are never deleted, just toggled off and muted in place so past
 * events/history keep referring to a real name.
 */
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreateTeamMember, useTeamMembers, useUpdateTeamMember } from "@/data/hooks/use-team";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/lib/use-page-title";
import type { TeamMember } from "@/domain/types";

const teamMemberSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(80, "O nome pode ter até 80 caracteres."),
  phone: z.string().trim(),
  roleLabel: z.string().trim().min(1, "Informe a função.").max(40, "A função pode ter até 40 caracteres."),
  payNotes: z.string().trim().max(120, "A forma de pagamento pode ter até 120 caracteres."),
});

type TeamMemberFormValues = z.infer<typeof teamMemberSchema>;

const EMPTY_FORM_VALUES: TeamMemberFormValues = { name: "", phone: "", roleLabel: "", payNotes: "" };

/** `TeamMember`'s nullable fields become "" for the form; empty strings go back to `null` on submit (see `TeamMemberDialog.onSubmit`). */
function toFormValues(member: TeamMember): TeamMemberFormValues {
  return {
    name: member.name,
    phone: member.phone ?? "",
    roleLabel: member.roleLabel,
    payNotes: member.payNotes ?? "",
  };
}

/**
 * Create/edit dialog, RHF+zod. `member` is `null` for create, the row being
 * edited otherwise — this alone decides which mutation fires and whether the
 * form starts blank or prefilled (reset on every `open`, not just mount, so
 * the same mounted dialog can be reused for the next row clicked).
 */
function TeamMemberDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
}) {
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const form = useForm<TeamMemberFormValues>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(member ? toFormValues(member) : EMPTY_FORM_VALUES);
  }, [open, member, form]);

  function onSubmit(values: TeamMemberFormValues) {
    const patch = {
      name: values.name,
      phone: values.phone === "" ? null : values.phone,
      roleLabel: values.roleLabel,
      payNotes: values.payNotes === "" ? null : values.payNotes,
    };
    const onSuccess = () => {
      toast.success(member ? "Dados da pessoa atualizados." : "Pessoa adicionada à equipe.");
      onOpenChange(false);
    };

    if (member) {
      updateMember.mutate({ id: member.id, patch }, { onSuccess });
    } else {
      createMember.mutate({ ...patch, active: true }, { onSuccess });
    }
  }

  const pending = createMember.isPending || updateMember.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{member ? "Editar pessoa" : "Adicionar pessoa"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="equipe-name">Nome *</Label>
            <Input
              id="equipe-name"
              maxLength={80}
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="equipe-phone">Telefone</Label>
            <Input id="equipe-phone" placeholder="(31) 99999-0000" {...form.register("phone")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="equipe-role">Função *</Label>
            <Input
              id="equipe-role"
              maxLength={40}
              placeholder="Ex: Comercial, Freelancer cerimonial"
              aria-invalid={!!form.formState.errors.roleLabel}
              {...form.register("roleLabel")}
            />
            {form.formState.errors.roleLabel && (
              <p className="text-xs text-destructive">{form.formState.errors.roleLabel.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="equipe-pay">Forma de pagamento</Label>
            <Input id="equipe-pay" maxLength={120} {...form.register("payNotes")} />
            <p className="text-xs text-muted-foreground">Ex: R$ 100 por venda · R$ 260/mês</p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {member ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EquipeSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function EquipePage() {
  usePageTitle("Equipe");
  const { data: members } = useTeamMembers();
  const updateMember = useUpdateTeamMember();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  function handleAdd() {
    setEditingMember(null);
    setDialogOpen(true);
  }

  function handleEdit(member: TeamMember) {
    setEditingMember(member);
    setDialogOpen(true);
  }

  function handleToggleActive(member: TeamMember, active: boolean) {
    updateMember.mutate({ id: member.id, patch: { active } });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Equipe">
        <Button type="button" onClick={handleAdd}>
          <Plus className="size-4" />
          Adicionar pessoa
        </Button>
      </PageHeader>

      {!members ? (
        <EquipeSkeleton />
      ) : members.length === 0 ? (
        <EmptyState
          title="Nenhuma pessoa na equipe ainda."
          action={
            <Button type="button" onClick={handleAdd}>
              <Plus className="size-4" />
              Adicionar pessoa
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop md+: one table, name/função full-strength text that
              mutes with the rest of the row when inactive (no color class of
              their own — they inherit it); telefone/pagamento are always
              muted regardless of active state, per spec. */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Editar</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className={cn(!member.active && "text-muted-foreground")}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-muted-foreground">{member.phone ?? "—"}</TableCell>
                    <TableCell>{member.roleLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{member.payNotes ?? "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={member.active}
                        onCheckedChange={(checked) => handleToggleActive(member, checked)}
                        aria-label={`Ativa: ${member.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${member.name}`}
                        onClick={() => handleEdit(member)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile <md: cards — nome+função up top, telefone/pagamento as
              smaller muted lines, switch+edit share the footer row. */}
          <div className="space-y-3 md:hidden">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className={cn("space-y-3", !member.active && "text-muted-foreground")}>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.roleLabel}</p>
                  </div>
                  <div className="space-y-0.5 text-sm text-muted-foreground">
                    <p>{member.phone ?? "—"}</p>
                    <p>{member.payNotes ?? "—"}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={member.active}
                        onCheckedChange={(checked) => handleToggleActive(member, checked)}
                        aria-label={`Ativa: ${member.name}`}
                      />
                      <span className="text-sm text-muted-foreground">Ativa</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${member.name}`}
                      onClick={() => handleEdit(member)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <TeamMemberDialog open={dialogOpen} onOpenChange={setDialogOpen} member={editingMember} />
    </div>
  );
}
