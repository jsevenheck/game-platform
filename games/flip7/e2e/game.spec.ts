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

test.describe('Flip 7 via Platform', () => {
  test('create party, launch Flip 7, and start a game', async ({ browser }) => {
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

    await launchGame(page1, 'Flip 7');
    await page2.waitForURL(/\/game\/flip7/, { timeout: 15_000 });
    await page3.waitForURL(/\/game\/flip7/, { timeout: 15_000 });

    // All players auto-join the game room → Flip 7 lobby appears
    await expect(page1.getByRole('button', { name: 'Start Game' })).toBeVisible({
      timeout: 10_000,
    });

    // Non-host players see waiting message
    await expect(page2.getByText('Waiting for host to start')).toBeVisible({ timeout: 10_000 });
    await expect(page3.getByText('Waiting for host to start')).toBeVisible({ timeout: 10_000 });

    // Host starts game — all players see the game table
    await page1.getByRole('button', { name: 'Start Game' }).click();

    // All pages should now show the game table (deck/discard counters)
    await expect(page1.getByText(/Deck:/)).toBeVisible({ timeout: 10_000 });
    await expect(page2.getByText(/Deck:/)).toBeVisible({ timeout: 10_000 });
    await expect(page3.getByText(/Deck:/)).toBeVisible({ timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });

  test('lobby shows fixed 200-point target score', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    const inviteCode = await createParty(page1, 'Alice');
    await joinParty(page2, 'Bob', inviteCode);
    await joinParty(page3, 'Carol', inviteCode);

    await launchGame(page1, 'Flip 7');
    await page1.waitForURL(/\/game\/flip7/, { timeout: 15_000 });
    await expect(page1.getByRole('button', { name: 'Start Game' })).toBeVisible({
      timeout: 10_000,
    });

    // Target score is fixed at 200 — no stepper controls visible
    await expect(page1.getByText('200', { exact: true })).toBeVisible();
    await expect(page1.getByText('Fixed per official rules')).toBeVisible();
    await expect(page1.getByRole('button', { name: '+' })).not.toBeVisible();
    await expect(page1.getByRole('button', { name: '\u2212' })).not.toBeVisible();

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });

  test('current-turn player sees Hit / Stay controls', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    const inviteCode = await createParty(page1, 'Alice');
    await joinParty(page2, 'Bob', inviteCode);
    await joinParty(page3, 'Carol', inviteCode);

    await launchGame(page1, 'Flip 7');
    await page2.waitForURL(/\/game\/flip7/, { timeout: 15_000 });
    await page3.waitForURL(/\/game\/flip7/, { timeout: 15_000 });

    await page1.getByRole('button', { name: 'Start Game' }).click();
    await expect(page1.getByText(/Deck:/)).toBeVisible({ timeout: 10_000 });

    // Exactly one player should see "Hit" and "Stay" buttons at any given moment
    const hitButtons = await Promise.all([
      page1.getByRole('button', { name: /Hit/ }).isVisible(),
      page2.getByRole('button', { name: /Hit/ }).isVisible(),
      page3.getByRole('button', { name: /Hit/ }).isVisible(),
    ]);
    const activePlayers = hitButtons.filter(Boolean);
    expect(activePlayers).toHaveLength(1);

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });

  test('host resumes the active Flip 7 match after reloading the tab', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    const inviteCode = await createParty(page1, 'Alice');
    await joinParty(page2, 'Bob', inviteCode);
    await joinParty(page3, 'Carol', inviteCode);

    await launchGame(page1, 'Flip 7');
    await page2.waitForURL(/\/game\/flip7/, { timeout: 15_000 });
    await page3.waitForURL(/\/game\/flip7/, { timeout: 15_000 });

    await page1.getByRole('button', { name: 'Start Game' }).click();
    await expect(page1.getByText(/Deck:/)).toBeVisible({ timeout: 10_000 });
    await expect(page1.getByText('Alice (you)')).toBeVisible({ timeout: 10_000 });

    // Reload host tab — should reconnect and show game state
    await page1.reload();
    await page1.waitForURL(/\/game\/flip7/, { timeout: 10_000 });
    await expect(page1.getByText(/Deck:/)).toBeVisible({ timeout: 10_000 });
    await expect(page1.getByText('Alice (you)')).toBeVisible({ timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });
});
