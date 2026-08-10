# Graph Report - game-platform  (2026-08-10)

## Corpus Check
- 287 files · ~110,818 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2277 nodes · 4499 edges · 155 communities (110 shown, 45 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fa11f6f1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- trickManager.ts
- roundManager.ts
- socketHandlers.ts
- AdminView.vue
- socketHandlers.ts
- index.ts
- partyStore.ts
- devDependencies
- devDependencies
- usePartySocket.ts
- admin.ts
- socketHandlerMetrics.ts
- gameAuth.ts
- room.ts
- partyHandlers.ts
- App.vue
- gameManager.ts
- useSocket.ts
- logger.ts
- socketHandlers.ts
- socketHandlers.ts
- game.spec.ts
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- scripts
- constants.ts
- database.ts
- App.vue
- broadcastManager.ts
- roundManager.test.ts
- compilerOptions
- useHomeTabs.ts
- @shared/types
- compilerOptions
- include
- vitest.projects.ts
- HomeTabBar.vue
- RoundSummary.vue
- import-db-csv.mjs
- GameRound.vue
- boardManager.ts
- TeamSetup.vue
- game.spec.ts
- wordLibrary.ts
- HomeView.vue
- App.vue
- socketHandlers.ts
- PartyView.vue
- partyHandlers.test.ts
- include
- GameView.vue
- copy-db-assets.mjs
- GameTable.vue
- types.ts
- types.ts
- questionLibrary.ts
- compilerOptions
- package.json
- constants.ts
- game.spec.ts
- package.json
- collectors.ts
- types.ts
- socketHandlers.ts
- phaseManager.ts
- package.json
- package.json
- package.json
- game.ts
- admin.test.ts
- game.spec.ts
- broadcastManager.ts
- socketHandlers.test.ts
- types.ts
- NumberLine.vue
- copy-assets.mjs
- dev-server.cjs
- types.ts
- game.ts
- package.json
- GamePlay.vue
- env.ts
- App.vue
- index.ts
- index.ts
- GameOver.vue
- Lobby.vue
- PlatformAdapter.vue
- PlatformAdapter.vue
- vite-env.d.ts
- vite-env.d.ts
- eslint
- PublicLobbiesSection.vue
- useSocket.ts
- @eslint/js
- eslint-plugin-prettier
- App.vue
- eslint-plugin-vue
- env.d.ts
- env.d.ts
- env.d.ts
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
- embedded-test.ts
- @types/jsonwebtoken
- typescript
- typescript-eslint
- @vitejs/plugin-vue
- App.vue
- vitest
- vue
- config.ts
- vue-eslint-parser
- vue-tsc
- home-library.spec.ts
- GameTable.vue
- MAX_PLAYERS
- MIN_PLAYERS
- MAX_PLAYERS
- PlayControls.vue
- MIN_PLAYERS
- @types/express
- ScoutDialog.vue
- @types/node
- vite
- WaitingView.vue
- VotingPhase.vue
- tailwindcss
- HostTabPanel.vue
- JoinTabPanel.vue
- TEAM_HEX
- TEAM_NAME
- TEAM_TEXT_HEX
- env.d.ts

## God Nodes (most connected - your core abstractions)
1. `registerGame()` - 49 edges
2. `registerScout()` - 46 edges
3. `registerGame()` - 42 edges
4. `registerBlackout()` - 41 edges
5. `registerFlip7()` - 39 edges
6. `@shared/types` - 36 edges
7. `registerPartyHandlers()` - 33 edges
8. `registerGameHandlers()` - 33 edges
9. `createComponentLogger()` - 26 edges
10. `registerAdminRoutes()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `createNamespace()` --indirect_call--> `room()`  [INFERRED]
  apps/platform/__tests__/partyHandlers.test.ts → games/scout/__tests__/trickManager.test.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/blackout/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/flip7/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/scout/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `registerAdminRoutes()` --references--> `express`  [EXTRACTED]
  apps/platform/server/admin.ts → package.json

## Import Cycles
- None detected.

## Communities (155 total, 45 thin omitted)

### Community 0 - "trickManager.ts"
Cohesion: 0.12
Nodes (41): analyzePlay(), buildDeck(), flipCard(), advanceTurn(), allOtherPlayersScouted(), beatsCurrentPlay(), beginFirstTrickIfReady(), buildE2EDeck() (+33 more)

### Community 1 - "roundManager.ts"
Cohesion: 0.15
Nodes (27): buildDeck(), draw(), reshuffleFromDiscard(), shuffle(), advanceTurnOrFinalize(), applyNumberCard(), buildE2EDeck(), chooseActionTarget() (+19 more)

### Community 2 - "socketHandlers.ts"
Cohesion: 0.20
Nodes (24): normalizeJoinToken(), normalizeStablePlayerId(), allConnectedPlayersSubmitted(), isFiniteGuess(), submitGuess(), clearSocketIndex(), getSocketIndex(), findPlayer() (+16 more)

### Community 3 - "AdminView.vue"
Cohesion: 0.06
Nodes (36): actionMessage, activeSection, AdminLog, AdminParty, AdminPartyMember, authenticated, autoRefresh, buildQueryParams() (+28 more)

### Community 4 - "socketHandlers.ts"
Cohesion: 0.09
Nodes (53): readLoggingConfig(), recordSocketEventEnd(), recordSocketEventStart(), startSocketHandlerInstrumentation(), recordNamespaceConnection(), recordNamespaceDisconnect(), cleanupMatch(), GameDefinition (+45 more)

### Community 5 - "index.ts"
Cohesion: 0.15
Nodes (12): registerHttpRoutes(), app, connPruneInterval, connRateLimit, httpServer, PORT, serverLogger, requestLogger (+4 more)

### Community 6 - "partyStore.ts"
Cohesion: 0.12
Nodes (20): CardView, FocusMarker, Phase, PlayerView, Signal, StoredSession, TurnPhase, focusedLabel() (+12 more)

### Community 7 - "devDependencies"
Cohesion: 0.29
Nodes (7): eslint-plugin-vue, devDependencies, concurrently, eslint-plugin-vue, @types/cookie-parser, concurrently, @types/cookie-parser

### Community 8 - "devDependencies"
Cohesion: 0.05
Nodes (39): dependencies, pinia, vue, vue-router, devDependencies, concurrently, socket.io-client, tsx (+31 more)

### Community 9 - "usePartySocket.ts"
Cohesion: 0.19
Nodes (10): JoinableListResponse, PartyClientToServerEvents, PartyServerToClientEvents, PartySocket, SetPartyPublicResponse, PartyMatchView, PartyMemberView, PartyStatus (+2 more)

### Community 10 - "admin.ts"
Cohesion: 0.10
Nodes (37): AdminJwtPayload, adminLogger, AdminPartyMemberView, AdminPartyView, authenticateAdmin(), checkLoginRateLimit(), checkRateLimit(), chooseNextHost() (+29 more)

### Community 11 - "socketHandlerMetrics.ts"
Cohesion: 0.05
Nodes (43): parseBooleanEnv(), activeConnectionsGauge, initializeMetrics(), partiesActiveGauge, partyMembersConnectedGauge, publicLobbiesGauge, roomPlayersConnectedGauge, roomsActiveGauge (+35 more)

### Community 12 - "gameAuth.ts"
Cohesion: 0.23
Nodes (16): assignHost(), authorizePartyJoin(), AuthorizePartyJoinFailure, AuthorizePartyJoinResult, clearHost(), GameRoomLike, isConnectedPlayer(), restoreHostToFirstConnectedPlayer() (+8 more)

### Community 13 - "room.ts"
Cohesion: 0.10
Nodes (21): ServerPlayer, clearSocketIndexesForRoom(), createPlayer(), __resetSocketIndexForTests(), setSocketIndex(), socketIndex, attachPlayerToRoom(), clearRoomCleanup() (+13 more)

### Community 14 - "partyHandlers.ts"
Cohesion: 0.08
Nodes (55): toLoggableError(), incrementPartyLifecycle(), broadcastParty(), broadcastPartyAndLobbies(), joinableListPruneInterval, joinableListRateLimit, JoinableListResponse, partyActionPruneInterval (+47 more)

### Community 15 - "App.vue"
Cohesion: 0.09
Nodes (27): autoJoinInFlight, embeddedError, emit, emitAutoJoinRoom(), handleConfigureLobby(), handleEmbeddedConnect(), handleEndGame(), handleGuessWord() (+19 more)

### Community 16 - "gameManager.ts"
Cohesion: 0.15
Nodes (28): addWordToLibrary(), advanceDescriptionTurn(), allDescriptionsSubmitted(), allVotesSubmitted(), finalizeRound(), getConnectedPlayerOrder(), getDescriptionOrder(), getRandomDescriptionOrder() (+20 more)

### Community 17 - "useSocket.ts"
Cohesion: 0.60
Nodes (4): BlackoutSocket, normalizeNamespace(), resolveSocketUrl(), useSocket()

### Community 18 - "logger.ts"
Cohesion: 0.22
Nodes (12): appendLogEntry(), BufferedLogEntry, getRecentLogs(), logBuffer, ALWAYS_REDACT_PATHS, buildLoggerOptions(), createLogBufferStream(), createRootLogger() (+4 more)

### Community 19 - "socketHandlers.ts"
Cohesion: 0.10
Nodes (35): Player, Room, cleanupMatch(), GameDefinition, gameLogger, register(), transitionToEnded(), transitionToLobby() (+27 more)

### Community 20 - "socketHandlers.ts"
Cohesion: 0.10
Nodes (41): createComponentLogger(), Player, clearDiscussionTimer(), clearGuessTimer(), clearRoomTimers(), discussionTimers, GameSocket, guessTimers (+33 more)

### Community 21 - "game.spec.ts"
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
Nodes (44): bcryptjs, better-sqlite3, cookie-parser, jsonwebtoken, nanoid, dependencies, bcryptjs, better-sqlite3 (+36 more)

### Community 28 - "constants.ts"
Cohesion: 0.20
Nodes (11): getActiveTeamColors(), getCardDistribution(), TeamConfig, WORD_LIST, generateBoard(), transitionToEnded(), transitionToLobby(), transitionToPlaying() (+3 more)

### Community 29 - "database.ts"
Cohesion: 0.09
Nodes (17): counts, db, dbLogger, finalCounts, hasColumn(), needsSchemaReset(), normalizeLetter(), parseCsv() (+9 more)

### Community 30 - "App.vue"
Cohesion: 0.10
Nodes (25): autoJoinInFlight, embeddedError, emit, emitAutoJoinRoom(), handleAssignRole(), handleAssignTeam(), handleEndTurn(), handleFocusCard() (+17 more)

### Community 31 - "broadcastManager.ts"
Cohesion: 0.16
Nodes (19): ActionResolvedEvent, AutoJoinRoomData, AutoJoinRoomResponse, ClientToServerEvents, ErrorResponse, ServerToClientEvents, RoomView, RoundView (+11 more)

### Community 32 - "roundManager.test.ts"
Cohesion: 0.24
Nodes (9): ClientToServerEvents, ServerToClientEvents, RoomView, StoredSession, EstimateSocket, normalizeNamespace(), resolveSocketUrl(), useSocket() (+1 more)

### Community 33 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+17 more)

### Community 34 - "useHomeTabs.ts"
Cohesion: 0.40
Nodes (7): normalizeHomeTab(), readStoredTab(), resolveInitialHomeTab(), useHomeTabs(), VALID_TABS, writeStoredTab(), routerReplace

### Community 35 - "@shared/types"
Cohesion: 0.09
Nodes (26): MODIFIER_ADD_VALUES, ActionCard, Card, ModifierAdd, ModifierX2, NumberCard, @shared/types, DeferredAction (+18 more)

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
Cohesion: 0.26
Nodes (11): activate(), emit, focusedIndex, focusPanelFirstControl(), moveFocus(), onKeydown(), panelId(), props (+3 more)

### Community 40 - "RoundSummary.vue"
Cohesion: 0.18
Nodes (9): cardClasses, props, currentPlay, currentTurnName, emit, handleScout(), room, scoutDialogOpen (+1 more)

### Community 41 - "import-db-csv.mjs"
Cohesion: 0.15
Nodes (7): args, dataRows, db, headers, raw, rows, schemaSql

### Community 42 - "GameRound.vue"
Cohesion: 0.25
Nodes (7): canSkip, isCategoryReused, isReader, round, selectablePlayers, store, taskText

### Community 43 - "boardManager.ts"
Cohesion: 0.29
Nodes (10): Card, Room, TeamColor, advanceToNextTeam(), checkWinCondition(), clearFocusedCard(), clearFocusedCardAtIndex(), giveSignal() (+2 more)

### Community 44 - "TeamSetup.vue"
Cohesion: 0.18
Nodes (13): ASSASSIN_PENALTY_MODES, activeTeams, currentPlayer, currentPlayerTeam, emit, isDirectorUnavailable(), isSetupValid, pickRole() (+5 more)

### Community 45 - "game.spec.ts"
Cohesion: 0.31
Nodes (9): castVote(), createParty(), findCurrentTurnPage(), joinParty(), launchGame(), playFullRound(), setupThreePlayers(), submitDescription() (+1 more)

### Community 46 - "wordLibrary.ts"
Cohesion: 0.18
Nodes (10): DEFAULT_WORD_LIBRARY, PLAYER_ID, RESUME_TOKEN, ROOM_CODE, getGlobalWordLibrary(), loadFromFile(), PERSIST_ENABLED, persistWord() (+2 more)

### Community 47 - "HomeView.vue"
Cohesion: 0.16
Nodes (12): readStr(), useHomePartyActions(), writeStr(), HOME_TABS, usePartySocket(), usePartyStore, actions, { activeTab, setTab } (+4 more)

### Community 48 - "App.vue"
Cohesion: 0.12
Nodes (27): ActionName, clearJoinTimer(), clearPendingAction(), connectionMessage, emit, failJoin(), focusKey, handleConnectError() (+19 more)

### Community 49 - "socketHandlers.ts"
Cohesion: 0.14
Nodes (30): LogEntry, Player, addLogEntry(), GameSocket, reassignHost(), registerGame(), removePlayerFromRoom(), verifyPlayer() (+22 more)

### Community 50 - "PartyView.vue"
Cohesion: 0.10
Nodes (10): activeGameName, defaultGameConfig, error, gameInProgress, launching, props, publicTogglePending, router (+2 more)

### Community 51 - "partyHandlers.test.ts"
Cohesion: 0.50
Nodes (7): createRequestId(), createRequestLogger(), httpLogger, isStaticAssetRequest(), normalizeRequestPath(), resolveHttpLogLevel(), shouldIgnoreHttpRequest()

### Community 52 - "include"
Cohesion: 0.08
Nodes (25): apps/platform/e2e/**/*, apps/platform/server/**/*, apps/platform/src, games/*/core/src/**/*, games/*/e2e/**/*, games/*/server/src/**/*, games/*/__tests__/**/*, games/*/ui-vue (+17 more)

### Community 53 - "GameView.vue"
Cohesion: 0.11
Nodes (13): getClientGame(), actionError, gameComponent, loadError, loadGameComponent(), matchKey, namespace, props (+5 more)

### Community 54 - "copy-db-assets.mjs"
Cohesion: 0.22
Nodes (8): dbPath, __dirname, __filename, gameDir, legacySeedPath, sourceDir, targetDir, workspaceRoot

### Community 55 - "GameTable.vue"
Cohesion: 0.22
Nodes (6): dialog, gameEnded, gamePhase, Props, replayButton, showHostDialog

### Community 56 - "types.ts"
Cohesion: 0.09
Nodes (29): comparePlayAnalyses(), PlayAnalysis, PlayKind, CARD_VALUES, ScoutCard, AutoJoinRoomData, AutoJoinRoomResponse, BasicResponse (+21 more)

### Community 57 - "types.ts"
Cohesion: 0.12
Nodes (23): computeDisplayRange(), DisplayRange, GuessEntry, Phase, PlayerView, ScoreEntry, ServerRoom, WinnerEntry (+15 more)

### Community 58 - "questionLibrary.ts"
Cohesion: 0.21
Nodes (14): DEFAULT_QUESTIONS, Question, fileReader(), getQuestionLibrary(), loadFromFile(), parseCsvLine(), pickRandomQuestions(), questionLogger (+6 more)

### Community 59 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, skipLibCheck, strict, target, ES2020

### Community 60 - "package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 61 - "constants.ts"
Cohesion: 0.10
Nodes (20): getMinimumPlayersForTeamCount(), LEGACY_CARD_DISTRIBUTION, TEAM_COLORS, TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR, TEAM_TEXT_HEX_BY_COLOR, CardType, PLAYER_ID (+12 more)

### Community 62 - "game.spec.ts"
Cohesion: 0.52
Nodes (6): chooseRole(), chooseTeam(), createParty(), joinParty(), launchGame(), setupFourPlayers()

### Community 63 - "package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 64 - "collectors.ts"
Cohesion: 0.39
Nodes (7): logger, registerProcessLogging(), attachSocketEventDebugLogging(), createSocketLogger(), readSocketString(), SocketLike, summarizeSocketArg()

### Community 65 - "types.ts"
Cohesion: 0.19
Nodes (10): AuthorizePartyJoinSuccess, PartyMatch, PartyMember, PartySession, PartyStatus, getAllRooms(), makeIo(), makeNamespace() (+2 more)

### Community 66 - "socketHandlers.ts"
Cohesion: 0.05
Nodes (78): DEFAULT_EXCLUDED_LETTERS, ClientToServerEvents, ServerToClientEvents, Category, Language, Phase, Player, PlayerView (+70 more)

### Community 67 - "phaseManager.ts"
Cohesion: 0.33
Nodes (7): Room, resetForLobby(), resetForNewRound(), transitionToEnded(), transitionToLobby(), transitionToNextRound(), transitionToPlaying()

### Community 68 - "package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 69 - "package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 70 - "package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 71 - "game.ts"
Cohesion: 0.16
Nodes (11): StoredSession, sortedPlayers, store, topScore, winners, lastResult, sortedPlayers, store (+3 more)

### Community 72 - "admin.test.ts"
Cohesion: 0.15
Nodes (12): blackoutModule, estimateModule, flip7Module, gameRegistry, GameServerModule, imposterModule, scoutModule, secretSignalsModule (+4 more)

### Community 73 - "game.spec.ts"
Cohesion: 0.22
Nodes (4): createParty(), createTwoPlayerEstimateSession(), EstimateSession, joinParty()

### Community 74 - "broadcastManager.ts"
Cohesion: 0.27
Nodes (10): ClientToServerEvents, ServerToClientEvents, RoomView, broadcastRoom(), GameNamespace, sendRoomToPlayer(), toPlayerView(), toRoomViewForPlayer() (+2 more)

### Community 75 - "socketHandlers.test.ts"
Cohesion: 0.15
Nodes (13): cleanupMatch(), definition, GameDefinition, gameLogger, register(), getRoomBySession(), __listRoomsForTests(), registerEstimate() (+5 more)

### Community 76 - "types.ts"
Cohesion: 0.20
Nodes (14): io, useSocket(), ClientToServerEvents, ServerToClientEvents, AssassinPenaltyMode, PlayerRole, RoomView, broadcastRoom() (+6 more)

### Community 77 - "NumberLine.vue"
Cohesion: 0.15
Nodes (17): axisValues, chartHeight, container, containerWidth, lineY, MarkerPosition, maxLane, numberFormatter (+9 more)

### Community 78 - "copy-assets.mjs"
Cohesion: 0.33
Nodes (5): gameDir, scriptDir, sourceFile, targetDir, workspaceRoot

### Community 79 - "dev-server.cjs"
Cohesion: 0.29
Nodes (6): child, envFilePath, { existsSync }, nodeArgs, path, { spawn }

### Community 80 - "types.ts"
Cohesion: 0.06
Nodes (39): Phase, PlayerView, RoundResult, StoredSession, currentDescriber, description, emit, error (+31 more)

### Community 81 - "game.ts"
Cohesion: 0.06
Nodes (32): StoredSession, meta, props, sentence, accentClasses, cardSubtext, cardText, label (+24 more)

### Community 82 - "package.json"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 83 - "GamePlay.vue"
Cohesion: 0.15
Nodes (14): confirmCard, confirmCardIndex, emit, handleCardPress(), handleConfirmReveal(), leftRosterTeams, rightRosterTeams, rosterTeams (+6 more)

### Community 85 - "env.ts"
Cohesion: 0.70
Nodes (4): findNearestEnvFile(), loadLocalEnvFile(), parseEnvFile(), stripOptionalQuotes()

### Community 86 - "App.vue"
Cohesion: 0.14
Nodes (21): clearEmbeddedRetryTimer(), embeddedError, embeddedPlayerName(), emit, emitAutoJoinRoom(), error, handleEmbeddedConnect(), handleReroll() (+13 more)

### Community 88 - "index.ts"
Cohesion: 0.23
Nodes (9): emit, cards, CardView, emit, handleSelect(), props, clientGameRegistry, PlatformGameMeta (+1 more)

### Community 89 - "GameOver.vue"
Cohesion: 0.40
Nodes (5): emit, input, parseAndSubmit(), props, validationError

### Community 91 - "Lobby.vue"
Cohesion: 0.36
Nodes (7): adjustRounds(), emit, excludedLettersInput, parseExcludedLetters(), saveExcludedLetters(), store, updateLanguage()

### Community 94 - "PlatformAdapter.vue"
Cohesion: 0.47
Nodes (5): ClientToServerEvents, normalizeNamespace(), resolveSocketUrl(), ScoutSocket, useSocket()

### Community 98 - "PublicLobbiesSection.vue"
Cohesion: 0.13
Nodes (14): emit, handleJoin(), props, currentInviteCode, emit, handleJoinRoom(), isLoading, isReady (+6 more)

### Community 99 - "useSocket.ts"
Cohesion: 0.40
Nodes (4): emit, isLastRound, numberFormatter, props

### Community 103 - "App.vue"
Cohesion: 0.11
Nodes (21): cardToDrawnCardInfo(), clearRetryTimer(), commitRoomUpdate(), detectDrawnCard(), displayName(), embeddedError, emit, emitAutoJoinRoom() (+13 more)

### Community 124 - "App.vue"
Cohesion: 0.16
Nodes (16): clearRetryTimer(), commitRoomUpdate(), displayName(), embeddedError, emit, emitAutoJoinRoom(), handleConnect(), handlePlayAgain() (+8 more)

### Community 132 - "GameTable.vue"
Cohesion: 0.15
Nodes (12): StoredSession, emit, rankedPlayers, store, canStart, emit, playerCount, store (+4 more)

### Community 137 - "PlayControls.vue"
Cohesion: 0.15
Nodes (12): beatsPlay, canPlay, emit, isContiguous, playSelected(), props, selectedAnalysis, selectedCards (+4 more)

### Community 141 - "ScoutDialog.vue"
Cohesion: 0.08
Nodes (21): canScout, currentCards, currentOwnerName, edgeCards, emit, flipSelected, hasScoutAndShowToken, insertIndex (+13 more)

### Community 145 - "VotingPhase.vue"
Cohesion: 0.17
Nodes (11): emit, handleVote(), isDiscussion, isVoting, now, orderedPlayers, otherPlayers, selectedTarget (+3 more)

### Community 177 - "JoinTabPanel.vue"
Cohesion: 0.83
Nodes (3): emit, onCodeInput(), onNameInput()

### Community 183 - "env.d.ts"
Cohesion: 0.29
Nodes (6): @blackout-ui/PlatformAdapter.vue, @estimate-ui/PlatformAdapter.vue, @flip7-ui/PlatformAdapter.vue, @imposter-ui/PlatformAdapter.vue, @scout-ui/PlatformAdapter.vue, @secret-signals-ui/PlatformAdapter.vue

## Knowledge Gaps
- **871 isolated node(s):** `HttpResponse`, `routerReplace`, `Handler`, `expectedGames`, `@blackout-ui/PlatformAdapter.vue` (+866 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `io` connect `types.ts` to `index.ts`, `HomeView.vue`, `useSocket.ts`, `PlatformAdapter.vue`, `broadcastManager.ts`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `createComponentLogger()` connect `socketHandlers.ts` to `socketHandlers.ts`, `socketHandlers.ts`, `index.ts`, `admin.ts`, `socketHandlerMetrics.ts`, `socketHandlers.test.ts`, `partyHandlers.ts`, `wordLibrary.ts`, `socketHandlers.ts`, `logger.ts`, `partyHandlers.test.ts`, `socketHandlers.ts`, `questionLibrary.ts`, `database.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `usePartySocket()` connect `HomeView.vue` to `PublicLobbiesSection.vue`, `usePartySocket.ts`, `types.ts`, `PartyView.vue`, `GameView.vue`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `HttpResponse`, `routerReplace`, `Handler` to the rest of the system?**
  _871 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `trickManager.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12156448202959831 - nodes in this community are weakly interconnected._
- **Should `roundManager.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14772727272727273 - nodes in this community are weakly interconnected._
- **Should `AdminView.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.05537098560354374 - nodes in this community are weakly interconnected._