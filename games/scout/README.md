# Scout

A real-time multiplayer trick-taking card game built with Vue 3 + Socket.IO + TypeScript.

Each player holds a hand of double-sided cards, face-up in a fixed row. On your turn you
either **show** a contiguous run from your hand (a set of equal cards, or a straight run of
consecutive values) to beat the table's current set, or **scout**: take one card from either
end of the table's current set into your own hand (optionally flipped) and, if you haven't
used your Scout & Show token yet, immediately play a set that includes it. A round ends when
someone empties their hand or every other player has scouted the table set; players score the
cards they've collected minus the cards still in their hand.

Scout runs only through the platform party flow. The platform launches the match and the game
uses `autoJoinRoom` plus resume tokens for join and reconnect behavior.

## Quick reference

- **Min / max players:** 2 – 5
- **Rounds:** one per player (a 4-player game plays 4 rounds), each player leading a round once
- **Scoring:** cards in your taken pile + unused Scout tokens, minus cards left in hand at round end
- **Socket namespace:** `/g/scout`

## Development

Run from the workspace root:

```bash
pnpm dev        # start platform (server + client)
pnpm test       # run all unit tests
pnpm test:scout # run scout unit tests only
pnpm test:e2e   # run Playwright e2e tests (starts server automatically)
pnpm typecheck  # TypeScript check
pnpm lint       # ESLint
```

## Project Docs

- Architecture: `docs/architecture.md`
- Socket.IO API: `docs/api.md`
