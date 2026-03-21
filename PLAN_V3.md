# Game Platform Fusion Plan v3

## Summary

The target state is no longer a cautious workspace migration that preserves most per-game boundaries. The target state is a real monorepo for a single product: one shared platform with one shared lobby and party system, with the existing games integrated as internal modules.

The previous approach kept too much repository-level duplication alive across the games. That made the architecture harder to unify, increased maintenance cost, and preserved too many parallel runtime patterns. The purpose of this plan is to make the intended end state explicit:

- one repository
- one product
- one shared lobby and party lifecycle
- one central tooling and configuration layer at the repository root
- multiple internal games integrated into the platform
- no long-term duplication of package, TypeScript, lint, formatting, test, or build configuration per game unless it is truly game-specific

This is still a fusion into a lobby-based platform, not a stack rewrite. The existing stack remains in place.

## Non-Negotiable Constraint: Keep the Stack

The fusion must keep the current technology choices:

- Vue 3
- Pinia
- Vite
- Express
- Socket.IO
- TypeScript
- pnpm

This work is a repository and product consolidation, not a framework migration.

## Why v2 Is No Longer Strong Enough

The previous version of the plan was intentionally conservative. That conservatism is no longer useful enough.

The issues are:

- It treated per-game package and config boundaries as something to preserve for too long.
- It kept `standalone-web`, `standalone-server`, and game-local toolchains alive as first-class structures instead of treating them as legacy.
- It allowed the repository to continue carrying the same tooling definitions multiple times across the games.
- It described a workspace monorepo, but still left too much of the old multi-repo mental model in place.
- It made the platform integration harder because every game continued to behave like a mostly separate product.
- It did not push strongly enough toward the actual product goal: one platform that owns the shared lobby and launches games as internal modules.

That structure made sense as a low-risk bridge, but it is not the right target architecture.

## Target Architecture

We will build and stabilize a root-centered monorepo with one central platform app and game code living as internal source modules.

### Target Structure

```text
game-platform/
|-- package.json
|-- pnpm-workspace.yaml
|-- pnpm-lock.yaml
|-- tsconfig.base.json
|-- tsconfig.json
|-- eslint.config.mjs
|-- jest.config.ts
|-- playwright.config.ts
|-- .prettierrc
|-- .prettierignore
|-- .gitignore
|-- apps/
|   `-- platform/
|       |-- package.json
|       |-- vite.config.ts
|       |-- tsconfig.json
|       |-- tsconfig.server.json
|       |-- src/
|       |   |-- main.ts
|       |   |-- App.vue
|       |   |-- router/
|       |   |-- stores/
|       |   |-- views/
|       |   `-- games/
|       `-- server/
|           |-- index.ts
|           |-- party/
|           `-- registry/
`-- games/
    |-- blackout/
    |   |-- core/
    |   |-- server/
    |   `-- ui-vue/
    |-- imposter/
    |   |-- core/
    |   |-- server/
    |   `-- ui-vue/
    `-- secret-signals/
        |-- core/
        |-- server/
        `-- ui-vue/
```

### Core Principles

- `apps/platform` is the only production app.
- The root is the canonical place for shared tooling and repository-wide configuration.
- `games/blackout`, `games/imposter`, and `games/secret-signals` are internal modules, not fully independent products.
- The platform owns party creation, invite codes, host state, player identity, game launch, replay, match end, and return to lobby.
- Each game keeps its own gameplay rules, domain logic, socket handlers, and game-specific UI behavior.
- Game-specific runtime constraints remain local when they are truly specific to a game.
- The repository should no longer preserve duplicated toolchain structure across all games by default.

## Root Configuration Is The Intended End State

The intended end state is to centralize shared configuration at the repository root.

That includes:

- root `package.json` as the primary command surface
- root `pnpm-workspace.yaml`
- root lockfile
- root TypeScript base configuration and shared TypeScript entry configs
- root ESLint configuration
- root Prettier configuration
- root Jest configuration
- root Playwright configuration
- root repository ignore and CI-facing config where possible

This means the repository should stop treating the following as long-term per-game responsibilities:

- full per-game `package.json` command surfaces
- duplicated per-game `tsconfig.*` sets where those files only repeat shared structure
- duplicated per-game `eslint.config.*`
- duplicated per-game `jest.config.*`
- duplicated per-game `playwright.config.*`
- duplicated per-game formatting config
- duplicated per-game root-level operational metadata unless it is genuinely different

App-specific configuration may still exist where it is truly tied to `apps/platform` runtime behavior, such as `apps/platform/vite.config.ts` or platform server TypeScript settings. The goal is not to eliminate all non-root config files. The goal is to eliminate duplicated repository-level tooling definitions.

## Game Boundaries In v3

In the target state, the games should no longer behave like full workspace packages with their own independent toolchain boundary.

Instead:

- `games/*` are internal source modules
- the platform imports game code directly through internal aliases or explicit paths
- root scripts are the official way to run development, build, typecheck, lint, and tests
- game directories keep source, assets, and game-specific support code
- game directories do not remain mini-repositories in practice

If a tiny amount of game-local config remains, it must exist only because it is directly required by the game’s runtime or asset model, not because each game still carries its own generic build universe.

## Legacy Structure Must Be Broken Up Earlier

`standalone-web` and `standalone-server` should not remain part of the long-term architecture description.

In v3:

- they are legacy artifacts from the pre-fusion model
- they may exist briefly only as a migration bridge if needed for verification
- they are not described as part of the target structure
- they should be removed earlier than in v2 once the platform path is stable enough

Likewise, old patterns such as per-game root packages plus nested `ui-vue`, `standalone-web`, and `standalone-server` packages should be treated as transitional duplication, not protected architecture.

## Product Flow

### Party Flow

1. One player creates a party.
2. The platform generates an invite code.
3. Other players join the same party.
4. The host selects one of the integrated games.
5. The platform launches a match for the entire party.
6. All players enter the selected game together.
7. When the match ends, the party can either:
   - replay the same game
   - return to the shared party lobby
8. If a match is aborted, the full party returns to the shared lobby.
9. Players do not need to create a new lobby just to continue playing together.

### Important Consequence

The platform owns the full lifecycle before, during, and after each match. Games are launched inside that lifecycle rather than operating as parallel products.

## Integration Contracts

### Platform Server Contract

The platform server owns:

- `createParty`
- `joinParty`
- `resumeParty`
- `leaveParty`
- `selectGame`
- `launchGame`
- `replayGame`
- `returnToLobby`
- `ackReturnedToLobby`

`returnToLobby` and `replayGame` remain host-authoritative server actions.

### Game Module Contract

Each game integrates through a consistent module surface:

```ts
import type { Component } from 'vue';
import type { Server } from 'socket.io';

interface PlatformGameModule {
  definition: {
    id: string;
    name: string;
    minPlayers: number;
    maxPlayers: number;
  };
  registerServer: (io: Server, namespacePath: string) => void;
  loadClient: () => Promise<{ default: Component }>;
  cleanupMatch: (matchKey: string) => void;
}
```

### Platform Props For Game Roots

```ts
interface PlatformGameProps {
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  apiBaseUrl?: string;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
}
```

These contracts remain the boundary between platform orchestration and game-specific implementation.

## Implementation Order

1. Define the root-centered monorepo as the official target architecture in documentation and structure.
2. Consolidate shared tooling and config into the repository root.
3. Reduce game-local package and config duplication so that games behave as internal modules rather than near-independent apps.
4. Keep only the minimum app-specific config required for `apps/platform`.
5. Stabilize the platform server, party lifecycle, game registry, and adapter flow on top of that structure.
6. Remove `standalone-*` and other obsolete parallel-runtime artifacts earlier in the migration.
7. Clean up documentation, scripts, and repository conventions so they describe only the fused platform model.

## Test Plan

- Root install works as the canonical dependency installation path.
- Root commands are sufficient for development, build, lint, typecheck, unit tests, and e2e tests.
- No game requires a separate full toolchain setup to participate in the platform.
- The platform can launch all three games from the shared lobby.
- Replay and return-to-lobby work for all integrated games.
- Secret Signals, Imposter, and Blackout continue to preserve their gameplay behavior while running under platform orchestration.
- Blackout database assets and path resolution still work in development and build output.
- Documentation and repository layout no longer imply that the games are separate products.

## Acceptance Criteria

The plan is successful when:

- the repository clearly models one product instead of several adjacent products
- shared config is centralized at the root
- duplicated per-game tool configs are removed or reduced to truly game-specific fragments
- `apps/platform` is the only real application entrypoint
- the games integrate as internal modules into the shared party and lobby lifecycle
- legacy standalone structure is no longer treated as part of the intended architecture

## Assumptions

- Root-owned shared configuration is the desired end state.
- `games/*` should become internal source modules rather than long-term workspace packages.
- Early removal of `standalone-*` is preferred over preserving it until the very end.
- App-specific config for `apps/platform` may remain where it is structurally necessary.
- Game-specific runtime constraints remain local if centralizing them would be artificial or risky.
