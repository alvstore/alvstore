import type { Theme } from "@mui/material";

export interface TrendPointInput {
  created_at: string;
  total?: number | null;
}

export interface DailySalesPoint {
  isoDate: string;
  date: string;
  total: number;
}

function parseRgb(color: string): [number, number, number] | null {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const full = raw.length === 3 ? raw.split("").map(c => c + c).join("") : raw;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }
  const rgb = color.trim().match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

export function colorHueDegrees(color: string): number | null {
  const parsed = parseRgb(color);
  if (!parsed) return null;
  const r = parsed[0] / 255;
  const g = parsed[1] / 255;
  const b = parsed[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.06) return null;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return Math.round(((hue * 60) + 360) % 360);
}

export function hueDistance(a: number | null, b: number | null): number {
  if (a === null || b === null) return 180;
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

/**
 * Derive a categorical palette anchored on theme.palette.primary.main while
 * guaranteeing every adjacent/paired slice has distinct hue separation across
 * all seven themes (including monochrome-accent themes like Amber, Donezo, Ocean).
 */
export function categoricalChartPalette(theme: Theme): string[] {
  const isDark = theme.palette.mode === "dark";
  const baseCandidates = [
    theme.palette.primary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    isDark ? "#a78bfa" : "#6d28d9",
    isDark ? "#fb7185" : "#e11d48",
    isDark ? "#38bdf8" : "#0284c7",
    isDark ? "#34d399" : "#059669",
    isDark ? "#fbbf24" : "#d97706",
  ];

  const chosen: string[] = [];
  const chosenHues: (number | null)[] = [];

  for (const candidate of baseCandidates) {
    if (!candidate) continue;
    const hue = colorHueDegrees(candidate);
    const tooClose = chosenHues.some(existing => hueDistance(existing, hue) < 34);
    if (chosen.length === 0 || !tooClose) {
      chosen.push(candidate);
      chosenHues.push(hue);
    }
    if (chosen.length >= 6) break;
  }

  return chosen.length >= 5
    ? chosen
    : [
        theme.palette.primary.main,
        isDark ? "#60a5fa" : "#2563eb",
        isDark ? "#34d399" : "#059669",
        isDark ? "#fbbf24" : "#d97706",
        isDark ? "#a78bfa" : "#7c3aed",
      ];
}

export function compactAxisNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function sharePercent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0 || value <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

export function sortChronologicalTrend(rows: readonly TrendPointInput[]): DailySalesPoint[] {
  const totalsByDay = new Map<string, number>();
  for (const row of rows) {
    const dt = new Date(row.created_at);
    if (!Number.isFinite(dt.getTime())) continue;
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const amount = Number(row.total ?? 0);
    totalsByDay.set(iso, (totalsByDay.get(iso) ?? 0) + (Number.isFinite(amount) ? amount : 0));
  }

  return Array.from(totalsByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([isoDate, total]) => {
      const [y, m, d] = isoDate.split("-").map(Number);
      const label = new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      return { isoDate, date: label, total };
    });
}
