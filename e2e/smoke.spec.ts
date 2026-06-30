import { test, expect } from '@playwright/test';

/**
 * End-to-end smoke: boots the production bundle (real WebGL canvas) and walks the full
 * loop — title -> garage -> draft -> training -> race HUD. Validates that the React app,
 * Zustand store, R3F canvas, and deterministic sim all wire together at runtime.
 */
test('plays from title through to the race HUD', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  // Kill decorative animations/transitions so elements are immediately click-stable.
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });

  // Title
  await expect(page.getByText('P1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enter Garage' }).click();

  // Garage -> start season
  await expect(page.getByRole('button', { name: 'Start Season →' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Season →' }).click();

  // Draft -> pick the first offered card
  await expect(page.getByText('Choose a Tune')).toBeVisible();
  await page.locator('.overlay button').first().click();

  // Training -> spend all turns, then head to race day
  await expect(page.getByText(/Turns left this round/)).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const raceBtn = page.getByRole('button', { name: 'Head to Race Day →' });
    if (await raceBtn.isVisible().catch(() => false)) break;
    await page.getByRole('button', { name: /Speed Sprints/ }).click();
    await page.waitForTimeout(120);
  }
  await page.getByRole('button', { name: 'Head to Race Day →' }).click();

  // Race HUD appears (countdown + speedo).
  await expect(page.getByText('KM/H')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('LAP')).toBeVisible();

  expect(errors, errors.join('\n')).toEqual([]);
});
