# Regel-Audit der bestehenden Spiele

## Umfang

Dieser Audit beschreibt den aktuellen Regelstand der acht integrierten Spiele. Er trennt
regelnahe Adaptionen von eigenständigen Plattformvarianten und kennzeichnet bekannte
Abweichungen ausdrücklich. Das ist keine juristische Marken- oder Copyright-Bewertung.

## Ergebnisübersicht

| Spiel          | Einordnung                                   | Aktueller Status                                    |
| -------------- | -------------------------------------------- | --------------------------------------------------- |
| Flip 7         | Regelnahe Adaption von The Op                | Regelnahe Umsetzung; Deck-/Kartenfluss dokumentiert |
| Scout          | Regelnahe Adaption von Oink Games            | 2-Spieler-Modus weicht vom offiziellen Modus ab     |
| Herd Mentality | Regelnahe Adaption von Big Potato            | Gleichstand und Tiebreaker implementiert            |
| Secret Signals | Eigenständige Codenames-inspirierte Variante | Bewusste Plattformvariante                          |
| Blackout       | Eigenständiges Plattformspiel                | Gegen eigene Spiel-Dokumentation                    |
| Imposter       | Eigenständige Social-Deduction-Variante      | Maximal ein Infiltrator unterstützt                 |
| Estimate       | Eigenständiges Schätzspiel                   | Gegen eigene Spiel-Dokumentation                    |
| Kritzelagent   | Eigenständiges Zeichen-/Deduktionsspiel      | Gegen eigene Spiel-Dokumentation                    |

## Quellen und Prüfpunkte

### Flip 7

Quellen: [The Op – Flip 7](https://theop.games/products/flip-7) und
[The Op – Flip 7 FAQs](https://theop.games/pages/flip-7-faqs).

Die Umsetzung verwendet das 94-Karten-Deck, 3–18 Spieler, das Ziel von 200 Punkten,
doppelte Nummern als Bust, Flip 7, Modifier, Freeze, Flip Three und Second Chance.
Der Kartenfluss folgt dabei diesen Regeln:

- Die erste Runde startet mit einem gemischten Deck. In späteren Runden wird der
  verbleibende Stapel weitergereicht; die Karten der abgeschlossenen Runde werden nicht
  vollständig zurückgemischt.
- Ist der Nachziehstapel leer, werden nur eligible Karten aus dem Ablagestapel gemischt.
  Karten vor Spielern — auch vor bereits gebusteten Spielern — bleiben außerhalb des
  Nachziehstapels.
- Zurückgestellte Action-Karten werden bei Bust oder Flip 7 in den Ablagestapel gelegt.
- Wenn während der Startausteilung alle Spieler eingefroren sind, wird die Runde beendet,
  statt in einer nicht spielbaren Phase zu verbleiben.

Diese Sonderfälle sind durch Servertests abgedeckt. Die Plattformvariante verwendet ein
festes Ziel von 200 Punkten.

### Scout

Quelle: [Oink Games – Scout](https://oinkgames.com/en/games/analog/scout).

Spielerzahl, doppelseitige Karten, Spielerzahl-spezifische Deckauswahl, Handgrößen,
Reihenfolge der Karten, Set-vor-Run bei gleicher Kartenzahl, Scout/Scout & Show,
Rundenrotation und Scoring mit Handkartenstrafe sind im Code dokumentiert und getestet.

**Bekannte Abweichung: 2-Spieler-Modus.** Die aktuelle Implementierung startet bei zwei
Spielern mit drei Scout-&-Show-Chips und keinem Scout-Chip. Außerdem kann das Scouts eines
Gegners die Runde unmittelbar beenden. Der offizielle 2-Spieler-Modus verwendet dagegen
drei Scout-Chips, keinen Scout-&-Show-Vorrat, einen Reservestapel und eine eigene Zugfolge.
Der Modus sollte daher bis zu einer Regelkorrektur als abweichende Variante betrachtet
werden und nicht als vollständige offizielle Umsetzung beworben werden.

### Herd Mentality

Quellen: [Big Potato – How to Play](https://bigpotato.co.uk/blogs/how-to-play/herd-mentality)
und [offizielles Regelblatt](https://c.tabletopia.com/games/herd-mentality/rules/hm-usa-rules-4-mar-2020/en).

Die digitale Variante vergibt Kühe nur an eine eindeutige häufigste Antwort. Bei einem
Gleichstand der häufigsten Antworten gibt es keine Kühe und keine Pink Cow. Eine einzelne
Antwort außerhalb einer eindeutigen Mehrheit erhält die Pink Cow. Erreichen mehrere
Spieler das aktuelle Kuhziel in derselben Runde, wird das Ziel gemäß dem Tiebreaker um eine
Kuh erhöht.

Die Plattformvariante verwendet einen konfigurierten Fragenvorrat und eine begrenzte
Matchlänge. Antworten werden deterministisch normalisiert (NFKC, Trim, Leerraum und
Kleinschreibung); semantische Synonyme werden nicht automatisch erkannt.

### Secret Signals

Quelle für den Mechanikvergleich: [Asmodee – Codenames Rules](https://www.asmodee.co.uk/blogs/news/codenames-rules).

Secret Signals ist ausdrücklich eine eigene Variante: 2–4 Teams, ein 5×5-Board, eine
mehrsprachige Wortliste, wechselnder Start, konfigurierbare Assassin-Strafe und
Mehrteam-Elimination. Diese Unterschiede sind Spielregeln der Plattformvariante und keine
unbeabsichtigten Regelabweichungen.

### Imposter

Imposter ist eine eigenständige Social-Deduction-Variante. Das Spiel unterstützt aktuell
null oder einen Infiltrator. Mehrere Infiltratoren sind absichtlich deaktiviert, weil die
aktuelle Rundenauflösung nur einen gefangenen Infiltrator pro Runde verfolgt und sonst kein
verlässlicher ziviler Sieg garantiert werden kann.

### Blackout, Estimate und Kritzelagent

Für diese Spiele wurde keine eindeutige externe Vorlage als verbindlicher Regelstandard
festgelegt. Sie werden gegen ihre eigenen README-, Core- und Server-Verträge geprüft:

- **Blackout:** Prompt-Reveal, optionale Buchstabenbedingung, Host-/Reader-Wechsel,
  Gewinnerpunkt und Rundenende.
- **Estimate:** geheime Schätzwerte bis zur vollständigen Abgabe, absolute Distanz,
  geteilte Siege und ein Punkt pro Gewinner.
- **Kritzelagent:** private Rollen-/Themenzuweisung, zwei Zeichenrunden pro Person,
  Voting, Guess-Phase, Disconnect-Quorum und Score-Deltas.

## Verifikation

Der Regelstatus ist von einer vollständigen Produktions-, Browser- und
Live-Multiplayer-Verifikation getrennt. Für Änderungen an Regelkern oder State-Machine
müssen mindestens die betroffenen Spieltests, `pnpm typecheck`,
`pnpm typecheck:games`, Lint, Build und die relevanten E2E-Szenarien ausgeführt werden.
Bei einer externen Regelreferenz soll die Quelle zusammen mit der Änderung aktualisiert
werden.
