import { completionPercent, localDateKey } from "./widget-data";

type SummaryTask = { id: string; title: string; status: string; due_date: string | null; priority: string };

export function taskSummary<T extends SummaryTask>(tasks: T[], now = new Date()) {
  const today = localDateKey(now);
  const completed = tasks.filter(task => task.status === "completed").length;
  const overdue = tasks.filter(task => task.status !== "completed" && task.due_date && task.due_date < today);
  const dueToday = tasks.filter(task => task.due_date === today);
  const focus = tasks.filter(task => task.due_date && (task.due_date === today || (task.due_date < today && task.status !== "completed")))
    .sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || (a.due_date ?? "").localeCompare(b.due_date ?? "") || Number(b.priority === "high") - Number(a.priority === "high"));
  return { total: tasks.length, completed, percent: completionPercent(completed, tasks.length), overdue, dueToday, focus };
}
