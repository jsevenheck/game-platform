import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

interface EstimateSession {
  contexts: BrowserContext[];
  hostPage: Page;
  guestPage: Page;
  inviteCode: string;
}

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Host a Party' }).click();
  const form = page.locator('form');
  await form.getByLabel('Your Name').fill(name);
  await form.getByRole('button', { name: 'Create Party', exact: true }).click();
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Join with Code' }).click();
  const form = page.locator('form');
  await form.getByLabel('Your Name').fill(name);
  await form.getByLabel('Invite Code').fill(inviteCode);
  await form.getByRole('button', { name: 'Join Party', exact: true }).click();
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
}

async function createTwoPlayerEstimateSession(
  browser: Browser,
  hostName: string,
  guestName: string
): Promise<EstimateSession> {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  const inviteCode = await createParty(hostPage, hostName);
  await joinParty(guestPage, guestName, inviteCode);
  await expect(hostPage.getByRole('heading', { name: 'Players (2)' })).toBeVisible();

  return {
    contexts: [hostContext, guestContext],
    hostPage,
    guestPage,
    inviteCode,
  };
}

async function closeSession(session: EstimateSession): Promise<void> {
  await Promise.all(session.contexts.map((context) => context.close()));
}

async function launchEstimateGame(hostPage: Page, guestPage: Page): Promise<void> {
  await hostPage.getByRole('button', { name: /Estimate/ }).click();
  // The host now clicks "Launch Game" which emits the launchGame socket event.
  // The server then broadcasts an updated party view (status: in-match),
  // which PartyView consumes to navigate to /party/<code>/game/<gameId>.
  await hostPage.getByRole('button', { name: 'Launch Game' }).click();
  await Promise.all([
    hostPage.waitForURL(/\/game\/estimate/, { timeout: 20_000 }),
    guestPage.waitForURL(/\/game\/estimate/, { timeout: 20_000 }),
  ]);
  // Give GameView a beat to loadClient() and mount PlatformAdapter + App.
  await hostPage.waitForLoadState('networkidle');
}

async function hostStartsGame(hostPage: Page): Promise<void> {
  await expect(hostPage.getByTestId('estimate-lobby')).toBeVisible({ timeout: 15_000 });
  const startButton = hostPage.getByTestId('estimate-start');
  await expect(startButton).toBeEnabled({ timeout: 10_000 });
  await startButton.click();
  // Wait for the room update to land and QuestionView to render.
  await expect(hostPage.getByTestId('estimate-question')).toBeVisible({ timeout: 10_000 });
}

async function bothSubmitGuesses(
  hostPage: Page,
  guestPage: Page,
  hostGuess: string,
  guestGuess: string
): Promise<void> {
  await expect(hostPage.getByTestId('estimate-question')).toBeVisible({ timeout: 15_000 });
  await expect(guestPage.getByTestId('estimate-question')).toBeVisible({ timeout: 15_000 });

  // Host submits.
  await hostPage.getByTestId('estimate-guess-input').fill(hostGuess);
  await hostPage.getByTestId('estimate-guess-submit').click();
  await expect(hostPage.locator('#estimate-waiting-title')).toBeFocused();

  // Guest submits.
  await guestPage.getByTestId('estimate-guess-input').fill(guestGuess);
  await guestPage.getByTestId('estimate-guess-submit').click();

  // After both submissions the room transitions to 'allSubmitted' and the
  // host sees the RevealView (with the solution still hidden). The guest
  // also lands on RevealView once the room phase changes.
  await expect(hostPage.getByTestId('estimate-reveal')).toBeVisible({ timeout: 10_000 });
  await expect(guestPage.getByTestId('estimate-reveal')).toBeVisible({ timeout: 10_000 });
  await expect(hostPage.locator('#estimate-reveal-title')).toBeFocused();
  await expect(guestPage.locator('#estimate-reveal-title')).toBeFocused();
}

async function hostReveals(hostPage: Page): Promise<void> {
  await expect(hostPage.getByTestId('estimate-reveal')).toBeVisible({ timeout: 15_000 });
  // The "Auflösen" button is only visible before reveal. After all players
  // submit, the room transitions to 'allSubmitted' which still shows the
  // reveal button (solution not yet visible).
  await hostPage.getByTestId('estimate-reveal-button').click();
  await expect(hostPage.getByTestId('estimate-revealed-banner')).toBeVisible({ timeout: 5_000 });
}

async function hostAdvances(hostPage: Page): Promise<void> {
  await hostPage.getByTestId('estimate-next-button').click();
  await expect(hostPage.getByTestId('estimate-question')).toBeVisible({ timeout: 10_000 });
}

test.describe('Estimate game', () => {
  test('happy path: 2 players play 1 round end-to-end', async ({ browser }) => {
    const session = await createTwoPlayerEstimateSession(browser, 'Alice', 'Bob');
    try {
      await session.hostPage.setViewportSize({ width: 320, height: 812 });
      await launchEstimateGame(session.hostPage, session.guestPage);
      await expect(session.hostPage.locator('#estimate-lobby-title')).toBeFocused();
      await hostStartsGame(session.hostPage);
      await expect(session.hostPage.locator('#estimate-question-title')).toBeFocused();
      await bothSubmitGuesses(session.hostPage, session.guestPage, '1989', '1990');
      await hostReveals(session.hostPage);
      // The number line is rendered for both players.
      await expect(session.hostPage.getByTestId('estimate-number-line')).toBeVisible();
      await expect(session.guestPage.getByTestId('estimate-number-line')).toBeVisible();
      await session.hostPage.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await expect
        .poll(async () => {
          return session.hostPage.evaluate(() => {
            const chart = document.querySelector('[data-testid="estimate-number-line"]');
            if (!chart) return false;
            const chartBounds = chart.getBoundingClientRect();
            return Array.from(chart.querySelectorAll<HTMLElement>('.marker')).every((marker) => {
              const markerBounds = marker.getBoundingClientRect();
              return (
                markerBounds.left >= chartBounds.left - 1 &&
                markerBounds.right <= chartBounds.right + 1
              );
            });
          });
        })
        .toBe(true);
      const hasHorizontalOverflow = await session.hostPage.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await closeSession(session);
    }
  });

  test('host-only action: guest cannot reveal', async ({ browser }) => {
    const session = await createTwoPlayerEstimateSession(browser, 'Carol', 'Dave');
    try {
      await launchEstimateGame(session.hostPage, session.guestPage);
      await hostStartsGame(session.hostPage);
      await bothSubmitGuesses(session.hostPage, session.guestPage, '100', '100');

      // The reveal button is not visible to the guest.
      await expect(session.guestPage.getByTestId('estimate-reveal-button')).toHaveCount(0);
      // Host can reveal, and equal guesses share the round win.
      await hostReveals(session.hostPage);
      const winners = session.hostPage.getByText(/Gewinner:/);
      await expect(winners).toContainText('Carol');
      await expect(winners).toContainText('Dave');
    } finally {
      await closeSession(session);
    }
  });

  test('final round shows the game-over scoreboard and platform replay overlay', async ({
    browser,
  }) => {
    const session = await createTwoPlayerEstimateSession(browser, 'Grace', 'Heidi');
    try {
      await launchEstimateGame(session.hostPage, session.guestPage);
      await hostStartsGame(session.hostPage);

      const questionTexts = new Set<string>();
      for (let round = 1; round <= 5; round += 1) {
        questionTexts.add(
          (await session.hostPage.locator('#estimate-question-title').textContent())?.trim() ?? ''
        );
        await bothSubmitGuesses(session.hostPage, session.guestPage, '5', '5');
        await hostReveals(session.hostPage);
        await session.hostPage.getByTestId('estimate-next-button').click();
        if (round < 5) {
          await expect(session.hostPage.getByTestId('estimate-question')).toBeVisible();
          await expect(session.guestPage.getByTestId('estimate-question')).toBeVisible();
        }
      }

      expect(questionTexts.size).toBe(5);
      await expect(session.hostPage.getByTestId('estimate-gameover')).toBeVisible();
      await expect(session.hostPage.getByRole('dialog', { name: 'Spiel beendet' })).toBeVisible();
      await expect(session.hostPage.getByTestId('platform-replay')).toBeFocused();
      await session.hostPage.keyboard.press('Shift+Tab');
      await expect(session.hostPage.getByTestId('platform-return')).toBeFocused();
      await session.hostPage.keyboard.press('Tab');
      await expect(session.hostPage.getByTestId('platform-replay')).toBeFocused();
      await expect(session.hostPage.getByTestId('platform-return')).toBeVisible();
      await expect(
        session.guestPage.getByText('Warte auf die Entscheidung des Hosts…')
      ).toBeVisible();

      await session.hostPage.getByTestId('platform-replay').click();
      await expect(session.hostPage.getByTestId('estimate-lobby')).toBeVisible({ timeout: 15_000 });
      await expect(session.guestPage.getByTestId('estimate-lobby')).toBeVisible({
        timeout: 15_000,
      });

      await hostStartsGame(session.hostPage);
      for (let round = 1; round <= 5; round += 1) {
        await bothSubmitGuesses(session.hostPage, session.guestPage, '7', '8');
        await hostReveals(session.hostPage);
        await session.hostPage.getByTestId('estimate-next-button').click();
        if (round < 5) {
          await expect(session.hostPage.getByTestId('estimate-question')).toBeVisible();
        }
      }
      await session.hostPage.getByTestId('platform-return').click();
      await expect(session.hostPage).toHaveURL(/\/party\/[A-Z0-9]+$/);
      await expect(session.guestPage).toHaveURL(/\/party\/[A-Z0-9]+$/);
    } finally {
      await closeSession(session);
    }
  });

  test('multiple rounds: advancing progresses to a new question', async ({ browser }) => {
    const session = await createTwoPlayerEstimateSession(browser, 'Eve', 'Frank');
    try {
      await launchEstimateGame(session.hostPage, session.guestPage);
      await hostStartsGame(session.hostPage);

      // Round 1
      await bothSubmitGuesses(session.hostPage, session.guestPage, '5', '5');
      await hostReveals(session.hostPage);
      await hostAdvances(session.hostPage);

      // Round 2 — both players should see a fresh QuestionView.
      await expect(session.hostPage.getByTestId('estimate-question')).toBeVisible();
      await expect(session.guestPage.getByTestId('estimate-question')).toBeVisible();
      // The input should be empty (fresh state).
      await expect(session.hostPage.getByTestId('estimate-guess-input')).toHaveValue('');
    } finally {
      await closeSession(session);
    }
  });

  test('rejoins the active game after a browser reload', async ({ browser }) => {
    const session = await createTwoPlayerEstimateSession(browser, 'Iris', 'Jules');
    try {
      await launchEstimateGame(session.hostPage, session.guestPage);
      await hostStartsGame(session.hostPage);

      await session.guestPage.reload();
      await expect(session.guestPage.getByTestId('estimate-question')).toBeVisible({
        timeout: 15_000,
      });

      await bothSubmitGuesses(session.hostPage, session.guestPage, '1989', '1990');
      await hostReveals(session.hostPage);
      await expect(session.guestPage.getByTestId('estimate-revealed-banner')).toBeVisible();
    } finally {
      await closeSession(session);
    }
  });

  test('promotes the connected guest when the original host disconnects', async ({ browser }) => {
    const session = await createTwoPlayerEstimateSession(browser, 'Kira', 'Lena');
    try {
      const thirdContext = await browser.newContext();
      session.contexts.push(thirdContext);
      const thirdPage = await thirdContext.newPage();
      await joinParty(thirdPage, 'Mara', session.inviteCode);

      await launchEstimateGame(session.hostPage, session.guestPage);
      await expect(thirdPage.getByTestId('estimate-lobby')).toBeVisible({ timeout: 15_000 });

      await session.contexts[0]!.close();
      await expect(session.guestPage.getByTestId('estimate-start')).toBeEnabled({
        timeout: 15_000,
      });
      await session.guestPage.getByTestId('estimate-start').click();
      await expect(session.guestPage.getByTestId('estimate-question')).toBeVisible();
      await expect(thirdPage.getByTestId('estimate-question')).toBeVisible();
      await session.guestPage.getByTestId('estimate-guess-input').fill('42');
      await session.guestPage.getByTestId('estimate-guess-submit').click();
      await thirdPage.getByTestId('estimate-guess-input').fill('43');
      await thirdPage.getByTestId('estimate-guess-submit').click();
      await expect(session.guestPage.getByTestId('estimate-reveal-button')).toBeVisible();
    } finally {
      await closeSession(session);
    }
  });
});
