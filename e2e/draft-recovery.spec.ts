import { expect, test } from "@playwright/test";

const email = "draft-recovery-admin@example.test";
test.beforeEach(async ({ page }) => {
  const response = await page.request.get(`/api/dev-login?email=${email}&role=ADMIN`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();
});

test("a reload restores edits, validation failures keep them, and successful saves clear them", async ({ page }) => {
  await page.goto("/admin/catalog/new");
  const name = page.getByLabel("Name", { exact: true });
  const description = page.getByRole("textbox", { name: "Description", exact: true });
  await name.fill("Synthetic recovery course");
  await description.fill("An unfinished description kept across releases.");
  await page.getByLabel("Dual enrollment", { exact: true }).check();
  await page.reload();
  await expect(name).toHaveValue("Synthetic recovery course");
  await expect(description).toHaveValue("An unfinished description kept across releases.");
  await expect(page.getByLabel("Dual enrollment", { exact: true })).toBeChecked();
  await expect(page.getByRole("status").filter({ hasText: "recovered" })).toBeVisible();
  await page.getByRole("button", { name: "Create course", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Use lowercase letters, numbers and dashes/ })).toBeVisible();
  await page.reload();
  await expect(description).toHaveValue("An unfinished description kept across releases.");
  // Persist a valid synthetic course, then clean it up through the guarded UI.
  const slug = `synthetic-recovery-${Date.now()}`;
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByLabel("9", { exact: true }).check();
  await page.getByRole("button", { name: "Create course", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/catalog\/(?!new)[^/]+$/);
  await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.endsWith(":catalog:new")))).toEqual([]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/catalog$/);
});

test("an interrupted save preserves the editor and the draft after reload", async ({ page }) => {
  await page.goto("/admin/catalog/new");
  await page.getByLabel("Name", { exact: true }).fill("Synthetic interrupted draft");
  await page.getByLabel("Slug", { exact: true }).fill("synthetic-interrupted-draft");
  await page.getByLabel("9", { exact: true }).check();
  await page.route("**/*", (route) => route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort("failed") : route.continue());
  await page.getByRole("button", { name: "Create course", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saving was interrupted" })).toBeVisible();
  await page.unroute("**/*");
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Synthetic interrupted draft");
});

test("a different signed-in account cannot recover another account's draft", async ({ page }) => {
  await page.goto("/admin/catalog/new");
  await page.getByLabel("Name", { exact: true }).fill("Private synthetic draft");
  await page.request.get("/api/dev-login?email=draft-recovery-other@example.test&role=ADMIN");
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
});

test("an interrupted planner change survives reload without duplicating a saved course", async ({ page }) => {
  await page.request.get(`/api/dev-login?email=draft-recovery-student-${Date.now()}@example.test&role=STUDENT`);
  await page.goto("/plans");
  await page.getByRole("button", { name: "Create Plan A", exact: true }).click();
  await expect(page).toHaveURL(/\/plans\/[^/]+$/);
  const planUrl = page.url();
  await page.getByRole("region", { name: "Grade 9", exact: true }).getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a course" });
  const first = dialog.getByRole("listitem").first();
  const course = await first.locator(".font-medium").first().textContent();
  expect(course).toBeTruthy();
  // The action reaches the server, but the browser never receives its response.
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await first.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry change", exact: true })).toBeVisible();
  await page.unroute("**/*");
  await page.goto(planUrl);
  await expect(page.getByRole("button", { name: "Retry change", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry change", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry change", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Grade 9", exact: true }).getByText(course!, { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete for good", exact: true }).click();
  await expect(page).toHaveURL(/\/plans$/);
});

test("typing during a save remains recoverable after that save finishes", async ({ page }) => {
  await page.goto("/admin/catalog/new");
  await page.getByLabel("Name", { exact: true }).fill("Synthetic save revision course");
  await page.getByLabel("Slug", { exact: true }).fill(`synthetic-save-revision-${Date.now()}`);
  await page.getByRole("button", { name: "Create course", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/catalog\/(?!new)[^/]+$/);
  const description = page.getByRole("textbox", { name: "Description", exact: true });
  await description.fill("First revision");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    const request = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await request;
    await description.fill("Second revision typed while saving");
    release();
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeEnabled();
  } finally {
    release();
    await page.unroute("**/*");
  }
  await page.reload();
  await expect(description).toHaveValue("Second revision typed while saving");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  await page.reload();
  await expect(description).toHaveValue("Second revision typed while saving");
  await expect(page.getByRole("status").filter({ hasText: "recovered" })).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/catalog$/);
});
