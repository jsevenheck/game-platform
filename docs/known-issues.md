# Bekannte Einschränkungen

## Scout: 2-Spieler-Regeln

**Betroffen:** Scout bei genau zwei Spielern

**Aktuelles Verhalten:** Die Implementierung verwendet in diesem Modus drei
Scout-&-Show-Chips und kann eine Runde beenden, sobald der Gegner den aktuellen Satz
scoutet. Der offizielle 2-Spieler-Modus sieht drei Scout-Chips, keinen Scout-&-Show-Vorrat,
einen Reservestapel und eine eigene Zugfolge vor.

**Status:** Bekannte Regelabweichung. Siehe auch [Regel-Audit](rules-audit.md).

**Workaround:** Scout derzeit mit mindestens drei Spielern spielen, wenn die offizielle
2-Spieler-Regel nicht bewusst als Variante akzeptiert werden soll.

## Admin-Kick während eines aktiven Matches

**Betroffen:** Admin-Konsole und alle integrierten Spiele

**Aktuelles Verhalten:** Wenn ein Admin einen Spieler während eines aktiven Matches kickt,
beendet und bereinigt die Plattform das Match, bringt die übrigen Party-Mitglieder zurück in
die Lobby und entfernt anschließend den gekickten Spieler aus der Party.

**Grund:** Der Game-Server-Vertrag bietet `cleanupMatch(matchKey)`, aber keine generische,
sichere Operation zum Entfernen eines einzelnen Spielers aus einem laufenden Match. Jedes
Spiel besitzt eigene Zugreihenfolge, Karten, Scores, Hidden State, Host-Zuordnung und
Reconnect-Logik.

**Workaround:** Den Admin-Kick in einem aktiven Match als „Kick und Match beenden“ behandeln.
Wenn die übrigen Spieler weiterspielen sollen, starten sie aus der Lobby ein neues Match.
