/**
 * The event status `Badge`, shared by the Eventos list (`index.tsx`) and the
 * event detail page (`detalhe.tsx`) so both always render the exact same
 * three colors for the exact same derived `eventStatus` — never duplicated
 * inline, so the two screens can't silently drift apart.
 */
import { Badge } from "@/components/ui/badge";

const STATUS_BADGE_LABEL: Record<"ativo" | "concluido" | "cancelado", string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function StatusBadge({ status }: { status: "ativo" | "concluido" | "cancelado" }) {
  if (status === "ativo") {
    return (
      <Badge className="border-transparent bg-accent text-accent-foreground">
        {STATUS_BADGE_LABEL.ativo}
      </Badge>
    );
  }
  if (status === "concluido") {
    return <Badge variant="secondary">{STATUS_BADGE_LABEL.concluido}</Badge>;
  }
  return (
    <Badge variant="outline" className="border-destructive/50 text-destructive">
      {STATUS_BADGE_LABEL.cancelado}
    </Badge>
  );
}
