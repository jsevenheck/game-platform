import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

interface Session {
  contexts: BrowserContext[];
  pages: Page[];
  code: string;
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

async function joinParty(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Join with Code' }).click();
  const form = page.locator('form');
  await form.getByLabel('Your Name').fill(name);
  await form.getByLabel('Invite Code').fill(code);
  await form.getByRole('button', { name: 'Join Party', exact: true }).click();
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
}

async function openSession(browser: Browser): Promise<Session> {
  const contexts = await Promise.all([1, 2, 3, 4].map(() => browser.newContext()));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const code = await createParty(pages[0]!, 'Anna');
  await joinParty(pages[1]!, 'Ben', code);
  await joinParty(pages[2]!, 'Clara', code);
  await joinParty(pages[3]!, 'David', code);
  await expect(pages[0]!.getByRole('heading', { name: 'Players (4)' })).toBeVisible();
  return { contexts, pages, code };
}

async function closeSession(session: Session): Promise<void> {
  await Promise.all(session.contexts.map((context) => context.close()));
}

async function launch(session: Session): Promise<void> {
  const [host] = session.pages;
  await host!.getByRole('button', { name: /Herd Mentality/ }).click();
  await host!.getByRole('button', { name: 'Launch Game' }).click();
  await Promise.all(session.pages.map((page) => page.waitForURL(/\/game\/herd-mentality/)));
  await expect(host!.getByTestId('herd-mentality-lobby')).toBeVisible();
}

test.describe('Herd Mentality', () => {
  test('plays a private-answer round through reveal and next round', async ({ browser }) => {
    const session = await openSession(browser);
    try {
      await launch(session);
      const [host, ben, clara, david] = session.pages;
      await host!.getByRole('button', { name: 'Spiel starten' }).click();
      await expect(host!.getByTestId('herd-mentality-question')).toBeVisible();
      await expect(ben!.getByTestId('herd-mentality-question')).toBeVisible();

      await host!.getByTestId('herd-mentality-answer-submit').click();
      await expect(host!.getByText('Bitte eine Antwort eingeben.')).toBeVisible();
      await expect(host!.getByTestId('herd-mentality-question')).toBeVisible();
      await host!.getByTestId('herd-mentality-answer-input').fill('Pizza');
      await host!.getByTestId('herd-mentality-answer-submit').click();
      await expect(host!.getByTestId('herd-mentality-waiting')).toBeVisible();
      for (const page of [ben!, clara!, david!]) {
        await expect(page.getByText('Pizza', { exact: true })).toHaveCount(0);
      }
      await host!.reload();
      await expect(host!.getByTestId('herd-mentality-waiting')).toBeVisible();

      await ben!.getByTestId('herd-mentality-answer-input').fill('pizza');
      await ben!.getByTestId('herd-mentality-answer-submit').click();
      await clara!.getByTestId('herd-mentality-answer-input').fill('Pizza');
      await clara!.getByTestId('herd-mentality-answer-submit').click();
      await david!.getByTestId('herd-mentality-answer-input').fill('Salat');
      await david!.getByTestId('herd-mentality-answer-submit').click();

      await expect(host!.getByTestId('herd-mentality-reveal')).toBeVisible();
      for (const page of session.pages) {
        await expect(page.getByTestId('herd-mentality-groups')).toHaveCount(0);
        await expect(page.getByText('Pizza', { exact: true })).toHaveCount(0);
      }
      let revealer: Page | undefined;
      for (const page of session.pages) {
        if ((await page.getByTestId('herd-mentality-reveal-button').count()) > 0) {
          revealer = page;
          break;
        }
      }
      expect(revealer).toBeDefined();
      if (!revealer) throw new Error('No authoritative host can reveal the round');
      for (const page of session.pages) {
        if (page !== revealer) {
          await expect(page.getByTestId('herd-mentality-reveal-button')).toHaveCount(0);
        }
      }

      await revealer.getByTestId('herd-mentality-reveal-button').click();
      await expect(revealer.getByTestId('herd-mentality-groups')).toBeVisible();
      await expect(revealer.getByTestId('herd-mentality-groups')).toContainText('pizza');
      await expect(revealer.getByTestId('herd-mentality-next-button')).toBeVisible();
      await revealer.getByTestId('herd-mentality-next-button').click();
      await expect(revealer.getByTestId('herd-mentality-question')).toBeVisible();
      await expect(revealer.getByTestId('herd-mentality-answer-input')).toHaveValue('');
      await revealer.setViewportSize({ width: 320, height: 800 });
      await revealer.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await expect
        .poll(() =>
          revealer!.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
          )
        )
        .toBe(true);
    } finally {
      await closeSession(session);
    }
  });

  test('reaches the target, shows the final scoreboard, and replays through the platform overlay', async ({
    browser,
  }) => {
    const session = await openSession(browser);
    try {
      await launch(session);
      const [host, ben, clara, david] = session.pages;
      await host!.getByRole('button', { name: 'Spiel starten' }).click();
      await expect(host!.getByTestId('herd-mentality-question')).toBeVisible();

      for (let round = 1; round <= 8; round += 1) {
        for (const page of [host!, ben!, clara!, david!]) {
          await page.getByTestId('herd-mentality-answer-input').fill('Gemeinsam');
          await page.getByTestId('herd-mentality-answer-submit').click();
        }
        await expect(host!.getByTestId('herd-mentality-reveal')).toBeVisible();
        await host!.getByTestId('herd-mentality-reveal-button').click();
        if (round < 8) {
          await expect(host!.getByTestId('herd-mentality-next-button')).toBeVisible();
          await host!.getByTestId('herd-mentality-next-button').click();
          await expect(host!.getByTestId('herd-mentality-question')).toBeVisible();
        }
      }

      await expect(host!.getByTestId('herd-mentality-gameover')).toBeVisible();
      await expect(host!.getByRole('dialog', { name: 'Spiel beendet' })).toBeVisible();
      await expect(host!.getByTestId('platform-replay')).toBeFocused();
      await expect(host!.getByTestId('platform-return')).toBeVisible();
      await expect(ben!.getByText('Warte auf die Entscheidung des Hosts…')).toBeVisible();

      await host!.getByTestId('platform-replay').click();
      await expect(host!.getByTestId('herd-mentality-lobby')).toBeVisible({ timeout: 15_000 });
      await expect(ben!.getByTestId('herd-mentality-lobby')).toBeVisible({ timeout: 15_000 });

      await host!.getByRole('button', { name: 'Spiel starten' }).click();
      for (let round = 1; round <= 8; round += 1) {
        for (const page of [host!, ben!, clara!, david!]) {
          await page.getByTestId('herd-mentality-answer-input').fill('Gemeinsam');
          await page.getByTestId('herd-mentality-answer-submit').click();
        }
        await expect(host!.getByTestId('herd-mentality-reveal')).toBeVisible();
        await host!.getByTestId('herd-mentality-reveal-button').click();
        if (round < 8) {
          await host!.getByTestId('herd-mentality-next-button').click();
          await expect(host!.getByTestId('herd-mentality-question')).toBeVisible();
        }
      }
      await expect(host!.getByRole('dialog', { name: 'Spiel beendet' })).toBeVisible();
      await host!.getByTestId('platform-return').click();
      await expect(host!).toHaveURL(/\/party\/[A-Z0-9]+$/);
      await expect(ben!).toHaveURL(/\/party\/[A-Z0-9]+$/);
    } finally {
      await closeSession(session);
    }
  });
});
