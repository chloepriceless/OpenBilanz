# HANDOVER — OpenBilanz (Pfenni / gmbh-verwaltung)

_Letzte Aktualisierung: 2026-06-26 ~12:00 (Session Welle-2-Dimensionen)._

## Aufgabe & Ziel
Stehender Christin-Auftrag (via Hub): OpenBilanz autonom weiterentwickeln —
Korrektheit sichern, Features, Rechts-Recherche → Merkel, atomic commits.
Grenze: KEINE echten Buchungen/Geldbewegungen/Firmen-Mail ohne Codex-4-Augen +
Christin-Final-OK. Diese Session: **Audit-Welle 2** abgearbeitet (E-Rechnungs-Reste
+ DATEV/GoBD-Dimension).

## Stand (Branch `feat/skr04-glossar-vollabdeckung`, in-sync mit origin, 320 Tests grün)
Diese Session 4 atomare Commits, alle gepusht, je test-verifiziert (UTC/Berlin/LA):
- `82af688` LOW #6 — ZUGFeRD-PDF zeigt §14-Klartext statt Roh-Steuerschalter (DRY aus STEUERLOGIK).
- `ded59cd` LOW #5 + MEDIUM #3 — Verkäufer-StNr (BT-32) in UBL+CII (§14-Verlust behoben); MEDIUM #3
  Zeilensumme als False Positive verifiziert + Kommentar. Adversarisch refute-reviewt (general-purpose,
  MERGEABLE 4/4 [VERIFIED] gegen KoSIT-Schematron BR-DE-16).
- `1273135` CHANGELOG Verkäufer-StNr.
- `54a7c03` DATEV-Datum-Fallback-Fix (verstümmeltes TTMM bei Buchung ohne Datum) + GDPdU sauber befunden.

## Welle-2-Fortschritt
- ✅ E-Rechnung (LOW #5/#6, MEDIUM #3) — komplett durch.
- ✅ DATEV/GoBD-Export — auditiert: 1 Bug gefixt (DATEV-Datum), GDPdU sauber, S/H-Hardcode als
  nicht-auslösbar verifiziert.
- ⏸ **FX/Rundung** — NOCH OFFEN (Fremdwährung/IBKR-USD). Nicht auditiert.
- ⏸ **Mandanten-Datenintegrität** (store-idb-Migration v1→v2) — NOCH OFFEN. Hat Migrationstest
  (tests/run.js ~2693), aber Datenerhalt-Vollabdeckung offen.

## GATED auf Christin (im Hub-Ledger als awaiting_operator)
- **v2.22.0 Release-Zeremonie** Go/No-Go (Branch fertig, FF-fähig, jetzt 30 Commits vor main).
  Stamp-Konvention entschieden: Parent beibehalten (`npm run stamp` nach FF-Merge, KEIN force-push).
- **#13 LICENSE** korrekter Copyright-Inhaber der GmbH?
- **Findings-Datei** `.planning/RELEASE-REVIEW-2026-06-14-FINDINGS.md` (untracked) committen ja/nein?

## Resume-Anleitung
Repo `/home/dev/GmbH-Verwaltung`, Branch `feat/skr04-glossar-vollabdeckung`.
Tests: `node tests/run.js` (320 grün) — auch `TZ=Europe/Berlin`/`TZ=America/Los_Angeles`.
Nächste autonome Schritte (sinnvolle Reihenfolge): (1) FX/Rundung-Audit, (2) Mandanten-IDB-Migration-Audit.
Release-Zeremonie NUR auf Christin-Go. Durable Details: Memory `project-open-tasks.md`.
Melde-Weg Christin: Orchestrator-Peer (CWD /home/dev/orchestrator). Hub localhost:7890.
Merkel: POST http://192.168.20.81:8000/ingest.
