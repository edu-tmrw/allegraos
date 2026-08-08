/**
 * "Serviços contratados" section of the event detail page: wires the SHARED
 * `ServiceItemsEditor` (`src/components/service-items-editor.tsx` — the same
 * component Task 20's proposals feature consumes verbatim) to this event's
 * own sold services + general discount. Kept as a thin adapter — every
 * catalog/table/dialog concern lives in the shared component; this file only
 * maps `EventService` rows to `ServiceItemRow`s and turns each callback into
 * the matching event mutation + toast.
 *
 * Not gated by `manageFinance` — everyone who can see the event can see what
 * services were sold on it (unlike the stat cards/lançamentos around it).
 * Editing needs `manageEvents`, and is blocked outright on a canceled event
 * — canceled events keep their services visible, just frozen (no
 * add/remove/discount-edit), matching `detalhe.tsx`'s own cancel-banner
 * copy ("o histórico financeiro permanece").
 */
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceItemsEditor, type ServiceItemDraft, type ServiceItemRow } from "@/components/service-items-editor";
import { usePerms } from "@/data/auth";
import {
  useAddEventService,
  useEvent,
  useEventServices,
  useRemoveEventService,
  useSetEventDiscount,
} from "@/data/hooks/use-events";

export function DetalheServicos({ eventId }: { eventId: string }) {
  const { manageEvents } = usePerms();
  const { data: event } = useEvent(eventId);
  const { data: eventServices } = useEventServices(eventId);

  const addService = useAddEventService();
  const removeService = useRemoveEventService();
  const setDiscount = useSetEventDiscount();

  const items: ServiceItemRow[] = (eventServices ?? []).map((item) => ({
    id: item.id,
    serviceId: item.serviceId,
    variantId: item.variantId,
    priceCents: item.priceCents,
    createdAt: item.createdAt,
  }));

  const readOnly = !manageEvents || Boolean(event?.canceled);

  function handleAdd(draft: ServiceItemDraft) {
    addService.mutate(
      { eventId, ...draft },
      {
        onSuccess: () => toast.success("Serviço adicionado."),
        onError: () => toast.error("Não foi possível adicionar o serviço. Tente novamente."),
      },
    );
  }

  function handleRemove(id: string) {
    removeService.mutate(id, {
      onSuccess: () => toast.success("Serviço removido."),
      onError: () => toast.error("Não foi possível remover o serviço. Tente novamente."),
    });
  }

  function handleDiscountChange(nextDiscountCents: number) {
    setDiscount.mutate(
      { eventId, discountCents: nextDiscountCents },
      {
        onSuccess: () => toast.success("Desconto atualizado."),
        onError: () => toast.error("Não foi possível atualizar o desconto. Tente novamente."),
      },
    );
  }

  return (
    <Card data-event-id={eventId}>
      <CardHeader>
        <CardTitle className="font-serif text-xl">Serviços contratados</CardTitle>
      </CardHeader>
      <CardContent>
        <ServiceItemsEditor
          items={items}
          onAdd={handleAdd}
          onRemove={handleRemove}
          discountCents={event?.discountCents ?? 0}
          onDiscountChange={handleDiscountChange}
          readOnly={readOnly}
        />
      </CardContent>
    </Card>
  );
}
