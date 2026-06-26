# HANDOVER — OpenBilanz (Pfenni / gmbh-verwaltung)

_Letzte Aktualisierung: 2026-06-26 ~12:30 (Session Welle-2-Dimensionen, vor Self-Recycle)._

## Aufgabe & Ziel
Stehender Christin-Auftrag (via Hub): OpenBilanz autonom weiterentwickeln —
Korrektheit sichern, Features, Rechts-Recherche → Merkel, atomic commits.
Grenze: KEINE echten Buchungen/Geldbewegungen/Firmen-Mail ohne Codex-4-Augen +
Christin-Final-OK. Diese Session: **Audit-Welle 2** weitgehend abgeschlossen.

## Stand (Branch `feat/skr04-glossar-vollabdeckung`, in-sync mit origin, 327 Tests grün UTC/Berlin/LA)
Welle-2 KOMPLETT durch; autonomous_open=0 (nur noch Christin-gatete Punkte offen, s.u.).
- `508be7e` (2026-06-26) Mandanten-IDB-Migration v1→v2 Datenerhalt: Audit + 6 neue Tests (3→9), refute-reviewt.
Vorherige Session 7 Commits, alle gepusht, je test-verifiziert:
- `82af688` LOW #6 — ZUGFeRD-PDF zeigt §14-Klartext statt Roh-Steuerschalter (DRY aus STEUERLOGIK).
- `ded59cd` LOW #5 + MEDIUM #3 — Verkäufer-StNr (BT-32) in UBL+CII (§14-Verlust behoben); MEDIUM #3
  Zeilensumme als False Positive verifiziert. Adversarisch reviewt (MERGEABLE 4/4 [VERIFIED], KoSIT BR-DE-16).
- `1273135` CHANGELOG Verkäufer-StNr.
- `54a7c03` DATEV-Datum-Fallback-Fix (verstümmeltes TTMM bei Buchung ohne Datum).
- `2c6ec02` Handover-Zwischenstand.
- `92fe759` FX-Härtung (§ 256a HGB: kein Stichtagskurs → keine Null-Abwertung) + Doku.

## Welle-2-Fortschritt — ✅ KOMPLETT DURCH (alle Dimensionen erledigt)
- ✅ E-Rechnung (LOW #5/#6, MEDIUM #3) — durch.
- ✅ DATEV/GoBD-Export — durch (DATEV-Datum-Bug gefixt, GDPdU sauber, S/H-Hardcode als nicht-auslösbar verifiziert).
- ✅ FX/Rundung — durch (fx.js-Logik §256a verifiziert korrekt, kurs-fehlt-Härtung; ABER fx.js noch NICHT
  in UI integriert = Feature-Gap, kein Bug — für Christin/Roadmap notiert).
- ✅ **Mandanten-Datenintegrität (store-idb-Migration v1→v2)** — durch (Commit 508be7e, 327 grün UTC/Berlin/LA).
  Logik auditiert (kein Bug), refute-reviewt; 6 neue Datenerhalt-Tests (3→9). Fremd-mandantId-Divergenz
  via v1-Import erreichbar aber wiederherstellbar → kein Fix (R12), Regressions-Pin gesetzt.
  Audit-Doc: .planning/IDB-MIGRATION-AUDIT-2026-06-26.md.

## GATED auf Christin (im Hub-Ledger als awaiting_operator)
- **v2.22.0 Release-Zeremonie** Go/No-Go (Branch fertig, FF-fähig, 32 Commits vor main).
  Stamp-Konvention: Parent beibehalten (`npm run stamp` nach FF-Merge, KEIN force-push). Vor dem Lauf Codex-vetten.
- **#13 LICENSE** korrekter Copyright-Inhaber der GmbH?
- **Findings-Datei** `.planning/RELEASE-REVIEW-2026-06-14-FINDINGS.md` (untracked) committen ja/nein?

## Resume-Anleitung
Repo `/home/dev/GmbH-Verwaltung`, Branch `feat/skr04-glossar-vollabdeckung`.
Tests: `node tests/run.js` (321 grün) — auch `TZ=Europe/Berlin` / `TZ=America/Los_Angeles`.
**Autonomer Backlog LEER (autonomous_open=0).** Welle-2 vollständig durch. Offen nur Christin-gatete Punkte
(s.o. „GATED auf Christin"): v2.22.0-Release-Zeremonie Go/No-Go · #13 LICENSE-Copyright · Findings-Datei
committen ja/nein. Release-Zeremonie NUR auf Christin-Go (vor dem Lauf Codex-vetten, R22 prozesskritisch).
Bei freiem Kontext + Christin-Go fehlt: nächste sinnvolle Weiterentwicklung (Feature/Rechts-Recherche) NEU
aufsetzen — aber NICHT den gateten Release-Branch weiter aufblähen, bevor v2.22.0 raus ist.
Durable Details: Memory `project-open-tasks.md`.
Melde-Weg Christin: Orchestrator-Peer (CWD /home/dev/orchestrator). Hub localhost:7890.
Merkel: POST http://192.168.20.81:8000/ingest.
