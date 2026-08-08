/**
 * SHARED transaction (entrada/saída) create+edit dialog: an event's own
 * lançamentos today (`detalhe-lancamentos.tsx`), the whole ledger's "Novo
 * lançamento" tomorrow (Task 16's Financeiro, with the event selector
 * unlocked). This component's props ARE the contract between the two
 * features — Financeiro consumes it verbatim — so the signature below is
 * LAW, not just this task's convenience shape.
 *
 * `defaultEventId`/`lockEvent` together describe the three shapes the same
 * dialog can take:
 *   - `lockEvent: true` — an event's own detail page: the event can't be
 *     changed, shown as a static line instead of a `<Select>` (still a real
 *     `eventId` in the submitted payload, carried via a hidden field).
 *   - `lockEvent` unset/false, `defaultEventId` set — Financeiro opening
 *     "Novo lançamento" while already scoped to one event: the `<Select>`
 *     is visible and starts on that event, but the user can change it.
 *   - `lockEvent` unset/false, `defaultEventId` null/undefined — Financeiro
 *     opening "Novo lançamento" with no scope: starts on "Administração
 *     central".
 *
 * `transaction` present switches the whole dialog into edit mode: every
 * field prefills from it and submit calls `useUpdateTransaction` instead of
 * `useCreateTransaction` — the fields/validation don't otherwise differ
 * between the two modes.
 */
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { CurrencyInput } from "@/components/currency-input";
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
import { Textarea } from "@/components/ui/textarea";
import { useEvent, useEvents } from "@/data/hooks/use-events";
import { useCategories } from "@/data/hooks/use-settings";
import { useCreateTransaction, useUpdateTransaction } from "@/data/hooks/use-transactions";
import type { Transaction, TransactionCategory } from "@/domain/types";
import { todayISO } from "@/lib/format";

/**
 * Sentinel `eventId` form value for "administração central" (no event) —
 * Radix's `<Select.Item>` rejects an empty-string `value`, so `null` can't
 * be used directly as an option value.
 */
const NO_EVENT_VALUE = "__administracao-central__";

type TransactionKind = Transaction["kind"];

const transactionFormSchema = z.object({
  kind: z.enum(["in", "out"]),
  amountCents: z.number().positive("Informe um valor maior que zero."),
  date: z.string().min(1, "Selecione a data."),
  categoryId: z.string().min(1, "Selecione a categoria."),
  eventId: z.string(),
  description: z.string(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

function eventIdToFormValue(eventId: string | null | undefined): string {
  return eventId ?? NO_EVENT_VALUE;
}

function formValueToEventId(value: string): string | null {
  return value === NO_EVENT_VALUE ? null : value;
}

/**
 * The categoria a fresh (kind, hasEvent) pick starts on: an "in" entry
 * attributed to a specific event defaults to "Pagamento de contrato" when
 * that category is active — looked up by NAME, since categories are a
 * dynamic, editable catalog (Configurações) and nothing outside `seed.ts`
 * may assume a stable id. Every other case (no event, or kind "out") falls
 * back to the kind's first active category; `""` only if that kind somehow
 * has no active category at all (zod's `min(1)` then blocks submit).
 */
function defaultCategoryId(
  kind: TransactionKind,
  hasEvent: boolean,
  activeForKind: TransactionCategory[],
): string {
  if (kind === "in" && hasEvent) {
    const contractPayment = activeForKind.find((category) => category.name === "Pagamento de contrato");
    if (contractPayment) return contractPayment.id;
  }
  return activeForKind[0]?.id ?? "";
}

function buildDefaultValues(params: {
  transaction: Transaction | undefined;
  defaultEventId: string | null | undefined;
  activeCategoriesByKind: Record<TransactionKind, TransactionCategory[]>;
}): TransactionFormValues {
  const { transaction, defaultEventId, activeCategoriesByKind } = params;

  if (transaction) {
    return {
      kind: transaction.kind,
      amountCents: transaction.amountCents,
      date: transaction.date,
      categoryId: transaction.categoryId,
      eventId: eventIdToFormValue(transaction.eventId),
      description: transaction.description ?? "",
    };
  }

  const kind: TransactionKind = "in";
  const eventId = eventIdToFormValue(defaultEventId);
  return {
    kind,
    amountCents: 0,
    date: todayISO(),
    categoryId: defaultCategoryId(kind, eventId !== NO_EVENT_VALUE, activeCategoriesByKind.in),
    eventId,
    description: "",
  };
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  defaultEventId,
  lockEvent = false,
  transaction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEventId?: string | null;
  lockEvent?: boolean;
  transaction?: Transaction;
}) {
  const isEditing = transaction !== undefined;

  const { data: categoriesIn } = useCategories("in");
  const { data: categoriesOut } = useCategories("out");
  const { data: events } = useEvents();
  const { data: lockedEvent } = useEvent(defaultEventId ?? "");

  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();

  const catalogReady = categoriesIn !== undefined && categoriesOut !== undefined;
  // Full (active+inactive) lists, per kind — Select OPTIONS filter to active
  // themselves (keeping a currently-selected-but-since-deactivated category
  // visible, mirroring `EditarEventoDialog`'s same defensive treatment of an
  // event's own possibly-inactive type); the DEFAULTING helper above only
  // ever searches the active-only view.
  const categoriesByKind: Record<TransactionKind, TransactionCategory[]> = {
    in: categoriesIn ?? [],
    out: categoriesOut ?? [],
  };
  const activeCategoriesByKind: Record<TransactionKind, TransactionCategory[]> = {
    in: categoriesByKind.in.filter((category) => category.active),
    out: categoriesByKind.out.filter((category) => category.active),
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: buildDefaultValues({
      transaction,
      defaultEventId,
      activeCategoriesByKind: { in: [], out: [] },
    }),
  });

  // Recomputes fresh values (blank create-mode defaults, or this
  // `transaction`'s own prefill) every time the dialog transitions to open —
  // mirrors `EditarEventoDialog`'s `useEffect(() => { if (open) reset(...)
  // }, [open])`. `transaction`/`defaultEventId` stay out of the deps for the
  // same reason documented there: reacting to prop identity directly would
  // re-run this on every unrelated background refetch while the dialog is
  // open and stomp on whatever the user is mid-typing. `catalogReady` IS a
  // dependency (unlike that effect) because the create-mode default
  // categoria is derived FROM the fetched categories — if the dialog opens
  // before that query resolves, this re-fires the moment it does.
  useEffect(() => {
    if (open && catalogReady) {
      reset(buildDefaultValues({ transaction, defaultEventId, activeCategoriesByKind }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, catalogReady]);

  const currentKind = watch("kind");
  const currentCategoryId = watch("categoryId");
  const currentEventValue = watch("eventId");

  const categoryOptions = categoriesByKind[currentKind].filter(
    (category) => category.active || category.id === currentCategoryId,
  );
  const eventOptions = (events ?? []).filter((ev) => !ev.canceled || ev.id === currentEventValue);
  // The event currently picked in the UNLOCKED `<Select>` below (undefined
  // while `events` is still loading, or when the sentinel "Administração
  // central" value is selected) — drives the same soft cancellation warning
  // `lockEvent` mode shows via `lockedEvent`, so editing an old transaction
  // whose event was canceled since surfaces the same heads-up here too.
  const selectedEvent = (events ?? []).find((ev) => ev.id === currentEventValue);

  /**
   * Setting `kind` and `categoryId` in the very same commit — i.e. both via
   * a single batched `setValue` pair — hits a genuine Radix `<Select>` quirk:
   * when a controlled `value` changes to something that isn't among the
   * options `<SelectContent>` rendered on any PRIOR commit, Radix silently
   * fires its own `onValueChange("")` to "correct" it, since it never had a
   * chance to register a matching `<SelectItem>` for the new kind's list.
   * Splitting the categoria update into a microtask sidesteps it: the kind
   * change (and its new options list) commits and gets picked up by Radix
   * first, so by the time the categoria correction lands, its item is
   * already known. A microtask (not a timeout) so this resolves before the
   * next paint — never a visible flash of the stale categoria.
   */
  function handleKindChange(nextKind: TransactionKind) {
    setValue("kind", nextKind);
    const hasEvent = getValues("eventId") !== NO_EVENT_VALUE;
    queueMicrotask(() => {
      setValue("categoryId", defaultCategoryId(nextKind, hasEvent, activeCategoriesByKind[nextKind]));
    });
  }

  function onSubmit(values: TransactionFormValues) {
    const payload = {
      kind: values.kind,
      amountCents: values.amountCents,
      date: values.date,
      categoryId: values.categoryId,
      eventId: lockEvent ? defaultEventId ?? null : formValueToEventId(values.eventId),
      description: values.description.trim() === "" ? null : values.description,
    };

    if (transaction) {
      updateTransaction.mutate(
        { id: transaction.id, patch: payload },
        {
          onSuccess: () => {
            toast.success("Lançamento atualizado!");
            onOpenChange(false);
          },
          onError: () => toast.error("Não foi possível atualizar o lançamento. Tente novamente."),
        },
      );
      return;
    }

    createTransaction.mutate(payload, {
      onSuccess: () => {
        toast.success("Lançamento registrado!");
        onOpenChange(false);
      },
      onError: () => toast.error("Não foi possível registrar o lançamento. Tente novamente."),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEditing ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Altere os dados deste lançamento." : "Registre uma entrada ou saída no caixa."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={currentKind === "in" ? "default" : "outline"}
                onClick={() => handleKindChange("in")}
              >
                Entrada
              </Button>
              <Button
                type="button"
                variant={currentKind === "out" ? "default" : "outline"}
                onClick={() => handleKindChange("out")}
              >
                Saída
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lancamento-valor">Valor*</Label>
              <Controller
                control={control}
                name="amountCents"
                render={({ field }) => (
                  <CurrencyInput
                    id="lancamento-valor"
                    valueCents={field.value}
                    onChangeCents={field.onChange}
                    placeholder="0,00"
                  />
                )}
              />
              {errors.amountCents && <p className="text-sm text-destructive">{errors.amountCents.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lancamento-data">Data*</Label>
              <Input id="lancamento-data" type="date" {...register("date")} />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lancamento-categoria">Categoria*</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="lancamento-categoria" className="w-full">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
          </div>

          {lockEvent ? (
            <div className="flex flex-col gap-1.5">
              <Label>Evento</Label>
              <p className="text-sm text-foreground">
                {defaultEventId ? lockedEvent?.name ?? "" : "Administração central"}
              </p>
              <input type="hidden" {...register("eventId")} />
              {lockedEvent?.canceled && (
                <p className="text-sm text-muted-foreground">
                  Este evento está cancelado — o lançamento entra no histórico (ex.: devolução).
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lancamento-evento">Evento</Label>
              <Controller
                control={control}
                name="eventId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="lancamento-evento" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_EVENT_VALUE}>Administração central</SelectItem>
                      {eventOptions.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {selectedEvent?.canceled && (
                <p className="text-sm text-muted-foreground">
                  Este evento está cancelado — o lançamento entra no histórico (ex.: devolução).
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lancamento-descricao">Descrição</Label>
            <Textarea
              id="lancamento-descricao"
              rows={1}
              placeholder="Observação opcional"
              {...register("description")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTransaction.isPending || updateTransaction.isPending}>
              {isEditing ? "Salvar alterações" : "Registrar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
