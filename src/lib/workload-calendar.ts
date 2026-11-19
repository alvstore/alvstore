import { completionPercent, localDateKey } from "./widget-data";

export type ScheduledTask = { due_date?: string | null; status: string };

/** Due-date workload, not a fabricated completion streak or completion-date history. */
export function workloadMonth(tasks: ScheduledTask[], month: Date, now = new Date()) {
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1, 12);
  const length = new Date(year, monthIndex + 1, 0, 12).getDate();
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const today = localDateKey(now);
  const counts = new Map<string, { total: number; completed: number }>();
  for (const task of tasks) {
    const key = task.due_date ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !key.startsWith(prefix)) continue;
    const number = Number(key.slice(-2));
    if (number < 1 || number > length) continue;
    const count = counts.get(key) ?? { total: 0, completed: 0 };
    count.total++;
    if (task.status === "completed") count.completed++;
    counts.set(key, count);
  }
  const days = Array.from({ length }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1, 12);
    const key = localDateKey(date), count = counts.get(key) ?? { total: 0, completed: 0 };
    const open = count.total - count.completed;
    return { date, key, day: index + 1, ...count, open, overdue: key < today ? open : 0 };
  });
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const completed = days.reduce((sum, day) => sum + day.completed, 0);
  return { days, offset: (first.getDay() + 6) % 7, total, completed, open: total - completed, percent: completionPercent(completed, total) };
}
