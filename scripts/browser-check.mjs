import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import serverChromium from "@sparticuz/chromium";
import ExcelJS from "exceljs";
// Chromium is supplied through npm for restricted CI environments.
// On minimal Linux, first inflate al2023.tar.br and set LD_LIBRARY_PATH (see README).
const browser = await chromium.launch({
  executablePath: await serverChromium.executablePath(),
  args: serverChromium.args,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  await page.waitForSelector(".plan-svg");
  assert.equal(await page.locator(".count-tag").innerText(), "308");
  await page.getByRole("spinbutton", { name: /Span length/ }).fill("40");
  await expect(page.locator(".project-strip")).toContainText("40 m × 9 m");
  await page.getByRole("spinbutton", { name: /End X/ }).fill("40");
  await expect(page.locator(".count-tag")).toHaveText("228");
  await page.getByRole("spinbutton", { name: /End X/ }).fill("60");
  await page.getByRole("spinbutton", { name: /Deck width/ }).fill("6");
  await page.locator(".empty-view").waitFor();
  assert.match(
    await page.locator(".empty-view").innerText(),
    /Carriageway width exceeds/,
  );
  await page.getByRole("spinbutton", { name: /Deck width/ }).fill("9");
  await page.getByRole("spinbutton", { name: /Span length/ }).fill("60");
  await page
    .getByRole("button", { name: "Last position", exact: true })
    .click();
  await expect(page.locator(".current-case")).toContainText("LC408");
  await page
    .getByRole("button", { name: "First position", exact: true })
    .click();
  await expect(page.locator(".current-case")).toContainText("LC101");
  await page
    .getByRole("button", { name: "Next position", exact: true })
    .click();
  await expect(page.locator(".current-case")).toContainText("LC102");
  await page
    .getByRole("button", { name: "Bookmark current position", exact: true })
    .click();
  await page.getByRole("button", { name: "Bookmarked", exact: true }).click();
  await expect(page.locator(".main-table tbody tr")).toHaveCount(1);
  assert.match(await page.locator(".main-table tbody").innerText(), /LC102/);
  await page
    .getByRole("button", { name: "All positions", exact: true })
    .click();
  await page.getByPlaceholder("Search load case or coordinate…").fill("219");
  await page.locator(".main-table tbody tr").first().click();
  await expect(page.locator(".current-case")).toContainText("LC219");
  await page.getByPlaceholder("Search load case or coordinate…").fill("");
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const projectFile = await (await saved).path();
  await page.getByRole("spinbutton", { name: /Span length/ }).fill("40");
  await page.locator("input[type=file]").setInputFiles(projectFile);
  await page.waitForFunction(
    () => document.querySelector(".count-tag")?.textContent === "308",
  );
  await page
    .getByRole("button", { name: "View & edit vehicle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create custom copy", exact: true })
    .click();
  await page
    .getByLabel("Vehicle name", { exact: true })
    .fill("QA custom vehicle");
  await page.getByRole("checkbox", { name: /I have verified/ }).check();
  await page
    .getByRole("button", { name: "Apply vehicle", exact: true })
    .click();
  await page.waitForSelector(".modal", { state: "hidden" });
  assert.equal(
    await page
      .getByRole("combobox", { name: /Design vehicle/ })
      .inputValue()
      .then((v) => v.startsWith("custom-")),
    true,
  );
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  assert.match((await csvDownload).suggestedFilename(), /\.csv$/);
  await page
    .locator(".page-actions")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  await page.getByRole("button", { name: /Engineering workbook/ }).click();
  const xlsxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export file", exact: true }).click();
  const xlsx = await xlsxDownload;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await xlsx.path());
  assert.equal(wb.worksheets.length, 10);
  assert.equal(wb.getWorksheet("07_Wheel_Loads").rowCount, 4313);
  assert.equal(wb.getWorksheet("05_Position_Summary").rowCount, 309);
  await page
    .getByRole("button", { name: "View & edit vehicle", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: /Vehicle type/ })
    .selectOption("tracked");
  await page
    .getByRole("button", { name: "Apply vehicle", exact: true })
    .click();
  await page.waitForSelector(".modal", { state: "hidden" });
  assert.match(
    await page.locator(".current-case").innerText(),
    /QA custom vehicle/,
  );
  assert.equal(
    await page.locator('.plan-svg rect[fill="url(#track)"]').count(),
    2,
  );
  await page.getByRole("spinbutton", { name: /End X/ }).fill("1500");
  await expect(page.locator(".empty-view")).toContainText(
    "Large matrix confirmation",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Generate positions", exact: true })
    .click();
  await expect(page.locator(".count-tag")).toHaveText("6068", {
    timeout: 15000,
  });
  await page.getByRole("spinbutton", { name: /End X/ }).fill("60");
  await expect(page.locator(".count-tag")).toHaveText("308");
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.SCREENSHOT_PATH)
    await page.screenshot({
      path: process.env.SCREENSHOT_PATH,
      fullPage: true,
    });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser QA passed: geometry validation, 308-case matrix, timeline, bookmark/search, project roundtrip, custom vehicle, CSV/XLSX downloads, 10-sheet workbook, tracks, background-worker generation (6,068 cases), mobile layout. No runtime errors.",
  );
} finally {
  await browser.close();
}
