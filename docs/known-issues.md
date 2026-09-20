# Bekannte Einschränkungen

## Plattform-Controls und Game-Overlays

**Betroffen:** integrierte Spiele, besonders Secret Signals auf Tablet/Desktop

**Aktuelles Verhalten:** Die Leave-/Language-Controls der Plattform liegen fest am oberen
Viewport-Rand und werden absichtlich über normalen Game-Overlays gestapelt. Der
Secret-Signals-Turn-Indikator beginnt bei größeren Breakpoints ebenfalls am oberen Rand;
der zusätzliche Abstand im Game-Shell gilt derzeit nur für schmale Mobile-Breiten. Das
Leave-Bestätigungsdialogfenster selbst hat jedoch einen niedrigeren z-Index als normale
Game-Overlays und kann dadurch hinter einem Game-Overlay liegen.

**Auswirkung:** Der aktuelle Turn-/Team-Status kann teilweise von den festen Controls
überdeckt werden. Ein bereits geöffnetes Leave-Bestätigungsdialogfenster kann in einem
Game-Overlay verschwinden.

**Status:** Bekannte UI-Einschränkung; noch nicht durch eine einheitliche Overlay- und
Header-Schichtung behoben.

**Empfohlene Lösung:** Einen gemeinsamen Plattform-Headerbereich an allen Breakpoints
reservieren und eine zentrale Overlay-Schichtung definieren, in der der Leave-Dialog über
Game-Overlays liegt. Danach Leave-Dialog, Game-Overlays und Secret-Signals-Status gemeinsam
per Browser-Smoke-Test prüfen.

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
