import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { decomposeColor, getContrastRatio } from "@mui/material/styles";
import { root } from "../tools/check-ui.mjs";

async function importTs(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

function blendOver(fgRgba, bgHex) {
  const fg = decomposeColor(fgRgba).values;
  const bg = decomposeColor(bgHex).values;
  const a = fg.length === 4 ? fg[3] : 1;
  const r = Math.round((1 - a) * bg[0] + a * fg[0]);
  const g = Math.round((1 - a) * bg[1] + a * fg[1]);
  const b = Math.round((1 - a) * bg[2] + a * fg[2]);
  return `rgb(${r}, ${g}, ${b})`;
}

test("pastelPillColors guarantees >= 4.5:1 WCAG AA contrast across light and dark theme surfaces", async () => {
  const { pastelPillColors } = await importTs("src/lib/pill-style.ts");
  const sampleColors = [
    "#6366f1", // Arctic indigo
    "#8b5cf6", // Obsidian violet
    "#065f46", // Forest emerald
    "#06b6d4", // Ocean cyan
    "#f59e0b", // Ember amber / warning
    "#ec4899", // Rose pink
    "#22c55e", // Success green
    "#3b82f6", // Info blue
    "#ef4444", // Destructive red
  ];

  for (const base of sampleColors) {
    const lightPill = pastelPillColors(base, "#ffffff", false);
    const lightBg = blendOver(lightPill.backgroundColor, "#ffffff");
    const lightRatio = getContrastRatio(lightPill.color, lightBg);
    assert.ok(lightRatio >= 4.5, `Light contrast ${lightRatio.toFixed(2)} < 4.5 for ${base}`);

    const darkPill = pastelPillColors(base, "#121212", true);
    const darkBg = blendOver(darkPill.backgroundColor, "#121212");
    const darkRatio = getContrastRatio(darkPill.color, darkBg);
    assert.ok(darkRatio >= 4.5, `Dark contrast ${darkRatio.toFixed(2)} < 4.5 for ${base}`);
  }
});

test("SideDrawer and MetricStrip are exported cleanly and SideDrawer enforces modal accessibility and busy locks", () => {
  const indexSrc = fs.readFileSync(path.join(root, "src/components/mui/index.ts"), "utf8");
  const drawerSrc = fs.readFileSync(path.join(root, "src/components/mui/SideDrawer.tsx"), "utf8");
  const stripSrc = fs.readFileSync(path.join(root, "src/components/mui/MetricStrip.tsx"), "utf8");

  assert.match(indexSrc, /export \{ SideDrawer/);
  assert.match(indexSrc, /export \{ MetricStrip/);
  assert.match(drawerSrc, /role:\s*["']dialog["']/);
  assert.match(drawerSrc, /"aria-modal":\s*true/);
  assert.match(drawerSrc, /if\s*\(\s*!busy\s*\)\s*onClose\(\)/);
  assert.match(stripSrc, /CountUp/);
});
