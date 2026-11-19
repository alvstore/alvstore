import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString("base64")}`;
const dataUrl = moduleUrl(fs.readFileSync("src/lib/widget-data.ts", "utf8"));
const { clampPercent, completionPercent, localDateKey, dailySeries, periodSummary, sparklinePath } = await import(dataUrl);
const { taskSummary } = await import(moduleUrl(fs.readFileSync("src/lib/task-summary.ts", "utf8").replace('"./widget-data"', JSON.stringify(dataUrl))));

test("widget percentages are finite, bounded and honest for empty totals", () => {
  assert.equal(completionPercent(0, 0), 0);
  assert.equal(completionPercent(3, 4), 75);
  assert.equal(completionPercent(6, 4), 100);
  for (const value of [NaN, Infinity, -Infinity, -20]) assert.equal(clampPercent(value), 0);
});

test("daily series sums actual records, fills gaps, and preserves date-only keys", () => {
  const end = new Date(2026, 10, 18, 12);
  const points = dailySeries([{ date: "2026-11-17", value: 50 }, { date: "2026-11-17", value: 25 }, { date: "2026-11-18", value: 12 }, { date: "invalid", value: 99 }, { date: "2026-11-18", value: NaN }], 3, end);
  assert.deepEqual(points.map(point => [point.date, point.value]), [["2026-11-16", 0], ["2026-11-17", 75], ["2026-11-18", 12]]);
  assert.equal(localDateKey("2026-11-18"), "2026-11-18");
  assert.equal(localDateKey("invalid"), "");
  assert.equal(dailySeries([], 7, end).length, 7);
  assert.equal(dailySeries([], Infinity, end).length, 7);
});

test("period comparison uses two disjoint periods and avoids invented growth", () => {
  const end = new Date(2026, 10, 18, 12);
  const result = periodSummary([{ date: "2026-11-18", value: 200 }, { date: "2026-11-11", value: 100 }], 7, end);
  assert.equal(result.total, 200);
  assert.equal(result.previous, 100);
  assert.equal(result.change, 100);
  assert.equal(result.series.length, 7);
  assert.equal(periodSummary([], 30, end).change, null);
  assert.equal(periodSummary([], 0, end).average, 0);
});

test("sparkline geometry handles empty, flat, negative and invalid values", () => {
  assert.equal(sparklinePath([]), null);
  assert.equal(sparklinePath([2]), null);
  assert.equal(sparklinePath([1, 2], 4, 4), null);
  for (const values of [[0, 0, 0], [-5, -9, 3], [NaN, Infinity, 0], [1, 1000, 0, 1000]]) {
    const result = sparklinePath(values);
    assert.ok(result.line.startsWith("M "));
    assert.ok(result.area.endsWith("Z"));
    assert.doesNotMatch(result.line, /NaN|Infinity/);
    assert.equal(result.last.x, 157);
    assert.ok(result.last.y >= 3 && result.last.y <= 41);
  }
});

test("task totals remain independent of filters; focus includes open overdue work", () => {
  const now = new Date(2026, 10, 18, 12);
  const tasks = [
    { id: "one", title: "Overdue", priority: "high", due_date: "2026-11-17", status: "pending" },
    { id: "two", title: "Today", priority: "medium", due_date: "2026-11-18", status: "completed" },
    { id: "three", title: "Old complete", priority: "low", due_date: "2026-11-16", status: "completed" },
    { id: "four", title: "Unscheduled", priority: "medium", due_date: null, status: "pending" },
  ];
  const summary = taskSummary(tasks, now);
  assert.equal(summary.total, 4);
  assert.equal(summary.completed, 2);
  assert.equal(summary.percent, 50);
  assert.deepEqual(summary.overdue.map(task => task.id), ["one"]);
  assert.deepEqual(summary.focus.map(task => task.id), ["one", "two"]);
  assert.equal(taskSummary([], now).percent, 0);
  assert.equal(tasks[0].id, "one", "summary does not mutate caller data");
});
