import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

interface ScoutSession {
  contexts: BrowserContext[];
  hostPage: Page;
  guestPage: Page;
  inviteCode: string;
}

// ── Platform helpers ──────────────────────────────────────────────────────────

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  const form = page.locator('form');
  await form.getByLabel('Your Name').fill(name);
  await form.getByRole('button', { name: 'Create Party', exact: true }).click();
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join Party', exact: true }).click();

  const form = page.locator('form');
  await form.getByLabel('Your Name').fill(name);
  await form.getByLabel('Invite Code').fill(inviteCode);
  await form.getByRole('button', { name: 'Join Party', exact: true }).click();
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
}

async function createTwoPlayerScoutSession(browser: Browser): Promise<ScoutSession> {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  const inviteCode = await createParty(hostPage, 'Alice');
  await joinParty(guestPage, 'Bob', inviteCode);
  await expect(hostPage.getByRole('heading', { name: 'Players (2)' })).toBeVisible();

  return {
    contexts: [hostContext, guestContext],
    hostPage,
    guestPage,
    inviteCode,
  };
}

async function closeSession(session: ScoutSession): Promise<void> {
  await Promise.all(session.contexts.map((context) => context.close()));
}

async function launchScout(hostPage: Page, guestPage: Page): Promise<void> {
  await hostPage.getByRole('button', { name: /Scout/ }).click();
  await Promise.all([
    hostPage.waitForURL(/\/game\/scout/, { timeout: 15_000 }),
    guestPage.waitForURL(/\/game\/scout/, { timeout: 15_000 }),
    hostPage.getByRole('button', { name: 'Launch Game' }).click(),
  ]);
}

// ── Scout game helpers ────────────────────────────────────────────────────────

async function waitForScoutLobby(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Ready your row' })).toBeVisible({
    timeout: 15_000,
  });
}

async function hostStartsFromLobby(hostPage: Page): Promise<void> {
  const startButton = hostPage.getByRole('button', { name: 'Start Game', exact: true });
  await expect(startButton).toBeEnabled({ timeout: 10_000 });
  await startButton.click();
}

async function waitForSetup(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Flip or keep?' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Your dealt row')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep Row' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Flip Row' })).toBeVisible();
}

async function confirmSetupKeep(page: Page): Promise<void> {
  await waitForSetup(page);
  await page.getByRole('button', { name: 'Keep Row' }).click();
}

async function waitForGameTable(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /(?:Your turn|.+?'s turn)/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('heading', { name: 'Your row' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Table' })).toBeVisible();
}

async function startScoutAndCompleteSetup(session: ScoutSession): Promise<void> {
  const { hostPage, guestPage } = session;

  await launchScout(hostPage, guestPage);
  await waitForScoutLobby(hostPage);
  await waitForScoutLobby(guestPage);

  await hostStartsFromLobby(hostPage);
  await confirmSetupKeep(hostPage);
  await confirmSetupKeep(guestPage);

  await waitForGameTable(hostPage);
  await waitForGameTable(guestPage);
}

function playerRow(page: Page): Locator {
  return page.getByTestId('scout-player-row');
}

async function cardPlayValues(container: Locator): Promise<string[]> {
  return (await container.getByTestId('scout-card-play-value').allTextContents()).map((value) =>
    value.trim()
  );
}

async function cardScoutValues(container: Locator): Promise<string[]> {
  return (await container.getByTestId('scout-card-scout-value').allTextContents()).map((value) =>
    value.trim()
  );
}

async function isMyTurn(page: Page): Promise<boolean> {
  return page
    .getByRole('heading', { name: 'Your turn', exact: true })
    .isVisible()
    .catch(() => false);
}

async function playSelectedRowCards(page: Page, indexes: number[]): Promise<void> {
  const row = playerRow(page);
  for (const index of indexes) {
    const card = row.getByTestId(`scout-row-card-${index}`);
    await expect(card).toBeEnabled();
    await card.click();
  }

  const playButton = page.getByRole('button', { name: 'Play selected' });
  await expect(playButton).toBeEnabled();
  await playButton.click();
}

async function scoutFromShowPile(page: Page): Promise<void> {
  const scoutButton = page.getByRole('button', { name: 'Pass / Scout' });
  await expect(scoutButton).toBeEnabled({ timeout: 10_000 });
  await scoutButton.click();

  await expect(page.getByRole('heading', { name: 'Scout a card' })).toBeVisible();
  await expect(page.getByText('Show pile', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirm scout' }).click();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Scout via Platform', () => {
  test('create party, launch Scout, complete setup, and reach game table', async ({ browser }) => {
    const session = await createTwoPlayerScoutSession(browser);

    try {
      await startScoutAndCompleteSetup(session);

      await expect(session.hostPage.getByText('Trick 1')).toBeVisible();
      await expect(session.hostPage.getByText(/Show pile: \d+/)).toBeVisible();
      await expect(session.hostPage.getByRole('button', { name: 'Play selected' })).toBeVisible();
      await expect(session.hostPage.getByRole('button', { name: 'Pass / Scout' })).toBeVisible();
    } finally {
      await closeSession(session);
    }
  });

  test('scout lobby and setup controls use the Scout-specific flow', async ({ browser }) => {
    const session = await createTwoPlayerScoutSession(browser);

    try {
      await launchScout(session.hostPage, session.guestPage);
      await waitForScoutLobby(session.hostPage);
      await waitForScoutLobby(session.guestPage);
      await expect(session.guestPage.getByText('Waiting for host to start…')).toBeVisible();

      await hostStartsFromLobby(session.hostPage);
      await waitForSetup(session.hostPage);
      await waitForSetup(session.guestPage);
    } finally {
      await closeSession(session);
    }
  });

  test('host resumes active Scout match after reloading the tab', async ({ browser }) => {
    const session = await createTwoPlayerScoutSession(browser);

    try {
      await startScoutAndCompleteSetup(session);

      await session.hostPage.reload();
      await session.hostPage.waitForURL(/\/game\/scout/, { timeout: 10_000 });
      await waitForGameTable(session.hostPage);
    } finally {
      await closeSession(session);
    }
  });

  test('flip row swaps card values', async ({ browser }) => {
    const session = await createTwoPlayerScoutSession(browser);
    const { hostPage, guestPage } = session;

    try {
      await launchScout(hostPage, guestPage);
      await waitForScoutLobby(hostPage);
      await waitForScoutLobby(guestPage);
      await hostStartsFromLobby(hostPage);
      await waitForSetup(hostPage);

      const setupRow = hostPage.getByTestId('scout-setup-row');
      await expect(setupRow.getByTestId('scout-card-play-value')).toHaveCount(3);
      const playValuesBefore = await cardPlayValues(setupRow);
      const scoutValuesBefore = await cardScoutValues(setupRow);

      await hostPage.getByRole('button', { name: 'Flip Row' }).click();
      await expect(hostPage.getByText(/Choice locked\. Waiting for \d+ player\(s\)…/)).toBeVisible({
        timeout: 10_000,
      });

      const playValuesAfter = await cardPlayValues(setupRow);
      expect(playValuesAfter).toEqual([...scoutValuesBefore].reverse());
      expect(playValuesAfter).not.toEqual(playValuesBefore);

      await guestPage.getByRole('button', { name: 'Keep Row' }).click();
      await waitForGameTable(hostPage);
    } finally {
      await closeSession(session);
    }
  });

  test('current turn controls are enabled only for active player', async ({ browser }) => {
    const session = await createTwoPlayerScoutSession(browser);
    const { hostPage, guestPage } = session;

    try {
      await startScoutAndCompleteSetup(session);

      const hostHasTurn = await isMyTurn(hostPage);
      const guestHasTurn = await isMyTurn(guestPage);
      expect([hostHasTurn, guestHasTurn].filter(Boolean)).toHaveLength(1);

      const activePage = hostHasTurn ? hostPage : guestPage;
      const inactivePage = hostHasTurn ? guestPage : hostPage;

      await expect(activePage.getByRole('button', { name: 'Play selected' })).toBeVisible();
      await expect(playerRow(activePage).getByTestId('scout-row-card-0')).toBeEnabled();
      await expect(inactivePage.getByRole('button', { name: 'Play selected' })).toBeDisabled();
      await expect(playerRow(inactivePage).getByTestId('scout-row-card-0')).toBeDisabled();
    } finally {
      await closeSession(session);
    }
  });

  test('run, scout response, and game over score flow', async ({ browser }) => {
    const session = await createTwoPlayerScoutSession(browser);
    const { hostPage, guestPage } = session;

    try {
      await startScoutAndCompleteSetup(session);
      await expect(hostPage.getByRole('heading', { name: 'Your turn' })).toBeVisible();

      const openingValues = await cardPlayValues(playerRow(hostPage));
      expect(openingValues.slice(0, 2)).toEqual(['1', '2']);

      await playSelectedRowCards(hostPage, [0, 1]);
      await expect(hostPage.getByText('Beat sum 4 · 2 cards · high 2')).toBeVisible();
      await expect(guestPage.getByRole('heading', { name: 'Your turn' })).toBeVisible({
        timeout: 10_000,
      });

      await scoutFromShowPile(guestPage);
      await expect(hostPage.getByText('Trick 2')).toBeVisible({ timeout: 10_000 });
      await expect(hostPage.getByRole('heading', { name: 'Your turn' })).toBeVisible();

      await playSelectedRowCards(hostPage, [0]);

      await expect(hostPage.getByText('Game over', { exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await expect(guestPage.getByText('Game over', { exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        hostPage.getByText('Scores count scout points from collected tricks.')
      ).toBeVisible();

      const aliceScoreRow = hostPage.getByRole('listitem').filter({ hasText: /#1 Alice/ });
      await expect(aliceScoreRow).toContainText('15');
      await expect(hostPage.getByRole('button', { name: 'Play Again' }).first()).toBeVisible();

      await expect(hostPage.getByText('Game Over!')).toBeVisible({ timeout: 5_000 });
      await expect(hostPage.getByRole('button', { name: 'Back to Party' })).toBeVisible();
    } finally {
      await closeSession(session);
    }
  });
});
