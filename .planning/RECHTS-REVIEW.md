# OpenBilanz — Rechtliches Review (2026-06-10)

**Auftrag (Christin):** Buchungslogik, Gesetze, Bilanz — alles prüfen, ob es laut Gesetz umgesetzt
wurde; Online-Cross-Check gegen DATEV/andere Lösungen (nur Verifikation, kein Text-Copy).

**Methodik:** Code-Ist-Werte extrahiert → 2 Recherche-Agenten verifizieren gegen PRIMÄRQUELLEN
(gesetze-im-internet.de, amtlich; Abruf 2026-06-10) + Sekundär-Cross-Check (DATEV-Kontenrahmen via
Ecovis, sevDesk, Lexware, Haufe, ELSTER-Forum, BMF) → Claude-Recheck jedes Fundes gegen den echten
Code → Fix. Confidence: [VERIFIED] Primärquelle · [LIKELY] reputable Sekundärquelle. Findings in
Merkel (2 Einträge, verlinkt). Ergänzt den Code-Audit T-0161 (`OPENBILANZ-AUDIT.md`) um die
Rechts-Dimension.

**Ergebnis: 28 Einzelwerte geprüft — 1 echter Rechtsfehler gefunden + behoben (UStVA Kz 84/85),
1 Präzisierung umgesetzt (§ 264 Aufstellungsfrist nach Größenklasse), Rest VERIFIED ohne Abweichung.**

---

## Teil 1 — HGB / GmbHG / AO / Steuersätze (16/17 VERIFIED, 1 LIKELY, 0 Abweichungen)

| Rechtswert | Code-Ist | Gesetz-Soll | Verdict |
|---|---|---|---|
| § 267/267a HGB Schwellen NEU (GJ ab 2024, Wahlrecht 2023, Art. 93 EGHGB) | Kleinst 450k/900k/10 · Klein 7,5M/15M/50 · Mittel 25M/50M/250, 2-von-3 | identisch | [VERIFIED] |
| § 267 Alt-Schwellen (vor 2024) | 350k/700k · 6M/12M · 20M/40M | identisch | [VERIFIED] |
| § 5 Abs. 1 GmbHG Mindeststammkapital | 25.000 € | 25.000 € | [VERIFIED] |
| § 7 Abs. 2 GmbHG Mindesteinzahlung | 12.500 € | Hälfte von 25k | [VERIFIED] |
| § 23 Abs. 1 KStG | 15 % ≤2027, −1 pp/Jahr, 10 % ab 2032 | identisch | [VERIFIED] |
| SolzG | 5,5 % auf KSt | identisch | [VERIFIED] |
| § 11 Abs. 2 GewStG | Messzahl 3,5 %, kein Freibetrag KapG, Abrundung volle 100 € | identisch | [VERIFIED] |
| § 8 Nr. 1 GewStG Hinzurechnung | 25 % über 200k-Freibetrag (Zinsen 100/Mieten 20/50/Lizenzen 25 %) | identisch | [VERIFIED] |
| § 10d Abs. 2 EStG Mindestbesteuerung | Sockel 1 Mio, 70 % VZ 2024–2027, sonst 60 % | Sockel+70 % verified | [VERIFIED] / Befristungsende 2027 [LIKELY] |
| § 10a GewStG | durchgehend 60 % | identisch | [VERIFIED] |
| § 8b KStG | 95 % frei; Streubesitz KSt 10 % / GewSt 15 % (§ 9 Nr. 2a) | identisch | [VERIFIED] |
| § 9 Nr. 1 S. 1 GewStG i. d. F. JStG 2024 | Kürzung = gezahlte Grundsteuer (ab EZ 2025) | konsistent | [VERIFIED] |
| § 325 Abs. 1a HGB Offenlegung | 12 Monate, Unternehmensregister (DiRUG) | identisch | [VERIFIED] |
| § 264 Abs. 1 HGB Aufstellung | war: pauschal 6 Monate | 6 Mon. nur kleine (S. 4); 3 Mon. mittelgroße/große (S. 3) | ⚠ präzisiert → **Fix v2.14.1** |
| § 257 HGB / § 147 AO Aufbewahrung | Bücher 10 J / Belege 8 J (BEG IV, Art. 95 EGHGB) | identisch | [VERIFIED] |
| § 268 Abs. 3 HGB Fehlbetrag | Aktivseite, gesondert | identisch | [VERIFIED] |
| § 272 Abs. 1 HGB Nettomethode | offene Absetzung; eingefordert-offen → Forderung | identisch | [VERIFIED] |

## Teil 2 — UStG / UStVA / GoBD (1 FEHLER gefunden + behoben)

| Rechtswert | Code-Ist | Soll | Verdict |
|---|---|---|---|
| § 12 UStG Sätze + SKR04-Konten | 19/7 %; 4400/4300, 3806/3801, 1406/1401 | identisch (Cross-Check DATEV-SKR04 via Ecovis) | [VERIFIED] |
| § 19 UStG Kleinunternehmer | 25k Vorjahr/100k laufend, kein USt-Ausweis/VSt-Abzug, keine UStVA | identisch (Fassung 2025) | [VERIFIED] |
| UStVA Kz 81/86 | Nettoumsätze 19/7 % | identisch | [VERIFIED] |
| **UStVA Kz 84/85 (§ 13b)** | **war: „kz84" = STEUERBETRAG; Kz 85 fehlte** | **Kz 84 = Bemessungsgrundlage, Kz 85 = Steuer** | **❌ FEHLER → Fix v2.14.1** |
| **UStVA Kz 66/67** | **war: § 13b-Vorsteuer in Kz 66 einsummiert** | **Kz 66 = nur allg. Vorsteuer; Kz 67 = § 13b-Vorsteuer getrennt** | **⚠ → Fix v2.14.1** (Zahllast war ergebnisgleich korrekt) |
| UStVA Kz 83 Zahllast | Saldo USt + § 13b-Steuer − Vorsteuern | identisch | [VERIFIED] |
| § 16/§ 20 UStG | Soll-Versteuerung Default, Ist auf Antrag (≤800k) | identisch | [VERIFIED] |
| § 146 Abs. 4 AO / GoBD | Festschreibung unveränderlich, Korrektur NUR Storno, Hash-Prüfkette | konform (Cross-Check Lexware/BUHL-Marktpraxis) | [VERIFIED] |
| GoBD zeitgerechte Erfassung | nicht explizit kodiert (kein Fehler — Gesetz nennt keine Frist; Kasse täglich § 146 Abs. 1 AO) | — | [LIKELY/ok] |

## Behobene Funde (v2.14.1)

1. **UStVA § 13b Kennzahlen-Semantik (ustva.js, app.js):** Der Code führte den § 13b-STEUERBETRAG
   unter dem Namen „kz84" und summierte die § 13b-Vorsteuer in Kz 66 ein; Kz 85/67 fehlten. Die
   ZAHLLAST (Kz 83) war stets korrekt — aber wer die angezeigten Kennzahlen in ELSTER überträgt,
   hätte den Steuerbetrag ins Bemessungsgrundlagen-Feld eingetragen. **Fix:** kz84 = Bemessungs-
   grundlage (netto), NEU kz85 = Steuer, NEU kz67 = § 13b-Vorsteuer (getrennt), kz66 = nur
   allgemeine Vorsteuer; Zahllast-Formel äquivalent umgestellt (ergebnisgleich, testbelegt);
   UStVA-Anzeige zeigt jetzt Kz 84/85/66/67 amtlich korrekt. 3 Tests.
2. **§ 264 Abs. 1 HGB Aufstellungsfrist (fristen.js):** war pauschal 6 Monate — korrekt für
   kleine/Kleinst-KapG (Zielgruppe), aber mittelgroße/große haben 3 Monate (S. 3). **Fix:**
   Differenzierung nach `groessenklasse` (Default ohne Einstufung: 6 Monate), Paragraph-Angabe
   nennt den einschlägigen Satz. 1 Test.

## Nacharbeit 2026-06-10 (alle offenen Findings umgesetzt, v2.14.2)
- **§ 10d nachverifiziert (WebFetch Primärquelle):** Aktueller Normtext § 10d Abs. 2 EStG = **70 %
  [VERIFIED]**, ohne Befristung im Normtext; § 52 Abs. 18b: „erstmals VZ 2024" [VERIFIED]. Die
  60 %-Rückkehr ab VZ 2028 ist im Änderungsgesetz angelegt, im abrufbaren Normtext (noch) nicht
  sichtbar → bleibt [LIKELY]. Code für alle real anstehenden VZ korrekt; Kommentar in steuer.js
  dokumentiert den Verifikationsstand + Wiedervorlage bei VZ-2028-Abschlüssen.
- **2910-Haben-Asymmetrie (T-0161 NIEDRIG):** BuchungsPruefung warnt jetzt bei Haben-Buchung auf
  2910 (Konto führt Soll-Saldo; Haben nur bei Einforderung/Auflösung richtig). + Test.
- **baumSummen-Datenverlust (T-0161 NIEDRIG):** `pruefe()` meldet jetzt, wenn ein direkt erfasster
  Oberposten-Wert durch belegte Unterposten verdrängt wird (vorher stiller Verfall). + Test.
- **Sonderposten mit Rücklageanteil 2980 (T-0161 MITTEL-NIEDRIG):** Struktur bleibt (kein eigener
  § 266-Posten existiert; P.B.3 = dokumentierte Ausweis-Näherung), aber das Konten-Glossar erklärt
  jetzt die Rechtslage (BilMoG-Abschaffung, Altfall, StB-Abstimmung).
- **GoBD-10-Tage-Orientierung:** weiterhin bewusst nicht hart kodiert (keine gesetzliche Frist).

**Quellen:** gesetze-im-internet.de (§§ 267/267a/264/257/268/272/325 HGB, Art. 93/95 EGHGB,
§§ 5/7 GmbHG, §§ 23/8b KStG, §§ 8/9/10a/11 GewStG, §§ 10d/52 EStG, §§ 12/16/19/20 UStG,
§§ 146/147 AO) · Cross-Checks: Ecovis-SKR04, sevDesk-UStVA-Kennzahlen, Lexware-GoBD, BUHL,
Haufe, ELSTER-Forum, BMF-Vordruck. Alle Abrufe 2026-06-10. Merkel: 2 Einträge
(rechts-verifikation-hgb-gmbhg… + rechts-verifikation-ustg-ustva-gobd…).
