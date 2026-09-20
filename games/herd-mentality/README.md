# Herd Mentality

Herd Mentality ist eine digitale Plattform-Adaption des gleichnamigen
Mehrheitsantwort-Spiels für **4–20 Spieler**. Alle beantworten dieselbe Frage geheim.
Die eindeutig häufigste Antwort erhält eine Kuh pro beteiligter Person. Eine einzelne
abweichende Antwort erhält die Pink Cow und kann damit nicht gewinnen.

Die digitale Variante behält den offiziellen Kern bei, nutzt aber einen konfigurierten
Fragenvorrat und eine begrenzte Zahl von Fragen pro Match. Bei einem Gleichstand der
häufigsten Antwort gibt es keine Kühe und keine Pink Cow. Erreichen mehrere Spieler das
Ziel in derselben Runde, wird das Ziel gemäß dem offiziellen Tiebreaker um eine Kuh erhöht.

## Spielablauf

1. Der Host startet das Spiel ab vier verbundenen Spielern.
2. Alle schreiben gleichzeitig eine kurze Antwort auf die angezeigte Frage.
3. Nach der letzten Antwort löst der Host die Runde auf.
4. Nur die eindeutig häufigste Antwort erhält Kühe; Gleichstände geben keine Kühe.
5. Eine einzelne Antwort außerhalb einer eindeutigen Mehrheit erhält die Pink Cow.
6. Wer das aktuelle Kuhziel ohne Pink Cow erreicht, gewinnt. Bei einem Gleichstand wird
   das Ziel um eine Kuh erhöht.

Antworten werden für die digitale Variante deterministisch verglichen: Unicode-NFKC,
Trim, zusammengefasste Leerzeichen und Kleinschreibung. Synonyme und semantische
Gleichheit werden nicht automatisch erkannt.

**Regelquellen:** [Big Potato – How to Play](https://bigpotato.co.uk/blogs/how-to-play/herd-mentality)
und [offizielles Regelblatt](https://c.tabletopia.com/games/herd-mentality/rules/hm-usa-rules-4-mar-2020/en).

## Entwicklung

Das Spiel ist ein internes Plattformmodul und wird ausschließlich über den
Party-Ablauf gestartet. Es gibt keinen separaten Server oder Client.

- Core: `core/src/`
- Server: `server/src/`
- Fragen: `server/data/prompts.<en|de>.csv`
- Vue-Client: `ui-vue/src/`
- API: `docs/api.md`
- Architektur: `docs/architecture.md`

Nach Änderungen an `prompts.<locale>.csv` muss der Server bzw. der Produktions-Build neu
gestartet werden. Der Server nutzt bei fehlender oder ungültiger Datei eine
geprüfte eingebaute Fallback-Liste.
