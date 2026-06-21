# H2 — Doppelte Rechnungsnummern bei Jahres-Rücksprung: Datenmodell-Redesign

_Pfenni, 2026-06-21. R22-kritisch (Datenmodell). Design-vor-Build (Deliberate Mode)._

## Problem (reproduziert)
`public/shared/ausgangsrechnung.js` hält EINEN globalen Zähler:
`rechnungsnummern = { schema, naechste, jahr }`. `vergebeNummer` setzt bei
Jahreswechsel (`rn.jahr !== j`) `naechste = 1` zurück. Bei Rückdatierung ins
Vorjahr + Rücksprung ins schon-begonnene Jahr → Reset → DOPPELNUMMER.

Repro (`node`): Daten `[2026-01,2026-02,2025-12,2026-03,2026-04]` →
`RE-2026-0001, RE-2026-0002, RE-2025-0001, RE-2026-0001(!), RE-2026-0002(!)`.
Verletzt **§ 14 Abs. 4 Nr. 4 UStG** (Einmaligkeit) + **GoBD**. Realistischer
Pfad: Jahreswechsel-Nacherfassung (Dezember-Rechnung im Januar nachtragen).

Latenter Zweitbefund: UI (`app.js:4188-4198` „Nächste Nummer") setzt nur
`naechste`, NICHT `jahr` → manuell gesetzter Startwert wird beim nächsten
Jahreswechsel-Reset verschluckt (wirkungslos, sobald `rn.jahr !== aktuellesJahr`).

## Architektur-Constraints (recherchiert)
- Rechnungen liegen am **Abschluss** (`a.ausgangsrechnungen`), über Jahre/
  Abschlüsse verteilt. Der Zähler liegt am **Unternehmen** (`un.rechnungsnummern`).
  `vergebeNummer(u, datum)` bekommt NUR das Unternehmen, kennt die Rechnungsliste
  nicht. → „Nummer aus existierenden Rechnungen ableiten" ist architektonisch
  nicht verfügbar UND GoBD-widrig (gelöschte/stornierte Nummer würde wiederverwendet).
  Der **persistente Zähler IST die autoritative Quelle** — korrekt, nur global statt
  pro Jahr. Fix = Zähler pro Jahr, nichts an der Architektur drehen.
- Dual-Mode: Daten leben im Browser (IndexedDB). Migration muss **self-migrating
  beim Lesen** sein (kein Migrations-Script), idempotent, rückwärtskompatibel.
- Konsumenten: `app.js:4133/4193` (UI-Feld), `4590` (`naechsteNummer` Vorschau),
  `4668` (`vergebeNummer` Vergabe). Tests `tests/run.js:1648-1680`.

## Entscheidung: Zähler pro Jahr als Map
```js
rechnungsnummern = {
  schema: 'RE-{JAHR}-{NR:04}',
  zaehler: { "2025": 6, "2026": 3 }   // jahr(String) -> NÄCHSTE freie Nr für dieses Jahr
}
```
- `naechsteNummer(u, datum)`: `j = jahrAus(datum); nr = zaehler[j] || 1;` (keine Mutation).
- `vergebeNummer(u, datum)`: `j; nr = zaehler[j] || 1; zaehler[j] = nr + 1;` → nie Reset
  eines bereits begonnenen Jahres. Rücksprung ins Vorjahr stellt NUR `zaehler[vorjahr]`
  weiter, lässt `zaehler[aktuellesJahr]` unberührt → keine Doppelnummer.

### Migration (self-migrating, idempotent) — in `defaults()` zentralisiert
```js
function migriereNummern(rn) {
  if (rn && (!rn.zaehler || typeof rn.zaehler !== 'object')) {
    rn.zaehler = {};
    // alten globalen Single-Zähler in das richtige Jahr übernehmen
    if (rn.jahr > 0 && rn.naechste > 0) rn.zaehler[String(rn.jahr)] = rn.naechste;
  }
  return rn;
}
```
Greift genau einmal (sobald `zaehler` existiert, no-op). Verlässt sich nur auf
`rn`, kein Listen-Zugriff. Alte Felder `jahr`/`naechste` bleiben als toter
Ballast stehen (NICHT gelöscht — siehe Tradeoff Rückwärtskompat unten).

### UI-Anpassung (app.js Nummernkreis)
„Nächste Nummer" bezieht sich auf das **laufende Kalenderjahr** (`jahrAus(heute)`):
- Vorbelegung lesen: `zaehler[lj] || 1`.
- Speichern: `zaehler[lj] = n` (statt blankes `naechste`). Label präzisieren:
  „Nächste Nummer (laufendes Jahr <LJ>)". Behebt den latenten Zweitbefund.

## Verworfene Alternativen
1. **Nummer aus `a.ausgangsrechnungen` max+1 ableiten.** Verworfen: Architektur
   (Liste nicht in `vergebeNummer` verfügbar, über Abschlüsse verteilt) + GoBD
   (Wiederverwendung gelöschter Nummern). Der persistente Zähler existiert genau
   deshalb.
2. **Single-Zähler behalten, Reset nur bei `j > rn.jahr` (monoton vorwärts).**
   Verworfen: bei Rückdatierung ins Vorjahr würde der Vorjahres-Zähler vom
   aktuellen Jahr „mitgezählt" → falsche/springende Vorjahresnummern; und ein
   zweites Vorjahr (2024 nach 2026) bekäme keinen sauberen eigenen Kreis. Pro-Jahr
   ist das einzig saubere Modell für jahresbasierte Schemata.
3. **Legacy-Felder bei Migration löschen.** Verworfen (vorerst): eine alte App-
   Version aus dem SW-Cache, die dieselben IDB-Daten lädt, würde ohne `zaehler`
   wieder auf `jahr`/`naechste` zurückfallen. Sie stehenzulassen schadet nicht;
   `zaehler` ist eindeutig die neue autoritative Quelle. (Defensive Spiegelung der
   Legacy-Felder beim Vergeben erwogen, aber als Überkomplexität verworfen — nach
   einem Reload ist die alte App ohnehin weg.)

## Risiken / Kanten (zu prüfen)
- Schemata OHNE `{JAHR}` (z. B. fortlaufend über Jahre, `RE-{NR:05}`). Dann ist
  „pro Jahr" semantisch falsch — der User WILL einen durchlaufenden Kreis. → Muss
  behandelt werden: wenn das Schema kein `{JAHR}` enthält, EINEN gemeinsamen Kreis
  führen (z. B. `zaehler['*']`), nicht pro Kalenderjahr. **Kernfrage für Codex.**
- `jahrAus` Default = aktuelles Jahr bei leerem/ungültigem Datum — unverändert ok.
- Idempotenz der Migration bei wiederholtem `defaults()`-Aufruf — durch `zaehler`-
  Existenzprüfung gegeben.

## Verifikation (Oracle)
- Repro-Sequenz `[2026-01,2026-02,2025-12,2026-03,2026-04]` → 5 PAARWEISE
  VERSCHIEDENE Nummern (`RE-2026-0001/0002, RE-2025-0001, RE-2026-0003, RE-2026-0004`).
- Migration: altes `{jahr:2026,naechste:5}` → erste Vergabe 2026 = `RE-2026-0005`.
- Bestehende Tests (`run.js:1648ff`) angepasst + neue Regressionstests für
  Rücksprung + Migration + schema-ohne-JAHR. `node tests/run.js` grün.
