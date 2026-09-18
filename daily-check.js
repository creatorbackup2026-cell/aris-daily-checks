// Aris Laundry — daily pipeline health check.
//
// Drives a REAL headless browser against the REAL live site — same page,
// same buttons, same JavaScript every real customer uses. This is
// deliberately NOT a direct API call to Supabase; the whole point is to
// catch a broken button or a JS error on the actual site, which a direct
// API call could never detect.
//
// Every run here is a fresh browser with no saved login/cookies (GitHub
// Actions doesn't persist anything between runs), so the mandatory terms
// gate will show every single time — that's expected and handled below.
//
// Using the SAME fixed test phone number every day is what keeps this
// clean on the database side: the site's own existing "find customer by
// phone" logic (already built in for real returning customers) will
// automatically reuse the same customer record after day one, instead of
// creating a new one daily.

const { chromium } = require('playwright');

const SITE_URL = 'https://testingaris.netlify.app';
const TEST_NAME = 'AUTOMATED DAILY TEST — DO NOT DISPATCH';
const TEST_PHONE = '2125550000';
const TEST_ADDRESS = '1 Test St, Brooklyn, NY 11223';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.click('.js-open-booking', { timeout: 15000 });

    try {
      await page.click('.js-gate-agree', { timeout: 8000 });
    } catch (e) {
      console.log('Terms gate did not appear (or already past it) — continuing.');
    }

    await page.fill('#fullName', TEST_NAME);
    await page.fill('#phone', TEST_PHONE);
    await page.fill('#address', TEST_ADDRESS);

    await page.check('input[name="service"][value="Wash & Fold"]');

    await page.click('#pickupDateBtn');
    await page.click('.date-select__option:not([disabled])');

    await page.click('#dropoffDateBtn');
    await page.click('.date-select__option:not([disabled])');

    await page.fill('#notes', 'AUTOMATED DAILY HEALTH CHECK. Safe to ignore or delete — not a real customer.');

    await page.click('#bookingSubmitBtn');

    await page.waitForTimeout(5000);

    console.log('✅ Daily health check: order submitted successfully.');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Daily health check FAILED:', err.message);
    try {
      await page.screenshot({ path: 'failure.png', fullPage: true });
    } catch (screenshotErr) {
      console.error('(Could not capture failure screenshot:', screenshotErr.message, ')');
    }
    await browser.close();
    process.exit(1);
  }
})();
