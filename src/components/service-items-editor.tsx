/**
 * SHARED line-items editor: an event's contracted services today
 * (`detalhe-servicos.tsx`), a proposal's items tomorrow (Task 20). This
 * component's props ARE the contract between the two features — the
 * proposals team consumes it verbatim — so `ServiceItemDraft`/`ServiceItemRow`
 * and the prop names below are LAW, not just this task's convenience shape.
 *
 * Design: data-aware only for its own catalog reads (`useServices`/
 * `useServiceVariants` — "which services/variants exist, and are they
 * active") since every caller needs that same lookup. Everything about the
 * caller's own entity (which items it has, its discount, how to persist a
 * change) flows through props instead, so this component never needs to
 * know whether it's editing an event or a proposal.
 *
 * "Fechado em" only ever exists for event items (`EventService.createdAt`);
 * `ProposalService` has no such field, so `ServiceItemRow.createdAt` is
 * optional and the column is rendered only when at least one row actually
 * carries it — for proposals every row will omit it, so the column simply
 * never appears there.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyInput } from "@/components/currency-input";
import { Money } from "@/components/money";
import { useServices, useServiceVariants } from "@/data/hooks/use-settings";
import { contractCents } from "@/domain/calc";
import type { Service, ServiceVariant } from "@/domain/types";
import { formatDate } from "@/lib/format";

export interface ServiceItemDraft {
  serviceId: string;
  variantId: string | null;
  priceCents: number;
}

export interface ServiceItemRow extends ServiceItemDraft {
  id: string;
  createdAt?: string;
}

type AddErrors = { service?: string; variant?: string; price?: string };

/**
 * The "Adicionar serviço" dialog: picks an active service, a required
 * active variant when the service has any, and a price prefilled from the
 * catalog (variant's own default when a variant is chosen, else the
 * service's — see `Service.defaultPriceCents`'s own doc comment on why a
 * variant-priced service's default is `null`) but always freely editable
 * afterward.
 */
function AddServiceDialog({
  services,
  activeVariants,
  onAdd,
}: {
  services: Service[];
  activeVariants: ServiceVariant[];
  onAdd: (item: ServiceItemDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [priceCents, setPriceCents] = useState(0);
  const [errors, setErrors] = useState<AddErrors>({});

  // Every field starts blank again the next time the dialog opens — mirrors
  // `NovoEventoDialog`'s reset-on-close (`useEffect(() => { if (!open) ... },
  // [open])`), just keyed on `open` becoming true instead: there's no form
  // library here to `reset()`, so re-seeding the raw `useState`s directly.
  useEffect(() => {
    if (open) {
      setServiceId("");
      setVariantId(null);
      setPriceCents(0);
      setErrors({});
    }
  }, [open]);

  const variantsForSelected = activeVariants.filter((variant) => variant.serviceId === serviceId);
  const hasVariants = variantsForSelected.length > 0;

  function handleServiceChange(nextServiceId: string) {
    setServiceId(nextServiceId);
    setVariantId(null);
    const service = services.find((candidate) => candidate.id === nextServiceId);
    setPriceCents(service?.defaultPriceCents ?? 0);
    setErrors({});
  }

  function handleVariantChange(nextVariantId: string) {
    setVariantId(nextVariantId);
    const variant = variantsForSelected.find((candidate) => candidate.id === nextVariantId);
    setPriceCents(variant?.defaultPriceCents ?? 0);
    setErrors((previous) => ({ ...previous, variant: undefined, price: undefined }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors: AddErrors = {};
    if (!serviceId) nextErrors.service = "Selecione o serviço.";
    if (serviceId && hasVariants && !variantId) nextErrors.variant = "Selecione a variação.";
    if (priceCents <= 0) nextErrors.price = "Informe um valor maior que zero.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onAdd({ serviceId, variantId, priceCents });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="size-4" />
          Adicionar serviço
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Adicionar serviço</DialogTitle>
          <DialogDescription>O valor vem do catálogo e pode ser ajustado livremente.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="service-items-add-servico">Serviço*</Label>
            <Select value={serviceId} onValueChange={handleServiceChange}>
              <SelectTrigger id="service-items-add-servico" className="w-full">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.service && <p className="text-sm text-destructive">{errors.service}</p>}
          </div>

          {hasVariants && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="service-items-add-variacao">Variação*</Label>
              <Select value={variantId ?? ""} onValueChange={handleVariantChange}>
                <SelectTrigger id="service-items-add-variacao" className="w-full">
                  <SelectValue placeholder="Selecione a variação" />
                </SelectTrigger>
                <SelectContent>
                  {variantsForSelected.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.variant && <p className="text-sm text-destructive">{errors.variant}</p>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="service-items-add-valor">Valor*</Label>
            <CurrencyInput
              id="service-items-add-valor"
              valueCents={priceCents}
              onChangeCents={(cents) => {
                setPriceCents(cents);
                setErrors((previous) => ({ ...previous, price: undefined }));
              }}
              placeholder="0,00"
            />
            {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Adicionar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One item row: name/variation/price/[fechado em]/[remove, confirm via AlertDialog]. */
function ItemRow({
  item,
  serviceName,
  variantName,
  showClosedAt,
  readOnly,
  onRemove,
}: {
  item: ServiceItemRow;
  serviceName: string;
  variantName: string | null;
  showClosedAt: boolean;
  readOnly: boolean;
  onRemove: (id: string) => void;
}) {
  // Two rows can share a service (e.g. an event with both an Orquestra/Trio
  // and an Orquestra/Sexteto item) — folding the variant into the label
  // keeps every remove button's accessible name unique, not just its visible
  // icon.
  const fullName = variantName ? `${serviceName} — ${variantName}` : serviceName;

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{serviceName}</TableCell>
      <TableCell className="text-muted-foreground">{variantName ?? "—"}</TableCell>
      <TableCell className="text-right">
        <Money cents={item.priceCents} />
      </TableCell>
      {showClosedAt && (
        <TableCell className="text-muted-foreground">
          {item.createdAt ? formatDate(item.createdAt) : "—"}
        </TableCell>
      )}
      {!readOnly && (
        <TableCell>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${fullName}`}>
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover serviço?</AlertDialogTitle>
                <AlertDialogDescription>
                  Remover "{fullName}" da lista? Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => onRemove(item.id)}>
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TableCell>
      )}
    </TableRow>
  );
}

export function ServiceItemsEditor({
  items,
  onAdd,
  onRemove,
  discountCents,
  onDiscountChange,
  readOnly = false,
}: {
  items: ServiceItemRow[];
  onAdd: (item: ServiceItemDraft) => void;
  onRemove: (id: string) => void;
  discountCents: number;
  onDiscountChange: (cents: number) => void;
  readOnly?: boolean;
}) {
  const { data: services } = useServices();
  const { data: variants } = useServiceVariants();

  // The discount field is a local draft, committed explicitly via "Aplicar"
  // rather than on every keystroke (documented choice — see the render
  // below): `onDiscountChange` is the caller's own mutation, and firing it
  // per keystroke would mean one persisted write per digit typed. Re-synced
  // whenever the committed prop itself changes (our own commit's refetch
  // landing, or a different item set entirely) — mirrors `detalhe.tsx`'s
  // `notesDraft` pattern.
  const [discountDraft, setDiscountDraft] = useState(discountCents);
  useEffect(() => {
    setDiscountDraft(discountCents);
  }, [discountCents]);

  const allServices = services ?? [];
  const allVariants = variants ?? [];
  const activeServices = allServices.filter((service) => service.active);
  const activeVariants = allVariants.filter((variant) => variant.active);

  const servicesById = new Map(allServices.map((service) => [service.id, service]));
  const variantsById = new Map(allVariants.map((variant) => [variant.id, variant]));

  const showClosedAt = items.some((item) => item.createdAt !== undefined);
  const itemsTotalCents = items.reduce((sum, item) => sum + item.priceCents, 0);
  // Same clamped-at-0 math the rest of the app uses for a contract value —
  // reused directly from the domain layer rather than re-derived here, so
  // this can never silently drift from `useEventFinancials`'s own number.
  const contractTotalCents = contractCents(items, discountCents);

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
        <div className="flex justify-end">
          <AddServiceDialog services={activeServices} activeVariants={activeVariants} onAdd={onAdd} />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-muted-foreground">Nenhum serviço adicionado ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead>Variação</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              {showClosedAt && <TableHead>Fechado em</TableHead>}
              {!readOnly && (
                <TableHead className="w-10">
                  <span className="sr-only">Remover</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                serviceName={servicesById.get(item.serviceId)?.name ?? ""}
                variantName={item.variantId ? variantsById.get(item.variantId)?.name ?? "—" : null}
                showClosedAt={showClosedAt}
                readOnly={readOnly}
                onRemove={onRemove}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-col gap-2 border-t pt-4 text-sm sm:w-72 sm:self-end">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Soma dos serviços</span>
          <Money cents={itemsTotalCents} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="service-items-desconto" className="text-muted-foreground">
            Desconto
          </Label>
          {readOnly ? (
            <Money cents={discountCents} />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-28">
                <CurrencyInput
                  id="service-items-desconto"
                  valueCents={discountDraft}
                  onChangeCents={setDiscountDraft}
                  placeholder="0,00"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={discountDraft === discountCents}
                onClick={() => onDiscountChange(discountDraft)}
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-2">
          <span className="font-medium text-foreground">Valor do contrato</span>
          <span data-testid="valor-do-contrato">
            <Money cents={contractTotalCents} className="font-serif text-xl" />
          </span>
        </div>
      </div>
    </div>
  );
}
