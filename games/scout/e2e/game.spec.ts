import { test, expect, type Page } from '@playwright/test';

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join Party' }).click();
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

test.describe('Scout via Platform', () => {
  test('create party, launch Scout, and enter setup', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    const inviteCode = await createParty(page1, 'Alice');
    await joinParty(page2, 'Bob', inviteCode);

    await expect(page1.getByText('Players (2)')).toBeVisible();

    await launchGame(page1, 'Scout');
    await page2.waitForURL(/\/game\/scout/, { timeout: 15_000 });

    await expect(page1.getByRole('button', { name: 'Start Game' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page2.getByText('Waiting for host to start')).toBeVisible({ timeout: 10_000 });

    await page1.getByRole('button', { name: 'Start Game' }).click();
    await expect(page1.getByText('Flip or keep?')).toBeVisible({ timeout: 10_000 });
    await expect(page2.getByText('Flip or keep?')).toBeVisible({ timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });
});
