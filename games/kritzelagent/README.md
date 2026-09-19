# Kritzelagent

Kritzelagent is a real-time multiplayer drawing-and-deduction game for the
Game Platform. Everyone contributes short strokes to one shared canvas, but
one player receives only the category and must infer the secret topic.

## Quick reference

- **Players:** 5–12
- **Default rounds:** 5
- **Socket namespace:** `/g/kritzelagent`
- **Phases:** `lobby → drawing → voting → agentGuess → reveal → drawing`; after the last round, `ended`
- **Drawing:** one bounded normalized stroke per turn, maximum 80 points
- **Scoring:** the agent earns 2 points for avoiding the vote or guessing the topic after being caught; artists earn 1 point each when a caught agent misses

The platform remains authoritative for party membership, host state, replay,
and return-to-party behavior. Kritzelagent does not expose a standalone game
runtime.

## Round flow

1. The server selects a topic from `server/data/topics.csv` and assigns one
   player as the Kritzelagent.
2. Artists receive category plus topic through a private assignment. The agent
   receives the category only.
3. Players draw in a deterministic server-side order. Accepted strokes are
   broadcast after validation.
4. After two turns per player, connected eligible players vote for a suspect.
5. If the agent leads the vote, only that player receives the topic guess form.
6. The server reveals the agent, topic, vote counts, outcome, and score delta.

Disconnected players do not block the current completion quorum. Their accepted
strokes remain visible, and a valid resume token restores the authorized slot
and private assignment. If a missing voter disconnects, voting resolves from
the remaining connected players; a caught agent who disconnects before guessing
is treated as having missed the topic.

## Development

Run from the repository root:

```bash
pnpm dev
pnpm test:kritzelagent
pnpm typecheck
pnpm lint
pnpm build
```

The production build copies `server/data/topics.csv` into the compiled server
asset directory. Restart the server after changing the CSV.

## Topic data

The CSV must contain a `category,topic` header followed by non-empty rows.
Quoted CSV fields and comment/empty lines are supported. The loader skips
malformed rows and falls back to the built-in defaults if no valid row remains.

## Related documentation

- `docs/api.md` — Socket.IO payloads and privacy contract
- `docs/architecture.md` — state machine, ownership, and broadcast boundaries
- `../../docs/adding-a-new-game.md` — platform integration contract
