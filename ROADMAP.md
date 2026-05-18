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

→ **Offen / wiederkehrend:** Sobald die neue Kerntaxonomie („7.0", erwartet
~Mai/Juni 2026) veröffentlicht ist, Namespace-URIs und Elementnamen gegen die
neue XSD prüfen und migrieren. Siehe Beobachtungsliste (Abschnitt 5).

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
| **Bankimport: Regelliste** | Nutzerpflegbares Kontierungs-Regelwerk statt des fest eingebauten Regelwerks. | M | M |
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
| **Geführter Erfassungs-Assistent** | Schrittweise Eingabe in kleinen Abschnitten statt eines großen Formulars. | M | M |
| **Kontexthilfe (Tooltips)** | §-Verweise und Fachbegriffe in den Formularen per Tooltip mit dem Glossar verknüpfen. Das durchsuchbare Glossar selbst ist umgesetzt. | M | M |
| **Versionierung der Bilanzwerte** | Änderungsprotokoll auch für die Bilanz-/GuV-Werte eines Abschlusses. Das Stammdaten-Änderungsprotokoll ist umgesetzt; strukturelle Abschluss-Ereignisse stehen bereits im Abschluss-Protokoll. | N | M |
| **Barrierefreiheit (WCAG 2.1/2.2 AA)** | Tastaturbedienung, Kontraste, Beschriftungen, Überschriftenhierarchie. | M | M |

---

## 5. Regulatorische Beobachtungsliste

Parameter und Regeln, von denen OpenBilanz abhängt. **Beschlossen** = geltendes
bzw. veröffentlichtes Recht · **geplant** = Vorhaben/Entwurf, noch nicht in Kraft.

| Parameter | Aktueller Wert | Nächste Änderung | Status | OpenBilanz-Auswirkung |
|---|---|---|---|---|
| E-Bilanz-Kerntaxonomie | 6.9 (01.04.2025) | „7.0" jährlich, erwartet ~Mai/Juni 2026 | beschlossen | `taxonomie.js`: Namespace/Elemente prüfen (siehe 1.2) |
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
