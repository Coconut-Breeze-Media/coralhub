import assert from 'node:assert/strict';
import {
  resourceViewerEntry,
  shouldKeepResourceNavigation,
  websiteLoginUrl,
} from '../lib/resourceNavigation.ts';

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

const origin = 'https://www.thecoralreefresearchhub.com';

check('html resources open the website login with redirect_to', () => {
  const courses = `${origin}/courses/`;
  const entry = websiteLoginUrl(courses, origin);
  assert.ok(entry);
  const parsed = new URL(entry);
  assert.equal(parsed.origin, origin);
  assert.equal(parsed.pathname, '/login/');
  assert.equal(parsed.searchParams.get('redirect_to'), courses);

  const opportunities = `${origin}/career-opportunities/`;
  assert.equal(
    new URL(resourceViewerEntry(opportunities, origin, 'ios')).searchParams.get('redirect_to'),
    opportunities
  );
});

check('login redirect stays on this site and ignores other websites', () => {
  assert.equal(websiteLoginUrl('https://example.com/courses/', origin), null);
  assert.equal(resourceViewerEntry('https://example.com/courses/', origin, 'ios'), 'https://example.com/courses/');
  assert.equal(
    new URL(websiteLoginUrl('https://thecoralreefresearchhub.com/courses/', origin)!).searchParams.get('redirect_to'),
    'https://thecoralreefresearchhub.com/courses/'
  );
});

check('pdfs skip the login page', () => {
  const pdf = `${origin}/wp-content/uploads/guide.pdf`;
  assert.equal(resourceViewerEntry(pdf, origin, 'ios'), pdf);
  assert.equal(
    resourceViewerEntry(pdf, origin, 'android'),
    `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(pdf)}`
  );
});

console.log('\n7 checks passed');
