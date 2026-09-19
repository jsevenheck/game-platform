# Graph Report - game-platform  (2026-09-15)

## Corpus Check
- 358 files · ~141,305 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2903 nodes · 5985 edges · 167 communities (132 shown, 24 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6b9d0936`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- trickManager.ts
- flip7/server/src/managers/roundManager.ts
- estimate/server/src/socketHandlers.ts
- AdminView.vue
- scout/server/src/socketHandlers.ts
- server/index.ts
- secret-signals/core/src/constants.ts
- devDependencies
- devDependencies
- usePartySocket.ts
- admin.ts
- socketHandlerMetrics.ts
- gameAuth.ts
- estimate/server/src/models/room.ts
- partyHandlers.ts
- imposter/ui-vue/src/App.vue
- gameManager.ts
- herd-mentality/server/src/socketHandlers.ts
- logger.ts
- flip7/server/src/socketHandlers.ts
- imposter/server/src/handlers/socketHandlers.ts
- scout/e2e/game.spec.ts
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- dependencies
- TeamColor
- database.ts
- secret-signals/ui-vue/src/App.vue
- flip7/server/src/managers/broadcastManager.ts
- RoomView
- compilerOptions
- useHomeTabs.ts
- flip7/core/src/types.ts
- compilerOptions
- include
- vitest.projects.ts
- HomeTabBar.vue
- scout/ui-vue/src/components/GameTable.vue
- import-db-csv.mjs
- herd-mentality/server/src/models/room.ts
- registry/index.ts
- TeamSetup.vue
- imposter/e2e/game.spec.ts
- imposter/core/src/constants.ts
- HomeView.vue
- estimate/ui-vue/src/App.vue
- secret-signals/server/src/handlers/socketHandlers.ts
- PartyView.vue
- requestLogger.ts
- include
- GameView.vue
- copy-db-assets.mjs
- kritzelagent/core/src/types.ts
- scout/core/src/types.ts
- estimate/core/src/types.ts
- questionLibrary.ts
- compilerOptions
- blackout/package.json
- blackout/server/src/models/room.ts
- secret-signals/e2e/game.spec.ts
- flip7/package.json
- kritzelagent/server/src/models/room.ts
- herd-mentality/server/src/managers/roundManager.ts
- blackout/server/src/socketHandlers.ts
- imposter/server/src/managers/phaseManager.ts
- imposter/package.json
- scout/package.json
- secret-signals/package.json
- GameRound.vue
- blackout/server/src/managers/roundManager.ts
- estimate/e2e/game.spec.ts
- imposter/core/src/types.ts
- estimate/__tests__/socketHandlers.test.ts
- secret-signals/core/src/types.ts
- estimate/ui-vue/src/components/NumberLine.vue
- estimate/scripts/copy-assets.mjs
- dev-server.cjs
- party/types.ts
- flip7/ui-vue/src/components/GameTable.vue
- estimate/package.json
- GamePlay.vue
- env.ts
- blackout/ui-vue/src/App.vue
- router/index.ts
- games/index.ts
- promptLibrary.ts
- blackout/ui-vue/src/components/Lobby.vue
- herd-mentality/__tests__/socketHandlers.test.ts
- scout/server/src/managers/broadcastManager.ts
- imposter/ui-vue/src/vite-env.d.ts
- secret-signals/ui-vue/src/vite-env.d.ts
- herd-mentality/core/src/types.ts
- PublicLobbiesSection.vue
- kritzelagent/server/src/socketHandlers.ts
- herd-mentality/ui-vue/src/App.vue
- compilerOptions
- flip7/ui-vue/src/App.vue
- kritzelagent/server/src/managers/roundManager.ts
- estimate/ui-vue/env.d.ts
- flip7/ui-vue/env.d.ts
- scout/ui-vue/env.d.ts
- pinia
- pino-pretty
- vite.config.ts
- @playwright/test
- compilerOptions
- blackout/core/src/types.ts
- kritzelagent/ui-vue/src/App.vue
- kritzelagent/core/src/events.ts
- tsx
- @types/better-sqlite3
- scripts
- flip7/core/src/constants.ts
- typescript
- typescript-eslint
- topicLibrary.ts
- scout/ui-vue/src/App.vue
- vitest
- vue
- collectors.ts
- Database
- vue-tsc
- home-library.spec.ts
- VotingPhase.vue
- kritzelagent/__tests__/roundManager.test.ts
- wordLibrary.ts
- secret-signals/server/src/config/constants.ts
- RevealPhase.vue
- herd-mentality/ui-vue/src/PlatformAdapter.vue
- @types/express
- ScoutDialog.vue
- kritzelagent/e2e/game.spec.ts
- vite
- kritzelagent/ui-vue/src/PlatformAdapter.vue
- package.json
- Room
- herd-mentality/ui-vue/src/components/QuestionView.vue
- herd-mentality/e2e/game.spec.ts
- herd-mentality/package.json
- herd-mentality/scripts/copy-assets.mjs
- kritzelagent/scripts/copy-assets.mjs
- AgentGuessView.vue
- kritzelagent/package.json
- herd-mentality/ui-vue/env.d.ts
- kritzelagent/ui-vue/env.d.ts
- @types/cookie-parser
- estimate/ui-vue/src/PlatformAdapter.vue
- herd-mentality/ui-vue/src/composables/useSocket.ts
- estimate/ui-vue/src/components/QuestionView.vue
- estimate/ui-vue/src/components/RevealView.vue
- flip7/ui-vue/src/PlatformAdapter.vue
- JoinTabPanel.vue
- platform/env.d.ts

## God Nodes (most connected - your core abstractions)
1. `registerGame()` - 52 edges
2. `registerGame()` - 47 edges
3. `registerScout()` - 45 edges
4. `registerBlackout()` - 43 edges
5. `registerFlip7()` - 41 edges
6. `registerPartyHandlers()` - 36 edges
7. `registerKritzelagent()` - 34 edges
8. `registerGameHandlers()` - 32 edges
9. `registerGameHandlers()` - 32 edges
10. `createComponentLogger()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `setupParty()` --calls--> `createParty()`  [EXTRACTED]
  games/estimate/__tests__/socketHandlers.test.ts → apps/platform/server/party/partyStore.ts
- `setupParty()` --calls--> `createParty()`  [EXTRACTED]
  games/herd-mentality/__tests__/socketHandlers.test.ts → apps/platform/server/party/partyStore.ts
- `setupParty()` --calls--> `createParty()`  [EXTRACTED]
  games/kritzelagent/__tests__/socketHandlers.test.ts → apps/platform/server/party/partyStore.ts
- `setupParty()` --calls--> `createParty()`  [EXTRACTED]
  games/scout/__tests__/socketHandlers.test.ts → apps/platform/server/party/partyStore.ts
- `registerBlackout()` --calls--> `readLoggingConfig()`  [EXTRACTED]
  games/blackout/server/src/socketHandlers.ts → apps/platform/server/logging/logger.ts

## Import Cycles
- None detected.

## Communities (167 total, 24 thin omitted)

### Community 0 - "trickManager.ts"
Cohesion: 0.15
Nodes (32): buildDeck(), advanceTurn(), allOtherPlayersScouted(), beginFirstTrickIfReady(), buildE2EDeck(), buildPlayerCountDeck(), cardHasValue(), commitPlay() (+24 more)

### Community 1 - "flip7/server/src/managers/roundManager.ts"
Cohesion: 0.21
Nodes (19): draw(), advanceTurnOrFinalize(), applyNumberCard(), continueInitialDeal(), enqueueResolvedAction(), finalizeRound(), getActivePlayers(), getCurrentTurnPlayer() (+11 more)

### Community 2 - "estimate/server/src/socketHandlers.ts"
Cohesion: 0.17
Nodes (28): getPartyByActiveMatch(), allConnectedPlayersSubmitted(), isFiniteGuess(), submitGuess(), clearSocketIndex(), setSocketIndex(), findPlayer(), getRoomByCode() (+20 more)

### Community 3 - "AdminView.vue"
Cohesion: 0.05
Nodes (38): actionMessage, activeSection, AdminLog, AdminParty, AdminPartyMember, authenticated, autoRefresh, buildQueryParams() (+30 more)

### Community 4 - "scout/server/src/socketHandlers.ts"
Cohesion: 0.09
Nodes (50): flipPlayerRow(), keepPlayerRow(), playCards(), resetToLobby(), startGame(), createPlayer(), deleteSocketIndex(), deleteSocketIndexesForRoom() (+42 more)

### Community 5 - "server/index.ts"
Cohesion: 0.11
Nodes (19): rateLimitPruneInterval, registerHttpRoutes(), app, connPruneInterval, connRateLimit, CONTENT_SECURITY_POLICY, httpServer, io (+11 more)

### Community 6 - "secret-signals/core/src/constants.ts"
Cohesion: 0.07
Nodes (35): getMinimumPlayersForTeamCount(), GRID_SIZE, LEGACY_CARD_DISTRIBUTION, MIN_NEUTRAL_CARDS, MIN_SIGNAL_NUMBER, MIN_TEAM_PLAYERS, TEAM_COLORS, TEAM_DEFINITIONS (+27 more)

### Community 7 - "devDependencies"
Cohesion: 0.07
Nodes (29): eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-vue, devDependencies, concurrently, eslint (+21 more)

### Community 8 - "devDependencies"
Cohesion: 0.05
Nodes (39): dependencies, pinia, vue, vue-router, devDependencies, concurrently, socket.io-client, tsx (+31 more)

### Community 9 - "usePartySocket.ts"
Cohesion: 0.16
Nodes (10): JoinableListResponse, PartyClientToServerEvents, PartyServerToClientEvents, PartySocket, SetPartyPublicResponse, usePublicLobbies(), PartyView, JoinablePartyView (+2 more)

### Community 10 - "admin.ts"
Cohesion: 0.11
Nodes (37): AdminJwtPayload, adminLogger, AdminPartyMemberView, authenticateAdmin(), checkLoginRateLimit(), checkRateLimit(), chooseNextHost(), cleanupActiveMatch() (+29 more)

### Community 11 - "socketHandlerMetrics.ts"
Cohesion: 0.08
Nodes (34): parseBooleanEnv(), MetricsHttpConfig, metricsScrapeTotal, readBearerToken(), readMetricsAccessToken(), readMetricsHttpConfig(), registerMetricsRoutes(), MetricResult (+26 more)

### Community 12 - "gameAuth.ts"
Cohesion: 0.16
Nodes (16): assignHost(), authorizePartyJoin(), AuthorizePartyJoinFailure, AuthorizePartyJoinResult, clearHost(), createSocketIndex(), GameRoomLike, isConnectedPlayer() (+8 more)

### Community 13 - "estimate/server/src/models/room.ts"
Cohesion: 0.11
Nodes (21): ServerPlayer, clearSocketIndexesForRoom(), createPlayer(), getSocketIndex(), __resetSocketIndexForTests(), socketIndex, attachPlayerToRoom(), clearRoomCleanup() (+13 more)

### Community 14 - "partyHandlers.ts"
Cohesion: 0.08
Nodes (56): registerProcessLogging(), toLoggableError(), incrementPartyLifecycle(), broadcastParty(), broadcastPartyAndLobbies(), cleanupActiveMatchOnPartyExpire(), idleCleanupLogger, joinableListRateLimit (+48 more)

### Community 15 - "imposter/ui-vue/src/App.vue"
Cohesion: 0.09
Nodes (27): autoJoinInFlight, embeddedError, emit, emitAutoJoinRoom(), handleConfigureLobby(), handleEmbeddedConnect(), handleEndGame(), handleGuessWord() (+19 more)

### Community 16 - "gameManager.ts"
Cohesion: 0.14
Nodes (30): DEFAULT_TARGET_SCORE, addWordToLibrary(), advanceDescriptionTurn(), allDescriptionsSubmitted(), allVotesSubmitted(), finalizeRound(), getConnectedPlayerOrder(), getDescriptionOrder() (+22 more)

### Community 17 - "herd-mentality/server/src/socketHandlers.ts"
Cohesion: 0.18
Nodes (26): buildRoomView(), clearSocketIndex(), getSocketIndex(), setSocketIndex(), findPlayer(), getRoomByCode(), applyDisconnectLifecycle(), applyHostSync() (+18 more)

### Community 18 - "logger.ts"
Cohesion: 0.16
Nodes (18): appendLogEntry(), BufferedLogEntry, logBuffer, ALWAYS_REDACT_PATHS, buildLoggerOptions(), createLogBufferStream(), createRootLogger(), logger (+10 more)

### Community 19 - "flip7/server/src/socketHandlers.ts"
Cohesion: 0.08
Nodes (49): createComponentLogger(), readString(), ROOM_ENDED_CLEANUP_MS, ROOM_IDLE_TIMEOUT_MS, Room, cleanupMatch(), GameDefinition, gameLogger (+41 more)

### Community 20 - "imposter/server/src/handlers/socketHandlers.ts"
Cohesion: 0.09
Nodes (43): Player, DISCUSSION_DURATION_MS, clearDiscussionTimer(), clearGuessTimer(), clearRoomTimers(), discussionTimers, gameplayRateLimit, GameSocket (+35 more)

### Community 21 - "scout/e2e/game.spec.ts"
Cohesion: 0.16
Nodes (13): confirmSetupKeep(), createParty(), createTwoPlayerScoutSession(), hostStartsFromLobby(), joinParty(), launchScout(), playerRow(), playSelectedRowCards() (+5 more)

### Community 22 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 23 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 24 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 25 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 26 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 27 - "dependencies"
Cohesion: 0.10
Nodes (21): bcryptjs, better-sqlite3, cookie-parser, express, jsonwebtoken, nanoid, dependencies, bcryptjs (+13 more)

### Community 28 - "TeamColor"
Cohesion: 0.12
Nodes (23): BOARD_SIZE, getActiveTeamColors(), getCardDistribution(), MAX_TEAMS, Card, Room, TeamColor, TeamConfig (+15 more)

### Community 29 - "database.ts"
Cohesion: 0.18
Nodes (13): counts, db, dbLogger, finalCounts, hasColumn(), needsSchemaReset(), normalizeLetter(), parseCsv() (+5 more)

### Community 30 - "secret-signals/ui-vue/src/App.vue"
Cohesion: 0.10
Nodes (26): autoJoinInFlight, embeddedError, emit, emitAutoJoinRoom(), handleAssignRole(), handleAssignTeam(), handleEndTurn(), handleFocusCard() (+18 more)

### Community 31 - "flip7/server/src/managers/broadcastManager.ts"
Cohesion: 0.16
Nodes (17): ActionResolvedEvent, AutoJoinRoomData, AutoJoinRoomResponse, ClientToServerEvents, ErrorResponse, ServerToClientEvents, RoomView, RoundView (+9 more)

### Community 32 - "RoomView"
Cohesion: 0.24
Nodes (9): ClientToServerEvents, ServerToClientEvents, RoomView, StoredSession, EstimateSocket, normalizeNamespace(), resolveSocketUrl(), useSocket() (+1 more)

### Community 33 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 34 - "useHomeTabs.ts"
Cohesion: 0.21
Nodes (13): HOME_TABS, HomeTab, HomeTabId, normalizeHomeTab(), readStoredTab(), resolveInitialHomeTab(), useHomeTabs(), setTab() (+5 more)

### Community 35 - "flip7/core/src/types.ts"
Cohesion: 0.11
Nodes (22): ActionCard, Card, DeferredAction, PendingAction, PendingActionView, Phase, Player, PlayerView (+14 more)

### Community 36 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution, target (+16 more)

### Community 37 - "include"
Cohesion: 0.07
Nodes (27): compilerOptions, baseUrl, module, moduleResolution, outDir, paths, target, extends (+19 more)

### Community 38 - "vitest.projects.ts"
Cohesion: 0.16
Nodes (11): allProjects, blackoutProject, estimateProject, flip7Project, GAMES_ROOT, herdMentalityProject, imposterProject, kritzelagentProject (+3 more)

### Community 39 - "HomeTabBar.vue"
Cohesion: 0.33
Nodes (9): activate(), emit, focusedIndex, focusPanelFirstControl(), moveFocus(), onKeydown(), panelId(), props (+1 more)

### Community 40 - "scout/ui-vue/src/components/GameTable.vue"
Cohesion: 0.15
Nodes (9): cardClasses, props, currentPlay, currentTurnName, emit, handleScout(), room, scoutDialogOpen (+1 more)

### Community 41 - "import-db-csv.mjs"
Cohesion: 0.15
Nodes (7): args, dataRows, db, headers, raw, rows, schemaSql

### Community 42 - "herd-mentality/server/src/models/room.ts"
Cohesion: 0.11
Nodes (17): Phase, ServerPlayer, clearSocketIndexesForRoom(), __resetSocketIndexForTests(), socketIndex, cleanupTimers, clearRoomCleanup(), codeByPlayer (+9 more)

### Community 43 - "registry/index.ts"
Cohesion: 0.11
Nodes (20): blackoutModule, estimateModule, flip7Module, GameServerModule, herdMentalityModule, imposterModule, kritzelagentModule, scoutModule (+12 more)

### Community 44 - "TeamSetup.vue"
Cohesion: 0.17
Nodes (14): ASSASSIN_PENALTY_MODES, MIN_TEAMS, activeTeams, currentPlayer, currentPlayerTeam, emit, isDirectorUnavailable(), isSetupValid (+6 more)

### Community 45 - "imposter/e2e/game.spec.ts"
Cohesion: 0.31
Nodes (9): castVote(), createParty(), findCurrentTurnPage(), joinParty(), launchGame(), playFullRound(), setupThreePlayers(), submitDescription() (+1 more)

### Community 46 - "imposter/core/src/constants.ts"
Cohesion: 0.08
Nodes (31): DEFAULT_DISCUSSION_DURATION_MS, DEFAULT_INFILTRATOR_COUNT, DESCRIPTION_MAX_LENGTH, DISCUSSION_DURATION_STEP_MS, GUESS_TIMEOUT_MS, MAX_DISCUSSION_DURATION_MS, MAX_INFILTRATOR_COUNT, MAX_PLAYERS (+23 more)

### Community 47 - "HomeView.vue"
Cohesion: 0.12
Nodes (14): readStr(), useHomePartyActions(), writeStr(), usePartySocket(), PartyMatchView, PartyMemberView, PartyStatus, PersistedSession (+6 more)

### Community 48 - "estimate/ui-vue/src/App.vue"
Cohesion: 0.11
Nodes (28): ActionName, clearJoinTimer(), clearPendingAction(), connectionMessage, emit, failJoin(), focusKey, handleConnectError() (+20 more)

### Community 49 - "secret-signals/server/src/handlers/socketHandlers.ts"
Cohesion: 0.10
Nodes (41): DEFAULT_ASSASSIN_PENALTY_MODE, MIN_PLAYERS, addLogEntry(), gameplayRateLimit, GameSocket, reassignHost(), registerGame(), removePlayerFromRoom() (+33 more)

### Community 50 - "PartyView.vue"
Cohesion: 0.09
Nodes (14): getClientGame(), loadGameComponent(), selectedGameName, activeGameName, defaultGameConfig, error, gameInProgress, getGameConfig() (+6 more)

### Community 51 - "requestLogger.ts"
Cohesion: 0.42
Nodes (8): createRequestId(), createRequestLogger(), httpLogger, isStaticAssetRequest(), normalizeRequestPath(), requestLogger, resolveHttpLogLevel(), shouldIgnoreHttpRequest()

### Community 52 - "include"
Cohesion: 0.08
Nodes (25): apps/platform/e2e/**/*, apps/platform/server/**/*, apps/platform/src, games/*/core/src/**/*, games/*/e2e/**/*, games/*/server/src/**/*, games/*/__tests__/**/*, games/*/ui-vue (+17 more)

### Community 53 - "GameView.vue"
Cohesion: 0.12
Nodes (10): actionError, gameComponent, loadError, matchKey, namespace, props, router, showLeaveConfirm (+2 more)

### Community 54 - "copy-db-assets.mjs"
Cohesion: 0.22
Nodes (8): dbPath, __dirname, __filename, gameDir, legacySeedPath, sourceDir, targetDir, workspaceRoot

### Community 55 - "kritzelagent/core/src/types.ts"
Cohesion: 0.10
Nodes (25): MIN_PLAYERS, PlayerView, PrivateAssignment, ScoreEntry, ServerPlayer, StoredSession, StrokeView, VoteCount (+17 more)

### Community 56 - "scout/core/src/types.ts"
Cohesion: 0.09
Nodes (33): analyzePlay(), comparePlayAnalyses(), PlayAnalysis, PlayKind, ScoutCard, GamePhase, PlayedSet, PlayedSetView (+25 more)

### Community 57 - "estimate/core/src/types.ts"
Cohesion: 0.13
Nodes (23): computeDisplayRange(), DisplayRange, GuessEntry, Phase, PlayerView, ScoreEntry, ServerRoom, WinnerEntry (+15 more)

### Community 58 - "questionLibrary.ts"
Cohesion: 0.11
Nodes (26): DEFAULT_QUESTIONS, DEFAULT_TOTAL_ROUNDS, GUESS_VALUE_LIMIT, MAX_PLAYERS, MIN_DISPLAY_SPAN, MIN_PLAYERS, Question, cleanupMatch() (+18 more)

### Community 59 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, skipLibCheck, strict, target, ES2020

### Community 60 - "blackout/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 61 - "blackout/server/src/models/room.ts"
Cohesion: 0.13
Nodes (17): CLEANUP_INTERVAL_MS, DEFAULT_EXCLUDED_LETTERS, DEFAULT_LANGUAGE, DEFAULT_ROUNDS, ROOM_ENDED_CLEANUP_MS, ROOM_IDLE_TIMEOUT_MS, ROUND_END_DISPLAY_MS, ROUND_TIMER_MS (+9 more)

### Community 62 - "secret-signals/e2e/game.spec.ts"
Cohesion: 0.52
Nodes (6): chooseRole(), chooseTeam(), createParty(), joinParty(), launchGame(), setupFourPlayers()

### Community 63 - "flip7/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 64 - "kritzelagent/server/src/models/room.ts"
Cohesion: 0.12
Nodes (14): Phase, createPlayer(), __resetSocketIndexForTests(), attachPlayerToRoom(), codeByPlayer, codeBySession, createRoom(), CreateRoomOptions (+6 more)

### Community 65 - "herd-mentality/server/src/managers/roundManager.ts"
Cohesion: 0.30
Nodes (12): advanceRound(), allConnectedPlayersSubmitted(), HerdMentalityError, nextRound(), restartGame(), revealAnswers(), startGame(), submitAnswer() (+4 more)

### Community 66 - "blackout/server/src/socketHandlers.ts"
Cohesion: 0.12
Nodes (32): cleanupMatch(), GameDefinition, GameHandler, gameLogger, handler, register(), getRandomReader(), revealCategory() (+24 more)

### Community 67 - "imposter/server/src/managers/phaseManager.ts"
Cohesion: 0.33
Nodes (7): Room, resetForLobby(), resetForNewRound(), transitionToEnded(), transitionToLobby(), transitionToNextRound(), transitionToPlaying()

### Community 68 - "imposter/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 69 - "scout/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 70 - "secret-signals/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 71 - "GameRound.vue"
Cohesion: 0.10
Nodes (18): StoredSession, sortedPlayers, store, topScore, winners, canSkip, isCategoryReused, isReader (+10 more)

### Community 72 - "blackout/server/src/managers/roundManager.ts"
Cohesion: 0.16
Nodes (16): RoundResult, getAvailableLetters(), getUnusedPrompt(), randomItem(), transitionToEnded(), transitionToLobby(), transitionToPlaying(), transitionToRoundEnd() (+8 more)

### Community 73 - "estimate/e2e/game.spec.ts"
Cohesion: 0.22
Nodes (4): createParty(), createTwoPlayerEstimateSession(), EstimateSession, joinParty()

### Community 74 - "imposter/core/src/types.ts"
Cohesion: 0.08
Nodes (32): ClientToServerEvents, ServerToClientEvents, Phase, PlayerView, RoomView, RoundResult, StoredSession, broadcastRoom() (+24 more)

### Community 75 - "estimate/__tests__/socketHandlers.test.ts"
Cohesion: 0.19
Nodes (8): ROOM_IDLE_TIMEOUT_MS, __listRoomsForTests(), firstRoom(), makeIo(), makeNamespace(), setupParty(), setupServer(), TestSocket

### Community 76 - "secret-signals/core/src/types.ts"
Cohesion: 0.14
Nodes (20): ClientToServerEvents, ServerToClientEvents, AssassinPenaltyMode, FocusMarker, LogEntry, Player, PlayerRole, PlayerView (+12 more)

### Community 77 - "estimate/ui-vue/src/components/NumberLine.vue"
Cohesion: 0.14
Nodes (19): axisValues, chartHeight, container, containerWidth, lineY, MarkerPosition, maxLane, numberFormatter (+11 more)

### Community 78 - "estimate/scripts/copy-assets.mjs"
Cohesion: 0.33
Nodes (5): gameDir, scriptDir, sourceFile, targetDir, workspaceRoot

### Community 79 - "dev-server.cjs"
Cohesion: 0.29
Nodes (6): child, envFilePath, { existsSync }, nodeArgs, path, { spawn }

### Community 80 - "party/types.ts"
Cohesion: 0.18
Nodes (8): AdminPartyView, AuthorizePartyJoinSuccess, PartyMatch, PartyMember, PartySession, PartyStatus, setupParty(), TestSocket

### Community 81 - "flip7/ui-vue/src/components/GameTable.vue"
Cohesion: 0.06
Nodes (30): StoredSession, meta, props, sentence, accentClasses, cardSubtext, cardText, label (+22 more)

### Community 82 - "estimate/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 83 - "GamePlay.vue"
Cohesion: 0.14
Nodes (15): MAX_SIGNAL_NUMBER, confirmCard, confirmCardIndex, emit, handleCardPress(), handleConfirmReveal(), leftRosterTeams, rightRosterTeams (+7 more)

### Community 85 - "env.ts"
Cohesion: 0.70
Nodes (4): findNearestEnvFile(), loadLocalEnvFile(), parseEnvFile(), stripOptionalQuotes()

### Community 86 - "blackout/ui-vue/src/App.vue"
Cohesion: 0.08
Nodes (31): clearEmbeddedRetryTimer(), embeddedError, embeddedPlayerName(), emit, emitAutoJoinRoom(), error, handleEmbeddedConnect(), handleReroll() (+23 more)

### Community 88 - "games/index.ts"
Cohesion: 0.21
Nodes (9): emit, cards, CardView, emit, handleSelect(), props, clientGameRegistry, PlatformGameMeta (+1 more)

### Community 89 - "promptLibrary.ts"
Cohesion: 0.11
Nodes (24): DEFAULT_PROMPTS, DEFAULT_TOTAL_ROUNDS, MAX_PLAYERS, MIN_PLAYERS, ROOM_IDLE_TIMEOUT_MS, TARGET_COWS, Prompt, cleanupMatch() (+16 more)

### Community 91 - "blackout/ui-vue/src/components/Lobby.vue"
Cohesion: 0.22
Nodes (11): MAX_ROUNDS, MIN_PLAYERS, MIN_ROUNDS, Language, adjustRounds(), emit, excludedLettersInput, parseExcludedLetters() (+3 more)

### Community 93 - "herd-mentality/__tests__/socketHandlers.test.ts"
Cohesion: 0.22
Nodes (7): register(), __listRoomsForTests(), registerHerdMentality(), makeNamespace(), setupParty(), setupServer(), TestSocket

### Community 94 - "scout/server/src/managers/broadcastManager.ts"
Cohesion: 0.15
Nodes (19): AutoJoinRoomData, AutoJoinRoomResponse, BasicResponse, ClientToServerEvents, ErrorResponse, ScoutActionPayload, ServerToClientEvents, RoomView (+11 more)

### Community 97 - "herd-mentality/core/src/types.ts"
Cohesion: 0.12
Nodes (20): groupAnswers(), normalizeAnswer(), resolveRound(), AnswerEntry, AnswerGroup, PlayerView, RoomView, RoundResult (+12 more)

### Community 98 - "PublicLobbiesSection.vue"
Cohesion: 0.16
Nodes (10): emit, handleJoin(), props, currentInviteCode, emit, handleJoinRoom(), isLoading, isReady (+2 more)

### Community 99 - "kritzelagent/server/src/socketHandlers.ts"
Cohesion: 0.15
Nodes (31): normalizeJoinToken(), clearSocketIndex(), clearSocketIndexesForRoom(), getSocketIndex(), setSocketIndex(), socketIndex, clearRoomCleanup(), deleteRoomByCode() (+23 more)

### Community 101 - "herd-mentality/ui-vue/src/App.vue"
Cohesion: 0.14
Nodes (20): action(), emit, fail(), focusKey, joinAck, joinInFlight, joinRoom(), joinState (+12 more)

### Community 102 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 103 - "flip7/ui-vue/src/App.vue"
Cohesion: 0.15
Nodes (19): cardToDrawnCardInfo(), clearRetryTimer(), commitRoomUpdate(), detectDrawnCard(), displayName(), embeddedError, emit, emitAutoJoinRoom() (+11 more)

### Community 104 - "kritzelagent/server/src/managers/roundManager.ts"
Cohesion: 0.18
Nodes (22): RoundResult, advanceDrawingTurn(), allConnectedPlayersDrew(), allConnectedPlayersVoted(), connectedPlayers(), KritzelagentError, nextRound(), prepareTopicDeck() (+14 more)

### Community 112 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 113 - "blackout/core/src/types.ts"
Cohesion: 0.18
Nodes (17): ClientToServerEvents, ServerToClientEvents, Category, Phase, Player, PlayerView, RoomView, RoundData (+9 more)

### Community 114 - "kritzelagent/ui-vue/src/App.vue"
Cohesion: 0.16
Nodes (21): clearJoinTimer(), emit, failJoin(), focusKey, hasJoinAck, joinRoom(), joinState, nextRound() (+13 more)

### Community 116 - "kritzelagent/core/src/events.ts"
Cohesion: 0.13
Nodes (15): ActionResponse, ClientToServerEvents, JoinResponse, ServerToClientEvents, RoomView, StrokePoint, props, emit (+7 more)

### Community 119 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, dev, format, format:check, lint, lint:fix, start (+12 more)

### Community 120 - "flip7/core/src/constants.ts"
Cohesion: 0.12
Nodes (18): ACTION_CARD_COUNT, DECK_MAX_NUMBER, DEFAULT_TARGET_SCORE, FLIP7_BONUS, FLIP7_CARD_COUNT, MAX_PLAYERS, MIN_PLAYERS, MODIFIER_ADD_VALUES (+10 more)

### Community 123 - "topicLibrary.ts"
Cohesion: 0.09
Nodes (28): DEFAULT_TOPICS, DEFAULT_TOTAL_ROUNDS, DRAWING_TURNS_PER_PLAYER, MAX_COORDINATE, MAX_PLAYERS, MAX_STROKE_POINTS, ROOM_IDLE_TIMEOUT_MS, isPoint() (+20 more)

### Community 124 - "scout/ui-vue/src/App.vue"
Cohesion: 0.07
Nodes (31): MIN_PLAYERS, StoredSession, clearRetryTimer(), commitRoomUpdate(), displayName(), embeddedError, emit, emitAutoJoinRoom() (+23 more)

### Community 127 - "collectors.ts"
Cohesion: 0.14
Nodes (14): activeConnectionsGauge, initializeMetrics(), partiesActiveGauge, partyMembersConnectedGauge, publicLobbiesGauge, roomPlayersConnectedGauge, roomsActiveGauge, setActiveConnections() (+6 more)

### Community 128 - "Database"
Cohesion: 0.15
Nodes (4): better-sqlite3, Database, DatabaseConstructor, Statement

### Community 132 - "VotingPhase.vue"
Cohesion: 0.17
Nodes (11): emit, handleVote(), isDiscussion, isVoting, now, orderedPlayers, otherPlayers, selectedTarget (+3 more)

### Community 133 - "kritzelagent/__tests__/roundManager.test.ts"
Cohesion: 0.33
Nodes (10): ServerRoom, broadcastRoom(), buildRoomView(), KritzelagentNamespace, privateAssignmentFor(), sendPrivateAssignment(), currentDrawingPlayerId(), submitStroke() (+2 more)

### Community 134 - "wordLibrary.ts"
Cohesion: 0.22
Nodes (8): DEFAULT_WORD_LIBRARY, WORD_MAX_LENGTH, loadFromFile(), PERSIST_ENABLED, persistWord(), WORD_LIBRARY_MAX_SIZE, wordLogger, WORDS_FILE

### Community 136 - "secret-signals/server/src/config/constants.ts"
Cohesion: 0.20
Nodes (9): MAX_PLAYERS, IS_E2E, MAX_PLAYER_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS, PLAYER_ID, PORT, RESUME_TOKEN (+1 more)

### Community 137 - "RevealPhase.vue"
Cohesion: 0.24
Nodes (9): emit, getPlayerName(), guess, guessError, handleGuess(), isHost, result, store (+1 more)

### Community 138 - "herd-mentality/ui-vue/src/PlatformAdapter.vue"
Cohesion: 0.22
Nodes (6): dialog, gameEnded, gamePhase, Props, replayButton, showHostDialog

### Community 141 - "ScoutDialog.vue"
Cohesion: 0.07
Nodes (25): CARD_VALUES, DECK_SIZE, ROOM_ENDED_CLEANUP_MS, ROOM_IDLE_TIMEOUT_MS, flipCard(), canScout, currentCards, currentOwnerName (+17 more)

### Community 142 - "kritzelagent/e2e/game.spec.ts"
Cohesion: 0.31
Nodes (6): completeDrawing(), createParty(), createSession(), drawStroke(), joinParty(), Session

### Community 144 - "kritzelagent/ui-vue/src/PlatformAdapter.vue"
Cohesion: 0.22
Nodes (6): dialog, gameEnded, gamePhase, Props, replayButton, showHostDialog

### Community 145 - "package.json"
Cohesion: 0.25
Nodes (7): engines, node, pnpm, name, packageManager, private, version

### Community 147 - "Room"
Cohesion: 0.46
Nodes (5): Room, addPoint(), getLeaderboard(), getWinners(), resetScores()

### Community 148 - "herd-mentality/ui-vue/src/components/QuestionView.vue"
Cohesion: 0.33
Nodes (6): MAX_ANSWER_LENGTH, answer, emit, props, submit(), validationError

### Community 149 - "herd-mentality/e2e/game.spec.ts"
Cohesion: 0.38
Nodes (4): createParty(), joinParty(), openSession(), Session

### Community 150 - "herd-mentality/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 151 - "herd-mentality/scripts/copy-assets.mjs"
Cohesion: 0.33
Nodes (5): gameDir, scriptDir, sourceFile, targetDir, workspaceRoot

### Community 152 - "kritzelagent/scripts/copy-assets.mjs"
Cohesion: 0.33
Nodes (5): gameDir, scriptDir, sourceFile, targetDir, workspaceRoot

### Community 153 - "AgentGuessView.vue"
Cohesion: 0.40
Nodes (5): emit, error, props, submit(), value

### Community 154 - "kritzelagent/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 159 - "estimate/ui-vue/src/PlatformAdapter.vue"
Cohesion: 0.22
Nodes (6): dialog, gameEnded, gamePhase, Props, replayButton, showHostDialog

### Community 160 - "herd-mentality/ui-vue/src/composables/useSocket.ts"
Cohesion: 0.39
Nodes (6): ClientToServerEvents, ServerToClientEvents, HerdMentalitySocket, normalizeNamespace(), resolveSocketUrl(), useSocket()

### Community 161 - "estimate/ui-vue/src/components/QuestionView.vue"
Cohesion: 0.40
Nodes (5): emit, input, parseAndSubmit(), props, validationError

### Community 162 - "estimate/ui-vue/src/components/RevealView.vue"
Cohesion: 0.40
Nodes (4): emit, isLastRound, numberFormatter, props

### Community 177 - "JoinTabPanel.vue"
Cohesion: 0.38
Nodes (5): emit, onInput(), emit, onCodeInput(), onNameInput()

### Community 183 - "platform/env.d.ts"
Cohesion: 0.22
Nodes (8): @blackout-ui/PlatformAdapter.vue, @estimate-ui/PlatformAdapter.vue, @flip7-ui/PlatformAdapter.vue, @herd-mentality-ui/PlatformAdapter.vue, @imposter-ui/PlatformAdapter.vue, @kritzelagent-ui/PlatformAdapter.vue, @scout-ui/PlatformAdapter.vue, @secret-signals-ui/PlatformAdapter.vue

## Knowledge Gaps
- **1052 isolated node(s):** `HttpResponse`, `routerReplace`, `{ cleanupMatchMock }`, `Handler`, `expectedGames` (+1047 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1247 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createComponentLogger()` connect `flip7/server/src/socketHandlers.ts` to `blackout/server/src/socketHandlers.ts`, `kritzelagent/server/src/socketHandlers.ts`, `scout/server/src/socketHandlers.ts`, `server/index.ts`, `wordLibrary.ts`, `admin.ts`, `socketHandlerMetrics.ts`, `registry/index.ts`, `partyHandlers.ts`, `secret-signals/server/src/handlers/socketHandlers.ts`, `logger.ts`, `requestLogger.ts`, `imposter/server/src/handlers/socketHandlers.ts`, `promptLibrary.ts`, `questionLibrary.ts`, `topicLibrary.ts`, `database.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `readLoggingConfig()` connect `logger.ts` to `estimate/server/src/socketHandlers.ts`, `blackout/server/src/socketHandlers.ts`, `kritzelagent/server/src/socketHandlers.ts`, `scout/server/src/socketHandlers.ts`, `socketHandlerMetrics.ts`, `partyHandlers.ts`, `herd-mentality/server/src/socketHandlers.ts`, `secret-signals/server/src/handlers/socketHandlers.ts`, `flip7/server/src/socketHandlers.ts`, `imposter/server/src/handlers/socketHandlers.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `attachSocketEventDebugLogging()` connect `logger.ts` to `blackout/server/src/socketHandlers.ts`, `estimate/server/src/socketHandlers.ts`, `kritzelagent/server/src/socketHandlers.ts`, `scout/server/src/socketHandlers.ts`, `partyHandlers.ts`, `herd-mentality/server/src/socketHandlers.ts`, `secret-signals/server/src/handlers/socketHandlers.ts`, `flip7/server/src/socketHandlers.ts`, `imposter/server/src/handlers/socketHandlers.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `HttpResponse`, `routerReplace`, `{ cleanupMatchMock }` to the rest of the system?**
  _1052 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `trickManager.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1497326203208556 - nodes in this community are weakly interconnected._
- **Should `AdminView.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.05391120507399577 - nodes in this community are weakly interconnected._
- **Should `scout/server/src/socketHandlers.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08771929824561403 - nodes in this community are weakly interconnected._