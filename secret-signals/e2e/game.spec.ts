import { expect, test, type Page } from '@playwright/test';

async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: 'Create Room' }).click();
  await expect(page.locator('.room-code-display')).toBeVisible();
  const code = (await page.locator('.code').textContent())?.trim();
  if (!code) {
    throw new Error('Room code was not rendered');
  }
  return code;
}

async function joinRoom(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/');
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await page.getByPlaceholder('Room code').fill(code);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await expect(page.locator('.room-code-display')).toContainText(code);
}

async function reclaimRoomSlot(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/');
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await page.getByPlaceholder('Room code').fill(code);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await expect(page.locator('.turn-indicator')).toBeVisible();
}

async function chooseTeam(page: Page, teamColor: string): Promise<void> {
  await page.locator(`[data-self-team="${teamColor}"]`).click();
}

async function chooseRole(page: Page, role: 'director' | 'agent'): Promise<void> {
  await page.locator(`[data-self-role="${role}"]`).click();
}

test('Secret Signals landing screen is available', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Secret Signals' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join Room' })).toBeVisible();
});

test('host can configure the lobby and complete the opening turn', async ({ browser }) => {
  const host = await browser.newPage();
  const bob = await browser.newPage();
  const cara = await browser.newPage();
  const dan = await browser.newPage();

  const roomCode = await createRoom(host, 'Alice');
  await joinRoom(bob, 'Bob', roomCode);
  await joinRoom(cara, 'Cara', roomCode);
  await joinRoom(dan, 'Dan', roomCode);

  await chooseTeam(host, 'red');
  await chooseRole(host, 'director');
  await chooseTeam(bob, 'red');
  await chooseRole(bob, 'agent');
  await chooseTeam(cara, 'blue');
  await chooseRole(cara, 'director');
  await chooseTeam(dan, 'blue');
  await chooseRole(dan, 'agent');

  await expect(host.getByRole('button', { name: 'Start Game' })).toBeEnabled();
  await host.getByRole('button', { name: 'Start Game' }).click();

  await expect(host.locator('.turn-indicator')).toContainText('Red Team');
  await host.getByPlaceholder('Clue word').fill('ALPHA');
  await host.getByRole('button', { name: 'Send Signal' }).click();

  const redFirstCard = bob.locator('[data-card-index="0"]');
  await expect(redFirstCard).toBeEnabled();
  await redFirstCard.click();
  await expect(redFirstCard).toContainText('Bob');
  await redFirstCard.click();
  await expect(bob.getByRole('button', { name: 'Reveal Card' })).toBeVisible();
  await bob.getByRole('button', { name: 'Reveal Card' }).click();
  await bob.getByRole('button', { name: 'End Turn' }).click();

  await expect(cara.locator('.turn-indicator')).toContainText('Blue Team');
  await expect(cara.getByRole('button', { name: 'Send Signal' })).toBeEnabled();

  await host.close();
  await bob.close();
  await cara.close();
  await dan.close();
});

test('host can toggle assassin behavior in the lobby', async ({ page }) => {
  await createRoom(page, 'Host');
  await expect(page.locator('.mode-hint')).toContainText('ends the match immediately');
  await page.locator('[data-mode="elimination"]').click();
  await expect(page.locator('.mode-hint')).toContainText('removes that team');
});

test('player resumes session after page reload and can leave cleanly', async ({ page }) => {
  const roomCode = await createRoom(page, 'ReconnectHost');
  await page.reload();

  await expect(page.locator('.room-code-display')).toBeVisible();
  await expect(page.locator('.code')).toContainText(roomCode);
  await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();

  await page.getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByRole('heading', { name: 'Secret Signals' })).toBeVisible();
  await expect(page.locator('.room-code-display')).toHaveCount(0);
});

test('host can skip the current guess round', async ({ browser }) => {
  const host = await browser.newPage();
  const bob = await browser.newPage();
  const cara = await browser.newPage();
  const dan = await browser.newPage();

  const roomCode = await createRoom(host, 'Alice');
  await joinRoom(bob, 'Bob', roomCode);
  await joinRoom(cara, 'Cara', roomCode);
  await joinRoom(dan, 'Dan', roomCode);

  await chooseTeam(host, 'red');
  await chooseRole(host, 'director');
  await chooseTeam(bob, 'red');
  await chooseRole(bob, 'agent');
  await chooseTeam(cara, 'blue');
  await chooseRole(cara, 'director');
  await chooseTeam(dan, 'blue');
  await chooseRole(dan, 'agent');

  await host.getByRole('button', { name: 'Start Game' }).click();
  await host.getByPlaceholder('Clue word').fill('ALPHA');
  await host.getByRole('button', { name: 'Send Signal' }).click();
  await host.getByRole('button', { name: 'Skip Turn' }).click();

  await expect(cara.locator('.turn-indicator')).toContainText('Blue Team');

  await host.close();
  await bob.close();
  await cara.close();
  await dan.close();
});

test('disconnected player can rejoin an active game by reclaiming the same name', async ({
  browser,
}) => {
  const host = await browser.newPage();
  const bob = await browser.newPage();
  const cara = await browser.newPage();
  const dan = await browser.newPage();

  const roomCode = await createRoom(host, 'Alice');
  await joinRoom(bob, 'Bob', roomCode);
  await joinRoom(cara, 'Cara', roomCode);
  await joinRoom(dan, 'Dan', roomCode);

  await chooseTeam(host, 'red');
  await chooseRole(host, 'director');
  await chooseTeam(bob, 'red');
  await chooseRole(bob, 'agent');
  await chooseTeam(cara, 'blue');
  await chooseRole(cara, 'director');
  await chooseTeam(dan, 'blue');
  await chooseRole(dan, 'agent');

  await host.getByRole('button', { name: 'Start Game' }).click();
  await expect(host.locator('.turn-indicator')).toContainText('Red Team');

  await bob.close();

  const bobReconnect = await browser.newPage();
  await reclaimRoomSlot(bobReconnect, 'Bob', roomCode);
  await expect(bobReconnect.locator('.turn-indicator')).toContainText('Red Team');
  await expect(host.locator('.agent-name', { hasText: 'Bob' })).toBeVisible();

  await host.close();
  await cara.close();
  await dan.close();
  await bobReconnect.close();
});
