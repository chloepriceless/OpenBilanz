# Datenformate

OpenBilanz hält alle Daten in maschinenlesbaren Formaten — für Backups,
Gerätewechsel und eigene Skripte/Pipelines (z. B. eine Vorbuchung in
`ledger-cli`, aus der Eröffnungsbilanz oder Jahresabschluss erzeugt werden).

## 1. Vollständiger Datenbestand — `.obz`

Eine **unverschlüsselte `.obz`-Sicherung ist reines JSON** (UTF-8, eingerückt).
Sie enthält den vollständigen Bestand: Unternehmen + alle Abschlüsse. Die Datei
kann zu `.json` umbenannt und direkt gelesen oder erzeugt werden.

```jsonc
{
  "format": "obz",
  "obzVersion": 1,
  "verschluesselt": false,
  "snapshot": {
    "schemaVersion": 1,
    "exportiertAm": "2026-05-18T10:00:00.000Z",
    "app": "OpenBilanz",
    "unternehmen": { /* Stammdaten, siehe unten */ },
    "abschluesse": [ { /* Abschluss, siehe unten */ } ]
  }
}
```

Bei einer passwortgeschützten `.obz` steht in `verschluesselt: true`; der
Datenteil liegt dann AES-GCM-verschlüsselt unter `daten` (siehe `obz.js`).

### `unternehmen`

| Feld | Typ | Inhalt |
|---|---|---|
| `name`, `rechtsform` | String | Firma laut Handelsregister |
| `strasse`, `plz`, `ort` | String | Anschrift |
| `registergericht`, `handelsregisternummer` | String | Registereintrag |
| `steuernummer`, `wirtschaftsidnr` | String | Steuerliche Kennungen |
| `gruendungsdatum` | `YYYY-MM-DD` | Gründung |
| `stammkapital` | Number | Stammkapital in EUR |
| `gmbhTyp` | String | `operativ` \| `immobilien` \| `trading` \| `hybrid` \| `vermögensverwaltend` |
| `versteuerungsart` | String | `soll` \| `ist` (USt, § 13/§ 20 UStG) |
| `kleinunternehmer` | String | `ja` \| `nein` (§ 19 UStG) |
| `geschaeftsfuehrer` | String[] | Namen der Geschäftsführer |
| `kunden` | Object[] | Kunden-Stammdaten (Ausgangsrechnungs-Adressaten) — siehe unten |
| `rechnungsAngaben` | Object | Eigene Angaben für Ausgangsrechnungen (überschreibt ggf. Felder aus dem Haupt-Datensatz für die Rechnung) — siehe unten |
| `rechnungsnummern` | Object | Lückenloser Nummernkreis: `{ schema, naechste, jahr }` |

### `kunde`

```jsonc
{ "id": "K-…", "name": "Müller & Co. KG",
  "strasse": "Hauptstraße 12", "plz": "10115", "ort": "Berlin", "land": "DE",
  "ustId": "DE123456789", "email": "mueller@example.de",
  "angelegtAm": "2026-05-20", "geaendertAm": "2026-05-20" }
```

### `rechnungsAngaben`

```jsonc
{ "name": "Lindgrün Software GmbH",
  "strasse": "Karl-Heine-Straße 47", "plz": "04229", "ort": "Leipzig", "land": "DE",
  "stNr": "232/123/45678", "ustId": "DE298765432",
  "registergericht": "Amtsgericht Leipzig", "hrNummer": "HRB 38120",
  "ansprechpartner": "Jonas Lindgruen", "telefon": "", "email": "",
  "bank": { "iban": "DE89370400440532013000", "bic": "COBADEFFXXX", "institut": "" } }
```

### `rechnungsnummern`

```jsonc
{ "schema": "RE-{JAHR}-{NR:04}", "naechste": 1, "jahr": 2026 }
```

`{JAHR}` wird durch das Jahr aus dem Rechnungsdatum ersetzt, `{NR:04}` durch die
nächste freie Nummer mit so vielen führenden Nullen wie hinter dem Doppelpunkt
angegeben (`{NR:04}` → `0001`). Jahreswechsel setzt den Zähler zurück, sobald
eine neue Rechnung im neuen Kalenderjahr ausgestellt wird (`jahr` ändert sich
mit; bestehende Rechnungen bleiben unberührt).

### `abschluss`

| Feld | Typ | Inhalt |
|---|---|---|
| `id` | String | Eindeutige ID (`A-…`) |
| `art` | String | `EROEFFNUNGSBILANZ` \| `JAHRESABSCHLUSS` |
| `bezeichnung` | String | Anzeigename |
| `stichtag`, `gjVon`, `gjBis` | `YYYY-MM-DD` | Stichtag / Geschäftsjahr |
| `groessenklasse` | String | `KLEINST` \| `KLEIN` \| `MITTEL` \| `GROSS` |
| `guvVerfahren` | String | `GKV` \| `UKV` \| `KLEINST` |
| `kapital` | Object | `{ gezeichnet, eingezahlt, eingefordertOffen }` |
| `werte` | Object | `{ aktiva: {posId:Betrag}, passiva: {…}, guv: {…} }` |
| `buchungen` | Object[] | Buchungssätze (siehe unten) |
| `steuer` | Object | Eingaben der Steuerberechnung (Hebesatz, Verlustvortrag, …) |
| `ausgangsrechnungen` | Object[] | Erstellte Ausgangsrechnungen (siehe unten) |

### `ausgangsrechnung`

```jsonc
{ "id": "AR-…", "nummer": "RE-2026-0001",
  "art": "RECHNUNG", "datum": "2026-05-20", "leistungsdatum": "2026-05-19",
  "kundeId": "K-…",
  "kundeSnapshot": { /* Kunden-Stammdatensatz zum Festschreib-Zeitpunkt */ },
  "bestellnr": "", "leitwegId": "", "faelligkeit": "2026-06-03",
  "zahlungsbedingungen": "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
  "positionen": [ { "id": "P-…", "bezeichnung": "…", "menge": 1,
    "einheit": "C62", "einzelpreis": 100.00, "ustSatz": 19, "beschreibung": "" } ],
  "besonderheit": "NORMAL",
  "netto": 100.00, "ust": 19.00, "brutto": 119.00,
  "status": "ENTWURF", "fest": false,
  "versandAm": "", "buchungId": "",
  "protokoll": [] }
```

`besonderheit` ist eines von `NORMAL`, `REVERSE_CHARGE_13b`,
`INNERGEM_LIEFERUNG`, `INNERGEM_LEISTUNG`, `KLEINUNTERNEHMER_19`,
`STEUERFREI_§4`. `einheit` ist ein UN/ECE-Recommendation-20-Code (z. B. `HUR`
Stunden, `C62` Stück, `KGM` kg).

### `buchung`

```jsonc
{ "id": "B-…", "datum": "2026-03-01", "soll": "1800", "haben": "4400",
  "betrag": 1190.00, "text": "Erlös März", "fest": true, "hash": "a1b2c3…" }
```

`soll`/`haben` sind SKR04-Kontonummern, `betrag` ist positiv, `fest` markiert
GoBD-festgeschriebene (unveränderliche) Buchungen. `hash` ist der
SHA-256-Ketten-Hash festgeschriebener Buchungen — er sichert über den Hash der
Vorgängerbuchung die Reihenfolge und Unverändertheit (`pruefkette.js`).

## 2. Buchungsjournal — CSV / JSON

Export eines einzelnen Abschlusses über die Buchhaltungsansicht.

- **CSV** (`text/csv`, Semikolon, BOM): Kopfzeile
  `Datum;Soll;Haben;Betrag;Text;Festgeschrieben`, danach eine Zeile je Buchung.
- **JSON**: `{ format: "openbilanz-journal", version: 1, exportiertAm,
  abschluss: {id,bezeichnung,art,stichtag}, buchungen: [...] }`.

## 3. DATEV-Buchungsstapel (EXTF)

Im-/Export im DATEV-Format EXTF (Format 700, Kategorie 21 „Buchungsstapel",
Versionszeile 13). Semikolon-CSV mit Kopfsatz und Spaltenzeile. Im-/Export für
den Austausch mit dem Steuerberater.

## 4. GDPdU-Datenträgerüberlassung (Z3)

Export für die Betriebsprüfung: das Buchungsjournal als CSV (reine Datenzeilen)
plus eine beschreibende `index.xml` nach GDPdU-Beschreibungsstandard
(`gdpdu-01-09-2004.dtd`), einlesbar in die Prüfsoftware der Finanzverwaltung.
Beide Dateien gehören in denselben Ordner.

## 5. Bankdaten-Import

- **CAMT.053** (ISO 20022, XML) — moderner Kontoauszug.
- **MT940** (SWIFT, Text) — klassischer Kontoauszug.
- **Interactive Brokers Flex** (XML) — Wertpapier-Trades, Dividenden, Zinsen.
