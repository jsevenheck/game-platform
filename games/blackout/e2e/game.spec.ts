import { test, expect, type Page } from '@playwright/test';

async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Create Room' }).click(); // → switches to create mode
  await page.getByRole('button', { name: 'Create Room' }).click(); // → actually creates room
  // Wait for room code to appear
  await page.waitForSelector('.code');
  const code = await page.locator('.code').textContent();
  return code?.trim() ?? '';
}

async function joinRoom(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/');
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByPlaceholder('Room code').fill(code);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await page.waitForSelector('.code, .game-round');
}

test.describe('Blackout Game', () => {
  test('full game flow: create room, join, and start', async ({ browser }) => {
    // Create 3 browser contexts for 3 players
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();

    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    // Player 1 creates room
    const roomCode = await createRoom(page1, 'Alice');
    expect(roomCode).toHaveLength(4);

    // Player 2 and 3 join
    await joinRoom(page2, 'Bob', roomCode);
    await joinRoom(page3, 'Carol', roomCode);

    // Verify all 3 players visible in lobby
    await expect(page1.getByText('Players (3)')).toBeVisible();

    // Host starts game
    await page1.getByRole('button', { name: 'Start Game' }).click();

    // Game should transition to playing phase
    await page1.waitForSelector('.game-round');
    await page2.waitForSelector('.game-round');
    await page3.waitForSelector('.game-round');

    // Clean up
    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });

  test('late join works with room code after game start', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p3Ctx = await browser.newContext();
    const lateCtx = await browser.newContext();

    const hostPage = await hostCtx.newPage();
    const p2Page = await p2Ctx.newPage();
    const p3Page = await p3Ctx.newPage();
    const latePage = await lateCtx.newPage();

    const roomCode = await createRoom(hostPage, 'Host');
    await joinRoom(p2Page, 'Bob', roomCode);
    await joinRoom(p3Page, 'Carol', roomCode);

    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await hostPage.waitForSelector('.game-round');

    await joinRoom(latePage, 'Dave', roomCode);
    await latePage.waitForSelector('.game-round');

    await hostCtx.close();
    await p2Ctx.close();
    await p3Ctx.close();
    await lateCtx.close();
  });
});
