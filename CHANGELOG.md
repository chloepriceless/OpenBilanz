# Changelog

Alle nennenswerten Änderungen an OpenBilanz werden hier dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

Die hier genannte Version wird über `npm run stamp` in `public/shared/version.js`
gestempelt und in jeden Export (XBRL, DATEV, Journal) geschrieben — so bleibt
nachvollziehbar, welcher Programmstand einen Abschluss erzeugt hat.

## [Unreleased]

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

[Unreleased]: https://github.com/chloepriceless/OpenBilanz/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/chloepriceless/OpenBilanz/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/chloepriceless/OpenBilanz/releases/tag/v2.0.0
