# OpenBilanz — Roadmap & Weiterentwicklung

Dieses Dokument sammelt die **offenen** Weiterentwicklungen von OpenBilanz. Es
ist eine Ideensammlung mit Bewertung, keine verbindliche Zusage. Grundlage ist
eine Recherche im Open-Source-Umfeld (u. a. `quambene/taxel`,
`Uli-Z/pytaxel`, `scka-de/german-accounting`, `laroche/trading-gmbh`,
`GalieJJ/accounti`, `nicolettas-muggelbude/RechnungsFee`) sowie amtlicher
Quellen (BMF-Schreiben, esteuer.de, gesetze-im-internet.de, ELSTER).

Bereits umgesetzte Funktionen sind hier **nicht mehr aufgeführt** — sie stehen
in der [README](README.md) (Funktionstabelle) und der Git-Historie.

Bewertungslegende: **Nutzen** H/M/N (hoch/mittel/niedrig) ·
**Aufwand** S/M/L/XL · Stand: 2026-05.

> ⚠️ Die Angaben zu Gesetzeslage und Fristen wurden nach bestem Wissen
> recherchiert, ersetzen aber **keine fachliche Prüfung**. Punkte im Abschnitt
> „Korrektheits-Hinweise" sollten vor einer Umsetzung mit fachkundiger Person
> (Steuerberater) gegengeprüft werden.

---

## 1. Korrektheits-Hinweise (vorrangig prüfen)

Diese Punkte betreffen die **fachliche Richtigkeit** der bestehenden Ausgabe und
sind vor produktiver Nutzung mit fachkundiger Person (Steuerberater)
gegenzuprüfen.

### 1.1 Kontennachweise — taxonomiekonforme Einzelfeld-Übermittlung

`public/shared/xbrl.js` erzeugt die unverdichteten Kontennachweise je
HGB-Position bereits aus dem SKR04-Journal, führt sie der E-Bilanz-Datei als
Kontensalden-Aufstellung bei und setzt das Härtefall-Mussfeld
`genInfo.report.id.reportElements.transmissionNotYetPossible`.

→ **Offen:** die taxonomiekonforme Einzelfeld-Übermittlung der Kontennachweise
gegen die `de-gaap-ci`-6.9-XSD verifizieren — derzeit als beigefügte Aufstellung,
nicht als gegen die Taxonomie geprüfte Einzelfelder. Nutzen H · Aufwand M.

### 1.2 Taxonomie-Version jährlich nachziehen

`taxonomie.js` ist auf Version 6.9 (Stand 01.04.2025), enthält eine
Upgrade-Checkliste und ist über `VERSION`/`STAND` parametrisiert. Die
Finanzverwaltung gibt **jährlich um den 1. April** eine neue Kerntaxonomie
heraus.

→ **Offen / wiederkehrend:** Stand 2026-06 ist auf esteuer.de **weiterhin 6.9
(01.04.2025) die aktuellste** veröffentlichte Version — eine erwartete „7.0" ist
bislang **nicht** erschienen. Sobald eine neue Kerntaxonomie veröffentlicht wird,
Namespace-URIs und Elementnamen gegen die neue XSD prüfen und migrieren. Siehe
Beobachtungsliste (Abschnitt 5).

---

## 2. Arelle-Vollvalidierung im Browser (Pyodide)

Die Website-Variante (IndexedDB-Datenhaltung, `.obz`-Export/Import mit
optionaler Verschlüsselung, File System Access API, PWA, strenge CSP,
Dual-Mode) ist umgesetzt; der Website-Modus prüft die E-Bilanz zuverlässig per
JS-Konsistenzprüfung.

**Offen:** die vollständige Taxonomie-Validierung via Arelle/Pyodide im Browser.
Sie liegt als **experimentelles Gerüst** vor — Setup-Skript
`tools/setup-pyodide.sh`, Web-Worker `public/pyodide-worker.js`,
Opt-in-Schaltfläche — und ist im Browser zu erproben und fertigzustellen.
Nutzen M · Aufwand XL.

---

## 3. Funktionale Erweiterungen

### Ausbau bestehender Funktionen

Die Kernfunktionen (GmbH-Untertypen, Anlagenverzeichnis & AfA, DATEV-Export,
Bankimport CAMT.053/MT940, UStVA-Aufbereitung, Offenlegung, Broker-Import,
E-Rechnung, BWA, KapSt-Assistent) sind umgesetzt. Offen bleiben folgende
Ausbau- und Verifikationsschritte:

| Punkt | Beschreibung | Nutzen | Aufwand |
|---|---|---|---|
| **DATEV-Export verifizieren** | EXTF-Kopfzeile vor produktiver Nutzung gegen die aktuelle DATEV-Formatbeschreibung gegenprüfen. | M | S |
| **UStVA: ELSTER-Datensatz** | Einen ELSTER-importierbaren UStVA-Datensatz erzeugen — bisher nur Kennzahlen-Aufbereitung, Versand über ELSTER. | M | M |
| **Offenlegung verifizieren** | Amtlich gefordertes Einreichungsformat des Unternehmensregisters vor der Übermittlung prüfen. | M | S |

### Bewusst offen

- **ERiC-Übermittlung** — nicht baubar: ERiC ist registrierungspflichtig und
  nicht weiterverteilbar. Die E-Bilanz-Ansicht dokumentiert den ERiC-Weg.
- **SKR03 zusätzlich zu SKR04** — braucht eine geprüfte SKR03-Kontenliste (nicht
  aus dem Gedächtnis transkribieren — Korrektheitsrisiko) und einen Refactor der
  auf SKR04 verdrahteten Komfortfunktionen. Eigener fokussierter Schritt.
- **Getrennte Rechenkreise operativ/Kapitalanlage** — der getrennte Ausweis von
  operativem Teil und Kapitalanlageteil einer Hybrid-GmbH ist bewusst nicht
  erfolgt; die typabhängigen Steuerhinweise reichen für die
  Orientierungsrechnung.

### Voraussichtlich außerhalb des Fokus

- **Lohnabrechnung** — eigene, haftungsintensive Domäne; dedizierte Software nutzen.
- **FinTS/HBCI-Direktabruf** — Zugangsdaten-Handling + nur AGPL-Bibliothek;
  Dateiimport deckt den Großteil des Nutzens ab.
- **KI-gestützte Kontierung** — widerspricht dem Offline-/Zero-Dependency-Prinzip;
  regelbasierte Kontierung erreicht fast dasselbe.
- **Voll-Rechnungsstellung / OSS-EU-Umsatzsteuer** — großer Themensprung weg
  von „Bilanz & Abschluss".

---

## 4. Produktqualität & Vertrauen

| Idee | Beschreibung | Nutzen | Aufwand |
|---|---|---|---|
| **Mehrere GmbHs (Mandanten)** | Aktuell ist `data/unternehmen.json` einfirmig; vv-GmbH-Inhaber halten oft mehrere Gesellschaften. | H | M |
| **Mehrjahres-Verwaltung** | Zeitleiste je Mandant (EB → JA 2024 → JA 2025 …). Die Übernahme der Bestände ins Folgejahr ist als Eröffnungsbuchung bereits umgesetzt; offen ist die mandantenweite Jahres-Zeitleiste. | M | M |
| **Erfassungs-Assistent für den Jahresabschluss** | Den geführten Erfassungs-Assistenten (bisher für die Eröffnungsbilanz) auf den Jahresabschluss inkl. GuV ausweiten. | N | M |
| **Kontexthilfe ausrollen** | Den Glossar-Tooltip (`gtip`) über die Steuer-Ansicht hinaus auf weitere Formulare und §-Verweise ausrollen. Tooltip-Mechanismus und durchsuchbares Glossar sind umgesetzt. | N | S |
| **Versionierung der Bilanzwerte** | Änderungsprotokoll auch für die Bilanz-/GuV-Werte eines Abschlusses. Das Stammdaten-Änderungsprotokoll ist umgesetzt; strukturelle Abschluss-Ereignisse stehen bereits im Abschluss-Protokoll. | N | M |
| **Barrierefreiheit: Audit** | Kontraste, Überschriftenhierarchie und ein Screenreader-Durchgang gegen WCAG 2.2 AA prüfen. Tastaturbedienung, Fokus-Indikatoren, Dialog-Rollen und der Sprunglink sind umgesetzt. | M | M |

---

## 5. Regulatorische Beobachtungsliste

Parameter und Regeln, von denen OpenBilanz abhängt. **Beschlossen** = geltendes
bzw. veröffentlichtes Recht · **geplant** = Vorhaben/Entwurf, noch nicht in Kraft.

| Parameter | Aktueller Wert | Nächste Änderung | Status | OpenBilanz-Auswirkung |
|---|---|---|---|---|
| E-Bilanz-Kerntaxonomie | 6.9 (01.04.2025) — Stand 2026-06 weiterhin aktuellste; keine „7.0" erschienen | neue Version jährlich (Finanzverwaltung, meist ~01.04.) | beschlossen | `taxonomie.js`: bei neuer Version Namespace/Elemente prüfen (siehe 1.2) |
| Taxonomie 6.9 Pflicht | WJ ab 01.01.2026; WJ 2025 zulässig | — | beschlossen | Hinweis in Doku/Tool |
| Kontennachweis-Pflicht | WJ ab 01.01.2025 | — | beschlossen | siehe 1.1 — erzeugt; Einzelfeld-Übermittlung noch zu verifizieren |
| Körperschaftsteuersatz | 15 % (bis VZ 2027) | 14 % (2028) … 10 % (ab 2032) | beschlossen | umgesetzt — `KST_SATZ` jahresabhängig |
| Solidaritätszuschlag | 5,5 % der KSt | keine Satzänderung | beschlossen | `SOLI_SATZ` korrekt |
| GewSt-Steuermesszahl | 3,5 % | keine Änderung | beschlossen | `GEWST_MESSZAHL` korrekt |
| GewSt-Mindesthebesatz | 200 % | 280 % ab 2027 | geplant | Hebesatz wird vom Nutzer eingegeben — kein Bruch |
| HGB-Schwellenwerte § 267/267a | erhöhte Werte (Gesetz 16.04.2024) | keine Änderung angekündigt | beschlossen | `positionen.js` korrekt |
| Mindeststammkapital GmbH | 25.000 € / 12.500 € | keine Änderung | beschlossen | `berechnung.js` korrekt |
| E-Rechnung (B2B) | Empfang Pflicht seit 01.01.2025 | Versand: > 800.000 € ab 2027, alle ab 2028 | beschlossen | nur relevant, falls Rechnungsfunktionen ergänzt werden |
| GoBD | BMF-Schreiben in der Fassung 2025 | Folgeänderungen wahrscheinlich | beschlossen | Audit-Trail/Versionierung empfohlen (Abschnitt 4) |

---

## 6. Verwandte Projekte

Siehe Abschnitt „Verwandte Projekte & Ressourcen" in der
[README](README.md#verwandte-projekte--ressourcen) sowie die Lizenz- und
Quellenlage in [DRITTQUELLEN.md](DRITTQUELLEN.md).

---

## 7. Trading-GmbH-Anwendungsfälle (Quelle: laroche/trading-gmbh)

Abgleich mit dem Handbuch `laroche/trading-gmbh` (CC0), das den
Buchhaltungsalltag einer wertpapierhandelnden vermögensverwaltenden GmbH
beschreibt. Folgende Anwendungsfälle deckt OpenBilanz noch nicht ab:

| Anwendungsfall | Beschreibung | Nutzen | Aufwand |
|---|---|---|---|
| **Verluste aus Wertpapier-Abgang (UV)** | SKR04 kennt 4906 (Erträge aus Abgang Umlaufvermögen), aber kein Verlust-Pendant. Trading-Verkäufe mit Verlust brauchen ein eigenes Konto (SKR04 6905). | H | S |
| **Wertpapier-Buchungshilfe Trading-GmbH** | Erklärte Buchungssätze: Kauf/Verkauf von Wertpapieren des Umlaufvermögens (1500/1510), Gewinn-/Verlustrealisierung, Depot-/Ordergebühren. | H | S |
| **Anrechenbare ausländische Quellensteuer** | Konto für Quellensteuer auf ausländische Dividenden und deren Anrechnung auf die Körperschaftsteuer (§ 26 KStG) in der Steuerschätzung. | H | M |
| **Strenges Niederstwertprinzip (§ 253 Abs. 4 HGB)** | Jahresend-Bewertung der Wertpapiere des Umlaufvermögens; Plausibilitätsprüfung „Kurswert < Anschaffungskosten?" und außerplanmäßige Abschreibung (7210). | M | M |
| **Fremdwährung & Währungsumrechnung** | Fremdwährungsbestände, Erträge/Aufwände aus Währungsumrechnung, Stichtagsbewertung (§ 256a HGB). | M | M |
| **Stillhaltergeschäfte / Optionsprämien** | Vereinnahmte Optionsprämien, Glattstellung, Rückstellung für drohende Verluste aus schwebenden Geschäften (§ 249 Abs. 1 HGB). | M | M |
| **Termingeschäfte (Futures/CFD)** | Variation Margin über ein Verrechnungskonto, Ergebnisrealisierung bei Glattstellung. | N | M |
| **Nebenkosten des Geldverkehrs** | Eigenes Aufwandskonto für Bank-/Depotgebühren (SKR04 6855) statt Sammelposten 6300. | N | S |

> Hinweis: Fonds-Spezialthemen (Vorabpauschale, Teilfreistellung nach InvStG)
> behandelt das Handbuch nicht — sie sind hier bewusst nicht aufgenommen.

---

## 8. Quality-of-Life-Updates

Sammlung kleinerer und mittlerer Verbesserungen am bestehenden Funktionsumfang.
Stand der Recherche: Mai 2026, Gegenüberstellung mit `laroche/trading-gmbh`,
`tgw013/HGB-accounting-plugin`, `BadRix90/datev-mcp`, `RechnungsFee` und
`ZUGFeRD/mustangproject`. Bewertungslegende wie oben (Nutzen H/M/N · Aufwand
S/M/L).

### 8.1 Erfassung & Buchen schneller

| Idee | Skizze | Nutzen | Aufwand |
|---|---|---|---|
| **Command-Palette (Cmd/Ctrl+K)** | Suchleiste, die zu jedem Reiter/Konto/Buchung/Glossarbegriff springt. Zero-Dep: Fuzzy-Match in JS. | H | S |
| **Buchungsvorlagen / Favoriten** | Häufige Geschäftsvorfälle (Bürobedarf, GF-Gehalt, KSt-VZ) als Templates mit Default-Konten und USt-Schlüssel. Persistiert pro Mandant. | H | S |
| **Wiederkehrende Buchungen** | Buchung als monatlich/quartalsweise markieren → im Folgemonat als Entwurf vorgeschlagen, nach Sichtung festschreibbar. | H | M |
| **Autocomplete Buchungstext + Gegenkonto** | Aus dem eigenen Journal lernen: wenn „Adobe" 3× auf 6855 gebucht wurde, beim nächsten Mal vorschlagen. Frequency-Count, keine KI. | H | S |
| **Buchungs-Validator pro Zeile** | Schon beim Erfassen prüfen, ob Konto + USt-Schlüssel zusammenpassen; § 13b-Konten brauchen Reverse-Charge-Markierung. | M | S |
| **Tastatur-Workflow konsolidiert** | Enter = nächste Spalte, Shift+Enter = neue Buchung, Esc = Stornoassistent. Teils umgesetzt, lohnt sich konsolidiert. | M | S |

### 8.2 Übersicht & Termine

| Idee | Skizze | Nutzen | Aufwand |
|---|---|---|---|
| **Fristen-Dashboard mit Ampel** | Kachel-Startseite: UStVA-10., Jahresabschluss-Frist § 264 HGB, Offenlegung 12 Monate, Aufbewahrung § 257 AO. Aus statischer „Fristen & Pflichten"-Liste eine lebende Übersicht. | H | M |
| **Diff-View Vorjahr/Aktuell** | Bilanz und GuV nebeneinander, Δ in € und % je Position. Die Vorjahresspalte ist da — eine Detail-Diff-Ansicht macht Plausibilität sofort sichtbar. | H | S |
| **BWA-Kommentar-Felder** | Pro Monat/Quartal ein Textfeld zur Kommentierung der BWA, Print-Layout enthält die Kommentare. | M | S |
| **Saldenliste mit Trend-Sparkline** | Pro Konto eine SVG-Polyline aus den Monatssalden — keine Library. | M | S |
| **Steuerberater-Paket (One-Click-ZIP)** | DATEV-EXTF + PDF Bilanz/GuV/Anhang + Saldenliste + Buchungsjournal CSV + Manifest in einer ZIP-Datei. Bausteine existieren. | H | S |

### 8.3 Belege & Nachvollziehbarkeit

| Idee | Skizze | Nutzen | Aufwand |
|---|---|---|---|
| **Belegarchiv pro Buchung** | Optional PDF/Bild als Anhang an die Buchung, SHA-256 in die Prüfkette aufgenommen. JSON speichert Hash + Pfad/Blob, Datei selbst in `data/belege/` bzw. IndexedDB-Blob. | H | M |
| **E-Rechnungs-Dedup** | Hash der eingelesenen XRechnung-/ZUGFeRD-XML speichern → Wiedereinlesen warnt automatisch. | H | S |
| **Importprotokoll** | Pro CAMT/MT940/DATEV-Import ein Protokolleintrag (Datei, Zeitpunkt, Anzahl Buchungen, übersprungene Zeilen, Hash). | M | S |
| **Lückenanalyse Belegnummern** | Sequenz-Check für laufende Eingangsbelegnummern. | M | S |

### 8.4 Plausibilität vor der Abgabe (Closing-Checklisten)

| Idee | Skizze | Nutzen | Aufwand |
|---|---|---|---|
| **Closing-Checkliste Jahresabschluss** | Bank/Kasse abgestimmt? Anlagenspiegel gebucht? Steuerrückstellung gestellt? Periodenabgrenzung geprüft? Offenlegung vorbereitet? — OK/offen-Marker mit Sprung in die Ansicht. | H | M |
| **Closing-Checkliste UStVA** | Vor Übergabe an ELSTER: 1576/1776/3801/3806 ausgeglichen? Kz 81/86/66/83 plausibel? Keine offenen Buchungen im Monat? | M | S |
| **„Warum kommt diese Zahl?"** | In Bilanz/GuV jede Position aufklappbar → zugrunde liegende SKR04-Konten und Salden. | H | M |
| **§-Tooltip in Buchungsmaske** | `gtip`-Glossar in der Buchungsmaske bei USt-Schlüsseln und Spezialkonten (4336, 6905). | M | S |

### 8.5 Datenhygiene & Pflege

| Idee | Skizze | Nutzen | Aufwand |
|---|---|---|---|
| **Health-Check beim Start** | Beim Öffnen prüfen: Stammdaten vollständig? Anlagen aktuell? letzte Buchung wann? — kleine Status-Banner. | M | S |
| **Mandanten-Pinning** | Bei Mehrmandanten: Hotkey 1–9 für schnellen Wechsel. | M | S |
| **Backup-Erinnerung** | Im Website-Modus: nach n festschreibenden Aktionen oder x Tagen Hinweis „letzte `.obz` ist X Tage alt". | M | S |
| **Export-Diff DATEV** | Beim erneuten DATEV-Export Differenz zur letzten Ausgabe zeigen (nur neue Buchungen markieren). | M | M |

### 8.6 Kleine Schmankerl

- **Druckvorschau direkt in der App** statt Browser-Dialog — vereinheitlicht das Layout zwischen den Modi.
- **Mausrad-Multiplikator in Beträgen** (Shift = ×10, Alt = ÷10) — hilft beim Tippen großer Anlagenwerte.
- **„Heute"-Knopf** in jedem Datumsfeld.
- **Onboarding-Tour** beim ersten Start (3 Schritte, „nicht mehr zeigen"-Option).
