# Flip 7

A real-time multiplayer push-your-luck card game built with Vue 3 + Socket.IO + TypeScript.

On your turn you draw (`hit`) or bank your score (`stay`). Draw a number you already hold this
round and you bust and score nothing; collect seven unique number cards and you trigger an
instant "Flip 7" that ends the round early with a bonus. Modifier and action cards add extra
swings — flat bonuses, a score-doubler, and action cards (freeze, flip-three, second-chance)
that target another active player. Rounds repeat until someone reaches the target score.

Flip 7 runs only through the platform party flow. The platform launches the match and the game
uses `autoJoinRoom` plus resume tokens for join and reconnect behavior.

## Quick reference

- **Min / max players:** 3 – 18
- **Rounds:** until a player reaches the target score (200, fixed)
- **Scoring:** sum of number cards (×2 if you drew the modifier) + flat modifiers + a 15-point Flip 7 bonus; busted players score 0 for the round
- **Socket namespace:** `/g/flip7`

## Development

Run from the workspace root:

```bash
pnpm dev        # start platform (server + client)
pnpm test       # run all unit tests
pnpm test:flip7 # run flip7 unit tests only
pnpm test:e2e   # run Playwright e2e tests (starts server automatically)
pnpm typecheck  # TypeScript check
pnpm lint       # ESLint
```

## Project Docs

- Architecture: `docs/architecture.md`
- Socket.IO API: `docs/api.md`
