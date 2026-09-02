# Games

The platform currently ships eight drop-in party games. Every game follows the same
architecture: shared `core/` types, Socket.IO server module, Vue `ui-vue/` client, and a
`PlatformAdapter.vue` that wraps the game for the platform party flow.

| Game           | Players | Round count       | Core mechanic                                     |
| -------------- | ------- | ----------------- | ------------------------------------------------- |
| Blackout       | 4–10    | 1 (one big round) | Cooperative dice-grid memory reveal               |
| Imposter       | 3–10    | until reveal      | Social deduction: secret word + clues + vote      |
| Secret Signals | 4–8     | 3–6               | Cooperative code-breaking with asymmetric roles   |
| Flip 7         | 2–8     | until first bust  | Press-your-luck card-collection with busts        |
| Scout          | 2–5     | = player count    | Trick-taking with scout / flip actions            |
| Estimate       | 2–12    | 5 (default)       | Number-estimation party game; closest guess wins  |
| Kritzelagent   | 5–12    | 5 (default)       | Shared drawing, hidden topic, and agent deduction |
| Herd Mentality | 4–20    | 8 (default)       | Secret majority answers, cows, and Pink Cow       |

## Per-game documentation

- Blackout: `games/blackout/README.md`, `games/blackout/docs/api.md`, `games/blackout/docs/architecture.md`
- Imposter: `games/imposter/README.md`, `games/imposter/docs/api.md`, `games/imposter/docs/architecture.md`
- Secret Signals: `games/secret-signals/README.md`, `games/secret-signals/docs/api.md`, `games/secret-signals/docs/architecture.md`
- Flip 7: `games/flip7/README.md`, `games/flip7/docs/api.md`, `games/flip7/docs/architecture.md`
- Scout: `games/scout/README.md`, `games/scout/docs/api.md`, `games/scout/docs/architecture.md`
- Estimate: `games/estimate/README.md`, `games/estimate/docs/api.md`, `games/estimate/docs/architecture.md`
- Kritzelagent: `games/kritzelagent/README.md`, `games/kritzelagent/docs/api.md`, `games/kritzelagent/docs/architecture.md`
- Herd Mentality: `games/herd-mentality/README.md`, `games/herd-mentality/docs/api.md`, `games/herd-mentality/docs/architecture.md`

## Adding a new game

See `docs/adding-a-new-game.md` for the complete drop-in-game playbook.
