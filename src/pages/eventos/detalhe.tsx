import { useParams } from "react-router";

/** Placeholder shell — real content (header, stat cards, serviços, lançamentos) lands in Task 13+. */
export function EventoDetalhePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-2">
      <h1 className="font-serif text-3xl text-foreground">Evento</h1>
      <p className="text-muted-foreground">Em construção. ID: {id}</p>
    </div>
  );
}
