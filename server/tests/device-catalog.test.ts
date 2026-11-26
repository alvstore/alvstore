import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_APPLE_MODELS,
  DEFAULT_DEVICE_BRANDS,
  DEFAULT_DEVICE_TYPES,
  DEFAULT_SERVICE_CHARGE_CATEGORIES,
} from "../src/lib/default-device-catalog.js";

test("default device catalog covers Apple ecosystem models with colors and storage options", () => {
  assert.ok(DEFAULT_DEVICE_BRANDS.includes("Apple"));
  for (const requiredType of ["iPhone", "iPad", "MacBook", "iMac", "Mac mini / Studio", "Apple Watch"]) {
    assert.ok(DEFAULT_DEVICE_TYPES.includes(requiredType), `Missing device type ${requiredType}`);
  }

  for (const requiredCharge of ["iPhone", "iPad", "MacBook", "iMac", "Laptop", "Tablet", "Android", "Other"]) {
    assert.ok(
      DEFAULT_SERVICE_CHARGE_CATEGORIES.some(([name]) => name === requiredCharge),
      `Missing service charge category ${requiredCharge}`,
    );
  }

  const byType = new Map<string, typeof DEFAULT_APPLE_MODELS[number][]>();
  for (const m of DEFAULT_APPLE_MODELS) {
    assert.equal(m.brand, "Apple");
    assert.ok(m.name.trim().length > 0);
    assert.ok(m.color_options.length > 0, `${m.name} must define color swatches`);
    assert.ok(m.storage_options.length > 0, `${m.name} must define storage options`);
    for (const color of m.color_options) {
      assert.ok(color.name.trim().length > 0);
      assert.match(color.hex, /^#[0-9A-Fa-f]{6}$/, `${m.name} color ${color.name} has invalid hex`);
    }
    byType.set(m.device_type, [...(byType.get(m.device_type) ?? []), m]);
  }

  assert.ok((byType.get("iPhone")?.length ?? 0) >= 15, "Expected iPhone lineup seeded");
  assert.ok((byType.get("iPad")?.length ?? 0) >= 8, "Expected iPad lineup seeded");
  assert.ok((byType.get("MacBook")?.length ?? 0) >= 6, "Expected MacBook lineup seeded");
  assert.ok((byType.get("iMac")?.length ?? 0) >= 4, "Expected iMac lineup seeded");

  const macbook14 = DEFAULT_APPLE_MODELS.find(m => m.name.includes('MacBook Pro 14"'));
  assert.ok(macbook14?.color_options.some(c => c.name === "Space Black"));
  const imac24 = DEFAULT_APPLE_MODELS.find(m => m.name.includes('iMac 24" (M4)'));
  assert.ok(imac24?.color_options.some(c => c.name === "Orange"));
  assert.ok(imac24?.color_options.some(c => c.name === "Blue"));
});
