// Run against an authenticated preview or an isolated ExpoRoot with the production TabLayout.
// This exercises in-place tab navigation; separate page loads cannot detect retained-scene ghosting.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.TOWNLOOP_PREVIEW_URL || 'http://localhost:8082');
    const home = page.getByText('Daily Medications', { exact: true });
    await home.waitFor();
    await page.getByRole('button', { name: 'Expand Daily Medications', exact: true }).click();
    for (const tab of ['News', 'Work Orders', 'Social', 'News']) {
      await page.getByRole('tab', { name: `${tab} tab`, exact: true }).click();
      await page.waitForTimeout(350);
      const box = await home.evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
      assert.equal(box.width, 0, `Home must not paint underneath ${tab}`);
      assert.equal(box.height, 0, `Home must not paint underneath ${tab}`);
      await page.screenshot({ path: `/tmp/townloop-tab-${tab.toLowerCase().replaceAll(' ', '-')}.png` });
    }
    await page.getByRole('tab', { name: 'Home tab', exact: true }).click();
    await page.getByRole('button', { name: 'Collapse Daily Medications', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: four tab switches hide Home; returning preserves expanded medication state; no runtime errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
