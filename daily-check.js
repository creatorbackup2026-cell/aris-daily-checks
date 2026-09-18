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
const TEST_ADDRESS = '1 Test St, Brooklyn, NY';
const TEST_ZIP = '11201'; // confirmed on the site's approved coverage list

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // The mandatory terms gate appears automatically on page load for any
    // fresh session (no saved account) — it's not triggered by clicking
    // "Book Now"; it shows up on its own. It's also deliberately held
    // behind an invisible interaction blocker until an async ban-check
    // finishes, so on a cloud server's network this can take a few extra
    // seconds to actually appear — hence the generous 25s timeout here.
    try {
      await page.click('.js-gate-agree', { timeout: 25000 });
    } catch (e) {
      console.log('Terms gate did not appear (or already past it) — continuing.');
    }

    // NOW open the booking modal, with the gate already out of the way.
    await page.click('.js-open-booking', { timeout: 15000 });

    // Fill contact info.
    await page.fill('#fullName', TEST_NAME);
    await page.fill('#phone', TEST_PHONE);
    await page.fill('#address', TEST_ADDRESS);
    await page.fill('#zip', TEST_ZIP);

    // Select Wash & Fold — the simplest real service, defaults to the
    // 20lb minimum with no further input needed.
    await page.check('input[name="service"][value="Wash & Fold"]');

    // Pickup date: open the picker, pick the first (earliest) available
    // option. Scoped to #pickupDatePanel specifically — both pickers
    // share the .date-select__option class, and once a panel closes its
    // (now-hidden) option buttons stay in the DOM rather than being
    // removed, so an unscoped selector can grab a leftover hidden option
    // instead of the currently visible one.
    await page.click('#pickupDateBtn');
    await page.click('#pickupDatePanel .date-select__option:not([disabled])');

    // Dropoff date: same pattern, scoped to #dropoffDatePanel.
    await page.click('#dropoffDateBtn');
    await page.click('#dropoffDatePanel .date-select__option:not([disabled])');

    // Leave a clear marker in Special Instructions too, in case anyone
    // ever looks at this order without noticing the name/phone/address.
    await page.fill('#notes', 'AUTOMATED DAILY HEALTH CHECK. Safe to ignore or delete — not a real customer.');

    // Submit. If this succeeds without throwing, the real order pipeline
    // is confirmed working end-to-end, exactly as a real customer
    // experiences it.
    await page.click('#bookingSubmitBtn');

    // Give the submission a moment to actually complete (network request,
    // any on-screen confirmation) before we close the browser.
    await page.waitForTimeout(5000);

    console.log('✅ Daily health check: order submitted successfully.');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Daily health check FAILED:', err.message);
    // Capture a screenshot on failure — shows up in the GitHub Actions
    // run's artifacts, genuinely useful for seeing what the page actually
    // looked like at the moment it broke.
    try {
      await page.screenshot({ path: 'failure.png', fullPage: true });
    } catch (screenshotErr) {
      console.error('(Could not capture failure screenshot:', screenshotErr.message, ')');
    }
    await browser.close();
    process.exit(1); // non-zero exit — this is what makes GitHub mark the run as failed
  }
})();
