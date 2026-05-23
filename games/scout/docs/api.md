# Scout Socket API

Namespace: `/g/scout`

Client events: `autoJoinRoom`, `startGame`, `flipRow`, `playCards`, `pass`, `playAgain`, `requestState`.

Server events: `roomUpdate` with a personalized `RoomView`; only the recipient receives their own row cards. Opponent rows expose counts only.

Operational notes: lifecycle logs cover room creation, join/resume, start, setup choice, play/pass, game end, cleanup. Logs must never include resume tokens, invite codes, or hidden opponent row values.
