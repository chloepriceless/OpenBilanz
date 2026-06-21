# UStVA Kz 41 (innergem. Lieferungen) + Bugfix Kz 44→43

_Pfenni, 2026-06-21. Compliance-kritisch (amtliche Steuer-Kennzahlen). Folgepunkt aus Welle-1-Fix #B._

## Problem (zwei Befunde)
1. **BESTEHENDER BUG (Kz 44 falsch):** `ustva.js:112` mappt `sf.mitVorsteuer`
   ("steuerfreie Umsätze mit Vorsteuerabzug") auf **Kz 44**. Amtlich [VERIFIED,
   BMF-Vordruckmuster] ist das **Kz 43**; Kz 44 ist der seltene Sonderfall
   "innergem. Lieferung NEUER FAHRZEUGE an Abnehmer ohne USt-IdNr". Die Umsätze
   landen damit in der falschen Vordruckzeile. UI `app.js:2692` zeigt Label "44".
2. **Kz 41 fehlt (Folgepunkt #B):** Innergem. Lieferungen § 4 Nr. 1b (gebucht auf
   Konto **4125** seit Welle-1-Fix) fließen NICHT in die UStVA → fallen still aus.
   Ebenso wird das § 4 Nr. 2-7-Konto **4150** nicht ausgewertet.

## Amtliche Kennzahlen (BMF-Vordruckmuster, Abschnitt B) [VERIFIED]
- Kz 41 = innergem. Lieferungen § 4 Nr. 1b an Abnehmer mit USt-IdNr (+ ZM-Pflicht § 18a).
- Kz 43 = weitere steuerfreie Umsätze MIT Vorsteuerabzug (Ausfuhr, § 4 Nr. 2-7, EU-VO).
- Kz 44 = innergem. Lieferung NEUER Fahrzeuge an Abnehmer OHNE USt-IdNr (Sonderfall, NICHT umgesetzt).
- Kz 48 = steuerfreie Umsätze OHNE Vorsteuerabzug (§ 4 Nr. 8-29, § 19 Abs. 1).

## Entscheidung
Kennzahlen aus den Buchungskonten ziehen (analog kz81←4400, kz45←4338/4339) PLUS
manuellen Zuschlag für nicht-gebuchte Umsätze (additiv, analog § 13b-Mechanik):
- `kz41 = cent(hs('4125'))` — innergem. Lieferungen (gebuchte Ausgangsrechnungen).
- `kz43 = cent(hs('4150') + n(sf.mitVorsteuer))` — Konto § 4 Nr. 2-7 + manuell.
- `kz48 = cent(n(sf.ohneVorsteuer))` — unverändert (kein Standard-Erlöskonto im Buchungsautomat).
- `kz44` (alt, falsch) ENTFERNT aus Berechnung + Return + UI.

Hinweise (konsistent zur bestehenden hinweise-Mechanik):
- `kz41 > 0` → "zusätzlich in der Zusammenfassenden Meldung (§ 18a UStG) ans BZSt melden".
- `hs('4150') > 0 && sf.mitVorsteuer > 0` → mögliche Doppelerfassung (gebucht + manuell).

UI `renderUstva` (app.js ~2692): Zeile Kz 41 (neu, vor 43) + Label "43" statt "44".

## Verworfen
- Eigenes manuelles Kz-41-Eingabefeld: vorerst nein — der Haupt-Pfad ist die
  gebuchte Ausgangsrechnung (4125); ein manueller Input wäre Scope-Erweiterung
  ohne aktuellen Bedarf. Nachrüstbar.
- Kz 44 (neue Fahrzeuge ohne USt-IdNr) implementieren: seltener Sonderfall ohne
  eigenes Konto/Use-Case → bewusst weggelassen, Code lügt nicht mehr (Label weg).

## Verifikation (Oracle)
- Buchung 4125 (innergem. Lieferung 1000 €) → `kz41 == 1000`, `kz43 == 0`.
- Buchung 4150 (Ausfuhr 500 €) + `sf.mitVorsteuer = 200` → `kz43 == 700`.
- `kz44` nicht mehr im Return. `kz48` aus `sf.ohneVorsteuer` unverändert.
- Keine Doppelzählung mit kz81/kz86 (4125/4150 ∉ 4400/4000/4300).
- ZM-Hinweis bei kz41>0; Doppelerfassungs-Hinweis bei 4150+manuell. Tests grün.
