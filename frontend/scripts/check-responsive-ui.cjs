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
const centre = { id: "ui-centre", centreCode: "UITEST", name: "University Print and Document Centre", printerOnline: true, upiId: "university.document.centre@upi", pricing: { bwSingle: 2, bwDouble: 2, colorSingle: 5, colorDouble: 5, watermarkCharge: 0 } };
const errors = [];
const results = [];

async function mockApi(context, origin) {
  let serial = 0;
  let latest;
  await context.route(/^https?:\/\//, async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (!url.pathname.startsWith("/api/")) return route.abort();
    let data = { success: true, centres: [centre], centre, user, orders: [], stats: {} };
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
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
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
      await page.getByRole("heading", { name: centre.name, exact: true }).waitFor();
      await checkWidth(page, `${label} home`);
      await page.screenshot({ path: path.join(evidence, `${label}-home.png`), fullPage: true });
      await page.getByRole("button", { name: "Upload to this Centre", exact: true }).click();
      await page.getByRole("heading", { name: "Upload Document", exact: true }).waitFor();
      await page.locator("input[type=file]").setInputFiles([
        { name: "Research-and-printing-settings-with-a-long-document-name.pdf", mimeType: "application/pdf", buffer: bytes },
        { name: "Second-document.pdf", mimeType: "application/pdf", buffer: bytes },
      ]);
      const configure = page.getByRole("button", { name: "Configure Second-document.pdf", exact: true });
      await configure.waitFor();
      await page.waitForTimeout(100);
      assert.equal(await page.locator(".pe-file-list").evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, `${label} file actions clipped`);
      assert.equal(await page.locator(".pe-settings-grid").first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), 2, `${label} wide settings need two columns`);
      assert.equal(await page.locator(".pe-settings-numeric").first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), 3, `${label} numeric settings need three columns`);
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
      assert.equal(await page.getByRole("button", { name: /Manual Request/ }).getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: /Pay Online/ }).click();
      assert.equal(await page.getByRole("button", { name: /Pay Online/ }).getAttribute("aria-pressed"), "true");
      await page.getByRole("button", { name: /Manual Request/ }).click();
      const pay = page.getByRole("button", { name: /^Request Payment/ });
      assert.equal(await pay.isEnabled(), true);
      await pay.scrollIntoViewIfNeeded();
      if (width < 768) await noIntersection(pay, page.getByRole("navigation", { name: "Mobile navigation" }), "Payment action overlaps navigation");
      await page.screenshot({ path: path.join(evidence, `${label}-payment.png`), fullPage: true });
      results.push({ viewport: label, home: "pass", upload: "pass", expandedFooter: "pass", fileDialog: "pass", payment: "pass" });
      await context.close();
    }
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
