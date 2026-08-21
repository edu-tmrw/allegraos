import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/data/auth";
import {
  useCreateProfile,
  useCreateRole,
  useProfiles,
  useRoles,
  useUpdateProfile,
  useUpdateRole,
} from "@/data/hooks/use-access";
import { cn } from "@/lib/utils";
import type { Profile, Role } from "@/domain/types";
import { SettingsCard } from "@/pages/configuracoes/settings-card";
import { SettingsRow } from "@/pages/configuracoes/settings-row";

const profileSchema = z.object({
  email: z.string().trim().email("Informe um email válido.").max(254, "O email pode ter até 254 caracteres."),
  name: z.string().trim().min(1, "Informe um nome.").max(80, "O nome pode ter até 80 caracteres."),
  roleId: z.string().min(1, "Selecione um papel."),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const roleSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(40, "O nome pode ter até 40 caracteres."),
  manageFinance: z.boolean(),
  manageEvents: z.boolean(),
  manageCrm: z.boolean(),
  manageTeam: z.boolean(),
  manageSettings: z.boolean(),
});
type RoleFormValues = z.infer<typeof roleSchema>;

/** The 5 boolean gates on `Role`, in display order, with the short pt-BR labels the brief calls for. */
type PermField = "manageFinance" | "manageEvents" | "manageCrm" | "manageTeam" | "manageSettings";
const PERM_FIELDS: { field: PermField; label: string }[] = [
  { field: "manageFinance", label: "Financeiro" },
  { field: "manageEvents", label: "Eventos" },
  { field: "manageCrm", label: "CRM" },
  { field: "manageTeam", label: "Equipe" },
  { field: "manageSettings", label: "Configurações" },
];

/** A single-field `Role` patch — a computed `{ [field]: checked }` literal can't narrow past `Record<PermField, boolean>`, which isn't assignable to `Partial<Role>` (`name` is a `string`), so this switches explicitly instead of casting. */
function permPatch(field: PermField, checked: boolean): Partial<Role> {
  switch (field) {
    case "manageFinance":
      return { manageFinance: checked };
    case "manageEvents":
      return { manageEvents: checked };
    case "manageCrm":
      return { manageCrm: checked };
    case "manageTeam":
      return { manageTeam: checked };
    case "manageSettings":
      return { manageSettings: checked };
  }
}

const EMPTY_ROLE_FORM: RoleFormValues = {
  name: "",
  manageFinance: false,
  manageEvents: false,
  manageCrm: false,
  manageTeam: false,
  manageSettings: false,
};

/**
 * Usuárias & papéis: profiles (app users) and roles (RBAC). New users are
 * invited by email through the protected `invite-user` Edge Function.
 *
 * Two independent guards protect against locking everyone (or yourself) out
 * of Configurações:
 *  - Usuárias: the signed-in profile can't inactivate itself, nor reassign
 *    itself to a role that lacks `manageSettings` — both are self-only
 *    checks against `useAuth()`'s current profile.
 *  - Papéis: a role's `manageSettings` switch can't be turned off if it's
 *    the *only* `manageSettings` role currently used by an active profile —
 *    otherwise every active profile would lose access to this very screen.
 */
export function UsuariasTab() {
  const { user } = useAuth();
  const { data: profilesData, isLoading: profilesLoading } = useProfiles();
  const { data: rolesData, isLoading: rolesLoading } = useRoles();
  const profiles = profilesData ?? [];
  const roles = rolesData ?? [];

  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { email: "", name: "", roleId: "" },
  });
  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: EMPTY_ROLE_FORM,
  });

  function isSelf(profile: Profile): boolean {
    return profile.userId === user?.profile.userId;
  }

  // ---- Usuárias -------------------------------------------------------------

  function openCreateProfile() {
    profileForm.reset({ email: "", name: "", roleId: "" });
    setProfileDialogOpen(true);
  }

  function handleProfileDialogChange(next: boolean) {
    setProfileDialogOpen(next);
    if (!next) profileForm.reset({ email: "", name: "", roleId: "" });
  }

  function onSubmitProfile(values: ProfileFormValues) {
    createProfile.mutate(
      { email: values.email.trim(), name: values.name.trim(), roleId: values.roleId },
      {
        onSuccess: () => {
          toast.success("Convite enviado!");
          handleProfileDialogChange(false);
        },
      },
    );
  }

  function handleToggleActive(profile: Profile, active: boolean) {
    if (!active && isSelf(profile)) {
      toast.error("Você não pode inativar a si mesma");
      return;
    }
    updateProfile.mutate({ userId: profile.userId, patch: { active } });
  }

  function handleRoleChange(profile: Profile, roleId: string) {
    if (isSelf(profile)) {
      const nextRole = roles.find((role) => role.id === roleId);
      if (nextRole && !nextRole.manageSettings) {
        toast.error("Você não pode remover sua própria permissão de configurações");
        return;
      }
    }
    updateProfile.mutate({ userId: profile.userId, patch: { roleId } });
  }

  // ---- Papéis ----------------------------------------------------------------

  function openCreateRole() {
    roleForm.reset(EMPTY_ROLE_FORM);
    setRoleDialogOpen(true);
  }

  function handleRoleDialogChange(next: boolean) {
    setRoleDialogOpen(next);
    if (!next) roleForm.reset(EMPTY_ROLE_FORM);
  }

  function onSubmitRole(values: RoleFormValues) {
    createRole.mutate(
      {
        name: values.name.trim(),
        manageFinance: values.manageFinance,
        manageEvents: values.manageEvents,
        manageCrm: values.manageCrm,
        manageTeam: values.manageTeam,
        manageSettings: values.manageSettings,
      },
      {
        onSuccess: () => {
          toast.success("Papel criado!");
          handleRoleDialogChange(false);
        },
      },
    );
  }

  /** True iff `roleId` is the only `manageSettings` role any active profile currently uses — turning it off would leave nobody able to reach this screen. */
  function wouldLockOutSettings(roleId: string): boolean {
    const activeRoleIds = new Set(profiles.filter((profile) => profile.active).map((profile) => profile.roleId));
    const settingsCapableActiveRoles = roles.filter((role) => activeRoleIds.has(role.id) && role.manageSettings);
    return settingsCapableActiveRoles.length === 1 && settingsCapableActiveRoles[0].id === roleId;
  }

  function handlePermToggle(role: Role, field: PermField, checked: boolean) {
    if (field === "manageSettings" && !checked && wouldLockOutSettings(role.id)) {
      toast.error("Algum papel ativo precisa manter Configurações");
      return;
    }
    updateRole.mutate({ id: role.id, patch: permPatch(field, checked) });
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard
        title="Usuárias"
        description="Quem acessa o AllegraOS e com qual papel."
        addLabel="Adicionar usuária"
        onAdd={openCreateProfile}
        isLoading={profilesLoading || rolesLoading}
        isEmpty={profiles.length === 0}
        emptyMessage="Nenhuma usuária cadastrada ainda."
        footer={
          <p className="text-xs text-muted-foreground">
            A usuária receberá por email um link seguro para definir o acesso.
          </p>
        }
      >
        {profiles.map((profile) => (
          <SettingsRow
            key={profile.userId}
            active={profile.active}
            onToggleActive={(active) => handleToggleActive(profile, active)}
            toggleLabel={`${profile.active ? "Inativar" : "Ativar"} ${profile.name}`}
          >
            <span className="flex min-w-0 flex-1 items-baseline gap-1">
              <span
                className={cn(
                  "min-w-0 truncate text-sm font-medium",
                  !profile.active && "text-muted-foreground",
                )}
              >
                {profile.name}
              </span>
              {isSelf(profile) && (
                <span className="shrink-0 text-xs text-muted-foreground">(você)</span>
              )}
            </span>
            <Select value={profile.roleId} onValueChange={(roleId) => handleRoleChange(profile, roleId)}>
              <SelectTrigger size="sm" className="w-36 shrink-0" aria-label={`Papel de ${profile.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        ))}
      </SettingsCard>

      <SettingsCard
        title="Papéis"
        description="Cada papel controla o acesso às áreas do sistema."
        addLabel="Novo papel"
        onAdd={openCreateRole}
        isLoading={rolesLoading}
        isEmpty={roles.length === 0}
        emptyMessage="Nenhum papel cadastrado ainda."
      >
        {roles.map((role) => (
          <div key={role.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-sm font-medium text-foreground">{role.name}</span>
            <div className="grid grid-cols-5 gap-2 sm:gap-4">
              {PERM_FIELDS.map(({ field, label }) => (
                <div key={field} className="flex flex-col items-center gap-1.5">
                  <span className="text-center text-[11px] leading-tight break-words text-muted-foreground">
                    {label}
                  </span>
                  <Switch
                    checked={role[field]}
                    onCheckedChange={(checked) => handlePermToggle(role, field, checked)}
                    aria-label={`${label} de ${role.name}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </SettingsCard>

      <Dialog open={profileDialogOpen} onOpenChange={handleProfileDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Nova usuária</DialogTitle>
            <DialogDescription>Envie um convite e escolha o papel que a usuária vai usar.</DialogDescription>
          </DialogHeader>
          <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                autoFocus
                {...profileForm.register("email")}
              />
              {profileForm.formState.errors.email && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-name">Nome</Label>
              <Input id="profile-name" maxLength={80} autoComplete="name" {...profileForm.register("name")} />
              {profileForm.formState.errors.name && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-role">Papel</Label>
              <Controller
                control={profileForm.control}
                name="roleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="profile-role" className="w-full">
                      <SelectValue placeholder="Selecione um papel" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {profileForm.formState.errors.roleId && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.roleId.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createProfile.isPending}>
                {createProfile.isPending ? "Enviando…" : "Enviar convite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialogOpen} onOpenChange={handleRoleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Novo papel</DialogTitle>
            <DialogDescription>Defina o nome e as permissões deste papel.</DialogDescription>
          </DialogHeader>
          <form onSubmit={roleForm.handleSubmit(onSubmitRole)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">Nome</Label>
              <Input id="role-name" maxLength={40} autoFocus {...roleForm.register("name")} />
              {roleForm.formState.errors.name && (
                <p className="text-sm text-destructive">{roleForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Permissões</Label>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {PERM_FIELDS.map(({ field, label }) => (
                  <div
                    key={field}
                    className="flex flex-col items-center gap-1.5 rounded-md border border-border p-2 text-center"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <Controller
                      control={roleForm.control}
                      name={field}
                      render={({ field: controllerField }) => (
                        <Switch
                          checked={controllerField.value}
                          onCheckedChange={controllerField.onChange}
                          aria-label={`${label} do novo papel`}
                        />
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createRole.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
