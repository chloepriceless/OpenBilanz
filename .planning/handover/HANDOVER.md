# HANDOVER — OpenBilanz (Pfenni / gmbh-verwaltung)

_Letzte Aktualisierung: 2026-10-25 ~22:45 (Mac, Session „mach weiter von der Übergabe“)._

## Aufgabe & Ziel
GitHub-Issues #1–#4 von OpenBilanz (github.com/chloepriceless/OpenBilanz) abarbeiten, inkl. Abgleich
der Gegenprüfungen. Grenze: KEINE echten Buchungen/Geldbewegungen/Firmen-Mail ohne 4-Augen + Christin-OK.
Push, Issues schließen, Merge nach main und Release nur auf Christin-Go.

## Stand — Branch `fix/github-issues-1-4` (lokal, NICHT gepusht), 329 Tests grün (UTC/Berlin/LA)
Basis: `feat/skr04-glossar-vollabdeckung` (1964015, = origin) → darauf:
- `5d30935` #2 #3 #4: GuV vollständig in XBRL, GCD-Härtefall-Feldname, Liberation-Download (Vorsession).
- `31fbcef` GJ-Beginn-Plausi las `a.geschaeftsjahrVon` statt `a.gjVon` (Warnung kam nie).
- `ec424cd` **#1 offene Buchungen im Journal bearbeiten** — `BuchungsPruefung.bearbeite()`
  (public/shared/buchungspruefung.js), Inline-Zeile + Handler in public/app.js (`BuEditId`, `bue*`-IDs),
  Änderungsprotokoll mit Alt→Neu, SW-Cache v8. E2E per Playwright verifiziert.
- `de8ba41` geführte Umbuchung zeigt Plausi-Hinweise jetzt per confirm (verwarf sie vorher).
- `e3bd0c0` E-Bilanz: Bilanz-Unterposten neben römischem Wert als NIL (Arelle calcInconsistency),
  offene Einlagen B.II als `receiv.other.unpaidCapital`, NIL ohne decimals. Arelle: 5 Bilanz- + 4 GuV-Fälle sauber.
- `2cb85fd` setup-pdf-lib.sh: Lizenzdatei in Vorhanden-Prüfung.
- `ee43da8` Storno einer Eröffnungsbuchung ohne 9000-Hinweis bearbeitbar.
- `ac8e403` setup-pdf-lib.sh: nur fehlende Lizenz → nur LICENSE nachladen, offline Warnung statt Abbruch.

## Gegenprüfung
Codex im Nutzungslimit bis 26.10. 02:30 → Hook (`.git/codex-reviews/<sha>.md`) prüfte per Claude.
Abgearbeitet: 5d30935 (2 bestätigt+gefixt, 1 widerlegt per Calc-Linkbase), 31fbcef (gefixt in de8ba41),
ec424cd (P3 9000 gefixt; P3 „E2E nicht im Repo“ bewusst offen: Repo ist zero-dependency, kein UI-Test-Setup).
2cb85fd: P3 Offline-Abbruch → gefixt in ac8e403. ee43da8: ohne Befund.
e3bd0c0: P3 wirkungslose Testzusicherung → gefixt in nächstem Commit; ungeprüfte Punkte nachgeholt
(B.II.4 + offene Einlagen, Kleinst/microbilg-Shell: Arelle ohne Befund). **Offen/ungeprüft:** ob ERiC
NIL-Unterposten in seiner Rechenprüfung wie XBRL 2.1 auslässt — nur mit ERiC testbar.
Optional nach 02:30: echte Codex-Läufe nachholen (`codex review --base feat/skr04-glossar-vollabdeckung`).

## Werkzeuge (Mac)
- Arelle-venv + entpackte Taxonomie 6.9 aus Vorsession:
  `/private/tmp/claude-501/-Users-christin-Projects-GmbH-Verwaltung/5217922b-61d3-4e72-a67b-b0c9ecbfdfd0/scratchpad/`
  (`arelle-venv/`, `tax/`, `gen/check.sh <scratch> <dir>`). /private/tmp — kann verschwinden.
- Playwright: `require('/Users/christin/Projects/mispel-demo/node_modules/playwright')`;
  App lokal: `python3 -m http.server 8765 --bind 127.0.0.1 --directory public`;
  Onboarding vorher per `markiereOnboardingGesehen(); dialogZu();` wegklicken.
- Merkel-Eintrag: „OpenBilanz 25.10.2026: Buchung bearbeiten (#1) + E-Bilanz-Calc-Regeln“.

## Offen / GATED auf Christin
- Push von `fix/github-issues-1-4`, Issues #1–#4 kommentieren/schließen.
- Weiter offen aus Juni: v2.22.0-Release-Zeremonie (Basis-Branch 32+ Commits vor main) · #13 LICENSE-Copyright ·
  `.planning/RELEASE-REVIEW-2026-06-14-FINDINGS.md` (untracked) committen ja/nein.
- Feature-Gap (kein Bug): fx.js nicht in UI integriert.

## Resume
```
cd ~/Projects/GmbH-Verwaltung && git switch fix/github-issues-1-4 && npm test
ls -t .git/codex-reviews/ | head     # offene Review-Dateien lesen
```
