# Design: Vollständiger SKR04-Kontenrahmen buchbar (T1, v2.8.0)

**Auftrag (Christin, 2026-06-08, Brake-Ausnahme):** Es sollen ALLE Standard-SKR04-Konten
wähl-/buchbar sein. Konkreter Auslöser: Konto **6420 (Beiträge)** fehlte und war nicht buchbar.

## Problem / Wurzel
`public/shared/skr04.js` führt nur eine **kuratierte Teilmenge** (~91 Konten). Folgen:
- Das Buchungs-Dropdown (`app.js` kontoOpt) zeigt nur `alleKonten()` → fehlende Konten sind
  gar nicht wählbar.
- `uebernehmeSalden` (`app.js`): `var k = SKR04.kontoFinden(nr); if (!k) return;` — ein Konto
  ohne Eintrag (oder ohne `pos`/`kat`) **verpufft** (Saldo landet nirgends → Bilanz unausgeglichen).
  Das ist Christins „verpufft"-Effekt.

Der „1460-Bug" war kein Bug: 1460 IST gelistet+buchbar. Die echte Wurzel ist die Teilmengen-Lücke.

## Ziel / Korrektheits-Invariante
Jedes gültige SKR04-Sachkonto ist wählbar UND bekommt eine **gültige `seite` + `pos` (Bilanz) bzw.
`kat` (GuV)**, sodass der Saldo in Bilanz/GuV landet und die Bilanz ausgeglichen bleibt. Die exakte
Unterposition ist sekundär (im Tool nach Übertrag frei änderbar); kritisch ist: kein Verpuffen,
richtige Seite (AKTIV/PASSIV bzw. ERTRAG/AUFWAND).

## Optionen (Deliberate)
- **A) ~1500 Konten manuell mit pos/kat pflegen** — VERWORFEN: riesig, fehleranfällig, Pflege-Last,
  verstößt gegen R32 (≥20 gleichartige Items → deterministische Software statt Handarbeit).
- **B) Reines Nummernkreis-Mapping** — SCHWACH bei Bilanz-Sonderfällen: z.B. 1460 Geldtransit (B.IV)
  liegt numerisch zwischen B.II und B.III → lineare Grenzen klassifizieren es falsch.
- **C) GEWÄHLT — Hybrid aus verifizierter Drittquelle + Ground-Truth-Vorrang:**
  - **Bilanz (Klassen 0–3):** HGB-Position direkt aus dem **Baumpfad** der ERPNext-SKR04-Quelle
    ableiten (`de_kontenplan_SKR04.json`, hierarchisch nach HGB gegliedert). Verifiziert, nicht geraten.
  - **GuV (Klassen 4–7):** ERPNext gliedert die GuV nach **UKV-Funktion** (Herstellungs-/Verwaltungs-
    kosten), die App nach **Aufwandsart** (`material/personal/...`) → Pfad NICHT nutzbar. Stattdessen
    **Nummernkreis-Mapping** `nrZuKat(nr)`, konservativ (im Zweifel Sammelposition `sonstaufwand`/
    `sonstertrag` — die sind immer sachlich korrekt „sonstige").
  - **Ground-Truth-Vorrang:** Die bestehenden ~91 kuratierten App-Konten bleiben UNVERÄNDERT und
    gewinnen bei Konflikt (inkl. `vv`/`eb`-Flags + sachlich genauere Sonderfälle wie 1460).

## Datenquelle + Lizenz
- **Quelle:** ERPNext „SKR04 mit Kontonummern" (`frappe/erpnext`, verified charts),
  `de_kontenplan_SKR04.json`. 1025 echte 4-stellige Buchungskonten.
- **Lizenz:** ERPNext ist GPLv3. Übernommen werden NUR **faktische Daten** (Kontonummer, amtliche
  Kurzbezeichnung, HGB-Zuordnung) — Fakten sind nicht urheberrechtlich geschützt. Die GPL-Quelldatei
  wird NICHT ins Repo committet (`.gitignore`); der Generator dokumentiert die Download-URL. Output =
  eigene faktische Datenstruktur mit Quellenattribution. (Präzedenz: skr04.js nutzt bereits
  laroche/trading-gmbh CC0 + alyf-de/SKR04-Abgleich.) → in DRITTQUELLEN.md nachtragen.

## Validierung (gemessen, gegen App-Ground-Truth)
- **Bilanz:** 67/73 exakt deckungsgleich; 2 Konten fehlen in ERPNext (App gewinnt); 4 Diskrepanzen —
  bei 1460/3070 ist die **App sachlich genauer** (ERPNext-Einordnungsfehler, z.B. 1180 fälschlich A.I).
  → bestätigt App-Vorrang.
- **GuV:** 48/48 exakt (kat + Seite) — 100% Reproduktion des kuratierten Ground-Truth.

## Filter (nur echte Sachkonten)
Ausgefiltert: 5-stellige Personenkonten (Debitoren/Kreditoren 10000/70000ff), `is_group`-Sammelknoten,
Knoten mit Kindern, Klasse 9 (statistische/Vortragskonten — App hat eigenes EBK 9000).

## Bekannte Limitation (transparent)
Feine Fehlordnung innerhalb derselben Seite ist bei nicht-kuratierten Zusatzkonten möglich (z.B.
Erlösschmälerung als `umsatz` statt eigener Position) — Betrag bleibt in korrekter Seite, korrigierbar
im Journal. Invariante „richtige Seite + kein Verpuffen" ist garantiert + getestet.

## Umsetzung (atomare Schritte)
1. `tools/gen-skr04-voll.js` (Generator) + `public/shared/skr04-voll.js` (generierte Zusatzkonten) +
   Design-Doc. Diskrepanz-Report.
2. Integration in `skr04.js`: `alleKonten()` = KONTEN (kuratiert, Vorrang) + ZUSATZ_KONTEN + eigene;
   `kontoFinden` durchsucht alle. Bestehende KONTEN unverändert.
3. UI: durchsuchbare Konto-Auswahl (native `<datalist>`) in der Buchungsmaske statt 1000er-`<select>`.
4. Tests: Ground-Truth-Regression (Generator-Mapping reproduziert KONTEN), Vollständigkeit (6420 da +
   korrekt), Bilanz-Ausgleich-Stichprobe, jede Zusatzkonto-Seite/kat/pos gültig. Bestehende Tests grün.
5. Codex/Refute-Sparring auf Design + generierte Liste VOR Integration/Deploy (R22 Datenmodell-kritisch).
6. Deploy v2.8.0 (feat) + öffentliche Verifikation.

## Risiken
- ERPNext-Einzelfehler bei Zusatzkonten → gemildert durch App-Vorrang + konservatives GuV-Mapping +
  Korrigierbarkeit im Tool. Getestet: jede Seite/kat/pos ist gültig (kein Verpuffen).
- UI-Last bei ~1000 Optionen → `<datalist>` (nativ, durchsuchbar) statt `<select>`.
