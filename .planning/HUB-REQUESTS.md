
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
