# HANDOVER — OpenBilanz (Pfenni / gmbh-verwaltung)

_Letzte Aktualisierung: 2026-06-20 ~21:00 (vor Flotten-Pause; Auto-Neustart ~03:15 MESZ)._

## Aufgabe & Ziel
Stehender Christin-Auftrag (via Hub): OpenBilanz autonom weiterentwickeln — Korrektheit
sichern, Features, Rechts-Recherche → Merkel. Diese Session: **Multi-Agent-Korrektheits-Audit**
des Steuer-/Bilanz-Kerns (Flotten-Aktivierung, Quality-First, Workflow-Fan-out).

## Stand (was ist erledigt, was offen)
- **Audit-Welle 1 ✅ ABGESCHLOSSEN:** 6 Dimensionen parallel + adversarisch verifiziert →
  4 echte Bugs (0 False-Positives), alle gefixt, je atomarer Commit + Test. Findings in Merkel,
  Tätigkeitsbericht gesendet.
- **H2 ✅ GEFIXT (Session 2026-06-21, Commit 207eb7e, gepusht):** doppelte Rechnungsnummern bei
  Jahres-Rücksprung. Datenmodell Pro-Jahr-Zähler, self-migrating, adversarisch refute-reviewt
  (Datenverlust-Befund 1:1 behoben). **307 Tests grün** (UTC/Berlin/LA). Branch in-sync mit origin.
- **Audit-Welle 2 ⏸ TEILWEISE (maßvoll, kein Fan-out):** Dimension **E-Rechnung** auditiert →
  2 verifizierte Fixes (Commit f076e8f): CII-XSD-Reihenfolge (BillingSpecifiedPeriod vor PaymentTerms)
  + IBAN-als-Zahl-Crash. 1 False Positive abgewehrt (ExemptionReason-Reihenfolge war korrekt). Offen:
  E-Rechnungs-Reste (MEDIUM Rundung, LOW StNr/PDF-Klartext) + Dimensionen DATEV/FX/Mandanten-Integrität.
  Voller Workflow-Fan-out bräuchte Opt-in. Details in Memory project-open-tasks.md (Abschnitt Welle 2).

## Erledigte Fixes Welle 1 (alle gepusht, mit Datei:Zeile)
1. `d4795ad` **taxonomie.js:118** (high) — `ukv.1` XBRL-Element `grossTradingProfit`→`grossOpProfit`.
   COGS-Zweig hat kein grossTradingProfit (nur GKV/operatingTC) → UKV-E-Bilanz wurde von
   ERiC/Arelle abgelehnt. Gegen amtliche XSD (de-gaap-ci 6.9) verifiziert.
2. `4fec497` **ausgangsrechnung.js:40/127** (high) — steuerfreie/innergem. Erlöse von Konto 4180
   (§24 Durchschnittssätze!) getrennt auf 4125 (innergem. §4 Nr.1b) / 4150 (§4 Nr.2-7).
3. `a11d29e` **steuer.js:191** (medium) — Soli auf festgesetzte KSt NACH §26-Anrechnung
   (war auf Brutto-KSt). §3 Abs.1 Nr.1 SolzG. Reihenfolge KSt→Anrechnung→Soli.
4. `da4e7bf` **importe.js:95** (low) — IBKR "Broker Interest Paid" (amount<0) → 7300 statt 7100.
5. `c713620` CHANGELOG [Unreleased] dokumentiert.

## Offene Punkte / Blocker (für nächste Session)
### 🔴 H2 — Doppelte Rechnungsnummern bei Jahres-Rücksprung (high, REPRODUZIERT)
`ausgangsrechnung.js` `vergebeNummer`/`naechsteNummer` halten nur EINEN Zähler `{jahr, naechste}`.
Bei Rückdatierung ins Vorjahr + Rücksprung → Reset auf 1 → DOPPELNUMMER. Reproduziert:
`[2026-01,2026-02,2025-12,2026-03,2026-04]` → `RE-2026-0001/0002` DOPPELT. Verletzt §14 Abs.4 Nr.4
UStG (Einmaligkeit) + GoBD. **Fix = Datenmodell-Änderung (Zähler PRO JAHR, rückwärtskompatibel
self-migrating)** → R22-kritisch, **adversarisches Review vor Merge** nötig.
### ⏸ Welle 2 neu fahren
Script liegt (gestoppt): `.../workflows/scripts/openbilanz-korrektheits-audit-welle2-wf_edd32ce4-d32.js`.
Dimensionen: E-Rechnung (xrechnung-ubl/cii, EN 16931), DATEV/GDPdU+GoBD, Belegnummern,
Mandanten-Datenintegrität (store-idb/migration), FX/Rundung, USt-VA-Kennzahlen-Tiefe.
Neu starten via `Workflow({scriptPath: "<obiger Pfad>"})` (frischer Run, kein Resume).
### ✅ Folgepunkt aus Fix #B: UStVA-Kz-41 — ERLEDIGT (Commit f329714, gepusht)
Bugfix kz44→kz43 (amtlich Kz 43 für „steuerfrei mit Vorsteuer") + Feature Kz 41 (4125, ZM-Hinweis) /
Kz 43 (4150). Kleinunternehmer-Sonderfall behoben. 311 Tests grün. Amtlich verifiziert → Merkel.

## GATED auf Christin (im Hub-Ledger als awaiting_operator)
- **v2.22.0 Release-Zeremonie** Go/No-Go (Branch fertig, 302 grün, FF-fähig, 20 Commits vor main).
  Stamp-Konvention entschieden: **Parent-Konvention beibehalten** (Self-Reference; `npm run stamp`
  nach FF-Merge überschreibt version.js konventionskonform; KEIN force-push).
- **#13 LICENSE** korrekter Copyright-Inhaber der GmbH?
- **Findings-Datei** `.planning/RELEASE-REVIEW-2026-06-14-FINDINGS.md` (untracked) committen ja/nein?

## Resume-Anleitung
Repo `/home/dev/GmbH-Verwaltung`, Branch `feat/skr04-glossar-vollabdeckung`.
Tests: `node tests/run.js` (302 grün). Beim Neustart **SPARSAM** anlaufen (Orchestrator-Direktive:
Tiering/niedriger Effort, nicht sofort Vollgas). Reihenfolge: (1) H2-Fix mit Review, (2) Welle 2,
(3) UStVA-Kz-41. Release-Zeremonie NUR auf Christin-Go. Durable Details: Memory
`project-open-tasks.md`. Melde-Weg Christin: Orchestrator-Peer (CWD /home/dev/orchestrator).
