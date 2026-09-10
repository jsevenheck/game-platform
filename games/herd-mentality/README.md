# Herd Mentality

Herd Mentality ist ein eigenständiges Mehrheitsantwort-Spiel für **4–20 Spieler**.
Alle beantworten dieselbe Frage geheim. Wer dieselbe Antwort wie mindestens eine
weitere Person gibt, erhält eine Kuh. Eine einzelne abweichende Antwort erhält
die Pink Cow und kann damit nicht gewinnen.

## Spielablauf

1. Der Host startet das Spiel ab vier verbundenen Spielern.
2. Alle schreiben gleichzeitig eine kurze Antwort auf die angezeigte Frage.
3. Nach der letzten Antwort löst der Host die Runde auf.
4. Gleiche Antworten werden gruppiert und die Kühe werden verteilt.
5. Der Host startet die nächste Runde. Wer acht Kühe ohne Pink Cow erreicht,
   gewinnt sofort; andernfalls endet das Spiel nach acht Fragen.

Antworten werden für die erste Version deterministisch verglichen: Unicode-NFKC,
Trim, zusammengefasste Leerzeichen und Kleinschreibung. Synonyme und semantische
Gleichheit werden nicht automatisch erkannt. Die Fragen und das Branding sind
originär für diese Plattform erstellt.

## Entwicklung

Das Spiel ist ein internes Plattformmodul und wird ausschließlich über den
Party-Ablauf gestartet. Es gibt keinen separaten Server oder Client.

- Core: `core/src/`
- Server: `server/src/`
- Fragen: `server/data/prompts.csv`
- Vue-Client: `ui-vue/src/`
- API: `docs/api.md`
- Architektur: `docs/architecture.md`

Nach Änderungen an `prompts.csv` muss der Server bzw. der Produktions-Build neu
gestartet werden. Der Server nutzt bei fehlender oder ungültiger Datei eine
geprüfte eingebaute Fallback-Liste.
