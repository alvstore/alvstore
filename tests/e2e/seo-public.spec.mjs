import { test, expect } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const PILLAR_CHECKS = [
  { slug: "home-theater-udaipur", ssrText: "Home theater systems", h1: "Home theater systems" },
  { slug: "speakers-udaipur", ssrText: "Speakers &amp; sound architecture", h1: "Speakers & sound architecture" },
  { slug: "projectors-udaipur", ssrText: "4K laser projectors", h1: "4K laser projectors" },
  { slug: "commercial-audio-lounge-cafe-udaipur", ssrText: "Pro sound &amp; ambiance systems", h1: "Pro sound & ambiance systems" },
  { slug: "rgbw-lighting-zigbee-automation-udaipur", ssrText: "RGBW lighting &amp; Zigbee automation", h1: "RGBW lighting & Zigbee automation" },
];

test("Public SSR marketing and Udaipur pillar routes render complete SEO, Schema.org, and GEO metadata with clean visuals", async ({ page, request }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => {
    if (m.type() === "error") errors.push(m.text());
    if (m.type() === "warning" && m.text().includes("THREE.")) errors.push(m.text());
  });

  // 1. Raw SSR checks without JS execution (what OAI-SearchBot / PerplexityBot / Claude-SearchBot see)
  const homeHtml = await (await request.get(`${baseURL}/`)).text();
  expect(homeHtml).toContain("<h1");
  expect(homeHtml).toContain("A room that");
  expect(homeHtml).toContain("Planning a private cinema");
  expect(homeHtml).toContain("Udaipur Specialties");
  expect(homeHtml).toContain("application/ld+json");
  expect(homeHtml).toContain("https://alvstore.com/og-studio.png");

  const contactHtml = await (await request.get(`${baseURL}/contact`)).text();
  expect(contactHtml).toContain('rel="canonical" href="https://alvstore.com/contact"');
  expect(contactHtml).toContain("Talk to the people");
  expect(contactHtml).toContain("ContactPage");

  for (const pillar of PILLAR_CHECKS) {
    const html = await (await request.get(`${baseURL}/${pillar.slug}`)).text();
    expect(html).toContain(`rel="canonical" href="https://alvstore.com/${pillar.slug}"`);
    expect(html).toContain(pillar.ssrText);
    expect(html).toContain("Sector 11");
    expect(html).toContain("application/ld+json");
  }

  const loginHtml = await (await request.get(`${baseURL}/login`)).text();
  expect(loginHtml).toContain("noindex");

  const robotsTxt = await (await request.get(`${baseURL}/robots.txt`)).text();
  expect(robotsTxt).toContain("OAI-SearchBot");
  expect(robotsTxt).toContain("PerplexityBot");
  expect(robotsTxt).toContain("commercial-audio-lounge-cafe-udaipur");

  const llmsTxt = await (await request.get(`${baseURL}/llms.txt`)).text();
  expect(llmsTxt).toContain("# ALVStore");
  expect(llmsTxt).toContain("rgbw-lighting-zigbee-automation-udaipur");

  // 2. Rendered browser checks across / and Udaipur pillars
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("nowhere else.");
  await expect(page.getByRole("heading", { name: "Planning a private cinema", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/seo-home-hero.png" });

  await page.getByRole("heading", { name: "Engineered for homes,", exact: false }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/seo-home-udaipur-solutions.png" });

  await page.getByRole("heading", { name: "Cinema architectures", exact: false }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.getByRole("heading", { name: "Planning a private cinema", exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/seo-home-faq.png" });

  await page.goto(`${baseURL}/commercial-audio-lounge-cafe-udaipur`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pro sound & ambiance systems");
  await page.screenshot({ path: "test-results/seo-lounge-cafe-udaipur.png" });

  await page.goto(`${baseURL}/rgbw-lighting-zigbee-automation-udaipur`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RGBW lighting & Zigbee automation");
  await page.screenshot({ path: "test-results/seo-rgbw-zigbee-udaipur.png" });

  await page.goto(`${baseURL}/contact`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Talk to the people");
  await page.screenshot({ path: "test-results/seo-contact.png" });

  expect(errors).toEqual([]);
});
