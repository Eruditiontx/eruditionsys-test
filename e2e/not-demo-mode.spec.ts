import { test, expect } from '@playwright/test';

test('If not demo mode, the landing page will not be displayed and will be redirected to the projects page.', async ({
  page,
}) => {
  const screenshotDir = 'playwright-screenshots/not-demo-redirect';

  await page.goto('/');
  await expect(page).toHaveURL(/\/projects/);

  await page.screenshot({ path: `${screenshotDir}/landing-page-redirect.png`, fullPage: true });
});
