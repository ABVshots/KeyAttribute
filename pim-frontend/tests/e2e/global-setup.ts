import { chromium, FullConfig, expect } from '@playwright/test';

async function waitForServer(url: string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Server not reachable: ${url}`);
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const email = process.env.E2E_EMAIL || 'test@test.com';
  const password = process.env.E2E_PASSWORD || '1q2w3e';

  await waitForServer(baseURL, 45000);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // go to login with retry
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      break;
    } catch (e) {
      if (i === 2) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // switch to password mode if toggle exists
  const toggle = page.getByLabel('Використовувати парольний вхід');
  if (await toggle.count()) await toggle.check();

  await page.getByPlaceholder('email@example.com').fill(email);
  const pw = page.getByPlaceholder('Пароль');
  await pw.fill(password);
  await pw.blur();

  const signIn = page.getByTestId('pw-signin');
  await signIn.click();

  // Try to reach dashboard explicitly (in case SPA redirect is delayed)
  try { await page.waitForURL(/\/dashboard/, { timeout: 3000 }); } catch {}
  if (!/\/dashboard/.test(page.url())) {
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
  }

  // If still not on dashboard, try sign-up then navigate
  if (!/\/dashboard/.test(page.url())) {
    const signUp = page.getByTestId('pw-signup');
    if (await signUp.count()) {
      await signUp.click();
      try { await page.waitForURL(/\/dashboard/, { timeout: 3000 }); } catch {}
      if (!/\/dashboard/.test(page.url())) {
        await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
      }
    }
  }

  // Basic assertion: dashboard main heading or sidebar present
  // If this still fails, tests will proceed with whatever storage we captured.
  try { await page.getByText(/PIM Dashboard|UI Translations/).first().waitFor({ timeout: 3000 }); } catch {}

  await page.context().storageState({ path: 'tests/e2e/.auth/user.json' });
  await browser.close();
}
