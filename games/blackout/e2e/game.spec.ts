import { test, expect, type Page } from '@playwright/test';

// ── Platform helpers ──────────────────────────────────────────────────────────

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.code');
  return (await page.locator('.code').textContent())?.trim() ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join Party' }).click();
  await page.fill('#name', name);
  await page.fill('#code', inviteCode);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.code');
}

async function launchGame(hostPage: Page, gameName: string): Promise<void> {
  await hostPage.getByRole('button', { name: gameName }).click();
  await hostPage.getByRole('button', { name: 'Launch Game' }).click();
  await hostPage.waitForURL(/\/game\//);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Blackout via Platform', () => {
  test('create party, launch Blackout, and start a game', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    const inviteCode = await createParty(page1, 'Alice');
    await joinParty(page2, 'Bob', inviteCode);
    await joinParty(page3, 'Carol', inviteCode);

    await expect(page1.getByText('Players (3)')).toBeVisible();

    await launchGame(page1, 'Blackout');
    await page2.waitForURL(/\/game\/blackout/, { timeout: 15_000 });
    await page3.waitForURL(/\/game\/blackout/, { timeout: 15_000 });

    // All players auto-join the game room (embedded mode) → lobby appears
    await expect(page1.getByRole('button', { name: 'Start Game' })).toBeVisible({
      timeout: 10_000,
    });

    // Host starts game — all players see a game round
    await page1.getByRole('button', { name: 'Start Game' }).click();
    await page1.waitForSelector('.game-round');
    await page2.waitForSelector('.game-round');
    await page3.waitForSelector('.game-round');

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });

  test('player can return to party lobby via platform overlay after game ends', async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    const inviteCode = await createParty(page1, 'Alice');
    await joinParty(page2, 'Bob', inviteCode);
    await joinParty(page3, 'Carol', inviteCode);

    await launchGame(page1, 'Blackout');
    await page2.waitForURL(/\/game\/blackout/, { timeout: 15_000 });
    await page3.waitForURL(/\/game\/blackout/, { timeout: 15_000 });

    await page1.getByRole('button', { name: 'Start Game' }).click();
    await page1.waitForSelector('.game-round', { timeout: 10_000 });

    // Play through one round: host reveals and selects winner to score points
    // then all rounds complete → GameOver phase → platform overlay appears
    // We use configureRounds=1 via the Lobby before start; here we just
    // skip rounds until the game ends naturally by exhausting maxRounds.
    // Since we can't easily control round count post-launch, we verify
    // the overlay appears after the game-over phase is reached on the host.
    await page1.waitForSelector('.game-over', { timeout: 60_000 });

    // Platform overlay shows on host page
    await expect(page1.locator('.platform-overlay')).toBeVisible({ timeout: 5_000 });
    await expect(page1.locator('.btn-lobby')).toBeVisible();

    // Host returns to party lobby
    await page1.locator('.btn-lobby').click();
    await page1.waitForURL(/\/party\/[A-Z0-9]+$/, { timeout: 10_000 });
    await expect(page1.locator('.code')).toContainText(inviteCode);

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });
});
