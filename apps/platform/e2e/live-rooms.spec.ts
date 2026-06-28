import { expect, test, type Page } from '@playwright/test';

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Host a Party' }).click();
  await page.fill('#name', name);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
  return page.url().split('/party/')[1]?.split('/')[0] ?? '';
}

async function joinParty(page: Page, name: string, inviteCode: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Join with Code' }).click();
  await page.fill('#name', name);
  await page.fill('#code', inviteCode);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/party\/[A-Z0-9]+/);
}

test.describe('live rooms / public lobby discovery', () => {
  test('public lobby appears, can be pre-filled, and tracks lifecycle', async ({ browser }) => {
    test.setTimeout(120_000);
    const hostCtx = await browser.newContext();
    const observerCtx = await browser.newContext();
    const p3Ctx = await browser.newContext();
    const host = await hostCtx.newPage();
    const observer = await observerCtx.newPage();
    const p3 = await p3Ctx.newPage();

    try {
      // 1. Host creates a party.
      const inviteCode = await createParty(host, 'Alice');

      // 2. Observer opens home (Browse); the Live Rooms feed loads.
      //    (Don't assert strict emptiness — the shared server may expose other
      //    concurrent tests' public lobbies; the card assertions below are
      //    filtered by this party's invite code and thus resilient.)
      await observer.goto('/');
      await expect(observer.getByText('Live Rooms')).toBeVisible({ timeout: 10_000 });

      // 3. Host toggles "List this room publicly".
      await host.getByTestId('party-public-toggle').check();

      // 4. Observer sees a card with the invite code within 5s.
      const card = observer.getByTestId('public-lobby-card').filter({ hasText: inviteCode });
      await expect(card).toBeVisible({ timeout: 5_000 });

      // 5. Observer clicks the card; the Join tab opens with the code pre-filled.
      //    Clicking the card switches the observer away from Browse (unmounting the
      //    live-rooms feed), so afterwards we return to Browse to keep watching.
      await card.click();
      await expect(observer.getByTestId('home-panel-join')).toBeVisible();
      await expect(observer.locator('#code')).toBeVisible();
      await expect(observer.locator('#code')).toHaveValue(inviteCode);
      await observer.getByRole('tab', { name: 'Browse Games' }).click();
      await expect(observer.getByTestId('home-panel-browse')).toBeVisible();
      // Re-subscribed feed should still show the public lobby (still in lobby).
      await expect(card).toBeVisible({ timeout: 5_000 });

      // 6. A second player joins the public lobby.
      await joinParty(p3, 'Carol', inviteCode);

      // 7. Host selects a game and launches; observer sees the public card disappear.
      await host.getByRole('button', { name: 'Scout' }).click();
      await host.getByRole('button', { name: 'Launch Game' }).click();
      await host.waitForURL(/\/game\/scout/);
      await expect(card).toBeHidden({ timeout: 10_000 });

      // 8. Host returns to lobby; observer sees the card reappear.
      //    Navigate to PartyView via the in-game Leave flow (client-side, no reload,
      //    so PartyView keeps the in-match state and does not auto-redirect back).
      await host.getByRole('button', { name: /leave/i }).click();
      await host.locator('.ui-dialog').getByRole('button', { name: 'Leave' }).click();
      await host.waitForURL(/\/party\/[A-Z0-9]+$/);
      await expect(host.getByRole('button', { name: 'End Game' })).toBeVisible({ timeout: 10_000 });
      await host.getByRole('button', { name: 'End Game' }).click();
      await expect(card).toBeVisible({ timeout: 15_000 });
    } finally {
      await hostCtx.close();
      await observerCtx.close();
      await p3Ctx.close();
    }
  });
});
