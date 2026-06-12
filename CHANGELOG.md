# Changelog

Alle nennenswerten Änderungen an OpenBilanz werden hier dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

Die hier genannte Version wird über `npm run stamp` in `public/shared/version.js`
gestempelt und in jeden Export (XBRL, DATEV, Journal) geschrieben — so bleibt
nachvollziehbar, welcher Programmstand einen Abschluss erzeugt hat.

## [Unreleased]

## [2.17.0] - 2026-06-12

### Hinzugefügt
- **UStVA: § 13b- und Auslands-Kennzahlen automatisch** (Backlog-Item): auf
  3837/1407 gebuchte Reverse-Charge-Beträge (z. B. Auslands-SaaS) erscheinen
  jetzt automatisch in Kz 46/47 (EU-Leistungsbezüge § 13b Abs. 1) und Kz 67
  (§ 13b-Vorsteuer); Erlöse auf 4338/4339 (im Inland nicht steuerbar) in Kz 45.
  Neues Aufteilungsfeld gliedert den Drittlands-/Bauleistungsanteil der
  gebuchten Beträge nach Kz 84/85 um (Zahllast bleibt invariant). Suite 286 Tests.
- **Plausi-Hinweise**: mögliche Doppelerfassung (gebucht + manuell),
  1407/3837-Abweichung, generische § 13b-Konten 3835/1408, Konto 4336
  (gehört in Kz 21 + Zusammenfassende Meldung), OSS-Vorbehalt bei 4339.

### Geändert / korrigiert
- **Kleinunternehmer (§ 19 UStG) mit § 13b-Bezügen**: die § 13b-Steuer wird
  auch als Kleinunternehmer geschuldet und ist insoweit voranzumelden
  (§ 18 Abs. 4a UStG; § 19 Abs. 1 lässt das unberührt) — die UStVA-Karte
  weist sie jetzt als Zahllast aus (ohne Vorsteuerabzug, § 15 Abs. 2 UStG);
  vorher zeigte sie pauschal 0. Die Abschluss-Checkliste
  (`pruefeUstvaReadiness`) überspringt den Kleinunternehmer-Fall nur noch,
  wenn keine § 13b-Steuer anfällt.
- Manuelle § 13b-Felder in der UStVA-Karte klar als „NICHT gebuchte
  Drittland-/Bauleistungen (Kz 84/85)" beschriftet.

## [2.16.0] - 2026-06-12

### Hinzugefügt
- **Konten-Glossar in der Buchungshilfe** (T-0156): neue Karte „Konto
  nachschlagen" mit Live-Suche über den gesamten SKR04 (Nummer, Name und
  Konten-Erklärtexte); jede Kontonummer in den Buchungssatz-Beispielen ist
  jetzt anklickbar und springt mit Erklärung in die Suche.
- `SKR04Glossar.suche()` als gemeinsame, getestete Suchlogik — das Glossar
  nutzt dieselbe Funktion (Refactor statt Duplikat); Suite jetzt 278 Tests.

## [2.15.0] - 2026-06-10

Komplett-Review (Code, Texte, Rechtsstand, EB-/Übernahme-Automatik) plus drei neue
Buchungshilfe-Fälle. Rechtsstand gegen Juni 2026 verifiziert (KSt-Stufenplan, GWG,
§ 19/§ 20 UStG, Taxonomie 6.9, BMF Computerhardware, Aufbewahrung 8 Jahre — alles
bestätigt; nur die E-Rechnungs-Übergangsfristen waren zu pauschal dargestellt).

### Hinzugefügt
- Buchungshilfe **6d Bitcoin-Mining**: Zugang geminter Coins zum Tageskurs
  (BMF 06.03.2025), USt-Behandlung (nicht steuerbar, § 4 Nr. 8b UStG beim Verkauf,
  kein Vorsteuerabzug), eigener Strom (kein Innenumsatz) und Strom vom
  Gesellschafter (fremdübliche Abrechnung per Zwischenzähler, vGA-Warnung).
- Buchungshilfe **6e Stromverkauf & PV-Einspeisung**: 19 % USt auf Stromlieferung
  (Nullsteuersatz nur für die Anlage), Marktprämie als echter Zuschuss
  (BMF 31.03.2025), Stromsteuer-Befreiung ≤ 2 MW, 20-%-Grenze bei der
  erweiterten Grundstückskürzung.
- Buchungshilfe **6f Vermietung an andere Unternehmen**: Herstellungskosten des
  Mietobjekts (§ 255 Abs. 2/3 HGB, Anlagen im Bau 0700, aktivierte Eigenleistungen
  4820, Umbuchung bei Fertigstellung, Gebäude-AfA 3 %), Mietabrechnung mit/ohne
  USt-Option (§ 4 Nr. 12 / § 9 UStG), bewegliche Sachen immer 19 %.
- Glossar: Herstellungskosten, Anlagen im Bau, Option zur Umsatzsteuer (§ 9 UStG),
  Kryptowerte & Mining; erweiterte Grundstückskürzung um die 20-%/5-%-Grenzen ergänzt.
- Steuerschätzung: eigenes Feld **Gewerbeverlust aus Vorjahren** (§ 10a GewStG) —
  KSt- und GewSt-Verlusttopf sind rechtlich getrennt; leer = Näherung wie bisher.
- 5 neue Tests (Storno-Paar, baumSummen-Null-Kinder, Tausenderformat, getrennter
  Gewerbeverlust, MT940-Jahrhundertfenster) — Suite jetzt 277 Tests.

### Behoben
- **EB-Übernahme verlor das Vorjahresergebnis**: `eroeffnungsPlan` übersprang
  P.A.V; der Jahresüberschuss/-fehlbetrag des Quelljahres wird jetzt als
  Gewinn-/Verlustvortrag (2970/2978) gegen 9000 vorgetragen — vorher ging die
  Folgejahres-Bilanz um genau das Vorjahresergebnis nicht auf.
- **EB-Übernahme bei nicht voll eingezahltem Stammkapital**: nicht eingeforderte
  ausstehende Einlagen werden jetzt auf 2910 gebucht; vorher setzte „Salden
  übernehmen" das volle gezeichnete Kapital an und die Bilanz war um die
  ausstehenden Einlagen unausgeglichen. Neue Plausibilitäts-Warnung, wenn das
  EBK 9000 im Vorschau-Plan nicht aufgeht.
- Storno-Asymmetrie: `closing.js` (hatKonto/summeKonto) und der Monats-Trend
  übersprangen nur das stornierte Original, zählten die Storno-Gegenbuchung aber
  mit — jetzt wird das Paar komplett ignoriert.
- `baumSummen`: explizit auf 0 gesetzte Kinder überstimmen jetzt einen
  Eltern-Direktwert (vorher zeigte die Bilanz still den veralteten Elternwert).
- `num()`: deutsches Tausenderformat („1.234,56") wird in Rechenkern,
  Steuerschätzung und Ausgangsrechnung korrekt gelesen.
- MT940-Import: zweistellige Jahre > 50 werden als 19xx gelesen.
- Stores: `speichereAbschluss` (Node) mutiert das übergebene Objekt nicht mehr;
  IDB-`loescheAbschluss` meldet jetzt ehrlich, ob gelöscht wurde; ID-Vergabe
  kollisionssicher; Arelle-Tempdatei kollisionssicher.

### Geändert
- E-Rechnungs-Übergangsfristen präzisiert (Hilfe + E-RECHNUNG.md): bis 31.12.2026
  für alle Aussteller, bis 31.12.2027 nur bei Vorjahresumsatz ≤ 800.000 €.
- Buchungshilfe Fall 2 (Saldenvortrag) um 2910/2970/2978-Zeilen ergänzt.
- Anrede in den UI-Texten auf durchgängiges Du vereinheitlicht; kleinere
  Rechtschreib- und Typografie-Korrekturen.

## [2.14.3] - 2026-06-10

Ergebnis eines Re-Reviews (Delta-Code v2.13.1→v2.14.2 + fachliche Prüfung aller 65
Konten-Glossar-Texte durch ein zweites Augenpaar). Der Code war sauber (keine Regressionen;
UStVA-Zahllast-Äquivalenz und Konflikt-Warnung tiefgeprüft) — korrigiert wurden 9 Glossar-
Texte und 3 Code-Kleinigkeiten.

### Behoben (Konten-Glossar, fachliche Präzisierungen)
- **0135 Software**: Steuerlich gilt seit BMF-Schreiben 22.02.2022 eine Nutzungsdauer von
  1 Jahr für Standardsoftware als zulässig (Wahlrecht) — der pauschale Hinweis „üblich
  3 Jahre" war überholt und hätte Steuervorteile verschenkt.
- **7000 Beteiligungserträge**: § 8b-KStG-Logik richtig herum erklärt — grundsätzlich 95 %
  steuerfrei, ABER Streubesitz unter 10 % voll steuerpflichtig (§ 8b Abs. 4 KStG);
  GewSt-15 %-Grenze ergänzt.
- **7600 Körperschaftsteuer**: konkreter Absenkungspfad benannt (15 % bis 2027, ab 2028
  jährlich −1 Punkt bis 10 % ab 2032).
- **0670/6260 GWG**: Wahlrechte sauber getrennt (Sofortabschreibung § 6 Abs. 2 vs.
  Sammelposten § 6 Abs. 2a EStG; steuerliches Wahlrecht vs. Handelsrecht).
- **2910** (Gründungsbuchung nur bei Teileinzahlung), **2920** (nur Gesellschafter-
  Zuzahlungen, keine Drittzuschüsse), **1600** (tägliche Aufzeichnung + Kassensturz
  sauber getrennt), **3730** (Anmeldungszeitraum monatlich/vierteljährlich/jährlich).

### Geändert
- Glossar-Render: Kontenliste wird je Eingabe nur noch einmal aufgebaut (Performance).
- Fristen-Kommentar präzisiert (unbekannter Größenklassen-Wert → strengere 3 Monate).

## [2.14.2] - 2026-06-10

Nacharbeit: die letzten offenen Review-/Audit-Findings umgesetzt.

### Behoben / Hinzugefügt
- **Eingabe-Konflikt Oberposten/Unterposten wird gemeldet**: Wer einen Wert direkt auf einem
  Oberposten (z. B. B.II) erfasst UND zugleich Unterposten belegt, verlor den Oberposten-Wert
  bisher stillschweigend (die Summe der Unterposten hat Vorrang). Die Plausibilitätsprüfung
  warnt jetzt und nennt den ignorierten Betrag.
- **Buchungsprüfung 2910**: Eine Haben-Buchung auf „Ausstehende Einlagen, nicht eingefordert"
  (Konto führt einen Soll-Saldo, § 272 Abs. 1 HGB) löst jetzt einen Hinweis aus — sie ist nur
  bei Einforderung/Auflösung richtig, sonst meist eine Verwechslung mit 2900.
- **Konten-Glossar 2980**: warnender Eintrag zum „Sonderposten mit Rücklageanteil"
  (BilMoG-Altfall-Konto, Ausweis-Näherung, Abstimmung mit dem Steuerberater empfohlen).
- **§ 10d EStG nachverifiziert** (Primärquelle): aktueller Normtext = 70 % (ab VZ 2024) ohne
  Befristung im Text; Verifikationsstand + Wiedervorlage-Hinweis im Code dokumentiert.
  Details: `.planning/RECHTS-REVIEW.md` (Nacharbeit).

## [2.14.1] - 2026-06-10

Ergebnis eines vollständigen **rechtlichen Reviews** (28 Rechtswerte gegen die Gesetzes-
Primärquellen verifiziert + Cross-Check gegen DATEV-Kontenrahmen/sevDesk/Lexware/BMF —
Details in `.planning/RECHTS-REVIEW.md`). 26 Werte ohne Abweichung bestätigt; 2 behoben:

### Behoben
- **UStVA § 13b UStG — amtliche Kennzahlen-Semantik**: Die Kennzahlen-Übersicht führte den
  § 13b-**Steuerbetrag** unter „Kz 84" und fasste die § 13b-Vorsteuer mit in Kz 66 zusammen.
  Amtlich gilt: **Kz 84 = Bemessungsgrundlage (netto), Kz 85 = Steuer darauf, Kz 67 =
  § 13b-Vorsteuer (getrennt von Kz 66)**. Die berechnete **Zahllast (Kz 83) war stets
  korrekt** — aber beim manuellen Übertrag nach ELSTER wäre der Steuerbetrag im falschen
  Feld gelandet. Jetzt werden Kz 84/85/66/67 amtlich korrekt berechnet und angezeigt.
- **Aufstellungsfrist § 264 Abs. 1 HGB nach Größenklasse**: Die Fristenübersicht zeigte
  pauschal 6 Monate (korrekt für kleine/Kleinst-Kapitalgesellschaften, Satz 4). Für
  mittelgroße/große Gesellschaften gilt die **3-Monats-Frist** (Satz 3) — wird jetzt anhand
  der Größenklasse des Abschlusses unterschieden.

## [2.14.0] - 2026-06-10

### Hinzugefügt
- **Durchsuchbares SKR04-Konten-Glossar**: Das Glossar erklärt jetzt auch die SKR04-Konten —
  je Konto eine **eigene** kurze Praxiserklärung (wofür, wann buchen, worauf achten), gestützt
  auf die Rechtsgrundlagen (HGB/UStG/AO/GmbHG); **keine übernommenen Beschreibungstexte**
  (nur Kontonummern und amtliche Kurzbezeichnungen sind Fakten). Etappe 1 deckt die **64
  häufigsten Konten** einer kleinen/vermögensverwaltenden GmbH ab (`shared/skr04-glossar.js`,
  getestet, erweiterbar). Über die Glossar-Suche ist der **gesamte Kontenrahmen (1024 Konten)**
  nach Nummer, Name und Erklärtext durchsuchbar; jedes Konto zeigt seine Bilanz-/GuV-Zuordnung
  (§ 266/§ 275 HGB) aus den Kontenrahmen-Daten.

## [2.13.1] - 2026-06-10

Härtung aus einem vollständigen Code-Review (Sicherheit, Robustheit, Aufräumen). Keine
Funktionsänderung für den normalen Ablauf.

### Sicherheit
- **Pfad-Traversal im Selbst-Hosting-Server behoben**: Ein Mandanten-Parameter aus reinen
  Punkten (`..`) konnte über `path.join` aus dem Mandanten-Verzeichnis ausbrechen (im
  Netzwerk-Modus ein Daten-Isolationsbruch). Solche Segmente werden jetzt entschärft. Punkte
  innerhalb eines Namens bleiben erlaubt.
- **HTTP-Header-Injection beim Datei-Download behoben**: Der Dateiname im
  `Content-Disposition`-Header (aus der Abschluss-ID) wird jetzt auf sichere Zeichen
  beschränkt — kein Response-Splitting/Quote-Breakout mehr.
- **Supply-Chain-Schutz**: `tools/setup-pdf-lib.sh` verifiziert den pdf-lib-Download jetzt
  gegen einen gepinnten SHA-256 (statt nur die Größe zu prüfen).

### Behoben (Robustheit)
- **Kein lautloses Scheitern mehr bei Speicher-/Ladefehlern**: Ein globales Sicherheitsnetz
  fängt nicht abgefangene Promise-Fehler (z. B. IndexedDB-Quota/Blockade) und zeigt sie an;
  zusätzlich klare Meldungen beim App-Start und beim Speichern („bitte Backup erstellen").
  Bei Buchführungsdaten darf ein Fehler nie unsichtbar bleiben.
- **Vorjahresvergleich**: Nach einem Ladefehler des Vorjahresabschlusses bleibt der Vergleich
  nicht mehr dauerhaft leer (Lade-Sperre wird zurückgesetzt, Retry möglich).

### Geändert
- Aufräumen: überflüssiger Konten-Options-Aufbau bei jedem Buchhaltungs-Render entfernt,
  toter Browser-Ladevorgang (`unterschrift-pdf.js`, durch das Voll-PDF ersetzt) entfernt.
- Dokumentation: Drittquellen vollständig (ERPNext-SKR04-Vorlage als Herkunft der
  HGB-Zuordnung; vendored PDF-Bibliotheken), CHANGELOG-Vergleichslinks korrigiert.
- Tests: bisher ungetestete, datennahe Logik abgedeckt (CAMT-/IBKR-Bankimport-Parser,
  verschlüsselte `.obz`-Sicherung, Gegenkonto-Heuristik, Abschluss-Checkliste). 265 Tests.

## [2.13.0] - 2026-06-08

### Hinzugefügt
- **Gezeichnetes Kapital — vollständige Aufgliederung im Bilanz-Ausweis und PDF**: Der
  Eigenkapital-Ausweis (Bildschirm-Bilanz und vollständiges PDF) zeigt jetzt — zusätzlich zur
  §-272-Nettomethode (Gezeichnetes Kapital ./. nicht eingeforderte ausstehende Einlagen =
  Eingefordertes Kapital) — die informative Zeile **„davon eingezahlt"** sowie, falls vorhanden,
  **„davon eingefordert, noch nicht eingezahlt"** (§ 272 Abs. 1 S. 3 HGB). Beispiel GmbH-Gründung
  25.000 € → 12.500 € eingezahlt + 12.500 € nicht eingefordert ist damit auch im Ausweis/PDF
  vollständig sichtbar (bisher nur in der Eingabe-Karte). Die Aufgliederung ist rein informativ
  (Memo-Zeilen) und verändert die Bilanzsummen nicht.

## [2.12.0] - 2026-06-08

### Hinzugefügt
- **Geführte Umbuchung zwischen eigenen Konten** (Buchhaltung): Eine neue Karte „Geld umbuchen"
  erzeugt aus „**von Konto → nach Konto + Betrag**" automatisch den korrekten Buchungssatz, ohne
  dass man Soll/Haben kennen muss (Aktiv an Aktiv: Soll = Ziel, Haben = Quelle). Optional **über
  Geldtransit (Konto 1460)** in zwei Schritten — sinnvoll, wenn die Überweisung an verschiedenen
  Tagen getrennt auf beiden Kontoauszügen erscheint (1460 nettet auf 0). Die Buchungs-Erzeugung
  liegt in einem eigenen, getesteten Modul `shared/umbuchung.js`; jede erzeugte Buchung läuft
  zusätzlich durch die normale Buchungsprüfung.

## [2.11.1] - 2026-06-08

### Behoben
- **§ 268 Abs. 3 HGB — Bilanzgleichung bei negativem Eigenkapital (Fehlbetrag)**: Bei einer
  überschuldeten GmbH (Eigenkapital durch Verluste negativ) meldete das Tool die korrekt
  gebuchte Bilanz fälschlich als **nicht ausgeglichen** — um genau den „Nicht durch
  Eigenkapital gedeckten Fehlbetrag". Ursache: Der Fehlbetrag wurde auf die Aktivseite
  reklassifiziert, das negative Eigenkapital aber zusätzlich in der Passivsumme mitgezählt
  (Doppelzählung). Jetzt trägt das negative Eigenkapital 0 zur Passivsumme bei (es steht als
  Posten F auf der Aktivseite) — eine konsistent gebuchte überschuldete GmbH ist wieder
  ausgeglichen, eine real unausgeglichene Bilanz wird weiterhin korrekt erkannt. Gefunden im
  Codex-Voll-Audit (T-0161); ein bestehender Test hatte das Fehlverhalten mit inkonsistenten
  Eingabewerten zementiert und wurde mitkorrigiert.

## [2.11.0] - 2026-06-08

### Behoben
- **Ausstehende Einlagen buchbar (§ 272 Abs. 1 HGB)**: Das Konto **2910 „Ausstehende
  Einlagen auf das gezeichnete Kapital, nicht eingefordert"** wurde beim Übernehmen der
  Salden ignoriert — eine GmbH-Gründungsbuchung (Bank 12.500 € + 2910 12.500 € an
  Gezeichnetes Kapital 2900 25.000 €) ließ die Bilanz unausgeglichen. Jetzt wird der
  2910-Saldo korrekt als nicht eingeforderte ausstehende Einlage erfasst und offen vom
  gezeichneten Kapital abgesetzt (eingefordertes Kapital = Nennbetrag ./. nicht eingefordert),
  die Bilanz gleicht aus. Der Buchhaltungs-Modus bildet einen selbstkonsistenten Kapitalblock
  (ohne Direkteingabe-Reste); die Direkteingabe der Kapitalangaben schaltet wieder auf die
  §-272-Ableitung zurück.

### Hinzugefügt
- **Buchungshilfe für ausstehende Einlagen** in der Kapital-Karte: zeigt den korrekten
  SKR04-Buchungssatz für die GmbH-Gründung und erklärt den Nettoausweis (§ 272 Abs. 1 S. 2/3 HGB).

## [2.10.0] - 2026-06-08

### Hinzugefügt
- **Gezeichnetes Kapital: vollständige Aufgliederung nach § 272 Abs. 1 HGB am Bildschirm**:
  Die Bilanz zeigt das gezeichnete Kapital jetzt im **offenen Nettoausweis** — Nennbetrag,
  davon offen abgesetzt die **nicht eingeforderten ausstehenden Einlagen**, Restgröße als
  **Eingefordertes Kapital** in der Hauptspalte. Beispiel GmbH-Gründung: Gezeichnetes Kapital
  25.000 € ./. nicht eingeforderte Einlagen 12.500 € = Eingefordertes Kapital 12.500 €. Die
  Kapital-Eingabekarte führt dieselbe Aufgliederung auf (gezeichnet, davon eingezahlt, davon
  eingefordert/unbezahlt, davon nicht eingefordert, eingefordertes Kapital). Bisher war dieser
  offene Ausweis nur im PDF, am Bildschirm fehlte die Position „davon nicht eingefordert".
  Verifiziert gegen § 272 Abs. 1 HGB; eingeforderte, noch nicht eingezahlte Einlagen bleiben
  gesondert unter den Forderungen (Aktiva, § 272 Abs. 1 S. 3 HGB).

## [2.9.0] - 2026-06-08

### Hinzugefügt
- **Bankimport: Buchung vor dem Übernehmen entfernen**: Jede Zeile der CAMT.053-/
  Kontoauszug-Vorschau hat jetzt einen **Löschen-Button (×)**, um einzelne Umsätze
  vor dem Übernehmen herauszunehmen (z. B. wenn sich zwei Buchungen überschneiden).

### Behoben
- **Bankimport: aufklappbares Konto-Dropdown zurück**: Mit dem vollen SKR04 (v2.8.0)
  war die Gegenkonto-Auswahl im Import nur noch ein Suchfeld ohne sichtbares Dropdown.
  Jetzt wieder ein **aufklappbares Auswahlmenü über den vollen SKR04** (vorausgefüllt
  mit dem Kontierungs-Vorschlag, aber aufklapp- und änderbar; Tippen springt zum Konto).
  Die volle Kontenliste wird erst beim Öffnen geladen — auch bei vielen Importzeilen
  flüssig. Gilt einheitlich für Buchungsmaske und Import-Vorschauen.

## [2.8.0] - 2026-06-08

### Hinzugefügt
- **Vollständiger SKR04-Kontenrahmen wähl- und buchbar**: Bisher stand im Buchungs-
  Modus nur eine kuratierte Auswahl (~122 Konten) zur Verfügung — fehlende Standard-
  Konten (z. B. **6420 Beiträge**) waren nicht wählbar, und ihr Saldo konnte „verpuffen".
  Jetzt sind **alle ~1024 SKR04-Sachkonten** verfügbar, jeweils korrekt einer HGB-
  Bilanzposition (§ 266) bzw. GuV-Kategorie (§ 275) zugeordnet. Die HGB-Zuordnung der
  Zusatzkonten ist aus einer verifizierten Vorlage abgeleitet und gegen die bestehende
  kuratierte Auswahl als Ground-Truth kalibriert (Bilanz 67/73 exakt, GuV 48/48 exakt);
  die kuratierten Konten behalten Vorrang.
- **Durchsuchbare Konto-Eingabe**: Soll-/Haben-Konto und die Import-Vorschauen nutzen
  jetzt ein durchsuchbares Eingabefeld (Tippen nach **Nummer oder Name**, z. B. „6420"
  oder „Beiträge") statt eines langen Auswahlmenüs — auch performanter bei großen
  Kontoauszug-Importen.

### Behoben
- **Bilanz-Ausgleich bei Kontra-Konten**: Mit dem vollen Kontenrahmen wurden erstmals
  Kontra-Konten buchbar (gewährte/erhaltene Skonti, Erlösschmälerungen, Boni). Die
  GuV-Aggregation wurde vorzeichenrichtig korrigiert (zuvor `Math.abs`), sodass solche
  Konten ihre Kategorie korrekt **mindern** und die Bilanz ausgeglichen bleibt. Die
  Abschluss-Logik liegt nun in `public/shared/kontenabschluss.js` und ist testabgedeckt.

## [2.7.0] - 2026-06-08

### Hinzugefügt
- **Übermittlungs-Hinweise in „Fristen & Pflichten"**: Jeder Eintrag der lebenden
  Fristen-Übersicht zeigt jetzt kurz, **wohin und wie** die Pflicht übermittelt wird —
  Offenlegung → **Unternehmensregister** (seit 2022, nicht mehr Bundesanzeiger),
  UStVA → **ELSTER** ans Finanzamt, Jahresabschluss aufstellen → interne Pflicht
  (Grundlage für Offenlegung & E-Bilanz), Aufbewahrung → keine Abgabe (im Unternehmen
  vorhalten) — jeweils mit Link zur amtlichen Stelle. Die Übermittlungswege sind gegen
  die Primärquellen (§ 325 HGB, § 18 UStG) verifiziert. Datengetrieben über
  `Fristen.uebermittlungFuer(art)`.

## [2.6.0] - 2026-06-08

### Hinzugefügt
- **Vollständiges, ausfüllbares Bilanz-PDF** (AcroForm): der direkte PDF-Export in
  der Druckansicht („Vollständiges PDF (ausfüllbar)") erzeugt jetzt das KOMPLETTE
  Dokument — Kopf, Bilanz in Kontoform (Aktiva/Passiva mit allen Positionen, den
  §272-Sonderausweisen und Summen), GuV (beim Jahresabschluss), Anhang/Angaben und
  Unterschriftsblock — PLUS interaktive Formularfelder für **Ort, Datum und
  Unterschrift(en) der Geschäftsführung**. Neues Modul `public/shared/bilanz-pdf.js`
  (pdf-lib) mit reinem, Node-getestetem Daten-Extraktor (beide §272-Pfade) und
  visuell gegen den Druck-Soll verifiziert.

### Behoben
- **Kein gestempeltes Erstell-/Heute-Datum mehr im erzeugten PDF.** Das Datum ist
  ein ausfüllbares Feld, damit der Abschluss rückwirkend zum Stichtag unterzeichnet
  werden kann. (Die Datums-/URL-Kopfzeile beim Browser-Druck „Drucken (Browser)"
  stammt vom Browser selbst und ist im Druckdialog unter „Kopf- und Fußzeilen"
  abschaltbar — das vollständige PDF ist davon nicht betroffen.)
- PDF-Texterzeugung gegen seltene, nicht darstellbare Steuerzeichen (z. B. aus
  fehldekodierten Copy-Paste-Eingaben) gehärtet; lange Firmennamen werden im Kopf
  passend skaliert.

### Geändert
- Der frühere Knopf „Unterschriften-PDF (ausfüllbar)" (nur Felder, ohne Bilanz) ist
  durch „Vollständiges PDF (ausfüllbar)" ersetzt — der direkt erzeugte PDF enthält
  jetzt immer die komplette Bilanz samt der ausfüllbaren Felder.

## [2.5.0] - 2026-06-08

### Hinzugefügt
- **Ausfüllbares Unterschriften-PDF** (AcroForm): neuer Knopf „Unterschriften-PDF
  (ausfüllbar)" in der Druckansicht erzeugt ein einseitiges PDF mit interaktiven
  Formularfeldern für **Ort, Datum und Unterschrift(en) der Geschäftsführer** —
  direkt im PDF ausfüllbar/unterschreibbar, kein Drucken-und-Handschrift nötig.
  Modul `public/shared/unterschrift-pdf.js` (pdf-lib, browser-vendored); die
  Formularfelder sind per Node-Test (pdf-lib) verifiziert. Geschäftsführer-Namen
  kommen aus den Stammdaten (ein Unterschriftsfeld je Geschäftsführer).

## [2.4.1] - 2026-06-08

### Behoben
- **Druck/PDF der Eröffnungsbilanz erzeugte eine leere zweite Seite.** Im Druck
  wurde der App-Container weiterhin auf volle Viewport-Höhe gezwungen
  (`#app{min-height:100vh}`), was zusammen mit den `@page`-Rändern (18mm) über die
  A4-Höhe hinausragte. Im `@media print` werden `#app`/`html`/`body`/`​.main`-Höhen
  jetzt zurückgesetzt → eine inhaltlich einseitige Bilanz druckt nur noch eine Seite.

## [2.4.0] - 2026-06-08

### Hinzugefügt
- Sichtbare **Versionsanzeige** in der Seitenleisten-Fußzeile (`v<version> (<commit>)`
  aus `version.js`) — erleichtert die Deploy-Verifikation auf einen Blick.

### Behoben
- Export-Manifest (Steuerberater-Paket) trug als OpenBilanz-Version „unbekannt"
  (Referenz auf das nicht existierende `Version.bezeichnung`) → nutzt jetzt
  `Version.signatur()` (z. B. „OpenBilanz v2.4.0 (hash)").

## [2.3.0] - 2026-06-08

### Hinzugefügt
- **Welle 7 — Mehrmandanten (Multi-Tenant):** OpenBilanz verwaltet jetzt mehrere
  Firmen/Gesellschaften getrennt. Jeder Mandant hat eigene Stammdaten und
  Abschlüsse; ein Mandanten-Dropdown in der Seitenleiste (Hotkey Alt+1..9) wechselt
  den aktiven Mandanten, „+" legt einen neuen an. Startseite zeigt eine Zeitleiste
  der Abschlüsse je Mandant (EB → JA → JA).
  - Reine, getestete Migrations-Transform (`public/shared/mandanten-migration.js`).
  - Server (`lib/store.js`): Layout `data/mandanten/<id>/…` + `data/mandanten.json`,
    Auto-Migration des alten einfirmigen Layouts beim Start (Pre-Backup, kopieren,
    Verifikation), `mandantId`-Parameter (Default „standard"). Routen in `server.js`
    + neue Route `/api/mandanten`.
  - Browser (`public/shared/store-idb.js`): IndexedDB-Version 2 mit verlustfreier
    `onupgradeneeded`-Migration der Einfirmen-Daten zum Mandanten „standard"; Voll-
    Export/Import mandantenübergreifend (alte .obz-Sicherungen importieren weiter).
  - Adapter (`public/shared/store-adapter.js`): aktiver Mandant wird transparent
    durchgereicht; backward-kompatibel (ohne Auswahl alles auf „standard").
  - Migration verifiziert: Hub-Re-Refute deploy-safe (0 Blocker,
    `.planning/HUB-REFUTE-welle7-idb.md`) + automatisierte fake-indexeddb-Tests der
    v1→v2-`onupgradeneeded`-Migration (verlustfrei, kein Phantom-Mandant, Isolation).
    Härtungen: Backup-Hinweis vor der Einbahn-Migration, dbPromise-Retry bei
    blockierter DB, serverseitige `mandantId`-Quergriff-Sperre.

## [2.2.0] - 2026-06-07

### Hinzugefügt
- **Importprotokoll:** Bank- (CAMT.053, MT940), Broker- (Interactive Brokers
  Flex) und DATEV-Importe legen jetzt einen GoBD-nachvollziehbaren Protokoll-
  eintrag an — Format, Zeitpunkt, Anzahl erkannt/übernommen und Datumsbereich —
  und zeigen ihn als read-only „Importprotokoll"-Karte in der Buchhaltung
  (jüngste zuerst). Reine, voll unit-getestete Logik in
  `public/shared/import-protokoll.js` (`584866b`), UI-Verdrahtung in `app.js`
  (`f947779`). Additives, backward-kompatibles Abschluss-Feld `importLog`, das in
  beiden Betriebsarten (Node-JSON und IndexedDB) mitgespeichert wird.

## [2.1.0] - 2026-06-07

Konsolidierte Nachzieh-Release. Seit dem 2.0.0-Launch (2026-05-17) wurde der
Funktionsumfang erheblich erweitert, ohne dass Zwischenversionen geschnitten
wurden. Diese Release zieht den Versionsstand **ehrlich nach** (Batch enthält
Features, kein Breaking Change → MINOR-Bump). Künftige Änderungen werden pro
abgeschlossener Einheit versioniert (siehe Versionierungs-Disziplin unten).
Einzelnachweise als Git-Commit-Kurz-Hashes in Klammern.

### Hinzugefügt
- **Dual-Mode-Betrieb:** Website-Variante mit Datenhaltung im Browser
  (IndexedDB) neben dem Self-Hosting-Server (`8ea0f01`).
- **E-Bilanz-Validierung im Browser** via Pyodide/Arelle, experimentell, mit
  klarem Urteil statt Rohprotokoll und Trennung formaler/inhaltlicher Prüfung
  (`ddfe17b`, `2e962dc`, `20b66ce`, `6eafe30`).
- **GoBD-Konformität:** Festschreibung/Unveränderbarkeit von Buchungen
  (`80b0373`), SHA-256-Hash-Verkettung festgeschriebener Buchungen (`ff88e2d`),
  Beleg-Hash mit Metadaten ohne Inhalt (`a8adf0a`), Änderungs-/Audit-Trail
  (`169e4b8`), GoBD-Verfahrensdokumentation (`f1d3179`).
- **Eröffnung & Erfassung:** Eröffnungsbuchungen, Buchungshilfe und
  Beschluss-Generator (`7d076d3`), geführter Erfassungs-Assistent in Schritten
  (`f216f74`), Rumpfwirtschaftsjahr nach unterjähriger Gründung (`1bd6fc3`).
- **Steuern:** jahresabhängiger KSt-Satz (Investitionssofortprogramm 2025,
  `a766616`), Kapitalertragsteuer-Assistent (`51bcc73`), UStVA-Aufbereitung
  (`3dd79ed`) mit Soll-/Ist-Versteuerung (`f2489c2`) und Sonderfällen
  (Kleinunternehmer, § 13b, steuerfreie Umsätze, `c52d064`),
  Ertragsteuer-Sonderfälle (Verlustvortrag § 10d EStG, GewSt-Hinzurechnungen,
  vGA, `f378591`), § 8b Abs. 7 KStG (Handelsbestand, `80d719a`), § 26 KStG /
  § 9 GewStG-Anrechnung und Plausibilitätsprüfungen (`2318d34`, `1fe0d1a`).
- **GmbH-Untertypen:** Immobilien, Trading, Hybrid (`acc771f`).
- **Anlagenverzeichnis & AfA** (`f65a3a7`) inkl. Abgänge und
  Teilwertabschreibungen (`b8f50c2`).
- **Importe:** DATEV-Export EXTF-Buchungsstapel (`68aec07`), Bankimport CAMT.053
  (`661d6e8`), MT940 und DATEV-Import EXTF (`cdf8593`), Broker-Import Interactive
  Brokers Flex (`46dff26`), mehrere Bankkonten SKR04 1820–1840 (`a9c4d3d`),
  nutzerpflegbare Kontierungsregeln (`5a7f9ce`).
- **E-Rechnung:** Anzeige XRechnung/ZUGFeRD (`fafc83a`), Empfang härten
  (Profil, Positionen, Plausi, ZUGFeRD-PDF, `2a24f3c`), Versand
  (XRechnung-UBL/CII, ZUGFeRD-PDF) inkl. USt-IdNr.-Prüfung (`29b46a5`),
  Dedup gegen Doppelübernahme (`acaf82b`), Anleitung und In-App-Hilfe
  (`d3ea2aa`).
- **Auswertung & Übersicht:** BWA (`93dd1e8`) mit Freitext-Kommentar pro
  Abschluss (`de392f7`), Vorjahresvergleich als Δ-Diff-Tabelle (`d6c188d`),
  Saldenliste mit Trend-Sparkline (`ec351fe`), Fristen-Dashboard mit Ampel
  (`d7a35c3`), Health-Check-Startseite (`1148707`).
- **Offenlegung** beim Unternehmensregister (`140b9c3`).
- **Trading-Workflows:** Stillhaltergeschäfte mit Drohverlustrückstellung
  (`6508c90`), Fremdwährung § 256a HGB Stichtagsbewertung (`1de015e`),
  Termingeschäfte Futures/CFD mit Variation-Margin (`23f0eb1`), strenges
  Niederstwertprinzip mit Stichtags-Erinnerung (`c4abe76`), Nebenkosten
  Geldverkehr SKR04 6855 (`c0f7819`).
- **Bedienkomfort:** Command-Palette Cmd/Ctrl+K mit Fuzzy-Suche (`122608c`),
  Buchungsvorlagen (`a477d95`), wiederkehrende Buchungen mit Takt und
  Fälligkeits-Hinweis (`eba186f`), Konto-Autocomplete aus dem Journal
  (`6992ddb`), Buchungs-Plausi vor Journalaufnahme (`f13ce60`),
  Tastatur-Workflow Enter-Chain/Esc (`bd2ff92`), Mausrad-Multiplikator in
  Betragsfeldern (`88fb973`).
- **Compliance-Helfer:** Lückenanalyse für Belegnummern-/Rechnungsnummernkreise
  (§ 14 UStG, `aa49bdf`), UStVA-Bereitschaftsprüfung vor der Abgabe (§ 18 UStG,
  `d028b0b`), Buchungsbeleg-Aufbewahrungsfrist 8 Jahre (BEG IV) im
  Fristen-Dashboard (`00e4b8c`), Closing-Checkliste zur Readiness vor der
  Feststellung (`a464cf6`).
- **Export & Weitergabe:** Steuerberater-Paket als One-Click-ZIP
  (zero-dependency, `89ea38c`), Datenexport Buchungsjournal CSV/JSON und
  GDPdU-Export mit Formatdoku (`3eec481`), DATEV-Export-Diff mit Hash-Hinweis
  bei Wiederholung (`ea7de3e`).
- **Zugänglichkeit & Onboarding:** Barrierefreiheit (Tastaturbedienung, Fokus,
  Dialog-Rollen, `efc9baf`), durchsuchbares Glossar (`4ac6217`) mit
  Kontext-Tooltips (`a1f8bd7`), 4-Schritt-Onboarding-Tour (`6f5c2d9`),
  Seitenleisten-Navigation der Abschluss-Abschnitte (`ce67942`),
  Demo-Portal und Beispiel-GmbHs (`1c9aeb6`, `7f83136`).

### Geändert
- Druckansicht HGB-konform im A4-Format mit Markenauftritt und
  Haftungsausschluss (`5bc2f22`).
- **Sicherheit:** Server bindet standardmäßig nur auf 127.0.0.1 (`84b7786`),
  Netzwerk-Betrieb nur per Opt-in-Pflicht mit Warnleiste (`31ab1b8`).
- Service Worker auf Network-first für App-Code umgestellt (gegen veralteten
  Cache, `fe42459`).
- Versionsstempel in Exporte, CI-Workflow und präziserer Produkt-Claim aus den
  Code-Review-Folgearbeiten (`604e1cf`).
- **Welle 7 (Mehrmandanten) — Grundbausteine, Feature noch nicht aktiv
  (geparkt):** reine Mandanten-Migrations-Transform (`2dfbf43`) und
  Server-Datei-Layout-Migration (`f6be8e2`) als getestete Bausteine; die
  Verdrahtung/Aktivierung steht noch aus.

### Behoben
- Website-Modus startete nicht — fehlendes `root` in der UMD-Factory
  (`49cb6f0`).
- Backup-Import öffnete keinen Dialog (`ff32d36`).
- `renderUstva` brach an einer nicht deklarierten Variable ab (`d86b3e4`).
- Eröffnungsbuchung übernimmt den EB-Stichtag statt stur 01.01. (`ebb491a`).
- Wiederkehrende Vorlage galt im Erstaufruf zeitunabhängig als fällig
  (Abhängigkeit von der realen Systemuhr behoben, `90002c7`).
- Welle-7-Migration: vervollständigt partielle Stände statt sie zu verschlucken
  (`c0a69e5`) und überschreibt keine vorhandene fremde `mandantId` (`f83882a`).

### Dokumentation
- README/ROADMAP fortlaufend nachgezogen (Funktionsübersicht, Betriebsarten,
  Status-Legende ✅ live geprüft / 🟡 ungetestet), Rechts-/Quellenhinweise und
  GoBD-Archivierungshinweis für E-Rechnungen (BMF 14.07.2025, `e4e8735`),
  Taxonomie-Beobachtungsliste auf Ist-Stand 2026-06 (Version 6.9 weiterhin
  aktuell, `c5922e3`), Welle-7-Scope-Skizze (`6cffe1b`).

## [2.0.0] - 2026-05-17

- Initiale Veröffentlichung von OpenBilanz: HGB-Jahresabschluss/Eröffnungsbilanz
  für die GmbH, SKR04, E-Bilanz/XBRL-Grundlage, ELSTER-Bezug (`7e2ecb3`).
  Der vollständige Funktionsumfang dieses Stands ist in der README dokumentiert.

[Unreleased]: https://github.com/chloepriceless/OpenBilanz/compare/v2.14.3...HEAD
[2.14.3]: https://github.com/chloepriceless/OpenBilanz/compare/v2.14.2...v2.14.3
[2.14.2]: https://github.com/chloepriceless/OpenBilanz/compare/v2.14.1...v2.14.2
[2.14.1]: https://github.com/chloepriceless/OpenBilanz/compare/v2.14.0...v2.14.1
[2.14.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.13.1...v2.14.0
[2.13.1]: https://github.com/chloepriceless/OpenBilanz/compare/v2.13.0...v2.13.1
[2.13.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.12.0...v2.13.0
[2.12.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.11.1...v2.12.0
[2.11.1]: https://github.com/chloepriceless/OpenBilanz/compare/v2.11.0...v2.11.1
[2.11.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.10.0...v2.11.0
[2.10.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.9.0...v2.10.0
[2.9.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.4.1...v2.5.0
[2.4.1]: https://github.com/chloepriceless/OpenBilanz/compare/v2.4.0...v2.4.1
[2.4.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/chloepriceless/OpenBilanz/releases/tag/v2.0.0
