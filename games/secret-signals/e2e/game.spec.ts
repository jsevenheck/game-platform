import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

// ── Platform helpers ──────────────────────────────────────────────────────────

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/?tab=host');
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/?tab=join');
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

async function expectTurnIndicatorBelowPlatformControls(page: Page): Promise<void> {
  const indicator = page.locator('.turn-indicator');
  const controls = page.locator('.game-controls');
  await expect(indicator).toBeVisible();
  await expect(controls.first()).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  const [indicatorBox, controlBoxes] = await Promise.all([
    indicator.boundingBox(),
    controls.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { bottom: rect.bottom };
      })
    ),
  ]);

  expect(indicatorBox).not.toBeNull();
  expect(controlBoxes.length).toBeGreaterThan(0);
  const lowestControlBottom = Math.max(...controlBoxes.map(({ bottom }) => bottom));
  expect(indicatorBox!.y).toBeGreaterThanOrEqual(lowestControlBottom);
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

async function setupMobileTeams(browser: Browser, teamCount: number) {
  const colors = ['red', 'blue', 'green', 'orange'].slice(0, teamCount);
  const ctxs = await Promise.all(
    Array.from({ length: teamCount * 2 }, () =>
      browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      })
    )
  );
  const pages = await Promise.all(ctxs.map((context) => context.newPage()));
  const inviteCode = await createParty(pages[0]!, 'Director 1');
  for (let index = 1; index < pages.length; index += 1) {
    await joinParty(pages[index]!, `Player ${index + 1}`, inviteCode);
  }
  await launchGame(pages[0]!, 'Secret Signals');
  await Promise.all(pages.map((page) => page.waitForURL(/\/game\/secret-signals/)));
  await pages[0]!.getByRole('button', { name: String(teamCount), exact: true }).click();
  for (let index = 0; index < pages.length; index += 1) {
    const color = colors[Math.floor(index / 2)]!;
    await chooseTeam(pages[index]!, color);
    await chooseRole(pages[index]!, index % 2 === 0 ? 'director' : 'agent');
  }
  return { ctxs, pages };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Secret Signals via Platform', () => {
  for (const teamCount of [2, 3, 4]) {
    test(`mobile board-first flow supports ${teamCount} teams without leaking ownership`, async ({
      browser,
    }, testInfo) => {
      const { ctxs, pages } = await setupMobileTeams(browser, teamCount);
      const [host, agent] = pages as [Page, Page, ...Page[]];
      const errors: string[] = [];
      pages.forEach((page) => page.on('pageerror', (error) => errors.push(error.message)));
      try {
        await expect(host.locator('.lobby')).toBeVisible();
        await expect(host.getByRole('button', { name: 'Start Game', exact: true })).toBeEnabled();
        if (teamCount === 2)
          await host.screenshot({
            path: testInfo.outputPath('mobile-lobby.png'),
            fullPage: true,
            animations: 'disabled',
          });
        await host.getByRole('button', { name: 'Start Game', exact: true }).click();
        await expect(host.locator('.signals-board .card-cell')).toHaveCount(25);
        await expect(host.locator('.team-score')).toHaveCount(teamCount);
        const first = agent.locator('[data-card-index="0"]');
        await expect(first).toBeDisabled();
        await expect(first).not.toHaveAccessibleName(/, (Red|Blue|Green|Orange|Neutral|Assassin)/);
        await expect(host.locator('.card-type-label')).toHaveCount(0);
        await expect(host.locator('.table-details[open]')).toHaveCount(0);
        const board = await agent.locator('.signals-board').boundingBox();
        expect(board).not.toBeNull();
        expect(board!.y + board!.height).toBeLessThan(844);
        await expect
          .poll(() => agent.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
        // Invalid board-word clues must remain editable and return a visible server error.
        const boardWord = await host.locator('[data-card-index="0"] .card-word').innerText();
        await host.getByLabel('Clue word', { exact: true }).fill(boardWord);
        await host.getByRole('button', { name: 'Send Signal' }).click();
        await expect(host.getByRole('alert')).toContainText(
          'signal cannot match a word on the board'
        );
        await expect(host.getByLabel('Clue word', { exact: true })).toHaveValue(boardWord);
        await host.getByLabel('Clue word', { exact: true }).fill('ALPHA');
        await host.getByRole('button', { name: 'Send Signal' }).click();
        await expect(agent.getByRole('button', { name: 'Reveal Card' })).toBeDisabled();
        await first.tap();
        await expect(first).toContainText('Player 2');
        await expect(agent.getByRole('button', { name: 'Reveal Card' })).toBeEnabled();
        await expect(first).not.toHaveAccessibleName(/Revealed/);
        await expect(agent.getByRole('dialog')).toHaveCount(0);
        await agent.locator('[data-card-index="1"]').tap();
        await expect(agent.locator('[data-card-index="1"]')).toContainText('Player 2');
        await expect(first).toContainText('Player 2');
        await agent.getByRole('button', { name: 'Clear my marks' }).click();
        await expect(first).not.toContainText('Player 2');
        await expect(agent.getByRole('button', { name: 'Reveal Card' })).toBeDisabled();
        await first.tap();
        await expect(agent.getByRole('button', { name: 'Reveal Card' })).toBeEnabled();
        if (teamCount === 2) {
          await expect(agent.getByRole('button', { name: 'Reveal Card' })).toBeEnabled();
          await agent.evaluate(() => window.scrollTo(0, 0));
          await agent.screenshot({
            path: testInfo.outputPath('mobile-agent.png'),
            fullPage: true,
            animations: 'disabled',
          });
          await host.setViewportSize({ width: 1440, height: 1000 });
          await host.evaluate(() => window.scrollTo(0, 0));
          await host.screenshot({
            path: testInfo.outputPath('desktop-director.png'),
            fullPage: true,
            animations: 'disabled',
          });
        }
        await agent.getByRole('button', { name: 'Reveal Card' }).click();
        await expect(first).toHaveAccessibleName(/, Red, Revealed/);
        await expect(first).not.toContainText('Red');
        await agent.setViewportSize({ width: 320, height: 700 });
        await agent.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        await expect
          .poll(() => agent.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
        const cardBounds = await first.boundingBox();
        expect(cardBounds!.height).toBeGreaterThanOrEqual(44);
        expect(cardBounds!.width).toBeGreaterThanOrEqual(44);
        expect(errors).toEqual([]);
      } finally {
        await Promise.all(ctxs.map((context) => context.close()));
      }
    });
  }

  test('platform home shows Game Platform screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home-title')).toBeVisible();
    // Three tabs are present on the home tab bar.
    await expect(page.getByRole('tab', { name: 'Browse Games' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Host a Party' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Join with Code' })).toBeVisible();
  });

  test('host can configure the lobby and complete the opening turn', async ({ browser }) => {
    const { ctxs, pages } = await setupFourPlayers(browser);
    const [host, bob, cara] = pages as [Page, Page, Page, Page];

    await expect(host.locator('.turn-indicator')).toContainText('Red Team');
    await expectTurnIndicatorBelowPlatformControls(host);
    await host.setViewportSize({ width: 1024, height: 768 });
    await expectTurnIndicatorBelowPlatformControls(host);

    // Ownership is conveyed by color visually and accessible names to assistive tech.
    // Agents must still receive no unrevealed ownership.
    await expect(host.locator('.card-type-label')).toHaveCount(0);
    await expect(bob.locator('.card-type-label')).toHaveCount(0);
    const directorCard = host.locator('[data-card-index="0"]');
    await expect(directorCard).toHaveAccessibleName(/, Red$/);
    await expect(bob.locator('[data-card-index="0"]')).not.toHaveAccessibleName(/, Red/);

    await host.getByPlaceholder('Clue word').fill('ALPHA');
    await host.getByRole('button', { name: 'Send Signal' }).click();

    const redFirstCard = bob.locator('[data-card-index="0"]');
    await expect(redFirstCard).toBeEnabled();
    await redFirstCard.click();
    await expect(redFirstCard).toContainText('Bob');
    await expect(bob.getByRole('button', { name: 'Reveal Card' })).toBeEnabled();
    await bob.getByRole('button', { name: 'Reveal Card' }).click();
    await expect(redFirstCard).toHaveAccessibleName(/, Red, Revealed/);
    await expect(redFirstCard).not.toContainText('Red');
    await host.getByRole('button', { name: 'DE', exact: true }).click();
    await expect(directorCard).toHaveAccessibleName(/, Rot, Aufgedeckt/);
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
    await expect(host.locator('.party-code-value')).toContainText(inviteCode);

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
    await host.getByText('Host controls', { exact: true }).click();
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
    await host.getByText('Teams & roles', { exact: true }).click();
    await expect(host.locator('.agent-name', { hasText: 'Bob' })).toBeVisible();

    await ctxs[0]!.close();
    await ctxs[2]!.close();
    await ctxs[3]!.close();
    await bobReconnect.close();
  });

  test('host resumes the active secret-signals match after reloading the tab', async ({
    browser,
  }) => {
    const { ctxs, pages } = await setupFourPlayers(browser);
    const [host] = pages as [Page, Page, Page, Page];

    await expect(host.locator('.turn-indicator')).toContainText('Red Team', { timeout: 10_000 });
    await expect(host.getByPlaceholder('Clue word')).toBeVisible({ timeout: 10_000 });

    await host.reload();
    await host.waitForURL(/\/game\/secret-signals/, { timeout: 10_000 });
    await expect(host.locator('.turn-indicator')).toContainText('Red Team', { timeout: 10_000 });
    await expect(host.getByPlaceholder('Clue word')).toBeVisible({ timeout: 10_000 });

    await Promise.all(ctxs.map((c) => c.close()));
  });

  test('player resumes the active secret-signals match after reloading the tab', async ({
    browser,
  }) => {
    const { ctxs, pages } = await setupFourPlayers(browser);
    const [, bob] = pages as [Page, Page, Page, Page];

    await expect(bob.locator('.turn-indicator')).toContainText('Red Team', { timeout: 10_000 });

    await bob.reload();
    await bob.waitForURL(/\/game\/secret-signals/, { timeout: 10_000 });
    await expect(bob.locator('.turn-indicator')).toContainText('Red Team', { timeout: 10_000 });
    await expect(bob.locator('.gameplay-content')).toBeVisible({ timeout: 10_000 });

    await Promise.all(ctxs.map((c) => c.close()));
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
    // The explicit reveal action replaces the second-tap confirmation modal.
    await expect(bob.getByRole('button', { name: 'Reveal Card' })).toBeVisible({ timeout: 5_000 });
    await bob.getByRole('button', { name: 'Reveal Card' }).click();

    // Game ends immediately → platform overlay appears on host's page
    await host.waitForSelector('.platform-overlay', { timeout: 15_000 });
    await expect(host.locator('.btn-lobby')).toBeVisible();

    await host.locator('.btn-lobby').click();
    await host.waitForURL(/\/party\/[A-Z0-9]+$/, { timeout: 10_000 });
    await expect(host.locator('.party-code-value')).toContainText(inviteCode);

    await Promise.all(ctxs.map((c) => c.close()));
  });
});
