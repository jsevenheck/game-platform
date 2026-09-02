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

      await host!.getByTestId('herd-mentality-answer-input').fill('Pizza');
      await host!.getByTestId('herd-mentality-answer-submit').click();
      await expect(host!.getByTestId('herd-mentality-waiting')).toBeVisible();
      await expect(ben!.getByText('Pizza')).toHaveCount(0);
      await expect(clara!.getByText('Pizza')).toHaveCount(0);

      await ben!.getByTestId('herd-mentality-answer-input').fill('pizza');
      await ben!.getByTestId('herd-mentality-answer-submit').click();
      await clara!.getByTestId('herd-mentality-answer-input').fill('Pizza');
      await clara!.getByTestId('herd-mentality-answer-submit').click();
      await david!.getByTestId('herd-mentality-answer-input').fill('Salat');
      await david!.getByTestId('herd-mentality-answer-submit').click();

      await expect(host!.getByTestId('herd-mentality-reveal')).toBeVisible();
      await expect(host!.getByTestId('herd-mentality-groups')).toHaveCount(0);
      await expect(host!.getByTestId('herd-mentality-reveal-button')).toBeVisible();
      await expect(ben!.getByTestId('herd-mentality-reveal-button')).toHaveCount(0);

      await host!.getByTestId('herd-mentality-reveal-button').click();
      await expect(host!.getByTestId('herd-mentality-groups')).toBeVisible();
      await expect(host!.getByTestId('herd-mentality-groups')).toContainText('pizza');
      await expect(host!.getByTestId('herd-mentality-next-button')).toBeVisible();
      await host!.getByTestId('herd-mentality-next-button').click();
      await expect(host!.getByTestId('herd-mentality-question')).toBeVisible();
      await expect(host!.getByTestId('herd-mentality-answer-input')).toHaveValue('');
    } finally {
      await closeSession(session);
    }
  });
});
