import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/sidebar-state.ts", "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { isNavigationActive, navigationCategoryForPath, parseSidebarGroups, revealNavigationGroup, sidebarDimensions, sidebarRoleLabel, sidebarIdentity } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const categories = [
  { label: "Overview", items: [{ url: "/dashboard" }] },
  { label: "Sales", items: [{ url: "/sales" }, { url: "/invoices" }] },
  { label: "Collaboration", items: [{ url: "/tasks" }, { url: "/calendar" }] },
];

test("sidebar parent selection matches full path boundaries, not similar prefixes", () => {
  for (const path of ["/invoices", "/invoices/", "/invoices/new", "/invoices/123/edit", "/invoices?status=paid", "/invoices/123#totals"]) assert.equal(isNavigationActive(path, "/invoices"), true, path);
  for (const path of ["/invoice", "/invoices-old", "/invoice/public/123", "/purchase-invoices", "/"]) assert.equal(isNavigationActive(path, "/invoices"), false, path);
  assert.equal(isNavigationActive("/", "/"), true);
  assert.equal(isNavigationActive("/tasks", "/"), false);
  assert.equal(isNavigationActive("/crm", "/customers"), true, "retain selection after the existing customer-list redirect");
  assert.equal(isNavigationActive("/crm/?tab=all", "/customers"), true);
  assert.equal(isNavigationActive("/customers/123", "/crm"), true);
  assert.equal(isNavigationActive("/crm-old", "/customers"), false);
});

test("sidebar category lookup prefers the most specific allowed parent", () => {
  const nested = [...categories, { label: "Invoice creation", items: [{ url: "/invoices/new" }] }];
  assert.equal(navigationCategoryForPath(nested, "/invoices/new"), "Invoice creation");
  assert.equal(navigationCategoryForPath(categories, "/invoices/123/edit"), "Sales");
  assert.equal(navigationCategoryForPath(categories, "/tasks"), "Collaboration");
  assert.equal(navigationCategoryForPath(categories, "/invoices-old"), undefined);
  assert.equal(navigationCategoryForPath([], "/dashboard"), undefined);
  assert.equal(navigationCategoryForPath([{ label: "CRM", items: [{ url: "/customers" }] }], "/crm"), "CRM");
});

test("sidebar stored groups tolerate malformed and non-object localStorage", () => {
  for (const raw of [null, "", "{broken", "null", "false", "true", "22", '"Sales"', '[]', '[false,true]']) assert.deepEqual(parseSidebarGroups(raw, ["Sales"]), {}, String(raw));
});

test("sidebar preferences retain only known boolean keys, without inherited/prototype keys", () => {
  const raw = '{"Sales":false,"Overview":true,"Collaboration":"false","Unknown":false,"__proto__":{"polluted":true},"constructor":false}';
  const groups = parseSidebarGroups(raw, categories.map(category => category.label));
  assert.deepEqual(groups, { Sales: false, Overview: true });
  assert.equal(Object.hasOwn(groups, "__proto__"), false);
  assert.equal(Object.prototype.polluted, undefined);
});

test("deep links reopen only their current group without mutating saved preferences", () => {
  const saved = { Sales: false, Collaboration: false, Overview: true };
  assert.deepEqual(revealNavigationGroup(saved, "Sales"), { Sales: true, Collaboration: false, Overview: true });
  assert.equal(saved.Sales, false);
  assert.equal(revealNavigationGroup(saved, "Overview"), saved);
  assert.equal(revealNavigationGroup(saved, undefined), saved);
  assert.equal(revealNavigationGroup(saved, "Not in this navigation"), saved);
});

test("profile role labels use the same mixed-role precedence as existing navigation", () => {
  assert.equal(sidebarRoleLabel(["admin"]), "Administrator");
  assert.equal(sidebarRoleLabel(["staff"]), "Team member");
  assert.equal(sidebarRoleLabel(["technician"]), "Technician");
  assert.equal(sidebarRoleLabel(["customer"]), "Customer");
  assert.equal(sidebarRoleLabel(["admin", "customer"]), "Customer");
  assert.equal(sidebarRoleLabel(["staff", "technician"]), "Team member");
  assert.equal(sidebarRoleLabel(["admin", "technician"]), "Administrator");
  assert.equal(sidebarRoleLabel([]), "Workspace member");
});

test("profile identity uses actual metadata or email, handling missing values", () => {
  assert.deepEqual(sidebarIdentity("  ALV Admin  ", "other@example.test"), { name: "ALV Admin", initials: "AA" });
  assert.deepEqual(sidebarIdentity(null, "admin@example.test"), { name: "admin", initials: "AD" });
  assert.deepEqual(sidebarIdentity("   ", "sales@example.test"), { name: "sales", initials: "SA" });
  assert.deepEqual(sidebarIdentity({ full_name: "not a string" }), { name: "Your account", initials: "YA" });
});

test("compact/sidebar dimensions retain usable icon targets and mobile clearance", () => {
  assert.ok(sidebarDimensions.compact - 2 * sidebarDimensions.inset >= 64);
  assert.ok(sidebarDimensions.expanded > sidebarDimensions.compact);
  assert.ok(sidebarDimensions.mobile < 320);
  const sidebar = fs.readFileSync("src/components/layout/AppSidebar.tsx", "utf8");
  const layout = fs.readFileSync("src/components/layout/AppLayout.tsx", "utf8");
  for (const component of [sidebar, layout]) assert.match(component, /sidebarDimensions/);
  assert.match(sidebar, /layoutId=\{reduced \|\| mobile \? undefined/);
  assert.match(sidebar, /<Box component=\{motion\.aside\}[^>]*layoutRoot layoutScroll/);
  assert.match(sidebar, /timeout=\{reduced \|\| compact \? 0/);
  assert.match(sidebar, /transitionDuration=\{reduced \? 0/);
});
