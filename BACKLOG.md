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

- [ ] Die UStVA-Karte berechnet bisher nur Kz 81/86/66/83 aus
      3806/3801/1406/1401. Wer Reverse-Charge-Eingangsleistungen bezieht
      (§ 13b UStG, Konten 1407/3837 — z. B. Auslands-SaaS oder Gebühren
      eines ausländischen Zahlungsdienstleisters) oder im Inland nicht
      steuerbare Auslandsumsätze erzielt (Konto 4338), muss Kz 46/47/67
      und Kz 45 derzeit manuell in ELSTER ergänzen. Kennzahlen-Berechnung
      um diese Konten erweitern und in der Karte ausweisen.
