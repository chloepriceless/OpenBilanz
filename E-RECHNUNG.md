# E-Rechnung in OpenBilanz — Anleitung

Diese Seite beschreibt, wie du in OpenBilanz **eingehende** und **ausgehende**
E-Rechnungen verarbeitest. Eine kürzere Workflow-Hilfe steht auch direkt im
Tool unter **Hilfe → Buchungshilfe** (Abschnitte 8–13).

## 1. Worum geht es?

Seit dem 01.01.2025 dürfen B2B-Rechnungen im Inland zwischen Unternehmen
**nur noch in strukturierter Form** ausgetauscht werden. Die zwei
zugelassenen Formate sind:

- **XRechnung** — eine reine XML-Datei nach EN 16931, von der KoSIT
  (Koordinierungsstelle für IT-Standards) gepflegt. Zwei Syntax-Varianten:
  **UBL** und **CII**. Beide gleichwertig.
- **ZUGFeRD / Factur-X** — eine PDF/A-3-Datei, in die eine CII-XML
  eingebettet ist. Sieht für das menschliche Auge aus wie eine
  „normale" PDF, ist aber maschinenlesbar.

> Eine reine PDF ohne XML genügt im B2B-Inland nicht mehr (Übergangsfristen
> bis 31.12.2027). Im B2B-Inland reicht **XRechnung alleine** rechtlich
> aus — ZUGFeRD-Hybrid ist freiwilliger Komfort.

Die **Empfangs-Pflicht** trifft jede inlandsansässige GmbH bereits seit
Anfang 2025. Die **Versand-Pflicht** kommt stufenweise (alle ab 2028).

---

## 2. Empfang — eine Eingangsrechnung einlesen

In der Buchhaltung-Ansicht des laufenden Jahres die Karte **„E-Rechnung
(XRechnung / ZUGFeRD)"** aufrufen und die Datei wählen — entweder
`.xml` (XRechnung in UBL- oder CII-Syntax) oder `.pdf`
(ZUGFeRD-/Factur-X-Hybrid).

### Was OpenBilanz dabei macht

- Bei einer **PDF**: extrahiert die eingebettete XML aus dem PDF/A-3-
  Anhang und entpackt sie (FlateDecode).
- Erkennt das **Profil**: XRechnung 3.x, EN 16931, Factur-X
  MINIMUM / BASIC / EN 16931 / EXTENDED, oder ZUGFeRD 1.0.
- Extrahiert **Kopfdaten** (Nummer, Datum, Verkäufer, Summen) und alle
  **Positionen** (Bezeichnung, Menge, Einheit, Einzelpreis, USt-Satz).
- Prüft **Plausibilität**: Brutto = Netto + USt, Summe Positionen = Netto,
  Pflichtfelder nach § 14 UStG.

Anschließend: Aufwandskonto wählen → **„Als Eingangsrechnung buchen"**.
OpenBilanz erzeugt automatisch:

```
6300 / 3300   Eingangsrechnung (Netto) gegen Verbindlichkeiten aLuL
1406 / 3300   enthaltene Vorsteuer 19 % gegen die Verbindlichkeit
```

> Das Aufwandskonto (Soll-Seite) kannst du vor dem Buchen umstellen —
> Standard ist 6300 (sonstige betriebliche Aufwendungen).

---

## 3. Versand — Stammdaten einrichten

Bevor du die erste Ausgangsrechnung schreibst, einmalig im Menü
**Stammdaten → Kunden** einrichten:

### 3.1 Eigene Rechnungs-Angaben

Das sind die Felder, die auf deinen Ausgangsrechnungen erscheinen. Was du
hier leer lässt, wird automatisch aus deinen **Unternehmensdaten**
übernommen. Trägst du hier explizit etwas ein, hat das auf der Rechnung
Vorrang.

| Feld | Pflicht? | Hinweis |
|---|---|---|
| Name auf der Rechnung | ja (oder aus Stammdaten) | Vollständige Firma laut Handelsregister |
| Straße / PLZ / Ort | ja (oder aus Stammdaten) | Vollständige Geschäftsanschrift |
| Steuernummer **oder** USt-IdNr. | §14 UStG-Pflicht | mindestens eines, am besten beides |
| USt-IdNr. | Pflicht bei §13b / EU | Form: `DE` + 9 Ziffern. Wird live geprüft (DE/AT/NL/IT mit Prüfziffer) |
| Registergericht + HR-Nummer | für die Fußzeile | z. B. HRB 38120, AG Leipzig |
| Ansprechpartner / Telefon / E-Mail | optional | landet im Contact-Block der XML |
| IBAN / BIC | für SEPA-PaymentMeans | Leerzeichen werden ignoriert |

### 3.2 Rechnungsnummernkreis

§ 14 Abs. 4 Nr. 4 UStG verlangt eine **einmalig vergebene** Rechnungsnummer.
Du konfigurierst:

- **Schema** — Platzhalter `{JAHR}` und `{NR:NN}` (`NN` = Anzahl der
  führenden Nullen). Default: `RE-{JAHR}-{NR:04}` → ergibt `RE-2026-0001`.
- **Nächste Nummer** — Zähler. Setzt sich beim Jahreswechsel automatisch
  zurück.

> Manuell an der „Nächsten Nummer" zu drehen ist nur dann sinnvoll, wenn
> du gerade aus einem anderen System migrierst und den dort vergebenen
> Stand übernehmen willst. Sonst Finger weg — Rechnungsnummern dürfen
> **nicht** rückwärts gehen oder lückenhaft sein.

### 3.3 Kundenliste

Pro Kunde: Name, Straße, PLZ, Ort, Land (ISO-2 — `DE`, `AT`, `FR`, …),
USt-IdNr., E-Mail.

- Die **USt-IdNr.** wird live strukturell geprüft (Format pro Staat;
  für DE, AT, NL und IT auch die Prüfziffer-Algorithmen).
- Im **Selbst-Hosting-Modus** (gestartet mit `./start.sh` /
  `node server.js`) gibt es zusätzlich einen Knopf **„USt-IdNr. online
  bei VIES prüfen"**. Der ruft die qualifizierte Bestätigungs­abfrage der
  EU-Stelle auf, archiviert das Ergebnis (Datum + Gültigkeit + Name laut
  VIES) beim Kunden — wichtig für Betriebsprüfungen bei
  innergemeinschaftlichen Geschäften.

> Der Online-Pfad geht **nur** im Selbst-Hosting-Modus; im reinen
> Website-Modus blockiert der Browser den Direkt-Aufruf an die EU-Stelle
> (kein CORS). Die strukturelle Offline-Prüfung läuft überall.

---

## 4. Versand — Rechnung erstellen

Im jeweiligen Geschäftsjahr **Ausgangsrechnungen → + Neue Rechnung**.

### 4.1 Rechnungsdaten

- **Kunde** aus der Liste wählen — Adresse wird automatisch eingefroren.
- **Rechnungsdatum** und **Leistungsdatum** (Pflicht — eines davon, oder
  ein Leistungszeitraum von/bis).
- **Fälligkeit** (optional, BT-9).
- **Zahlungsbedingungen** als Freitext (z. B. „Zahlbar in 14 Tagen ohne Abzug.").
- **Bestell- / Auftragsnummer** (optional, BT-13).
- **Leitweg-ID** (B2G-Pflicht; leer lassen reicht für B2B).

### 4.2 Steuerlogik

Eines aus der Auswahl:

| Schalter | Wann? | TaxCategoryCode (XML) |
|---|---|---|
| Inland mit USt-Ausweis (Regelfall) | normaler B2B-/B2C-Verkauf in DE | `S` |
| § 13b Steuerschuldnerschaft | Bauleistungen, EU-Subunternehmer, …; Empfänger zahlt USt | `AE` |
| Innergemeinschaftliche Lieferung steuerfrei | Warenversand in andere EU-Staaten an USt-IdNr.-Inhaber | `K` |
| EU-Sonstige Leistung — Reverse-Charge | Dienstleistungen an USt-IdNr.-Inhaber im EU-Ausland | `AE` |
| § 19 Kleinunternehmer | wenn du in den Stammdaten als Kleinunternehmer geführt bist | `E` |
| § 4 steuerfrei | medizinische / Bildungs- / etc. steuerfreie Umsätze | `E` |

Bei den Sonderfällen wird der **§-Hinweis** automatisch als
`TaxExemptionReason` in die XML eingebaut — also nicht handgeschriebener
Text, sondern strukturiert.

### 4.3 Positionen

Pro Position: Bezeichnung, Menge, Einheit (UN/ECE Recommendation 20:
`C62` Stück, `HUR` Stunde, `DAY` Tag, `KGM` kg, …), Einzelpreis, USt-Satz.
Live-Vorschau rechts zeigt sofort Brutto und den §-14-Pflichtcheck.

### 4.4 Speichern oder Versenden

- **Entwurf speichern** — bleibt editierbar. Noch keine Rechnungsnummer,
  noch keine Buchung. Du kannst beliebig oft zurück und ändern.
- **Versenden & festschreiben** — vergibt die nächste freie Nummer aus
  dem Nummernkreis, erzeugt den Buchungssatz (siehe unten) und markiert
  Rechnung **und** Buchung als GoBD-fest (Hash in der Prüfkette).
  Danach nur noch per Stornobuchung änderbar.

### 4.5 Automatisch erzeugte Buchungssätze

Regelfall (19 %):

```
1200 / 4400   Forderung aLuL gegen Erlöse 19 % (Netto-Anteil)
1200 / 3806   Forderung aLuL gegen Umsatzsteuer 19 % (USt-Anteil)
```

Mit ermäßigtem Satz (7 %): analog `4300` und `3801`.

§ 13b Reverse-Charge: **keine** USt-Buchung, dafür eigenes Erlöskonto:

```
1200 / 4336   Forderung aLuL gegen Erlöse § 13b (gesamter Betrag)
```

Innergemeinschaftliche Lieferung / § 4 steuerfrei:

```
1200 / 4180   Forderung aLuL gegen steuerfreie Erlöse (innergem.)
```

§ 19 Kleinunternehmer (keine USt-Trennung, da kein Steuerausweis):

```
1200 / 4400   Forderung aLuL gegen Erlöse (Bruttosumme)
```

Wenn deine Rechnung Positionen mit **gemischten USt-Sätzen** hat (z. B.
19 % und 7 % gemischt), erzeugt OpenBilanz pro Satz **getrennte
Buchungen**, damit die Aufteilung im Buchungsjournal sichtbar bleibt.

---

## 5. XRechnung-XML herunterladen

Im Rechnungs-Editor stehen zwei Download-Knöpfe:

- **XRechnung-UBL** — UBL-Syntax (häufiger im DE-Markt). Customization-ID
  `urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0`.
- **XRechnung-CII** — UN/CEFACT CII-Syntax. Identische Daten, identische
  XRechnung-Konformität, andere Syntax. Auch die Basis für ZUGFeRD-Hybrid.

Beide sind gleichberechtigte EN-16931-Auspräge­n. Welche du an deinen
Empfänger schickst, hängt von dessen Präferenz ab. Wenn nichts gesagt ist:
UBL ist sicherer Default.

### Externe Validierung

Vor produktiver Nutzung empfehlen wir, eine erzeugte XML einmal mit dem
**KoSIT-Validator** (Apache 2.0, Java-CLI) zu prüfen:

```
java -jar validationtool-X.Y.Z.jar -s scenarios.xml deine-rechnung.xml
```

Der prüft das amtliche XSD **und** die Schematron-Geschäftsregeln. Diese
Validierung läuft serverseitig — wir bauen sie bewusst nicht in OpenBilanz
ein, weil Java + XSLT-2-Schematron im Browser zu schwergewichtig wäre.

---

## 6. ZUGFeRD-Hybrid-PDF (optional)

### 6.1 Einmaliges Setup

Die Hybrid-PDF braucht eine PDF-Engine. Damit nichts zur Laufzeit aus dem
Netz nachgeladen wird, ist sie als Setup-Skript organisiert (analog zu
Pyodide / Arelle):

```bash
./tools/setup-pdf-lib.sh
```

Das lädt einmalig nach `public/vendor/`:

- **pdf-lib** (MIT) — die PDF-Engine, ca. 1 MB / 300 KB gzipped
- **sRGB IEC61966-2.1** (Public Domain) — Farbprofil für PDF/A-3
- **Liberation Sans** (SIL-OFL) — freie Schrift, eingebettet ins PDF

Das `public/vendor/`-Verzeichnis ist gitignored. Setup einmal ausgeführt,
und der **ZUGFeRD-PDF**-Knopf erscheint im Rechnungs-Editor automatisch.

### 6.2 Was du bekommst

Eine PDF mit:

- lesbarem Rechnungs-Layout (Standard DE),
- eingebetteter Factur-X-CII-XML (`factur-x.xml`) mit
  AFRelationship=Alternative,
- Standard-Metadaten (Title, Subject, Creator).

Die eingebettete XML kannst du mit OpenBilanz' eigenem
`parseERechnungPdf` wieder zurücklesen — Roundtrip-Test.

### 6.3 Konformitäts-Hinweis (wichtig)

OpenBilanz erzeugt eine **funktionierende** Hybrid-PDF — Empfänger können
die XML extrahieren und maschinell verarbeiten. Die **strikt-PDF/A-3-
Konformität** im Sinne der ISO 19005-3 (vollständiger XMP-Stream mit
`pdfaid:part=3`, OutputIntent mit ICC-Profil als Stream, Tagged-PDF-
Struktur) ist noch **nicht extern Mustang-validiert**. Wenn dein
Empfänger explizit auf strikte PDF/A-3 besteht, prüfe die PDF einmal mit
dem [Mustang-Validator](https://www.mustangproject.org/) (Apache 2.0,
Java-CLI) und melde im Issue-Tracker, was fehlt.

Für die meisten B2B-Inland-Empfänger ist die reine XRechnung-XML
ausreichend; die Hybrid-PDF ist **Komfort, keine Pflicht**.

---

## 7. USt-IdNr.-Prüfung

Im Kunden-Editor (und in deinen eigenen Rechnungs-Angaben):

- **Strukturprüfung** — Format-Check für alle EU-/EWR-Staaten + Nordirland
  (XI). Für **DE** (ISO 7064 MOD 11-10), **AT**, **NL**, **IT** wird
  zusätzlich die Prüfziffer mathematisch verifiziert. Andere Staaten:
  „Format ok, Prüfziffer für \<Staat\> nicht implementiert" — gelber
  Hinweis, kein roter Fehler.
- **Qualifizierte Online-Bestätigung** — nur im Selbst-Hosting-Modus.
  Knopf „USt-IdNr. online bei VIES prüfen" → Datenschutz-Hinweis →
  Aufruf bei der EU-Datenbank (`ec.europa.eu/taxation_customs/vies`) →
  Antwort wird beim Kunden archiviert. Wichtig für Betriebsprüfungen bei
  innergemeinschaftlichen Geschäften.

---

## 8. Was offen ist

Siehe [BACKLOG.md](BACKLOG.md) — dort steht, welche Validierungen am
neuen Code noch fehlen, bevor die jeweilige Funktion im README von 🟡 auf
✅ wandern kann (KoSIT-Validator-Lauf, Mustang-PDF-Check, reale
Beispiel-Rechnungen).

## 9. Datenschutz auf einen Blick

| Aktion | Wohin gehen Daten? |
|---|---|
| XRechnung-XML lesen / schreiben | nur lokal (Browser oder Datei) |
| ZUGFeRD-PDF lesen | nur lokal (PDF-Anhang wird im Browser entpackt) |
| ZUGFeRD-PDF schreiben | nur lokal (pdf-lib läuft im Browser) |
| USt-IdNr. — Strukturprüfung | nur lokal (Algorithmus im Browser) |
| USt-IdNr. — VIES-Online-Prüfung | USt-IdNr. an `ec.europa.eu` — nur nach explizitem Klick |

Kein Buchhaltungsdatum verlässt deinen Rechner ohne deinen Klick.
