# HANDOVER — OpenBilanz (Pfenni / gmbh-verwaltung)

_Letzte Aktualisierung: 2026-06-26 ~12:30 (Session Welle-2-Dimensionen, vor Self-Recycle)._

## Aufgabe & Ziel
Stehender Christin-Auftrag (via Hub): OpenBilanz autonom weiterentwickeln —
Korrektheit sichern, Features, Rechts-Recherche → Merkel, atomic commits.
Grenze: KEINE echten Buchungen/Geldbewegungen/Firmen-Mail ohne Codex-4-Augen +
Christin-Final-OK. Diese Session: **Audit-Welle 2** weitgehend abgeschlossen.

## Stand (Branch `feat/skr04-glossar-vollabdeckung`, in-sync mit origin, 321 Tests grün UTC/Berlin/LA)
Diese Session 7 Commits, alle gepusht, je test-verifiziert:
- `82af688` LOW #6 — ZUGFeRD-PDF zeigt §14-Klartext statt Roh-Steuerschalter (DRY aus STEUERLOGIK).
- `ded59cd` LOW #5 + MEDIUM #3 — Verkäufer-StNr (BT-32) in UBL+CII (§14-Verlust behoben); MEDIUM #3
  Zeilensumme als False Positive verifiziert. Adversarisch reviewt (MERGEABLE 4/4 [VERIFIED], KoSIT BR-DE-16).
- `1273135` CHANGELOG Verkäufer-StNr.
- `54a7c03` DATEV-Datum-Fallback-Fix (verstümmeltes TTMM bei Buchung ohne Datum).
- `2c6ec02` Handover-Zwischenstand.
- `92fe759` FX-Härtung (§ 256a HGB: kein Stichtagskurs → keine Null-Abwertung) + Doku.

## Welle-2-Fortschritt
- ✅ E-Rechnung (LOW #5/#6, MEDIUM #3) — durch.
- ✅ DATEV/GoBD-Export — durch (DATEV-Datum-Bug gefixt, GDPdU sauber, S/H-Hardcode als nicht-auslösbar verifiziert).
- ✅ FX/Rundung — durch (fx.js-Logik §256a verifiziert korrekt, kurs-fehlt-Härtung; ABER fx.js noch NICHT
  in UI integriert = Feature-Gap, kein Bug — für Christin/Roadmap notiert).
- ⏸ **Mandanten-Datenintegrität (store-idb-Migration v1→v2)** — LETZTE offene Dimension, NICHT auditiert.
  Datenverlust-Risiko beim Upgrade. Migrationstest existiert (tests/run.js ~2693), Datenerhalt-Vollabdeckung
  offen. KOMPLEX (Browser-IndexedDB / fake-indexeddb headless) — für frische Session mit vollem Kontext.

## GATED auf Christin (im Hub-Ledger als awaiting_operator)
- **v2.22.0 Release-Zeremonie** Go/No-Go (Branch fertig, FF-fähig, 32 Commits vor main).
  Stamp-Konvention: Parent beibehalten (`npm run stamp` nach FF-Merge, KEIN force-push). Vor dem Lauf Codex-vetten.
- **#13 LICENSE** korrekter Copyright-Inhaber der GmbH?
- **Findings-Datei** `.planning/RELEASE-REVIEW-2026-06-14-FINDINGS.md` (untracked) committen ja/nein?

## Resume-Anleitung
Repo `/home/dev/GmbH-Verwaltung`, Branch `feat/skr04-glossar-vollabdeckung`.
Tests: `node tests/run.js` (321 grün) — auch `TZ=Europe/Berlin` / `TZ=America/Los_Angeles`.
**Nächster autonomer Schritt:** Mandanten-IDB-Migration-Audit (v1→v2 Datenerhalt) — store-idb-Logik +
tests/run.js ~2693 prüfen, Datenerhalt-Assertions ergänzen. Danach autonomous_open==0.
Release-Zeremonie NUR auf Christin-Go. Durable Details: Memory `project-open-tasks.md`.
Melde-Weg Christin: Orchestrator-Peer (CWD /home/dev/orchestrator). Hub localhost:7890.
Merkel: POST http://192.168.20.81:8000/ingest.
