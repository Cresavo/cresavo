/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node renderer. */
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
/* eslint-enable @typescript-eslint/no-require-imports */

async function render() {
  const browser = await chromium.launch({ channel: process.env.CONCEPT_BROWSER_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1344, height: 960 }, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(path.join(__dirname, 'contact-sheet.html')).href);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.screenshot({ path: path.join(__dirname, 'contact-sheet.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}
render().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
