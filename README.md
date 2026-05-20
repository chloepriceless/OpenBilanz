<p align="center">
  <img src="public/assets/marke.png" alt="OpenBilanz" width="420">
</p>

# OpenBilanz

**Lokales Open-Source-Tool zur Vorbereitung von Eröffnungsbilanz und
Jahresabschluss einer GmbH — nach HGB, mit E-Bilanz-Export und Validierung
gegen die amtliche Taxonomie. Nachvollziehbar, lokal und prüfbar.**

OpenBilanz ist für alle, die die Buchhaltung ihrer GmbH selbst übernehmen
wollen, statt sie ganz aus der Hand zu geben — wer mag, kommt damit auch ohne
Steuerberater aus. Und wer an einer Stelle unsicher ist, zieht trotzdem einen
hinzu: Die Vorarbeit ist dann schon getan, das schont den Geldbeutel. Alle
Daten bleiben auf deinem Rechner. Geeignet für die kleine **operativ tätige**
GmbH und die **vermögensverwaltende** GmbH (Immobilien, Beteiligungen,
Wertpapiere).

> ⚠️ **Ohne Gewähr.** OpenBilanz wird ohne jede Gewähr für die Richtigkeit der
> Berechnungen, Gliederungen und der erzeugten E-Bilanz bereitgestellt und
> ersetzt keine Steuer- oder Rechtsberatung. Nutzung auf eigene Verantwortung —
> jeden Abschluss vor Abgabe an das Finanzamt fachlich prüfen lassen.
> Siehe [Haftungsausschluss](#haftungsausschluss).

> 🚧 **Work in Progress.** OpenBilanz wird aktiv weiterentwickelt und kann
> funktional schon einiges. Manche Funktionen sind aber noch jung, und
> Schnittstellen oder Berechnungen können sich noch ändern. Wenn dir etwas
> auffällt oder fehlt: gern gleich ein
> [Issue](https://github.com/chloepriceless/OpenBilanz/issues) öffnen — so
> bringen wir die Software gemeinsam dahin, wo sie hin soll.

> 🙏 **Gegenprüfung erwünscht.** Wer Erfahrung mit HGB-Rechnungslegung,
> E-Bilanz oder Steuerrecht hat: Ich würde mich sehr freuen, wenn jemand mit
> mehr Fachwissen die Berechnungen, die HGB-Gliederung und die erzeugte
> E-Bilanz einmal gegenchecken könnte. Rückmeldungen, Hinweise und Korrekturen
> gern über die Issues oder einen Pull Request.

---

## Schnellstart

OpenBilanz ist **dieselbe Anwendung** in zwei Betriebsarten. Der einzige
Unterschied: **wo deine Daten liegen.** Das entscheidest du bewusst darüber,
**wie** du das Tool startest — „lokal betreiben" ist in beiden Arten möglich.

**1. Selbst-Hosting-Modus — Daten als Dateien auf der Festplatte.**
Voraussetzung: **Node.js ≥ 18**, keine npm-Abhängigkeiten, kein `npm install`.

```bash
git clone <repo-url> OpenBilanz
cd OpenBilanz
./start.sh                      # oder:  node server.js
```

Dann im Browser öffnen: **http://localhost:3000**. Die Daten liegen als lesbare
JSON-Dateien im Ordner `data/`.

> **Vorteil dieses Modus:** Die Buchhaltung liegt als normale Dateien im
> Dateisystem — mit jedem Backup-Werkzeug sicherbar, mit Git versionierbar und
> unabhängig vom Browser. (Der Browser kann seinen Speicher bei Speicherdruck
> verwerfen; Dateien auf der Platte nicht.) Dieser Modus läuft ausschließlich
> lokal auf deinem Rechner.

> **Sicherheit:** Der Server lauscht standardmäßig nur auf `127.0.0.1`
> (Loopback) und ist damit ausschließlich vom selben Rechner erreichbar. Er hat
> **keine Authentifizierung** — soll er bewusst im Netzwerk erreichbar sein,
> `HOST=0.0.0.0 node server.js` setzen. Das nur in einem vertrauenswürdigen Netz
> tun, da dann jeder im Netz die Buchhaltungsdaten lesen und ändern kann.

**2. Website-Modus — Daten im Browser.**
Hier wird nur der Ordner `public/` statisch ausgeliefert, es läuft **kein
Server-Code**. Alle Daten bleiben **ausschließlich im Browser** des Nutzers
(IndexedDB); es werden keinerlei Daten an einen Server übertragen. Sicherung und
Gerätewechsel laufen über eine exportierbare `.obz`-Datei (optional
passwortverschlüsselt).

Diesen Modus kannst du **ebenfalls lokal** betreiben …

```bash
python3 tools/serve-website.py   # lokal über HTTPS, Daten im Browser
```

… oder öffentlich hosten (z. B. GitHub Pages, Cloudflare Pages oder ein eigener
Webserver). Auch beim öffentlichen Hosting verlässt kein Buchhaltungsdatum das
Gerät des Nutzers — der Server liefert nur statische Dateien aus.

> **„Lokal" heißt nicht automatisch Selbst-Hosting-Modus.** Auch der
> Website-Modus läuft lokal auf deinem Rechner. Zu entscheiden ist allein, **wo
> die Daten liegen sollen**: als Dateien im Ordner `data/` (Selbst-Hosting) oder
> in der Datenbank des Browsers (Website-Modus).

---

## Was das Tool kann

> **Legende.** ✅ **getestet** — im Betrieb geprüft: die Funktion läuft, Eingaben
> werden verarbeitet und Ergebnisse erscheinen. Das ist **keine** Bestätigung der
> rechnerischen oder steuerlichen Richtigkeit — die kann nur ein Steuerberater
> geben. 🟡 **umgesetzt, noch nicht getestet** — implementiert, aber noch nicht
> im Betrieb geprüft.

| Funktion | Status |
|---|---|
| **Eröffnungsbilanz** erstellen (§ 242 Abs. 1 HGB) | ✅ |
| **Jahresabschluss**: Bilanz (§ 266) + GuV (§ 275) + Anhang (§§ 284 ff.) | ✅ |
| Teilweise eingezahltes Stammkapital — Nettomethode (§ 272 Abs. 1 HGB) | ✅ |
| Automatische **Größenklassen-Einstufung** (§ 267 / § 267a HGB) | ✅ |
| Live-Prüfung der **Bilanzgleichung** und Plausibilitätshinweise | ✅ |
| **Druckansicht** (Bilanz in Kontoform, GuV, Anhang) → als PDF speicherbar | ✅ |
| **E-Bilanz**: XBRL nach Taxonomie 6.9, im ELSTER-`EBilanz`-Container | ✅ |
| **Kontennachweise** zur E-Bilanz (§ 5b EStG i. d. F. JStG 2024) | 🟡 |
| **Validierung** der E-Bilanz gegen die amtliche Taxonomie (Arelle) | ✅ |
| **Vermögensverwaltende GmbH**: Finanzanlagen, Beteiligungen, Mieterträge | ✅ |
| **GmbH-Untertypen**: Immobilien-, Trading-, Hybrid-GmbH mit Steuerhinweisen | ✅ |
| **Steuerschätzung**: KSt (jahresabhängiger Satz), Soli, GewSt — § 8b KStG, § 9 GewStG | 🟡 |
| **Buchhaltung** mit Kontenrahmen SKR04 (Buchungsjournal, Saldenliste) | ✅ |
| **Eröffnungsbuchungen** — Saldenvortrag ins neue Jahr (Eröffnungsbilanzkonto 9000) | ✅ |
| **GoBD-Festschreibung** — unveränderliche Buchungen, Storno, Änderungsprotokoll | ✅ |
| **Anlagenverzeichnis & AfA** — linear/degressiv, Anlagenspiegel (§ 284 Abs. 3) | 🟡 |
| **DATEV-Export** — Buchungsstapel im EXTF-Format für den Steuerberater | 🟡 |
| **Bankimport** — Kontoauszüge im Format CAMT.053 (ISO 20022) | ✅ |
| **UStVA-Aufbereitung** — Umsatzsteuer-Voranmeldung aus den SKR04-Konten | 🟡 |
| **Offenlegung** beim Unternehmensregister (§ 325 HGB) | 🟡 |
| **Buchungshilfe** — erklärte Standardfälle mit konkreten SKR04-Buchungssätzen | ✅ |
| **Gesellschafterbeschlüsse** — Generator (Feststellung, Ergebnisverwendung, …) | ✅ |
| Vorjahresspalte (§ 265 Abs. 2 HGB) | ✅ |
| Test-Suite (`npm test`) | ✅ |
| **Steuer-Sonderfälle** — § 8b Abs. 7 (Handelsbestand), Verlustvortrag (§ 10d/§ 10a), GewSt-Hinzurechnungen § 8, verdeckte Gewinnausschüttung | 🟡 |
| **DATEV-Import** — EXTF-Buchungsstapel einlesen | 🟡 |
| **Bankimport MT940** — Kontoauszüge im SWIFT-Format MT940 | 🟡 |
| **UStVA-Sonderfälle** — Soll-/Ist-Versteuerung, Kleinunternehmer § 19, Reverse-Charge § 13b, steuerfreie Umsätze § 4 | 🟡 |
| **Broker-Import** — Interactive-Brokers-Flex-Berichte (Trades, Dividenden) | 🟡 |
| **E-Rechnung empfangen** — XRechnung-XML und ZUGFeRD-/Factur-X-PDF einlesen (CII + UBL, eingebettete XML aus PDF/A-3 entpacken), Profil erkennen (MINIMUM/BASIC/EN 16931/XRechnung), Positionen und Plausi-Checks (Brutto = Netto + USt, Summe Positionen = Netto, Pflichtfelder), Übernahme als Eingangsrechnung gegen Verbindlichkeiten (3300) | 🟡 |
| **Ausgangsrechnungen schreiben** — Kunden-Stammdaten, Rechnungs-Editor, Steuerlogik (Regelfall, § 13b Reverse-Charge, innergem. Lieferung/Leistung, § 19 Kleinunternehmer, § 4 steuerfrei), § 14 UStG-Pflichtcheck, lückenloser Rechnungsnummernkreis mit Jahreswechsel-Reset, GoBD-Festschreibung über die Prüfkette, automatischer Buchungssatz (Forderung 1200 an Erlöse 4400/4300 + USt 3806/3801; § 13b separat über 4336) | 🟡 |
| **XRechnung erzeugen** — XRechnung 3.x als UBL **und** als CII (UN/CEFACT) erzeugen, Download als XML, KoSIT-Customization-ID gesetzt, SEPA-PaymentMeans aus IBAN; Roundtrip mit dem eingebauten Parser geprüft | 🟡 |
| **ZUGFeRD-Hybrid-PDF** — PDF mit lesbarem Layout + eingebetteter Factur-X-CII-XML (AFRelationship=Alternative). Benötigt einmaliges `tools/setup-pdf-lib.sh` (vendort pdf-lib MIT, sRGB-ICC, Liberation Sans SIL-OFL lokal nach `public/vendor/`). Strikt-PDF/A-3-Konformität noch nicht extern Mustang-validiert — siehe Hinweis im Modulkopf. | 🟡 |
| **USt-IdNr.-Prüfung** — strukturelle Offline-Prüfung pro EU-Staat (DE/AT/NL/IT mit voller Prüfziffer); im Selbst-Hosting-Modus zusätzlich qualifizierte Online-Bestätigung beim VIES (per Klick, Datenschutz-Hinweis im Dialog) | 🟡 |
| **BWA** — betriebswirtschaftliche Auswertung mit Kennzahlen | 🟡 |
| **Kapitalertragsteuer-Assistent** — 25 % KapSt + Soli auf Ausschüttungen | 🟡 |
| **GoBD-Verfahrensdokumentation** — geführter Fragebogen → Dokument | 🟡 |
| **Journal-Export** — Buchungsjournal maschinenlesbar als CSV und JSON | 🟡 |
| **GDPdU-Export** — Datenträgerüberlassung (Z3) für die Betriebsprüfung | 🟡 |
| **Prüfkette** — SHA-256-Verkettung festgeschriebener Buchungen, Integritätsprüfung | 🟡 |
| **Erweiterte Plausibilitätsprüfungen** — Eigenkapitalquote, Steuerrückstellung, Abschreibung/Anlagevermögen, Beteiligungserträge, Vorjahresabweichung | ✅ |
| **Geführter Erfassungs-Assistent** — schrittweise Eröffnungsbilanz statt großem Formular | ✅ |
| **Demo-Portal** — Beispiel-GmbH (3 Geschäftsjahre) per Deeplink laden, ohne eigene Daten ausprobieren | 🟡 |
| **Glossar** — durchsuchbare Erklärung der HGB-, Steuer- und E-Bilanz-Begriffe, mit Tooltips | ✅ |
| **Anlagenabgänge & Teilwertabschreibungen** — Abgangsbuchungen, außerplanmäßige AfA, Abgangsspalte im Anlagenspiegel | ✅ |
| **Wertpapier-Buchhaltung Trading-GmbH** — Buchungshilfe Kauf/Verkauf, Verlustkonto 6905 (SKR04) | ✅ |
| **Anrechenbare ausländische Quellensteuer** — Anrechnung auf die Körperschaftsteuer (§ 26 KStG) | ✅ |
| **Änderungsprotokoll der Unternehmensdaten** — Audit-Trail mit Zeitstempel für die Stammdaten | ✅ |
| **Kontierungsregeln (Bankimport)** — nutzerpflegbare Regeln Suchbegriff → Gegenkonto | ✅ |
| **Strenges Niederstwertprinzip (§ 253 Abs. 4 HGB)** — Plausi-Erinnerung bei Wertpapieren des Umlaufvermögens am Stichtag | 🟡 |
| **Stillhaltergeschäfte & Optionsprämien** — Buchungshilfe inkl. Drohverlustrückstellung (§ 249 Abs. 1 HGB) | 🟡 |
| **Fremdwährung & Stichtagsbewertung (§ 256a HGB)** — Helper für kurzfristig/langfristig, Buchungshilfe-Abschnitt | 🟡 |
| **Termingeschäfte (Futures/CFD)** — Buchungshilfe Variation-Margin-Workflow + § 15 Abs. 4 EStG-Hinweis | 🟡 |
| **Nebenkosten des Geldverkehrs** — eigenes Konto SKR04 6855 (Bank-, Depot-, Ordergebühren) statt Sammelposten 6300 | 🟡 |
| **Befehlssuche (Cmd/Ctrl+K)** — Fuzzy-Sprungleiste zu Reitern, Abschlüssen, SKR04-Konten und Glossarbegriffen | 🟡 |
| **Buchungsvorlagen** — häufige Geschäftsvorfälle als Template (Name, Text, Soll, Haben, optionaler Default-Betrag) | 🟡 |
| **Wiederkehrende Buchungen** — Vorlagen mit Takt (monatlich/quartalsweise/jährlich), Fälligkeits-Hinweisbox in der Buchhaltung | 🟡 |
| **Autocomplete für Buchungstext** — lernt aus dem eigenen Journal, schlägt Soll- und Haben-Konto beim Tippen vor | 🟡 |
| **Buchungs-Plausi pro Zeile** — vor dem Aufnehmen ins Journal: Pflichtfelder, Soll≠Haben, Aufwand/Aufwand, Datum im GJ, EBK 9000 nur in Eröffnungsbuchungen | 🟡 |
| **Tastatur-Workflow Buchungsmaske** — Enter springt zum nächsten Feld, Shift+Enter bucht sofort, Esc leert Betrag und Text | 🟡 |
| **Fristen-Dashboard mit Ampel** — Aufstellung, Offenlegung, Aufbewahrung pro Abschluss + UStVA-10.; rot/gelb/grün im Fristen-Reiter und Drohende-Fristen-Box auf der Startseite | 🟡 |
| **Vorjahresvergleich (Δ-Diff-Tabelle)** — Aktiva/Passiva/GuV-Positionen mit Vorjahr, Aktuell, Δ in EUR und %, Trend-Pfeil; live im JA-Editor | 🟡 |
| **BWA-Kommentar** — Freitext zur Erläuterung der BWA pro Jahresabschluss | 🟡 |
| **Saldenliste mit Trend-Sparkline** — pro Konto SVG-Polyline der Monatssalden über das Geschäftsjahr | 🟡 |
| **Steuerberater-Paket (One-Click-ZIP)** — Bilanz/GuV/Anhang als HTML, Saldenliste, Journal CSV/JSON, DATEV-EXTF und Manifest in einer Store-Only-ZIP (zero-dep) | 🟡 |
| **Beleg-Hash an Buchungen** — optionales Datei-Input speichert SHA-256, Name und Größe; die Datei bleibt beim Nutzer, der Hash dient als Verifikation bei späterer Prüfung | 🟡 |
| **E-Rechnungs-Dedup** — SHA-256 jeder eingelesenen XRechnung/ZUGFeRD-Datei; bei Wiedereinlesen Warnung mit Verweis auf die ursprüngliche Buchung | 🟡 |
| **Abschluss-Checkliste** — Anfangsbestände, AfA, Steuerrückstellung, RAP, Festschreibung, Bilanz ausgeglichen mit OK/offen/info-Ampel im JA-Editor | 🟡 |
| **Health-Check Startseite** — Stammdaten-Vollständigkeit, Abschluss-Stand und Backup-Alter (Website-Modus) als Status-Banner | 🟡 |

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

`data/` ist in `.gitignore` ausgenommen (Steuerdaten). Wer die eigene
Buchführung versionieren möchte, entfernt die Zeile `data/` aus `.gitignore` —
Git hält dann eine nachvollziehbare Änderungshistorie pro Abschluss fest. (Eine
Git-Historie ist eine pragmatische Nachvollziehbarkeit, aber kein „revisions-
sicheres" Archiv im Rechtssinne — sie lässt sich nachträglich umschreiben.)

**Website-Modus:** Die Daten liegen in der **IndexedDB des Browsers** und
verlassen das Gerät nicht. Über „Sichern" wird eine vollständige
`.obz`-Sicherungsdatei geschrieben — sie ist Backup und zugleich der Weg, einen
Stand auf ein anderes Gerät oder in einen anderen Browser zu übertragen
(„Backup öffnen"). Browser-Speicher ist **kein Ersatz für ein Backup**: die
`.obz`-Datei regelmäßig sichern.

**Aufbewahrung (GoBD) — in beiden Modi möglich.** Eine ordnungsgemäße,
nachvollziehbare Aufbewahrung der Buchführung ist eine Pflicht des Nutzers und
kein Automatismus des Tools. Sie ist in **beiden** Betriebsarten erreichbar: im
Selbst-Hosting-Modus über die JSON-Dateien in `data/` (Backup bzw. Git), im
Website-Modus über die regelmäßig gesicherte `.obz`-Datei. Verbindliche Auskunft
zu den konkreten GoBD-Pflichten geben Steuerberater bzw. Finanzamt.

Der Aufbau aller Datei- und Austauschformate — die `.obz`-Sicherung als
vollständiger JSON-Datenbestand, Journal-CSV/JSON, DATEV, GDPdU und der
Bankimport — ist in **`DATENFORMATE.md`** dokumentiert.

Die Funktionen rund um **E-Rechnungen** (XRechnung empfangen, eigene
XRechnung-UBL / -CII erzeugen, ZUGFeRD-Hybrid-PDF, USt-IdNr.-Prüfung mit
VIES) sind in **[`E-RECHNUNG.md`](E-RECHNUNG.md)** anleitend beschrieben.
Eine Kurzfassung als Schritt-für-Schritt-Hilfe steht im Tool selbst unter
**Hilfe → Buchungshilfe** (Abschnitte 8–13).

---

## Tests

```bash
npm test          # Rechenkern, SKR04, Taxonomie, XBRL, Steuer, UStVA, Import-Parser
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
public/shared/ustva.js        UStVA-Kennzahlen inkl. Soll-/Ist und Sonderfälle
public/shared/xbrl.js         E-Bilanz-XBRL und EBilanz-Container
public/shared/store-idb.js    Browser-Persistenz via IndexedDB (Website-Modus)
public/shared/store-adapter.js  Speicheradapter für beide Betriebsarten
public/shared/obz.js          .obz-Sicherung: packen, optional verschlüsseln
public/shared/fileio.js       Datei-Export/-Import (File System Access API)
public/shared/mt940.js        Parser für MT940-Bankauszüge (SWIFT)
public/shared/datev.js        Parser für DATEV-EXTF-Buchungsstapel
public/shared/journalexport.js  Buchungsjournal als CSV / JSON
public/shared/gdpdu.js        GDPdU-Datenträgerüberlassung (Z3)
public/shared/pruefkette.js   SHA-256-Hash-Verkettung festgeschriebener Buchungen
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

OpenBilanz ist ein freies Hilfsmittel zur **Vorbereitung** von Eröffnungsbilanz,
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
