# Imposter

A real-time multiplayer social deduction party game built with Vue 3 + Socket.IO + TypeScript.

Players take turns giving short clues about a secret word in a shared random order. One or more
players are **Infiltrators** who do not know the word and must bluff their way through. After all
clues are in, players discuss, vote for suspected Infiltrators, and caught Infiltrators get one
last chance to guess the secret word and steal the round.

## Development

Run from the workspace root:

```bash
pnpm dev        # start platform (server + client)
pnpm test       # run all unit tests
pnpm test:e2e   # run Playwright e2e tests (starts server automatically)
pnpm typecheck  # TypeScript check
pnpm lint       # ESLint
```

## Project Docs

- Architecture: `docs/architecture.md`
- Socket.IO API: `docs/api.md`
