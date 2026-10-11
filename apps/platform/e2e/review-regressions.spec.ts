import { expect, test, type Page } from '@playwright/test';

async function createParty(page: Page, name: string): Promise<string> {
  await page.goto('/?tab=host');
  await page.getByRole('textbox', { name: 'Your Name' }).fill(name);
  await page.getByRole('button', { name: 'Create Party', exact: true }).click();
  await expect(page).toHaveURL(/\/party\/[A-Z0-9]{6}$/);
  return page.url().split('/party/')[1]!;
}

async function joinParty(page: Page, code: string): Promise<void> {
  await page.goto('/?tab=join');
  await page.getByRole('textbox', { name: 'Your Name' }).fill('Guest');
  await page.getByRole('textbox', { name: 'Invite Code' }).fill(code);
  await page.getByRole('button', { name: 'Join Party', exact: true }).click();
  await expect(page).toHaveURL(/\/party\/[A-Z0-9]{6}$/);
}

declare global {
  interface Window {
    reviewPartyFrames: { upgraded: boolean; dropped: number };
  }
}

async function interceptPartyFrames(page: Page) {
  let blockedEvent = '';
  let droppedPolling = 0;
  // Keep the real Engine.IO upgrade untouched. A WebSocket routing proxy
  // adds an extra upgrade race under parallel load, unrelated to the fault
  // being tested. Only the selected application frame/ack is suppressed.
  await page.addInitScript(() => {
    const stats = { upgraded: false, dropped: 0 };
    window.reviewPartyFrames = stats;
    const originalSend = WebSocket.prototype.send;
    const ackIds = new WeakMap<WebSocket, Set<string>>();
    const NativeWebSocket = WebSocket;
    window.WebSocket = new Proxy(NativeWebSocket, {
      construct(target, args) {
        const socket = Reflect.construct(target, args) as WebSocket;
        ackIds.set(socket, new Set<string>());
        // Install before Engine.IO's onmessage handler, so a matching ACK
        // can be suppressed without intercepting handshake/upgrade traffic.
        socket.addEventListener('message', (event) => {
          if (
            typeof event.data === 'string' &&
            [...ackIds.get(socket)!].some((ack) => event.data.startsWith(`43/party,${ack}[`))
          ) {
            stats.dropped++;
            event.stopImmediatePropagation();
          }
        });
        return socket;
      },
    });
    WebSocket.prototype.send = function (data) {
      if (data === '5') stats.upgraded = true;
      if (typeof data === 'string') {
        const blocked = sessionStorage.getItem('review.blockedEvent');
        if (blocked && data.includes(`"${blocked}"`)) {
          stats.dropped++;
          return;
        }
        const droppedAck = sessionStorage.getItem('review.droppedAck');
        if (droppedAck && data.includes(`"${droppedAck}"`)) {
          const id = /^42\/party,(\d+)/.exec(data)?.[1];
          if (id) ackIds.get(this)?.add(id);
        }
      }
      return originalSend.call(this, data);
    };
  });
  await page.route(/\/socket\.io\/.*transport=polling/, async (route) => {
    if (blockedEvent && (route.request().postData() ?? '').includes(`"${blockedEvent}"`)) {
      droppedPolling++;
      await route.fulfill({ status: 200, body: 'ok', contentType: 'text/plain' });
    } else {
      await route.continue();
    }
  });
  return {
    block: async (event: string) => {
      blockedEvent = event;
      await page.evaluate((value) => sessionStorage.setItem('review.blockedEvent', value), event);
    },
    dropAck: async (event: string) => {
      await page.evaluate((value) => sessionStorage.setItem('review.droppedAck', value), event);
    },
    waitForUpgrade: () => page.waitForFunction(() => window.reviewPartyFrames.upgraded),
    dropped: async () =>
      droppedPolling + (await page.evaluate(() => window.reviewPartyFrames.dropped)),
  };
}

test('storage write/removal failures do not strand creation or leave', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const originalSet = Storage.prototype.setItem;
    const originalRemove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'platform.party.session') throw new DOMException('Denied', 'QuotaExceededError');
      return originalSet.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (key === 'platform.party.session') throw new DOMException('Denied', 'SecurityError');
      return originalRemove.call(this, key);
    };
  });
  await createParty(page, 'StorageHost');
  await expect(page.getByRole('heading', { name: 'Players (1)' })).toBeVisible();
  await expect(page.getByTestId('session-storage-warning')).toContainText('reloading may lose');
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('session-storage-warning')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Host a Party' }).click();
  await expect(page.getByRole('button', { name: 'Create Party', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('game choice exposes mutually exclusive pressed state to assistive technology', async ({
  page,
}) => {
  await createParty(page, 'SelectionHost');
  const scout = page.getByRole('button', { name: /Scout 2/ });
  const estimate = page.getByRole('button', { name: /Estimate 2/ });
  await expect(scout).toHaveAttribute('aria-pressed', 'false');
  await scout.click();
  await expect(scout).toHaveAttribute('aria-pressed', 'true');
  await estimate.focus();
  await page.keyboard.press('Enter');
  await expect(estimate).toHaveAttribute('aria-pressed', 'true');
  await expect(scout).toHaveAttribute('aria-pressed', 'false');
});

test('missing public-toggle acknowledgement unlocks the control and restores authoritative state', async ({
  page,
}) => {
  const frames = await interceptPartyFrames(page);
  await createParty(page, 'ToggleHost');
  await frames.waitForUpgrade();
  await frames.block('setPartyPublic');
  const toggle = page.getByTestId('party-public-toggle');
  await toggle.check();
  await expect(toggle).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('The server did not respond', {
    timeout: 15_000,
  });
  await expect(toggle).toBeEnabled();
  await expect(toggle).not.toBeChecked();
  expect(await frames.dropped()).toBe(1);
  await frames.block('');
  await toggle.check();
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeChecked();
});

test('a lost acknowledgement keeps a public toggle aligned with the already-applied server update', async ({
  page,
}) => {
  const frames = await interceptPartyFrames(page);
  await createParty(page, 'AppliedToggle');
  await frames.waitForUpgrade();
  await frames.dropAck('setPartyPublic');
  const toggle = page.getByTestId('party-public-toggle');
  await toggle.check();
  await expect(toggle).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('The server did not respond', {
    timeout: 15_000,
  });
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeChecked();
  expect(await frames.dropped()).toBe(1);
});

test('missing launch acknowledgement clears pending state without automatically retrying', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const frames = await interceptPartyFrames(host);
    const code = await createParty(host, 'LaunchHost');
    await joinParty(guest, code);
    await frames.waitForUpgrade();
    await host.getByRole('button', { name: /Scout 2/ }).click();
    await expect(host.getByRole('button', { name: /Scout 2/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await frames.block('launchGame');
    await host.getByRole('button', { name: 'Launch Game', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Launching…', exact: true })).toBeDisabled();
    await expect(host.getByRole('alert')).toContainText('The server did not respond', {
      timeout: 15_000,
    });
    await expect(host.getByRole('button', { name: 'Launch Game', exact: true })).toBeEnabled();
    expect(await frames.dropped()).toBe(1);
    await frames.block('');
    await host.getByRole('button', { name: 'Launch Game', exact: true }).click();
    await expect(host).toHaveURL(/\/game\/scout$/);
    await expect(guest).toHaveURL(/\/game\/scout$/);
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()]);
  }
});

test('initial game resume times out visibly and can recover after a reload', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const frames = await interceptPartyFrames(host);
    const code = await createParty(host, 'ResumeHost');
    await joinParty(guest, code);
    await host.getByRole('button', { name: /Scout 2/ }).click();
    await host.getByRole('button', { name: 'Launch Game', exact: true }).click();
    await expect(host).toHaveURL(/\/game\/scout$/);
    await frames.block('resumeParty');
    await host.reload();
    await expect(
      host.getByText('The server did not respond. Check your connection and try again.', {
        exact: true,
      })
    ).toBeVisible({ timeout: 15_000 });
    expect(await frames.dropped()).toBe(1);
    await frames.block('');
    await host.reload();
    await expect(host.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()]);
  }
});

test('opening the party URL during an active match restores identity before mounting the game', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const code = await createParty(host, 'LobbyResumeHost');
    await joinParty(guest, code);
    await host.getByRole('button', { name: /Scout 2/ }).click();
    await host.getByRole('button', { name: 'Launch Game', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();

    // A full navigation creates a fresh Pinia store, unlike leaving the game
    // through the SPA. The server broadcasts partyUpdate before its resume ACK.
    await host.goto(`/party/${code}`);
    await expect(host).toHaveURL(/\/game\/scout$/);
    await expect(host.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()]);
  }
});
