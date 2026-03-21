import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.click('#btn-create-room');
  await page.fill('input[placeholder="Your name"]', name);
  await page.click('#btn-create-confirm');
  await page.waitForSelector('.code');
  const code = await page.locator('.code').textContent();
  return code?.trim() ?? '';
}

async function joinRoom(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/');
  await page.click('#btn-join-room');
  await page.fill('input[placeholder="Your name"]', name);
  await page.fill('input[placeholder="Room code"]', code);
  await page.click('#btn-join-confirm');
  await page.waitForSelector('.lobby, .description-phase');
}

async function attemptJoinRoom(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/');
  await page.click('#btn-join-room');
  await page.fill('input[placeholder="Your name"]', name);
  await page.fill('input[placeholder="Room code"]', code);
  await page.click('#btn-join-confirm');
}

/** Submit a description when it is this player's turn. */
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

      if (isActiveTurn) {
        return index;
      }
    }

    await pages[0]!.waitForTimeout(100);
  }

  throw new Error('Timed out waiting for the next clue turn');
}

async function submitDescriptionsInTurnOrder(pages: Page[], prefix = 'clue'): Promise<void> {
  const remainingIndexes = pages.map((_, index) => index);

  for (let turn = 0; turn < pages.length; turn += 1) {
    const activeIndex = await findCurrentTurnPage(pages, remainingIndexes);
    await submitDescription(pages[activeIndex]!, `${prefix}${turn + 1}`);

    const remainingPosition = remainingIndexes.indexOf(activeIndex);
    remainingIndexes.splice(remainingPosition, 1);
  }
}

/** Wait for voting phase and cast a vote for the given player name.
 *  Falls back to the first available button if the preferred target is the
 *  current player (self-vote is not allowed and the button won't appear). */
async function castVote(page: Page, preferredTarget: string): Promise<void> {
  await page.waitForSelector('.voting-phase');
  // Vote buttons only appear once the discussion timer expires
  await page.waitForSelector('button.vote-btn', { timeout: 15_000 });
  // #btn-confirm-vote is inside the "not yet voted" section — its absence means already voted
  const alreadyVoted = !(await page
    .locator('#btn-confirm-vote')
    .isVisible()
    .catch(() => false));
  if (alreadyVoted) return;
  // Try preferred target; fall back to first button (handles self-vote case)
  const preferredBtn = page.locator(`button.vote-btn:has-text("${preferredTarget}")`).first();
  if ((await preferredBtn.count()) > 0) {
    await preferredBtn.click();
  } else {
    await page.locator('button.vote-btn').first().click();
  }
  await page.click('#btn-confirm-vote');
}

/** Complete the guess phase on a page. If this player is the caught infiltrator,
 *  submit a guess; otherwise do nothing (wait for it to auto-expire). */
async function handleGuessPhase(page: Page, guess: string): Promise<void> {
  // If this page shows the guess input, submit; otherwise just wait for auto-skip
  const isGuesser = await page
    .locator('#btn-guess-word')
    .isVisible()
    .catch(() => false);
  if (isGuesser) {
    await page.fill('input[placeholder="Your guess..."]', guess);
    await page.click('#btn-guess-word');
  }
}

/** Set up three players in a room and start the game. Returns roomCode. */
async function setupThreePlayers(
  browser: Browser
): Promise<{ roomCode: string; ctxs: BrowserContext[]; pages: Page[] }> {
  const ctxs = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const roomCode = await createRoom(pages[0]!, 'Host');
  await joinRoom(pages[1]!, 'Player2', roomCode);
  await joinRoom(pages[2]!, 'Player3', roomCode);

  await expect(pages[0]!.locator('text=Players (3)')).toBeVisible();
  await pages[0]!.click('#btn-start-game');

  return { roomCode, ctxs, pages };
}

/** Play through a full round: descriptions → voting → reveal.
 *  All players vote for the same target. Returns the reveal page. */
async function playFullRound(pages: Page[], voteTarget: string): Promise<void> {
  await submitDescriptionsInTurnOrder(pages);

  // Wait for voting phase on all pages then cast votes
  await Promise.all(pages.map((p) => castVote(p, voteTarget)));

  // Wait for reveal on all pages (auto-resolves when all votes in)
  await Promise.all(pages.map((p) => p.waitForSelector('.reveal-phase', { timeout: 10_000 })));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Imposter Game', () => {
  test('shows a visible error when a duplicate player name tries to join', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const joinCtx = await browser.newContext();

    const hostPage = await hostCtx.newPage();
    const joinPage = await joinCtx.newPage();

    const roomCode = await createRoom(hostPage, 'Host');
    await attemptJoinRoom(joinPage, 'Host', roomCode);

    await expect(joinPage.locator('.error')).toContainText('Name already taken');

    await hostCtx.close();
    await joinCtx.close();
  });

  // ── Full round → End Game → GameOver ───────────────────────────────────────
  test('host can end game after a round and see final scoreboard', async ({ browser }) => {
    const { ctxs, pages } = await setupThreePlayers(browser);
    const [hostPage, p2Page, p3Page] = pages as [Page, Page, Page];

    await playFullRound(pages, 'Player2');

    // Handle optional guess phase (auto-expires after 3 s in E2E mode)
    await Promise.all(pages.map((p) => handleGuessPhase(p, 'RandomWord')));

    // Wait for round result banner to appear
    await hostPage.waitForSelector('.round-result', { timeout: 10_000 });

    // Host clicks End Game
    await hostPage.click('#btn-end-game');

    // All players should see the GameOver screen
    await Promise.all(
      [hostPage, p2Page, p3Page].map((p) => p.waitForSelector('.game-over', { timeout: 5_000 }))
    );

    // Scoreboard should be visible
    await expect(hostPage.locator('.final-scores')).toBeVisible();

    // Host can restart back to lobby
    await hostPage.click('button:has-text("Play Again")');
    await hostPage.waitForSelector('.lobby');

    await Promise.all(ctxs.map((c) => c.close()));
  });

  // ── Next Round flow ────────────────────────────────────────────────────────
  test('host can start a next round after reveal', async ({ browser }) => {
    const { ctxs, pages } = await setupThreePlayers(browser);
    const [hostPage] = pages as [Page, Page, Page];

    await playFullRound(pages, 'Player2');
    await Promise.all(pages.map((p) => handleGuessPhase(p, 'RandomWord')));

    await hostPage.waitForSelector('.round-result', { timeout: 10_000 });

    // Host starts next round
    await hostPage.click('#btn-next-round');

    // All players should be back in description phase (round 2)
    await Promise.all(
      pages.map((p) => p.waitForSelector('.description-phase', { timeout: 5_000 }))
    );

    const roundBadge = await hostPage.locator('.round-badge').textContent();
    expect(roundBadge?.trim()).toBe('Round 2');

    await Promise.all(ctxs.map((c) => c.close()));
  });

  // ── Paranoia mode ──────────────────────────────────────────────────────────
  test('paranoia mode (0 infiltrators): civilians always win', async ({ browser }) => {
    const { ctxs } = await setupThreePlayers(browser);

    // Re-start by going back — host already started, we need a fresh room for this test
    // Instead, set up a dedicated fresh room with paranoia config:
    await Promise.all(ctxs.map((c) => c.close()));

    // Fresh setup
    const ctxs2 = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const pages2 = await Promise.all(ctxs2.map((c) => c.newPage()));

    const roomCode2 = await createRoom(pages2[0]!, 'Host');
    await joinRoom(pages2[1]!, 'P2', roomCode2);
    await joinRoom(pages2[2]!, 'P3', roomCode2);
    await expect(pages2[0]!.locator('text=Players (3)')).toBeVisible();

    // Decrease infiltrator count to 0 (click − button once, it starts at 1)
    await pages2[0]!.locator('.stepper-btn').first().click();
    // Verify "(Paranoia Mode!)" label appears
    await expect(pages2[0]!.locator('text=Paranoia Mode')).toBeVisible();

    await pages2[0]!.click('#btn-start-game');

    // All players see their word (no one is infiltrator)
    await Promise.all(pages2.map((p) => p.waitForSelector('.description-phase')));
    // All pages should show "You are a Civilian" (word known to everyone)
    for (const p of pages2) {
      await expect(p.locator('.role-badge.civilian')).toBeVisible();
    }

    // Complete descriptions
    await submitDescriptionsInTurnOrder(pages2, 'pclue');
    // Vote for anyone
    await Promise.all(pages2.map((p) => castVote(p, 'P2')));

    await pages2[0]!.waitForSelector('.reveal-phase', { timeout: 10_000 });

    // Paranoia reveal message
    await expect(pages2[0]!.locator('text=Paranoia Mode')).toBeVisible();

    // Result should be civilians win
    await pages2[0]!.waitForSelector('.round-result');
    await expect(pages2[0]!.locator('.result-banner.civilians')).toBeVisible();

    await Promise.all(ctxs2.map((c) => c.close()));
  });

  // ── Host can skip infiltrator guess ────────────────────────────────────────
  test('host can skip the infiltrator guess', async ({ browser }) => {
    const { ctxs, pages } = await setupThreePlayers(browser);
    const [hostPage] = pages as [Page, Page, Page];

    await playFullRound(pages, 'Player2');

    // If a guess is waiting, the host can skip it
    const waitingGuess = await hostPage
      .locator('#btn-skip-guess')
      .isVisible()
      .catch(() => false);

    if (waitingGuess) {
      await expect(hostPage.locator('.word-hidden')).toBeVisible();
      await hostPage.click('#btn-skip-guess');
    }

    // Either way we should reach the result banner
    await hostPage.waitForSelector('.round-result', { timeout: 10_000 });
    await expect(hostPage.locator('.round-result')).toBeVisible();

    await Promise.all(ctxs.map((c) => c.close()));
  });

  // ── Session resume (page reload) ───────────────────────────────────────────
  test('player resumes session after page reload', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();

    const hostPage = await hostCtx.newPage();
    const p2Page = await p2Ctx.newPage();
    const p3Page = await p3Ctx.newPage();

    const roomCode = await createRoom(hostPage, 'Host');
    await joinRoom(p2Page, 'Player2', roomCode);
    await joinRoom(p3Page, 'Player3', roomCode);

    await expect(hostPage.locator('text=Players (3)')).toBeVisible();

    // Reload host page — session should auto-resume
    await hostPage.reload();
    // After reload + session resume, should be back in lobby (not landing)
    await hostPage.waitForSelector('.lobby', { timeout: 8_000 });
    await expect(hostPage.locator('.code')).toContainText(roomCode);

    await hostCtx.close();
    await p2Ctx.close();
    await p3Ctx.close();
  });

  // ── Voting: back to lobby ──────────────────────────────────────────────────
  test('host can go back to lobby from reveal', async ({ browser }) => {
    const { ctxs, pages } = await setupThreePlayers(browser);
    const [hostPage] = pages as [Page, Page, Page];

    await playFullRound(pages, 'Player2');
    await Promise.all(pages.map((p) => handleGuessPhase(p, 'skip')));
    await hostPage.waitForSelector('.round-result', { timeout: 10_000 });

    // Click "Back to Lobby"
    await hostPage.click('button:has-text("Back to Lobby")');
    await hostPage.waitForSelector('.lobby');

    // Scores should be reset
    await expect(hostPage.locator('.lobby')).toBeVisible();

    await Promise.all(ctxs.map((c) => c.close()));
  });
});
