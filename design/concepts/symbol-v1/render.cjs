/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS proof renderer. */
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
/* eslint-enable @typescript-eslint/no-require-imports */

async function render() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1672, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.goto(pathToFileURL(path.join(__dirname, 'contact-sheet.html')).href);
    await page.locator('main > svg').screenshot({ path: path.join(__dirname, 'contact-sheet.png') });
  } finally {
    await browser.close();
  }
}

render().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
