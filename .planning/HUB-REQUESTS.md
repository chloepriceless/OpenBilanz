
## 2026-06-08 ~15:55 — Bank-Import (CAMT.053), 2 Punkte von Christin (via Hub)
1) REGRESSION: durch das neue Such-/datalist-Feld ist im Bank-Import das lange DROPDOWN-Menü zur Kontoauswahl weg → Dropdown WIEDER anbieten (zusätzlich zum Suchfeld).
2) FEATURE: LÖSCHEN-Button pro Buchungszeile im Bank-Import, um eine Buchung VOR der Übernahme zu entfernen (z.B. bei sich überschneidenden Buchungen).
Major bleibt 2.x. Bauen + deploy live, an Hub melden.

## 2026-06-08 ~16:33 — Gezeichnetes Kapital aufgliedern (Christin via Hub)
Beim Gezeichneten Kapital fehlt die volle Unterscheidung: neben "Gezeichnetes Kapital" auch "davon eingezahlt", "davon eingefordert" UND "davon NICHT eingefordert". Beispiel 25.000€ Eröffnungssumme GmbH: 12.500 eingezahlt + 12.500 nicht eingefordert (kann man auch nicht einfordern) -> beide Positionen auflisten. Major bleibt 2.x. Bauen+deploy live, an Hub melden.

## 2026-06-08 ~16:47 — Eröffnungs-Buchungen "ausstehende Einlagen" nach DATEV (Christin via Hub)
Mit dem vollen SKR04 die SKR04-Konten + Eröffnungs-Buchungen für AUSSTEHENDE EINLAGEN (eingeforderte/nicht eingeforderte) korrekt abbilden — verzahnt mit der Gezeichnetes-Kapital-Aufgliederung (12.500 eingezahlt / 12.500 nicht eingefordert).
DATEV-Wissen: Such-Schema https://help-center.apps.datev.de/search?q=ausstehende%20einlagen%20buchen%20und%20ausweisen → Doku https://help-center.apps.datev.de/documents/1029183
Schlaubi (Merkel) zieht das DATEV-Wissen als Referenz; Pfenni baut Konten/Buchungen danach. Major bleibt 2.x. Bauen+deploy live, an Hub melden.


## [Hub 2026-06-08 19:05 MESZ] CODEX-AUDIT: alle Berechnungen/Konten/Angaben (Christin)
Christin-Vorgabe woertlich: "alle Konten und Angaben muessen von Claude UND Codex genehmigt sein."
Codex ausfuehrlich ueber ALLES laufen lassen (Codex-Refute + Claude-Gegenpruefung), doppeltes Sign-off pro Position.
Umfang: SKR04-Kontenzuordnungen, Eroeffnungsbilanz-Buchungen, Gezeichnetes Kapital (gezeichnet/eingezahlt/eingefordert/nicht eingefordert), ausstehende Einlagen (DATEV), Bankimport CAMT.053/MT940, Umbuchungen/Geldtransit 1460, alle Summenrechnungen + PDF-Zahlen.
Deliverable: .planning/OPENBILANZ-AUDIT.md (pro Position: Claude-Verdict + Codex-Verdict + Endstatus + Begruendung), committen, Report an Hub (geprueft/gefixt/offen). Laeuft auf FINALEN Stand. Ledger T-0161.

### [Hub 2026-06-08 19:10 MESZ] Nachschlag zu T-0161 (Codex-Audit) — Christin
1) FIX statt nur reporten: Codex-Finding + Claude stimmt nach erneutem Code-Check zu -> direkt fixen (atomarer Commit). "Vorher nochmal den Code checken" (kein Blind-Fix). Falsch-Positive verwerfen+begruenden.
2) Bei Abweichung ausfuehrlich bei DATEV + Gesetz recherchieren (HGB 242ff/264ff/272, GoB, AO; DATEV-Hilfecenter doc 1029183 + "ausstehende einlagen buchen und ausweisen"). Erst Merkel durchsuchen, fehlendes selbst holen + mit Quell-URL nach Merkel ingesten. DATEV nur interne Referenz (kein 1:1-Repost). Quellen ins Audit-Doc.
Audit-Doc zusaetzliche Spalten: "Fix angewandt (Commit)" + "Quelle DATEV/Gesetz".

---

## STATUS (gmbh-verwaltung, verifiziert 2026-06-08 ~18:50)
- **Bankimport (15:55) — Dropdown wieder da + Zeilen-Löschen:** ✅ ERLEDIGT v2.9.0. Live verifiziert
  (camtVorschau: aufklappbares `camtKonto`-Dropdown via kontoDropdown + `camtDel`-Löschen je Zeile).
- **Gezeichnetes Kapital aufgliedern (16:33) — davon eingezahlt/eingefordert/nicht eingefordert:**
  ✅ ERLEDIGT. Eingabe-Karte hatte die volle Aufgliederung bereits (v2.10.0). LÜCKE im Bilanz-Ausweis
  + PDF gefunden (zeigten nur §272-Nettomethode, „davon eingezahlt" fehlte) → ergänzt in **v2.13.0**
  (kapitalAusweisZeilen + bilanz-pdf.js, Memo-Zeilen, ändern Summen nicht). Live verifiziert.
- **Ausstehende-Einlagen-Eröffnungsbuchungen 2900/2910 (16:47):** ✅ ERLEDIGT. Rechenkern v2.11.0/2.11.1,
  im Codex-Voll-Audit (T-0161) bestätigt; Ausweis (Anzeige+PDF) via §272-Nettomethode + davon-Aufgliederung
  + Buchungshilfe korrekt. (DATEV-Doku 1029183: nur interne Referenz, kein Repost.)
- **Fristen WOHIN/WIE übermitteln:** ✅ ERLEDIGT v2.7.0 (Übermittlungshinweise Unternehmensregister/ELSTER).
- **CODEX-VOLL-AUDIT T-0161 (19:05/19:10):** ✅ ERLEDIGT. 1 kritischer §268-Bug behoben (v2.11.1),
  Deliverable .planning/OPENBILANZ-AUDIT.md. Siehe dort.
