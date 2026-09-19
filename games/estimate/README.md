# Estimate

A real-time multiplayer estimation party game built with Vue 3 + Socket.IO + TypeScript.

Players see a question with a numeric answer ("In welchem Jahr fiel die Berliner Mauer?"),
submit a number as their guess, and once everyone has guessed, the host reveals the solution.
The player whose guess is **closest** to the actual answer (smallest absolute difference)
wins the round and gets +1 point. Ties are shared — every closest guesser gets +1.

The UI scales the guess-line automatically from the players' submitted values, so the host
never has to configure min/max per question. The game uses a CSV-based question library
that ships with the platform and is trivially extensible.

Estimate runs only through the platform party flow. The platform launches the match and the
game uses `autoJoinRoom` plus resume tokens for join and reconnect behaviour.

## Quick reference

- **Min / max players:** 2 – 12
- **Default rounds:** 5
- **Scoring:** +1 per round for the closest guesser; ties share the +1
- **Question source:** `games/estimate/server/data/questions.csv` (copied into the production server build)
- **Socket namespace:** `/g/estimate`

## Development

Run from the workspace root:

```bash
pnpm dev        # start platform (server + client)
pnpm test       # run all unit tests
pnpm test:estimate  # run estimate unit tests only
pnpm test:e2e   # run Playwright e2e tests (starts server automatically)
pnpm typecheck  # TypeScript check
pnpm lint       # ESLint
```

## Adding your own questions

Edit `games/estimate/server/data/questions.csv`:

```csv
question,answer
In welchem Jahr fiel die Berliner Mauer?,1989
Wie viele Planeten hat unser Sonnensystem?,8
```

The first line must be the header (`question,answer`). Comment lines start with `#`.
Empty lines are skipped. The answer can be any finite number within
`GUESS_VALUE_LIMIT` (1e9 by default).

The CSV is loaded once at server start (cached). Restart the server to pick up changes.

During `guessing`, clients receive only per-player `hasSubmitted` flags. Guess values and the
derived number-line range remain server-private until every connected player has submitted.

## Project Docs

- Architecture: `docs/architecture.md`
- Socket.IO API: `docs/api.md`
