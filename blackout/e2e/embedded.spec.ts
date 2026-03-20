import { expect, test } from '@playwright/test';

test('embedded autoJoinRoom reconnects to the same player slot', async ({ browser }) => {
  const sessionId = `embedded-${Date.now()}`;
  const playerId = `hub-${Date.now()}`;
  const url =
    `/embedded-test.html?sessionId=${sessionId}` +
    `&playerId=${playerId}` +
    '&playerName=Embedded+Tester' +
    '&wsNamespace=%2Fg%2Fblackout';

  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  await firstPage.goto(url);
  await expect(firstPage.getByText('Connecting...')).toHaveCount(0, { timeout: 15000 });
  await expect(firstPage.getByText('Players (1)')).toBeVisible({ timeout: 15000 });

  const roomCode = (await firstPage.locator('.code').textContent())?.trim();
  expect(roomCode).toHaveLength(4);

  await secondPage.goto(url);
  await expect(secondPage.getByText('Players (1)')).toBeVisible({ timeout: 15000 });
  await expect(secondPage.locator('.code')).toHaveText(roomCode || '', { timeout: 15000 });
  await expect(secondPage.locator('.player-item')).toHaveCount(1);
  await expect(secondPage.locator('.player-item .player-name')).toHaveText(['Embedded Tester']);

  await firstContext.close();
  await secondContext.close();
});
