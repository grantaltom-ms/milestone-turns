import { expect, test, type Page } from "@playwright/test";
import {
  EXPECTED_DAYS_UNTIL_OUT,
  EXPECTED_DAYS_VACANT,
  UPCOMING_BY_REGION,
  UPCOMING_COUNT,
  VACANT_BY_REGION,
  VACANT_COUNT,
} from "../support/vacancy-fixture.ts";

const CODE = "e2e-test-code-0123456789abcdef";
const BOARD_URL = `/vacancies/${CODE}`;
const REGIONS = ["Seattle", "SeaTac", "Eastside", "Burien"];

const panelId = (region: string) => `region-${region.replace(/\s+/g, "-").toLowerCase()}`;

/** The tap target for one service area. */
function regionToggle(page: Page, region: string) {
  return page.locator(`button[aria-controls="${panelId(region)}"]`);
}

/** The (possibly hidden) panel holding a region's buildings. */
function regionPanel(page: Page, region: string) {
  return page.locator(`#${panelId(region)}`);
}

async function openRegion(page: Page, region: string) {
  await regionToggle(page, region).click();
  await expect(regionToggle(page, region)).toHaveAttribute("aria-expanded", "true");
}

/** Building names inside one open region, in render order. */
function buildingsIn(page: Page, region: string) {
  return regionPanel(page, region).locator("h3").allTextContents();
}

/** The rendered row for a unit inside an open region. */
function unitRow(page: Page, region: string, building: string, unit: string) {
  return regionPanel(page, region)
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: building, exact: true }) })
    .getByRole("listitem")
    .filter({ has: page.getByText(unit, { exact: true }) })
    .first();
}

test.describe("maintenance vacancy board", () => {
  test("opens to four closed areas, with nothing else on screen", async ({ page }) => {
    await page.goto(BOARD_URL);

    await expect(page.getByRole("heading", { name: "Vacancies", level: 1 })).toBeVisible();

    const vacantTab = page.getByRole("tab", { name: /Vacant Now/ });
    await expect(vacantTab).toHaveAttribute("aria-selected", "true");
    await expect(vacantTab).toContainText(String(VACANT_COUNT));
    await expect(page.getByRole("tab", { name: /Coming Up/ })).toContainText(String(UPCOMING_COUNT));

    // The whole point of the change: no unit rows until an area is opened.
    await expect(page.getByRole("listitem")).toHaveCount(0);

    for (const region of REGIONS) {
      await expect(regionToggle(page, region)).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("each area shows its own unit count before being opened", async ({ page }) => {
    await page.goto(BOARD_URL);
    for (const [region, count] of Object.entries(VACANT_BY_REGION)) {
      const toggle = regionToggle(page, region);
      // Rendered uppercase via CSS, so the DOM text keeps its original casing.
      await expect(toggle).toContainText(region);
      // An area with nothing in it says so rather than showing "0 units".
      await expect(toggle).toContainText(count === 0 ? "None" : `${count} units`);
    }
  });

  test("an area with no units cannot be opened", async ({ page }) => {
    await page.goto(BOARD_URL);
    // SeaTac and Eastside hold no vacant units in the fixture.
    await expect(regionToggle(page, "SeaTac")).toBeDisabled();
    await expect(regionToggle(page, "Eastside")).toBeDisabled();
    await expect(regionToggle(page, "Seattle")).toBeEnabled();
  });

  test("opening an area reveals its buildings alphabetically, with day counts", async ({ page }) => {
    await page.goto(BOARD_URL);
    await openRegion(page, "Seattle");

    // Alder Court holds the least urgent units yet still leads: A-Z, not worst-first.
    expect(await buildingsIn(page, "Seattle")).toEqual(["Alder Court", "Ascona", "Bel Vista"]);
    await expect(page.getByRole("listitem")).toHaveCount(VACANT_BY_REGION.Seattle);

    for (const [key, days] of Object.entries(EXPECTED_DAYS_VACANT)) {
      const [building, unit] = key.split(":");
      if (building === "Crosby") continue; // Burien, opened separately below
      await expect(unitRow(page, "Seattle", building, unit)).toContainText(String(days));
    }

    // A unit with no move-out date still appears, marked as unknown.
    await expect(unitRow(page, "Seattle", "Alder Court", "9")).toContainText("Move-out date unknown");
  });

  test("groups a building by its service area, not its own city", async ({ page }) => {
    await page.goto(BOARD_URL);
    // Bel Vista is in Renton and Crosby is in Burien: Renton is worked as part
    // of Seattle, Burien is its own area.
    await openRegion(page, "Seattle");
    expect(await buildingsIn(page, "Seattle")).toContain("Bel Vista");

    await openRegion(page, "Burien");
    expect(await buildingsIn(page, "Burien")).toEqual(["Crosby"]);
  });

  test("never shows an out-of-area building", async ({ page }) => {
    await page.goto(BOARD_URL);
    for (const region of REGIONS) {
      if (await regionToggle(page, region).isEnabled()) await openRegion(page, region);
    }
    // "Far Away Place" sits in San Francisco — off this crew's patch entirely.
    await expect(page.getByText("Far Away Place")).toHaveCount(0);
    await expect(page.getByRole("listitem")).toHaveCount(VACANT_COUNT);
  });

  test("flags an area holding units empty over 30 days", async ({ page }) => {
    await page.goto(BOARD_URL);
    // Ascona 105 (62d), Bel Vista 2 (44d) and Crosby 7 (31d) are the 30+ set.
    await expect(regionToggle(page, "Seattle")).toContainText("2 over 30d");
    await expect(regionToggle(page, "Burien")).toContainText("1 over 30d");
  });

  test("flags a unit that is already re-rented", async ({ page }) => {
    await page.goto(BOARD_URL);
    await openRegion(page, "Seattle");
    await expect(unitRow(page, "Seattle", "Ascona", "202")).toContainText("Rented — move-in");
  });

  test("summarises how many areas are actually in play", async ({ page }) => {
    await page.goto(BOARD_URL);
    await expect(page.getByText(`${VACANT_COUNT} units in 2 areas · 3 over 30 days`)).toBeVisible();
  });

  test("Coming Up groups notice units into their own areas", async ({ page }) => {
    await page.goto(BOARD_URL);
    await page.getByRole("tab", { name: /Coming Up/ }).click();
    await expect(page.getByRole("tab", { name: /Coming Up/ })).toHaveAttribute("aria-selected", "true");

    for (const [region, count] of Object.entries(UPCOMING_BY_REGION)) {
      await expect(regionToggle(page, region)).toContainText(
        count === 0 ? "None" : `${count} unit`,
      );
    }
    // No "over 30d" chip on this tab — days-vacant is a Vacant Now idea.
    await expect(page.getByText("over 30d")).toHaveCount(0);

    await openRegion(page, "Seattle");
    // Within DD Culp, the sooner move-out (116 at 29 days) leads 220 at 34.
    expect(
      await regionPanel(page, "Seattle").locator("li > div > div > span:first-child").allTextContents(),
    ).toEqual(["116", "220"]);

    for (const [key, days] of Object.entries(EXPECTED_DAYS_UNTIL_OUT)) {
      const [building, unit] = key.split(":");
      const region = building === "DD Culp" ? "Seattle" : building === "Envoy" ? "SeaTac" : "Eastside";
      if (region !== "Seattle") await openRegion(page, region);
      const row = unitRow(page, region, building, unit);
      await expect(row).toContainText(String(days));
      await expect(row).toContainText("Moves out");
    }
  });

  test("keeps each tab's open areas separate", async ({ page }) => {
    await page.goto(BOARD_URL);
    await openRegion(page, "Seattle");

    await page.getByRole("tab", { name: /Coming Up/ }).click();
    // Opening Seattle on Vacant Now must not open it here: different work.
    await expect(regionToggle(page, "Seattle")).toHaveAttribute("aria-expanded", "false");

    await page.getByRole("tab", { name: /Vacant Now/ }).click();
    // ...and coming back finds it still open, so he does not re-open it.
    await expect(regionToggle(page, "Seattle")).toHaveAttribute("aria-expanded", "true");
  });

  test("survives being opened and closed all day", async ({ page }) => {
    await page.goto(BOARD_URL);
    for (let i = 0; i < 6; i++) {
      await regionToggle(page, "Seattle").click();
      await expect(page.getByRole("listitem")).toHaveCount(VACANT_BY_REGION.Seattle);
      await regionToggle(page, "Seattle").click();
      await expect(page.getByRole("listitem")).toHaveCount(0);
    }
  });

  test("reloading the bookmark keeps working and shows only the newest snapshot", async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.goto(BOARD_URL);
      await openRegion(page, "Seattle");
      await expect(page.getByRole("listitem")).toHaveCount(VACANT_BY_REGION.Seattle);
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
