import { test as base, expect } from "@playwright/test";
import fs from "node:fs";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const email = process.env.E2E_EMAIL ?? "admin@alvstore.in";
const password = process.env.E2E_PASSWORD ?? "admin123";
let state;
const test = base.extend({ storageState: async ({}, use) => use(state ?? { cookies: [], origins: [] }) });
const allRoutes = ["/dashboard", "/leads", "/customers", "/follow-ups", "/sales", "/invoices", "/challans", "/inventory", "/apple-pricing", "/pos", "/barcodes", "/finance", "/payment-register", "/suppliers", "/purchase-orders", "/purchase-bills", "/purchase-returns", "/repairs", "/technicians", "/chat", "/tasks", "/calendar", "/employees", "/attendance", "/payroll", "/reports", "/audit-logs", "/settings"];
const desktopSidebar = page => page.getByRole("complementary", { name: "Workspace sidebar", exact: true });
const mobileSidebar = page => page.locator("#mobile-workspace-navigation");
const routes = nav => nav.getByRole("link").evaluateAll(links => links.map(link => link.getAttribute("href")));
async function localAssets(context) {
  await context.route(/^https?:\/\//, route => {
    const host = new URL(route.request().url()).hostname;
    return [new URL(baseURL).hostname, "localhost", "127.0.0.1"].includes(host) || host.endsWith(".e2b.app") ? route.continue() : route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
}
function collectErrors(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", async response => { if (response.status() >= 400 && response.url().includes("/api/backend/")) errors.push(`${response.status()} ${response.url()}`); });
  return errors;
}
async function noOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}
async function activePillAtRest(nav, title) {
  const link = nav.getByRole("link", { name: title, exact: true });
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(nav.locator("[aria-current=page]")).toHaveCount(1);
  await expect(nav.locator("[data-sidebar-active]")).toHaveCount(1);
  await expect.poll(async () => {
    const item = await link.boundingBox(), pill = await link.locator("[data-sidebar-active]").boundingBox();
    return item && pill ? Math.abs(item.x - pill.x) + Math.abs(item.y - pill.y) + Math.abs(item.width - pill.width) + Math.abs(item.height - pill.height) : Infinity;
  }).toBeLessThan(2);
}

// Browser-resolved RGB(A), composited against the actual sidebar/selection surface.
function composite(color, background) {
  const [r, g, b, a = 1] = color.match(/[\d.]+/g).map(Number);
  return [r, g, b].map((value, index) => value * a + background[index] * (1 - a));
}
function luminance(rgb) {
  const linear = rgb.map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test.beforeEach(async ({ context }) => localAssets(context));
test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(".arena/sidebar", { recursive: true });
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await localAssets(context);
  try {
    const page = await context.newPage();
    await page.goto(new URL("/login", baseURL).href, { waitUntil: "networkidle" });
    await page.locator("#email").fill(email); await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    state = await context.storageState();
  } finally { await context.close(); }
});

test("sidebar collapse preserves every route, keyboard focus and saved desktop geometry", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const sidebar = desktopSidebar(page), nav = sidebar.getByRole("navigation", { name: "Main navigation" });
  await expect.poll(() => routes(nav)).toEqual(allRoutes);
  await expect(sidebar).toHaveCSS("width", "264px");
  await expect(sidebar).toHaveCSS("left", "12px");
  await expect(page.locator("[data-app-shell-content]")).toHaveCSS("margin-left", "288px");
  await activePillAtRest(nav, "Dashboard");
  await page.screenshot({ path: ".arena/sidebar/desktop-dark.png", animations: "disabled" });
  const collapse = sidebar.getByRole("button", { name: "Collapse navigation", exact: true });
  await collapse.focus(); await collapse.press("Enter");
  const expand = sidebar.getByRole("button", { name: "Expand navigation", exact: true });
  await expect(expand).toBeFocused(); await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toHaveCSS("width", "64px");
  await expect(page.locator("[data-app-shell-content]")).toHaveCSS("margin-left", "88px");
  await expect.poll(() => routes(nav)).toEqual(allRoutes);
  await nav.getByRole("link", { name: "Dashboard", exact: true }).hover();
  await expect(page.getByRole("tooltip", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("heading", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.screenshot({ path: ".arena/sidebar/desktop-compact.png", animations: "disabled" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(sidebar).toHaveCSS("width", "64px");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sidebarCollapsed"))).toBe("true");
  await sidebar.getByRole("button", { name: "Expand navigation", exact: true }).click();
  await expect(sidebar).toHaveCSS("width", "264px");
  await sidebar.getByRole("link", { name: "Profile and settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/); await activePillAtRest(nav, "Settings");
  await noOverflow(page); expect(errors).toEqual([]);
});

test("sidebar group controls persist and nested routes reveal their current parent", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const sidebar = desktopSidebar(page), nav = sidebar.getByRole("navigation");
  const sales = nav.getByRole("button", { name: "Sales", exact: true });
  await sales.focus(); await sales.press("Space");
  await expect(sales).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "Invoices", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("sidebar-expanded")).Sales)).toBe(false);
  await page.reload({ waitUntil: "networkidle" });
  await expect(sales).toHaveAttribute("aria-expanded", "false");
  await page.goto("/invoices/new", { waitUntil: "networkidle" });
  await expect(sales).toHaveAttribute("aria-expanded", "true");
  await activePillAtRest(nav, "Invoices");
  await nav.getByRole("link", { name: "Quotations", exact: true }).click();
  await expect(page).toHaveURL(/\/sales$/); await activePillAtRest(nav, "Quotations");
  const current = await nav.locator("[aria-current=page]").boundingBox(), scroller = await nav.boundingBox();
  expect(current.y).toBeGreaterThanOrEqual(scroller.y);
  expect(current.y + current.height).toBeLessThanOrEqual(scroller.y + scroller.height);
  await nav.getByRole("link", { name: "Customers", exact: true }).click();
  await expect(page).toHaveURL(/\/crm$/); await activePillAtRest(nav, "Customers");
  expect(errors).toEqual([]);
});

test("sidebar selection motion stays in its fixed panel after document scrolling", async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const nav = desktopSidebar(page).getByRole("navigation");
  await page.evaluate(() => scrollTo({ top: 400, behavior: "instant" }));
  expect(await page.evaluate(() => scrollY)).toBe(400);
  const from = await nav.locator("[data-sidebar-active]").boundingBox();
  await page.evaluate(() => {
    window.__sidebarMotionSamples = [];
    window.__recordSidebarMotion = true;
    const until = performance.now() + 5000;
    function record() {
      if (!window.__recordSidebarMotion || performance.now() > until) return;
      const pill = document.querySelector('aside[aria-label="Workspace sidebar"] [data-sidebar-active]');
      if (pill) window.__sidebarMotionSamples.push({ path: location.pathname, y: pill.getBoundingClientRect().y, transform: getComputedStyle(pill).transform });
      requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  });
  await nav.getByRole("link", { name: "Leads", exact: true }).click();
  await expect(page).toHaveURL(/\/leads$/); await activePillAtRest(nav, "Leads");
  const target = await nav.locator("[data-sidebar-active]").boundingBox();
  const frames = await page.evaluate(() => { window.__recordSidebarMotion = false; return window.__sidebarMotionSamples.filter(frame => frame.path === "/leads"); });
  expect(frames.length).toBeGreaterThan(2);
  expect(frames.some(frame => frame.transform !== "none"), "the normal-motion selection should actually interpolate").toBeTruthy();
  expect(Math.min(...frames.map(frame => frame.y))).toBeGreaterThanOrEqual(Math.min(from.y, target.y) - 12);
  expect(Math.max(...frames.map(frame => frame.y)), "page scroll must not be added to a fixed-panel animation").toBeLessThanOrEqual(Math.max(from.y, target.y) + 12);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(errors).toEqual([]);
});

test("sidebar tolerates corrupt preferences and unavailable sidebar storage", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  for (const raw of ["null", "[]", "{invalid"]) {
    await page.evaluate(value => localStorage.setItem("sidebar-expanded", value), raw);
    await page.reload({ waitUntil: "networkidle" });
    await expect(desktopSidebar(page).getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");
  }
  await page.addInitScript(() => {
    for (const name of ["getItem", "setItem"]) {
      const original = Storage.prototype[name];
      Storage.prototype[name] = function (key, ...args) {
        if (["sidebar-expanded", "sidebarCollapsed"].includes(key)) throw new DOMException("Storage blocked", "SecurityError");
        return original.call(this, key, ...args);
      };
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await desktopSidebar(page).getByRole("button", { name: "Collapse navigation", exact: true }).click();
  await expect(desktopSidebar(page)).toHaveCSS("width", "64px");
  expect(errors).toEqual([]);
});

test("sidebar and header search share one dialog and reset/focus correctly", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const sidebar = desktopSidebar(page), trigger = sidebar.getByRole("button", { name: "Find pages and actions", exact: true });
  const dialog = page.getByRole("dialog", { name: "Quick navigation", exact: true }), search = dialog.getByRole("combobox", { name: "Search navigation" });
  await page.getByRole("button", { name: "Search pages and actions", exact: true }).click();
  await search.fill("No such workflow"); await search.press("Escape");
  await trigger.click(); await expect(search).toHaveValue(""); await expect(search).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await search.press("Escape"); await expect(trigger).toBeFocused();
  await page.keyboard.press("Control+k"); await expect(dialog).toBeVisible();
  await page.keyboard.press("Control+k"); await expect(dialog).not.toBeVisible();
  await sidebar.getByRole("button", { name: "Collapse navigation", exact: true }).click();
  await trigger.click(); await expect(search).toBeFocused();
  await search.fill("Calendar"); await search.press("Enter");
  await expect(page).toHaveURL(/\/calendar$/);
  await activePillAtRest(sidebar.getByRole("navigation"), "Calendar");
  expect(errors).toEqual([]);
});

test("mobile sidebar traps focus, dismisses and hands search off without overlapping modals", async ({ page }) => {
  const errors = collectErrors(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    // MUI correctly aria-hides the page header while its modal drawer is open.
    const open = page.getByRole("button", { name: "Open navigation", exact: true, includeHidden: true }), drawer = mobileSidebar(page);
    await expect(page.locator("[data-app-shell-content]")).toHaveCSS("margin-left", "0px");
    await open.click(); await expect(open).toHaveAttribute("aria-expanded", "true");
    await expect(drawer).toBeVisible();
    const profile = drawer.getByRole("link", { name: "Profile and settings", exact: true });
    const brand = drawer.getByRole("link", { name: "ALVStore workspace home", exact: true });
    await profile.focus(); await page.keyboard.press("Tab"); await expect(brand).toBeFocused();
    await page.keyboard.press("Shift+Tab"); await expect(profile).toBeFocused();
    const footer = await profile.boundingBox(); expect(footer.y + footer.height).toBeLessThanOrEqual(844);
    if (width === 390) {
      await drawer.click({ position: { x: 285, y: 185 } });
      await page.screenshot({ path: ".arena/sidebar/mobile-dark.png", animations: "disabled" });
    }
    await page.keyboard.press("Escape"); await expect(drawer).not.toBeVisible(); await expect(open).toBeFocused();
    await open.click(); await drawer.getByRole("button", { name: "Find pages and actions", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Quick navigation", exact: true });
    await expect(drawer).not.toBeVisible(); await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(dialog.getByRole("combobox")).toBeFocused();
    await dialog.getByRole("combobox").press("Escape");
    await expect(open).toBeFocused(); await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    await noOverflow(page);
  }
  expect(errors).toEqual([]);
});

test("mobile navigation and breakpoint changes close the drawer and unlock the page", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const open = page.getByRole("button", { name: "Open navigation", exact: true }), drawer = mobileSidebar(page);
  await open.click(); await drawer.getByRole("navigation").getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/); await expect(drawer).not.toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await open.click(); await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(drawer).not.toBeVisible(); await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(desktopSidebar(page)).toBeVisible();
  await expect(page.locator("[data-app-shell-content]")).toHaveCSS("margin-left", "288px");
  for (const width of [900, 1024, 1440]) {
    await page.setViewportSize({ width, height: 640 });
    const nav = desktopSidebar(page).getByRole("navigation");
    await activePillAtRest(nav, "Tasks");
    await expect.poll(async () => {
      const item = await nav.getByRole("link", { name: "Tasks", exact: true }).boundingBox(), area = await nav.boundingBox();
      return item.y >= area.y && item.y + item.height <= area.y + area.height;
    }).toBeTruthy();
    const footer = await desktopSidebar(page).getByRole("link", { name: "Profile and settings", exact: true }).boundingBox();
    expect(footer.y + footer.height).toBeLessThanOrEqual(640);
    await noOverflow(page);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await expect(drawer).not.toBeVisible();
  await open.click(); await drawer.getByRole("link", { name: "Profile and settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/); await expect(drawer).not.toBeVisible();
  await noOverflow(page); expect(errors).toEqual([]);
});

test("sidebar uses all seven palettes with readable normal/selected/section text", async ({ page }) => {
  const errors = collectErrors(page), measured = [];
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const sidebar = desktopSidebar(page);
  for (const [label, name] of [["Obsidian", "obsidian"], ["Forest", "forest"], ["Ocean Deep", "ocean"], ["Sunset Ember", "ember"], ["Arctic", "arctic"], ["Midnight Rose", "rose"], ["Donezo", "donezo"]]) {
    await page.getByRole("button", { name: "Change theme", exact: true }).click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", name);
    await expect.poll(async () => {
      const colors = await sidebar.evaluate(node => ({
        surface: getComputedStyle(node).backgroundColor,
        text: getComputedStyle(node.querySelector('a[aria-label="Customers"]')).color,
        section: getComputedStyle(node.querySelector('[data-sidebar-group="Overview"] button')).color,
        selected: getComputedStyle(node.querySelector('a[aria-current="page"]')).color,
        pill: getComputedStyle(node.querySelector('[data-sidebar-active]')).backgroundColor,
      }));
      const surface = composite(colors.surface, [255, 255, 255]), pill = composite(colors.pill, surface);
      const ratios = [contrast(composite(colors.text, surface), surface), contrast(composite(colors.section, surface), surface), contrast(composite(colors.selected, pill), pill)];
      measured.push({ name, minimum: Math.min(...ratios) });
      return Math.min(...ratios);
    }, { message: `${name} sidebar text must meet 4.5:1 contrast` }).toBeGreaterThanOrEqual(4.5);
    if (["forest", "arctic"].includes(name)) await sidebar.screenshot({ path: `.arena/sidebar/sidebar-${name}.png`, animations: "disabled" });
  }
  await page.reload({ waitUntil: "networkidle" }); await expect(page.locator("html")).toHaveAttribute("data-theme", "donezo");
  await page.screenshot({ path: ".arena/sidebar/desktop-light.png", animations: "disabled" });
  fs.writeFileSync(".arena/sidebar/contrast-results.json", JSON.stringify(measured, null, 2));
  expect(errors).toEqual([]);
});

test("sidebar reduced motion is static and print removes navigation and desktop offset", async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const sidebar = desktopSidebar(page);
  await sidebar.getByRole("button", { name: "Collapse navigation", exact: true }).click();
  await expect(sidebar).toHaveCSS("width", "64px");
  await expect(page.locator("[data-app-shell-content]")).toHaveCSS("margin-left", "88px");
  await expect(sidebar.locator("[data-sidebar-active]")).toHaveCSS("transform", "none");
  expect(await sidebar.evaluate(node => Number.parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThanOrEqual(.000011);
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running" && Number(animation.effect?.getTiming().duration) > 1).length)).toBe(0);
  await page.emulateMedia({ media: "print" });
  await expect(sidebar).not.toBeVisible(); await expect(page.locator("[data-app-shell-content]")).toHaveCSS("margin-left", "0px");
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await expect(mobileSidebar(page)).toBeVisible();
  await mobileSidebar(page).getByRole("button", { name: "Close navigation", exact: true }).click();
  await expect(mobileSidebar(page)).not.toBeVisible(); await noOverflow(page);
  expect(errors).toEqual([]);
});

test("sidebar and palette preserve customer, technician, staff and mixed-role navigation", async ({ browser }) => {
  // Only session-role presentation is overridden; this is not an API authorization test.
  for (const [roles, expected, label] of [
    [["customer"], ["/portal", "/chat", "/settings"], "Customer"],
    [["technician"], ["/technicians", "/tasks", "/chat", "/settings"], "Technician"],
    [["staff"], allRoutes, "Team member"],
    [["admin", "customer"], ["/portal", "/chat", "/settings"], "Customer"],
  ]) {
    const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 1000 } });
    await localAssets(context);
    await context.route("**/api/auth/session", async route => {
      const response = await route.fetch(), session = await response.json();
      await route.fulfill({ response, json: { ...session, user: { ...session.user, roles } } });
    });
    try {
      const page = await context.newPage(), errors = collectErrors(page);
      await page.goto(new URL("/settings", baseURL).href, { waitUntil: "networkidle" });
      const sidebar = desktopSidebar(page);
      await expect.poll(() => routes(sidebar.getByRole("navigation"))).toEqual(expected);
      await expect(sidebar.getByRole("link", { name: "Profile and settings", exact: true })).toContainText(label);
      await sidebar.getByRole("button", { name: "Find pages and actions", exact: true }).click();
      const search = page.getByRole("dialog").getByRole("combobox");
      await expect(search).toBeFocused();
      await search.fill("Create invoice");
      if (roles.includes("staff")) await expect(page.getByRole("option", { name: "Create invoice", exact: true })).toBeVisible();
      else await expect(page.getByText("No matching pages or actions", { exact: true })).toBeVisible();
      expect(errors, roles.join(", ")).toEqual([]);
    } finally { await context.close(); }
  }
});
