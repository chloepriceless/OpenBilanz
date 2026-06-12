# Backlog — offene Schritte am bereits implementierten Code

Hier landen Folge-Aufgaben, die kein „in Planung"-Feature sind, sondern
**Nacharbeiten an bereits umgesetztem Code**: Validierungen mit echten Daten,
externe Toolchecks, README-Statusübergänge von 🟡 zu ✅.

## E-Rechnung — Empfang (parseERechnung / pdfa3)

- [ ] Eine echte XRechnung-XML eines deutschen Lieferanten durchlesen
      lassen — Header, Profil, Positionen, Plausi vergleichen.
- [ ] Eine echte ZUGFeRD-/Factur-X-PDF mit eingebetteter XML durch das
      Upload-Feld jagen — PDF/A-3-Extraktor (`pdfa3.js`) muss die XML
      finden und entpacken.
- [ ] README-Zeile „E-Rechnung empfangen" auf ✅ heben, sobald beides
      bestätigt ist.

## E-Rechnung — Versand (XRechnung-UBL + CII)

- [ ] Eine über den Editor erzeugte UBL-XML mit dem KoSIT-Validator
      (Apache 2.0, externes Java-Tool) prüfen — XSD + Schematron.
- [ ] Dasselbe für die CII-Variante.
- [ ] § 14 UStG-Pflichtcheck gegen die gängigen Sonderfälle (§ 13b,
      innergem. Lieferung/Leistung, § 19 Kleinunternehmer) mit realen
      Beispieldaten gegenprüfen.
- [ ] Buchungsautomat: nach „Versenden" muss in der Buchhaltung
      Forderung 1200 an Erlöse 4400 + USt 3806 mit den passenden Beträgen
      stehen; bei § 13b nur die Erlös-Buchung gegen 4336.
- [ ] Rechnungsnummernkreis: lückenlos über mindestens drei Rechnungen,
      Jahreswechsel-Test (Datum 31.12. → 02.01. → reset).
- [ ] README-Zeilen „Ausgangsrechnungen schreiben" und „XRechnung erzeugen"
      auf ✅ heben.

## ZUGFeRD-Hybrid-PDF

- [ ] `tools/setup-pdf-lib.sh` einmalig laufen lassen (vendort pdf-lib,
      sRGB-ICC, Liberation Sans nach `public/vendor/`).
- [ ] Ein generiertes Hybrid-PDF durch unseren eigenen `parseERechnungPdf`
      schicken — wenn die Rechnung mit identischen Beträgen zurückkommt,
      ist die XML korrekt eingebettet (Roundtrip-Test).
- [ ] Dasselbe PDF mit dem Mustang-Validator (Apache 2.0) gegen das
      Factur-X-EN-16931-Profil prüfen. Lücken (XMP-Stream mit
      `pdfaid:part=3`, OutputIntent mit ICC-Profil als Stream,
      Tagged-PDF-Struktur) dokumentieren und im Folge-Schritt schließen.
- [ ] README-Zeile „ZUGFeRD-Hybrid-PDF" auf ✅ heben, sobald Mustang
      grün ist.

## USt-IdNr.-Prüfung

- [ ] Struktur-Prüfung mit bekannten validen Beispielen pro Staat
      durchspielen (DE eigene USt-ID, valide AT/NL/IT als Kunde).
- [ ] Im Selbst-Hosting-Modus: VIES-Knopf gegen mindestens eine reale
      EU-USt-ID drücken; Antwort wird beim Kunden archiviert.
- [ ] README-Zeile „USt-IdNr.-Prüfung" auf ✅ heben.

## UStVA-Karte — § 13b- und Auslands-Kennzahlen

- [x] ERLEDIGT (v2.17.0): Konten 3837/1407 fließen automatisch in Kz 46/47/67,
      4338/4339 in Kz 45; „davon Drittland"-Aufteilung nach Kz 84/85;
      Kleinunternehmer-Fall nach § 18 Abs. 4a UStG korrigiert (Steuer wird
      geschuldet, kein Vorsteuerabzug); Plausi-Hinweise (Doppelerfassung,
      1407/3837-Abweichung, 3835/1408, 4336 → Kz 21/ZM, 4339-OSS-Vorbehalt).
      Design + Refute-Review: `.planning/USTVA-KZ45-46-47-DESIGN.md`.
- [x] ERLEDIGT (v2.18.0): `fristen.js` listet die UStVA-Frist jetzt auch für
      Kleinunternehmer, wenn im Meldezeitraum § 13b-Konten (3837/3835) bebucht
      sind (§ 18 Abs. 4a UStG) — Buchungszugriff war über `abschluesse`
      bereits vorhanden, keine Schnittstellen-Änderung nötig.
