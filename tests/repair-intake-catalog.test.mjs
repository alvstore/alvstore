import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { root } from "../tools/check-ui.mjs";

async function importTranspiled(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.React,
    },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("MacBook and iMac resolve to laptop/desktop checklists without mobile-only checks", async () => {
  const {
    getChecklistForDevice,
    getPostRepairChecklistForDevice,
    resolveDeviceProfile,
  } = await importTranspiled("src/lib/repair-catalog.ts");

  assert.equal(resolveDeviceProfile("MacBook"), "laptop");
  assert.equal(resolveDeviceProfile("iMac"), "desktop");
  assert.equal(resolveDeviceProfile("iPad"), "tablet");
  assert.equal(resolveDeviceProfile("iPhone"), "mobile");

  const macbookPre = getChecklistForDevice("MacBook");
  assert.ok(macbookPre.some(i => i.item.includes("Trackpad")));
  assert.ok(!macbookPre.some(i => i.item.includes("Earpiece") || i.item.includes("SIM tray")));

  const imacPre = getChecklistForDevice("iMac");
  assert.ok(imacPre.some(i => i.item.includes("Ethernet")));
  assert.ok(!imacPre.some(i => i.item.includes("Battery") || i.item.includes("Earpiece")));

  const imacPost = getPostRepairChecklistForDevice("iMac");
  assert.ok(!imacPost.some(i => i.item.toLowerCase().includes("touch")), "iMac desktop QC should not require touch screen check");
  assert.ok(imacPost.some(i => i.item.includes("Ethernet")));
});

test("Power-OFF intake marks powered diagnostics N/A while keeping physical and lock checks required", async () => {
  const {
    getChecklistForDevice,
    applyPowerStateToChecklist,
    isPowerDependentChecklistItem,
    summarizeChecklist,
  } = await importTranspiled("src/lib/repair-catalog.ts");

  const items = getChecklistForDevice("iPhone");
  const idx = items.findIndex(c => c.item === "Device turns ON");
  assert.ok(idx >= 0);

  // Simulate user choosing Device turns ON = no
  items[idx].value = "no";
  const offState = applyPowerStateToChecklist(items);
  assert.equal(offState.deviceIsOff, true);

  // Powered functional items must be auto-set to N/A
  const powered = offState.checklist.filter(i => isPowerDependentChecklistItem(i));
  assert.ok(powered.length >= 10);
  assert.ok(powered.every(i => i.value === "na" && i.autoSet === true));

  // Physical Condition, Draws charging current, and Accessories must remain unanswered ("") until inspected
  const physical = offState.checklist.filter(i => i.category === "Physical Condition");
  assert.ok(physical.length >= 5);
  assert.ok(physical.every(i => i.value === ""));

  const locks = offState.checklist.filter(i => i.category === "Accessories & Locks");
  assert.ok(locks.every(i => i.value === ""));

  const chargingDraw = offState.checklist.find(i => i.item === "Draws charging / power current");
  assert.equal(chargingDraw?.value, "");

  const summary = summarizeChecklist(offState.checklist);
  assert.equal(summary.isOff, true);
  assert.equal(summary.autoSkippedCount, powered.length);

  // Toggling back to Yes clears auto-set N/A values cleanly without mutation
  const toggledBack = offState.checklist.map((c, i) => (i === idx ? { ...c, value: "yes" } : c));
  const onState = applyPowerStateToChecklist(toggledBack);
  assert.equal(onState.deviceIsOff, false);
  assert.ok(onState.checklist.filter(i => isPowerDependentChecklistItem(i)).every(i => i.value === "" && !i.autoSet));
});

test("JobSheetCreate wires Apple model catalog, conditional Power-OFF hiding, and SideDrawer confirm gate", () => {
  const createSrc = fs.readFileSync(path.join(root, "src/screens/JobSheetCreate.tsx"), "utf8");
  assert.match(createSrc, /from\("device_models"\)/);
  assert.match(createSrc, /JobSheetConfirmDrawer/);
  assert.match(createSrc, /Override Skipped/);
  assert.match(createSrc, /Finish \/ Color Options/);

  const drawerSrc = fs.readFileSync(path.join(root, "src/components/repairs/JobSheetConfirmDrawer.tsx"), "utf8");
  assert.match(drawerSrc, /<SideDrawer/);
  assert.match(drawerSrc, /useReducedMotion/);
  assert.match(drawerSrc, /Confirm & Create Job Sheet/);

  const detailSrc = fs.readFileSync(path.join(root, "src/screens/JobSheetDetail.tsx"), "utf8");
  assert.match(detailSrc, /getPostRepairChecklistForDevice/);
  assert.match(detailSrc, /\["yes", "no", "na"\]/);
});
