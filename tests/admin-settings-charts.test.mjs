import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const compileUrl = (filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
};

const { primaryUserRole } = await import(compileUrl("src/lib/sidebar-state.ts"));
const { replaceUserRole, isValidAppRole } = await import(compileUrl("server/src/lib/user-roles.ts"));
const { resolveHikvisionCredentials } = await import(compileUrl("server/src/lib/hikvision-config.ts"));
const {
  categoricalChartPalette,
  colorHueDegrees,
  hueDistance,
  sharePercent,
  sortChronologicalTrend,
} = await import(compileUrl("src/lib/chart-theme.ts"));

test("primaryUserRole picks highest-precedence role across duplicate legacy user_roles rows", () => {
  assert.equal(primaryUserRole(["staff", "admin"]), "admin");
  assert.equal(primaryUserRole(["staff", "technician"]), "technician");
  assert.equal(primaryUserRole(["staff", "customer"]), "customer");
  assert.equal(primaryUserRole(["staff"]), "staff");
  assert.equal(primaryUserRole([]), "staff");
});

test("replaceUserRole inserts/retains target role before cleaning conflicting rows atomically", async () => {
  const calls = [];
  const fakeDb = {
    async query(sql, params) {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return { rows: [] };
    },
  };

  await replaceUserRole(fakeDb, "user-123", "admin");
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /^INSERT INTO public\.user_roles .* ON CONFLICT \(user_id, role\) DO NOTHING/);
  assert.deepEqual(calls[0].params, ["user-123", "admin"]);
  assert.match(calls[1].sql, /^DELETE FROM public\.user_roles WHERE user_id = \$1::uuid AND role <> \$2::public\.app_role/);
  assert.deepEqual(calls[1].params, ["user-123", "admin"]);

  assert.equal(isValidAppRole("admin"), true);
  assert.equal(isValidAppRole("superuser"), false);
  await assert.rejects(() => replaceUserRole(fakeDb, "user-123", "invalid_role"), /Invalid role/);
  await assert.rejects(() => replaceUserRole(fakeDb, "", "admin"), /user_id is required/);
});

test("resolveHikvisionCredentials prefers frontend settings over env fallback cleanly", () => {
  const emptyEnv = { hikPartnerAppKey: "", hikPartnerSecretKey: "", hikWebhookSignSecret: "" };
  const filledEnv = { hikPartnerAppKey: "env-app", hikPartnerSecretKey: "env-sec", hikWebhookSignSecret: "env-hook" };

  assert.deepEqual(resolveHikvisionCredentials(undefined, emptyEnv), {
    appKey: "",
    secretKey: "",
    webhookSignSecret: "",
    source: "none",
    hasDbCredentials: false,
    hasEnvCredentials: false,
    hasWebhookSecret: false,
  });

  const fromEnv = resolveHikvisionCredentials({}, filledEnv);
  assert.equal(fromEnv.source, "env");
  assert.equal(fromEnv.appKey, "env-app");
  assert.equal(fromEnv.secretKey, "env-sec");

  const fromSettings = resolveHikvisionCredentials(
    {
      hik_partner_app_key: " ui-app ",
      hik_partner_secret_key: " ui-sec ",
      hik_webhook_sign_secret: " ui-hook ",
    },
    filledEnv
  );
  assert.equal(fromSettings.source, "settings");
  assert.equal(fromSettings.appKey, "ui-app");
  assert.equal(fromSettings.secretKey, "ui-sec");
  assert.equal(fromSettings.webhookSignSecret, "ui-hook");
  assert.equal(fromSettings.hasDbCredentials, true);
  assert.equal(fromSettings.hasEnvCredentials, true);
  assert.equal(fromSettings.hasWebhookSecret, true);
});

test("categoricalChartPalette produces distinct colors even on monochrome-accent themes", () => {
  const amberLikeTheme = {
    palette: {
      mode: "dark",
      primary: { main: "#f59e0b" },
      info: { main: "#3b82f6" },
      success: { main: "#22c55e" },
      warning: { main: "#f59e0b" },
    },
  };
  const palette = categoricalChartPalette(amberLikeTheme);
  assert.ok(palette.length >= 5);
  assert.equal(palette[0], "#f59e0b");
  const hues = palette.map(colorHueDegrees);
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      assert.ok(hueDistance(hues[i], hues[j]) >= 34, `Colors ${palette[i]} and ${palette[j]} collided in hue`);
    }
  }
});

test("sortChronologicalTrend orders sales ascending regardless of descending API order", () => {
  const rows = [
    { created_at: "2026-11-18T14:00:00Z", total: 300 },
    { created_at: "2026-11-16T09:00:00Z", total: 100 },
    { created_at: "2026-11-18T08:00:00Z", total: 200 },
    { created_at: "2026-11-17T10:00:00Z", total: 150 },
  ];
  const sorted = sortChronologicalTrend(rows);
  assert.deepEqual(
    sorted.map((pt) => [pt.isoDate, pt.total]),
    [
      ["2026-11-16", 100],
      ["2026-11-17", 150],
      ["2026-11-18", 500],
    ]
  );
  assert.equal(sharePercent(25, 100), 25);
  assert.equal(sharePercent(10, 0), 0);
});
