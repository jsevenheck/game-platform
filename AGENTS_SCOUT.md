# Pi Session Prompt: Implement Scout Card Game

## Your Role
You are an expert game developer implementing the card game **Scout** (by Kei Kajino / Oink Games) into an existing multiplayer game platform. You have full access to the codebase and should follow the existing patterns religiously.

## Game Rules Summary

Scout is a trick-taking / ladder-climbing card game:

1. **Deck**: 45 cards. Each card has TWO numbers (one for playing tricks, one for scoring at end). Example: a card might show `4` (top-left, used as playValue) and `2` (bottom-right, used as scoutPoints).

2. **Setup**: Deal all cards equally. Each player has a private row of cards in fixed dealt order. Each player may ONCE choose to flip their entire row (reverses card order AND swaps playValue ↔ scoutPoints on each card individually). After this optional setup flip, card order is FIXED.

3. **Trick-Taking (Ladder-Climbing)**:
   - Leader selects a contiguous subsequence (1+ cards) from their row and plays it to the center.
   - Next player must either:
     a) **Play** a contiguous subsequence that "beats" the current play. Beating priority: higher total playValue sum → wins; if tied, MORE cards → wins; if still tied, highest single card playValue → wins.
     b) **Pass** (also called "Scout") — take one card from the face-up show pile OR from any played card on the table, and add it to either end of your own row.
   - Trick continues until all players but one have passed. The last player to play wins the trick, collects ALL cards played in that trick into their personal "taken" pile, and leads the next trick.

4. **End Game**: Game ends when any player empties their row OR supply is exhausted. Score by summing the scoutPoints (NOT playValue) of all cards in each player's taken pile. Highest total wins.

## Reference Implementation: Flip7

The most recently implemented game is **Flip7** at `games/flip7/`. Use it as your primary reference for structure, patterns, and integration. Key files:
- `games/flip7/core/src/types.ts` — Room, Player, RoundState, view types pattern
- `games/flip7/core/src/constants.ts` — game constants
- `games/flip7/core/src/events.ts` — Socket.IO event definitions
- `games/flip7/server/src/index.ts` — entry point with definition, register, cleanupMatch
- `games/flip7/server/src/socketHandlers.ts` — full socket handler implementation
- `games/flip7/server/src/models/room.ts` — room store with session mapping
- `games/flip7/server/src/models/player.ts` — player model
- `games/flip7/ui-vue/src/App.vue` — root component with socket lifecycle
- `games/flip7/ui-vue/src/PlatformAdapter.vue` — platform wrapper
- `games/flip7/ui-vue/src/stores/game.ts` — Pinia store

## Integration Guide

Read `docs/adding-a-new-game.md` in the repo root — it contains the FULL step-by-step integration checklist. Key registration points:

1. Create `games/scout/` directory structure matching other games
2. Implement `core/src/types.ts` with Room, Player, ScoutCard { playValue, scoutPoints, flipped: boolean }, TrickState, GamePhase
3. Implement `core/src/constants.ts`: MIN_PLAYERS=2, MAX_PLAYERS=5, card distribution for 45-card deck
4. Implement `core/src/events.ts`: autoJoinRoom, startGame, playCards, pass (scout), flipRow (setup only), requestState
5. Implement `core/src/deck.ts`: buildDeck() returning 45 ScoutCard objects with dual-value numbers
6. Implement `server/src/index.ts` with `definition`, `register(io, namespace)`, `cleanupMatch(matchKey)`
7. Implement `server/src/models/room.ts` — room store
8. Implement `server/src/models/player.ts` — player model
9. Implement `server/src/managers/trickManager.ts` — trick ladder-climbing logic
10. Implement `server/src/managers/broadcastManager.ts` — client-safe RoomView broadcasts
11. Implement `server/src/socketHandlers.ts` — all socket events with autoJoinRoom, startGame, playCards, pass, flipRow
12. Implement `ui-vue/src/App.vue` — root with socket, lobby, setup flip, game table, game over
13. Implement `ui-vue/src/PlatformAdapter.vue` — wraps App.vue with replay/return overlay
14. Implement `ui-vue/src/composables/useSocket.ts`
15. Implement `ui-vue/src/stores/game.ts`
16. Create game components in `ui-vue/src/components/`
17. Register in `apps/platform/server/registry/index.ts`
18. Register in `apps/platform/src/games/index.ts` with platformMeta (icon='🎯', gradFrom='#065f46', gradTo='#022c22', description='Outwit your friends in this ladder-climbing card trick game')
19. Add alias in `apps/platform/vite.config.ts`
20. Add `@shared` branch in `sharedAliasPlugin()`
21. Add `--color-scout` token in `apps/platform/src/styles/main.css`
22. Add `COPY games/scout/package.json games/scout/` in `Dockerfile`
23. Add scout project in `vitest.projects.ts`

## Deck Implementation Detail

The deck has 45 cards. A common distribution for Scout cards:
- Card value pairs should ensure interesting gameplay. Use a distribution where each card has two numbers and the sum of all cards' scoutPoints equals some balanced total.
- Suggested: cards numbered 1-10 with the following count: 1x1, 2x2, 3x3, ..., up to some variation that totals 45 cards. Each card has two numbers on it — one is the `playValue` and one is the `scoutPoints`.
- When a player flips a card, swap the two values. When a player flips their entire row, reverse the row order AND swap both values on each card.

Example card: `{ id: 's01', playValue: 5, scoutPoints: 2, flipped: false }`
After flip: `{ id: 's01', playValue: 2, scoutPoints: 5, flipped: true }`

## Server Logging Rules
- Use `createComponentLogger` and `createSocketLogger` from `apps/platform/server/logging/`
- NEVER log `resumeToken`, `joinToken`, `inviteCode`, or hidden card values
- Log lifecycle events: room create, join/resume, host transfer, game start, trick play, game end, cleanup

## Metrics Rules
- Use `startSocketHandlerInstrumentation` for callback events
- Use `recordNamespaceConnection` and `recordNamespaceDisconnect`
- NEVER use `matchKey`, `playerId`, `playerName`, inviteCode as metric labels

## Design System
- Use the platform's Tailwind design tokens (`bg-canvas`, `text-foreground`, etc.)
- Add `--color-scout: #14b8a6` and `--color-scout-hover: #0d9488` in `main.css`
- Do NOT define custom CSS variables outside Vue `<style scoped>` blocks

## Testing Requirements
- Create `games/scout/__tests__/` with unit tests using Vitest
- Create `games/scout/e2e/game.spec.ts` with at least one Playwright E2E test
- Register in `vitest.projects.ts`

## IMPORTANT NOTES
- The game must be a **drop-in module** — it has no standalone server or build step
- The platform manages the full party lifecycle (create, join, launch, replay)
- Your game server exports `register(io, namespace)` and `cleanupMatch(matchKey)`
- The UI connects to the Socket.IO namespace automatically via `autoJoinRoom`
- Emit `phase-change` event with value `'ended'` when game over to trigger the platform overlay
- The `PlatformAdapter.vue` handles the replay/return-to-lobby overlay

## File to Reference for Full Rules
Also read `games/scout/SCOUT_SPEC.md` for the complete specification including scoring, UI components, and all integration points.
