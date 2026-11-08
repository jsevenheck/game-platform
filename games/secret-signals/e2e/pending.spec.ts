import { test, expect, type Browser, type Page } from '@playwright/test';
import type { RoomView } from '../core/src/types';

declare global {
  interface Window {
    signalsFault: {
      holdAcks: string[];
      holdSend: string | null;
      heldAcks: number;
      heldSends: number;
      sent: Record<string, number>;
      room: RoomView | null;
      releaseAcks: () => void;
      releaseSends: () => void;
      disconnect: () => void;
    };
  }
}

// Hold actual WebSocket packets, never synthesize successful ACKs or room states.
function installFaults() {
  const send = WebSocket.prototype.send;
  const descriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage')!;
  const ackIds = new Set<string>();
  const acks: Array<() => void> = [];
  const sends: Array<() => void> = [];
  const fault = (window.signalsFault = {
    holdAcks: [] as string[],
    holdSend: null as string | null,
    heldAcks: 0,
    heldSends: 0,
    sent: {} as Record<string, number>,
    room: null as RoomView | null,
    releaseAcks: () => {
      for (const release of acks.splice(0)) release();
    },
    releaseSends: () => {
      fault.holdSend = null;
      for (const release of sends.splice(0)) release();
    },
    disconnect: () => {},
  });
  WebSocket.prototype.send = function (data) {
    const match = typeof data === 'string' && data.match(/^42\/g\/secret-signals,(\d+)(\[.*)$/s);
    if (match) {
      fault.disconnect = () => this.close();
      const event: string = JSON.parse(match[2])[0];
      fault.sent[event] = (fault.sent[event] ?? 0) + 1;
      if (fault.holdAcks.includes(event)) ackIds.add(match[1]);
      if (fault.holdSend === event) {
        fault.heldSends++;
        sends.push(() => send.call(this, data));
        return;
      }
    }
    send.call(this, data);
  };
  Object.defineProperty(WebSocket.prototype, 'onmessage', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get() {
      return descriptor.get!.call(this);
    },
    set(listener) {
      descriptor.set!.call(
        this,
        typeof listener !== 'function'
          ? listener
          : function (this: WebSocket, event: MessageEvent) {
              if (typeof event.data === 'string') {
                const state = event.data.match(/^42\/g\/secret-signals,(\[.*)$/s);
                if (state) {
                  const packet = JSON.parse(state[1]);
                  if (packet[0] === 'roomState') fault.room = packet[1];
                }
                const ack = event.data.match(/^43\/g\/secret-signals,(\d+)\[/);
                if (ack && ackIds.delete(ack[1])) {
                  fault.heldAcks++;
                  acks.push(() => listener.call(this, event));
                  return;
                }
              }
              listener.call(this, event);
            }
      );
    },
  });
}

async function lobby(browser: Browser) {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  await Promise.all(contexts.map((c) => c.addInitScript(installFaults)));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  await pages[0]!.goto('/?tab=host');
  await pages[0]!.getByLabel('Your Name').fill('Director');
  await pages[0]!.getByRole('button', { name: 'Create Party', exact: true }).click();
  await pages[0]!.waitForURL(/\/party\/[A-Z0-9]+/);
  const code = pages[0]!.url().split('/party/')[1]!.split('/')[0]!;
  for (let i = 1; i < pages.length; i++) {
    await pages[i]!.goto('/?tab=join');
    await pages[i]!.getByLabel('Your Name').fill(`Player ${i}`);
    await pages[i]!.getByLabel('Invite Code').fill(code);
    await pages[i]!.getByRole('button', { name: 'Join Party', exact: true }).click();
    await pages[i]!.waitForURL(/\/party\/[A-Z0-9]+/);
  }
  await pages[0]!.getByRole('button', { name: 'Secret Signals' }).click();
  await pages[0]!.getByRole('button', { name: 'Launch Game' }).click();
  await Promise.all(pages.map((p) => p.waitForURL(/\/game\/secret-signals/)));
  await Promise.all(pages.map((p) => expect(p.locator('.lobby')).toBeVisible()));
  return { pages, close: () => Promise.all(contexts.map((c) => c.close())) };
}
async function seat(page: Page, team: string, role: string) {
  await page.locator(`[data-self-team="${team}"]`).click();
  await expect(page.locator(`[data-self-team="${team}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.locator(`[data-self-role="${role}"]`).click();
  await expect(page.locator(`[data-self-role="${role}"]`)).toHaveAttribute('aria-pressed', 'true');
}

test('lost/delayed real ACKs reconcile team → role and start → signal without a false timeout', async ({
  browser,
}) => {
  const s = await lobby(browser);
  const host = s.pages[0]!;
  try {
    await host.evaluate(() => {
      window.signalsFault.holdAcks = ['assignTeam', 'startGame', 'giveSignal'];
      window.signalsFault.holdSend = 'assignTeam';
    });
    const red = host.locator('[data-self-team="red"]');
    await red.focus();
    await host.keyboard.press('Enter');
    await expect(red).toBeFocused();
    await expect(red).toHaveAttribute('aria-disabled', 'true');
    await expect(host.getByRole('button', { name: '3', exact: true })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await host.keyboard.press('Enter');
    expect(await host.evaluate(() => window.signalsFault.sent.assignTeam)).toBe(1);
    await seat(s.pages[1]!, 'red', 'agent');
    await expect(red).toHaveAttribute('aria-disabled', 'true');
    await host.evaluate(() => window.signalsFault.releaseSends());
    await expect(red).toHaveAttribute('aria-pressed', 'true');
    await expect(red).toBeFocused();
    await host.locator('[data-self-role="director"]').click();
    await expect(host.locator('[data-self-role="director"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect.poll(() => host.evaluate(() => window.signalsFault.heldAcks)).toBe(1);
    await seat(s.pages[2]!, 'blue', 'director');
    await seat(s.pages[3]!, 'blue', 'agent');
    await host.getByRole('button', { name: 'Start Game', exact: true }).click();
    await host.getByLabel('Clue word', { exact: true }).fill(' alpha ');
    await host.getByRole('button', { name: 'Send Signal', exact: true }).click();
    await expect(s.pages[1]!.locator('.signal-clue strong')).toHaveText('ALPHA');
    await expect.poll(() => host.evaluate(() => window.signalsFault.heldAcks)).toBe(3);
    // Observe beyond the real eight-second deadline, with successful ACKs still withheld.
    await host.waitForTimeout(8200);
    await expect(host.locator('.signals-action-error')).toHaveCount(0);
    await expect(host.locator('.signals-app')).toHaveAttribute('aria-busy', 'false');
    await host.evaluate(() => window.signalsFault.releaseAcks());
    await expect(host.locator('.signals-action-error')).toHaveCount(0);
  } finally {
    await s.close();
  }
});

test('keyboard mark retains focus while pending; unrelated state and late ACK cannot release newer ownership; resume remains playable', async ({
  browser,
}) => {
  const s = await lobby(browser);
  const [host, agent, blueDirector, blueAgent] = s.pages as [Page, Page, Page, Page];
  try {
    await seat(host, 'red', 'director');
    await seat(agent, 'red', 'agent');
    await seat(blueDirector, 'blue', 'director');
    await seat(blueAgent, 'blue', 'agent');
    await host.getByRole('button', { name: 'Start Game', exact: true }).click();
    // Rejected board-word clues keep the draft and permit correction.
    const boardWord = await host.locator('[data-card-index="0"] .card-word').innerText();
    await host.getByLabel('Clue word', { exact: true }).fill(boardWord);
    await host.getByRole('button', { name: 'Send Signal', exact: true }).click();
    await expect(host.locator('.signals-action-error')).toBeVisible();
    await expect(host.getByLabel('Clue word', { exact: true })).toHaveValue(boardWord);
    await host.getByLabel('Clue word', { exact: true }).fill('ALPHA');
    await host.getByRole('button', { name: 'Send Signal', exact: true }).click();
    const card = agent.locator('[data-card-index="0"]');
    await expect(card).toBeEnabled();
    await agent.evaluate(() => {
      window.signalsFault.holdSend = 'focusCard';
      window.signalsFault.holdAcks = ['focusCard'];
    });
    await card.focus();
    await agent.keyboard.press('Enter');
    await expect(card).toBeFocused();
    await expect(card).toHaveAttribute('aria-disabled', 'true');
    await expect(agent.getByRole('button', { name: 'Reveal Card', exact: true })).toBeDisabled();
    await agent.keyboard.press('Enter');
    expect(await agent.evaluate(() => window.signalsFault.sent.focusCard)).toBe(1);
    // A real reconnect of another player broadcasts a presence update, not our mark.
    await blueAgent.reload();
    await expect(blueAgent.locator('.signals-game')).toBeVisible();
    await expect(card).toHaveAttribute('aria-disabled', 'true');
    await expect(card).toBeFocused();
    await agent.evaluate(() => window.signalsFault.releaseSends());
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toHaveAttribute('aria-disabled', 'false');
    await expect(card).toBeFocused();
    await agent.keyboard.press('Tab');
    await expect(agent.locator('[data-card-index="1"]')).toBeFocused();
    const view = await agent.evaluate(() => window.signalsFault.room!);
    expect(view.board.every((c) => c.type === null)).toBe(true);
    expect(view.players.every((p) => !('resumeToken' in p) && !('socketId' in p))).toBe(true);
    // Start a second real mark while releasing the first action's delayed ACK.
    await agent.evaluate(() => {
      window.signalsFault.holdSend = 'focusCard';
    });
    await agent.keyboard.press('Enter');
    await expect(agent.locator('.signals-app')).toHaveAttribute('aria-busy', 'true');
    await agent.evaluate(() => window.signalsFault.releaseAcks());
    await expect(agent.locator('.signals-app')).toHaveAttribute('aria-busy', 'true');
    await agent.evaluate(() => window.signalsFault.disconnect());
    await expect
      .poll(() => agent.evaluate(() => window.signalsFault.sent.resumePlayer ?? 0), {
        timeout: 15000,
      })
      .toBeGreaterThan(0);
    await expect(agent.locator('.signals-app')).toHaveAttribute('aria-busy', 'false');
    await agent.evaluate(() => {
      window.signalsFault.holdSend = null;
      window.signalsFault.holdAcks = [];
    });
    await agent.locator('[data-card-index="0"]').click();
    await expect(agent.getByRole('button', { name: 'Reveal Card', exact: true })).toBeEnabled();
    await agent.getByRole('button', { name: 'Reveal Card', exact: true }).click();
    await expect(agent.locator('[data-card-index="0"]')).toHaveClass(/revealed/);
    const after = await agent.evaluate(() => window.signalsFault.room!);
    if (after.phase !== 'ended')
      expect(after.board.filter((c) => !c.revealed).every((c) => c.type === null)).toBe(true);
  } finally {
    await s.close();
  }
});
