import { expect, test } from "@playwright/test";

test("a course that fits no subject moves to Other Programs from the catalog list", async ({ page }) => {
  const response = await page.request.get(`/api/dev-login?email=move-other-${Date.now()}-${test.info().workerIndex}@example.test&role=COUNSELOR`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();

  const slug = `synthetic-move-other-${Date.now()}`;
  const name = `Synthetic move course ${Date.now()}`;
  await page.goto("/admin/catalog/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByLabel(/^Department/).selectOption("MATH");
  await page.getByLabel("11", { exact: true }).check();
  await page.getByRole("button", { name: "Create course", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/catalog\/(?!new)[^/]+$/);
  const courseUrl = page.url();

  try {
    await page.goto(`/admin/catalog?q=${slug}`);
    // Courses are grouped under their department's heading; a search opens every group.
    const group = (dept: string) => page.locator("details").filter({ has: page.getByRole("heading", { name: dept, exact: true }) });
    const row = group("Mathematics").getByRole("listitem").filter({ hasText: name });
    await row.hover();
    await row.getByRole("button", { name: `Move ${name} to Other Programs`, exact: true }).click();
    const moved = group("Other Programs").getByRole("listitem").filter({ hasText: name });
    await expect(moved).toBeVisible();
    await expect(group("Mathematics")).toHaveCount(0);
    await expect(moved.getByRole("button", { name: `Move ${name} to Other Programs`, exact: true })).toHaveCount(0);

    await page.goto(courseUrl);
    await expect(page.getByLabel(/^Department/)).toHaveValue("OTHER");
  } finally {
    await page.goto(courseUrl);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/catalog$/);
  }
});
