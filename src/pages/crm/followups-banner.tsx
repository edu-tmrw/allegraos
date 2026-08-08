import { Card } from "@/components/ui/card";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Activity, Contact } from "@/domain/types";

const MAX_VISIBLE = 5;

/**
 * Soft-accent banner above the board: today's + overdue follow-ups, newest
 * due date first (the order `useDueFollowups` already returns). Only ever
 * rendered by the caller when the list is non-empty. Clicking a row opens
 * that row's contact via `onOpenContact` — the same open/close wiring every
 * other lead entry point uses.
 */
export function FollowupsBanner({
  followups,
  onOpenContact,
}: {
  followups: { activity: Activity; contact: Contact }[];
  onOpenContact: (contactId: string) => void;
}) {
  const today = todayISO();
  const visible = followups.slice(0, MAX_VISIBLE);

  return (
    <Card className="border-primary/30 bg-accent/30 p-4" data-testid="followups-banner">
      <p className="font-semibold text-foreground">{followups.length} follow-ups pendentes</p>
      <ul className="mt-2 divide-y divide-border/60">
        {visible.map(({ activity, contact }) => {
          const dueDate = activity.dueDate;
          const overdue = dueDate !== null && dueDate < today;

          return (
            <li key={activity.id}>
              <button
                type="button"
                onClick={() => onOpenContact(contact.id)}
                data-testid={`followup-${activity.id}`}
                className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-left transition-colors hover:bg-accent/40"
              >
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="font-medium text-foreground">{contact.name}</span>
                  <span className="truncate text-sm text-muted-foreground">{activity.content}</span>
                </span>
                <span
                  data-testid={`followup-date-${activity.id}`}
                  className={cn("shrink-0 text-sm", overdue ? "font-medium text-negative" : "text-muted-foreground")}
                >
                  {dueDate !== null ? formatDate(dueDate) : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
