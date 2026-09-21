import { test, expect, type Page } from '@playwright/test';

// ── Platform helpers ──────────────────────────────────────────────────────────

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Host a Party' }).click();
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Join with Code' }).click();
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

async function countPagesWithHitStayControls(pages: Page[]): Promise<number> {
  const visibleStates = await Promise.all(
    pages.map(async (page) => {
      const [hitVisible, stayVisible] = await Promise.all([
        page.getByRole('button', { name: /Hit/ }).isVisible(),
        page.getByRole('button', { name: /Stay/ }).isVisible(),
      ]);
      return hitVisible && stayVisible;
    })
  );

  return visibleStates.filter(Boolean).length;
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

  test('host can change the target score in the lobby', async ({ browser }) => {
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

    // Default is 200; only the host gets stepper controls and guests see the change live.
    const hostValue = page1.getByTestId('flip7-target-score-stepper-value');
    await expect(hostValue).toHaveText('200');
    await expect(page2.getByTestId('flip7-target-score-stepper')).toHaveCount(0);
    await expect(page2.getByTestId('flip7-target-score')).toContainText('200');

    await page1.getByTestId('flip7-target-score-stepper-plus').click();
    await expect(hostValue).toHaveText('250');
    await expect(page2.getByTestId('flip7-target-score')).toContainText('250');
    await expect(page3.getByTestId('flip7-target-score')).toContainText('250');

    await page1.getByTestId('flip7-target-score-stepper-minus').click();
    await page1.getByTestId('flip7-target-score-stepper-minus').click();
    await expect(hostValue).toHaveText('150');

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

    const playerPages = [page1, page2, page3];
    await Promise.all(
      playerPages.map((page) => expect(page.getByText(/Deck:/)).toBeVisible({ timeout: 10_000 }))
    );

    // Exactly one player should see "Hit" and "Stay" buttons at any given moment.
    await expect
      .poll(() => countPagesWithHitStayControls(playerPages), { timeout: 10_000 })
      .toBe(1);

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
