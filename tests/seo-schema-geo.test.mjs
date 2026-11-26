import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { root } from "../tools/check-ui.mjs";

async function importTs(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("Schema.org JSON-LD graphs are valid, current (no FAQPage/deprecated types), and complete", async () => {
  const {
    HOME_METADATA,
    CONTACT_METADATA,
    PRIVATE_NOINDEX_METADATA,
    buildHomeJsonLd,
    buildContactJsonLd,
  } = await importTs("src/lib/seo-metadata.ts");

  assert.ok(String(HOME_METADATA.title).length <= 60);
  assert.ok(String(HOME_METADATA.description).length >= 120 && String(HOME_METADATA.description).length <= 160);
  assert.ok(String(CONTACT_METADATA.title).length <= 60);
  assert.ok(String(CONTACT_METADATA.description).length >= 120 && String(CONTACT_METADATA.description).length <= 160);
  assert.equal(PRIVATE_NOINDEX_METADATA.robots.index, false);

  const homeLd = buildHomeJsonLd();
  const contactLd = buildContactJsonLd();
  for (const doc of [homeLd, contactLd]) {
    assert.equal(doc["@context"], "https://schema.org");
    assert.ok(Array.isArray(doc["@graph"]) && doc["@graph"].length >= 4);
    const serialized = JSON.stringify(doc);
    for (const banned of ['"FAQPage"', '"HowTo"', '"SpecialAnnouncement"', '"VehicleListing"', '"CourseInfo"']) {
      assert.doesNotMatch(serialized, new RegExp(banned));
    }
    const org = doc["@graph"].find(n => n["@id"] === "https://alvstore.com/#organization");
    assert.ok(org?.image?.includes("https://alvstore.com/og-studio.png"));
    assert.ok(org?.hasOfferCatalog?.itemListElement?.length >= 4);
  }
  assert.ok(contactLd["@graph"].some(n => n["@type"] === "ContactPage"));
  assert.ok(fs.existsSync(path.join(root, "public/og-studio.png")));
});

test("Public landing and contact pages render SSR content cleanly without global canonical collisions", () => {
  const rootLayout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  assert.doesNotMatch(rootLayout, /alternates:\s*\{\s*canonical:/);

  for (const routeFile of ["src/app/page.tsx", "src/app/contact/page.tsx"]) {
    const src = fs.readFileSync(path.join(root, routeFile), "utf8");
    assert.doesNotMatch(src, /["']use client["']/);
    assert.doesNotMatch(src, /ssr:\s*false/);
    assert.match(src, /export const metadata/);
    assert.match(src, /application\/ld\+json/);
  }
});

test("robots.txt, llms.txt, sitemap.xml, and private noindex layouts protect internal and customer-token routes", () => {
  const robots = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");
  for (const bot of ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot", "GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended"]) {
    assert.match(robots, new RegExp(`User-agent:\\s*${bot}`));
  }
  assert.match(robots, /Disallow:\s*\/api\//);
  assert.match(robots, /Disallow:\s*\/job\//);
  assert.match(robots, /Sitemap:\s*https:\/\/alvstore\.com\/sitemap\.xml/);

  assert.ok(fs.existsSync(path.join(root, "public/llms.txt")));
  const sitemap = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
  assert.match(sitemap, /https:\/\/alvstore\.com\/contact/);
  assert.match(sitemap, /<lastmod>/);

  for (const layout of [
    "src/app/(app)/layout.tsx",
    "src/app/login/layout.tsx",
    "src/app/job/layout.tsx",
    "src/app/invoice/layout.tsx",
    "src/app/delivery-report/layout.tsx",
    "src/app/sales/public/layout.tsx",
  ]) {
    const src = fs.readFileSync(path.join(root, layout), "utf8");
    assert.match(src, /PRIVATE_NOINDEX_METADATA/);
  }
});
