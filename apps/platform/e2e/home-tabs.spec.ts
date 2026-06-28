import { expect, test, type Page } from '@playwright/test';

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Host a Party' }).click();
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

test.describe('home tabs', () => {
  test('first visit defaults to Browse', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('home-panel-browse')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Browse Games' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('?tab=join opens Join', async ({ page }) => {
    await page.goto('/?tab=join');
    await expect(page.getByTestId('home-panel-join')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Join with Code' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('invalid ?tab falls back to Browse', async ({ page }) => {
    await page.goto('/?tab=garbage');
    await expect(page.getByTestId('home-panel-browse')).toBeVisible();
  });

  test('active tab persists across refresh', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Host a Party' }).click();
    await expect(page.getByTestId('home-panel-host')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('home-panel-host')).toBeVisible();
  });

  test('Host form name survives switching away and back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Host a Party' }).click();
    await page.fill('#name', 'PersistedHost');
    await page.getByRole('tab', { name: 'Browse Games' }).click();
    await page.getByRole('tab', { name: 'Host a Party' }).click();
    await expect(page.locator('#name')).toHaveValue('PersistedHost');
  });

  test('Join form invite code survives switching away and back', async ({ page }) => {
    await page.goto('/?tab=join');
    await page.fill('#code', 'ABC123');
    await page.getByRole('tab', { name: 'Browse Games' }).click();
    await page.getByRole('tab', { name: 'Join with Code' }).click();
    await expect(page.locator('#code')).toHaveValue('ABC123');
  });

  test('Host tab can create a party', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Host a Party' }).click();
    await page.fill('#name', 'TabHost');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/party\/[A-Z0-9]+/);
  });

  test('Join tab can join an existing party', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const joinCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const joiner = await joinCtx.newPage();
    try {
      const inviteCode = await createParty(host, 'Host');
      await joiner.goto('/');
      await joiner.getByRole('tab', { name: 'Join with Code' }).click();
      await joiner.fill('#name', 'TabJoiner');
      await joiner.fill('#code', inviteCode);
      await joiner.click('button[type="submit"]');
      await joiner.waitForURL(/\/party\/[A-Z0-9]+/);
    } finally {
      await hostCtx.close();
      await joinCtx.close();
    }
  });

  test('clicking a public lobby pre-fills the Join tab', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const obsCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const observer = await obsCtx.newPage();
    try {
      const inviteCode = await createParty(host, 'Alice');
      await host.getByTestId('party-public-toggle').check();

      await observer.goto('/');
      // The card is filtered by this party's invite code, so it is resilient to
      // other concurrent tests' public lobbies on the shared server.
      const card = observer.getByTestId('public-lobby-card').filter({ hasText: inviteCode });
      await expect(card).toBeVisible({ timeout: 10_000 });

      await card.click();
      await expect(observer.getByTestId('home-panel-join')).toBeVisible();
      await expect(observer.locator('#code')).toHaveValue(inviteCode);
    } finally {
      await hostCtx.close();
      await obsCtx.close();
    }
  });

  test('clicking a game in Browse switches to Host and shows the selected-game hint', async ({
    page,
  }) => {
    await page.goto('/');
    // Browse is default; the interactive game library is present.
    await page.getByTestId('game-library-card').filter({ hasText: 'Scout' }).click();
    await expect(page.getByTestId('home-panel-host')).toBeVisible();
    await expect(page.getByTestId('host-preselect')).toContainText('Scout');
  });

  test('mobile viewport uses the native select and changes panels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/');
    // Pills are hidden on mobile; the select is the mobile control.
    await expect(page.locator('#home-tabbar-select')).toBeVisible();
    await expect(page.locator('#home-tab-browse')).toBeHidden();
    await page.locator('#home-tabbar-select').selectOption('join');
    await expect(page.getByTestId('home-panel-join')).toBeVisible();
  });

  test('keyboard Arrow + Enter activates a tab and focuses the panel', async ({ page }) => {
    await page.goto('/');
    // Start on Browse; arrow right to Host, then Enter to activate.
    await page.locator('#home-tab-browse').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#home-tab-host')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('home-panel-host')).toBeVisible();
    // Enter should have moved focus into the panel's first control (#name).
    await expect(page.locator('#name')).toBeFocused();
  });

  test('creating from a preselected game lands in PartyView with that game selected', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('game-library-card').filter({ hasText: 'Scout' }).click();
    await expect(page.getByTestId('home-panel-host')).toBeVisible();
    await expect(page.getByTestId('host-preselect')).toContainText('Scout');
    await page.fill('#name', 'PreselectHost');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/party\/[A-Z0-9]+/);
    // The best-effort selectGame should have selected Scout in the party lobby.
    await expect(page.locator('.ui-game-card-selected').filter({ hasText: 'Scout' })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('tryResume redirects from / even when the stored tab is Browse', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      const inviteCode = await createParty(page, 'ResumeHost');
      // Explicitly store Browse as the active tab — createParty switched to Host.
      await page.evaluate(() => sessionStorage.setItem('home.activeTab', 'browse'));
      // Going home resumes the active match regardless of the stored tab.
      await page.goto('/');
      await page.waitForURL(new RegExp(`/party/${inviteCode}$`), { timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });
});
