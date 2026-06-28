import { expect, test } from '@playwright/test';

const gameNames = ['Blackout', 'Imposter', 'Secret Signals', 'Flip 7', 'Scout'];

test.describe('home library', () => {
  test.beforeEach(async ({ page }) => {
    // Avoid waiting on computed animation opacity; assert on visible cards instead.
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('renders every registered game', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('game-library-card')).toHaveCount(5);

    for (const name of gameNames) {
      await expect(page.getByTestId('game-library-card').filter({ hasText: name })).toBeVisible();
    }
  });

  test('does not block creating a party', async ({ page }) => {
    await page.goto('/');
    await page.fill('#name', 'Alice');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/party\/[A-Z0-9]+/);
  });
});
