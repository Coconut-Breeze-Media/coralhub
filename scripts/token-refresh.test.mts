import assert from 'node:assert/strict';
import { createTokenRefreshCoordinator, replacementBearer } from '../lib/tokenRefresh.ts';
import { isTransientError } from '../lib/authErrors.ts';

const results: string[] = [];

function check(name: string, fn: () => void | Promise<void>) {
  results.push(name);
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    });
}

await check('concurrent refreshes share one request', async () => {
  let calls = 0;
  const coordinator = createTokenRefreshCoordinator(async (refreshToken: string) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(refreshToken, 'r1');
    return { token: 'a2', refresh_token: 'r2' };
  });

  const [first, second] = await Promise.all([
    coordinator.refresh('r1'),
    coordinator.refresh('r1'),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal(first.token, 'a2');
});

await check('a consumed refresh token is not sent again', async () => {
  let calls = 0;
  const coordinator = createTokenRefreshCoordinator(async () => {
    calls += 1;
    return { token: 'a2', refresh_token: 'r2' };
  });

  await coordinator.refresh('r1');
  const again = await coordinator.refresh('r1');
  assert.equal(calls, 1);
  assert.equal(again.refresh_token, 'r2');
});

await check('callers holding an older token follow the rotation chain', async () => {
  const seen: string[] = [];
  const coordinator = createTokenRefreshCoordinator(async (refreshToken: string) => {
    seen.push(refreshToken);
    if (refreshToken === 'r1') return { token: 'a2', refresh_token: 'r2' };
    if (refreshToken === 'r2') return { token: 'a3', refresh_token: 'r3' };
    throw new Error(`unexpected ${refreshToken}`);
  });

  await coordinator.refresh('r1');
  await coordinator.refresh('r2');
  const fromOriginal = await coordinator.refresh('r1');

  assert.deepEqual(seen, ['r1', 'r2']);
  assert.equal(fromOriginal.token, 'a3');
  assert.equal(fromOriginal.refresh_token, 'r3');
});

await check('a failed refresh can be retried', async () => {
  let calls = 0;
  const coordinator = createTokenRefreshCoordinator(async () => {
    calls += 1;
    if (calls === 1) throw new Error('network down');
    return { token: 'a2', refresh_token: 'r2' };
  });

  await assert.rejects(() => coordinator.refresh('r1'), /network down/);
  const recovered = await coordinator.refresh('r1');
  assert.equal(calls, 2);
  assert.equal(recovered.token, 'a2');
});

await check('a 401 retries with the new access token exactly once', () => {
  assert.equal(replacementBearer(401, 'old', 'https://example.test/wp-json/buddypress/v1/activity', 'new'), 'new');
  assert.equal(replacementBearer(401, 'same', 'https://example.test/wp-json/buddypress/v1/activity', 'same'), null);
  assert.equal(replacementBearer(401, 'old', 'https://example.test/wp-json/jwt-auth/v1/token/validate', 'new'), null);
  assert.equal(replacementBearer(401, 'old', 'https://example.test/wp-json/coral-auth/v1/token/refresh', 'new'), null);
  assert.equal(replacementBearer(500, 'old', 'https://example.test/wp-json/buddypress/v1/activity', 'new'), null);
  assert.equal(replacementBearer(401, null, 'https://example.test/wp-json/buddypress/v1/activity', 'new'), null);
});

await check('transient errors are not treated as a logged-out session', () => {
  assert.equal(isTransientError(new TypeError('Network request failed')), true);
  const abort = new Error('The operation was aborted');
  abort.name = 'AbortError';
  assert.equal(isTransientError(abort), true);
  assert.equal(isTransientError({ status: 503, message: 'unavailable' }), true);
  assert.equal(isTransientError({ status: 401, message: 'expired' }), false);
  assert.equal(isTransientError({ status: 403, message: 'forbidden' }), false);
  assert.equal(isTransientError(new Error('storage failed')), false);
});

console.log(`\n${results.length} checks passed`);
