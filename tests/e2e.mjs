import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";

const base = process.env.BASE_URL || "http://127.0.0.1:8080/";
const shots = process.env.SHOTS || "/tmp/fence-shots";
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const errors = [];

async function boot(viewport) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/favicon/i.test(msg.text())) errors.push(msg.text());
  });
  let dialog = false;
  page.on("dialog", async (d) => {
    dialog = true;
    await d.dismiss();
  });
  await page.goto(base + "#/quotes", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  return { page, sawDialog: () => dialog };
}

function fail(message) {
  console.error("FAIL", message);
  console.error("console/page errors:", errors);
  process.exitCode = 1;
  throw new Error(message);
}

const desktop = await boot({ width: 1280, height: 800 });
const page = desktop.page;
await page.screenshot({ path: shots + "/desktop-empty-quotes.png", fullPage: true });

if (!(await page.getByTestId("local-banner").textContent()).includes("this browser only")) {
  fail("local banner missing");
}
await page.getByTestId("new-quote").click();
await page.getByTestId("customer-name").fill("Alex Example (fictional) <script>alert(1)</script>");
await page.getByTestId("site-address").fill("1 Example Street, Sampletown VIC 3999");
await page.getByTestId("job-title").fill("Side and rear");
await page.getByTestId("internal-notes").fill("SECRET COST NOTE — supplier discount 12%");
await page.getByTestId("customer-notes").fill("Fictional note for the customer sheet.");

await page.getByTestId("add-timber").click();
const timber = page.getByTestId("run-card").nth(0);
await timber.getByTestId("run-name").fill("Rear boundary");
await timber.getByTestId("run-length").fill("10");
await timber.getByTestId("checked-on-site").check();
await page.waitForFunction(() => {
  const node = document.querySelector("[data-testid=run-summary]");
  return node && node.textContent.includes("80 palings");
});
const timberSummary = await timber.getByTestId("run-summary").textContent();
assert.match(timberSummary, /6 posts/);
assert.match(timberSummary, /5 bays/);
assert.match(timberSummary, /80 palings/);
assert.match(timberSummary, /100 mm/);
assert.match(await timber.getByTestId("measure-note").textContent(), /checked on site/);

await page.getByTestId("add-colourbond").click();
const colour = page.getByTestId("run-card").nth(1);
await colour.getByTestId("run-name").fill("Side boundary");
await colour.getByTestId("run-length").fill("12");
await colour.getByTestId("run-cover").fill("820");
await colour.getByTestId("run-height").fill("1800");
await colour.getByTestId("check-timberPosts").check();
await colour.getByTestId("check-useStepDown").check();
await colour.getByTestId("run-fall").fill("240");
await colour.getByTestId("check-equalPosts").check();
await page.waitForFunction(() => {
  const nodes = [...document.querySelectorAll("[data-testid=run-summary]")];
  return nodes[1] && nodes[1].textContent.includes("15 panels");
});
const colourSummary = await colour.getByTestId("run-summary").textContent();
assert.match(colourSummary, /15 panels/);
assert.match(colourSummary, /clear 2\.3 m/);
assert.match(colourSummary, /step 48 mm/);
assert.match(await colour.getByTestId("measure-note").textContent(), /not verified on site/);
const colourSvgBefore = await colour.locator("svg").first().innerHTML();
assert.match(colourSvgBefore, /150 plinth/);
assert.equal(colourSvgBefore.includes("<script"), false);

await timber.getByTestId("run-length").fill("12");
await page.waitForFunction(() => document.querySelector("[data-testid=run-summary]").textContent.includes("palings") && !document.querySelector("[data-testid=run-summary]").textContent.includes("80 palings"));
const colourSvgAfter = await colour.locator("svg").first().innerHTML();
if (colourSvgBefore !== colourSvgAfter) fail("editing the timber run changed the colourbond diagram");
assert.match(await colour.getByTestId("run-summary").textContent(), /15 panels/);
await timber.getByTestId("run-length").fill("10");
await page.waitForFunction(() => document.querySelector("[data-testid=run-summary]").textContent.includes("80 palings"));

assert.match(await page.getByTestId("pricing-incomplete").textContent(), /no rate/);
const rates = page.locator("[data-testid=rate]");
const rateCount = await rates.count();
if (rateCount < 8) fail("expected material rate rows, got " + rateCount);
for (let i = 0; i < rateCount; i++) await rates.nth(i).fill("1");
await page.getByTestId("add-labour").click();
await page.getByTestId("labour-description").fill("Install labour (fictional)");
await page.getByTestId("labour-qty").fill("2");
await page.getByTestId("labour-rate").fill("50");
await page.getByTestId("add-extras").click();
await page.getByTestId("extras-description").fill("Gate (fictional)");
await page.getByTestId("extras-rate").fill("0");

let total = await page.getByTestId("grand-total").textContent();
assert.match(total, /\$748\.00/);
const zeroNote = page.locator(".totals-card");
assert.match(await zeroNote.textContent(), /\$0\.00/);
assert.match(await page.getByTestId("gst-off").textContent(), /GST is off/);

await page.getByTestId("gst-enabled").check();
total = await page.getByTestId("grand-total").textContent();
assert.match(total, /\$822\.80/);
assert.match(await page.locator("#totals-card").textContent(), /GST 10%/);

await page.screenshot({ path: shots + "/desktop-editor.png", fullPage: true });

const reference = await page.getByTestId("quote-reference").inputValue();
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("[data-testid=run-summary]");
if ((await page.getByTestId("quote-reference").inputValue()) !== reference) fail("reference not reloaded");
if (!(await page.getByTestId("customer-name").inputValue()).includes("<script>")) fail("customer text not reloaded");
assert.match(await page.getByTestId("run-summary").first().textContent(), /80 palings/);
assert.match(await page.getByTestId("grand-total").textContent(), /\$822\.80/);
const scriptText = await page.getByTestId("customer-name").inputValue();
assert.equal(scriptText.includes("<script>"), true);
if (desktop.sawDialog()) fail("customer name executed a dialog");

const originalRef = await page.getByTestId("quote-reference").inputValue();
await page.getByTestId("duplicate-open").click();
await page.waitForFunction((ref) => {
  const input = document.querySelector("[data-testid=quote-reference]");
  return input && input.value && input.value !== ref;
}, originalRef);
await page.getByTestId("customer-name").fill("Copied Example (fictional)");
await page.getByTestId("run-card").nth(0).getByTestId("run-length").fill("4");
await page.waitForFunction(() => {
  const node = document.querySelector("[data-testid=run-summary]");
  return node && !node.textContent.includes("80 palings");
});
await page.getByRole("button", { name: "All quotes" }).click();
await page.waitForSelector("[data-testid=job-card]");
await page.getByTestId("job-card").filter({ hasText: "Alex Example" }).getByTestId("open-job").click();
assert.match(await page.getByTestId("customer-name").inputValue(), /Alex Example/);
assert.match(await page.getByTestId("run-summary").first().textContent(), /80 palings/);

await page.getByTestId("preview-quote").click();
const sheetRoot = page.locator("#quotes-root [data-testid=customer-sheet]");
await sheetRoot.waitFor();
const sheet = await sheetRoot.innerText();
if (sheet.includes("SECRET COST NOTE")) fail("internal note leaked onto the customer sheet");
if (sheet.includes("supplier discount")) fail("internal cost note leaked");
assert.match(sheet, /Alex Example/);
assert.match(sheet, /Rear boundary/);
assert.match(sheet, /Side boundary/);
assert.match(sheet, /not verified on site/);
assert.match(sheet, /checked on site/);
assert.match(sheet, /GST 10%/);
assert.match(sheet, /\$822\.80/);
assert.match(sheet, /GST is not included|GST is included/);
assert.match(sheet, /To be confirmed|\$0\.00/);
const svgs = await sheetRoot.locator("svg").count();
if (svgs < 3) fail("expected a diagram for every run, saw " + svgs);
assert.match(await sheetRoot.locator("svg").nth(1).innerHTML(), /150 plinth|gap 100|lap 25/);
await page.screenshot({ path: shots + "/desktop-customer-sheet.png", fullPage: true });

const pdfPath = shots + "/fictional-quote.pdf";
await page.pdf({ path: pdfPath, format: "A4", printBackground: true });

await page.getByRole("button", { name: "Back to edit" }).click();
await page.getByRole("button", { name: "All quotes" }).click();
const [backup] = await Promise.all([
  page.waitForEvent("download"),
  page.getByTestId("export-backup").click(),
]);
const backupPath = shots + "/backup.json";
await backup.saveAs(backupPath);
const backupJson = JSON.parse(fs.readFileSync(backupPath, "utf8"));
assert.equal(backupJson.schemaVersion, 1);
assert.equal(backupJson.jobs.length, 2);
assert.equal(backupJson.business.gstRegistered, false);

fs.writeFileSync(shots + "/bad.json", "{not json");
await page.getByTestId("import-backup").click();
await page.locator("#import-file").setInputFiles(shots + "/bad.json");
await page.waitForSelector("#import-dialog", { state: "visible" });
assert.match(await page.locator("#import-summary").textContent(), /not imported/);
await page.locator("#import-cancel").click();
assert.equal(await page.getByTestId("job-card").count(), 2);

await page.locator("#nav-calculators").click();
await page.waitForSelector("#tf-length", { state: "attached" });
await page.locator("[data-tool=timber]").click();
await page.locator("#tf-length").fill("10");
await page.waitForSelector("#tf-results:not([hidden])");
const timberTool = await page.locator("#tf-qty-grid").innerText();
assert.match(timberTool, /80/);
assert.match(timberTool, /480/);
assert.match(timberTool, /100 mm/);
assert.match(await page.locator("#tf-diagram").innerHTML(), /gap 100/);
await page.locator("#tf-lap").fill("80");
await page.waitForSelector("#tf-error:not([hidden])");
assert.match(await page.locator("#tf-error-title").innerText(), /Lap too big/);

await page.locator("[data-tool=stepdown]").click();
await page.locator("#fall").fill("240");
await page.locator("#count").fill("5");
await page.waitForSelector("#results:not([hidden])");
assert.match(await page.locator("#step-display").innerText(), /60 mm/);
await page.locator("#sd-timber").check();
await page.locator("#diagram").waitFor();
assert.match(await page.locator("#diagram").innerHTML(), /150 plinth/);
assert.match(await page.locator("#diagram").innerHTML(), /#c4b59a|#c4a574/);

await page.locator("[data-tool=spacing]").click();
await page.locator("#sp-length").fill("10");
await page.locator("#sp-maxbay").fill("2.4");
await page.waitForSelector("#sp-results:not([hidden])");
assert.match(await page.locator("#sp-centres-display").innerText(), /2 m/);
assert.match(await page.locator("#sp-result-meta").innerText(), /6 posts/);
await page.locator("#sp-timber").check();
assert.match(await page.locator("#sp-clear-display").innerText(), /1\.9 m/);

await page.locator("[data-tool=materials]").click();
await page.locator("#mat-length").fill("10");
await page.locator("#mat-cover").fill("820");
await page.locator("#mat-maxbay").fill("2.4");
await page.waitForSelector("#mat-results:not([hidden])");
const mats = await page.locator("#mat-qty-grid").innerText();
assert.match(mats, /13/);
assert.match(mats, /6/);
assert.equal(await page.locator("#mat-timber").isChecked(), true);

await page.screenshot({ path: shots + "/desktop-calculators.png", fullPage: true });

await page.close();

const phone = await boot({ width: 390, height: 844 });
await phone.page.screenshot({ path: shots + "/phone-empty.png", fullPage: true });
await phone.page.getByTestId("sample-quote").click();
await phone.page.waitForSelector("[data-testid=run-summary]");
assert.match(await phone.page.getByTestId("run-summary").first().innerText(), /80 palings/);
assert.match(await phone.page.getByTestId("sample-banner").innerText(), /Fictional/);
await phone.page.screenshot({ path: shots + "/phone-editor.png", fullPage: false });
const overflow = await phone.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
if (overflow) fail("phone layout scrolls sideways");
await phone.page.getByTestId("preview-quote").click();
const phoneSheetRoot = phone.page.locator("#quotes-root [data-testid=customer-sheet]");
await phoneSheetRoot.waitFor();
const phoneSheet = await phoneSheetRoot.innerText();
assert.match(phoneSheet, /Sample Fencing Co \(fictional\)|FICTIONAL|Alex Example/);
assert.equal(phoneSheet.includes("SECRET") || phoneSheet.includes("Internal"), false);
await phone.page.screenshot({ path: shots + "/phone-customer-sheet.png", fullPage: true });
if (errors.length) {
  console.error(errors);
  fail("page errors: " + errors.join(" | "));
}

await browser.close();
console.log("e2e ok");
console.log("pdf", pdfPath);
console.log("shots", shots);
