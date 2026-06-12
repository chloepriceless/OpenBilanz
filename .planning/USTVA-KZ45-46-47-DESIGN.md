# Design: UStVA-Karte — § 13b- und Auslands-Kennzahlen (Kz 45/46/47/67)

Backlog-Item (BACKLOG.md): Die UStVA berechnet bisher nur Kz 81/86/66/83 aus
3806/3801/1406/1401 (+ manuelle Sonderfälle Kz 84/85/44/48). Wer Reverse-Charge-
Eingangsleistungen sauber BUCHT (1407/3837) oder Auslandsumsätze auf 4338 erzielt,
muss Kz 46/47/67 und Kz 45 manuell in ELSTER ergänzen. Das soll automatisch gehen.

## Verifizierte Grundlagen (2026-06-12)

- **Kz 46/47** = bezogene sonstige Leistungen nach § 3a Abs. 2 UStG eines im
  übrigen GEMEINSCHAFTSGEBIET ansässigen Unternehmers (§ 13b Abs. 1 UStG);
  Kz 46 = Bemessungsgrundlage (netto), Kz 47 = Steuer. [VERIFIED: sevdesk-Doku +
  2. Quelle (BuchhaltungsButler/Haufe-Treffer), deckungsgleich]
- **Kz 84/85** = ANDERE § 13b-Leistungen (§ 13b Abs. 2: Bauleistungen,
  Drittlands-Leistende etc.). Bereits korrekt als manuelle Option umgesetzt
  (Rechts-Review v2.14.1).
- **Kz 67** = Vorsteuer aus § 13b-Leistungen (getrennt von Kz 66). [VERIFIED v2.14.1]
- **Kz 45** = übrige nicht steuerbare Umsätze (Leistungsort nicht im Inland);
  NICHT die EU-B2B-Leistungen nach § 3a Abs. 2 — die gehören in **Kz 21** (+ ZM,
  § 18b UStG). [VERIFIED: ELSTER-Hilfe/sevdesk]
- **Kleinunternehmer:** § 19 Abs. 1 Satz (neugefasst 2025) lässt **§ 18 Abs. 4a**
  unberührt; § 18 Abs. 4a nennt **§ 13b Abs. 5-Schuldner ausdrücklich** →
  Voranmeldung ist insoweit abzugeben, § 13b-Steuer wird geschuldet, KEIN
  Vorsteuerabzug (steuerfreie Ausgangsumsätze → § 15 Abs. 2).
  [VERIFIED: gesetze-im-internet.de §§ 18, 19 UStG, abgerufen 2026-06-12]

## Konten (alle in skr04-voll.js vorhanden, verifiziert)

| Konto | Name | Ziel-Kz |
|---|---|---|
| 3837 | Umsatzsteuer nach § 13b UStG 19 % (PASSIV) | **Kz 47** (Steuer), Kz 46 = 47/0,19 (BMG rückgerechnet) |
| 1407 | Abziehbare Vorsteuer nach § 13b UStG 19 % (AKTIV) | **Kz 67** (zusätzlich zu kz85 aus manueller Option) |
| 4338 | Erlöse aus im Drittland steuerbaren Leistungen, im Inland nicht steuerbar | **Kz 45** |
| 3835/1408 | generische § 13b-Konten ohne Steuersatz | NICHT automatisch (Zeile unklar) → Warn-Hinweis bei Bebuchung |
| 4336/4339 | EU-steuerbare sonstige Leistungen/Erlöse | NICHT Kz 45 → Hinweis auf Kz 21 + ZM bei Bebuchung |

## Entscheidungen

1. **Kz 47 = Haben-Saldo 3837 im Zeitraum; Kz 46 = cent(Kz47 / 0,19).**
   - Verworfen: BMG aus den Aufwandsbuchungen ermitteln — die § 13b-Aufwände
     laufen über generische Aufwandskonten, nicht identifizierbar.
   - Trade-off: Rückrechnung kann um Cents von der echten BMG abweichen
     (Rundung der Einzelbuchungen). Üblich in Buchhaltungstools, akzeptiert.
   - Zuordnung zu Kz 46/47 (EU-Fall) statt 84/85: der typische 3837-Anwendungsfall
     (Auslands-SaaS: Adobe/Google/Meta/Stripe fakturieren aus Irland) ist § 13b
     Abs. 1. Drittlands-/Bauleistungs-Fälle laufen weiterhin über die manuelle
     Option (Kz 84/85) — Hinweis in der Karte stellt das klar.
2. **Kz 67 = kz85 (manuelle Option) + Soll-Saldo 1407.** Zahllast:
   `kz83 = ustBerechnet + kz85 + kz47 − kz66 − kz67`. Bei voller
   Abzugsberechtigung netten 3837/1407 auf 0 — korrekt.
3. **Kz 45 = Haben-Saldo 4338.** Rein nachrichtlich, keine Zahllast-Wirkung.
4. **Kleinunternehmer-Zweig wird KORRIGIERT:** bisher kz66=kz67=kz83=0 pauschal.
   Neu: kz47/kz46/kz45 werden auch im Klein-Fall ermittelt; kz67 bleibt 0
   (kein VSt-Abzug); **kz83 = kz85 + kz47** (geschuldete § 13b-Steuer!);
   Hinweis erklärt § 18 Abs. 4a (Voranmeldung insoweit Pflicht) und dass die
   auf 1407 gebuchte Vorsteuer NICHT abziehbar ist.
   - Verworfen: Status quo beibehalten — wäre fachlich falsch (Steuer wird
     geschuldet, Karte zeigte 0 Zahllast).
5. **Plausi-Hinweise:** (a) 1407 bebucht, weicht von 3837 ab → eingeschränkter
   Vorsteuerabzug oder Buchungsfehler; (b) 3835/1408 bebucht → manuell zuordnen;
   (c) 4336/4339 bebucht → gehört in Kz 21 + Zusammenfassende Meldung.
6. **UI (renderUstva):** Zeilen 46/47/45 (nur wenn ≠ 0) in die Kennzahlen-Tabelle;
   Info-Box nennt die neuen Konten; Labels der manuellen § 13b-Felder präzisiert
   („Drittland/Bauleistungen → Kz 84/85"); „= Umsatzsteuer"-Summenzeile
   berücksichtigt kz47.

## Refute-Review-Auflagen (general-purpose-Agent, 2026-06-12 — alle übernommen)

1. **BLOCKER → Doppelerfassungs-Warnung:** Hinweis, wenn 3837 bebucht UND die
   manuellen rc13b-Felder gefüllt sind (Bestandsnutzer trugen gebuchte § 13b-Fälle
   bisher zwangsläufig manuell ein → sonst doppelte BMG, im KU-Fall doppelte Zahllast).
   Labels der manuellen Felder stellen klar: NUR Drittland/Bauleistungen, nichts
   doppelt erfassen, was schon gebucht ist.
2. **MAJOR → „davon Drittland"-Aufteilung:** neues Eingabefeld
   `gebucht13b.drittlandNetto` gliedert den Drittlands-/Bauleistungsanteil der
   GEBUCHTEN § 13b-Beträge von Kz 46/47 nach Kz 84/85 um (Zahllast invariant
   gegen die Aufteilung — nur Zeilen-Umverteilung). Warnung, wenn die Aufteilung
   größer als die gebuchte Steuer ist.
3. **MAJOR → closing.js angleichen:** `pruefeUstvaReadiness` überspringt den
   KU-Fall nur noch bei kz47+kz85 = 0; sonst „offen"-Eintrag § 18 Abs. 4a +
   Festschreibungs-Check (GoBD), Regelbesteuerungs-Abstimmungen entfallen weiter.
   KU-Warnkasten in app.js entsprechend. fristen.js (KU+§ 13b-Frist) → Folge-
   Backlog-Item.
4. **MAJOR → 4339 gehört in Kz 45, NICHT Kz 21:** 4339 fließt MIT in die
   Kz-45-Automatik (+ OSS-Vorbehalts-Hinweis bei Bebuchung). Kz-21-Hinweis nur
   für 4336.
5. Bestehender kz85-Hinweistext wird auf den manuellen Anteil präzisiert
   (kz67 enthält jetzt auch die gebuchte 1407-Vorsteuer).

## Scope-Grenzen

- KEIN automatisches Kz 21 (4336/4339) — eigene Baustelle (ZM-Pflicht hängt dran),
  nur Hinweis. KEINE 7-%-§ 13b-Konten (praktisch selten, manuelle Option deckt ab).
- ELSTER-Versand bleibt außen vor (Karte ist Aufbereitung).
