import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const requiredKit = ["AnimatedPage", "PageHeader", "StatCard", "DataTable", "FormDialog", "ConfirmDialog", "SearchToolbar", "StatusChip", "EmptyState"];
export function filesIn(directory, suffix = /\.[jt]sx?$/) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file, suffix) : suffix.test(entry.name) ? [file] : [];
  });
}

/** AST guardrails for future screens: one UI system, shared page/motion primitives. */
export function auditUi() {
  const errors = [];
  const screens = filesIn(path.join(root, "src/screens"), /\.tsx$/);
  const adoption = Object.fromEntries(requiredKit.map(name => [name, 0]));
  const report = (file, node, message, source) => errors.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`);
  if (fs.existsSync(path.join(root, "src/components/ui"))) errors.push("Legacy src/components/ui/ must not exist");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (/^@radix-ui\/|tailwind|^sonner$|^vaul$|^cmdk$/.test(name)) errors.push(`Legacy UI dependency: ${name}`);
  }
  for (const name of requiredKit) {
    if (!fs.existsSync(path.join(root, `src/components/mui/${name}.tsx`))) errors.push(`Missing shared component: ${name}`);
  }
  for (const file of filesIn(path.join(root, "src"))) {
    const text = fs.readFileSync(file, "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const screen = screens.includes(file);
    let clientDirectives = 0;
    let hasPage = false;
    const usedKit = new Set();
    function scan(node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        if (/components\/ui(?:\/|$)|^@radix-ui\/|tailwind|^sonner$/.test(node.moduleSpecifier.text)) report(file, node, "Legacy UI import", source);
      }
      if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === "use client") {
        if (++clientDirectives > 1 || source.statements[0] !== node) report(file, node, '"use client" must occur once, before imports', source);
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        if (tag === "AnimatedPage") hasPage = true;
        if (requiredKit.includes(tag)) usedKit.add(tag);
        if (tag.startsWith("motion.")) report(file, node, "Wrap motion in Box component={motion.*}", source);
        const attributes = node.attributes.properties;
        const component = attributes.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === "component");
        if (tag === "Stack" && component?.initializer?.getText(source).includes("motion.")) report(file, node, "Use Box, never Stack, as a motion host", source);
        for (const attribute of attributes) {
          if (!ts.isJsxAttribute(attribute)) continue;
          if (attribute.name.getText(source) === "className") {
            // A non-styling browser translation opt-out on the root html is intentional.
            if (!(tag === "html" && attribute.initializer && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === "notranslate")) report(file, attribute, "Use sx, not CSS utility classes", source);
          }
        }
        if ((file.includes(`${path.sep}screens${path.sep}`) || file.includes(`${path.sep}components${path.sep}`)) && ["div", "span", "p", "h1", "h2", "button", "input", "textarea", "select", "table"].includes(tag)) report(file, node, "Use a MUI component (SVG/canvas drawing is allowed)", source);
      }
      if (ts.isPropertyAssignment(node) && node.name.getText(source).replace(/["']/g, "") === "pin" && node.initializer.kind !== ts.SyntaxKind.FalseKeyword) report(file, node, "GSAP pin is forbidden; use CSS sticky", source);
      ts.forEachChild(node, scan);
    }
    scan(source);
    if (screen) {
      if (!hasPage) errors.push(`${path.relative(root, file)}: Missing AnimatedPage`);
      for (const name of usedKit) adoption[name]++;
    }
  }
  const css = fs.readFileSync(path.join(root, "src/index.css"), "utf8");
  if (/@tailwind|@apply/.test(css)) errors.push("CSS must not depend on Tailwind");
  return { screens: screens.length, adoption, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditUi();
  console.log(`MUI screen audit: ${result.screens} screens`);
  console.table(result.adoption);
  if (result.errors.length) { console.error(result.errors.join("\n")); process.exitCode = 1; }
  else console.log("No legacy UI, utility classes, unsafe motion hosts, or GSAP pins found.");
}
