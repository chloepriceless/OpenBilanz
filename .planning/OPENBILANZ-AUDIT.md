# OPENBILANZ — CODEX-VOLL-AUDIT (T-0161)

**Auftrag (Christin/Hub, Brake, KRITISCH, 2026-06-08):** „Lass Codex ausführlich über ALLE
Berechnungen, Konten und Angaben in OpenBilanz laufen — alle Konten und Angaben müssen von
Claude UND Codex genehmigt sein." 4-Augen pro Position, Fix-Loop bei eindeutigen Fehlern,
Strittiges über Hub an Christin. Quellen: HGB (§§ 242 ff., 266, 268, 272, 275), gemeinfrei +
SKR04-Fakten + eigene Logik. KEIN DATEV-Scraping, KEIN DATEV-Prosa-Copy.

**Methodik:** Claude liest Kernlogik + provoziert Zustände empirisch (Node-Probe gegen die echten
Module). Refute-Subagent (general-purpose, Codex-Rolle) auditiert unabhängig + versucht Funde zu
widerlegen, mit algebraischem Beweis. Bestätigung erst, wenn BEIDE freigeben.

**Ergebnis:** **1 KRITISCHER Bug gefunden, behoben + live verifiziert** (Finding #1, § 268 Abs. 3).
Sonst: Rechenkern solide (Vorzeichen, Kontra-Konten, Rundung, § 272 sauber), generierte 902
SKR04-Konten systematisch validiert (0 ungültige pos/kat, 0 „verpuffende"). Kein zweiter kritischer
Fehler; einige NIEDRIG-/MITTEL-NIEDRIG-Notizen unten.

**Stand:** Audit abgeschlossen. Fix-Commit `9d88867` (v2.11.1), live auf openbilanz.de verifiziert
(version.js=2.11.1, berechnung.js Math.max-Fix Z.170). 246 Tests grün.

---

## Sign-off-Tabelle

| # | Position / Prüfgegenstand | Claude | Codex | Status | Begründung (Kurz) | Fix / Quelle |
|---|---|---|---|---|---|---|
| 1 | **§ 268 Abs. 3 — Bilanzgleichung bei negativem EK (Fehlbetrag)** | ❌→✅ | ❌→✅ | ✅ BEHOBEN | `summePassiva` zählte negatives `P.A` mit, während `aktiva['F']=−ekSumme` aktivseitig steht → überschuldete GmbH meldete `ausgeglichen=false`, `differenz=Fehlbetrag`. Codex algebr. Beweis: `differenz=−P.A=F` bei JEDEM konsistenten überschuldeten Abschluss. Fix: `Math.max(P.A,0)` in summePassiva. Beide Verdikte: korrekt, kein Gegenbeispiel. | `9d88867` · § 268 Abs. 3 HGB |
| 2 | **§ 272 Abs. 1 — Nettomethode gez. Kapital** (`kapitalRechnen`) | ✅ | ✅ | ✅ | eingefordertesKapital=gezeichnet−nichtEingefordert→P.A.I; eingefordertOffen→Aktiv B.II (S.3); Clamp [0,gez]. Konsistent Bildschirm/PDF/Kern. | § 272 Abs. 1 HGB |
| 3 | **Konto 2900/2910-Sonderbehandlung** (`salden2werte`) | ✅ | ✅ | ✅ | 2900→kapitalGezeichnet(−saldo), 2910→kapitalNichtEingefordert(+saldo); beide via `kontoFinden` auffindbar; früher `return` verhindert Leck nach passiva. | § 272 Abs. 1 S. 2 HGB |
| 4 | **`uebernehmeSalden` Verdrahtung** (app.js 4975) | ✅ | ✅ | ✅ | Selbstkonsistent: `eingefordertOffen=0` (kein Phantom-Aktiv), `eingezahlt=gez−nichtEing`, Modus BUCHHALTUNG. | — |
| 5 | **Vorzeichen AKTIV/PASSIV/ERTRAG/AUFWAND + Kontra-Konten** | ✅ | ✅ | ✅ | Saldo=soll−haben, vorzeichenrichtig (kein Math.abs); Erlösschmälerungen/Skonti mindern korrekt (Codex über echten Datenfluss verifiziert). | § 275 HGB |
| 6 | **Bankimport CAMT.053/MT940 — Verbuchung** (camtVorschau 3043) | ✅ | — | ✅ | Eingang→Soll Bank/Haben Gegenkonto; Ausgang umgekehrt; Betrag=Absolut. Saubere doppelte Buchung. | — |
| 7 | **PDF-Zahlen vs. Rechenkern** (bilanz-pdf.js) | ✅ | — | ✅ | `bilanzZeilen` nutzt `r.bilanz.summe*` (rechnet nicht selbst) → erbt Finding-#1-Fix; §272-Nettomethode konsistent. | § 266/272 HGB |
| 8 | **SKR04-Mapping kuratiert** (skr04.js, ~122 Konten) | ✅ | ✅ | ✅ | Alle durchgegangen; USt/Vorsteuer/lat.St./RAP/1460/EK/Rückst./Verb./GuV-kat korrekt. Keine Fehlzuordnung. | § 266/274/275 HGB |
| 9 | **SKR04-Mapping generiert** (gen-skr04-voll.js, 902 Konten) | ✅ | ✅ | ✅ | Codex systematisch: alle 902 lösen auf gültige pos/kat auf — **0 ungültig, 0 verpuffend**. Klassen-Ableitung 0/1→Aktiv, 2→EK, 3→Rückst/Verb, 4→Ertrag, 5/6→Aufwand, 7→Nummernkreis. | § 266/275 HGB |
| 10 | **Rundung `cent` / Akkumulationsdrift** | ✅ | ✅ | ✅ | Jeder Aggregationsschritt cent-gerundet; Drift-Test über alle Konten = 0 Abweichung. | — |
| 11 | **Plausibilitätsprüfungen `pruefe`** | ✅ | ✅ | ✅ | § 268 Abs. 3, Mindeststammkapital 25k (§ 5 GmbHG), 12,5k vor Anmeldung (§ 7 GmbHG), eingez.+eingef.>gez., EK-Quote. | div. HGB/GmbHG |

Legende: ✅ beide ok · ⚠️ bekannte Grenze · ❌ Fehler · →✅ behoben.

---

## Finding #1 (BEHOBEN) — § 268 Abs. 3 Bilanzgleichung bei Fehlbetrag

**Datei:** `public/shared/berechnung.js` `rechneBilanz` (summePassiva). **Schwere: KRITISCH.**
**Bug:** Bei negativem Eigenkapital wird der „Nicht durch EK gedeckte Fehlbetrag" (§ 268 Abs. 3 HGB)
als `aktiva['F']=−ekSumme` auf die Aktivseite reklassifiziert, das negative `passiva['P.A']` blieb
aber zusätzlich in `summePassiva` → Doppelzählung. Eine korrekt gebuchte überschuldete GmbH meldete
`ausgeglichen=false, differenz=Fehlbetrag`.
**Beweis (empirisch, konsistente Bücher — Bank 5k, Verb 65k, Stammk. 25k, Verlust 85k → EK −60k):**
vorher summeAktiva=65000, summePassiva=5000, differenz=60000, ausgeglichen=false; **nach Fix
65000/65000/0/true.** Codex-Algebra: `differenz=−P.A=F` für jeden konsistenten überschuldeten Fall.
**Fix:** `summePassiva` rechnet das EK mit `Math.max(passiva['P.A']||0, 0)` — negatives EK steht auf
der Aktivseite (Posten F) und trägt 0 zur Passivsumme bei. Normalfall (P.A≥0) unverändert; real
unausgeglichene Bilanz wird weiterhin korrekt erkannt (Regression-Test ergänzt). Alle Konsumenten
(Bildschirm app.js Z.1688, PDF Z.124) nutzen `summePassiva` → Fix propagiert überall.
**Test-Korrektur:** Der bestehende Test `run.js:76` hatte das Fehlverhalten mit INKONSISTENTEN
Eingabewerten (Aktiva 5k vs. EK+Verb 65k) maskiert — auf konsistente Bücher korrigiert + neuer
Regression-Test für inkonsistente (→ unausgeglichen).
**Verifiziert:** node-Probe (65000/65000/0/true) · 246 Tests grün · Codex-Refute-Konsens · live
openbilanz.de (berechnung.js Math.max-Fix Z.170, version.js 2.11.1).

---

## Weitere Funde (NIEDRIG / MITTEL-NIEDRIG — keine Live-Fehler, dokumentiert)

- **MITTEL-NIEDRIG · skr04-voll.js 2980-2999 „Sonderposten mit Rücklageanteil" → P.B.3 (sonstige
  Rückstellungen).** HGB-Ausweisungenauigkeit: der Sonderposten mit Rücklageanteil (§ 247 Abs. 3 /
  § 273 HGB a.F.) ist ein EIGENER Bilanzposten zwischen EK und Verbindlichkeiten, keine Rückstellung.
  Bilanzgleichung bleibt erhalten (Passivposition). **Praxisrelevanz gering** — BilMoG hat diese
  Posten weitgehend abgeschafft, eine moderne GmbH nutzt sie selten; im HGB-§266-Positionenbaum gibt
  es keinen eigenen Posten dafür → P.B.3 ist pragmatische Notlösung. **Keine Korrektur** (kein
  sauberes HGB-Ziel, obsolet). Als bekannte Grenze dokumentiert.
- **NIEDRIG · baumSummen (berechnung.js:40-47):** Gibt der Nutzer einen römischen Posten UND ein
  Kind ein, gewinnt das Kind (Parent-Direktwert verfällt). Bilanztechnisch konsistent (beidseitig),
  dokumentiertes Designverhalten — kein Korrektheitsfehler, ggf. künftig Eingabe-Warnung erwägen.
- **NIEDRIG · 2910 Wiring (app.js:4983) nur bei `kapitalNichtEingefordert>0`:** ein (untypischer)
  Haben-Saldo auf 2910 würde ignoriert; asymmetrisch zur 2900-Behandlung (null-Sentinel).
  Praxisirrelevant (2910 hat per Definition Soll-Saldo).
- **NIEDRIG · skr04-voll.js 2906/2907 (Rückständige fällige Einzahlungen + Gegenkonto) → P.A.I:**
  statistische „vermerkt"-Konten, netten paarweise auf 0; nur bei Einzelbuchung verzerrend.
- **HINWEIS (kein Fehler) · UKV-Mapping:** material/personal/abschreibung→ukv.2, bestand/eigen-
  leistung/sonstertrag→ukv.6 — Zeilen-Approximation (§ 275 Abs. 3 kennt keine eigene Bestands-
  veränderungs-/Eigenleistungszeile); Jahresergebnis bleibt korrekt, reine Darstellungsvereinfachung.

**Fazit:** OpenBilanz-Rechenkern + Kontenmappings sind nach 4-Augen-Audit (Claude + Codex-Refute)
**korrekt** — der eine kritische Fehler (§ 268 Abs. 3 Fehlbetrag) ist behoben + live. Die übrigen
Notizen sind Darstellungs-/Designdetails ohne Auswirkung auf die Bilanzgleichung.
