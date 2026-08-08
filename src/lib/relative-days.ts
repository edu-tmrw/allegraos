/**
 * "Time until an event" labels, shared by the event detail page's header and
 * the dashboard's upcoming-events list. Both start from the same
 * `differenceInCalendarDays` count and agree on the N>=1 wording ("em 1
 * dia" / "em N dias"), but disagree on what a same-day event (0) should
 * read: the detail page already shows a separate status badge, so it
 * suppresses the line entirely for today/the past; the dashboard has no
 * such badge, so it reads "hoje" instead. Two tiny named variants — not one
 * flag — keep each call site's intent obvious at the call, not buried in an
 * options bag.
 */
import { differenceInCalendarDays, parseISO } from "date-fns";

/** Calendar days from `todayISO` to `eventDateISO` — negative when `eventDateISO` is in the past. */
function daysUntil(eventDateISO: string, todayISO: string): number {
  return differenceInCalendarDays(parseISO(eventDateISO), parseISO(todayISO));
}

/**
 * "em 1 dia" / "em N dias" for N >= 1; `null` for today or the past. Matches
 * the event detail page's original inline logic exactly — a caller that
 * already shows a separate status indicator (e.g. that same page's own
 * status badge) relies on the `null` to suppress the line entirely.
 */
export function daysUntilLabel(eventDateISO: string, todayISO: string): string | null {
  const days = daysUntil(eventDateISO, todayISO);
  if (days <= 0) return null;
  return `em ${days} ${days === 1 ? "dia" : "dias"}`;
}

/**
 * Same as `daysUntilLabel`, but a same-day event reads "hoje" instead of
 * being suppressed — for a consumer with no separate status indicator to
 * fall back on (the dashboard's upcoming-events list). That list only ever
 * holds non-canceled events dated today or later (see `calc.ts`'s
 * `upcomingEvents`), so the past case can't actually happen here — handled
 * the same defensive way as `daysUntilLabel` anyway, rather than assumed.
 */
export function daysUntilLabelOrToday(eventDateISO: string, todayISO: string): string {
  if (daysUntil(eventDateISO, todayISO) === 0) return "hoje";
  return daysUntilLabel(eventDateISO, todayISO) ?? "";
}
