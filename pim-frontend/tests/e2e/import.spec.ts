import { test, expect } from '@playwright/test';

const JSON_OK = `[
  { "namespace": "e2e", "key": "k1", "locale": "en", "value": "Hello {name}" },
  { "namespace": "e2e", "key": "k1", "locale": "uk", "value": "Привіт {name}" }
]`;

const JSON_WARN = `[
  { "namespace": "e2e", "key": "k2", "locale": "en", "value": "Hi {name}" },
  { "namespace": "e2e", "key": "k2", "locale": "uk", "value": "Привіт, {username}" }
]`;

// Build a payload with >10k items but under 2MB
const JSON_TOO_MANY = (() => {
  const item = { namespace: 'e2e', key: 'bulk', locale: 'en', value: 'x' };
  const arr = Array.from({ length: 10001 }, () => item);
  return JSON.stringify(arr);
})();

const JSON_INVALID_LOCALE = `[
  { "namespace": "e2e", "key": "k3", "locale": "xx", "value": "Hello" },
  { "namespace": "e2e", "key": "k3", "locale": "en", "value": "Hello" }
]`;

test.describe('Async Import Job', () => {
  test('preflight parses JSON and shows totals', async ({ page }) => {
    await page.goto('/dashboard/settings/i18n?e2e=1');

    const card = page.getByTestId('async-import');
    await expect(card).toBeVisible();
    await card.getByRole('radio', { name: /Org/i }).check();

    await card.getByRole('textbox').first().fill(JSON_OK);
    const [res] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/i18n/import/preflight') && r.status() === 200),
      card.getByRole('button', { name: 'Перевірити' }).click(),
    ]);
    expect(res.ok()).toBeTruthy();
    await expect(card.getByText('Елементів:')).toBeVisible();
    await expect(card.getByText('ICU warnings:')).toBeVisible();
  });

  test('preflight warns on ICU mismatch', async ({ page }) => {
    await page.goto('/dashboard/settings/i18n?e2e=1');
    const card = page.getByTestId('async-import');
    await expect(card).toBeVisible();
    await card.getByRole('radio', { name: /Org/i }).check();
    await card.getByRole('textbox').first().fill(JSON_WARN);
    await card.getByRole('button', { name: 'Перевірити' }).click();
    await expect(card.getByText('ICU warnings:')).toBeVisible();
  });

  test('preflight reports invalid locales', async ({ page }) => {
    await page.goto('/dashboard/settings/i18n?e2e=1');
    const card = page.getByTestId('async-import');
    await expect(card).toBeVisible();
    await card.getByRole('radio', { name: /Org/i }).check();
    await card.getByRole('textbox').first().fill(JSON_INVALID_LOCALE);
    await card.getByRole('button', { name: 'Перевірити' }).click();
    await expect(card.getByText('Невалідних локалей:')).toBeVisible();
  });

  test('preflight rejects when too many items', async ({ page }) => {
    await page.goto('/dashboard/settings/i18n?e2e=1');
    const card = page.getByTestId('async-import');
    await expect(card).toBeVisible();
    await card.getByRole('radio', { name: /Org/i }).check();
    await card.getByRole('textbox').first().fill(JSON_TOO_MANY);
    await card.getByRole('button', { name: 'Перевірити' }).click();
    await expect(card.getByText('Занадто багато рядків')).toBeVisible();
  });

  test('cancel then force-cancel shows status/logs', async ({ page }) => {
    if (process.env.E2E_BYPASS_AUTH === '1') test.skip(true, 'Requires authenticated org membership');
    await page.goto('/dashboard/settings/i18n');
    const card = page.getByTestId('async-import');
    await expect(card).toBeVisible();
    await card.getByRole('radio', { name: /Org/i }).check();

    // Ensure org exists, otherwise skip
    const options = card.locator('select option');
    const count = await options.count();
    test.skip(count <= 1, 'No organization membership; skipping job lifecycle test');

    await card.locator('select').first().selectOption({ index: 1 });
    await card.getByRole('textbox').first().fill(JSON_OK);
    await card.getByRole('button', { name: 'Перевірити' }).click();
    await expect(card.getByText('Елементів:')).toBeVisible();
    await card.getByRole('button', { name: 'Start Job' }).click();

    const detailsLink = page.getByRole('link', { name: 'Деталі' }).first();
    await expect(detailsLink).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Force' }).click();

    await detailsLink.click();
    await expect(page.getByText(/Force cancelled|cancelled/i)).toBeVisible({ timeout: 10000 });
  });
});
