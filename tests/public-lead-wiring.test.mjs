import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { root } from "../tools/check-ui.mjs";

test("VisitSection submits consultation enquiries to backend public-lead function without exposing leads table publicly", () => {
  const visitSrc = fs.readFileSync(path.join(root, "src/components/studio/VisitSection.tsx"), "utf8");
  const dataRoutesSrc = fs.readFileSync(path.join(root, "server/src/routes/data.ts"), "utf8");
  const functionsRoutesSrc = fs.readFileSync(path.join(root, "server/src/routes/functions.ts"), "utf8");

  assert.match(visitSrc, /functions\.invoke\(["']public-lead["']/);
  assert.match(visitSrc, /STUDIO_ROOM_SELECT_EVENT/);
  assert.match(visitSrc, /https:\/\/wa\.me\//);

  // Leads table must stay blocked from arbitrary anonymous data-query writes
  assert.doesNotMatch(dataRoutesSrc, /PUBLIC_WRITE[\s\S]*?"leads"/);
  // Dedicated public-lead endpoint must be mounted without requireAuth
  assert.match(functionsRoutesSrc, /functionsRouter\.post\(["']\/public-lead["']/);
});
