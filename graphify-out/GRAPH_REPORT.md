# Graph Report - game-platform  (2026-08-03)

## Corpus Check
- 285 files · ~107,007 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2228 nodes · 4383 edges · 150 communities (109 shown, 41 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d57009df`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- trickManager.ts
- flip7/server/src/managers/roundManager.ts
- blackout/core/src/types.ts
- AdminView.vue
- scout/server/src/socketHandlers.ts
- server/index.ts
- partyStore.ts
- devDependencies
- devDependencies
- usePartySocket.ts
- admin.ts
- socketHandlerMetrics.ts
- gameAuth.ts
- estimate/server/src/socketHandlers.ts
- partyHandlers.ts
- imposter/ui-vue/src/App.vue
- gameManager.ts
- blackout/server/src/managers/broadcastManager.ts
- logger.ts
- flip7/server/src/socketHandlers.ts
- imposter/server/src/handlers/socketHandlers.ts
- scout/e2e/game.spec.ts
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- scripts
- secret-signals/core/src/constants.ts
- database.ts
- secret-signals/ui-vue/src/App.vue
- flip7/server/src/managers/broadcastManager.ts
- requestLogger.ts
- compilerOptions
- scout/__tests__/socketHandlers.test.ts
- flip7/core/src/types.ts
- compilerOptions
- include
- vitest.projects.ts
- HomeTabBar.vue
- registry/index.ts
- import-db-csv.mjs
- secret-signals/core/src/types.ts
- turnManager.ts
- TeamSetup.vue
- imposter/e2e/game.spec.ts
- wordLibrary.ts
- HomeView.vue
- estimate/ui-vue/src/App.vue
- secret-signals/server/src/handlers/socketHandlers.ts
- PartyView.vue
- partyHandlers.test.ts
- include
- GameView.vue
- copy-db-assets.mjs
- flip7/ui-vue/src/components/GameTable.vue
- scout/server/src/managers/broadcastManager.ts
- estimate/core/src/types.ts
- questionLibrary.ts
- compilerOptions
- blackout/package.json
- secret-signals/ui-vue/src/stores/game.ts
- secret-signals/e2e/game.spec.ts
- flip7/package.json
- collectors.ts
- Room
- blackout/server/src/socketHandlers.ts
- imposter/server/src/managers/phaseManager.ts
- imposter/package.json
- scout/package.json
- secret-signals/package.json
- GameRound.vue
- socketNamespaceMetrics.ts
- estimate/e2e/game.spec.ts
- imposter/server/src/managers/broadcastManager.ts
- estimate/__tests__/socketHandlers.test.ts
- secret-signals/server/src/managers/broadcastManager.ts
- NumberLine.vue
- estimate/ui-vue/src/composables/useSocket.ts
- dev-server.cjs
- imposter/core/src/types.ts
- flip7/ui-vue/src/stores/game.ts
- estimate/package.json
- SignalInput.vue
- env.ts
- blackout/ui-vue/src/App.vue
- router/index.ts
- games/index.ts
- QuestionView.vue
- blackout/ui-vue/src/components/Lobby.vue
- blackout/ui-vue/src/PlatformAdapter.vue
- flip7/ui-vue/src/PlatformAdapter.vue
- imposter/ui-vue/src/vite-env.d.ts
- secret-signals/ui-vue/src/vite-env.d.ts
- eslint
- PublicLobbiesSection.vue
- eslint-config-prettier
- @eslint/js
- eslint-plugin-prettier
- flip7/ui-vue/src/App.vue
- eslint-plugin-vue
- estimate/ui-vue/env.d.ts
- flip7/ui-vue/env.d.ts
- scout/ui-vue/env.d.ts
- pinia
- pino-pretty
- vite.config.ts
- @playwright/test
- prettier
- socket.io-client
- tailwindcss
- @tailwindcss/vite
- tsx
- @types/better-sqlite3
- @types/cookie-parser
- @types/jsonwebtoken
- typescript
- typescript-eslint
- @vitejs/plugin-vue
- scout/ui-vue/src/App.vue
- vitest
- vue
- @vue/devtools-api
- vue-eslint-parser
- vue-tsc
- scout/ui-vue/src/components/GameTable.vue
- MAX_PLAYERS
- MIN_PLAYERS
- MAX_PLAYERS
- scout/core/src/types.ts
- MIN_PLAYERS
- ScoutDialog.vue
- VotingPhase.vue
- HostTabPanel.vue
- JoinTabPanel.vue
- TEAM_HEX
- TEAM_NAME
- TEAM_TEXT_HEX
- platform/env.d.ts

## God Nodes (most connected - your core abstractions)
1. `registerGame()` - 49 edges
2. `registerScout()` - 46 edges
3. `registerGame()` - 42 edges
4. `registerBlackout()` - 41 edges
5. `registerFlip7()` - 39 edges
6. `registerGameHandlers()` - 35 edges
7. `registerPartyHandlers()` - 33 edges
8. `createComponentLogger()` - 26 edges
9. `registerAdminRoutes()` - 24 edges
10. `attachSocketEventDebugLogging()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `useSocket()` --calls--> `io`  [INFERRED]
  games/blackout/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/scout/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `registerBlackout()` --calls--> `readLoggingConfig()`  [INFERRED]
  games/blackout/server/src/socketHandlers.ts → apps/platform/server/logging/logger.ts
- `registerFlip7()` --calls--> `readLoggingConfig()`  [INFERRED]
  games/flip7/server/src/socketHandlers.ts → apps/platform/server/logging/logger.ts
- `registerGame()` --calls--> `readLoggingConfig()`  [INFERRED]
  games/imposter/server/src/handlers/socketHandlers.ts → apps/platform/server/logging/logger.ts

## Import Cycles
- None detected.

## Communities (150 total, 41 thin omitted)

### Community 0 - "trickManager.ts"
Cohesion: 0.13
Nodes (38): advanceTurn(), allOtherPlayersScouted(), beatsCurrentPlay(), beginFirstTrickIfReady(), buildE2EDeck(), buildPlayerCountDeck(), cardHasValue(), commitPlay() (+30 more)

### Community 1 - "flip7/server/src/managers/roundManager.ts"
Cohesion: 0.16
Nodes (25): buildDeck(), draw(), reshuffleFromDiscard(), shuffle(), advanceTurnOrFinalize(), applyNumberCard(), buildE2EDeck(), computeWinners() (+17 more)

### Community 2 - "blackout/core/src/types.ts"
Cohesion: 0.12
Nodes (23): DEFAULT_EXCLUDED_LETTERS, Category, Language, Phase, Player, RoundData, RoundResult, TaskRule (+15 more)

### Community 3 - "AdminView.vue"
Cohesion: 0.06
Nodes (36): actionMessage, activeSection, AdminLog, AdminParty, AdminPartyMember, authenticated, autoRefresh, buildQueryParams() (+28 more)

### Community 4 - "scout/server/src/socketHandlers.ts"
Cohesion: 0.09
Nodes (53): getPartyByActiveMatch(), cleanupMatch(), definition, GameDefinition, gameLogger, register(), broadcastRoom(), ScoutNamespace (+45 more)

### Community 5 - "server/index.ts"
Cohesion: 0.13
Nodes (15): checkLoginRateLimit(), registerHttpRoutes(), app, connPruneInterval, connRateLimit, httpServer, PORT, serverLogger (+7 more)

### Community 6 - "partyStore.ts"
Cohesion: 0.11
Nodes (28): AdminPartyView, AuthorizePartyJoinSuccess, ActivePartyMatch, ClearAllPartiesResult, connectedMemberCount(), createParty(), generateInviteCode(), getAllParties() (+20 more)

### Community 7 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, concurrently, @types/express, @types/node, vite, concurrently, @types/express, @types/node (+1 more)

### Community 8 - "devDependencies"
Cohesion: 0.05
Nodes (41): dependencies, pinia, vue, @vue/devtools-api, vue-router, devDependencies, concurrently, socket.io-client (+33 more)

### Community 9 - "usePartySocket.ts"
Cohesion: 0.21
Nodes (10): JoinableListResponse, PartyClientToServerEvents, PartyServerToClientEvents, PartySocket, SetPartyPublicResponse, usePublicLobbies(), PartyView, JoinablePartyView (+2 more)

### Community 10 - "admin.ts"
Cohesion: 0.09
Nodes (42): AdminJwtPayload, adminLogger, AdminPartyMemberView, authenticateAdmin(), checkRateLimit(), chooseNextHost(), cleanupActiveMatch(), clearAdminCookies() (+34 more)

### Community 11 - "socketHandlerMetrics.ts"
Cohesion: 0.08
Nodes (24): parseBooleanEnv(), MetricsHttpConfig, metricsScrapeTotal, readBearerToken(), readMetricsAccessToken(), readMetricsHttpConfig(), registerMetricsRoutes(), incrementPartyLifecycle() (+16 more)

### Community 12 - "gameAuth.ts"
Cohesion: 0.40
Nodes (9): assignHost(), AuthorizePartyJoinFailure, AuthorizePartyJoinResult, clearHost(), GameRoomLike, isConnectedPlayer(), restoreHostToFirstConnectedPlayer(), syncRoomHostAfterJoin() (+1 more)

### Community 13 - "estimate/server/src/socketHandlers.ts"
Cohesion: 0.07
Nodes (53): authorizePartyJoin(), normalizeJoinToken(), normalizeStablePlayerId(), Phase, ServerRoom, cleanupMatch(), advanceRound(), allConnectedPlayersSubmitted() (+45 more)

### Community 14 - "partyHandlers.ts"
Cohesion: 0.19
Nodes (18): toLoggableError(), broadcastParty(), broadcastPartyAndLobbies(), joinableListPruneInterval, joinableListRateLimit, JoinableListResponse, partyActionPruneInterval, partyActionRateLimit (+10 more)

### Community 15 - "imposter/ui-vue/src/App.vue"
Cohesion: 0.09
Nodes (27): autoJoinInFlight, embeddedError, emit, emitAutoJoinRoom(), handleConfigureLobby(), handleEmbeddedConnect(), handleEndGame(), handleGuessWord() (+19 more)

### Community 16 - "gameManager.ts"
Cohesion: 0.15
Nodes (28): addWordToLibrary(), advanceDescriptionTurn(), allDescriptionsSubmitted(), allVotesSubmitted(), finalizeRound(), getConnectedPlayerOrder(), getDescriptionOrder(), getRandomDescriptionOrder() (+20 more)

### Community 17 - "blackout/server/src/managers/broadcastManager.ts"
Cohesion: 0.19
Nodes (16): ClientToServerEvents, ServerToClientEvents, PlayerView, RoomView, RoundView, BlackoutNamespace, broadcastRoom(), sendRoomToPlayer() (+8 more)

### Community 18 - "logger.ts"
Cohesion: 0.21
Nodes (17): appendLogEntry(), ALWAYS_REDACT_PATHS, buildLoggerOptions(), createLogBufferStream(), createRootLogger(), logger, LoggingConfig, nodeRequire (+9 more)

### Community 19 - "flip7/server/src/socketHandlers.ts"
Cohesion: 0.10
Nodes (37): Room, cleanupMatch(), definition, GameDefinition, gameLogger, register(), transitionToEnded(), transitionToLobby() (+29 more)

### Community 20 - "imposter/server/src/handlers/socketHandlers.ts"
Cohesion: 0.10
Nodes (41): createComponentLogger(), Player, clearDiscussionTimer(), clearGuessTimer(), clearRoomTimers(), discussionTimers, GameSocket, guessTimers (+33 more)

### Community 21 - "scout/e2e/game.spec.ts"
Cohesion: 0.16
Nodes (13): confirmSetupKeep(), createParty(), createTwoPlayerScoutSession(), hostStartsFromLobby(), joinParty(), launchScout(), playerRow(), playSelectedRowCards() (+5 more)

### Community 22 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+18 more)

### Community 23 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+18 more)

### Community 24 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+18 more)

### Community 25 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+18 more)

### Community 26 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+18 more)

### Community 27 - "scripts"
Cohesion: 0.04
Nodes (47): bcryptjs, better-sqlite3, cookie-parser, jsonwebtoken, nanoid, dependencies, bcryptjs, better-sqlite3 (+39 more)

### Community 28 - "secret-signals/core/src/constants.ts"
Cohesion: 0.16
Nodes (14): getActiveTeamColors(), getCardDistribution(), LEGACY_CARD_DISTRIBUTION, TEAM_COLORS, TEAM_TEXT_HEX_BY_COLOR, PLAYER_ID, RESUME_TOKEN, ROOM_CODE (+6 more)

### Community 29 - "database.ts"
Cohesion: 0.09
Nodes (17): counts, db, dbLogger, finalCounts, hasColumn(), needsSchemaReset(), normalizeLetter(), parseCsv() (+9 more)

### Community 30 - "secret-signals/ui-vue/src/App.vue"
Cohesion: 0.10
Nodes (25): autoJoinInFlight, embeddedError, emit, emitAutoJoinRoom(), handleAssignRole(), handleAssignTeam(), handleEndTurn(), handleFocusCard() (+17 more)

### Community 31 - "flip7/server/src/managers/broadcastManager.ts"
Cohesion: 0.13
Nodes (22): io, ActionResolvedEvent, AutoJoinRoomData, AutoJoinRoomResponse, ClientToServerEvents, ErrorResponse, ServerToClientEvents, RoomView (+14 more)

### Community 32 - "requestLogger.ts"
Cohesion: 0.50
Nodes (7): createRequestId(), createRequestLogger(), httpLogger, isStaticAssetRequest(), normalizeRequestPath(), resolveHttpLogLevel(), shouldIgnoreHttpRequest()

### Community 33 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 34 - "scout/__tests__/socketHandlers.test.ts"
Cohesion: 0.28
Nodes (6): getAllRooms(), makeIo(), makeNamespace(), setupParty(), setupScoutServer(), TestSocket

### Community 35 - "flip7/core/src/types.ts"
Cohesion: 0.14
Nodes (17): MODIFIER_ADD_VALUES, ActionCard, Card, ModifierAdd, ModifierX2, NumberCard, DeferredAction, PendingAction (+9 more)

### Community 36 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution, target (+16 more)

### Community 37 - "include"
Cohesion: 0.07
Nodes (27): compilerOptions, baseUrl, module, moduleResolution, outDir, paths, target, extends (+19 more)

### Community 38 - "vitest.projects.ts"
Cohesion: 0.19
Nodes (9): allProjects, blackoutProject, estimateProject, flip7Project, GAMES_ROOT, imposterProject, platformProject, scoutProject (+1 more)

### Community 39 - "HomeTabBar.vue"
Cohesion: 0.16
Nodes (18): activate(), emit, focusedIndex, focusPanelFirstControl(), moveFocus(), onKeydown(), panelId(), props (+10 more)

### Community 40 - "registry/index.ts"
Cohesion: 0.11
Nodes (20): blackoutModule, estimateModule, flip7Module, GameServerModule, imposterModule, scoutModule, secretSignalsModule, definition (+12 more)

### Community 41 - "import-db-csv.mjs"
Cohesion: 0.15
Nodes (7): args, dataRows, db, headers, raw, rows, schemaSql

### Community 42 - "secret-signals/core/src/types.ts"
Cohesion: 0.13
Nodes (15): Card, CardType, CardView, FocusMarker, LogEntry, Signal, TeamColor, TeamConfig (+7 more)

### Community 43 - "turnManager.ts"
Cohesion: 0.40
Nodes (7): Room, advanceToNextTeam(), checkWinCondition(), clearFocusedCard(), clearFocusedCardAtIndex(), giveSignal(), processGuess()

### Community 44 - "TeamSetup.vue"
Cohesion: 0.19
Nodes (12): activeTeams, currentPlayer, currentPlayerTeam, emit, isDirectorUnavailable(), isSetupValid, pickRole(), pickTeam() (+4 more)

### Community 45 - "imposter/e2e/game.spec.ts"
Cohesion: 0.31
Nodes (9): castVote(), createParty(), findCurrentTurnPage(), joinParty(), launchGame(), playFullRound(), setupThreePlayers(), submitDescription() (+1 more)

### Community 46 - "wordLibrary.ts"
Cohesion: 0.18
Nodes (10): DEFAULT_WORD_LIBRARY, PLAYER_ID, RESUME_TOKEN, ROOM_CODE, getGlobalWordLibrary(), loadFromFile(), PERSIST_ENABLED, persistWord() (+2 more)

### Community 47 - "HomeView.vue"
Cohesion: 0.12
Nodes (16): readStr(), useHomePartyActions(), writeStr(), HOME_TABS, usePartySocket(), PartyMatchView, PartyMemberView, PartyStatus (+8 more)

### Community 48 - "estimate/ui-vue/src/App.vue"
Cohesion: 0.12
Nodes (17): StoredSession, emit, initError, joinRoom(), nextRound(), props, restartGame(), revealSolution() (+9 more)

### Community 49 - "secret-signals/server/src/handlers/socketHandlers.ts"
Cohesion: 0.13
Nodes (31): ASSASSIN_PENALTY_MODES, getMinimumPlayersForTeamCount(), Player, addLogEntry(), GameSocket, reassignHost(), registerGame(), removePlayerFromRoom() (+23 more)

### Community 50 - "PartyView.vue"
Cohesion: 0.10
Nodes (10): activeGameName, defaultGameConfig, error, gameInProgress, launching, props, publicTogglePending, router (+2 more)

### Community 51 - "partyHandlers.test.ts"
Cohesion: 0.31
Nodes (7): resetPartyActionRateLimit(), connectSocket(), createNamespace(), createPartyViaSocket(), createSocket(), Handler, setup()

### Community 52 - "include"
Cohesion: 0.08
Nodes (25): apps/platform/e2e/**/*, apps/platform/server/**/*, apps/platform/src, games/*/core/src/**/*, games/*/e2e/**/*, games/*/server/src/**/*, games/*/__tests__/**/*, games/*/ui-vue (+17 more)

### Community 53 - "GameView.vue"
Cohesion: 0.11
Nodes (12): getClientGame(), actionError, gameComponent, loadError, loadGameComponent(), matchKey, props, router (+4 more)

### Community 54 - "copy-db-assets.mjs"
Cohesion: 0.22
Nodes (8): dbPath, __dirname, __filename, gameDir, legacySeedPath, sourceDir, targetDir, workspaceRoot

### Community 55 - "flip7/ui-vue/src/components/GameTable.vue"
Cohesion: 0.09
Nodes (18): PendingActionView, PlayerView, ACTION_LABELS, eligiblePlayers, emit, info, props, canStay (+10 more)

### Community 56 - "scout/server/src/managers/broadcastManager.ts"
Cohesion: 0.16
Nodes (16): AutoJoinRoomData, AutoJoinRoomResponse, BasicResponse, ClientToServerEvents, ErrorResponse, ScoutActionPayload, ServerToClientEvents, RoomView (+8 more)

### Community 57 - "estimate/core/src/types.ts"
Cohesion: 0.24
Nodes (10): computeDisplayRange(), DisplayRange, GuessEntry, PlayerView, ScoreEntry, ServerPlayer, WinnerEntry, buildRoomView() (+2 more)

### Community 58 - "questionLibrary.ts"
Cohesion: 0.22
Nodes (13): DEFAULT_QUESTIONS, Question, fileReader(), getQuestionLibrary(), loadFromFile(), parseCsvLine(), questionLogger, QUESTIONS_FILE (+5 more)

### Community 59 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, skipLibCheck, strict, target, ES2020

### Community 60 - "blackout/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 61 - "secret-signals/ui-vue/src/stores/game.ts"
Cohesion: 0.07
Nodes (34): TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR, Phase, PlayerView, StoredSession, focusedLabel(), focusedPlayers(), store (+26 more)

### Community 62 - "secret-signals/e2e/game.spec.ts"
Cohesion: 0.52
Nodes (6): chooseRole(), chooseTeam(), createParty(), joinParty(), launchGame(), setupFourPlayers()

### Community 63 - "flip7/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 64 - "collectors.ts"
Cohesion: 0.15
Nodes (13): activeConnectionsGauge, initializeMetrics(), partiesActiveGauge, partyMembersConnectedGauge, publicLobbiesGauge, roomPlayersConnectedGauge, roomsActiveGauge, setActiveConnections() (+5 more)

### Community 65 - "Room"
Cohesion: 0.46
Nodes (5): Room, addPoint(), getLeaderboard(), getWinners(), resetScores()

### Community 66 - "blackout/server/src/socketHandlers.ts"
Cohesion: 0.11
Nodes (33): namespace, cleanupMatch(), getDefaultExcludedLetters(), transitionToEnded(), transitionToLobby(), transitionToPlaying(), transitionToRoundEnd(), createPlayer() (+25 more)

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

### Community 72 - "socketNamespaceMetrics.ts"
Cohesion: 0.30
Nodes (11): MetricResult, recordSocketEventEnd(), recordSocketEventStart(), setNamespaceConnectionCount(), startSocketHandlerInstrumentation(), getNamespaceSocketCount(), NamespaceLike, NamespaceMetricLabels (+3 more)

### Community 73 - "estimate/e2e/game.spec.ts"
Cohesion: 0.22
Nodes (4): createParty(), createTwoPlayerEstimateSession(), EstimateSession, joinParty()

### Community 74 - "imposter/server/src/managers/broadcastManager.ts"
Cohesion: 0.27
Nodes (10): ClientToServerEvents, ServerToClientEvents, RoomView, broadcastRoom(), GameNamespace, sendRoomToPlayer(), toPlayerView(), toRoomViewForPlayer() (+2 more)

### Community 75 - "estimate/__tests__/socketHandlers.test.ts"
Cohesion: 0.27
Nodes (7): __listRoomsForTests(), firstRoom(), makeIo(), makeNamespace(), setupParty(), setupServer(), TestSocket

### Community 76 - "secret-signals/server/src/managers/broadcastManager.ts"
Cohesion: 0.26
Nodes (11): ClientToServerEvents, ServerToClientEvents, AssassinPenaltyMode, PlayerRole, RoomView, broadcastRoom(), GameNamespace, sendRoomToPlayer() (+3 more)

### Community 77 - "NumberLine.vue"
Cohesion: 0.20
Nodes (7): MarkerPosition, playerMarkers, props, range, solutionMarker, span, emit

### Community 78 - "estimate/ui-vue/src/composables/useSocket.ts"
Cohesion: 0.36
Nodes (7): ClientToServerEvents, ServerToClientEvents, RoomView, EstimateSocket, normalizeNamespace(), resolveSocketUrl(), useSocket()

### Community 79 - "dev-server.cjs"
Cohesion: 0.29
Nodes (6): child, envFilePath, { existsSync }, nodeArgs, path, { spawn }

### Community 80 - "imposter/core/src/types.ts"
Cohesion: 0.06
Nodes (39): Phase, PlayerView, RoundResult, StoredSession, currentDescriber, description, emit, error (+31 more)

### Community 81 - "flip7/ui-vue/src/stores/game.ts"
Cohesion: 0.08
Nodes (23): StoredSession, meta, props, sentence, accentClasses, cardSubtext, cardText, label (+15 more)

### Community 82 - "estimate/package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 83 - "SignalInput.vue"
Cohesion: 0.40
Nodes (5): emit, error, number, submit(), word

### Community 85 - "env.ts"
Cohesion: 0.70
Nodes (4): findNearestEnvFile(), loadLocalEnvFile(), parseEnvFile(), stripOptionalQuotes()

### Community 86 - "blackout/ui-vue/src/App.vue"
Cohesion: 0.10
Nodes (25): clearEmbeddedRetryTimer(), embeddedError, embeddedPlayerName(), emit, emitAutoJoinRoom(), error, handleEmbeddedConnect(), handleReroll() (+17 more)

### Community 88 - "games/index.ts"
Cohesion: 0.20
Nodes (10): gameNames, emit, cards, CardView, emit, handleSelect(), props, clientGameRegistry (+2 more)

### Community 89 - "QuestionView.vue"
Cohesion: 0.50
Nodes (4): emit, input, parseAndSubmit(), validationError

### Community 91 - "blackout/ui-vue/src/components/Lobby.vue"
Cohesion: 0.36
Nodes (7): adjustRounds(), emit, excludedLettersInput, parseExcludedLetters(), saveExcludedLetters(), store, updateLanguage()

### Community 98 - "PublicLobbiesSection.vue"
Cohesion: 0.16
Nodes (10): emit, handleJoin(), props, currentInviteCode, emit, handleJoinRoom(), isLoading, isReady (+2 more)

### Community 103 - "flip7/ui-vue/src/App.vue"
Cohesion: 0.14
Nodes (19): cardToDrawnCardInfo(), clearRetryTimer(), commitRoomUpdate(), detectDrawnCard(), displayName(), embeddedError, emit, emitAutoJoinRoom() (+11 more)

### Community 124 - "scout/ui-vue/src/App.vue"
Cohesion: 0.07
Nodes (30): StoredSession, clearRetryTimer(), commitRoomUpdate(), displayName(), embeddedError, emit, emitAutoJoinRoom(), handleConnect() (+22 more)

### Community 132 - "scout/ui-vue/src/components/GameTable.vue"
Cohesion: 0.15
Nodes (9): cardClasses, props, currentPlay, currentTurnName, emit, handleScout(), room, scoutDialogOpen (+1 more)

### Community 137 - "scout/core/src/types.ts"
Cohesion: 0.09
Nodes (30): analyzePlay(), comparePlayAnalyses(), PlayAnalysis, PlayKind, CARD_VALUES, buildDeck(), flipCard(), ScoutCard (+22 more)

### Community 141 - "ScoutDialog.vue"
Cohesion: 0.08
Nodes (21): canScout, currentCards, currentOwnerName, edgeCards, emit, flipSelected, hasScoutAndShowToken, insertIndex (+13 more)

### Community 145 - "VotingPhase.vue"
Cohesion: 0.17
Nodes (11): emit, handleVote(), isDiscussion, isVoting, now, orderedPlayers, otherPlayers, selectedTarget (+3 more)

### Community 177 - "JoinTabPanel.vue"
Cohesion: 0.83
Nodes (3): emit, onCodeInput(), onNameInput()

### Community 183 - "platform/env.d.ts"
Cohesion: 0.29
Nodes (6): @blackout-ui/PlatformAdapter.vue, @estimate-ui/PlatformAdapter.vue, @flip7-ui/PlatformAdapter.vue, @imposter-ui/PlatformAdapter.vue, @scout-ui/PlatformAdapter.vue, @secret-signals-ui/PlatformAdapter.vue

## Knowledge Gaps
- **842 isolated node(s):** `HttpResponse`, `routerReplace`, `Handler`, `gameNames`, `@blackout-ui/PlatformAdapter.vue` (+837 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `io` connect `flip7/server/src/managers/broadcastManager.ts` to `scout/server/src/managers/broadcastManager.ts`, `blackout/server/src/managers/broadcastManager.ts`, `server/index.ts`, `HomeView.vue`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `createComponentLogger()` connect `imposter/server/src/handlers/socketHandlers.ts` to `requestLogger.ts`, `blackout/server/src/socketHandlers.ts`, `scout/server/src/socketHandlers.ts`, `server/index.ts`, `registry/index.ts`, `admin.ts`, `socketHandlerMetrics.ts`, `partyHandlers.ts`, `wordLibrary.ts`, `secret-signals/server/src/handlers/socketHandlers.ts`, `logger.ts`, `flip7/server/src/socketHandlers.ts`, `questionLibrary.ts`, `database.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `usePartySocket()` connect `HomeView.vue` to `usePartySocket.ts`, `PartyView.vue`, `GameView.vue`, `flip7/server/src/managers/broadcastManager.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `registerGame()` (e.g. with `createComponentLogger()` and `readLoggingConfig()`) actually correct?**
  _`registerGame()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `registerScout()` (e.g. with `register()` and `createComponentLogger()`) actually correct?**
  _`registerScout()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `registerGame()` (e.g. with `createComponentLogger()` and `readLoggingConfig()`) actually correct?**
  _`registerGame()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `registerBlackout()` (e.g. with `register()` and `createComponentLogger()`) actually correct?**
  _`registerBlackout()` has 3 INFERRED edges - model-reasoned connections that need verification._