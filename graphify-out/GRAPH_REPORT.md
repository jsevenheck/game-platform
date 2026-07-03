# Graph Report - game-platform  (2026-07-03)

## Corpus Check
- 253 files · ~95,249 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1571 nodes · 2762 edges · 167 communities (140 shown, 27 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0764d60c`
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
- [[_COMMUNITY_Community 156|Community 156]]
- [[_COMMUNITY_Community 157|Community 157]]
- [[_COMMUNITY_Community 159|Community 159]]
- [[_COMMUNITY_Community 166|Community 166]]

## God Nodes (most connected - your core abstractions)
1. `Room` - 41 edges
2. `createComponentLogger()` - 25 edges
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
  games/secret-signals/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/blackout/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/flip7/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts
- `useSocket()` --calls--> `io`  [INFERRED]
  games/scout/ui-vue/src/composables/useSocket.ts → apps/platform/server/index.ts

## Import Cycles
- None detected.

## Communities (167 total, 27 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (49): broadcastRoom(), sendRoomToPlayer(), toPlayerViews(), toRoomView(), ScoutNamespace, toTrickView(), advanceTurn(), allOtherPlayersScouted() (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (49): Phase, Player, PlayerView, Room, RoomView, RoundHistoryEntry, RoundView, StoredSession (+41 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (38): Phase, Player, PlayerView, Room, RoomView, RoundResult, RoundView, StoredSession (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (25): parseBooleanEnv(), MetricsHttpConfig, metricsScrapeTotal, readBearerToken(), readMetricsAccessToken(), readMetricsHttpConfig(), registerMetricsRoutes(), incrementPartyLifecycle() (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (11): counts, db, dbLogger, finalCounts, hasColumn(), needsSchemaReset(), parseCsv(), readCsvRows() (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (16): app, router, actionMessage, autoRefresh, componentFilter, errorMessage, filteredLogs, kickingPlayerId (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (29): assignHost(), bindPlayerToSocket(), detachIndexedSocket(), verifyIsHost(), flipPlayerRow(), keepPlayerRow(), resetToLobby(), getRoomSession() (+21 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (31): BufferedLogEntry, getRecentLogs(), logBuffer, clearMatchTimeout(), scheduleMatchTimeout(), unregisterSocket(), AdminJwtPayload, adminLogger (+23 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (3): socketIndex, socketIndex, Player

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (23): bindPlayerToSocket(), detachIndexedSocket(), GameSocket, attachSocketEventDebugLogging(), createSocketLogger(), readSocketString(), SocketLike, recordSocketEventEnd() (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (15): ActivePartyMatch, ClearAllPartiesResult, clearPartyCleanup(), deleteParty(), getActivePartyMatches(), getPartyBySocket(), inviteCodeToParty, matchTimeoutTimers (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (47): definition, GameDefinition, gameLogger, handler, register(), definition, GameDefinition, gameLogger (+39 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (28): devDependencies, concurrently, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-vue, pinia (+20 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (27): dependencies, pinia, vue, vue-router, devDependencies, concurrently, socket.io-client, tsx (+19 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (15): HandlerMap, HandlerMap, createPlayer(), deleteSocketIndexesForRoom(), setSocketIndex(), socketIndex, cleanupInterval, createRoom() (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (11): bindPlayerToSocket(), detachIndexedSocket(), verifyIsHost(), verifyPlayerInRoom(), deleteSocketIndex(), getSocketIndex(), getRoom(), bindPlayerToSocket() (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.20
Nodes (20): cardPlayValues(), cardScoutValues(), closeSession(), confirmSetupKeep(), createParty(), createTwoPlayerScoutSession(), hostStartsFromLobby(), isMyTurn() (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (23): manifest, app, broadcastRoom(), GameNamespace, sendRoomToPlayer(), toPlayerView(), GameSocket, manifest (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (21): registerProcessLogging(), activeConnectionsGauge, initializeMetrics(), partiesActiveGauge, partyMembersConnectedGauge, publicLobbiesGauge, roomPlayersConnectedGauge, roomsActiveGauge (+13 more)

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
Cohesion: 0.05
Nodes (61): GameSocket, verifyPlayer(), cleanupMatch(), transitionToLobby(), clearRoomCleanup(), createRoom(), generateRoomCode(), roomCleanupTimers (+53 more)

### Community 25 - "Community 25"
Cohesion: 0.10
Nodes (29): toLoggableError(), broadcastParty(), broadcastPartyAndLobbies(), joinableListPruneInterval, joinableListRateLimit, JoinableListResponse, partyActionPruneInterval, partyActionRateLimit (+21 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (14): autoJoin(), makeIo(), makeNamespace(), setupParty(), getAllRooms(), clearAllParties(), createParty(), generateInviteCode() (+6 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, format:check, lint, lint:fix, start (+9 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (10): cleanupInterval, clearRoomCleanup(), createRoom(), deleteRoom(), generateRoomCode(), rooms, RoomStoreSnapshot, roomTimers (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (10): Phase, Player, PlayerView, Room, RoomView, StoredSession, FocusMarker, LogEntry (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.39
Nodes (7): broadcastRoom(), sendRoomToPlayer(), toPlayerViews(), toRoomView(), toRoundView(), broadcastActionResolved(), Flip7Namespace

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (6): useGameStore, useGameStore, useGameStore, StoredSession, ActionAnnouncement, DrawnCardInfo

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (10): cleanupInterval, clearRoomCleanup(), createRoom(), deleteRoom(), generateRoomCode(), rooms, RoomStoreSnapshot, roomTimers (+2 more)

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
Cohesion: 0.07
Nodes (33): readStr(), useHomePartyActions(), JoinableListResponse, PartyClientToServerEvents, PartyServerToClientEvents, PartySocket, SetPartyPublicResponse, usePartySocket() (+25 more)

### Community 38 - "Community 38"
Cohesion: 0.70
Nodes (4): findNearestEnvFile(), loadLocalEnvFile(), parseEnvFile(), stripOptionalQuotes()

### Community 40 - "Community 40"
Cohesion: 0.33
Nodes (5): getParty(), registerAdminRoutes(), HttpResponse, login(), request()

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (7): args, dataRows, db, headers, raw, rows, schemaSql

### Community 42 - "Community 42"
Cohesion: 0.21
Nodes (15): assignHost(), AuthorizePartyJoinFailure, AuthorizePartyJoinResult, AuthorizePartyJoinSuccess, clearHost(), GameRoomLike, isConnectedPlayer(), restoreHostToFirstConnectedPlayer() (+7 more)

### Community 43 - "Community 43"
Cohesion: 0.16
Nodes (16): Player, PlayerView, Room, RoomView, RoundHistoryEntry, StoredSession, PlayKind, ScoutCard (+8 more)

### Community 44 - "Community 44"
Cohesion: 0.19
Nodes (10): WORD_LIST, transitionToLobby(), transitionToPlaying(), generateBoard(), validateTeamSetup(), getActiveTeamColors(), getCardDistribution(), CardType (+2 more)

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
Cohesion: 0.53
Nodes (5): ClientToServerEvents, ServerToClientEvents, AssassinPenaltyMode, PlayerRole, TeamColor

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
Cohesion: 0.24
Nodes (7): CARD_HEX_BY_TYPE, ASSASSIN_PENALTY_MODES, LEGACY_CARD_DISTRIBUTION, TEAM_COLORS, TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR, TEAM_TEXT_HEX_BY_COLOR

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
Cohesion: 0.29
Nodes (6): AutoJoinRoomData, AutoJoinRoomResponse, ClientToServerEvents, ErrorResponse, ServerToClientEvents, ScoutActionPayload

### Community 57 - "Community 57"
Cohesion: 0.27
Nodes (8): resetPartyActionRateLimit(), getPartyByInviteCode(), connectSocket(), createNamespace(), createPartyViaSocket(), createSocket(), Handler, setup()

### Community 58 - "Community 58"
Cohesion: 0.70
Nodes (4): broadcastRoom(), sendRoomToPlayer(), toPlayerViews(), toRoomView()

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
Cohesion: 0.23
Nodes (9): HOME_TABS, HomeTab, HomeTabId, normalizeHomeTab(), readStoredTab(), resolveInitialHomeTab(), useHomeTabs(), VALID_TABS (+1 more)

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
Cohesion: 0.29
Nodes (6): AutoJoinRoomData, AutoJoinRoomResponse, ClientToServerEvents, ErrorResponse, ServerToClientEvents, ActionResolvedEvent

### Community 74 - "Community 74"
Cohesion: 0.40
Nodes (3): currentDescriber, isMyTurn, wasSkipped

### Community 75 - "Community 75"
Cohesion: 0.40
Nodes (4): showControls, sortedPlayers, store, winners

### Community 77 - "Community 77"
Cohesion: 0.40
Nodes (3): error, number, word

### Community 81 - "Community 81"
Cohesion: 0.40
Nodes (3): clientGameRegistry, PlatformGameMeta, PlatformGameModule

### Community 82 - "Community 82"
Cohesion: 0.39
Nodes (6): activate(), focusedIndex, focusPanelFirstControl(), moveFocus(), onKeydown(), tabId()

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

### Community 156 - "Community 156"
Cohesion: 0.50
Nodes (3): useGameStore, getMinimumPlayersForTeamCount(), CardView

## Knowledge Gaps
- **584 isolated node(s):** `HttpResponse`, `routerReplace`, `Handler`, `gameNames`, `name` (+579 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createComponentLogger()` connect `Community 11` to `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 9`, `Community 18`, `Community 24`, `Community 25`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `Room` connect `Community 24` to `Community 0`, `Community 1`, `Community 2`, `Community 6`, `Community 9`, `Community 14`, `Community 17`, `Community 28`, `Community 30`, `Community 32`, `Community 33`, `Community 39`, `Community 43`, `Community 44`, `Community 45`, `Community 58`, `Community 64`, `Community 65`, `Community 90`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `io` connect `Community 37` to `Community 18`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `createComponentLogger()` (e.g. with `registerGame()` and `registerGame()`) actually correct?**
  _`createComponentLogger()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `HttpResponse`, `routerReplace`, `Handler` to the rest of the system?**
  _584 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07890122735242548 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06187202538339503 - nodes in this community are weakly interconnected._