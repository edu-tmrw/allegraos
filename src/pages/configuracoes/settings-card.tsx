import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The cadastro-tab shell shared by Tipos de evento, Categorias and Etapas:
 * a title/description header with an "Adicionar" action, and either a
 * loading skeleton, an empty state with its own CTA, or the caller's list
 * of `<SettingsRow>`s (each tab supplies its own rows as `children`).
 *
 * `footer` is an optional extra note rendered below the rows/empty-state
 * (e.g. usuárias' "convite real chega na fase de banco" disclaimer) — kept
 * out of the loading branch so it doesn't compete with the skeleton.
 */
export function SettingsCard({
  title,
  description,
  addLabel = "Adicionar",
  onAdd,
  isLoading = false,
  isEmpty,
  emptyMessage,
  footer,
  children,
}: {
  title: string;
  description?: string;
  addLabel?: string;
  onAdd: () => void;
  isLoading?: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction>
          <Button type="button" size="sm" className="gap-1.5" onClick={onAdd}>
            <Plus className="size-4" />
            {addLabel}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            <Button type="button" variant="outline" size="sm" onClick={onAdd}>
              {addLabel}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">{children}</div>
        )}
        {!isLoading && footer && <div className="pt-3">{footer}</div>}
      </CardContent>
    </Card>
  );
}
