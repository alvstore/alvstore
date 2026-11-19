export type DailyValue = { date: string; value: number };
export type DailyPoint = DailyValue & { label: string };

export function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}
export function completionPercent(completed: number, total: number): number {
  return total > 0 ? clampPercent((completed / total) * 100) : 0;
}

/** Date-only business fields must not move a day when parsed in another timezone. */
export function localDateKey(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Fills known days with zero, never invents transactions or a trend. */
export function dailySeries(values: DailyValue[], days: number, end = new Date()): DailyPoint[] {
  const length = Math.max(1, Math.min(366, Math.floor(Number.isFinite(days) ? days : 7)));
  const totals = new Map<string, number>();
  for (const item of values) {
    const key = localDateKey(item.date);
    if (key && Number.isFinite(item.value)) totals.set(key, (totals.get(key) ?? 0) + item.value);
  }
  return Array.from({ length }, (_, index) => {
    const date = new Date(end);
    date.setDate(date.getDate() - (length - index - 1));
    const key = localDateKey(date);
    return { date: key, label: date.toLocaleDateString("en-IN", length <= 7 ? { weekday: "short" } : { day: "numeric", month: "short" }), value: totals.get(key) ?? 0 };
  });
}

export function periodSummary(values: DailyValue[], days: number, end = new Date()) {
  days = Math.max(1, Math.min(183, Math.floor(Number.isFinite(days) ? days : 7)));
  const series = dailySeries(values, days * 2, end);
  const current = dailySeries(values, days, end);
  const previous = series.slice(0, -days).reduce((sum, point) => sum + point.value, 0);
  const total = current.reduce((sum, point) => sum + point.value, 0);
  return { series: current, total, previous, average: total / days, change: previous > 0 ? ((total - previous) / previous) * 100 : null };
}

/** Small, clamped cubic curve. Flat/negative/single-point series remain valid. */
export function sparklinePath(values: number[], width = 160, height = 44, padding = 3) {
  const safe = values.map(value => Number.isFinite(value) ? value : 0);
  if (safe.length < 2 || width <= padding * 2 || height <= padding * 2) return null;
  const low = Math.min(...safe), high = Math.max(...safe);
  const range = high - low;
  const points = safe.map((value, index) => ({
    x: padding + (index / (safe.length - 1)) * (width - padding * 2),
    y: range === 0 ? height / 2 : padding + (1 - (value - low) / range) * (height - padding * 2),
  }));
  const n = (value: number) => Number(value.toFixed(2));
  const clampY = (value: number) => n(Math.min(height - padding, Math.max(padding, value)));
  let line = `M ${n(points[0].x)} ${n(points[0].y)}`;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1], to = points[index];
    const before = points[Math.max(0, index - 2)], after = points[Math.min(points.length - 1, index + 1)];
    line += ` C ${n(from.x + (to.x - before.x) / 6)} ${clampY(from.y + (to.y - before.y) / 6)}, ${n(to.x - (after.x - from.x) / 6)} ${clampY(to.y - (after.y - from.y) / 6)}, ${n(to.x)} ${n(to.y)}`;
  }
  const last = points[points.length - 1];
  return { line, area: `${line} L ${n(last.x)} ${height} L ${n(points[0].x)} ${height} Z`, last };
}
