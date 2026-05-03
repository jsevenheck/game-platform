import { expect, test, type Page } from '@playwright/test';

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join Party' }).click();
  await page.fill('#name', name);
  await page.fill('#code', inviteCode);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
}

async function launchGame(hostPage: Page, gameName: string): Promise<void> {
  await hostPage.getByRole('button', { name: gameName }).click();
  await hostPage.getByRole('button', { name: 'Launch Game' }).click();
  await hostPage.waitForURL(/\/game\//);
}

test.describe('platform party resume', () => {
  test('player can leave the game view, see the in-progress banner, and rejoin the active match', async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const host = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    const p3 = await ctx3.newPage();

    const inviteCode = await createParty(host, 'Alice');
    await joinParty(p2, 'Bob', inviteCode);
    await joinParty(p3, 'Carol', inviteCode);

    await launchGame(host, 'Blackout');
    await p2.waitForURL(/\/game\/blackout/, { timeout: 15_000 });
    await p3.waitForURL(/\/game\/blackout/, { timeout: 15_000 });

    await host.getByRole('button', { name: 'Start Game' }).click();
    await p2.waitForSelector('.game-round', { timeout: 10_000 });

    await p2.getByRole('button', { name: /leave/i }).click();
    await p2.locator('.ui-dialog').getByRole('button', { name: 'Leave' }).click();

    await p2.waitForURL(/\/party\/[A-Z0-9]+$/, { timeout: 10_000 });
    await expect(p2.getByText('Game in progress')).toBeVisible({ timeout: 10_000 });
    await p2.getByRole('button', { name: 'Rejoin Game' }).click();

    await p2.waitForURL(/\/party\/[A-Z0-9]+\/game\/blackout/, { timeout: 10_000 });
    await expect(p2.locator('.game-round')).toBeVisible({ timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });

  test('all players can disconnect briefly and the first returning player resumes the active match', async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const host = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    const p3 = await ctx3.newPage();

    const inviteCode = await createParty(host, 'Alice');
    await joinParty(p2, 'Bob', inviteCode);
    await joinParty(p3, 'Carol', inviteCode);

    await launchGame(host, 'Blackout');
    await p2.waitForURL(/\/game\/blackout/, { timeout: 15_000 });
    await p3.waitForURL(/\/game\/blackout/, { timeout: 15_000 });

    await host.getByRole('button', { name: 'Start Game' }).click();
    await host.waitForSelector('.game-round', { timeout: 10_000 });
    await p2.waitForSelector('.game-round', { timeout: 10_000 });
    await p3.waitForSelector('.game-round', { timeout: 10_000 });

    await host.close();
    await p2.close();
    await p3.close();

    const hostReturn = await ctx1.newPage();
    await hostReturn.goto('/');
    await hostReturn.waitForURL(/\/party\/[A-Z0-9]+\/game\/blackout/, { timeout: 10_000 });
    await expect(hostReturn.locator('.game-round')).toBeVisible({ timeout: 10_000 });
    await expect(hostReturn.getByText('Alice')).toBeVisible({ timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });

  test('repeated home visits while a match is active always redirect back into the game view', async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const host = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    const p3 = await ctx3.newPage();

    const inviteCode = await createParty(host, 'Alice');
    await joinParty(p2, 'Bob', inviteCode);
    await joinParty(p3, 'Carol', inviteCode);

    await launchGame(host, 'Blackout');
    await p2.waitForURL(/\/game\/blackout/, { timeout: 15_000 });
    await p3.waitForURL(/\/game\/blackout/, { timeout: 15_000 });

    await host.getByRole('button', { name: 'Start Game' }).click();
    await host.waitForSelector('.game-round', { timeout: 10_000 });

    for (let i = 0; i < 2; i++) {
      await host.goto('/');
      await host.waitForURL(/\/party\/[A-Z0-9]+\/game\/blackout/, { timeout: 10_000 });
      await expect(host.locator('.game-round')).toBeVisible({ timeout: 10_000 });
    }

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });

  test('home route resumes an active match and redirects directly back into the game view', async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const host = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    const p3 = await ctx3.newPage();

    const inviteCode = await createParty(host, 'Alice');
    await joinParty(p2, 'Bob', inviteCode);
    await joinParty(p3, 'Carol', inviteCode);

    await launchGame(host, 'Blackout');
    await p2.waitForURL(/\/game\/blackout/, { timeout: 15_000 });
    await p3.waitForURL(/\/game\/blackout/, { timeout: 15_000 });

    await host.getByRole('button', { name: 'Start Game' }).click();
    await host.waitForSelector('.game-round', { timeout: 10_000 });

    await host.goto('/');
    await host.waitForURL(/\/party\/[A-Z0-9]+\/game\/blackout/, { timeout: 10_000 });
    await expect(host.locator('.game-round')).toBeVisible({ timeout: 10_000 });
    await expect(host.getByText('Alice')).toBeVisible({ timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });
});
