---
name: Secret Signals
description: Mobile-first word-association play on a dark teal table with cream cards.
colors:
  shell: '#102d35'
  panel: '#163943'
  paper: '#f2e8d5'
  ink: '#07171c'
  text: '#f4f7f6'
  muted: '#b9c9c8'
  gameplay-muted: '#c5d9dc'
  supporting-text: '#d5e3e5'
  border: '#36545a'
  gameplay-border: '#47717b'
  control-border: '#688084'
  stepper-border: '#658891'
  paper-hover: '#fff6e6'
  setup-hover: '#fff7e8'
  selected-edge: '#c9bca5'
  focus: '#fff'
  neutral-card: '#b9ac93'
  assassin-card: '#18181b'
  assassin-text: '#f8fafc'
  team-red: '#ef4444'
  team-blue: '#3b82f6'
  team-green: '#22c55e'
  team-orange: '#f97316'
  error-surface: '#512b2a'
  error-text: '#fff0eb'
  field-error: '#ffc2b8'
typography:
  card:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: 'clamp(0.75rem, 2.8vw, 1rem)'
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: '0.01em'
  clue:
    fontSize: 'clamp(1.2rem, 5vw, 1.8rem)'
    fontWeight: 800
  turn-heading:
    fontSize: 'clamp(1rem, 3.8vw, 1.4rem)'
    fontWeight: 800
    lineHeight: 1.2
  setup-choice:
    fontSize: '0.8rem'
    fontWeight: 700
    lineHeight: 1.3
  roster-name:
    fontSize: '0.875rem'
    fontWeight: 600
rounded:
  card: '0.4rem'
  dock: '0.6rem'
  field: '0.35rem'
  panel: '8px'
  setup-choice: '6px'
  screen: '12px'
spacing:
  control-gap: '8px'
components:
  word-card:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.card}'
    rounded: '{rounded.card}'
    padding: '0.5rem 0.2rem'
  setup-choice:
    backgroundColor: '{colors.panel}'
    textColor: '{colors.paper}'
    typography: '{typography.setup-choice}'
    rounded: '{rounded.setup-choice}'
    padding: '8px 12px'
  setup-choice-selected:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.shell}'
    rounded: '{rounded.setup-choice}'
  action-dock:
    backgroundColor: '{colors.panel}'
    rounded: '{rounded.dock}'
    padding: '0.85rem'
---

# Design System: Secret Signals

## Overview

**Creative North Star: "Dark teal table, cream word cards"**
Mobile-first, board-first team play: a dark teal table holds cream word cards, with saturated team colors reserved for known ownership and team identity. This records the user-pinned online/mobile word-association direction, not proprietary artwork, branding, or a new identity workshop.
Scope: this game's Vue root and children only; platform Leave/language controls retain platform styling. Frontmatter is normative extracted vocabulary, not a new CSS token API.
**Key Characteristics:**

- Compact scores and a prominent current clue.
- Separate marking, revealing, and ending a turn.
- Folded secondary information; the same palette in lobby and results.

## Colors

### Primary

Dark teal shell and panel frame play; cream paper carries hidden cards, clue numbers, fields, and primary actions. Paper hover differs between gameplay and setup/results; preserve that implemented distinction.

### Secondary

Four saturated team colors come exclusively from `core/src/constants.ts` (`TEAM_HEX_BY_COLOR`). They identify teams and authorized card ownership; local `lib/teamTheme.ts` uses dark ink on all four, not core's white text defaults.

### Neutral

Neutral cards use warm taupe; assassin cards use near-black with assassin-text. Light text supports the shell; muted text and teal borders separate supporting content. Errors use the extracted warm error surface/text or inline field-error.
**The Ownership Rule.** Ownership color appears on a card only for Directors, revealed cards, or the ended-game board; unknown Agent cards remain paper.

## Typography

The root uses the system UI stack in `typography.card`; descendants inherit it. There is no game-specific display font or imported font asset.
Cards are centered, uppercase and heavy; clue text is uppercase and larger. Turn headings are compact. Roster names use the extracted roster role; supporting labels generally use 0.75–0.8rem, with smaller role/marker badges (0.625–0.65rem).
Scores and number steppers use tabular numerals. Words and names wrap anywhere; preserve full content rather than ellipsis.

## Layout

Gameplay order: compact turn/scores → clue/role → 5×5 board → action dock → folded teams, log, and host controls. It is normal document flow, not a fixed bottom overlay.
Content caps at 60rem with 1rem side insets; board caps at 58rem, with `repeat(5, minmax(0, 1fr))` and `clamp(0.3rem, 1.2vw, 0.65rem)` gaps. Header caps independently at 76rem.
Cards have 4rem minimum height and 1.35 aspect ratio; at 700px they use 5.5rem and 1.7. Word text stays within its frontmatter clamp. Action buttons/summaries are at least 44px; start/restart are 48px and clue input is 46px.
At ≤380px gameplay/header insets become 0.6rem and dock padding 0.65rem. At 600px clue submit joins the word/stepper row; below it spans both columns.
Lobby/results cap at 760px, use 20px gaps and 24px desktop padding at 640px. Setup rosters become two columns at 480px; lobby player lists/results become two columns at 640px. Gameplay rosters auto-fit from 12rem. Bottom padding respects safe-area inset; game min-height subtracts the platform's 3.5rem header.

## Elevation & Depth

Tonal layering and fine borders do most work. Word cards use `0 2px 3px rgb(0 0 0 / 16%)`; clickable hover uses `0 4px 10px rgb(0 0 0 / 30%)`. Selected setup choices have an inset lower edge (`inset 0 -3px 0 #c9bca5`); selected team choices use a black 20% inset edge. Shared platform button styling remains inherited, not a new game-wide shadow token.

## Shapes

Small rounded rectangles distinguish cards, fields, choices and docks using the frontmatter radii. Panels use thin borders, cards a 2px ink-at-18% border, and team dots are circular. Revealed cards use dashed current-color borders plus a check; eliminated rosters/results use dashed borders, and eliminated score chips also strike through and fade.

## Components

**Word cards:** tapping marks/selects only. Multiple marks remain supported; the player-name chip and team-colored 3px outline communicate marks. Keyboard focus is a white 3px outline, overriding marker color. Disabled/revealed cards retain full opacity and cannot be selected.
**Privacy:** `server/src/managers/broadcastManager.ts:toRoomView` sends unrevealed types as null to non-Directors until game end. `CardCell.vue` independently gates styles and accessible ownership names. No visible written team-color labels belong on word cards; accessible names retain authorized type, revealed state, and marker names.
**Action dock:** Reveal Card requires the selected unrevealed card to have the player's acknowledged mark; it is separate from End Turn. Clear marks is a full-width text action. Pending state disables interactions; turn/phase changes clear local selection. Waiting viewers get a status message, not an actionable reveal control.
**Clue form:** cream uppercase word field, labeled number stepper, full-width submit on phones; errors are inline and number help stays visible. Fields/stepper buttons have white 2px focus outlines. Numeric controls are 44px; disabled stepper controls fade to 0.4.
**Setup:** bordered choices turn paper when selected; team choices instead use their team fill, dark ink and paper outline. Disabled roles/start fade to 0.45. Rosters show names/roles with team-colored headers; disconnected lobby players fade to 0.65. Start/replay remain explicit host actions.
**Scores/details/log/results:** active score borders use the team color and panel fill. Native details keep secondary information folded; log scrolls within 22rem with contained overscroll. Results reuse the paper winner panel, colored score badges and final ownership board. App action errors remain dismissible rather than silent.
**Motion:** cards transition background-color and box-shadow for 180ms ease-out; reduced-motion removes both transitions. No game-specific entrance choreography or card-flip animation is defined.

## Do's and Don'ts

### Do:

- **Do** preserve the five-column board, wrapping words and names instead of truncating them.
- **Do** keep authorized ownership in accessible card names without visible written color labels.
- **Do** retain native buttons, visible keyboard focus, status announcements, and reduced-motion handling.

### Don't:

- **Don't** reveal hidden card types through color, text, ARIA, or client-only concealment.
- **Don't** make a card tap reveal it or replace the separate Reveal Card / End Turn actions.
- **Don't** restyle the platform shell, import proprietary art, or substitute the shared core team palette.

Evidence: `ui-vue/src/App.vue`, `components/{CardCell,GameBoard,GamePlay,TurnIndicator,SignalInput,Lobby,TeamSetup,TeamRosterPanel,GameLog,GameOver}.vue`, `lib/teamTheme.ts`, core team constants, and actual mobile Agent/lobby and desktop Director captures. Extension-only panel data lives in `../.impeccable/design.json`; synthetic tonal ramps are intentionally omitted.
