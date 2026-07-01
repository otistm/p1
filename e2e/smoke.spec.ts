import { test, expect } from '@playwright/test';

/**
 * End-to-end smoke: boots the production bundle (real WebGL canvas) and walks the full
 * loop — title -> garage -> training -> race HUD. Validates that the React app, Zustand
 * store, R3F canvas, and deterministic sim all wire together at runtime.
 */
test('plays from title through to the race HUD', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  // Kill decorative animations/transitions so elements are immediately click-stable.
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });

  // First-run onboarding coach marks appear once (localStorage-backed); dismiss them as they
  // arrive so they don't intercept clicks. A fresh browser context always sees them.
  const dismissCoach = async () => {
    const gotIt = page.getByRole('button', { name: 'Got it' });
    if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
  };

  // Title
  await expect(page.getByText('P1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enter Garage' }).click();

  // Garage -> dismiss the welcome coach, then start season
  await dismissCoach();
  await expect(page.getByRole('button', { name: 'Start Season →' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Season →' }).click();

  // Training -> dismiss the training coach, then play a couple of training cards (energy-gated,
  // no fixed turn count) and head to race day whenever ready.
  await dismissCoach();
  await expect(page.getByRole('button', { name: 'Head to Race Day →' })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const card = page.getByRole('button', { name: /Speed Sprints/ });
    if (await card.isDisabled().catch(() => true)) break;
    await card.click();
    await page.waitForTimeout(120);
  }
  await page.getByRole('button', { name: 'Head to Race Day →' }).click();

  // Race HUD appears (countdown + speedo).
  await expect(page.getByText('KM/H')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('LAP')).toBeVisible();

  expect(errors, errors.join('\n')).toEqual([]);
});
