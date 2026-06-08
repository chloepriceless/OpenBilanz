# PDF-Export Redesign — Design-Position (T-0153, 2026-06-08)

## Auftrag (Christin, Brake-Ausnahme)
Zwei Bugs am PDF-/Druck-Output der Eröffnungsbilanz/Jahresabschluss:
- **Bug A** — Druckansicht/„Drucken"-Button zeigt oben ein Erstell-/Heute-Datum → raus
  (Dokumente müssen rückdatierbar ausgefüllt werden; gestempeltes Heute fällt auf).
- **Bug B** — das direkt erzeugte PDF (v2.5.0 `unterschrift-pdf.js`) enthält NUR die
  Unterschriften-Felder, NICHT den Bilanz-Inhalt → es muss die KOMPLETTE Bilanz/JA
  (alle Positionen, Summen, Aktiva/Passiva) PLUS die AcroForm-Felder enthalten.

## Belegte Diagnose (aus den 2 Beweis-PDFs, verifiziert)
- Bug A: Das Beweis-PDF `..._Eroeffnungsbilanz_Jahresabschluss.pdf` ist ein **Safari**-
  `window.print()`-Output (`/Creator (Safari)`, Quartz). Das Datum „08.06.26, 13:53" oben
  rechts + „https://openbilanz.de/app/ · Seite 1 von 1" unten = **Safari-Druckkopf-/fußzeile**,
  OS-injiziert. Das OpenBilanz-Dokument selbst (`dokInhalt`) rendert KEIN Datum.
  → Per CSS/Code aus `window.print()` **nicht** zuverlässig entfernbar (Nutzereinstellung
    „Kopf- und Fußzeilen" im Druckdialog). Ehrlich an Christin kommunizieren.
- Bug B: `unterschrift-pdf.js` erzeugt nur Kopf + Felder, keine Bilanz.

## Lösung (eine gemeinsame): generiertes Voll-PDF
Neues Modul `public/shared/bilanz-pdf.js` (pdf-lib), Button erzeugt künftig das
**vollständige, ausfüllbare** Dokument:
1. Kopf (Firma, PLZ/Ort/HR, Titel, „zum <Stichtag>", Größenklasse) — zentriert, KEIN Datum.
2. Bilanz zweispaltig Aktiva | Passiva (Positionen, §272-Sonderfälle, Summen).
3. GuV (nur bei JAHRESABSCHLUSS).
4. Anhang/Angaben unter der Bilanz.
5. Fuß „Aufgestellt nach den Vorschriften des HGB. Erstellt mit OpenBilanz."
6. Unterschriftsblock als **AcroForm-Felder**: `ort`, `datum` (= Bug-A-„ausfüllbares Datum
   statt fest"), `unterschrift_N` je Geschäftsführer.
→ löst Bug B vollständig + Bug A im Kern (datumsfrei, rückdatierbar ausfüllbar).

## Architektur-Entscheidung (Tradeoffs)
- **Daten-Extraktor im PDF-Modul dupliziert** (NICHT `dokSeite`/HTML-Pfad refactoren).
  Begründung: null Regressionsrisiko für Christins Live-Web-Ansicht; HGB-§266-Gliederung
  ist gesetzlich stabil → Drift-Gefahr minimal; zusätzlich Konsistenz-Test
  (Extraktor-Summen == `r.bilanz.summeAktiva/summePassiva`).
- **Bilanz einseitig** (zweispaltig, kein spaltenübergreifender Seitenumbruch);
  GuV/Anhang/Unterschrift fließend mit Seitenumbruch. Rest-Risiko: sehr große JA mit
  Dutzenden N-Posten je Spalte (Christins Zielgruppe Kleinst/klein nie betroffen). Dokumentiert.
- Deutsche Geldformatierung manuell (kein ICU-Risiko in Node): `12.500,00` / `-12.500,00`.
- `unterschrift-pdf.js` bleibt als Modul bestehen (keine Test-Brüche); Button nutzt Voll-PDF.

## Bug A — Resthandling window.print()
Voll-PDF ist der empfohlene, datumsfreie Export. `window.print()`-Button bleibt für
Papierdruck; dezenter Hinweis, dass Datum/URL-Kopfzeile vom Browser kommt. Ehrliche
Erklärung an Christin im Abschluss (No-Sycophancy: nicht „gefixt" behaupten).

## Verifikation
- Node: Extraktor-Werte + Summen-Konsistenz; `form.getFields()` enthält ort/datum/unterschrift_*;
  valides PDF (pdf-lib lädt es zurück).
- Visuell: Christins echte EB-Fixture rendern (pdftoppm) + gegen das Safari-Soll-PDF vergleichen.
- Codex-Refute auf den Diff (R26), dann Deploy v2.6.0 + öffentliche Verifikation.
