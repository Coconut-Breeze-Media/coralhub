import assert from 'node:assert/strict';
import { shouldKeepResourceNavigation } from '../lib/resourceNavigation.ts';

const site = 'www.thecoralreefresearchhub.com';

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

check('resource pages stay in the viewer', () => {
  assert.equal(
    shouldKeepResourceNavigation('https://www.thecoralreefresearchhub.com/courses/', site),
    true
  );
  assert.equal(
    shouldKeepResourceNavigation('https://thecoralreefresearchhub.com/career-opportunities/', site),
    true
  );
});

check('reCAPTCHA iframe is not sent to the system browser', () => {
  const badge = 'https://www.google.com/recaptcha/api2/anchor?ar=1&k=sitekey';
  assert.equal(shouldKeepResourceNavigation(badge, site, false), true);
  assert.equal(shouldKeepResourceNavigation(badge, site, true), true);
  assert.equal(
    shouldKeepResourceNavigation('https://www.gstatic.com/recaptcha/releases/abc/recaptcha__en.js', site, false),
    true
  );
});

check('unrelated websites still leave the viewer', () => {
  assert.equal(shouldKeepResourceNavigation('https://example.com/partners', site, true), false);
  assert.equal(shouldKeepResourceNavigation('mailto:hello@example.com', site, true), false);
});

check('about and blob urls stay internal', () => {
  assert.equal(shouldKeepResourceNavigation('about:blank', site, true), true);
  assert.equal(shouldKeepResourceNavigation('blob:https://www.thecoralreefresearchhub.com/uuid', site), true);
});

console.log('\n4 checks passed');
