# Herd Mentality – Architektur

## Zustandsmaschine

```text
lobby → answering → allSubmitted → reveal → answering
                                  └──────→ ended
```

`ended` wird erreicht, sobald ein Spieler acht Kühe ohne Pink Cow besitzt oder
wenn die letzte konfigurierte Runde aufgelöst wurde. Das Plattform-Overlay
reagiert auf `phaseChange: ended` und bietet Replay bzw. Rückkehr zur Party an.

## Verantwortlichkeiten

- `core/src/rules.ts`: reine Antwortnormalisierung, Gruppierung und Ermittlung
  der einzelnen abweichenden Antwort.
- `server/src/models/room.ts`: flüchtige Raum-, Spieler-, Socket- und
  Resume-Indexe.
- `server/src/managers/roundManager.ts`: Phasenübergänge, Antwortvalidierung,
  Kuh-/Pink-Cow-Verteilung und Gewinnerermittlung.
- `server/src/managers/broadcastManager.ts`: baut ausschließlich redigierte
  `RoomView`-Projektionen.
- `server/src/socketHandlers.ts`: Plattform-Autorisierung, Ack-Fehler,
  Host-Synchronisierung, Reconnect, Disconnect und Broadcasts.
- `server/src/utils/promptLibrary.ts`: einmaliges Laden der CSV-Datei mit
  validiertem Fallback und Test-Reader-Injektion.

## Sicherheits- und Datenschutzentscheidungen

Antworten werden serverseitig gespeichert und erst nach dem Host-Action
`revealAnswers` in die öffentliche Projektion aufgenommen. Selbst nach der
Erstübertragung einer Antwort bleiben Text, Gruppen und Gruppengrößen für alle
Clients verborgen. Aktionen werden anhand der Socket-Bindung und
`authorizePartyJoin` geprüft. Join- und Resume-Tokens werden weder geloggt noch
in `RoomView` aufgenommen.

Die Host-Rolle wird aus dem Party-Zustand synchronisiert. Bei einem Disconnect
wird die Antwort-Quorum-Prüfung mit den aktuell verbundenen Spielern neu
bewertet; der Spieler bleibt für einen möglichen Resume-Vorgang im Raum.

## Originalität und Daten

Die Plattform verwendet einen eigenen Namen, eigene Fragen und eigene
Gestaltung. Die Implementierung übernimmt nur die allgemeine Mehrheitsspiel-
Mechanik als Inspiration und kopiert keine kommerziellen Texte oder Assets.
