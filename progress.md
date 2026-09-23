# Main-Codebase-Review: Fortschritt der Findings

Basis: `origin/main` `3f1b914ff32cd643a4e92acc6de737f6b1dfe019` (23.09.2026). Bearbeitung auf Branch `fix/comprehensive-review-findings`; Findings werden einzeln behoben und jeweils gezielt verifiziert. Kein Push erfolgt.

Review-Gates auf der Basis: Unit-Tests 586/586, E2E 66/66, Lint, Format, Typecheck, Game-Typecheck, Audit und Build bestanden. Docker-Build/-Runtime mangels erreichbarem Docker-Daemon nicht geprüft.

## Findings

| ID   | Finding                                                                                                                                                                                                                                         | Plan                                                                                            | Status  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| F-01 | Deployment-Workflow kann einen veralteten erfolgreichen Main-Stand zuletzt ausrollen (`.github/workflows/deploy.yml`).                                                                                                                          | Deployments serialisieren und Runs überspringen, deren SHA nicht mehr `origin/main` entspricht. | Behoben |
| F-02 | Nicht-numerisches `maxRounds` kann `NaN` speichern und das normale Match-Ende verhindern (`games/blackout/server/src/socketHandlers.ts`).                                                                                                       | Payload serverseitig als endliche Ganzzahl validieren; ungültige Werte unverändert ablehnen.    | Offen   |
| F-03 | Schnelle Blackout-Runden-Stepper-Klicks berechnen mehrfach aus demselben Server-Snapshot und können Änderungen verlieren (`games/blackout/ui-vue/src/components/Lobby.vue`).                                                                    | Änderungswünsche als serverseitig angewandte Schritte behandeln und Regressionstests ergänzen.  | Offen   |
| F-04 | Runtime-Stage des Produktions-Dockerfiles setzt keinen unprivilegierten Benutzer (`Dockerfile`).                                                                                                                                                | Dedizierten Runtime-User verwenden und benötigte Schreibpfade gezielt freigeben.                | Offen   |
| F-05 | Flip 7-Dokumentation behauptet ein festes Punktziel; Known-Issues beschreibt eine inzwischen geänderte Overlay-Schichtung (`games/flip7/README.md`, `games/flip7/docs/api.md`, `docs/known-issues.md`, `apps/platform/src/views/GameView.vue`). | Veraltete Aussagen anhand der aktuellen Implementierung und Tests korrigieren.                  | Offen   |

## Ausführung / Nachweise

- F-01: Workflow-weite Concurrency-Gruppe verhindert überlappende Produktionsdeployments; ein Freshness-Schritt lässt nur den SHA von `origin/main` deployen und failt geschlossen, falls die Abfrage fehlschlägt. Prettier und `git diff --check` bestanden. Der Freshness-Zweig wurde mit dem aktuellen Main-SHA (akzeptiert) und einem synthetischen veralteten SHA (abgelehnt) geprüft. Hosted GitHub-Workflow nicht ausgelöst.
- Vollständige Gates und finaler Branch-/Diff-Status folgen nach Abschluss aller fünf Findings.
