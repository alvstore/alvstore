import { test, expect } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test("Public SSR marketing routes render complete SEO, Schema.org, and GEO metadata with clean visuals", async ({ page, request }) => {
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
  expect(homeHtml).toContain("application/ld+json");
  expect(homeHtml).toContain("https://alvstore.com/og-studio.png");

  const contactHtml = await (await request.get(`${baseURL}/contact`)).text();
  expect(contactHtml).toContain('rel="canonical" href="https://alvstore.com/contact"');
  expect(contactHtml).toContain("Talk to the people");
  expect(contactHtml).toContain("ContactPage");

  const loginHtml = await (await request.get(`${baseURL}/login`)).text();
  expect(loginHtml).toContain("noindex");

  const robotsTxt = await (await request.get(`${baseURL}/robots.txt`)).text();
  expect(robotsTxt).toContain("OAI-SearchBot");
  expect(robotsTxt).toContain("PerplexityBot");

  const llmsTxt = await (await request.get(`${baseURL}/llms.txt`)).text();
  expect(llmsTxt).toContain("# ALVStore");

  // 2. Rendered browser checks on / and /contact
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("nowhere else.");
  await expect(page.getByRole("heading", { name: "Planning a private cinema", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/seo-home-hero.png" });

  await page.getByRole("heading", { name: "Cinema architectures", exact: false }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.getByRole("heading", { name: "Planning a private cinema", exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/seo-home-faq.png" });

  await page.goto(`${baseURL}/contact`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Talk to the people");
  await page.screenshot({ path: "test-results/seo-contact.png" });

  expect(errors).toEqual([]);
});
