# Bekannte Einschränkungen

## Plattform-Controls und Game-Overlays

**Betroffen:** Secret Signals auf Tablet/Desktop

**Aktuelles Verhalten:** Die Plattform-Controls sind am oberen Viewport-Rand fixiert
und liegen mit `z-index: 10000` über dem Basislayer normaler Game-Overlays
(`.ui-overlay`, `z-index: 9999`). Der Leave-Bestätigungsdialog liegt darüber
(`z-index: 10001`). Der Secret-Signals-Turn-Indikator beginnt weiterhin am oberen Rand;
zusätzlicher Platz in der Game-Shell wird nur bei schmalen Viewports oder grobem Zeiger
reserviert.

**Auswirkung:** Bei größeren Viewports kann der feste Plattform-Header den aktuellen
Turn-/Team-Status teilweise überdecken. Der Leave-Bestätigungsdialog bleibt über normalen
Game-Overlays sichtbar.

**Status:** Die Overlay-Reihenfolge des Leave-Bestätigungsdialogs ist behoben. Die
Abstandskollision des Secret-Signals-Turn-Indikators an größeren Breakpoints bleibt
bekannt.

**Empfohlene Lösung:** Für Secret Signals an den betroffenen Breakpoints Platz unter dem
Plattform-Header reservieren. Danach Header, Turn-Indikator, Game-Overlays und Leave-Dialog
gemeinsam per Browser-Smoke-Test prüfen.

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
