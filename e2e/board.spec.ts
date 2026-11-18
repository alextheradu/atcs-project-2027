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
  // The panel stays open, says where the class went, and marks the row.
  await expect(dialog.getByRole("status")).toHaveText(`Added ${name} to 9th grade`);
  await expect(dialog.getByRole("button", { name: "Added to 9th grade", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();

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

test("special cases are available on a phone before starting a board", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page);
  await page.goto("/board");
  const views = page.getByRole("navigation", { name: "Board view" });
  await views.getByRole("link", { name: "Special cases" }).click();
  await expect(page).toHaveURL(/\/board\?view=special-cases$/);
  await expect(views.getByRole("link", { name: "Special cases" })).toHaveAttribute("aria-current", "page");
  for (const name of ["Financial Literacy", "Zero Period Gym", "Advanced courses over the summer", "Pascack Period", "Satellite School", "Virtual High School"]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Pascack Hills counselor directory" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pascack Valley counselor directory" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await views.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByRole("button", { name: "Start your board", exact: true })).toBeVisible();
});

test("Teacher Assistant length changes the saved credit total", async ({ page }) => {
  await signIn(page);
  await page.goto("/board");
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await page.getByRole("button", { name: "Add a class", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add a course" });
  await picker.getByRole("combobox", { name: "Grade to add to" }).selectOption("11");
  await picker.getByRole("textbox", { name: "Search courses" }).fill("Teacher Assistant Program");
  await picker.getByRole("button", { name: "Add half year (2.5 cr)", exact: true }).click();
  await picker.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Add a class", exact: true })).toBeEnabled();
  await page.reload();
  await expect(status(page)).toHaveText(/^2\.5 of 120 credits\./);
  await cell(page, "Electives", 11).getByRole("button", { name: /^Teacher Assistant Program, / }).click();
  const sheet = page.getByRole("dialog", { name: "Teacher Assistant Program" });
  const length = sheet.getByRole("combobox", { name: "Program length" });
  await expect(length).toHaveValue("2.5");
  await length.selectOption("5");
  await expect(length).toBeEnabled();
  await page.reload();
  await expect(status(page)).toHaveText(/^5 of 120 credits\./);
});

test("the Teacher Assistant course page keeps the chosen length until it is added", async ({ page }) => {
  await signIn(page);
  await page.goto("/board");
  await page.getByRole("button", { name: "Start your board", exact: true }).click();
  await expect(status(page)).toBeVisible();
  await page.goto("/courses/teacher-assistant-program");
  const length = page.getByRole("combobox", { name: "Program length" });
  await length.selectOption("2.5");
  await page.reload();
  await expect(length).toHaveValue("2.5");
  await page.getByRole("button", { name: "Add to my board", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open my board" })).toBeVisible();
  await page.getByRole("link", { name: "Open my board" }).click();
  await expect(status(page)).toHaveText(/^2\.5 of 120 credits\./);
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
  await expect(dialog.getByRole("status").filter({ hasText: "Added English I to 9th grade" })).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
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
