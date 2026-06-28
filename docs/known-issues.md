# Known Issues

## Mobile Leave Button Z-Index

**Affected:** All games when played on mobile browsers (Chrome on Android)

**Problem:** The platform's "Leave Game" button rendered in `GameView.vue` can be obscured by game-specific UI elements (e.g., `TeamRosterPanel` in Secret Signals) after scrolling. The button uses `<Teleport to="body">` with `z-[100]` but game components with high `z-index` values (e.g., for dialogs, overlays) or certain stacking contexts may render above it.

**Status:** Under investigation. Potential fixes to explore:

- Ensure all game components avoid creating unexpected stacking contexts
- Move the leave button logic into a shared overlay component that all games inherit
- Use a higher z-index value on the leave button (e.g., `z-[1000]`)
- Investigate if game-specific UI components need `isolation: isolate` applied

**Workaround:** Scroll back to the top of the page after entering a game to reveal the leave button. On desktop, the button is reliably visible.

## Admin Kick During Active Matches

**Affected:** Admin Console party management, all integrated games

**Current behavior:** If an admin kicks a player while the party is in an active match, the platform ends and cleans up the active match, returns the remaining party members to the lobby, and then removes the kicked player from the party.

**Reason:** The current game server contract exposes `cleanupMatch(matchKey)` but does not expose a safe cross-game `removePlayerFromMatch(matchKey, playerId)` operation. Each game owns internal turn order, cards, scores, hidden state, host assignment, and reconnect behavior, so removing one player mid-match generically could leave game state inconsistent.

**Future improvement:** Consider adding an optional game module contract such as `removePlayerFromMatch(matchKey, playerId)` with a result indicating whether the match can continue. This would need per-game implementations and tests for Scout, Flip 7, Blackout, Imposter, and Secret Signals.

**Workaround:** Treat admin kick during an active match as "kick and end match". If the remaining players should continue, they can launch a new match from the lobby.
