import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Estado vazio padrão: contêiner tracejado suave (padrão visual da página
 * CRM), texto muted e CTA opcional. `className` ajusta densidade em
 * contextos compactos (ex.: painel do lead usa p-6).
 */
export function EmptyState({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-lg border border-dashed p-12 text-center",
        className,
      )}
    >
      <p className="text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}
