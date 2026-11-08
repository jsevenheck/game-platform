# Secret Signals product context

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Secret Signals is the platform's real-time team word-association game. Directors
provide a word and number; Agents mark candidates and reveal cards on a shared
5×5 board. Server-side roles keep unrevealed ownership private from Agents.

## Capabilities and Constraints

Repository-confirmed: Vue 3/TypeScript, Socket.IO, German and English, 2–4 teams,
4–24 players, configurable assassin penalties, platform-controlled membership,
reconnect and replay. This redesign preserves those rules and contracts.

## Brand Commitments

User-requested: mobile-first UI/UX inspired by the original game's online/mobile
presentation. Do not repeat color names as visible text on word cards; preserve
accessible ownership names. Keep the Secret Signals identity and do not copy
Codenames artwork or branding.

## Operating Context

The requested target is phone-browser play. The board and the current turn's
next action take priority over rosters and history.

## Interaction

User-confirmed: tap a word to mark/select it, then use a separate explicit reveal
button. Multiple team marks remain supported.

## Evidence on Hand

- Existing UI and multiplayer tests under `ui-vue/` and `e2e/`.
- Official reference: <https://www.codenamesgame.com/mobile-app>, including its
  landscape in-game screenshot (5×5 board, compact scores and prominent clue).
- Official web reference: <https://www.codenamesgame.com/play-online>.
  Direct access to `codenames.game` returned HTTP 403 during research; no claim
  of hands-on testing of the original online gameplay.
