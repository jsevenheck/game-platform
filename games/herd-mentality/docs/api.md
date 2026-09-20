# Herd Mentality API

Namespace: `/g/herd-mentality`

## Client → Server

Alle Aktionen antworten per Ack mit `{ ok: true }` oder `{ ok: false, error }`.
Der Server autorisiert jede Aktion anhand der Plattform-Party und der Socket-
Handshake-Daten. `playerId`, `name` und `isHost` aus der UI sind keine
Vertrauensquelle.

- `autoJoinRoom({ sessionId, playerId?, joinToken?, resumeToken? })`
  registriert oder verbindet eine Party-Mitgliedschaft. Erfolgreich werden
  `roomCode`, `playerId` und ein privater `resumeToken` zurückgegeben.
- `startGame({ roomCode })` — nur der autoritative Host, nur in `lobby`.
- `submitAnswer({ roomCode, answer })` — eine nichtleere Antwort mit maximal
  80 Zeichen, nur einmal pro Spieler und Runde.
- `revealAnswers({ roomCode })` — nur der Host, nur in `allSubmitted`.
- `nextRound({ roomCode })` — nur der Host, nur in `reveal`.
- `restartGame({ roomCode })` — nur der Host, nur in `ended`.
- `syncAuthority({ roomCode })` — aktualisiert Host- und Raumstatus.

## Server → Client

- `roomUpdate(RoomView)` wird nach jedem Zustandswechsel gesendet.
- `phaseChange({ phase })` begleitet jedes `roomUpdate`.
- `error({ message })` signalisiert einen nicht erfolgreichen Transport- oder
  Aktionsversuch.

## Datenschutz im Wire-State

Während `answering` und `allSubmitted` ist `RoomView.answers` immer leer und
`result` ist `null`. Öffentlich sind nur Spielernamen, Verbindungsstatus und
`hasSubmitted`. Erst in `reveal` oder `ended` werden Antworten, normalisierte
Gruppen, Gruppengrößen und der Punktestand veröffentlicht. `resumeToken` wird
niemals in `RoomView` oder Logs übertragen.

## RoomView

```ts
interface RoomView {
  roomCode: string;
  phase: 'lobby' | 'answering' | 'allSubmitted' | 'reveal' | 'ended';
  currentRound: number;
  totalRounds: number;
  prompt: { id: string; text: string } | null;
  players: PlayerView[];
  answers: { playerId: string; answer: string }[];
  result: {
    groups: { answer: string; playerIds: string[]; playerNames: string[]; count: number }[];
    unmatchedPlayerIds: string[];
    pinkCowPlayerId: string | null;
    winnerIds: string[];
  } | null;
  scores: { playerId: string; name: string; cows: number; hasPinkCow: boolean }[];
}
```
