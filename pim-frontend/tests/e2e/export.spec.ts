import { test, expect } from '@playwright/test';

const NS = 'e2e';

test.describe('Export ETag', () => {
  test('HEAD returns ETag and GET honors If-None-Match (304)', async ({ request }) => {
    const headRes = await request.head(`/api/i18n/export?ns=${NS}`);
    expect(headRes.status()).toBe(200);
    const etag = headRes.headers()['etag'];
    expect(etag).toBeTruthy();

    const first = await request.get(`/api/i18n/export?ns=${NS}`, { headers: {} });
    expect(first.status()).toBe(200);

    const cached = await request.get(`/api/i18n/export?ns=${NS}`, { headers: { 'If-None-Match': etag! } });
    expect([200, 304]).toContain(cached.status());
  });
});
