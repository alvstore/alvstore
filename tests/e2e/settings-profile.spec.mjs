import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "admin@alvstore.in";
const password = process.env.E2E_PASSWORD ?? "admin123";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFUlEQVR42mP8z8BQz0BAwogKRlUAADb4An8L4a3xAAAAAElFTkSuQmCC",
  "base64"
);

test("Sidebar hides ALV workspace banner, and redesigned /settings handles profile avatar, appearance, and workspace settings cleanly", async ({
  page,
}) => {
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().includes("/api/backend/")) {
      consoleErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  // 1. Login & check Sidebar on /dashboard
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const sidebar = page.getByRole("complementary", { name: "Workspace sidebar", exact: true });
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByText("ALV workspace")).toHaveCount(0);
  await expect(sidebar.getByText("Administrator access")).toHaveCount(0);

  // 2. Visit /settings & verify Profile Hero + Avatar Upload + Persistence
  await page.goto(`${baseURL}/settings`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Upload Photo|Change Photo/i })).toBeVisible();

  const avatarBtn = page.getByRole("button", { name: /^Upload avatar for / }).first();
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), avatarBtn.click()]);
  await fc.setFiles({ name: "avatar-red.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.getByText("Avatar uploaded")).toBeVisible();

  // Wait for NextAuth session + sidebar/header avatar update and verify persistence on reload
  const heroAvatarImg = page.locator('img[src*="/uploads/profiles/"]').first();
  await expect(heroAvatarImg).toBeVisible();
  const uploadedSrc = await heroAvatarImg.getAttribute("src");
  expect(uploadedSrc).toContain("/api/backend/storage/files/uploads/profiles/");

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(`img[src="${uploadedSrc}"]`).first()).toBeVisible();

  await page.waitForTimeout(250);
  await page.screenshot({ path: "test-results/settings-desktop.png", fullPage: false });

  // Verify mobile layout has zero horizontal overflow and avatar UI is above the fold
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(mobileOverflow).toBeLessThanOrEqual(1);
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/settings-mobile.png", fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Clean up uploaded avatar via Remove Photo button
  await page.getByRole("button", { name: "Remove Photo", exact: true }).click();
  await expect(page.getByText("Profile photo removed")).toBeVisible();

  // 3. Appearance & Theme Gallery + Live Sidebar Toggle
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await expect(page.getByText("Console Color Palette")).toBeVisible();
  await page.getByRole("button", { name: /Forest/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/settings-appearance-desktop.png", fullPage: false });
  await page.getByRole("button", { name: /Obsidian/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "obsidian");

  const compactSwitch = page.getByRole("switch", { name: "Compact Navigation Sidebar", exact: true });
  await compactSwitch.click();
  await expect(page.locator("[data-app-shell-content]")).toHaveCSS("margin-left", "88px");
  await compactSwitch.click();
  await expect(page.locator("[data-app-shell-content]")).toHaveCSS("margin-left", "288px");

  // 4. Verify Business Info, User Management Drawer, Email/SMTP Test button, and Service Categories
  await page.getByRole("button", { name: "Business Info", exact: true }).click();
  await expect(page.getByRole("button", { name: "Upload Logo", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "User Management", exact: true }).click();
  await page.getByRole("button", { name: "Add User", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Add Team Member")).toBeVisible();
  await drawer.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByRole("button", { name: "Email / SMTP", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save & Send Test Email", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Service Categories", exact: true }).click();
  await page.getByRole("button", { name: "Profile", exact: true }).click();

  expect(consoleErrors).toEqual([]);
});
