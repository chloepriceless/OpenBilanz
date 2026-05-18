<p align="center">
  <img src="public/assets/marke.png" alt="OpenBilanz" width="420">
</p>

# OpenBilanz

**Lokales Open-Source-Tool zur Erstellung von Eröffnungsbilanz und
Jahresabschluss einer GmbH — nach HGB, mit E-Bilanz-Export und Validierung
gegen die amtliche Taxonomie. Ohne Steuerberater, ohne Klickerei in ELSTER.**

Eine selbst betriebene, kostenlose Alternative zur Eröffnungsbilanz- und
Jahresabschluss-Funktion kommerzieller Dienste. Alle Daten bleiben auf deinem
Rechner. Geeignet für die kleine **operativ tätige** GmbH und die
**vermögensverwaltende** GmbH (Immobilien, Beteiligungen, Wertpapiere).

> ⚠️ **Ohne Gewähr.** OpenBilanz wird ohne jede Gewähr für die Richtigkeit der
> Berechnungen, Gliederungen und der erzeugten E-Bilanz bereitgestellt und
> ersetzt keine Steuer- oder Rechtsberatung. Nutzung auf eigene Verantwortung —
> jeden Abschluss vor Abgabe an das Finanzamt fachlich prüfen lassen.
> Siehe [Haftungsausschluss](#haftungsausschluss).

> 🚧 **Work in Progress.** OpenBilanz steckt noch in aktiver Entwicklung. Nicht
> alle Funktionen sind ausgereift, Schnittstellen und Berechnungen können sich
> ändern, und Fehler sind wahrscheinlich. Noch nicht für den produktiven
> Einsatz ohne fachliche Prüfung gedacht.

> 🙏 **Gegenprüfung erwünscht.** Wer Erfahrung mit HGB-Rechnungslegung,
> E-Bilanz oder Steuerrecht hat: Ich würde mich sehr freuen, wenn jemand mit
> mehr Fachwissen die Berechnungen, die HGB-Gliederung und die erzeugte
> E-Bilanz einmal gegenchecken könnte. Rückmeldungen, Hinweise und Korrekturen
> gern über die Issues oder einen Pull Request.

---

## Schnellstart

OpenBilanz lässt sich auf zwei Arten betreiben — die Anwendung ist dieselbe:

**1. Selbst-Hosting (lokal, mit Node.js)** — Voraussetzung: **Node.js ≥ 18**,
keine npm-Abhängigkeiten, kein `npm install`.

```bash
git clone <repo-url> OpenBilanz
cd OpenBilanz
./start.sh                      # oder:  node server.js
```

Dann im Browser öffnen: **http://localhost:3000**. Die Daten liegen als
JSON-Dateien im Ordner `data/`.

> **Sicherheit:** Der Server lauscht standardmäßig nur auf `127.0.0.1`
> (Loopback) und ist damit ausschließlich vom selben Rechner erreichbar. Er hat
> **keine Authentifizierung** — soll er bewusst im Netzwerk erreichbar sein,
> `HOST=0.0.0.0 node server.js` setzen. Das nur in einem vertrauenswürdigen Netz
> tun, da dann jeder im Netz die Buchhaltungsdaten lesen und ändern kann.

**2. Website-Modus (rein im Browser)** — der Ordner `public/` wird statisch
ausgeliefert (z. B. GitHub Pages, Cloudflare Pages). Alle Daten bleiben dann
**ausschließlich im Browser** des Nutzers (IndexedDB); es werden keinerlei
Daten an einen Server übertragen. Sicherung und Gerätewechsel laufen über eine
exportierbare `.obz`-Datei (optional passwortverschlüsselt).

---

## Was das Tool kann

| Funktion | Status |
|---|---|
| **Eröffnungsbilanz** erstellen (§ 242 Abs. 1 HGB) | ✅ |
| **Jahresabschluss**: Bilanz (§ 266) + GuV (§ 275) + Anhang (§§ 284 ff.) | ✅ |
| Teilweise eingezahltes Stammkapital — Nettomethode (§ 272 Abs. 1 HGB) | ✅ |
| Automatische **Größenklassen-Einstufung** (§ 267 / § 267a HGB) | ✅ |
| Live-Prüfung der **Bilanzgleichung** und Plausibilitätshinweise | ✅ |
| **Druckansicht** (Bilanz in Kontoform, GuV, Anhang) → als PDF speicherbar | ✅ |
| **E-Bilanz**: XBRL nach Taxonomie 6.9, im ELSTER-`EBilanz`-Container | ✅ |
| **Kontennachweise** zur E-Bilanz (§ 5b EStG i. d. F. JStG 2024) | ✅ |
| **Validierung** der E-Bilanz gegen die amtliche Taxonomie (Arelle) | ✅ |
| **Vermögensverwaltende GmbH**: Finanzanlagen, Beteiligungen, Mieterträge | ✅ |
| **GmbH-Untertypen**: Immobilien-, Trading-, Hybrid-GmbH mit Steuerhinweisen | ✅ |
| **Steuerschätzung**: KSt (jahresabhängiger Satz), Soli, GewSt, § 8b/§ 9 | ✅ |
| **Buchhaltung** mit Kontenrahmen SKR04 (Buchungsjournal, Saldenliste) | ✅ |
| **Eröffnungsbuchungen** — Saldenvortrag ins neue Jahr (Eröffnungsbilanzkonto 9000) | ✅ |
| **GoBD-Festschreibung** — unveränderliche Buchungen, Storno, Änderungsprotokoll | ✅ |
| **Anlagenverzeichnis & AfA** — linear/degressiv, Anlagenspiegel (§ 284 Abs. 3) | ✅ |
| **DATEV-Export** — Buchungsstapel im EXTF-Format für den Steuerberater | ✅ |
| **Bankimport** — Kontoauszüge im Format CAMT.053 (ISO 20022) | ✅ |
| **UStVA-Aufbereitung** — Umsatzsteuer-Voranmeldung aus den SKR04-Konten | ✅ |
| **Offenlegung** beim Unternehmensregister (§ 325 HGB) | ✅ |
| **Buchungshilfe** — erklärte Standardfälle mit konkreten SKR04-Buchungssätzen | ✅ |
| **Gesellschafterbeschlüsse** — Generator (Feststellung, Ergebnisverwendung, …) | ✅ |
| Vorjahresspalte (§ 265 Abs. 2 HGB) | ✅ |
| Test-Suite (`npm test`) | ✅ |

### Zwei Erfassungswege

1. **Direkteingabe** der Bilanzposten — ideal für die Eröffnungsbilanz und
   wenn die Zahlen feststehen.
2. **Buchhaltung (SKR04)** — laufende Buchungssätze; das Tool bildet daraus
   Summen-/Saldenliste und überträgt die Salden in Bilanz und GuV. Inklusive
   Eröffnungsbuchungen (Saldenvortrag) und GoBD-Festschreibung — siehe Abschnitt
   [Buchhaltung, GoBD & Gesellschafterbeschlüsse](#buchhaltung-gobd--gesellschafterbeschlüsse).

---

## Arbeitsablauf

1. **Unternehmensdaten** anlegen (Firma, Gründungsdatum, Stammkapital,
   Steuernummer, Art der Tätigkeit).
2. **Eröffnungsbilanz** erstellen — Kapitalangaben und Bilanzposten eintragen,
   die Bilanzgleichung wird live geprüft.
3. **E-Bilanz** erzeugen, **gegen die Taxonomie validieren**, herunterladen.
4. **Druckansicht** → Browser „Drucken → Als PDF speichern".
5. Nach jedem Geschäftsjahr einen **Jahresabschluss** (Bilanz + GuV + Anhang),
   wahlweise per Direkteingabe oder über die **Buchhaltung** (SKR04-Buchungen,
   Eröffnungsbuchungen, GoBD-Festschreibung), bei Bedarf mit **Steuerschätzung**.
6. Bei Bedarf **Gesellschafterbeschlüsse** erzeugen (Feststellung des
   Jahresabschlusses, Ergebnisverwendung u. a.).

---

## Buchhaltung, GoBD & Gesellschafterbeschlüsse

### Buchhaltung nach SKR04

Im Buchhaltungs-Modus eines Jahresabschlusses werden laufende Buchungssätze
erfasst. Aus den Kontensalden bildet das Tool die Summen- und Saldenliste;
„Salden in Bilanz/GuV übernehmen" überträgt sie in die HGB-Positionen.

### Eröffnungsbuchungen — Saldenvortrag ins neue Jahr

Eine Jahresabschluss-Buchhaltung beginnt nicht bei null: die Schlussbestände
des Vorjahres — im ersten Jahr die Eröffnungsbilanz — werden als
**Eröffnungsbuchungen** gegen das Eröffnungsbilanzkonto **9000** übernommen
(Bilanzidentität, § 252 Abs. 1 Nr. 1 HGB). Die Karte „Anfangsbestände" erzeugt
diese Buchungen automatisch aus einem gewählten Quell-Abschluss und übernimmt
dessen Kapitalblock.

### GoBD: Festschreibung der Buchungen

Buchungen lassen sich **festschreiben** (§ 146 AO). Festgeschriebene Buchungen
sind unveränderlich und nicht mehr löschbar; eine Korrektur erfolgt
ausschließlich über eine **Stornobuchung** (Soll/Haben getauscht). Jede
Festschreibung und jeder Storno wird in einem **Änderungsprotokoll** des
Abschlusses vermerkt.

### Buchungshilfe

Der Reiter **„Buchungshilfe"** erklärt typische Geschäftsvorfälle einer GmbH
mit konkreten SKR04-Buchungssätzen: Gründung und Eröffnungsbilanz,
Eröffnungsbuchungen, Anlagevermögen und Abschreibung, digitale Betriebsmittel
(Hardware, Software, Domains, Websites, Hosting, Mobilfunk), laufende Einnahmen
und Ausgaben sowie der Jahresabschluss.

### Gesellschafterbeschlüsse

Der Reiter **„Gesellschafterbeschlüsse"** erzeugt druckbare Beschlussvorlagen:
Feststellung des Jahresabschlusses (§ 42a GmbHG), Ergebnisverwendung
(§ 29 GmbHG), Einforderung ausstehender Einlagen, Geschäftsführer-Beschlüsse
(§ 46 GmbHG) sowie einen **Freitext-Beschluss** für alle übrigen Fälle. Wo
möglich, werden Zahlen (Bilanzsumme, Jahresergebnis, Stammkapital) direkt aus
dem Abschluss übernommen.

> Die Beschlussvorlagen sind unverbindliche Muster und ersetzen keine
> Rechtsberatung. Ladungs- und Formvorschriften sowie der Gesellschaftsvertrag
> sind eigenverantwortlich zu beachten.

---

## Anlagen, DATEV, Bank & Umsatzsteuer

### Anlagenverzeichnis & AfA

Der Reiter „Anlagenverzeichnis" führt die Anlagegüter der GmbH mit linearer
oder degressiver Abschreibung (degressiv für bewegliche Wirtschaftsgüter mit
Anschaffung 01.07.2025–31.12.2027). Er zeigt je Anlage den AfA-Verlauf und den
Anlagenspiegel (§ 284 Abs. 3 HGB) für ein wählbares Geschäftsjahr; die
jährlichen AfA-Buchungen lassen sich in die Buchhaltung eines Jahresabschlusses
übernehmen.

### DATEV-Export

Das Buchungsjournal lässt sich als DATEV-Buchungsstapel im **EXTF-Format**
exportieren — für die Übergabe an den Steuerberater (im Reiter „Buchhaltung").

### Bankimport (CAMT.053)

Kontoauszüge im Format **CAMT.053** (ISO 20022) werden eingelesen; die Umsätze
erhalten je Zeile einen SKR04-Kontovorschlag aus dem Verwendungszweck und
werden nach Prüfung als Buchungen übernommen.

### Umsatzsteuer-Voranmeldung

Der Reiter „Umsatzsteuer" bereitet die **UStVA-Kennzahlen** (Kz 81/86/66/83)
aus den SKR04-USt-Konten eines wählbaren Zeitraums auf — eine Aufbereitung, der
Versand läuft über ELSTER.

### Offenlegung

Der Reiter „Offenlegung" erzeugt den beim **Unternehmensregister**
einzureichenden Jahresabschluss im Umfang der Größenklasse (kleine GmbH: Bilanz
und Anhang, ohne GuV — § 326 HGB) als druckbares PDF und als XBRL. Mit Hinweis
auf die Zwölf-Monats-Frist und das Ordnungsgeld (§§ 325, 335 HGB).

---

## E-Bilanz: erzeugen, validieren, übermitteln

Das Tool erzeugt die E-Bilanz als **XBRL** nach der amtlichen
**Kerntaxonomie 6.9** (Stand 01.04.2025), Module GCD + GAAP, eingebettet in den
ELSTER-`EBilanz`-Container.

**Validierung.** Mit dem XBRL-Validator **Arelle** wird die E-Bilanz gegen die
amtliche Taxonomie geprüft — auf Knopfdruck in der E-Bilanz-Ansicht oder per
CLI. Einrichtung:

```bash
pip install arelle-release
./tools/setup-taxonomie.sh           # lädt das amtliche Taxonomie-ZIP (~53 MB)
node lib/validate.js <xbrl-datei>    # CLI-Validierung
```

**Übermittlung.** Mein ELSTER bietet **kein** E-Bilanz-Formular und keinen
XBRL-Upload. Die Übermittlung läuft technisch über **ERiC** (ELSTER Rich
Client). Das Tool erzeugt den fertigen `EBilanz`-Container; für den Versand:
ERiC nach Entwickler-Registrierung bei ELSTER beziehen und eine ERiC-fähige
Software nutzen (z. B. das Open-Source-Projekt
[taxel](https://github.com/quambene/taxel)) — oder den Versand durch ein
Steuerbüro erledigen lassen, die Daten sind dann bereits fertig.

---

## Vermögensverwaltende GmbH

Für eine GmbH, die Immobilien, Beteiligungen oder Wertpapiere hält:

- **SKR04** enthält die einschlägigen Konten (Grundstücke, Anteile an
  verbundenen Unternehmen, Beteiligungen, Wertpapiere des Anlagevermögens,
  Erträge aus Beteiligungen, Abschreibungen auf Finanzanlagen).
- Die **GuV** bedient die Posten Nr. 9–13 (§ 275 HGB): Erträge aus
  Beteiligungen, aus Wertpapieren, Zinsen, Abschreibungen auf Finanzanlagen.
  Mieterträge gehören zu den Umsatzerlösen (§ 277 HGB).
- Die **Steuerschätzung** bildet die Besonderheiten ab:
  - **§ 8b KStG** — Beteiligungserträge und Veräußerungsgewinne 95 % steuerfrei.
  - **§ 8b Abs. 4 KStG** — Streubesitz < 10 %: Dividende voll
    körperschaftsteuerpflichtig.
  - **§ 8 Nr. 5 GewStG** — Beteiligung < 15 %: Dividende gewerbesteuerpflichtig.
  - **§ 9 Nr. 1 GewStG** — einfache und erweiterte Grundstücks-Kürzung.

> Die Steuerschätzung ist eine **Orientierungsrechnung**, keine verbindliche
> Steuerberechnung.

---

## Rechtlicher Hintergrund

Das Tool setzt folgende Vorschriften um (Stand 2026, geprüft an den
Originaltexten auf gesetze-im-internet.de):

- **§ 242 HGB** — Pflicht zu Eröffnungsbilanz und Jahresabschluss.
- **§ 266 HGB** — Gliederung der Bilanz; verkürzte Formen für kleine und
  Kleinstkapitalgesellschaften.
- **§ 275 HGB** — GuV (Gesamt-/Umsatzkostenverfahren, verkürzt für Kleinst).
- **§ 272 Abs. 1 HGB** — Nettomethode bei nicht voll eingezahltem Stammkapital.
- **§ 267 / § 267a HGB** — Größenklassen (Schwellenwerte seit 17.04.2024).
- **§ 268 Abs. 3 HGB** — nicht durch Eigenkapital gedeckter Fehlbetrag.
- **§§ 284–288, § 264 Abs. 1 S. 5 HGB** — Anhang bzw. Angaben unter der Bilanz.
- **§ 325 / § 326 HGB** — Offenlegung beim Unternehmensregister, 12-Monats-Frist.
- **§ 5 / § 7 GmbHG** — Mindeststammkapital, Mindesteinzahlung 12.500 €.
- **§ 5b EStG** — E-Bilanz-Pflicht, auch für die Eröffnungsbilanz.
- **§ 8b KStG, § 9 GewStG** — Besonderheiten der vermögensverwaltenden GmbH.

Eine ausführliche Fassung mit allen Fristen, Ordnungsgeld (§ 335 HGB) und
Aufbewahrungspflichten (§ 257 HGB) zeigt das Tool unter „Fristen & Pflichten".

---

## Datenablage

**Selbst-Hosting-Modus:** Alle Daten liegen als lesbare JSON-Dateien im Ordner
**`data/`**:

```
data/unternehmen.json          Stammdaten der GmbH
data/abschluesse/<id>.json     je ein Abschluss (Eröffnungsbilanz / Jahresabschluss)
```

`data/` ist in `.gitignore` ausgenommen (Steuerdaten). Zum revisionssicheren
Versionieren der eigenen Buchführung die Zeile `data/` aus `.gitignore`
entfernen.

**Website-Modus:** Die Daten liegen in der **IndexedDB des Browsers** und
verlassen das Gerät nicht. Über „Sichern" wird eine vollständige
`.obz`-Sicherungsdatei geschrieben — sie ist Backup und zugleich der Weg, einen
Stand auf ein anderes Gerät oder in einen anderen Browser zu übertragen
(„Backup öffnen"). Browser-Speicher ist **kein Ersatz für ein Backup**: die
`.obz`-Datei regelmäßig sichern.

---

## Tests

```bash
npm test          # Rechenkern, SKR04-Mapping, Taxonomie, XBRL, Steuer
```

Die tiefe XBRL-Validierung gegen die amtliche Taxonomie erfolgt zusätzlich mit
Arelle (siehe oben).

---

## Projektstruktur

```
server.js                     Zero-Dependency-Webserver (nur Selbst-Hosting)
start.sh                      Startskript
lib/store.js                  Persistenz JSON-Dateien (Selbst-Hosting)
lib/validate.js               Validierung gegen die Taxonomie via Arelle (Selbst-Hosting)
public/index.html, app.js     Oberfläche
public/styles.css             Gestaltung inkl. Druck-Layout
public/manifest.webmanifest   PWA-Manifest (Website-Modus)
public/sw.js                  Service Worker, offline-fähig (Website-Modus)
public/shared/positionen.js   HGB-Gliederung Bilanz/GuV (§§ 266, 275)
public/shared/berechnung.js   Rechenkern (Summen, Bilanzgleichung, Größenklasse)
public/shared/taxonomie.js    Mapping HGB-Position → E-Bilanz-Taxonomie 6.9
public/shared/skr04.js        Kontenrahmen SKR04 inkl. vv-GmbH-Konten
public/shared/steuer.js       Steuerschätzung KSt / Soli / GewSt
public/shared/xbrl.js         E-Bilanz-XBRL und EBilanz-Container
public/shared/store-idb.js    Browser-Persistenz via IndexedDB (Website-Modus)
public/shared/store-adapter.js  Speicheradapter für beide Betriebsarten
public/shared/obz.js          .obz-Sicherung: packen, optional verschlüsseln
public/shared/fileio.js       Datei-Export/-Import (File System Access API)
public/shared/validate-browser.js  E-Bilanz-Konsistenzprüfung im Browser
public/pyodide-worker.js      Arelle-Validierung im Browser (experimentell)
tests/run.js                  Test-Suite
tools/setup-taxonomie.sh      lädt das amtliche Taxonomie-Paket
tools/setup-pyodide.sh        lädt Pyodide + Arelle (experimentell)
tools/serve-website.py        lokaler HTTPS-Server für die Website-Variante
```

---

## Verwandte Projekte & Ressourcen

- [laroche/trading-gmbh](https://github.com/laroche/trading-gmbh) — gemeinfreies
  (CC0) Handbuch zur Gründung und zum Betrieb einer vermögensverwaltenden bzw.
  Trading-GmbH; gute fachliche Ergänzung zum vv-GmbH-Teil von OpenBilanz.
- [quambene/taxel](https://github.com/quambene/taxel) — Werkzeug, das eine
  E-Bilanz aus CSV erzeugt, validiert und über ERiC ans Finanzamt übermittelt
  (Rust, AGPL-3.0).
- [scka-de/german-accounting](https://github.com/scka-de/german-accounting) —
  maschinenlesbarer SKR03-/SKR04-Kontenrahmen als JSON (MIT).
- [esteuer.de](https://www.esteuer.de/) — amtliche Quelle der
  E-Bilanz-Kerntaxonomie (XBRL-Schemas, Änderungsnachweise).
- [Arelle](https://arelle.org) — der XBRL-Validator, gegen den OpenBilanz die
  erzeugte E-Bilanz prüft.

Eine ausführliche Übersicht möglicher Weiterentwicklungen — darunter eine rein
im Browser laufende Website-Variante ohne serverseitige Datenhaltung — steht in
[ROADMAP.md](ROADMAP.md).

---

## Lizenz & Mitwirken

MIT-Lizenz — siehe [LICENSE](LICENSE). Zur Herkunft verwendeter Daten siehe
[DRITTQUELLEN.md](DRITTQUELLEN.md), zum Mitwirken [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Haftungsausschluss

OpenBilanz ist ein freies Hilfsmittel zur **Erstellung** von Eröffnungsbilanz,
Jahresabschluss und E-Bilanz und setzt die gesetzlichen Gliederungs- und
Rechenregeln nach bestem Wissen von KI/CLaude um. Dennoch gilt:

- Die Software wird **„wie besehen", ohne jede Gewähr** bereitgestellt. Es wird
  **keine Gewähr für Richtigkeit, Vollständigkeit oder Aktualität** der
  Berechnungen, der HGB-Gliederung, der Größenklassen-Einstufung, der
  Steuerschätzung oder der erzeugten E-Bilanz übernommen.
- OpenBilanz ist **keine Steuer-, Rechts- oder Buchführungsberatung** und
  ersetzt diese nicht. Bewertungsfragen (Abschreibungen, Rückstellungen,
  Sacheinlagen, latente Steuern) und Zweifelsfälle gehören in fachkundige Hand.
- Die Nutzung erfolgt **auf eigenes Risiko und in eigener Verantwortung**.
  Jeder Abschluss und jede E-Bilanz ist **vor der Verwendung — insbesondere vor
  Abgabe an das Finanzamt oder der Offenlegung — durch eine fachkundige Person
  (z. B. Steuerberater) zu prüfen**.
- Es wird **keine Haftung** für unmittelbare oder mittelbare Schäden
  übernommen, die aus der Nutzung entstehen — etwa Steuernachzahlungen, Zinsen,
  Verspätungszuschläge oder Ordnungsgeld.
- Verantwortlich für die Richtigkeit der Rechnungslegung und die fristgerechte
  Abgabe bleibt allein die **Geschäftsführung**.

Mit der Nutzung von OpenBilanz erkennst du diesen Haftungsausschluss an.
