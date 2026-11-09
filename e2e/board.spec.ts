import { expect, test, type Page } from "@playwright/test";

// The Board: one plan per student, rows by subject, columns by grade. Accounts are synthetic and unique per run.

async function signIn(page: Page, role = "STUDENT") {
  const response = await page.request.get(`/api/dev-login?email=board-${Date.now()}-${test.info().workerIndex}@example.test&role=${role}`);
  test.skip(response.status() === 404, "Requires DEV_AUTH=true outside production.");
  expect(response.ok()).toBeTruthy();
}

const status = (page: Page) => page.getByText(/^[\d.]+ of [\d.]+ credits\./);
const cell = (page: Page, row: string, grade: number) => page.getByRole("group", { name: `${row}, ${grade}th grade`, exact: true });

test("a new student starts a board, fills a spot, and moves the class", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/board$/);
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await expect(status(page)).toHaveText(/^0 of 120 credits\. \d+ empty spots left to graduate\.$/);

  // An empty spot opens the add panel already narrowed to that requirement.
  await cell(page, "Math", 9).getByRole("button", { name: "Pick a math class for 9th grade", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a course" });
  await expect(dialog.getByText("Showing classes that count toward")).toBeVisible();
  const first = dialog.getByRole("listitem").first();
  const name = (await first.locator(".font-medium").first().textContent())!;
  await first.getByRole("button", { name: "Add", exact: true }).click();

  const tile = cell(page, "Math", 9).getByRole("button", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}, `) });
  await expect(tile).toBeVisible();
  await expect(status(page)).toHaveText(/^[1-9][\d.]* of 120 credits\./);
  await expect(page.getByRole("button", { name: "Add a class", exact: true })).toBeEnabled();

  // The sheet moves a class without dragging.
  await tile.click();
  const sheet = page.getByRole("dialog", { name });
  await sheet.getByRole("button", { name: "10th", exact: true }).click();
  await expect(cell(page, "Math", 10).getByRole("button", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}, `) })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a class", exact: true })).toBeEnabled();
  await page.reload();
  await expect(cell(page, "Math", 10).getByRole("button", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}, `) })).toBeVisible();
});

test("old plan links land on the board", async ({ page }) => {
  await signIn(page);
  await page.goto("/board");
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await expect(status(page)).toBeVisible();
  for (const path of ["/plans", "/dashboard", "/notifications", "/plans/doesnotexist123?tour=1"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/board(\?tour=1)?$/);
  }
  await expect(page.getByRole("complementary", { name: "How the board works" })).toBeVisible();
});

test("the board fits a 360px phone and switches grades", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page);
  await page.goto("/board");
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  const grades = page.getByRole("tablist", { name: "Grade" });
  await expect(grades).toBeVisible();
  await grades.getByRole("tab", { name: "11th", exact: true }).click();
  await expect(grades.getByRole("tab", { name: "11th", exact: true })).toHaveAttribute("aria-selected", "true");
  await grades.getByRole("tab", { name: "All", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("a class with no listed requirements still answers first", async ({ page }) => {
  await signIn(page);
  await page.goto("/board");
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await expect(status(page)).toBeVisible();
  await page.goto("/courses/english-i");
  await expect(page.getByText(/^You can take this in 9th grade\.$/)).toBeVisible();
});

test("the class sheet keeps focus on a grade button and shows a failed save inside it", async ({ page }) => {
  await signIn(page);
  await page.goto("/board");
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await page.getByRole("button", { name: "Add a class", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a course" });
  await dialog.getByRole("combobox", { name: "Grade to add to", exact: true }).selectOption("9");
  await dialog.getByRole("textbox", { name: "Search courses", exact: true }).fill("English I");
  await dialog.getByRole("listitem").filter({ has: page.getByText("English I", { exact: true }) }).getByRole("button", { name: "Add", exact: true }).click();
  const tile = page.getByRole("group", { name: /, 9th grade$/ }).getByRole("button", { name: /^English I, / });
  await tile.click();
  const sheet = page.getByRole("dialog", { name: "English I" });

  const tenth = sheet.getByRole("button", { name: "10th", exact: true });
  await tenth.click();
  await expect(page.getByRole("group", { name: "English, 10th grade" }).getByRole("button", { name: /^English I, / })).toBeAttached();
  await expect(tenth).toBeFocused();
  await expect(sheet.getByRole("button", { name: "Remove from board", exact: true })).toBeVisible();

  // The next save reaches the server but the answer never arrives: the sheet says so and offers a retry.
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await sheet.getByRole("button", { name: "11th", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "Retry change", exact: true })).toBeVisible();
  await page.unroute("**/*");
  await sheet.getByRole("button", { name: "Retry change", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "Retry change", exact: true })).toHaveCount(0);
});
