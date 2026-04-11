import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

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

async function submitDescription(page: Page, text: string): Promise<void> {
  await page.waitForSelector('.description-phase');
  await page.waitForSelector('#btn-submit-description', { timeout: 10_000 });
  await page.fill('input[type="text"]', text);
  await page.click('#btn-submit-description');
}

async function findCurrentTurnPage(pages: Page[], remainingIndexes: number[]): Promise<number> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    for (const index of remainingIndexes) {
      const isActiveTurn = await pages[index]!.locator('#btn-submit-description')
        .isVisible()
        .catch(() => false);
      if (isActiveTurn) return index;
    }
    await pages[0]!.waitForTimeout(100);
  }
  throw new Error('Timed out waiting for the next clue turn');
}

async function submitDescriptionsInTurnOrder(pages: Page[], prefix = 'clue'): Promise<void> {
  const remainingIndexes = pages.map((_, i) => i);
  for (let turn = 0; turn < pages.length; turn += 1) {
    const activeIndex = await findCurrentTurnPage(pages, remainingIndexes);
    await submitDescription(pages[activeIndex]!, `${prefix}${turn + 1}`);
    remainingIndexes.splice(remainingIndexes.indexOf(activeIndex), 1);
  }
}

async function castVote(page: Page, preferredTarget: string): Promise<void> {
  await page.waitForSelector('.voting-phase');
  await page.waitForSelector('button.vote-btn', { timeout: 15_000 });
  const alreadyVoted = !(await page
    .locator('#btn-confirm-vote')
    .isVisible()
    .catch(() => false));
  if (alreadyVoted) return;
  const preferredBtn = page.locator(`button.vote-btn:has-text("${preferredTarget}")`).first();
  if ((await preferredBtn.count()) > 0) {
    await preferredBtn.click();
  } else {
    await page.locator('button.vote-btn').first().click();
  }
  await page.click('#btn-confirm-vote');
}

async function handleGuessPhase(page: Page, guess: string): Promise<void> {
  const isGuesser = await page
    .locator('#btn-guess-word')
    .isVisible()
    .catch(() => false);
  if (isGuesser) {
    await page.fill('input[placeholder="Your guess..."]', guess);
    await page.click('#btn-guess-word');
  }
}

async function playFullRound(pages: Page[], voteTarget: string): Promise<void> {
  await submitDescriptionsInTurnOrder(pages);
  await Promise.all(pages.map((p) => castVote(p, voteTarget)));
  await Promise.all(pages.map((p) => p.waitForSelector('.reveal-phase', { timeout: 10_000 })));
}

/** Launch an Imposter match for 3 players and start the in-game round. */
async function setupThreePlayers(
  browser: Browser
): Promise<{ inviteCode: string; ctxs: BrowserContext[]; pages: Page[] }> {
  const ctxs = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const inviteCode = await createParty(pages[0]!, 'Host');
  await joinParty(pages[1]!, 'Player2', inviteCode);
  await joinParty(pages[2]!, 'Player3', inviteCode);

  await expect(pages[0]!.locator('text=Players (3)')).toBeVisible();
  await launchGame(pages[0]!, 'Imposter');

  await pages[1]!.waitForURL(/\/game\/imposter/, { timeout: 15_000 });
  await pages[2]!.waitForURL(/\/game\/imposter/, { timeout: 15_000 });

  // Wait for lobby to load (autoJoinRoom completed) then start game
  await pages[0]!.waitForSelector('.lobby', { timeout: 10_000 });
  await pages[0]!.click('#btn-start-game');

  return { inviteCode, ctxs, pages };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Imposter via Platform', () => {
  test('shows a visible error when a duplicate player name tries to join the party', async ({
    browser,
  }) => {
    const hostCtx = await browser.newContext();
    const joinCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const joinPage = await joinCtx.newPage();

    const inviteCode = await createParty(hostPage, 'Host');
    // Try to join with the same name
    await joinPage.goto('/');
    await joinPage.getByRole('button', { name: 'Join Party' }).click();
    await joinPage.fill('#name', 'Host');
    await joinPage.fill('#code', inviteCode);
    await joinPage.click('button[type="submit"]');

    // The platform enforces unique names at the party level — the server returns an
    // error and the UI renders it via the .error element.
    await expect(joinPage.locator('.error')).toBeVisible();

    await hostCtx.close();
    await joinCtx.close();
  });

  test('host can end game after a round and see final scoreboard', async ({ browser }) => {
    const { inviteCode, ctxs, pages } = await setupThreePlayers(browser);
    const [hostPage, p2Page, p3Page] = pages as [Page, Page, Page];

    await playFullRound(pages, 'Player2');
    await Promise.all(pages.map((p) => handleGuessPhase(p, 'RandomWord')));
    await hostPage.waitForSelector('.round-result', { timeout: 10_000 });

    await hostPage.click('#btn-end-game');
    await Promise.all(
      [hostPage, p2Page, p3Page].map((p) => p.waitForSelector('.game-over', { timeout: 5_000 }))
    );
    await expect(hostPage.locator('.final-scores')).toBeVisible();

    // Host returns to party lobby via platform overlay
    await expect(hostPage.locator('.platform-overlay')).toBeVisible({ timeout: 5_000 });
    await hostPage.locator('.btn-lobby').click();
    await hostPage.waitForURL(/\/party\/[A-Z0-9]+$/, { timeout: 10_000 });
    await expect(hostPage.locator('.code')).toContainText(inviteCode);

    await Promise.all(ctxs.map((c) => c.close()));
  });

  test('host can start a next round after reveal', async ({ browser }) => {
    const { ctxs, pages } = await setupThreePlayers(browser);
    const [hostPage] = pages as [Page, Page, Page];

    await playFullRound(pages, 'Player2');
    await Promise.all(pages.map((p) => handleGuessPhase(p, 'RandomWord')));
    await hostPage.waitForSelector('.round-result', { timeout: 10_000 });

    await hostPage.click('#btn-next-round');
    await Promise.all(
      pages.map((p) => p.waitForSelector('.description-phase', { timeout: 5_000 }))
    );

    const roundBadge = await hostPage.locator('.round-badge').textContent();
    expect(roundBadge?.trim()).toBe('Round 2');

    await Promise.all(ctxs.map((c) => c.close()));
  });

  test('paranoia mode (0 infiltrators): civilians always win', async ({ browser }) => {
    const ctxs = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const pages = await Promise.all(ctxs.map((c) => c.newPage()));

    const inviteCode = await createParty(pages[0]!, 'Host');
    await joinParty(pages[1]!, 'P2', inviteCode);
    await joinParty(pages[2]!, 'P3', inviteCode);
    await expect(pages[0]!.locator('text=Players (3)')).toBeVisible();

    await launchGame(pages[0]!, 'Imposter');
    await pages[1]!.waitForURL(/\/game\/imposter/, { timeout: 15_000 });
    await pages[2]!.waitForURL(/\/game\/imposter/, { timeout: 15_000 });

    await pages[0]!.waitForSelector('.lobby', { timeout: 10_000 });

    // Decrease infiltrator count to 0 (click − button once, starts at 1)
    await pages[0]!.locator('.stepper-btn').first().click();
    await expect(pages[0]!.locator('text=Paranoia Mode')).toBeVisible();

    await pages[0]!.click('#btn-start-game');

    await Promise.all(pages.map((p) => p.waitForSelector('.description-phase')));
    for (const p of pages) {
      await expect(p.locator('.role-badge.civilian')).toBeVisible();
    }

    await submitDescriptionsInTurnOrder(pages, 'pclue');
    await Promise.all(pages.map((p) => castVote(p, 'P2')));

    await pages[0]!.waitForSelector('.reveal-phase', { timeout: 10_000 });
    await expect(pages[0]!.locator('text=Paranoia Mode')).toBeVisible();

    await pages[0]!.waitForSelector('.round-result');
    await expect(pages[0]!.locator('.result-banner.civilians')).toBeVisible();

    await Promise.all(ctxs.map((c) => c.close()));
  });

  test('host can skip the infiltrator guess', async ({ browser }) => {
    const { ctxs, pages } = await setupThreePlayers(browser);
    const [hostPage] = pages as [Page, Page, Page];

    await playFullRound(pages, 'Player2');

    const waitingGuess = await hostPage
      .locator('#btn-skip-guess')
      .isVisible()
      .catch(() => false);
    if (waitingGuess) {
      await expect(hostPage.locator('.word-hidden')).toBeVisible();
      await hostPage.click('#btn-skip-guess');
    }

    await hostPage.waitForSelector('.round-result', { timeout: 10_000 });
    await expect(hostPage.locator('.round-result')).toBeVisible();

    await Promise.all(ctxs.map((c) => c.close()));
  });

  test('player resumes session after page reload', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    const inviteCode = await createParty(page1, 'Host');
    await joinParty(page2, 'Player2', inviteCode);
    await joinParty(page3, 'Player3', inviteCode);

    await expect(page1.locator('text=Players (3)')).toBeVisible();

    // Reload host — platform resume redirects back to party lobby
    await page1.reload();
    await page1.waitForURL(/\/party\//, { timeout: 8_000 });
    await expect(page1.locator('.code')).toContainText(inviteCode);

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });

  test('host resumes the active imposter match after reloading the tab', async ({ browser }) => {
    const { ctxs, pages } = await setupThreePlayers(browser);
    const [hostPage] = pages as [Page, Page, Page];

    await Promise.all(
      pages.map((p) => p.waitForSelector('.description-phase', { timeout: 10_000 }))
    );
    await expect(hostPage.locator('.round-badge')).toContainText('Round 1');

    await hostPage.reload();
    await hostPage.waitForURL(/\/game\/imposter/, { timeout: 10_000 });
    await hostPage.waitForSelector('.description-phase', { timeout: 10_000 });
    await expect(hostPage.locator('.round-badge')).toContainText('Round 1');

    await Promise.all(ctxs.map((c) => c.close()));
  });

  test('player resumes the active imposter match after reloading the tab', async ({ browser }) => {
    const { ctxs, pages } = await setupThreePlayers(browser);
    const [, player2Page] = pages as [Page, Page, Page];

    await Promise.all(
      pages.map((p) => p.waitForSelector('.description-phase', { timeout: 10_000 }))
    );
    await expect(player2Page.locator('.round-badge')).toContainText('Round 1');

    await player2Page.reload();
    await player2Page.waitForURL(/\/game\/imposter/, { timeout: 10_000 });
    await player2Page.waitForSelector('.description-phase', { timeout: 10_000 });
    await expect(player2Page.locator('.round-badge')).toContainText('Round 1');

    await Promise.all(ctxs.map((c) => c.close()));
  });

  test('host can replay the game via platform overlay', async ({ browser }) => {
    const { ctxs, pages } = await setupThreePlayers(browser);
    const [hostPage] = pages as [Page, Page, Page];

    await playFullRound(pages, 'Player2');
    await Promise.all(pages.map((p) => handleGuessPhase(p, 'skip')));
    await hostPage.waitForSelector('.round-result', { timeout: 10_000 });

    await hostPage.click('#btn-end-game');
    await hostPage.waitForSelector('.game-over', { timeout: 5_000 });

    // Platform overlay → Play Again → new match starts
    await expect(hostPage.locator('.platform-overlay')).toBeVisible({ timeout: 5_000 });
    await hostPage.locator('.btn-replay').click();

    // URL stays on game view but matchKey changes (component re-mounts)
    await hostPage.waitForURL(/\/game\/imposter/, { timeout: 10_000 });
    await hostPage.waitForSelector('.lobby', { timeout: 10_000 });

    await Promise.all(ctxs.map((c) => c.close()));
  });
});
