# OpenBilanz — Roadmap & Weiterentwicklung

Dieses Dokument sammelt mögliche Weiterentwicklungen von OpenBilanz. Es ist
eine **Ideensammlung mit Bewertung**, keine verbindliche Zusage. Grundlage ist
eine Recherche im Open-Source-Umfeld (u. a. `quambene/taxel`,
`Uli-Z/pytaxel`, `scka-de/german-accounting`, `laroche/trading-gmbh`,
`GalieJJ/accounti`, `nicolettas-muggelbude/RechnungsFee`) sowie amtlicher
Quellen (BMF-Schreiben, esteuer.de, gesetze-im-internet.de, ELSTER).

Bewertungslegende: **Nutzen** H/M/N (hoch/mittel/niedrig) ·
**Aufwand** S/M/L/XL · Stand der Recherche: 2026-05.

> ⚠️ Die Angaben zu Gesetzeslage und Fristen wurden nach bestem Wissen
> recherchiert, ersetzen aber **keine fachliche Prüfung**. Punkte im Abschnitt
> „Korrektheits-Hinweise" sollten vor einer Umsetzung mit fachkundiger Person
> (Steuerberater) gegengeprüft werden.

---

## ✅ Bereits umgesetzt (Stand 2026-05)

Seit der ersten Roadmap-Fassung umgesetzt — Details in der
[README](README.md) und der Git-Historie:

- **Website-Variante mit lokaler Datenhaltung** (Abschnitt 2) — IndexedDB,
  `.obz`-Export/Import mit optionaler Verschlüsselung, PWA, strenge CSP,
  Dual-Mode. Arelle-im-Browser via Pyodide als experimentelles Gerüst.
- **GoBD-Festschreibung der Buchungen** — festgeschriebene Buchungen sind
  unveränderlich, Korrektur nur per Stornobuchung, mit Änderungsprotokoll.
- **Eröffnungsbuchungen / Saldenvortrag** — Übernahme der Bestände aus
  Eröffnungsbilanz bzw. Vorjahr in die Jahresabschluss-Buchhaltung gegen das
  Eröffnungsbilanzkonto 9000.
- **Buchungshilfe** — Reiter mit erklärten Standard-Buchungssätzen (Gründung,
  Eröffnungsbuchungen, Anlagen/Abschreibung, digitale Betriebsmittel, laufende
  Kosten, Jahresabschluss).
- **Gesellschafterbeschluss-Generator** — druckbare Vorlagen für Feststellung
  des Jahresabschlusses, Ergebnisverwendung, Einforderung ausstehender
  Einlagen, Geschäftsführer-Beschlüsse sowie Freitext-Beschlüsse.
- **Kontennachweise zur E-Bilanz** — unverdichtete Kontensalden je HGB-Position
  aus dem SKR04-Journal, Härtefall-Mussfeld gesetzt (Abschnitt 1.1).
- **Jahresabhängiger Körperschaftsteuersatz** — 15 % bis VZ 2027, danach
  stufenweise bis 10 % ab 2032 (Abschnitt 1.2).
- **GmbH-Untertypen** — Immobilien-, Trading- und Hybrid-GmbH mit
  typspezifischen Steuerhinweisen (Abschnitt 3, B1).
- **Anlagenverzeichnis & AfA** — lineare/degressive Abschreibung, Anlagenspiegel,
  AfA-Buchungen (Abschnitt 3, B2).
- **DATEV-Export** — Buchungsstapel im EXTF-Format (Abschnitt 3, B3).
- **Bankimport CAMT.053** — Kontoauszug-Import mit Kontovorschlägen (Abschnitt 3, B4).
- **UStVA-Aufbereitung** — Umsatzsteuer-Voranmeldung aus den SKR04-Konten
  (Abschnitt 3, B5).
- **Offenlegung** — Offenlegungs-Dokument für das Unternehmensregister
  (Abschnitt 3, B6).

---

## 1. Korrektheits-Hinweise (vorrangig prüfen)

Diese Punkte betreffen nicht neue Funktionen, sondern die **fachliche
Richtigkeit** der bestehenden Ausgabe. Alle drei sind inzwischen umgesetzt —
siehe die ✅-Vermerke; die dort genannten Verifikationsschritte bleiben offen.

### 1.1 Kontennachweise fehlen in der E-Bilanz

`public/shared/xbrl.js` überträgt aktuell nur die verdichteten Bilanz- und GuV-Positionen
(`de-gaap-ci`-Fakten) sowie die Stammdaten (`de-gcd`). **Kontensalden auf
Kontenebene werden nicht ausgegeben.**

Nach Recherche (JStG 2024, BGBl. 2024 I Nr. 387) sind für Wirtschaftsjahre, die
**nach dem 31.12.2024** beginnen, zu den werthaltigen Bilanz- und
GuV-Positionen **unverdichtete Kontennachweise** (Kontonummer, -bezeichnung,
-saldo) mitzuübermitteln. Die Taxonomie 6.9 enthält für den Härtefall ein neues
Mussfeld `genInfo.report.id.reportElements.transmissionNotYetPossible`
(Freitext-Erläuterung). OpenBilanz erzeugt derzeit **weder die Kontennachweise
noch dieses Härtefall-Feld**.

→ Mindestmaßnahme: das Härtefall-Mussfeld mit Erläuterungstext füllen.
Vollausbau: Kontensalden aus dem SKR04-Journal als Kontennachweise mitgeben.
**Vor Umsetzung fachlich verifizieren.** Nutzen H · Aufwand M.

**✅ Umgesetzt:** `xbrl.js` erzeugt die Kontensalden je HGB-Position aus dem
SKR04-Journal, führt sie der E-Bilanz-Datei als Kontensalden-Aufstellung bei und
setzt das Härtefall-Mussfeld. Die E-Bilanz-Ansicht zeigt den Kontennachweis als
Tabelle. **Offen:** die taxonomiekonforme Einzelfeld-Übermittlung der
Kontennachweise gegen die de-gaap-ci-6.9-XSD verifizieren.

### 1.2 Körperschaftsteuersatz fest auf 15 %

`public/shared/steuer.js` setzt `KST_SATZ = 0.15`. Das ist für die
Veranlagungszeiträume 2026 und 2027 korrekt. Nach dem „Gesetz für ein
steuerliches Investitionssofortprogramm" (Mitte 2025 in Kraft) sinkt der
Körperschaftsteuersatz stufenweise: **2028 → 14 %, 2029 → 13 %, 2030 → 12 %,
2031 → 11 %, ab 2032 → 10 %**.

→ `KST_SATZ` sollte vom Veranlagungszeitraum abhängig gemacht werden. Relevant
auch bereits heute für die Bewertung latenter Steuern. Nutzen H · Aufwand S.

**✅ Umgesetzt:** `steuer.js` bestimmt den Körperschaftsteuersatz aus dem
Veranlagungszeitraum (Wirtschaftsjahr-Ende): 15 % bis 2027, dann 14/13/12/11/
10 % ab 2028–2032.

### 1.3 Taxonomie-Version jährlich nachziehen

`taxonomie.js` (Version 6.9, Stand 01.04.2025) ist aktuell. Die
Finanzverwaltung gibt **jährlich um den 1. April** eine neue Kerntaxonomie
heraus. 6.9 ist verpflichtend für Wirtschaftsjahre, die **nach dem 31.12.2025**
beginnen (Nichtbeanstandung: auch für WJ 2025 nutzbar).

→ Wiederkehrende Aufgabe: Namespace-URIs und Elementnamen bei jedem
Versionswechsel gegen die neue XSD prüfen. Siehe Beobachtungsliste (Abschnitt 5).

**✅ Dokumentiert:** `taxonomie.js` enthält eine Upgrade-Checkliste für den
Versionswechsel; die Versionsbehandlung ist über `VERSION`/`STAND`
parametrisiert. Eine Migration erfolgt, sobald die neue Kerntaxonomie
veröffentlicht ist.

---

## 2. Website-Variante mit lokaler Datenhaltung

> ✅ **Umgesetzt (Kern-Variante).** IndexedDB-Datenhaltung, `.obz`-Export/Import
> mit optionaler Verschlüsselung (PBKDF2/AES-GCM), File System Access API mit
> Download-Rückfall, Export-beim-Speichern, PWA (Manifest + Service Worker),
> strenge CSP und der Dual-Mode (das Selbst-Hosting bleibt unverändert lauffähig)
> sind implementiert. Die vollständige Taxonomie-Validierung via Arelle/Pyodide
> im Browser ist als **experimentelles Gerüst** angelegt (Setup-Skript
> `tools/setup-pyodide.sh`, Web-Worker, Opt-in-Schaltfläche) und im Browser zu
> erproben; bis dahin prüft der Website-Modus zuverlässig per
> JS-Konsistenzprüfung.

**Idee:** OpenBilanz als öffentliche Website betreiben, bei der **alle
Nutzerdaten ausschließlich im Browser des Nutzers** bleiben — keine
Server-Verarbeitung, keine Übertragung. Der Betreiber hätte damit **keinerlei
Kenntnis** von Steuerdaten („Zero-Knowledge" / local-first).

Das ist technisch gut machbar und für OpenBilanz besonders naheliegend: Der
gesamte Rechenkern (`positionen.js`, `berechnung.js`, `taxonomie.js`,
`skr04.js`, `steuer.js`) läuft **heute schon im Browser**. Auch die
XBRL-Erzeugung (`lib/xbrl.js`) ist reines JavaScript ohne Node-Abhängigkeiten.

### Empfohlene Architektur

- **Speicherung:** `IndexedDB` als primärer Speicher (strukturiert,
  transaktional, MB–GB Kapazität). `localStorage` ist mit 5 MB und synchroner
  API ungeeignet.
- **Persistenz absichern:** `navigator.storage.persist()` aufrufen — sonst kann
  der Browser die Daten bei Speicherdruck verwerfen (Safari löscht
  Skript-Speicher schon nach ~7 Tagen Inaktivität).
- **Backup/Restore:** Export/Import als Datei (`.json` bzw. verschlüsseltes
  `.obz`); auf Chromium zusätzlich `File System Access API` für direktes
  Speichern/Öffnen. Diese Datei ist das eigentliche, GoBD-tauglich zu
  archivierende Dokument des Nutzers.
- **Verschlüsselung:** optionale Passphrase-Verschlüsselung der Backup-Datei
  über `WebCrypto` (AES-GCM, Schlüssel via PBKDF2/Argon2).
- **PWA:** Web-App-Manifest + Service Worker → installierbar, voll offline.
- **Zero-Knowledge glaubwürdig machen:** strenge Content-Security-Policy mit
  `connect-src 'none'` (verhindert jede Netzwerkanfrage auf Browser-Ebene),
  keine Drittanbieter-Requests, Subresource-Integrity, reproduzierbare Builds.
  Erst das macht aus „vertrau uns" ein „prüf uns".
- **Validierung (gestuft):** (1) JS-Konsistenzprüfungen im Browser als
  Standard; (2) Arelle-Vollvalidierung im optionalen Selbst-Hosting-Modus
  (`node server.js` bleibt erhalten); (3) experimentell Arelle im Browser via
  Pyodide.

### Export beim Speichern (Geräte- und Browserwechsel)

Da im Browser-Modell kein Server die Daten hält, ist eine **Export-Datei** der
Weg, einen Stand auf ein anderes Gerät oder in einen anderen Browser zu
übertragen. Vorgeschlagener Ablauf — beim Klick auf „Speichern" laufen zwei
Schritte:

1. **IndexedDB** wird geschrieben (sofort, ohne Rückfrage).
2. Eine **Export-Datei** wird aktualisiert — ein vollständiger Schnappschuss
   (Unternehmensdaten + alle Abschlüsse + Exportzeitpunkt), nicht nur die
   geänderten Einträge.

Auslieferung der Datei, zwei Wege mit automatischem Rückfall:

- **File System Access API (Chrome/Edge):** Der Nutzer wählt einmalig eine
  Datei (`openbilanz.obz`); das Datei-Handle wird in IndexedDB gemerkt, danach
  überschreibt jedes Speichern lautlos dieselbe Datei — eine einzige, stets
  aktuelle Backup-Datei.
- **Download-Fallback (Firefox/Safari):** klassischer Datei-Download. Nicht bei
  jedem Speichern (Download-Ordner läuft voll, Browser blockieren automatische
  Mehrfach-Downloads), sondern über einen eigenen Knopf „Sitzung beenden &
  Backup" bzw. „Backup exportieren".

Fortsetzen auf einem anderen Gerät/Browser: dort „Backup öffnen" → die Datei
befüllt die IndexedDB → Weiterarbeit am letzten Stand.

Rahmenbedingungen:

- **Import ersetzt den lokalen Stand** („die Datei ist die Wahrheit"). Das
  trägt nur, wenn nicht in zwei Browsern gleichzeitig ohne zwischenzeitlichen
  Abgleich gearbeitet wird — das Tool muss darauf hinweisen.
- **Backup-Status anzeigen** („letzter Export: vor 3 Änderungen / vor 2 Tagen"),
  damit auffällt, wenn die IndexedDB neuer ist als die Datei.
- Vollautomatischer Export beim Tab-Schließen (`beforeunload`) ist unzuverlässig
  — ein bewusster „Speichern"-Klick ist der verlässliche Auslöser.

### Migrationsaufwand

Gering bis mittel — der schwierige, fachliche Code ist bereits browser-fähig.
Nötig: `lib/store.js` (Datei-API) → IndexedDB-Modul; die ~10
`fetch('/api/...')`-Aufrufe in `app.js` auf lokale Aufrufe umstellen;
`lib/xbrl.js` nach `public/shared/` ziehen; `server.js` als optionaler
Selbst-Hosting-Modus erhalten.

### Ehrliche Hinweise an die Nutzer

Browser-Speicher ist **kein Backup**. „Browserdaten löschen", ein neues Gerät
oder die Safari-Eviction führen zu Datenverlust. Der Export in eine Datei muss
als **verpflichtend** kommuniziert werden, nicht als Kür. Zero-Knowledge
schützt vor dem **Betreiber** — nicht vor Schadsoftware oder Personen mit
Zugriff auf den Rechner des Nutzers.

| Teilschritt | Nutzen | Aufwand |
|---|---|---|
| IndexedDB-Speicher statt `data/`-Dateien | H | M |
| Verschlüsselter Export/Import (`.obz`) | H | M |
| `persist()` + Backup-Erinnerungen | H | S |
| PWA (offline, installierbar) | M | M |
| Strenge CSP + Zero-Knowledge-Nachweis | H | S |
| Arelle im Browser via Pyodide (experimentell) | M | XL |

---

## 3. Funktionale Erweiterungen

### Nächste Kandidaten

> ✅ **Alle bisher hier gelisteten Kandidaten (B1–B6) sind umgesetzt** — siehe
> Abschnitt „Bereits umgesetzt". Es bleiben offene Verifikations- bzw.
> Ausbauschritte:
>
> - **B1 GmbH-Untertypen** — umgesetzt (Untertyp + Steuerhinweise). Der
>   getrennte Ausweis von operativem Teil und Kapitalanlageteil in eigenen
>   Rechenkreisen ist bewusst nicht erfolgt; die Hinweise reichen für die
>   Orientierungsrechnung.
> - **B2 Anlagenverzeichnis & AfA** — umgesetzt (linear/degressiv,
>   Anlagenspiegel, AfA-Buchungen). Abgänge/Teilwertabschreibungen offen.
> - **B3 DATEV-Export** — umgesetzt; die EXTF-Kopfzeile vor produktiver Nutzung
>   gegen die aktuelle DATEV-Formatbeschreibung gegenprüfen.
> - **B4 Bankimport CAMT.053** — umgesetzt; das Kontierungs-Regelwerk ist fest
>   eingebaut, eine nutzerpflegbare Regelliste wäre ein Ausbau.
> - **B5 UStVA-Aufbereitung** — umgesetzt als Kennzahlen-Aufbereitung; ein
>   ELSTER-importierbarer Datensatz ist nicht erzeugt (Versand über ELSTER).
> - **B6 Offenlegung** — umgesetzt als Offenlegungs-Dokument (PDF) und XBRL;
>   das amtlich geforderte Einreichungsformat des Unternehmensregisters vor der
>   Übermittlung prüfen.

### Später

| Funktion | Beschreibung | Nutzen | Aufwand |
|---|---|---|---|
| **Broker-Import (Interactive Brokers Flex/XML)** | Depotauszüge in SKR04-Buchungssätze überführen — passt zum vv-GmbH-Fokus. `Daywalker7754/Generosity` zeigt die Zuordnung (GPL-2.0, nur Referenz). | H (vv-GmbH) | M |
| **GoBD-Verfahrensdokumentation** | Geführter Fragebogen, der eine zugeschnittene Verfahrensdokumentation als PDF erzeugt. | M | S |
| **E-Rechnung empfangen/anzeigen** | Eingehende ZUGFeRD-/XRechnung-Dateien (EN 16931) parsen und Buchungsvorschläge bilden. Empfang ist seit 01.01.2025 Pflicht. | M | M |
| **ERiC-Übermittlung (optionales Modul)** | E-Bilanz tatsächlich ans Finanzamt übermitteln. ERiC ist kostenlos, aber registrierungspflichtig und nicht weiterverteilbar — daher opt-in und nicht zero-dependency. | H | L |
| **BWA / Auswertungen** | Betriebswirtschaftliche Auswertung aus vorhandenen Daten ableiten. | M | S |
| **KapSt-Anmeldung bei Gewinnausschüttung** | Assistent: 25 % Kapitalertragsteuer + Soli berechnen und den Anmeldungs-Datensatz erzeugen (Tagesanmeldung). Die Ausschüttungs-/Ergebnisverwendungsbeschluss-Vorlage ist über den Beschluss-Generator bereits abgedeckt. | M | S–M |
| **SKR03 zusätzlich zu SKR04** | Zweiten Kontenrahmen unterstützen. | M | M |

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
| **Erweiterte Plausibilitätsprüfungen** | Über die Bilanzgleichung hinaus: Steuerrückstellung vs. zvE, Abschreibung vs. Anlagevermögen, Beteiligungserträge vs. Finanzanlagen; Vorjahresabweichung > 20 % „bitte erläutern"; Eigenkapitalquote-Warnung. | H | M |
| **Mehrere GmbHs (Mandanten)** | Aktuell ist `data/unternehmen.json` einfirmig; vv-GmbH-Inhaber halten oft mehrere Gesellschaften. | H | M |
| **Mehrjahres-Verwaltung** | Zeitleiste je Mandant (EB → JA 2024 → JA 2025 …). Die Übernahme der Bestände ins Folgejahr ist als Eröffnungsbuchung bereits umgesetzt; offen ist die mandantenweite Jahres-Zeitleiste. | M | M |
| **Geführter Erfassungs-Assistent** | Schrittweise Eingabe in kleinen Abschnitten statt eines großen Formulars. | M | M |
| **Demo-/Beispieldaten** | Je ein Beispiel (operative GmbH, vv-GmbH) auf Knopfdruck ladbar — Einstieg ohne echte Steuerdaten. | M | S |
| **Glossar & Kontexthilfe** | Jeder §-Verweis und HGB-Begriff mit Tooltip; durchsuchbares Glossar. | M | S–M |
| **Audit-Trail / Versionierung der Daten** | Übergreifendes Änderungsprotokoll mit Zeitstempel. Buchungen sind über die GoBD-Festschreibung bereits geschützt; Stammdaten und Bilanzwerte bleiben frei editierbar. | M | M |
| **Barrierefreiheit (WCAG 2.1/2.2 AA)** | Tastaturbedienung, Kontraste, Beschriftungen, Überschriftenhierarchie. | M | M |
| **Anlagenspiegel** | Für nicht-Kleinst-GmbHen Pflicht (§ 284 Abs. 3 HGB) und E-Bilanz-Mussfeld. | M | L |

---

## 5. Regulatorische Beobachtungsliste

Parameter und Regeln, von denen OpenBilanz abhängt. **Beschlossen** = geltendes
bzw. veröffentlichtes Recht · **geplant** = Vorhaben/Entwurf, noch nicht in Kraft.

| Parameter | Aktueller Wert | Nächste Änderung | Status | OpenBilanz-Auswirkung |
|---|---|---|---|---|
| E-Bilanz-Kerntaxonomie | 6.9 (01.04.2025) | „7.0" jährlich, erwartet ~Mai/Juni 2026 | beschlossen | `taxonomie.js`: Namespace/Elemente prüfen |
| Taxonomie 6.9 Pflicht | WJ ab 01.01.2026; WJ 2025 zulässig | — | beschlossen | Hinweis in Doku/Tool |
| Kontennachweis-Pflicht | WJ ab 01.01.2025 | — | beschlossen | siehe 1.1 — derzeit nicht erfüllt |
| Körperschaftsteuersatz | 15 % (bis VZ 2027) | 14 % (2028) … 10 % (ab 2032) | beschlossen | siehe 1.2 — `KST_SATZ` jahresabhängig machen |
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
