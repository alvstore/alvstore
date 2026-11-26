import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { root } from "../tools/check-ui.mjs";

test("Three.js studio scenes avoid deprecated Clock and removed PCFSoftShadowMap", () => {
  for (const rel of [
    "src/components/studio/cinema-room-3d.ts",
    "src/components/studio/gallery-scene.ts",
  ]) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(src, /THREE\.Clock\b/);
    assert.doesNotMatch(src, /THREE\.PCFSoftShadowMap\b/);
    assert.match(src, /THREE\.Timer\b/);
    assert.match(src, /THREE\.PCFShadowMap\b/);
    assert.match(src, /timer\.dispose\(\)/);
  }
});
