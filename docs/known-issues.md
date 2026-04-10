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
