// Visual regression check against the actual production bundle. Every external
// request is intercepted: this never uploads to a hub, pays, or starts printing.
// Run after `npm run build --prefix frontend`, with Playwright on NODE_PATH.
const { chromium } = require("playwright");
const { PDFDocument } = require("pdf-lib");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../dist");
const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "printease-web-ui-"));
const user = { id: "ui-user", role: "user", name: "Preview Customer With A Long Display Name" };
const centre = { id: "ui-centre", ownerId: "ui-owner", centreCode: "UITEST", name: "University Print and Document Centre", printerOnline: true, upiId: "university.document.centre@upi", locationEnabled: true, latitude: 18.51, longitude: 73.8, pricing: { bwSingle: 2, bwDouble: 2, colorSingle: 5, colorDouble: 5, watermarkCharge: 0 } };
const expensive = { ...centre, id: "expensive", name: "Alpha Print", centreCode: "1001", latitude: 19, pricing: { bwSingle: 9, bwDouble: 8, colorSingle: 4, colorDouble: 3 } };
const cheap = { ...centre, id: "cheap", name: "Beta Print", centreCode: "2045", latitude: 18.5, printerOnline: false, pricing: { bwSingle: 1, bwDouble: 1, colorSingle: 12, colorDouble: 10 } };
const errors = [];
const results = [];

async function mockApi(context, origin, sessionUser = user) {
  let serial = 0;
  let latest;
  await context.route(/^https?:\/\//, async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/releases/latest")) {
      assert(!route.request().headers().authorization, "Account token must not go to GitHub");
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "desktop-v0.1.999", draft: false, prerelease: false, assets: [{ name: "PrintEase-Desktop-Setup-0.1.999.exe", size: 7, browser_download_url: "https://github.com/adityasomde/printease-desk/releases/download/desktop-v0.1.999/PrintEase-Desktop-Setup-0.1.999.exe" }] }) });
    }
    if (url.hostname === "github.com" && url.pathname.endsWith("/PrintEase-Desktop-Setup-0.1.999.exe")) return route.fulfill({ contentType: "application/octet-stream", headers: { "Content-Disposition": 'attachment; filename="PrintEase-Desktop-Setup-0.1.999.exe"' }, body: "fixture" });
    if (!url.pathname.startsWith("/api/")) return route.abort();
    assert(!/latitude|longitude/.test(url.search + (route.request().postData() || "")), "Discovery must not send the user's coordinates to the server");
    let data = { success: true, centres: sessionUser.role === "hub" ? [centre] : [centre, expensive, cheap], centre, user: sessionUser, orders: [], stats: {}, agents: [], printers: [], jobs: [] };
    if (url.pathname === "/api/uploads") {
      const body = route.request().postDataBuffer()?.toString() || "";
      const name = /filename="([^"]+)"/.exec(body)?.[1] || "document.pdf";
      data.document = { id: `ui-document-${++serial}`, fileName: name, pageCount: 2, fileType: "application/pdf", preparationStatus: "prepared" };
    } else if (route.request().method() === "POST" && /^\/api\/orders(?:\/preparation)?$/.test(url.pathname)) {
      const payload = route.request().postDataJSON();
      const files = payload.files.map(file => ({ ...file, fileName: file.documentName, originalPageCount: 2, selectedPageCount: 2, printablePageCount: 2 * file.copies, sheetCount: 2 * file.copies, pricePerPage: 2, totalAmount: 4 * file.copies }));
      const total = files.reduce((sum, file) => sum + file.totalAmount, 0);
      latest = { ...payload, id: "ui-order", orderCode: "UI-TEST-ONLY", status: "bill_confirmed", billStatus: "confirmed", amount: total, createdAt: new Date().toISOString(), priceSnapshot: { breakdown: files }, documents: files };
      data = { success: true, order: latest, orderFiles: files, price: { totalAmount: total, files, originalPageCount: files.length * 2, selectedPageCount: files.length * 2 } };
    } else if (url.pathname === "/api/orders/ui-order") data = { success: true, order: latest };
    else if (/\/payments?\//.test(url.pathname)) throw new Error("Test must not submit payment.");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
}

async function checkWidth(page, label) {
  const overflow = await page.evaluate(() => Array.from(document.querySelectorAll("main button, main input:not([type=file]), main select, main p, main h2, main h3, header button")).filter(element => {
    if (!element.getClientRects().length) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
  }).map(element => `${element.tagName}: ${element.textContent.slice(0, 50)}`));
  assert.deepEqual(overflow, [], `${label}: elements overflow viewport`);
}

async function noIntersection(first, second, label) {
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  assert(a && b && (a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1 || a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1), label);
}

(async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage(); pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  const server = http.createServer((req, res) => {
    let file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if (file !== root && !file.startsWith(root + path.sep)) return res.writeHead(403).end();
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, "index.html");
    res.writeHead(200, { "Content-Type": ({ ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png" })[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
    for (const [width, height] of [[320, 568], [360, 640], [390, 844], [768, 720], [1280, 720], [1440, 900]]) {
      const label = `${width}x${height}`;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", geolocation: { latitude: 18.5, longitude: 73.8 } });
      await context.grantPermissions(["geolocation"], { origin });
      await mockApi(context, origin);
      await context.addInitScript(user => {
        localStorage.setItem("printease_scanner_mode", "classic");
        localStorage.setItem("printease_user", JSON.stringify(user));
        localStorage.setItem("printease_token", "mocked-ui-token");
      }, user);
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(`${label}: ${error.message}`));
      await page.goto(origin);
      await page.getByRole("heading", { name: "Print documents securely." }).waitFor();
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".pe-home-scan")).opacity === "1");
      await noIntersection(page.getByRole("group", { name: "Scanner mode" }), page.getByRole("heading", { name: "Print documents securely." }), "Scanner modes overlap heading");
      const tile = await page.getByRole("button", { name: "Scan or select print centre" }).boundingBox();
      const modes = await page.getByRole("group", { name: "Scanner mode" }).boundingBox();
      assert(modes.y >= tile.y + tile.height, "Mode control belongs below its scanner, not floating above the title");
      const modeBoxes = await page.getByRole("group", { name: "Scanner mode" }).getByRole("button").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
      assert(modeBoxes.every(box => box.height >= 44 && Math.abs(box.y - modeBoxes[0].y) < 1), "Scanner modes must share one accessible row");
      assert.equal(await page.getByText("Scan QR or enter code to select a centre", { exact: false }).count(), 0);
      await page.getByRole("heading", { name: centre.name, exact: true }).waitFor();
      await page.waitForFunction(first => document.querySelector(".pe-centre-card .pe-centre-name")?.textContent === first, cheap.name);
      await page.getByLabel("Search printing centres", { exact: true }).fill("Aplha");
      await page.waitForFunction(first => document.querySelector(".pe-centre-card .pe-centre-name")?.textContent === first, expensive.name);
      await page.getByRole("button", { name: "Clear centre search" }).click();
      await checkWidth(page, `${label} home`);
      await page.screenshot({ path: path.join(evidence, `${label}-home.png`), fullPage: true });
      assert.equal(await page.getByRole("button", { name: "Download Windows App", exact: true }).count(), 0);
      for (const [mode, first] of [["price_bw", cheap.name], ["price_color", expensive.name], ["name", expensive.name]]) {
        await page.getByLabel("Sort printing centres", { exact: true }).selectOption(mode);
        await page.waitForFunction(first => document.querySelector(".pe-centre-card .pe-centre-name")?.textContent === first, first);
      }
      await page.getByRole("navigation", { name: width < 768 ? "Mobile navigation" : "Main navigation" }).getByRole("button", { name: width < 768 ? "Scan" : "Centre Code", exact: true }).click();
      await page.getByRole("heading", { name: "Find a Printing Centre", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Search Online", exact: true }).count(), 0);
      const locationActions = page.locator(".pe-location-actions button");
      const actionBoxes = await locationActions.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
      assert(Math.abs(actionBoxes[0].y - actionBoxes[1].y) < 1, "Location and map actions must be side by side");
      assert.equal(await page.locator(".pe-scan-centre-grid").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), 2, "Scan page must display two centre cards per row");
      const firstCard = page.locator(".pe-scan-centre-grid > .pe-centre-card").first();
      assert.equal(await firstCard.locator("h4 .pe-centre-code-inline").textContent(), "Centre code 1001");
      const cardName = firstCard.locator("h4 .pe-centre-name");
      const cardCode = firstCard.locator("h4 .pe-centre-code-inline");
      await noIntersection(cardName, cardCode, "Centre name and code must not overlap");
      const nameBox = await cardName.boundingBox();
      const codeBox = await cardCode.boundingBox();
      assert(codeBox.x >= nameBox.x + nameBox.width, "Name belongs on the left and code on the right");
      const compact = await firstCard.boundingBox();
      if (width < 768) assert(compact.height <= 350, `${label} short-name centre card is too tall: ${compact.height}`);
      const rateRows = firstCard.locator(".pe-summary-row");
      assert.equal(await rateRows.count(), 4, "Compact card must retain all four rates");
      for (const row of await rateRows.all()) {
        const value = row.locator("span").last();
        assert.equal(await value.isVisible(), true);
        await noIntersection(row.locator("span").first(), value, "Rate label and price overlap");
      }
      await noIntersection(firstCard.getByRole("button", { name: "View on map" }), firstCard.getByRole("button", { name: "Upload", exact: true }), "Map and upload must not overlap");
      const actionBoxesInCard = await firstCard.locator(".pe-centre-actions button").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
      assert(actionBoxesInCard.every(box => box.height >= 44 && box.width >= 44 && Math.abs(box.y - actionBoxesInCard[0].y) < 1), "Map and upload need one accessible row");
      await checkWidth(page, `${label} centre grid`);
      await page.screenshot({ path: path.join(evidence, `${label}-centre-grid.png`), fullPage: true });
      assert.equal(await page.getByLabel("Sort printing centres", { exact: true }).inputValue(), "name", "Sorting preference was lost between pages");
      await page.getByLabel("Sort printing centres", { exact: true }).selectOption("price_bw");
      await page.waitForFunction(first => document.querySelector(".pe-centre-card .pe-centre-name")?.textContent === first, cheap.name);
      const search = page.getByLabel("Search centres by name, code or area");
      await search.fill("Aplha");
      await page.waitForFunction(first => document.querySelector(".pe-centre-card .pe-centre-name")?.textContent === first, expensive.name);
      const routeBeforeEnter = page.url();
      await search.press("Enter");
      assert.equal(page.url(), routeBeforeEnter, "Enter must not select a centre or redirect");
      await page.getByLabel("Search centres by name, code or area").fill("UITEST");
      await page.waitForFunction(() => document.querySelectorAll(".pe-centre-card").length === 1);
      await checkWidth(page, `${label} centre search`);
      await page.screenshot({ path: path.join(evidence, `${label}-centres.png`), fullPage: true });
      await page.locator(".pe-scan-centre-grid").getByRole("button", { name: "Upload", exact: true }).click();
      await page.getByRole("heading", { name: "Upload Document", exact: true }).waitFor();
      await page.locator("input[type=file]").setInputFiles([
        { name: "Research-and-printing-settings-with-a-long-document-name.pdf", mimeType: "application/pdf", buffer: bytes },
        { name: "Second-document.pdf", mimeType: "application/pdf", buffer: bytes },
      ]);
      const configure = page.getByRole("button", { name: "Configure Second-document.pdf", exact: true });
      await configure.waitFor();
      await page.waitForTimeout(100);
      assert.equal(await page.locator(".pe-file-list").evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, `${label} file actions clipped`);
      assert.equal(await page.locator(".pe-settings-grid").first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), 3, `${label} print settings need three columns`);
      assert.equal(await page.locator(".pe-settings-numeric").first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), 3, `${label} numeric settings need three columns`);
      await page.getByLabel(/^(Orientation|Layout)/).selectOption("landscape");
      const clipped = await page.locator(".pe-settings-grid select").evaluateAll(elements => elements.filter(element => {
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        context.font = style.font;
        const textWidth = context.measureText(element.selectedOptions[0].textContent).width;
        return textWidth > element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + 1;
      }).map(element => element.selectedOptions[0].textContent));
      assert.deepEqual(clipped, [], `${label} selected settings must fit without truncation`);
      await checkWidth(page, `${label} upload`);
      await page.screenshot({ path: path.join(evidence, `${label}-upload.png`), fullPage: true });
      if (width < 768) {
        const dock = page.locator(".pe-upload-dock");
        assert.equal(await dock.evaluate(element => {
          const style = getComputedStyle(element);
          const form = getComputedStyle(document.querySelector(".pe-upload-form"));
          const summary = getComputedStyle(element.querySelector(".pe-panel"));
          return style.backgroundColor !== form.backgroundColor &&
            summary.backgroundColor === "rgba(0, 0, 0, 0)" &&
            parseFloat(style.borderTopWidth) >= 2 && style.boxShadow !== "none";
        }), true, `${label} fixed actions must be visually distinct from the scrollable form`);
        await noIntersection(dock, page.getByRole("navigation", { name: "Mobile navigation" }), "Upload footer overlaps navigation");
        await dock.locator("summary").click();
        await page.waitForFunction(() => {
          const host = document.querySelector(".pe-upload");
          const dock = document.querySelector(".pe-upload-dock");
          return parseFloat(getComputedStyle(host).paddingBottom) >= dock.getBoundingClientRect().height;
        });
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await noIntersection(page.getByLabel("Add watermark", { exact: true }), dock, "Last setting hidden by expanded footer");
        await dock.locator("summary").click();
      }
      await configure.click();
      const dialog = page.getByRole("dialog", { name: "Configure Second-document.pdf", exact: true });
      await dialog.waitFor();
      await dialog.getByLabel("Add watermark", { exact: true }).check();
      await dialog.getByLabel("Watermark content").selectOption("custom_text");
      await dialog.getByLabel("Watermark text").fill("Long watermark text for a responsive check");
      await dialog.getByLabel("Watermark font size").scrollIntoViewIfNeeded();
      await checkWidth(page, `${label} config modal`);
      const box = await dialog.boundingBox();
      assert(box.y >= -1 && box.y + box.height <= height + 1, `${label} dialog exceeds viewport`);
      await page.screenshot({ path: path.join(evidence, `${label}-dialog.png`) });
      await dialog.getByRole("button", { name: "Done", exact: true }).click();
      await page.getByRole("button", { name: "Continue to Payment", exact: true }).click();
      await page.getByRole("heading", { name: "Payment", exact: true }).waitFor();
      await checkWidth(page, `${label} payment`);
      if (width < 768) {
        const actions = page.locator(".pe-payment-actions");
        assert.equal(await actions.evaluate(element => getComputedStyle(element).position), "fixed", `${label} payment must be fixed, not sticky`);
        const initial = await actions.boundingBox();
        assert(initial.y >= 0 && initial.y + initial.height <= height, `${label} payment action initially outside viewport`);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const scrolled = await actions.boundingBox();
        assert(Math.abs(initial.y - scrolled.y) <= 1, `${label} payment action moved while scrolling`);
        await noIntersection(page.locator(".pe-manual-payment-notice"), actions, `${label} manual notice hidden by fixed payment action`);
      }
      assert.equal(await page.getByRole("button", { name: /Manual Request/ }).getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: /Pay Online/ }).click();
      assert.equal(await page.getByRole("button", { name: /Pay Online/ }).getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: /Manual Request/ }).click();
      const pay = page.getByRole("button", { name: /^Request Payment/ });
      assert.equal(await pay.isEnabled(), true);
      await pay.scrollIntoViewIfNeeded();
      if (width < 768) await noIntersection(pay, page.getByRole("navigation", { name: "Mobile navigation" }), "Payment action overlaps navigation");
      await page.screenshot({ path: path.join(evidence, `${label}-payment.png`), fullPage: true });
      await page.getByRole("navigation", { name: width < 768 ? "Mobile navigation" : "Main navigation" }).getByRole("button", { name: width < 768 ? "History" : "Print History", exact: true }).click();
      await page.locator(".pe-history-summary").waitFor();
      const stats = page.locator(".pe-history-summary > *").filter({ visible: true });
      assert.equal(await stats.count(), width < 768 ? 3 : 4);
      if (width < 768) {
        const positions = await stats.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().y));
        assert(positions.every(y => Math.abs(y - positions[0]) < 1), "Mobile history stats must share one row");
        assert.equal(await page.getByRole("group", { name: "Last Print Date", exact: true }).isVisible(), false);
      }
      await checkWidth(page, `${label} history`);
      await page.screenshot({ path: path.join(evidence, `${label}-history.png`), fullPage: true });
      results.push({ viewport: label, home: "pass", centreSorting: "pass", upload: "pass", expandedFooter: "pass", fileDialog: "pass", payment: "pass", history: "pass" });
      await context.close();
    }
    const promptContext = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });
    await mockApi(promptContext, origin);
    await promptContext.addInitScript(() => {
      localStorage.setItem("printease_scanner_mode", "classic");
      window.uiLocationReads = 0;
      navigator.geolocation.getCurrentPosition = () => { window.uiLocationReads++; };
    });
    const promptPage = await promptContext.newPage();
    promptPage.on("pageerror", error => errors.push(`new visitor: ${error.message}`));
    await promptPage.goto(origin);
    await promptPage.getByRole("heading", { name: centre.name, exact: true }).waitFor();
    await promptPage.getByRole("button", { name: "Use my location", exact: true }).waitFor();
    assert.equal(await promptPage.evaluate(() => window.uiLocationReads), 0, "New visitors must not be prompted for location automatically");
    assert.equal(await promptPage.getByLabel("Sort printing centres", { exact: true }).locator('option[value="nearest"]').isDisabled(), true);
    await promptContext.close();
    results.push({ locationNotGranted: "pass" });

    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const hubUser = { id: "ui-owner", role: "hub", name: "UI Hub Owner", centreId: centre.id };
    await mockApi(context, origin, hubUser);
    await context.addInitScript(hubUser => { localStorage.setItem("printease_user", JSON.stringify(hubUser)); localStorage.setItem("printease_token", "mocked-ui-token"); }, hubUser);
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole("button", { name: "Download Windows App", exact: true }).waitFor();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Hub Dashboard", exact: true }).click();
    await page.getByRole("heading", { name: "Print Centre Dashboard", exact: true }).waitFor();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Windows App", exact: true }).click();
    const file = await download;
    assert.equal(file.suggestedFilename(), "PrintEase-Desktop-Setup-0.1.999.exe");
    assert.equal(await file.failure(), null);
    await page.screenshot({ path: path.join(evidence, "hub-windows-download.png") });
    results.push({ hubWebWindowsDownload: "pass" });
    await context.close();
    assert.deepEqual(errors, [], "Renderer errors");
    fs.writeFileSync(path.join(evidence, "results.json"), JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ evidence, results, errors }, null, 2));
  } catch (error) {
    for (const context of browser?.contexts() || []) for (const page of context.pages()) {
      await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true }).catch(() => {});
      console.error((await page.locator("body").innerText()).slice(-2200));
    }
    console.error("Evidence:", evidence);
    throw error;
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
