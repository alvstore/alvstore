import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const url = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString("base64")}`;
const data = url(fs.readFileSync("src/lib/widget-data.ts", "utf8"));
const { workloadMonth } = await import(url(fs.readFileSync("src/lib/workload-calendar.ts", "utf8").replace('"./widget-data"', JSON.stringify(data))));
const { navigationCommands } = await import(url(fs.readFileSync("src/lib/navigation-commands.ts", "utf8")));
const { controlFeedback, entranceDelay, motionTokens } = await import(url(fs.readFileSync("src/lib/motion-presets.ts", "utf8")));

test("workload grid uses real due dates/statuses, including overdue open tasks", () => {
  const tasks = [
    { due_date: "2026-11-17", status: "pending" },
    { due_date: "2026-11-17", status: "completed" },
    { due_date: "2026-11-18", status: "in_progress" },
    { due_date: "2026-11-19", status: "completed" },
    { due_date: "2026-12-01", status: "completed" },
    { due_date: null, status: "pending" },
    { due_date: "invalid", status: "pending" },
    { due_date: "2026-11-31", status: "pending" },
  ];
  const before = structuredClone(tasks);
  const result = workloadMonth(tasks, new Date(2026, 10, 18), new Date(2026, 10, 18));
  assert.equal(result.total, 4);
  assert.equal(result.completed, 2);
  assert.equal(result.open, 2);
  assert.equal(result.percent, 50);
  assert.equal(result.offset, 6, "November 2026 starts on Sunday in a Monday-first grid");
  assert.equal(result.days.length, 30);
  assert.equal(result.days[16].overdue, 1);
  assert.equal(result.days[17].overdue, 0, "today is not overdue");
  assert.equal(result.days[18].completed, 1, "current status, not an invented completion timestamp");
  assert.deepEqual(tasks, before);
});

test("workload month boundaries handle leap years and empty months", () => {
  for (const [year, length] of [[2024, 29], [2026, 28]]) {
    const result = workloadMonth([], new Date(year, 1, 15));
    assert.equal(result.days.length, length);
    assert.equal(result.days[0].key, `${year}-02-01`);
    assert.equal(result.days.at(-1).key, `${year}-02-${length}`);
    assert.equal(result.total, 0);
    assert.equal(result.percent, 0);
  }
  assert.equal(workloadMonth([], new Date(2026, 11, 31)).days.length, 31);
});

test("workload due-date keys do not shift with timezone or DST", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["America/Los_Angeles", "Asia/Kolkata", "Pacific/Auckland"]) {
      process.env.TZ = zone;
      const result = workloadMonth([{ due_date: "2026-03-08", status: "pending" }], new Date(2026, 2, 15));
      assert.equal(result.days[7].key, "2026-03-08");
      assert.equal(result.days[7].total, 1);
      assert.equal(result.days[30].key, "2026-03-31");
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test("navigation shortcuts are limited to the user's existing navigation", () => {
  const customer = [{ label: "Portal", items: [{ title: "My Portal", url: "/portal" }, { title: "Chat", url: "/chat" }, { title: "Settings", url: "/settings" }] }];
  const commands = navigationCommands(customer);
  assert.deepEqual(commands.map(command => command.url), ["/portal", "/chat", "/settings"]);
  assert.ok(commands.every(command => !command.action));
  assert.deepEqual(navigationCommands([]), []);
});

test("creation commands inherit the exact allowed parent, and do not mutate navigation", () => {
  const categories = [{ label: "Sales", items: [{ title: "Invoices", url: "/invoices" }] }];
  const commands = navigationCommands(categories);
  assert.deepEqual(commands.map(command => command.url), ["/invoices/new", "/invoices"]);
  assert.equal(commands[0].section, "Quick actions");
  assert.equal(new Set(commands.map(command => command.id)).size, commands.length);
  assert.equal(categories[0].items.length, 1);
  assert.ok(navigationCommands([{ label: "Public", items: [{ title: "Public invoice", url: "/invoices/public" }] }]).every(command => !command.action));
});

test("shared control feedback preserves placement transforms and honors disabled/reduced/fine-pointer states", () => {
  assert.equal(controlFeedback.transform, undefined);
  assert.ok(controlFeedback["@media (hover: hover) and (pointer: fine)"]);
  const press = Object.entries(controlFeedback).find(([key]) => key.endsWith(":active"));
  assert.match(press[0], /not\(\.Mui-disabled\)/);
  assert.match(press[0], /aria-disabled/);
  assert.equal(press[1].scale, "0.97");
  const reduced = controlFeedback["@media (prefers-reduced-motion: reduce)"];
  assert.equal(reduced.transition, "none");
  assert.equal(reduced[press[0]].scale, "none");
  assert.doesNotMatch(controlFeedback.transition, /\ball\b/);
  assert.equal(entranceDelay(999), motionTokens.maxDelay);
  assert.equal(entranceDelay(-3), 0);
});
