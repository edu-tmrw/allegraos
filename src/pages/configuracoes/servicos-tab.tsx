import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/currency-input";
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
  useCreateService,
  useCreateServiceVariant,
  useServices,
  useServiceVariants,
  useUpdateService,
  useUpdateServiceVariant,
} from "@/data/hooks/use-settings";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service, ServiceVariant } from "@/domain/types";
import { SettingsCard } from "@/pages/configuracoes/settings-card";
import { SettingsRow } from "@/pages/configuracoes/settings-row";

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(60, "O nome pode ter até 60 caracteres."),
  // 0 doubles as "empty" (CurrencyInput's own convention) — a service's price is optional
  // when it varies by variant, so the schema only rules out negative cents.
  defaultPriceCents: z.number().int().min(0),
});
type ServiceFormValues = z.infer<typeof serviceSchema>;

const variantSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(60, "O nome pode ter até 60 caracteres."),
  defaultPriceCents: z.number().int().min(1, "Informe um preço."),
});
type VariantFormValues = z.infer<typeof variantSchema>;

/** Which dialog (if any) is open, and what it's editing — a service, or a variant of some service. */
type DialogState =
  | { kind: "service"; editing: Service | null }
  | { kind: "variant"; editing: ServiceVariant | null; serviceId: string };

/**
 * A service's price column: variants (when present) always win over its own
 * `defaultPriceCents` — that field is the fallback for services that don't
 * vary by variant at all, so a service with both set (shouldn't normally
 * happen, but isn't actively prevented) still reads as "por variação",
 * since that's the price sales actually pick from.
 */
function priceLabel(service: Service, variantCount: number): string {
  if (variantCount > 0) return "por variação";
  if (service.defaultPriceCents === null) return "—";
  return formatBRL(service.defaultPriceCents);
}

/**
 * Serviços & variações: the richest cadastro tab — each service row expands
 * to its own variant sub-list (its own mini CRUD, reusing `<SettingsRow>`
 * again one level down). A service's price column shows "por variação" the
 * moment it has ≥1 variant, regardless of what `defaultPriceCents` still
 * holds, so the catalog never shows two conflicting prices for the same
 * service at once.
 */
export function ServicosTab() {
  const { data: servicesData, isLoading } = useServices();
  const { data: variantsData } = useServiceVariants();
  const services = servicesData ?? [];
  const variants = variantsData ?? [];

  // Ativos primeiro, cada partição preservando sua ordem original — sort() é
  // estável, então isso é uma partição, não uma reordenação dentro de cada grupo.
  const orderedServices = [...services].sort((a, b) => Number(b.active) - Number(a.active));

  const createService = useCreateService();
  const updateService = useUpdateService();
  const createVariant = useCreateServiceVariant();
  const updateVariant = useUpdateServiceVariant();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const serviceForm = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: "", defaultPriceCents: 0 },
  });
  const variantForm = useForm<VariantFormValues>({
    resolver: zodResolver(variantSchema),
    defaultValues: { name: "", defaultPriceCents: 0 },
  });

  function variantsOf(serviceId: string): ServiceVariant[] {
    return variants.filter((variant) => variant.serviceId === serviceId);
  }

  function toggleExpanded(serviceId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  }

  function openCreateService() {
    serviceForm.reset({ name: "", defaultPriceCents: 0 });
    setDialog({ kind: "service", editing: null });
  }

  function openEditService(service: Service) {
    serviceForm.reset({ name: service.name, defaultPriceCents: service.defaultPriceCents ?? 0 });
    setDialog({ kind: "service", editing: service });
  }

  function openCreateVariant(serviceId: string) {
    variantForm.reset({ name: "", defaultPriceCents: 0 });
    setDialog({ kind: "variant", editing: null, serviceId });
  }

  function openEditVariant(variant: ServiceVariant) {
    variantForm.reset({ name: variant.name, defaultPriceCents: variant.defaultPriceCents });
    setDialog({ kind: "variant", editing: variant, serviceId: variant.serviceId });
  }

  function closeDialog() {
    setDialog(null);
    serviceForm.reset({ name: "", defaultPriceCents: 0 });
    variantForm.reset({ name: "", defaultPriceCents: 0 });
  }

  function onSubmitService(values: ServiceFormValues) {
    const name = values.name.trim();
    // Mesma convenção do CurrencyInput: 0 é "vazio", então também vira null aqui.
    const defaultPriceCents = values.defaultPriceCents === 0 ? null : values.defaultPriceCents;
    if (dialog?.kind === "service" && dialog.editing) {
      updateService.mutate(
        { id: dialog.editing.id, patch: { name, defaultPriceCents } },
        {
          onSuccess: () => {
            toast.success("Serviço salvo!");
            closeDialog();
          },
        },
      );
    } else {
      createService.mutate(
        { name, defaultPriceCents, active: true },
        {
          onSuccess: () => {
            toast.success("Serviço criado!");
            closeDialog();
          },
        },
      );
    }
  }

  function onSubmitVariant(values: VariantFormValues) {
    if (dialog?.kind !== "variant") return;
    const name = values.name.trim();
    if (dialog.editing) {
      updateVariant.mutate(
        { id: dialog.editing.id, patch: { name, defaultPriceCents: values.defaultPriceCents } },
        {
          onSuccess: () => {
            toast.success("Variação salva!");
            closeDialog();
          },
        },
      );
    } else {
      createVariant.mutate(
        { serviceId: dialog.serviceId, name, defaultPriceCents: values.defaultPriceCents, active: true },
        {
          onSuccess: () => {
            toast.success("Variação criada!");
            closeDialog();
          },
        },
      );
    }
  }

  const editingService = dialog?.kind === "service" ? dialog.editing : null;
  const editingServiceHasVariants = editingService ? variantsOf(editingService.id).length > 0 : false;
  const variantServiceName =
    dialog?.kind === "variant" ? services.find((s) => s.id === dialog.serviceId)?.name : undefined;

  return (
    <>
      <SettingsCard
        title="Serviços"
        description="Compõem eventos e propostas, com preço padrão ou por variação."
        addLabel="Adicionar serviço"
        onAdd={openCreateService}
        isLoading={isLoading}
        isEmpty={orderedServices.length === 0}
        emptyMessage="Nenhum serviço cadastrado ainda."
      >
        {orderedServices.map((service) => {
          const serviceVariants = variantsOf(service.id);
          const isExpanded = expandedIds.has(service.id);
          return (
            <div key={service.id} role="group" aria-label={service.name}>
              <SettingsRow
                active={service.active}
                onToggleActive={(active) => updateService.mutate({ id: service.id, patch: { active } })}
                toggleLabel={`${service.active ? "Inativar" : "Ativar"} ${service.name}`}
                onEdit={() => openEditService(service)}
                editLabel={`Editar ${service.name}`}
                leading={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggleExpanded(service.id)}
                    aria-label={`${isExpanded ? "Recolher" : "Expandir"} ${service.name}`}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </Button>
                }
              >
                <span
                  className={cn(
                    "min-w-0 truncate text-sm font-medium",
                    !service.active && "text-muted-foreground",
                  )}
                >
                  {service.name}
                </span>
                <span
                  className={cn(
                    "ml-auto shrink-0 text-sm tabular-nums whitespace-nowrap",
                    (serviceVariants.length > 0 || service.defaultPriceCents === null) && "text-muted-foreground",
                  )}
                >
                  {priceLabel(service, serviceVariants.length)}
                </span>
              </SettingsRow>

              {isExpanded && (
                <div className="ml-6 border-l border-border pb-3 pl-4">
                  {!service.active && serviceVariants.length > 0 && (
                    <p className="pt-3 text-xs text-muted-foreground">
                      As variações mantêm seu próprio status, mas nenhuma é oferecida enquanto o serviço estiver
                      inativo.
                    </p>
                  )}
                  {serviceVariants.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">Nenhuma variação cadastrada ainda.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {serviceVariants.map((variant) => (
                        <div key={variant.id} role="group" aria-label={variant.name}>
                          <SettingsRow
                            active={variant.active}
                            onToggleActive={(active) =>
                              updateVariant.mutate({ id: variant.id, patch: { active } })
                            }
                            toggleLabel={`${variant.active ? "Inativar" : "Ativar"} ${variant.name}`}
                            onEdit={() => openEditVariant(variant)}
                            editLabel={`Editar ${variant.name}`}
                          >
                            <span
                              className={cn(
                                "min-w-0 truncate text-sm",
                                !variant.active && "text-muted-foreground",
                              )}
                            >
                              {variant.name}
                            </span>
                            <span className="ml-auto shrink-0 text-sm tabular-nums whitespace-nowrap">
                              {formatBRL(variant.defaultPriceCents)}
                            </span>
                          </SettingsRow>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openCreateVariant(service.id)}
                    >
                      <Plus className="size-4" />
                      Adicionar variação
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </SettingsCard>

      <Dialog open={dialog?.kind === "service"} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {editingService ? "Editar serviço" : "Novo serviço"}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? "Altere o nome ou o preço padrão deste serviço."
                : "Cadastre um novo serviço do catálogo."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={serviceForm.handleSubmit(onSubmitService)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="service-name">Nome</Label>
              <Input id="service-name" maxLength={60} autoFocus {...serviceForm.register("name")} />
              {serviceForm.formState.errors.name && (
                <p className="text-sm text-destructive">{serviceForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="flex-col items-start gap-2">
                Preço padrão
                <Controller
                  control={serviceForm.control}
                  name="defaultPriceCents"
                  render={({ field }) => <CurrencyInput valueCents={field.value} onChangeCents={field.onChange} />}
                />
              </Label>
              <p className="text-xs text-muted-foreground">Deixe vazio se o preço depende da variação.</p>
              {editingServiceHasVariants && (
                <p className="text-xs text-muted-foreground">
                  Este serviço tem variações — o preço usado nas vendas vem da variação.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createService.isPending || updateService.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === "variant"} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {dialog?.kind === "variant" && dialog.editing ? "Editar variação" : "Nova variação"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === "variant" && dialog.editing
                ? `Altere o nome ou o preço desta variação${variantServiceName ? ` de ${variantServiceName}` : ""}.`
                : `Cadastre uma nova variação${variantServiceName ? ` para ${variantServiceName}` : ""}.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={variantForm.handleSubmit(onSubmitVariant)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="variant-name">Nome</Label>
              <Input id="variant-name" maxLength={60} autoFocus {...variantForm.register("name")} />
              {variantForm.formState.errors.name && (
                <p className="text-sm text-destructive">{variantForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="flex-col items-start gap-2">
                Preço
                <Controller
                  control={variantForm.control}
                  name="defaultPriceCents"
                  render={({ field }) => <CurrencyInput valueCents={field.value} onChangeCents={field.onChange} />}
                />
              </Label>
              {variantForm.formState.errors.defaultPriceCents && (
                <p className="text-sm text-destructive">{variantForm.formState.errors.defaultPriceCents.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createVariant.isPending || updateVariant.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
