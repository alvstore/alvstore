import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createTheme, alpha } from "@mui/material/styles";
import { auditUi, root } from "../tools/check-ui.mjs";

async function importTypescript(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("all 58 screens use the MUI kit without legacy UI/Tailwind or unsafe motion", () => {
  const result = auditUi();
  assert.equal(result.screens, 58);
  assert.deepEqual(result.errors, []);
  assert.equal(result.adoption.AnimatedPage, 58);
  for (const component of ["PageHeader", "StatCard", "DataTable", "FormDialog", "SearchToolbar", "StatusChip"]) assert.ok(result.adoption[component] > 0, `${component} must be used by screens`);
});

test("theme tokens produce valid MUI light/dark/alpha colors", async () => {
  const { themeColor } = await importTypescript("src/lib/theme-color.ts");
  assert.equal(themeColor(undefined, "#fff"), "#fff");
  assert.equal(themeColor("0 0% 100% / 0.05", "#fff"), "hsla(0, 0%, 100%, 0.05)");
  for (const token of ["258 90% 66%", "160 84% 20%", "187 92% 43%", "38 92% 50%", "239 84% 67%", "330 81% 60%", "152 69% 31%"] ) {
    const color = themeColor(token, "#fff");
    const theme = createTheme({ palette: { primary: { main: color } } });
    for (const value of [theme.palette.primary.light, theme.palette.primary.dark, alpha(color, 0.12)]) assert.doesNotMatch(value, /NaN|undefined/);
  }
});

test("sx composition keeps conditional styles, arrays, callbacks, and selectors", async () => {
  const { mergeSx } = await importTypescript("src/components/mui/merge-sx.ts");
  const base = { p: 2, "&:hover": { opacity: 0.7 } };
  const callback = theme => ({ color: theme.palette.primary.main });
  assert.deepEqual(mergeSx(base, false, undefined, null, [{ mt: 1 }, callback]), [base, { mt: 1 }, callback]);
});

test("all Auth.js preview cookies are host-only, Secure, SameSite=None and partitioned", () => {
  const source = fs.readFileSync(path.join(root, "src/auth.ts"), "utf8");
  const ast = ts.createSourceFile("auth.ts", source, ts.ScriptTarget.Latest, true);
  const cookies = new Map();
  function scan(node) {
    if (ts.isPropertyAssignment(node) && ["sessionToken", "csrfToken", "callbackUrl"].includes(node.name.getText(ast))) {
      const text = node.initializer.getText(ast);
      cookies.set(node.name.getText(ast), text);
    }
    ts.forEachChild(node, scan);
  }
  scan(ast);
  assert.equal(cookies.size, 3);
  for (const value of cookies.values()) {
    assert.match(value, /name:\s*"__Host-alv\./);
    assert.match(value, /sameSite:\s*"none"/);
    assert.match(value, /secure:\s*true/);
    assert.match(value, /partitioned:\s*true/);
    assert.match(value, /path:\s*"\/"/);
    assert.doesNotMatch(value, /domain:/i);
  }
  for (const name of ["sessionToken", "csrfToken"]) assert.match(cookies.get(name), /httpOnly:\s*true/);
  assert.doesNotMatch(source, /skipCSRFCheck/);
});

test("the page shell does not suppress first-load reveals and widget staggering stays bounded", () => {
  const shell = fs.readFileSync(path.join(root, "src/components/layout/AppLayout.tsx"), "utf8");
  const section = fs.readFileSync(path.join(root, "src/components/mui/MotionSection.tsx"), "utf8");
  assert.doesNotMatch(shell, /<AnimatePresence[^>]*initial=\{false\}/);
  assert.match(section, /whileInView=/);
  assert.match(section, /once:\s*true/);
  assert.match(section, /entranceDelay\(index\)/);
  assert.match(section, /@media print/);
});
