# Graph Report - game-platform  (2026-06-15)

## Corpus Check
- 232 files · ~83,898 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1461 nodes · 2518 edges · 156 communities (134 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `95b3a0f6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 133|Community 133]]
- [[_COMMUNITY_Community 134|Community 134]]
- [[_COMMUNITY_Community 144|Community 144]]
- [[_COMMUNITY_Community 145|Community 145]]
- [[_COMMUNITY_Community 150|Community 150]]
- [[_COMMUNITY_Community 151|Community 151]]
- [[_COMMUNITY_Community 152|Community 152]]

## God Nodes (most connected - your core abstractions)
1. `Room` - 41 edges
2. `createComponentLogger()` - 24 edges
3. `RoomView` - 23 edges
4. `ServerToClientEvents` - 22 edges
5. `ClientToServerEvents` - 21 edges
6. `setSocketIndex()` - 19 edges
7. `getSocketIndex()` - 19 edges
8. `readLoggingConfig()` - 17 edges
9. `scripts` - 17 edges
10. `createPlayer()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `useSocket()` --calls--> `io`  [INFERRED]
  games/imposter/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/scout/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/secret-signals/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `usePartySocket()` --calls--> `io`  [INFERRED]
  apps/platform/src/composables/usePartySocket.ts → apps/platform/server/index.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/blackout/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts

## Import Cycles
- None detected.

## Communities (156 total, 22 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (57): Player, PlayerView, Room, RoomView, RoundHistoryEntry, StoredSession, advanceTurn(), allOtherPlayersScouted() (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (48): Phase, Player, PlayerView, Room, RoomView, RoundHistoryEntry, RoundView, StoredSession (+40 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (38): Phase, Player, PlayerView, Room, RoomView, RoundResult, RoundView, StoredSession (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (34): parseBooleanEnv(), MetricsHttpConfig, metricsScrapeTotal, readBearerToken(), readMetricsAccessToken(), readMetricsHttpConfig(), registerMetricsRoutes(), incrementPartyLifecycle() (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (31): counts, db, dbLogger, finalCounts, hasColumn(), needsSchemaReset(), parseCsv(), readCsvRows() (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (15): app, router, actionMessage, autoRefresh, componentFilter, errorMessage, filteredLogs, kickingPlayerId (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (28): assignHost(), bindPlayerToSocket(), detachIndexedSocket(), verifyIsHost(), sendRoomToPlayer(), flipPlayerRow(), keepPlayerRow(), resetToLobby() (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (27): unregisterSocket(), getGame(), AdminJwtPayload, adminLogger, AdminPartyMemberView, authenticateAdmin(), checkRateLimit(), chooseNextHost() (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (6): socketIndex, socketIndex, socketIndex, socketIndex, socketIndex, Player

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (19): bindPlayerToSocket(), detachIndexedSocket(), HandlerMap, bindPlayerToSocket(), detachIndexedSocket(), verifyIsHost(), verifyPlayerInRoom(), broadcastRoom() (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (25): toLoggableError(), broadcastParty(), PartyClientToServerEvents, PartyServerToClientEvents, PartySocket, scheduleReturnCleanup(), ActivePartyMatch, ClearAllPartiesResult (+17 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (22): definition, GameDefinition, gameLogger, handler, register(), definition, GameDefinition, gameLogger (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (28): devDependencies, concurrently, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-vue, pinia (+20 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (27): dependencies, pinia, vue, vue-router, devDependencies, concurrently, socket.io-client, tsx (+19 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (14): HandlerMap, createPlayer(), deleteSocketIndexesForRoom(), setSocketIndex(), socketIndex, cleanupInterval, createRoom(), deleteRoom() (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (16): ClientToServerEvents, ServerToClientEvents, useGameStore, useGameStore, ClientToServerEvents, ServerToClientEvents, useGameStore, useGameStore (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.20
Nodes (20): cardPlayValues(), cardScoutValues(), closeSession(), confirmSetupKeep(), createParty(), createTwoPlayerScoutSession(), hostStartsFromLobby(), isMyTurn() (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (11): manifest, app, GameSocket, manifest, app, GameSocket, manifest, app (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (16): registerProcessLogging(), requestLogger, activeConnectionsGauge, initializeMetrics(), partiesActiveGauge, partyMembersConnectedGauge, roomPlayersConnectedGauge, roomsActiveGauge (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+10 more)

### Community 22 - "Community 22"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+10 more)

### Community 24 - "Community 24"
Cohesion: 0.25
Nodes (17): addWordToLibrary(), advanceDescriptionTurn(), allDescriptionsSubmitted(), allVotesSubmitted(), getConnectedPlayerOrder(), getDescriptionOrder(), getRandomDescriptionOrder(), selectRandomInfiltrators() (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (11): clearRoomCleanup(), createRoom(), generateRoomCode(), roomCleanupTimers, rooms, RoomStoreSnapshot, scheduleRoomCleanup(), sessionToRoom (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (14): makeIo(), makeNamespace(), getAllRooms(), clearAllParties(), createParty(), generateInviteCode(), PartyMatch, PartyMember (+6 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, format:check, lint, lint:fix, start (+9 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (10): cleanupInterval, clearRoomCleanup(), createRoom(), deleteRoom(), generateRoomCode(), rooms, RoomStoreSnapshot, roomTimers (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.23
Nodes (8): WORD_LIST, transitionToLobby(), transitionToPlaying(), generateBoard(), validateTeamSetup(), getActiveTeamColors(), getCardDistribution(), makePlayingRoom()

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (13): AutoJoinRoomData, AutoJoinRoomResponse, ClientToServerEvents, ErrorResponse, ServerToClientEvents, broadcastRoom(), sendRoomToPlayer(), toPlayerViews() (+5 more)

### Community 31 - "Community 31"
Cohesion: 0.19
Nodes (13): GameSocket, verifyPlayer(), cleanupMatch(), clearDiscussionTimer(), clearGuessTimer(), clearRoomTimers(), discussionTimers, guessTimers (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (9): cleanupInterval, clearRoomCleanup(), createRoom(), deleteRoom(), generateRoomCode(), rooms, roomTimers, scheduleRoomCleanup() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (9): clearRoomCleanup(), createRoom(), deleteRoom(), generateRoomCode(), roomCleanupTimers, rooms, RoomStoreSnapshot, scheduleRoomCleanup() (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.14
Nodes (13): compilerOptions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution, target (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (13): compilerOptions, baseUrl, module, moduleResolution, outDir, paths, target, extends (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.21
Nodes (8): allProjects, blackoutProject, flip7Project, GAMES_ROOT, imposterProject, platformProject, scoutProject, secretSignalsProject

### Community 37 - "Community 37"
Cohesion: 0.19
Nodes (10): PartyClientToServerEvents, PartyServerToClientEvents, PartySocket, usePartySocket(), PartyMatchView, PartyMemberView, PartyStatus, PartyView (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.21
Nodes (11): BlackoutSocket, Flip7Socket, normalizeNamespace(), resolveSocketUrl(), useSocket(), normalizeNamespace(), resolveSocketUrl(), useSocket() (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.23
Nodes (6): GameSocket, attachSocketEventDebugLogging(), createSocketLogger(), readSocketString(), SocketLike, summarizeSocketArg()

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (7): args, dataRows, db, headers, raw, rows, schemaSql

### Community 42 - "Community 42"
Cohesion: 0.17
Nodes (7): definition, gameLogger, handler, definition, gameLogger, handler, getSessionRoom()

### Community 43 - "Community 43"
Cohesion: 0.20
Nodes (9): CARD_HEX_BY_TYPE, ASSASSIN_PENALTY_MODES, getMinimumPlayersForTeamCount(), LEGACY_CARD_DISTRIBUTION, TEAM_COLORS, TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR, TEAM_TEXT_HEX_BY_COLOR (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.17
Nodes (11): Phase, Player, PlayerView, Room, RoomView, StoredSession, FocusMarker, LogEntry (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.30
Nodes (9): advanceToNextTeam(), checkWinCondition(), clearFocusedCard(), clearFocusedCardAtIndex(), giveSignal(), GuessResult, outcomeToEndReason(), processGuess() (+1 more)

### Community 46 - "Community 46"
Cohesion: 0.20
Nodes (8): activeTeams, currentPlayer, currentPlayerTeam, isDirectorUnavailable(), isSetupValid, teamCountOptions, teamPlayers(), unassigned

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (8): findCurrentTurnPage(), playFullRound(), setupThreePlayers(), submitDescription(), submitDescriptionsInTurnOrder(), createParty(), joinParty(), launchGame()

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (9): broadcastRoom(), sendRoomToPlayer(), toPlayerViews(), toRoomView(), ScoutNamespace, toPlayerViews(), toRoomView(), toTrickView() (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.18
Nodes (10): engines, node, pnpm, name, overrides, diff, esbuild, packageManager (+2 more)

### Community 50 - "Community 50"
Cohesion: 0.18
Nodes (11): dependencies, bcryptjs, better-sqlite3, cookie-parser, express, jsonwebtoken, nanoid, pino (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, noEmit, resolveJsonModule, types, exclude, extends (+1 more)

### Community 52 - "Community 52"
Cohesion: 0.28
Nodes (5): DEFAULT_WORD_LIBRARY, getGlobalWordLibrary(), loadFromFile(), persistWord(), WORDS_FILE

### Community 53 - "Community 53"
Cohesion: 0.22
Nodes (8): dbPath, __dirname, __filename, gameDir, legacySeedPath, sourceDir, targetDir, workspaceRoot

### Community 54 - "Community 54"
Cohesion: 0.25
Nodes (7): canStay, currentTurnPlayerName, playerMap, round, showFlipThreePrompt, showHitStay, store

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (7): Phase, Player, PlayerView, Room, RoomView, RoundResult, StoredSession

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (7): AutoJoinRoomData, AutoJoinRoomResponse, ClientToServerEvents, ErrorResponse, ServerToClientEvents, BasicResponse, ScoutActionPayload

### Community 57 - "Community 57"
Cohesion: 0.36
Nodes (7): getParty(), connectSocket(), createNamespace(), createPartyViaSocket(), createSocket(), Handler, setup()

### Community 58 - "Community 58"
Cohesion: 0.25
Nodes (7): blackoutModule, flip7Module, gameRegistry, GameServerModule, imposterModule, scoutModule, secretSignalsModule

### Community 59 - "Community 59"
Cohesion: 0.25
Nodes (7): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, skipLibCheck, strict, target

### Community 60 - "Community 60"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (4): confirmCard, leftRosterTeams, rightRosterTeams, rosterTeams

### Community 62 - "Community 62"
Cohesion: 0.52
Nodes (6): chooseRole(), chooseTeam(), setupFourPlayers(), createParty(), joinParty(), launchGame()

### Community 63 - "Community 63"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 64 - "Community 64"
Cohesion: 0.48
Nodes (6): broadcastRoom(), sendRoomToPlayer(), toPlayerView(), toRoomView(), toRoundView(), BlackoutNamespace

### Community 65 - "Community 65"
Cohesion: 0.48
Nodes (4): addPoint(), getLeaderboard(), getWinners(), resetScores()

### Community 66 - "Community 66"
Cohesion: 0.38
Nodes (4): transitionToLobby(), resetForLobby(), resetForNewRound(), transitionToNextRound()

### Community 67 - "Community 67"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 68 - "Community 68"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 69 - "Community 69"
Cohesion: 0.29
Nodes (6): name, private, scripts, test, type, version

### Community 70 - "Community 70"
Cohesion: 0.33
Nodes (5): canSkip, isCategoryReused, isReader, selectablePlayers, taskText

### Community 71 - "Community 71"
Cohesion: 0.53
Nodes (5): broadcastRoom(), GameNamespace, sendRoomToPlayer(), toPlayerView(), toRoomViewForPlayer()

### Community 72 - "Community 72"
Cohesion: 0.53
Nodes (5): ClientToServerEvents, ServerToClientEvents, AssassinPenaltyMode, PlayerRole, TeamColor

### Community 73 - "Community 73"
Cohesion: 0.53
Nodes (6): finalizeRound(), getVotedOutIds(), handleInfiltratorGuess(), isMatchOver(), resolveVotes(), skipGuess()

### Community 74 - "Community 74"
Cohesion: 0.40
Nodes (3): currentDescriber, isMyTurn, wasSkipped

### Community 75 - "Community 75"
Cohesion: 0.40
Nodes (4): showControls, sortedPlayers, store, winners

### Community 77 - "Community 77"
Cohesion: 0.40
Nodes (3): error, number, word

### Community 78 - "Community 78"
Cohesion: 0.60
Nodes (4): ScoutSocket, normalizeNamespace(), resolveSocketUrl(), useSocket()

### Community 81 - "Community 81"
Cohesion: 0.40
Nodes (3): clientGameRegistry, PlatformGameMeta, PlatformGameModule

### Community 82 - "Community 82"
Cohesion: 0.60
Nodes (4): broadcastRoom(), GameNamespace, sendRoomToPlayer(), toRoomView()

### Community 83 - "Community 83"
Cohesion: 0.70
Nodes (4): findNearestEnvFile(), loadLocalEnvFile(), parseEnvFile(), stripOptionalQuotes()

### Community 84 - "Community 84"
Cohesion: 0.50
Nodes (3): accentClasses, cardSubtext, cardText

### Community 85 - "Community 85"
Cohesion: 0.50
Nodes (3): canStart, connectedCount, isHost

### Community 86 - "Community 86"
Cohesion: 0.83
Nodes (3): parseExcludedLetters(), saveExcludedLetters(), updateLanguage()

### Community 89 - "Community 89"
Cohesion: 0.50
Nodes (3): PLAYER_ID, RESUME_TOKEN, ROOM_CODE

### Community 91 - "Community 91"
Cohesion: 0.50
Nodes (3): PLAYER_ID, RESUME_TOKEN, ROOM_CODE

### Community 92 - "Community 92"
Cohesion: 0.50
Nodes (3): Database, DatabaseConstructor, Statement

## Knowledge Gaps
- **555 isolated node(s):** `Handler`, `name`, `version`, `private`, `dev` (+550 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createComponentLogger()` connect `Community 11` to `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 40`, `Community 9`, `Community 42`, `Community 10`, `Community 18`, `Community 31`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `Room` connect `Community 39` to `Community 0`, `Community 1`, `Community 2`, `Community 6`, `Community 9`, `Community 14`, `Community 15`, `Community 24`, `Community 25`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 40`, `Community 45`, `Community 48`, `Community 52`, `Community 64`, `Community 65`, `Community 66`, `Community 71`, `Community 82`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `io` connect `Community 38` to `Community 18`, `Community 37`, `Community 78`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `createComponentLogger()` (e.g. with `registerGame()` and `registerGame()`) actually correct?**
  _`createComponentLogger()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Handler`, `name`, `version` to the rest of the system?**
  _555 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06874717322478517 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06284153005464481 - nodes in this community are weakly interconnected._