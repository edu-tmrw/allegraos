import type { ReactNode } from "react";

/**
 * Cabeçalho padrão de página: título serif à esquerda, ações à direita.
 * Padrão visual de referência: página CRM. Toda página de lista usa este
 * componente em vez de repetir o markup — inclusive nos skeletons
 * (children = <Skeleton />).
 */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl text-foreground">{title}</h1>
        {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
