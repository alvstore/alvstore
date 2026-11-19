import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { toJsonValue } from "../src/lib/serialize.js";

test("Prisma decimals serialize as numbers, including nested query relations", () => {
  const decimal = new Prisma.Decimal("1234.56");
  assert.equal(toJsonValue(decimal), 1234.56);
  assert.deepEqual(toJsonValue({ selling_price: decimal, items: [{ total: new Prisma.Decimal(0) }, { total: new Prisma.Decimal("-2.5") }], at: new Date("2026-11-18T00:00:00Z"), count: 5n }), { selling_price: 1234.56, items: [{ total: 0 }, { total: -2.5 }], at: "2026-11-18T00:00:00.000Z", count: 5 });
});
test("ordinary JSON is preserved, not mistaken for internal decimal fields", () => {
  const value = { s: 1, e: 2, d: [123], nested: [null, true, "name"] };
  assert.deepEqual(toJsonValue(value), value);
  assert.equal(toJsonValue(null), null);
  assert.equal(toJsonValue(undefined), undefined);
});
