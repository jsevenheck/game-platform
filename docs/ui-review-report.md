# UI/UX Review: Redesigned Game Platform UI

Datum: 2026-05-03  
Branch: `copilot/redesign-game-platform-ui`  
Scope: Platform-Flow und visuelle Integration der Games `blackout`, `flip7`, `imposter`, `secret-signals`

## Testlauf

Ausgeführt vom Workspace-Root:

```bash
pnpm test:e2e --workers=3
```

Ergebnis:

- **31/31 Tests bestanden**
- Laufzeit: ca. **40.3s**
- Browser-Projekt: `chromium`
- HTML Report: `playwright-report/index.html`
- Fehlgeschlagene Tests: **keine**
- Failure-Screenshots/Traces: **keine erzeugt**, da kein Retry/Failure auftrat

## Zusammenfassung

Die vier Games funktionieren im redesigned Platform-Flow grundsätzlich stabil. Die getesteten Kernpfade decken Party-Erstellung, Join, Game-Launch, Auto-Join per Match, Reload/Resume, wichtige Spielaktionen und Platform-Overlay-Aktionen wie Lobby-Rückkehr bzw. Replay ab.

| Game | Status | Einschätzung |
| --- | --- | --- |
| Blackout | OK | Visuell und funktional im Platform-Flow stabil |
| Flip 7 | OK | Visuell und funktional im Platform-Flow stabil |
| Imposter | OK | Größte Flow-Abdeckung; keine gebrochenen UI-Pfade gefunden |
| Secret Signals | OK | Komplexestes Layout/Mehrspieler-Setup; getestete Hauptzustände stabil |

## Detailreview pro Game

### Blackout

**Bestandene Szenarien**

- Party mit 3 Spielern erstellen und Blackout starten
- Game-Lobby lädt nach Platform-Launch korrekt
- Host startet Match; alle Spieler sehen `.game-round`
- Host- und Player-Reload führen zurück in aktive Game-Ansicht
- Mehrfacher Reload eines Players bleibt stabil
- Game-Ende zeigt Platform-Overlay; Rückkehr zur Party-Lobby funktioniert

**UI-Befund**

- Keine broken selectors in getesteten Zuständen (`.lobby`, `.game-round`, `.game-over`, `.platform-overlay`).
- Host-/Player-spezifische Hinweise werden sichtbar gerendert.
- Platform-Overlay ist nach Match-Ende erreichbar und enthält die erwartete Lobby-Aktion.

**Empfehlungen**

- Optional visuelle Regression für Lobby, aktive Runde und Game-Over ergänzen.
- Mobile/Small-Viewport-Check ergänzen, da aktuelle E2E-Abdeckung primär Desktop Chrome nutzt.

### Flip 7

**Bestandene Szenarien**

- Party mit 3 Spielern erstellen und Flip 7 starten
- Lobby lädt automatisch nach Platform-Launch
- Nicht-Hosts sehen Waiting-State
- Host startet Game; alle Spieler sehen Deck-/Discard-Zähler
- Fixed Target Score `200` wird ohne Stepper Controls angezeigt
- Genau ein aktiver Spieler sieht Hit-/Stay-Aktionen
- Host-Reload resumed aktive Match-Ansicht

**UI-Befund**

- Keine fehlenden zentralen Controls oder gebrochenen Selektoren gefunden.
- Der offizielle 200-Punkte-Zielwert ist visuell als fixed rule erkennbar.
- Turn-spezifische Controls erscheinen nur beim aktiven Spieler.

**Empfehlungen**

- Player-Reload-Test analog zu Host-Reload ergänzen.
- Visual Snapshots für Lobby und aktiven Table-State ergänzen, insbesondere für Karten-/Scoreboard-Dichte.

### Imposter

**Bestandene Szenarien**

- Duplicate-Name-Fehler wird sichtbar auf der Platform-Home-UI angezeigt
- 3-Spieler-Setup startet über Platform-Flow
- Description-, Voting-, Reveal- und Round-Result-Phasen funktionieren
- Host kann Game beenden und Final Scoreboard sehen
- Rückkehr zur Party-Lobby über Platform-Overlay funktioniert
- Next Round nach Reveal funktioniert
- Paranoia Mode mit 0 Infiltrators funktioniert visuell/funktional
- Host kann Infiltrator Guess skippen
- Reload/Resume für Host und Player funktioniert
- Replay über Platform-Overlay startet neue Lobby

**UI-Befund**

- Keine broken selectors in den wichtigsten Phasen (`.lobby`, `.description-phase`, `.voting-phase`, `.reveal-phase`, `.round-result`, `.game-over`).
- Error-State auf Platform Home wird sichtbar gerendert.
- Final Scoreboard und Platform-Overlay erscheinen nach Game-Ende korrekt.
- Replay-Flow remountet die Game-Lobby erfolgreich.

**Empfehlungen**

- Visual Regression für alle Phasen ergänzen; Imposter hat viele UI-Zustände und ist dadurch anfällig für Design-Regressionen.
- Accessibility-Checks für Voting-Buttons, Stepper Controls und Ergebnisbanner ergänzen.

### Secret Signals

**Bestandene Szenarien**

- Platform Home zeigt redesigned Game Platform Screen
- Party mit 4 Spielern erstellen und Secret Signals starten
- Team-/Rollenwahl in der Lobby funktioniert
- Host kann Lobby konfigurieren und Game starten
- Director sendet Signal; Agent wählt/revealt Karte; Turn wechselt korrekt
- Assassin-Verhalten ist in der Lobby umschaltbar und Hint-Text aktualisiert sich
- Reload/Resume für Host und Player funktioniert
- Disconnected Player kann aktive Session wieder aufnehmen
- Host kann Guess-Runde skippen
- Game-Ende durch Assassin zeigt Platform-Overlay; Rückkehr zur Lobby funktioniert

**UI-Befund**

- Keine fehlenden Hauptelemente in Lobby oder Gameplay gefunden (`.lobby`, `.turn-indicator`, `.gameplay-content`, `.platform-overlay`).
- Team-/Rollen-Controls reagieren im getesteten Desktop-Flow korrekt.
- Card-Grid-Interaktionen inklusive Confirmation-Dialog funktionieren.

**Empfehlungen**

- Responsive Review für das Card-Grid priorisieren; Secret Signals ist layout-intensiv und profitiert am stärksten von Mobile-/Tablet-Snapshots.
- Visual Snapshots für Director- und Agent-Perspektive separat ergänzen.

## Gefundene UI-Probleme

Im aktuellen automatisierten Review wurden **keine blockierenden UI/UX-Probleme** gefunden:

- Keine gebrochenen Selektoren in den E2E-Hauptflows
- Keine fehlenden zentralen Buttons oder Status-Elemente
- Keine sichtbaren Flow-Abbrüche durch das redesigned Platform UI
- Keine Failure-Artefakte im Playwright-Report

## Empfehlungen für nächste Schritte

1. **Visuelle Regressionstests ergänzen**  
   Für jedes Game mindestens Lobby, aktives Gameplay und Game-Ende/Overlay als Screenshot-Snapshots erfassen.

2. **Responsive Matrix erweitern**  
   Aktuell läuft der Suite-Fokus auf Desktop Chrome. Empfohlen: zusätzlich Mobile Safari/Pixel-Viewport für card- und board-lastige Games.

3. **Accessibility Smoke Checks ergänzen**  
   Besonders für Stepper, Team-/Role-Toggles, Voting-Buttons, Dialoge und Platform-Overlay.

4. **Stabilere semantische Locators ausbauen**  
   Wo noch Klassen- oder ID-Selektoren verwendet werden, langfristig bevorzugt `getByRole`, `getByLabel`, `data-testid` oder klar benannte ARIA-Labels nutzen.

5. **HTML Report beibehalten**  
   `playwright-report/index.html` ist für Failure-Analyse ausreichend konfiguriert. Bei visuellen Regressionen sollten Screenshots als Attachments im Report erscheinen.
