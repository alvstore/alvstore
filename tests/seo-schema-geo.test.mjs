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

test("Schema.org JSON-LD graphs are valid, current (no FAQPage/deprecated types), and complete across all Udaipur pillars", async () => {
  const { UDAIPUR_PILLARS } = await importTs("src/lib/udaipur-pillars.ts");
  assert.equal(UDAIPUR_PILLARS.length, 5);

  const metaSrc = fs
    .readFileSync(path.join(root, "src/lib/seo-metadata.ts"), "utf8")
    .replace('from "./udaipur-pillars"', 'from "./udaipur-pillars-stub"');
  void metaSrc;

  // Test real compiled metadata using ts compiler resolution on local files
  const compileAndLoad = async (entryFile) => {
    const abs = path.join(root, entryFile);
    const source = fs.readFileSync(abs, "utf8");
    const rewritten = source.replace(/from\s+["']\.\/udaipur-pillars["']/g, () => {
      const pillarsCode = fs.readFileSync(path.join(root, "src/lib/udaipur-pillars.ts"), "utf8");
      const { outputText } = ts.transpileModule(pillarsCode, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      });
      return `from "data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}"`;
    });
    const { outputText } = ts.transpileModule(rewritten, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    });
    return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
  };

  const {
    HOME_METADATA,
    CONTACT_METADATA,
    PRIVATE_NOINDEX_METADATA,
    buildSolutionMetadata,
    buildHomeJsonLd,
    buildContactJsonLd,
    buildSolutionJsonLd,
  } = await compileAndLoad("src/lib/seo-metadata.ts");

  assert.ok(String(HOME_METADATA.title).length <= 60);
  assert.match(String(HOME_METADATA.title), /Udaipur/i);
  assert.ok(String(HOME_METADATA.description).length >= 120 && String(HOME_METADATA.description).length <= 160);
  assert.equal(HOME_METADATA.robots?.index, true);
  assert.ok(String(CONTACT_METADATA.title).length <= 60);
  assert.ok(String(CONTACT_METADATA.description).length >= 120 && String(CONTACT_METADATA.description).length <= 160);
  assert.equal(CONTACT_METADATA.robots?.index, true);
  assert.equal(PRIVATE_NOINDEX_METADATA.robots.index, false);

  const graphs = [buildHomeJsonLd(), buildContactJsonLd()];
  for (const pillar of UDAIPUR_PILLARS) {
    const m = buildSolutionMetadata(pillar);
    assert.ok(String(m.title).length <= 60, `Title too long for ${pillar.slug}: ${m.title}`);
    assert.match(String(m.title), /Udaipur/i);
    assert.ok(
      String(m.description).length >= 120 && String(m.description).length <= 160,
      `Description length (${String(m.description).length}) out of bounds for ${pillar.slug}`,
    );
    assert.equal(m.alternates?.canonical, `https://alvstore.com/${pillar.slug}`);
    assert.equal(m.robots?.index, true);
    const ld = buildSolutionJsonLd(pillar);
    assert.ok(ld["@graph"].some((n) => n["@type"] === "Service"), `Missing Service node on ${pillar.slug}`);
    graphs.push(ld);
  }

  for (const doc of graphs) {
    assert.equal(doc["@context"], "https://schema.org");
    assert.ok(Array.isArray(doc["@graph"]) && doc["@graph"].length >= 4);
    const serialized = JSON.stringify(doc);
    for (const banned of ['"FAQPage"', '"HowTo"', '"SpecialAnnouncement"', '"VehicleListing"', '"CourseInfo"']) {
      assert.doesNotMatch(serialized, new RegExp(banned));
    }
    const org = doc["@graph"].find((n) => n["@id"] === "https://alvstore.com/#organization");
    assert.ok(org?.image?.includes("https://alvstore.com/og-studio.png"));
    assert.ok(org?.hasOfferCatalog?.itemListElement?.length >= 6);
    assert.ok(org?.areaServed?.some((a) => a.name === "Udaipur"));
  }
  assert.ok(graphs[1]["@graph"].some((n) => n["@type"] === "ContactPage"));
  assert.ok(fs.existsSync(path.join(root, "public/og-studio.png")));
});

test("Public landing, contact, and Udaipur pillar pages render SSR content cleanly without global canonical collisions", () => {
  const rootLayout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  assert.doesNotMatch(rootLayout, /alternates:\s*\{\s*canonical:/);
  assert.match(rootLayout, /index:\s*false/);

  const legacyRoute = fs.readFileSync(path.join(root, "src/app/home-theater/page.tsx"), "utf8");
  assert.match(legacyRoute, /permanentRedirect/);

  for (const routeFile of [
    "src/app/page.tsx",
    "src/app/contact/page.tsx",
    "src/app/home-theater-udaipur/page.tsx",
    "src/app/speakers-udaipur/page.tsx",
    "src/app/projectors-udaipur/page.tsx",
    "src/app/commercial-audio-lounge-cafe-udaipur/page.tsx",
    "src/app/rgbw-lighting-zigbee-automation-udaipur/page.tsx",
  ]) {
    const src = fs.readFileSync(path.join(root, routeFile), "utf8");
    assert.doesNotMatch(src, /["']use client["']/);
    assert.doesNotMatch(src, /ssr:\s*false/);
    assert.match(src, /export const metadata/);
    assert.match(src, /application\/ld\+json/);
  }
});

test("robots.txt, llms.txt, sitemap.xml, and private noindex layouts cover all Udaipur pillars and protect internal routes", () => {
  const robots = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");
  for (const bot of [
    "OAI-SearchBot",
    "ChatGPT-User",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "Perplexity-User",
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
    "Applebot-Extended",
  ]) {
    assert.match(robots, new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?Content-Signal:`));
  }
  assert.match(robots, /Disallow:\s*\/api\//);
  assert.match(robots, /Disallow:\s*\/job\//);
  assert.match(robots, /Disallow:\s*\/challan\//);
  assert.match(robots, /Sitemap:\s*https:\/\/alvstore\.com\/sitemap\.xml/);

  const llms = fs.readFileSync(path.join(root, "public/llms.txt"), "utf8");
  const sitemap = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
  for (const slug of [
    "home-theater-udaipur",
    "speakers-udaipur",
    "projectors-udaipur",
    "commercial-audio-lounge-cafe-udaipur",
    "rgbw-lighting-zigbee-automation-udaipur",
    "contact",
  ]) {
    assert.match(sitemap, new RegExp(`https://alvstore\\.com/${slug}`));
    assert.match(robots, new RegExp(`Allow:\\s*/${slug}`));
    assert.match(llms, new RegExp(`https://alvstore\\.com/${slug}`));
  }
  assert.match(sitemap, /<lastmod>/);

  for (const layout of [
    "src/app/(app)/layout.tsx",
    "src/app/login/layout.tsx",
    "src/app/job/layout.tsx",
    "src/app/invoice/layout.tsx",
    "src/app/challan/layout.tsx",
    "src/app/delivery-report/layout.tsx",
    "src/app/sales/public/layout.tsx",
  ]) {
    const src = fs.readFileSync(path.join(root, layout), "utf8");
    assert.match(src, /PRIVATE_NOINDEX_METADATA/);
  }

  const nextConfig = fs.readFileSync(path.join(root, "next.config.mjs"), "utf8");
  assert.match(nextConfig, /www\.alvstore\.com/);
  assert.match(nextConfig, /Strict-Transport-Security/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /Referrer-Policy/);
});
