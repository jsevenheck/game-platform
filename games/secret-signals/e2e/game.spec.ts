import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

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

// ── Game helpers ──────────────────────────────────────────────────────────────

async function chooseTeam(page: Page, teamColor: string): Promise<void> {
  await page.locator(`[data-self-team="${teamColor}"]`).click();
}

async function chooseRole(page: Page, role: 'director' | 'agent'): Promise<void> {
  await page.locator(`[data-self-role="${role}"]`).click();
}

/** Set up 4 players in a Secret Signals match and start the game. */
async function setupFourPlayers(browser: Browser): Promise<{
  inviteCode: string;
  ctxs: BrowserContext[];
  pages: Page[];
}> {
  const ctxs = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const inviteCode = await createParty(pages[0]!, 'Alice');
  await joinParty(pages[1]!, 'Bob', inviteCode);
  await joinParty(pages[2]!, 'Cara', inviteCode);
  await joinParty(pages[3]!, 'Dan', inviteCode);

  await expect(pages[0]!.locator('text=Players (4)')).toBeVisible();
  await launchGame(pages[0]!, 'Secret Signals');

  for (let i = 1; i < 4; i++) {
    await pages[i]!.waitForURL(/\/game\/secret-signals/, { timeout: 15_000 });
  }

  // Wait for team-setup lobby to load after autoJoinRoom
  await pages[0]!.waitForSelector('.lobby', { timeout: 10_000 });

  // Assign teams and roles
  await chooseTeam(pages[0]!, 'red');
  await chooseRole(pages[0]!, 'director');
  await chooseTeam(pages[1]!, 'red');
  await chooseRole(pages[1]!, 'agent');
  await chooseTeam(pages[2]!, 'blue');
  await chooseRole(pages[2]!, 'director');
  await chooseTeam(pages[3]!, 'blue');
  await chooseRole(pages[3]!, 'agent');

  await expect(pages[0]!.getByRole('button', { name: 'Start Game' })).toBeEnabled();
  await pages[0]!.getByRole('button', { name: 'Start Game' }).click();

  return { inviteCode, ctxs, pages };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Secret Signals via Platform', () => {
  test('platform home shows Game Platform screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Game Platform' })).toBeVisible();
    // Two tab buttons exist; use class selector to avoid strict-mode violation with the submit button
    await expect(page.locator('button.tab', { hasText: 'Create Party' })).toBeVisible();
    await expect(page.locator('button.tab', { hasText: 'Join Party' })).toBeVisible();
  });

  test('host can configure the lobby and complete the opening turn', async ({ browser }) => {
    const { ctxs, pages } = await setupFourPlayers(browser);
    const [host, bob, cara] = pages as [Page, Page, Page, Page];

    await expect(host.locator('.turn-indicator')).toContainText('Red Team');

    await host.getByPlaceholder('Clue word').fill('ALPHA');
    await host.getByRole('button', { name: 'Send Signal' }).click();

    const redFirstCard = bob.locator('[data-card-index="0"]');
    await expect(redFirstCard).toBeEnabled();
    await redFirstCard.click();
    await expect(redFirstCard).toContainText('Bob');
    await redFirstCard.click();
    await expect(bob.getByRole('button', { name: 'Reveal Card' })).toBeVisible();
    await bob.getByRole('button', { name: 'Reveal Card' }).click();
    await bob.getByRole('button', { name: 'End Turn' }).click();

    await expect(cara.locator('.turn-indicator')).toContainText('Blue Team');
    await expect(cara.getByRole('button', { name: 'Send Signal' })).toBeEnabled();

    await Promise.all(ctxs.map((c) => c.close()));
  });

  test('host can toggle assassin behavior in the lobby', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const ctx4 = await browser.newContext();
    const host = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    const p3 = await ctx3.newPage();
    const p4 = await ctx4.newPage();

    const inviteCode = await createParty(host, 'Host');
    await joinParty(p2, 'B', inviteCode);
    await joinParty(p3, 'C', inviteCode);
    await joinParty(p4, 'D', inviteCode);

    await launchGame(host, 'Secret Signals');
    await host.waitForSelector('.lobby', { timeout: 10_000 });

    await expect(host.locator('.mode-hint')).toContainText('ends the match immediately');
    await host.locator('[data-mode="elimination"]').click();
    await expect(host.locator('.mode-hint')).toContainText('removes that team');

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
    await ctx4.close();
  });

  test('player resumes session after page reload', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const ctx4 = await browser.newContext();
    const host = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    const p3 = await ctx3.newPage();
    const p4 = await ctx4.newPage();

    const inviteCode = await createParty(host, 'ReconnectHost');
    await joinParty(p2, 'B', inviteCode);
    await joinParty(p3, 'C', inviteCode);
    await joinParty(p4, 'D', inviteCode);

    // Reload host — platform resume redirects back to party lobby
    await host.reload();
    await host.waitForURL(/\/party\//, { timeout: 8_000 });
    await expect(host.locator('.code')).toContainText(inviteCode);

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
    await ctx4.close();
  });

  test('host can skip the current guess round', async ({ browser }) => {
    const { ctxs, pages } = await setupFourPlayers(browser);
    const [host] = pages as [Page, Page, Page, Page];

    await expect(host.locator('.turn-indicator')).toContainText('Red Team');
    await host.getByPlaceholder('Clue word').fill('ALPHA');
    await host.getByRole('button', { name: 'Send Signal' }).click();
    await host.getByRole('button', { name: 'Skip Turn' }).click();

    await expect(pages[2]!.locator('.turn-indicator')).toContainText('Blue Team');

    await Promise.all(ctxs.map((c) => c.close()));
  });

  test('disconnected player can rejoin an active game by reclaiming the same name', async ({
    browser,
  }) => {
    const { ctxs, pages } = await setupFourPlayers(browser);
    const [host, bob, _cara, _dan] = pages as [Page, Page, Page, Page];

    await expect(host.locator('.turn-indicator')).toContainText('Red Team');

    // Bob disconnects and rejoins via a new page through the platform
    await bob.close();

    const bobReconnect = await ctxs[1]!.newPage();
    // Resume session — platform uses stored session to rejoin
    await bobReconnect.goto('/');
    await bobReconnect.waitForURL(/\/party\/|\/game\//, { timeout: 10_000 });
    await expect(bobReconnect.locator('.turn-indicator')).toContainText('Red Team', {
      timeout: 10_000,
    });
    await expect(host.locator('.agent-name', { hasText: 'Bob' })).toBeVisible();

    await ctxs[0]!.close();
    await ctxs[2]!.close();
    await ctxs[3]!.close();
    await bobReconnect.close();
  });

  test('host returns to party lobby via platform overlay after match ends', async ({ browser }) => {
    const { ctxs, pages, inviteCode } = await setupFourPlayers(browser);
    const [host] = pages as [Page, Page, Page, Page];
    const bob = pages[1]!;

    // Red director (host) sends a signal to start the guessing phase
    await expect(host.locator('.turn-indicator')).toContainText('Red Team', { timeout: 10_000 });
    await host.getByPlaceholder('Clue word').fill('TRAP');
    await host.getByRole('button', { name: 'Send Signal' }).click();

    // Find the assassin card index from the director's view (only directors see card types)
    const assassinCell = host.locator('.card-cell.assassin').first();
    const assassinIndex = await assassinCell.getAttribute('data-card-index', { timeout: 5_000 });

    // Bob (red agent) reveals the assassin card → game ends immediately in default mode
    const assassinCard = bob.locator(`[data-card-index="${assassinIndex}"]`);
    await expect(assassinCard).toBeEnabled({ timeout: 5_000 });
    await assassinCard.click(); // focus/mark the card
    await expect(assassinCard).toContainText('Bob', { timeout: 5_000 }); // wait for server to confirm focus
    await assassinCard.click(); // trigger confirm dialog
    await expect(bob.getByRole('button', { name: 'Reveal Card' })).toBeVisible({ timeout: 5_000 });
    await bob.getByRole('button', { name: 'Reveal Card' }).click();

    // Game ends immediately → platform overlay appears on host's page
    await host.waitForSelector('.platform-overlay', { timeout: 15_000 });
    await expect(host.locator('.btn-lobby')).toBeVisible();

    await host.locator('.btn-lobby').click();
    await host.waitForURL(/\/party\/[A-Z0-9]+$/, { timeout: 10_000 });
    await expect(host.locator('.code')).toContainText(inviteCode);

    await Promise.all(ctxs.map((c) => c.close()));
  });
});
