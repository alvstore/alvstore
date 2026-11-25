/** Calendar range intersection and category filter helpers. */

export const CALENDAR_CATEGORY_KEYS = [
  "personal",
  "business",
  "family",
  "holiday",
  "etc",
] as const;

function parseCalendarInstant(raw: string): Date {
  // Date-only strings (YYYY-MM-DD) should stay on the same local calendar day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  }
  return new Date(raw);
}

/** True when a single-day or multi-day event overlaps the given local calendar day. */
export function eventIntersectsDay(
  event: { start_date: string; end_date?: string | null },
  day: Date
): boolean {
  const start = parseCalendarInstant(event.start_date);
  if (Number.isNaN(start.getTime())) return false;

  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);

  if (!event.end_date) {
    return start >= dayStart && start <= dayEnd;
  }

  const parsedEnd = parseCalendarInstant(event.end_date);
  const end = Number.isNaN(parsedEnd.getTime()) || parsedEnd < start ? start : parsedEnd;
  return start <= dayEnd && end >= dayStart;
}

/** Filter event visibility while preventing unknown categories from bypassing unchecked "View All". */
export function matchesCategoryFilter(
  category: string | null | undefined,
  filters: Record<string, boolean>,
  knownCategories: readonly string[] = CALENDAR_CATEGORY_KEYS
): boolean {
  const allChecked = knownCategories.every((key) => Boolean(filters[key]));
  if (allChecked) return true;
  const key = category?.trim() || "business";
  return Boolean(filters[key]);
}
