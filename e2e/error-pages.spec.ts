import { expect, test } from "@playwright/test";

test("an unmatched URL returns the custom 404 and a working home link", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found | Pascack Course Planner");
  await expect(page.getByRole("heading", { name: "This page is out of reach." })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await expect(page.getByRole("main")).toHaveCount(1);
  await page.getByRole("link", { name: "Go home", exact: true }).click();
  await expect(page).toHaveURL("/");
});

test("the 404 works on a small phone without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 640 } });
  try {
    const page = await context.newPage();
    const response = await page.goto("http://localhost:3100/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page is out of reach." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to my home page", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Go home", exact: true }).click();
    await expect(page).toHaveURL("http://localhost:3100/");
  } finally {
    await context.close();
  }
});

test("a missing class keeps workspace navigation and returns home", async ({ page }) => {
  const login = await page.request.get("/api/dev-login?email=error-pages-admin@example.test&role=ADMIN");
  test.skip(login.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(login.ok()).toBeTruthy();
  await page.goto("/courses/this-class-does-not-exist");
  await expect(page.getByRole("heading", { name: "This page is out of reach." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await page.getByRole("link", { name: "Go to my home page", exact: true }).click();
  await expect(page).toHaveURL("/board");
  await expect(page.getByRole("heading", { name: "This page is out of reach." })).toHaveCount(0);
});
