import { expect, test, type Page } from "@playwright/test";
import {
  EXPECTED_DAYS_UNTIL_OUT,
  EXPECTED_DAYS_VACANT,
  UPCOMING_COUNT,
  VACANT_COUNT,
} from "../support/vacancy-fixture.ts";

const CODE = "e2e-test-code-0123456789abcdef";
const BOARD_URL = `/vacancies/${CODE}`;

/** The rendered row for a unit, located by its building section. */
function unitRow(page: Page, building: string, unit: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: building, exact: true }) })
    .getByRole("listitem")
    .filter({ has: page.getByText(unit, { exact: true }) })
    .first();
}

function buildingNames(page: Page) {
  return page.locator("section h2").allTextContents();
}

test.describe("maintenance vacancy board", () => {
  test("opens on Vacant Now and lists every empty unit with its age", async ({ page }) => {
    await page.goto(BOARD_URL);

    await expect(page.getByRole("heading", { name: "Vacancies", level: 1 })).toBeVisible();

    const vacantTab = page.getByRole("tab", { name: /Vacant Now/ });
    await expect(vacantTab).toHaveAttribute("aria-selected", "true");
    await expect(vacantTab).toContainText(String(VACANT_COUNT));
    await expect(page.getByRole("tab", { name: /Coming Up/ })).toContainText(String(UPCOMING_COUNT));

    // One row per vacant unit, and none of the occupied ones leak in.
    await expect(page.getByRole("listitem")).toHaveCount(VACANT_COUNT);
    await expect(page.getByText("300", { exact: true })).toHaveCount(0);

    // Each unit shows the right number of days empty.
    for (const [key, days] of Object.entries(EXPECTED_DAYS_VACANT)) {
      const [building, unit] = key.split(":");
      await expect(unitRow(page, building, unit)).toContainText(String(days));
    }

    // A unit with no move-out date still appears, marked as unknown.
    await expect(unitRow(page, "Alder Court", "9")).toContainText("Move-out date unknown");
  });

  test("lists buildings alphabetically, longest-empty unit first within each", async ({ page }) => {
    await page.goto(BOARD_URL);

    // Alder Court holds the *least* urgent units (1 day) yet leads the list,
    // and Ascona's 62-day unit does not pull it to the top: A-Z, not worst-first.
    expect(await buildingNames(page)).toEqual(["Alder Court", "Ascona", "Bel Vista", "Crosby"]);

    const asconaUnits = await page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Ascona", exact: true }) })
      .locator("li > div > div > span:first-child")
      .allTextContents();
    expect(asconaUnits).toEqual(["105", "202", "41"]);
  });

  test("flags a unit that is already re-rented", async ({ page }) => {
    await page.goto(BOARD_URL);
    await expect(unitRow(page, "Ascona", "202")).toContainText("Rented — move-in");
  });

  test("summarises the portfolio, including units over 30 days", async ({ page }) => {
    await page.goto(BOARD_URL);
    // Ascona 105 (62d), Bel Vista 2 (44d) and Crosby 7 (31d) are the 30+ set.
    await expect(page.getByText(`${VACANT_COUNT} units in 4 buildings · 3 over 30 days`)).toBeVisible();
  });

  test("Coming Up lists buildings alphabetically, soonest move-out first within each", async ({ page }) => {
    await page.goto(BOARD_URL);
    await page.getByRole("tab", { name: /Coming Up/ }).click();

    await expect(page.getByRole("tab", { name: /Coming Up/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("listitem")).toHaveCount(UPCOMING_COUNT);

    // Kerry Park has the soonest move-out (6 days) but still sorts last: A-Z.
    expect(await buildingNames(page)).toEqual(["DD Culp", "Envoy", "Kerry Park"]);
    // Within DD Culp, the sooner move-out (116 at 29 days) leads 220 at 34.
    const ddCulpUnits = await page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "DD Culp", exact: true }) })
      .locator("li > div > div > span:first-child")
      .allTextContents();
    expect(ddCulpUnits).toEqual(["116", "220"]);

    for (const [key, days] of Object.entries(EXPECTED_DAYS_UNTIL_OUT)) {
      const [building, unit] = key.split(":");
      const row = unitRow(page, building, unit);
      await expect(row).toContainText(String(days));
      await expect(row).toContainText("Moves out");
      await expect(row).toContainText("Ready to rent");
    }

    await expect(page.getByText(`${UPCOMING_COUNT} units on notice in 3 buildings`)).toBeVisible();
  });

  test("survives being toggled back and forth all day", async ({ page }) => {
    await page.goto(BOARD_URL);
    const vacantTab = page.getByRole("tab", { name: /Vacant Now/ });
    const upcomingTab = page.getByRole("tab", { name: /Coming Up/ });

    // He will flip between these constantly; counts must not drift or double up.
    for (let i = 0; i < 6; i++) {
      await upcomingTab.click();
      await expect(page.getByRole("listitem")).toHaveCount(UPCOMING_COUNT);
      await vacantTab.click();
      await expect(page.getByRole("listitem")).toHaveCount(VACANT_COUNT);
    }
    await expect(unitRow(page, "Ascona", "105")).toContainText(String(EXPECTED_DAYS_VACANT["Ascona:105"]));
  });

  test("reloading the bookmark keeps working and shows only the newest snapshot", async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.goto(BOARD_URL);
      await expect(page.getByRole("listitem")).toHaveCount(VACANT_COUNT);
      // Yesterday's snapshot must never bleed through.
      await expect(page.getByText("Should Not Appear")).toHaveCount(0);
    }
  });

  test("a wrong or missing link code gets a 404, not the board", async ({ page }) => {
    for (const path of ["/vacancies/wrong-code", "/vacancies/", `/vacancies/${CODE}x`]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should not be reachable`).toBe(404);
      await expect(page.getByRole("heading", { name: "Vacancies", level: 1 })).toHaveCount(0);
    }
  });
});
