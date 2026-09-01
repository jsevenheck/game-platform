import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

interface Session {
  contexts: BrowserContext[];
  pages: Page[];
}

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Host a Party' }).click();
  await page.getByLabel('Your Name').fill(name);
  await page.getByRole('button', { name: 'Create Party', exact: true }).click();
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Join with Code' }).click();
  await page.getByLabel('Your Name').fill(name);
  await page.getByLabel('Invite Code').fill(inviteCode);
  await page.getByRole('button', { name: 'Join Party', exact: true }).click();
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
}

async function createSession(browser: Browser): Promise<Session> {
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const inviteCode = await createParty(pages[0]!, 'Jona');
  await Promise.all(
    pages.slice(1).map((page, index) => joinParty(page, `Spieler ${index + 2}`, inviteCode))
  );
  await expect(pages[0]!.getByRole('heading', { name: 'Players (5)' })).toBeVisible();
  return { contexts, pages };
}

async function closeSession(session: Session): Promise<void> {
  await Promise.all(
    session.contexts.map(async (context) => {
      try {
        await context.close();
      } catch {
        // Playwright may already have disposed a context after a timeout.
      }
    })
  );
}

async function launchGame(session: Session): Promise<void> {
  const host = session.pages[0]!;
  await host.getByRole('button', { name: /Kritzelagent 5–12 players/ }).click();
  await host.getByRole('button', { name: 'Launch Game' }).click();
  await Promise.all(
    session.pages.map((page) => page.waitForURL(/\/game\/kritzelagent/, { timeout: 20_000 }))
  );
  await Promise.all(
    session.pages.map((page) => expect(page.getByTestId('kritzelagent-lobby')).toBeVisible())
  );
}

async function drawStroke(page: Page): Promise<void> {
  const canvas = page.getByRole('img', { name: 'Gemeinsame Kritzel-Leinwand' });
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const box = bounds!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.75, {
    steps: 2,
  });
  await page.mouse.up();
}

async function completeDrawing(session: Session): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) {
    let activePage: Page | undefined;
    for (const page of session.pages) {
      if (await page.getByText('Du bist dran: Zeichne genau einen Strich.').isVisible()) {
        activePage = page;
        break;
      }
    }
    expect(activePage, `active page for turn ${turn + 1}`).toBeDefined();
    await drawStroke(activePage!);
    await expect(
      activePage!.getByText('Du bist dran: Zeichne genau einen Strich.')
    ).not.toBeVisible();
  }
  await Promise.all(
    session.pages.map((page) => expect(page.getByTestId('kritzelagent-voting')).toBeVisible())
  );
}

test.describe('Kritzelagent game', () => {
  test('runs all five rounds, preserves private assignments, and renders the platform overlay', async ({
    browser,
  }) => {
    const session = await createSession(browser);
    try {
      await launchGame(session);
      await session.pages[0]!.getByRole('button', { name: 'Spiel starten' }).click();
      await Promise.all(
        session.pages.map((page) => expect(page.getByTestId('kritzelagent-drawing')).toBeVisible())
      );

      let agentIndex = -1;
      for (let index = 0; index < session.pages.length; index += 1) {
        if (
          await session.pages[index]!.getByText(
            'Du bist der Kritzelagent. Finde heraus, was gezeichnet wird.'
          ).isVisible()
        ) {
          agentIndex = index;
          break;
        }
      }
      expect(agentIndex).toBeGreaterThanOrEqual(0);
      const artistPage = session.pages.findIndex((_, index) => index !== agentIndex);
      const artistBody = await session.pages[artistPage]!.locator('body').innerText();
      const topic = artistBody.match(/Motiv: ([^\n]+)/)?.[1];
      expect(topic).toBeTruthy();
      await expect(session.pages[agentIndex]!.locator('body')).not.toContainText(topic!);

      await completeDrawing(session);
      const agentName = agentIndex === 0 ? 'Jona' : `Spieler ${agentIndex + 1}`;
      const fallbackTarget = agentIndex === 0 ? 'Spieler 2' : 'Jona';
      await Promise.all(
        session.pages.map(async (page, index) => {
          const targetName = index === agentIndex ? fallbackTarget : agentName;
          await page.getByRole('radio', { name: targetName }).check();
          await page.getByRole('button', { name: 'Stimme abgeben' }).click();
        })
      );

      await expect(
        session.pages[agentIndex]!.getByTestId('kritzelagent-agent-guess')
      ).toBeVisible();
      await expect(
        session.pages[(agentIndex + 1) % 5]!.getByText('Warte auf die Auflösung…')
      ).toBeVisible();
      await session.pages[agentIndex]!.getByLabel('Dein Motiv-Tipp').fill('Unbekanntes Motiv');
      await session.pages[agentIndex]!.getByRole('button', { name: 'Motiv raten' }).click();

      await Promise.all(
        session.pages.map((page) => expect(page.getByTestId('kritzelagent-reveal')).toBeVisible())
      );
      await expect(session.pages[0]!.getByText('Die Auflösung')).toBeVisible();

      const playerNames = ['Jona', 'Spieler 2', 'Spieler 3', 'Spieler 4', 'Spieler 5'];
      for (let round = 2; round <= 5; round += 1) {
        await session.pages[0]!.getByRole('button', { name: 'Nächste Runde' }).click();
        await Promise.all(
          session.pages.map((page) =>
            expect(page.getByTestId('kritzelagent-drawing')).toBeVisible()
          )
        );

        let nextAgentIndex = -1;
        for (let index = 0; index < session.pages.length; index += 1) {
          if (
            await session.pages[index]!.getByText(
              'Du bist der Kritzelagent. Finde heraus, was gezeichnet wird.'
            ).isVisible()
          ) {
            nextAgentIndex = index;
            break;
          }
        }
        expect(nextAgentIndex).toBeGreaterThanOrEqual(0);
        await completeDrawing(session);

        const nextAgentName = playerNames[nextAgentIndex]!;
        const nextFallbackTarget = playerNames[nextAgentIndex === 0 ? 1 : 0]!;
        await Promise.all(
          session.pages.map(async (page, index) => {
            const targetName = index === nextAgentIndex ? nextFallbackTarget : nextAgentName;
            await page.getByRole('radio', { name: targetName }).check();
            await page.getByRole('button', { name: 'Stimme abgeben' }).click();
          })
        );
        await expect(
          session.pages[nextAgentIndex]!.getByTestId('kritzelagent-agent-guess')
        ).toBeVisible();
        await session.pages[nextAgentIndex]!.getByLabel('Dein Motiv-Tipp').fill(
          'Unbekanntes Motiv'
        );
        await session.pages[nextAgentIndex]!.getByRole('button', { name: 'Motiv raten' }).click();
        await Promise.all(
          session.pages.map((page) => expect(page.getByTestId('kritzelagent-reveal')).toBeVisible())
        );
      }

      await session.pages[0]!.getByRole('button', { name: 'Ergebnis anzeigen' }).click();
      await Promise.all(
        session.pages.map((page) =>
          expect(page.getByTestId('kritzelagent-game-over')).toBeVisible()
        )
      );
      await expect(session.pages[0]!.getByTestId('platform-replay')).toBeVisible();
    } finally {
      await closeSession(session);
    }
  });
});
