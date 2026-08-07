import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * One row of a settings list: optional leading controls (e.g. the etapas
 * tab's reorder arrows), the row's own content (name, badges, ...), and a
 * right-aligned active `Switch` + edit pencil shared by every cadastro tab.
 *
 * Inactive rows never disappear — the row itself just mutes its content —
 * because inactivating only hides the option from *future* selects
 * elsewhere; existing records that reference it must keep showing the name.
 */
export function SettingsRow({
  leading,
  active,
  onToggleActive,
  toggleLabel,
  onEdit,
  editLabel,
  children,
}: {
  leading?: ReactNode;
  active: boolean;
  onToggleActive: (active: boolean) => void;
  toggleLabel: string;
  onEdit: () => void;
  editLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      {leading && <div className="flex shrink-0 items-center gap-0.5">{leading}</div>}
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2",
          !active && "text-muted-foreground",
        )}
      >
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Switch checked={active} onCheckedChange={onToggleActive} aria-label={toggleLabel} />
        <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label={editLabel}>
          <Pencil className="size-4" />
        </Button>
      </div>
    </div>
  );
}
