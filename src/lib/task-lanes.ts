/** Canonical task status lane ordering and status coercion helpers. */
export interface TaskLane {
  id: "pending" | "in_progress" | "completed";
  label: string;
  accent: "warning" | "info" | "success";
}

export const TASK_LANES: readonly TaskLane[] = [
  { id: "pending", label: "Pending", accent: "warning" },
  { id: "in_progress", label: "In Progress", accent: "info" },
  { id: "completed", label: "Completed", accent: "success" },
] as const;

export type CanonicalTaskStatus = TaskLane["id"];

/** Map nullable/unknown DB task status values to a valid Kanban lane id. */
export function normalizeTaskStatus(status: string | null | undefined): CanonicalTaskStatus {
  if (status === "in_progress" || status === "completed" || status === "pending") {
    return status;
  }
  return "pending";
}

/** Human-readable label for nullable task statuses in tables and timelines. */
export function formatTaskStatus(status: string | null | undefined): string {
  const safe = status?.trim() || "pending";
  return safe
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Return immediate previous and next lanes in full canonical order, independent of active filters. */
export function getAdjacentLanes(laneId: string): {
  prev: TaskLane | null;
  next: TaskLane | null;
} {
  const idx = TASK_LANES.findIndex((lane) => lane.id === laneId);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? TASK_LANES[idx - 1] : null,
    next: idx < TASK_LANES.length - 1 ? TASK_LANES[idx + 1] : null,
  };
}
