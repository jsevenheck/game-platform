# Regel-Audit der bestehenden Spiele

## Umfang

Dieser Audit vergleicht die implementierten Regelkerne, State-Machines, Scoring-Pfade,
Privacy-Grenzen und vorhandenen Regressionstests. Bei erkennbaren Adaptionen wurden
Publisher-Regeln oder offizielle Regelblätter als Referenz verwendet. Das ist keine
juristische Marken- oder Copyright-Bewertung.

## Ergebnisübersicht

| Spiel          | Einordnung                                   | Ergebnis                  | Finding                               |
| -------------- | -------------------------------------------- | ------------------------- | ------------------------------------- |
| Flip 7         | Regelnahe Adaption von The Op                | Regelkern konsistent      | Keine bestätigte Abweichung           |
| Scout          | Regelnahe Adaption von Oink Games            | Regelkern konsistent      | Keine bestätigte Abweichung           |
| Herd Mentality | Regelnahe Adaption von Big Potato            | Korrigiert                | Mehrheitstie, Pink Cow und Tiebreaker |
| Secret Signals | Eigenständige Codenames-inspirierte Variante | Dokumentierte Variante    | Keine bestätigte Abweichung           |
| Blackout       | Eigenständiges Plattformspiel                | Gegen eigene Doku geprüft | Keine bestätigte Abweichung           |
| Imposter       | Eigenständige Social-Deduction-Variante      | Gegen eigene Doku geprüft | Keine bestätigte Abweichung           |
| Estimate       | Eigenständiges Schätzspiel                   | Gegen eigene Doku geprüft | Keine bestätigte Abweichung           |
| Kritzelagent   | Eigenständiges Zeichen-/Deduktionsspiel      | Gegen eigene Doku geprüft | Keine bestätigte Abweichung           |

## Quellen und Prüfpunkte

### Flip 7

Quelle: [The Op – Flip 7](https://theop.games/products/flip-7) und
[The Op – Flip 7 FAQs](https://theop.games/pages/flip-7-faqs).

Geprüft wurden 94-Karten-Deck, 3+ Spieler, Zielwert 200, doppelte Nummern als Bust,
Flip-7-Bonus, Reihenfolge der Score-Modifikatoren, Self-Targeting von Action Cards,
Flip Three, Second Chance und das sofortige Rundenende. Die Implementierung enthält
Regressionstests für Deckgröße, Scoring, Action-Targets, Second Chance und Flip 7.

### Scout

Quelle: [Oink Games – Scout](https://oinkgames.com/en/games/analog/scout).

Geprüft wurden doppelseitige 45 Karten, Spielerzahl 2–5, Spielerzahl-spezifische
Deckauswahl und Handgrößen, feste Reihenfolge der Karten, Set-vor-Run bei gleicher
Kartenzahl, Scout/Scout & Show, Rundenrotation und Scoring mit Handkartenstrafe.
Die Implementierung enthält Regressionstests für diese Kernregeln sowie für
Reconnect-/Disconnect-Fälle.

### Herd Mentality

Quellen: [Big Potato – How to Play](https://bigpotato.co.uk/blogs/how-to-play/herd-mentality)
und [offizielles Regelblatt](https://c.tabletopia.com/games/herd-mentality/rules/hm-usa-rules-4-mar-2020/en).

Behobene Findings:

- Bei einem Gleichstand der häufigsten Antworten wurden zuvor mehrere Gruppen
  gleichzeitig mit Kühen belohnt. Jetzt gibt es bei einem Mehrheitstie keine Kühe.
- Eine einzelne Antwort wurde zuvor bei einem Mehrheitstie fälschlich mit der Pink Cow
  belegt. Die Pink Cow wird jetzt nur bei einer eindeutigen Mehrheit und genau einem
  einzelnen Außenseiter vergeben.
- Der offizielle Tiebreaker fehlte. Der Raum führt jetzt ein dynamisches Kuhziel; wenn
  mehrere nicht-Pink-Spieler das aktuelle Ziel in derselben Runde erreichen, wird das
  Ziel um eine Kuh erhöht.
- Die Reveal-UI markiert jetzt nur die eindeutige Mehrheitsgruppe als punktend.

Die Plattformvariante verwendet weiterhin einen konfigurierten Fragenvorrat und eine
begrenzte Matchlänge. Diese Abweichung ist in der Spiel-README dokumentiert.

### Secret Signals

Quelle für den Mechanikvergleich: [Asmodee – Codenames Rules](https://www.asmodee.co.uk/blogs/news/codenames-rules).

Die Überschneidungen liegen bei 5×5-Board, Teamrollen, Ein-Wort-Hinweis plus Zahl,
Zusatzversuch, Neutral-/Gegnerkarte und Assassin. Secret Signals ist jedoch ausdrücklich
eine eigene Variante: 2–4 Teams, eigene Wortbibliothek, wechselnder Start, eine
konfigurierbare Assassin-Strafe und Mehrteam-Elimination. Diese Unterschiede sind in
der README festgehalten; sie wurden nicht als Implementierungsfehler behandelt.

### Blackout, Imposter, Estimate und Kritzelagent

Für diese vier Spiele wurde keine eindeutige offizielle Vorlage im Repository oder in
der Spiel-Dokumentation identifiziert. Sie wurden deshalb gegen ihre eigenen README-,
Core- und Server-Verträge geprüft:

- Blackout: Prompt-Reveal, optionale Buchstabenbedingung, Host-/Reader-Wechsel,
  Gewinnerpunkt und Rundenende.
- Imposter: geheime Rollen, sequenzielle Hinweise, Voting-Tie, letzte Wortschätzung
  und Score-Verteilung.
- Estimate: geheime Schätzwerte bis zur vollständigen Abgabe, absolute Distanz,
  geteilte Siege und +1 pro Gewinner.
- Kritzelagent: private Rollen-/Themenzuweisung, zwei Zeichenrunden pro Person,
  Voting-Tie, Guess-Phase, Disconnect-Quorum und Score-Deltas.

In diesen vier Regelkernen wurde kein bestätigter Fehler gefunden.

## Verifikation

Nach der Korrektur müssen die allgemeinen und spielbezogenen Tests, Typecheck, Lint,
Build, E2E und Diff-Checks erfolgreich sein. Ein Produktions-/Live-Multiplayer-Audit
gegen externe Provider oder reale Endgeräte ist davon getrennt und wird nicht als lokal
verifiziert ausgegeben.
