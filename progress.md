# Main-Codebase-Review: Fortschritt der Findings

Basis: `origin/main` `ad8cee9f4a365bde53770b1996b57cb2eb7f9e27` (03.11.2026). Bearbeitung auf Branch `fix/secret-signals-header-spacing`; Findings werden einzeln behoben und jeweils gezielt verifiziert. Merge und Deployment sind nicht Teil dieses Checkpoints.

Historische Review-Gates (04.11.2026): Unit-Tests 658/658, Chromium-E2E 73/73 ohne Retries, Lint, Format, Typecheck, Game-Typecheck, Build und `pnpm audit --audit-level=high` bestanden. Ein moderates Advisory in der Dev-Abhängigkeit `minimatch` bleibt offen. Produktionsbuild lokal per HTTP und Desktop-/Mobile-Browser geprüft; kein Deployment. Docker-Build/-Runtime weiterhin nicht verifiziert.

## Kritzelagent-Feedback (07.11.2026)

Branch `fix/kritzelagent-turn-feedback`, erstellt von `origin/main`
`9ece1aad315cc8b8bae42f947845cd77a8348b7f`.

- Zeichenreihenfolge wird pro Runde serverseitig gemischt; beide Zeichendurchgänge
  verwenden dieselbe Rundenreihenfolge. Zufällige Wiederholungen sind möglich.
- Lange Pointer-Gesten werden vor dem Versand auf maximal 80 Punkte reduziert,
  statt wegen ihrer Länge als ungültig abgelehnt zu werden. Taps/degenerierte
  Striche bleiben lokal und verbrauchen keinen Zug; Servervalidierung bleibt strikt.
- Jeder eigene Zeichenzug öffnet ein DE/EN-Popup mit Bestätigung und Escape.
  Fokus bleibt im Popup statt zur Phasenüberschrift zu springen.
- Aktuell verifiziert: Typecheck, Game-Typecheck, Lint, Format, Unit-Tests
  665/665 (Kritzelagent 44/44), Chromium-E2E 74/74 ohne Retries und Produktionsbuild.
  Zusätzlicher Lauf gegen den echten lokalen Produktionsbuild: Kritzelagent 2/2,
  einschließlich fünf Runden, langer Gesten, Taps, wiederkehrender Popups sowie
  320-Pixel-Layout mit doppelter Schriftgröße und Tastaturbedienung.
- Keine Dependencies geändert. Historische Audit-/Docker-Nachweise des Reviews
  sind keine neuen Gates dieses Slices. Kein Merge oder Deployment.

## Secret-Signals-Mobile-UX (07.11.2026)

Fortsetzung auf demselben Branch `fix/kritzelagent-turn-feedback`; Kritzelagent
bleibt enthalten. Spielregeln, Server und 2–4-Team-Unterstützung unverändert.

- Neues board-first UI für Lobby, Team-/Rollenwahl, laufendes Spiel und Ergebnis:
  dunkler Spieltisch, helle Wortkarten, kompakte Restkartenanzeige und klarer Hinweis.
- Keine sichtbaren Farbnamen auf Wortkarten; autorisierte Screenreader-Namen
  bleiben erhalten, geheime Agenten-Karten erhalten keine Eigentumsdarstellung.
- Vom Nutzer bestätigter Ablauf: antippen zum Markieren, separater Aufdecken-Button.
  Mehrfachmarkierungen und Löschen eigener Markierungen bleiben möglich.
- Teams, Protokoll und Host-Steuerung sind aufklappbar statt über dem Spielfeld.
  Aktionsfehler sichtbar; Hinweisentwürfe bleiben bei Ablehnung erhalten.
- Verifiziert: Typecheck, Game-Typecheck, Lint, Format, Build, 676/676 Unit-Tests
  (Secret Signals 47/47) und 77/77 Chromium-E2E ohne Retries. Handy-Regressionen
  decken Touch, 2/3/4 Teams, 320 Pixel mit doppelter Schrift, Rollengeheimhaltung,
  Markieren/Löschen/Aufdecken und abgelehnte Hinweise ab.
- Lokaler Produktionsbuild: `/health` und `/` HTTP 200; zusätzlich Secret Signals
  12/12 Browser-Tests mit `E2E_TESTS=1` für deterministische Testbretter. Kein
  Vite-Devserver und keine gemockten App-Antworten; eigener Server beendet.
- Offizielle Online-/App-Seiten und App-Screenshot als UI-Referenz geprüft.
  Direkter Zugriff auf `codenames.game` lieferte HTTP 403; kein behaupteter
  Hands-on-Abgleich des fremden Online-Spiels. Keine Grafiken/Marken übernommen.
- Unabhängiger UI-Abschlusscheck: `ship` für die drei Desktop-/Mobile-Captures
  und den geprüften UI-Quellcode; keine materiellen Korrekturen. Zusätzliches
  TypeScript-Gate für die Secret-Signals-E2E-Datei bestanden. Produkt-/Design-Doku
  und game-lokales Design-Sidecar abgeschlossen; Auslieferung auf demselben Branch.
  Kein Merge oder Deployment.

## Findings

| ID   | Finding                                                                                                                                                                                                                                         | Plan                                                                                                                                  | Status                                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| F-01 | Deployment-Workflow kann einen veralteten erfolgreichen Main-Stand zuletzt ausrollen (`.github/workflows/deploy.yml`).                                                                                                                          | Deployments serialisieren und Runs überspringen, deren SHA nicht mehr `origin/main` entspricht.                                       | Behoben                                  |
| F-02 | Nicht-numerisches `maxRounds` kann `NaN` speichern und das normale Match-Ende verhindern (`games/blackout/server/src/socketHandlers.ts`).                                                                                                       | Payload serverseitig als endliche Ganzzahl validieren; ungültige Werte unverändert ablehnen.                                          | Behoben                                  |
| F-03 | Schnelle Blackout-Runden-Stepper-Klicks berechnen mehrfach aus demselben Server-Snapshot und können Änderungen verlieren (`games/blackout/ui-vue/src/components/Lobby.vue`).                                                                    | Änderungswünsche als serverseitig angewandte Schritte behandeln und Regressionstests ergänzen.                                        | Behoben                                  |
| F-04 | Runtime-Stage des Produktions-Dockerfiles setzt keinen unprivilegierten Benutzer (`Dockerfile`).                                                                                                                                                | Dedizierten Runtime-User verwenden und benötigte Schreibpfade gezielt freigeben.                                                      | Lokal behoben; Runtime nicht verifiziert |
| F-05 | Flip 7-Dokumentation behauptet ein festes Punktziel; Known-Issues beschreibt eine inzwischen geänderte Overlay-Schichtung (`games/flip7/README.md`, `games/flip7/docs/api.md`, `docs/known-issues.md`, `apps/platform/src/views/GameView.vue`). | Veraltete Aussagen anhand der aktuellen Implementierung und Tests korrigieren.                                                        | Behoben                                  |
| F-06 | Plattform-Controls können den Secret-Signals-Turn-Indikator an größeren Breakpoints überdecken (`apps/platform/src/views/GameView.vue`).                                                                                                        | Game-Shell auf allen Viewports unter den teleportierten Controls beginnen lassen; Browser-Regression für Desktop und Tablet ergänzen. | Behoben                                  |
| F-07 | High-Advisories in `body-parser` und Vue-I18n/`@intlify` verhindern einen grünen Security-Gate.                                                                                                                                                 | Gezielte Patch-Updates, kompatibler `qs`-Pin, Audit sowie vollständige lokale Gates und Produktionssmoke.                             | Lokal behoben und verifiziert            |

## Ausführung / Nachweise

- F-01: Workflow-weite Concurrency-Gruppe verhindert überlappende Produktionsdeployments; ein Freshness-Schritt lässt nur den SHA von `origin/main` deployen und failt geschlossen, falls die Abfrage fehlschlägt. Prettier und `git diff --check` bestanden. Der Freshness-Zweig wurde mit dem aktuellen Main-SHA (akzeptiert) und einem synthetischen veralteten SHA (abgelehnt) geprüft. Hosted GitHub-Workflow nicht ausgelöst.
- F-02: Der Runden-Handler validiert Eingaben zur Laufzeit vor jeder Zustandsänderung; F-03 begrenzt sie auf die Ganzzahlschritte `-1 | 1`. Fokussierte `socketHandlers.test.ts`-Tests: 15/15, einschließlich acht ungültiger Payloads und fünf schneller Änderungen; Blackout-Suite: 34/34.
- F-03: Der Client sendet Schritte statt aus einem eventuell veralteten Broadcast einen absoluten Wert abzuleiten; der Server wendet sie auf den aktuellen Rundenwert an und begrenzt das Ergebnis. Der Playwright-Lauf mit dem Runden-/Ende-Flow bestand mit 14/14 Tests; Plattform- und Game-Typecheck sowie Prettier und `git diff --check` bestanden.
- F-04: Runtime-Image setzt `USER node`; die App erhält eigene schreibbare Mounts für Blackout-SQLite und Imposter-Wörter. Ein kurzer Root-Setup-Service repariert auch Ownership bestehender Named Volumes, bevor die App startet. Prettier-YAML/Markdown-Parse und `git diff --check` bestanden; `docker compose config` war mangels Compose-CLI-Plugin nicht ausführbar, Image-Build/Containerlauf mangels Docker-Runtime nicht verifiziert.
- F-05: Flip-7-README nennt nun das Standardziel 200 und die Host-Einstellung 100–500 in 50er-Schritten. `docs/api.md` deckte das bereits korrekt ab und blieb unverändert. Known Issues dokumentiert weiterhin die gültige Overlay-Schichtung; die separate Secret-Signals-Turn-Indikator-Kollision wird in F-06 behandelt. Gegen `GameView.vue` abgeglichen: `.ui-overlay` 9999, Controls 10000, Leave-Dialog 10001. Keine F-05-Codeänderung.
- F-06: `.game-shell` reserviert auf allen Viewports `3.5rem` Platz für die teleportierten Plattform-Controls. Der Secret-Signals-E2E-Test misst die tatsächlichen Bounding-Boxen und prüft den Ausgangs-Viewport sowie `1024×768`; der fokussierte Lauf bestand mit 1/1, der vollständige Chromium-Lauf mit 73/73. `pnpm run typecheck`, `pnpm run typecheck:games`, `pnpm test` (63 Dateien/658 Tests), `pnpm run build`, `pnpm lint`, `pnpm format:check`, `git diff --check` und `trail build` bestanden.
- F-07 (04.11.2026): Vue-I18n-Mindestversion in Root und Plattform auf `^11.4.14` angehoben; Lockfile löst Vue-I18n und `@intlify/*` konsistent auf `11.4.18` auf. Ein auf die betroffene 2.x-Linie beschränkter Workspace-Override setzt `body-parser` auf `2.4.0`. Der bestehende `qs`-Pin steigt auf `6.16.1`, um dessen neue Mindestanforderung zu erfüllen. Keine anderen Paket-Majors geändert. Offizielle Advisories: [body-parser GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), [Vue-I18n GHSA-83rm-6c8r-g728](https://github.com/intlify/vue-i18n/security/advisories/GHSA-83rm-6c8r-g728).
- Historische Abschluss-Gates des Reviews (04.11.2026): Unit-Tests 63 Dateien/658 Tests, Chromium-E2E 73/73 mit `--retries=0`, Typecheck, Game-Typecheck, Lint, Format, Build und High-Audit bestanden. Audit aktuell: 0 High/Critical/Low, 1 Moderate (`minimatch` 10.2.6 über ESLint/TypeScript-ESLint; GHSA-g3hv-75wg-m249, behobene Linie >=11.0.1). Ein erzwungener Major-Wechsel der Dev-Toolchain ist nicht Teil dieses Patch-Slices; kein Null-Advisory-Claim.
- Lokaler Produktionssmoke: `/health` und `/` HTTP 200; gültiger gzip-JSON-Body erreicht die bewusst deaktivierte Admin-Route (503), defektes gzip und gzip mit angehängten Bytes werden mit 400 abgelehnt, anschließender Healthcheck bleibt 200. Vue-I18n neutralisiert `srcdoc` im Advisory-Beispiel. Echter Produktionsbrowser: vier Spieler erstellen/joinen eine Party und öffnen die Secret-Signals-Lobby; bei `1280×800` und `390×844` keine Seitenüberbreite oder Page-Errors, Plattform-Controls sichtbar. Nur externe Font-Requests wurden blockiert, keine App-/API-Antworten gemockt. Eigener Testserver beendet. Dies ist kein vollständiger Angriffsnachweis, keine Multiplayer-Spielrundenabnahme und kein Deployment.
- Belege: [Dependency-Security-Receipts](tools/reports/dependency-security-2026-11-04/receipt.json) mit Hashmanifest, Audit-JSON, Unit-/E2E-Logs, Produktionssmoke und Screenshots. Docker-Compose-Konfiguration, Image-Build und Containerlauf bleiben unverifiziert; kein Hosted-Deploy ausgelöst.
