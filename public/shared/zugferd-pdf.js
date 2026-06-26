/* ===========================================================================
 * zugferd-pdf.js  -  Erzeugt ein Hybrid-PDF mit eingebetteter CII-XML
 * ---------------------------------------------------------------------------
 * Erzeugt eine PDF-Datei, die:
 *   1. ein lesbares Rechnungs-Layout darstellt (Standard-DE-Form);
 *   2. die übergebene XRechnung-CII-XML als Anhang trägt
 *      (AFRelationship=Alternative, MIME application/xml,
 *      Dateiname factur-x.xml);
 *   3. mit OpenBilanz' eigenem parseERechnungPdf wieder rückgelesen werden
 *      kann (Rundlauf-Test).
 *
 * ⚠ Konformitäts-Status (Stand: Spike):
 *   Das erzeugte PDF ist ein **funktionierender Hybrid** im Sinne von „PDF mit
 *   eingebetteter strukturierter Rechnungs-XML". Volle **PDF/A-3-Konformität**
 *   im Sinne der ISO 19005-3 (vollständiger XMP-Stream mit pdfaid:part=3,
 *   OutputIntent mit ICC-Profil, Tagged-PDF-Strukturen) ist NICHT garantiert
 *   und sollte mit dem Mustang-Validator (Apache 2.0, externes Java-Tool)
 *   gegengeprüft werden, bevor die PDF an Empfänger ausgeliefert wird, die auf
 *   strikte PDF/A-3-Konformität bestehen. Für die Mehrheit der B2B-Inland-
 *   Fälle ab 2025 ist allerdings die XRechnung-XML (separat) ohnehin das
 *   gesetzliche Mindestformat — das Hybrid-PDF ist Komfort, keine Pflicht.
 *
 *   erzeuge(rechnung, eigene, ciiXml)  ->  Promise<Uint8Array>
 *
 * Voraussetzung: pdf-lib (MIT) liegt unter public/vendor/pdf-lib.min.js
 * (lokal vendort durch tools/setup-pdf-lib.sh — kein Runtime-Nachladen aus
 * fremden Netzen).
 * ========================================================================= */
(function (root, factory) {
  var UBL = (typeof module !== 'undefined' && module.exports) ?
    require('./xrechnung-ubl.js') :
    (typeof self !== 'undefined' ? self : this).XRechnungUBL;
  var api = factory(UBL);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZugferdPdf = api;
})(typeof self !== 'undefined' ? self : this, function (UBL) {
  'use strict';

  /* ---- pdf-lib-Verfügbarkeit prüfen / lazy laden ----------------------- */

  function getPdfLib() {
    if (typeof PDFLib !== 'undefined') return PDFLib;
    if (typeof self !== 'undefined' && self.PDFLib) return self.PDFLib;
    if (typeof window !== 'undefined' && window.PDFLib) return window.PDFLib;
    if (typeof require !== 'undefined') {
      try { return require('pdf-lib'); } catch (e) {}
    }
    return null;
  }
  var ladeInflight = null;
  function ladePdfLib() {
    var p = getPdfLib();
    if (p) return Promise.resolve(p);
    if (typeof document === 'undefined') {
      return Promise.reject(new Error(
        'pdf-lib nicht verfügbar (Node-Modus: npm install pdf-lib im Projektordner).'));
    }
    if (ladeInflight) return ladeInflight;
    ladeInflight = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'vendor/pdf-lib.min.js';
      s.async = true;
      s.onload = function () {
        var lib = getPdfLib();
        if (lib) resolve(lib);
        else reject(new Error('pdf-lib geladen, aber PDFLib global nicht gesetzt.'));
      };
      s.onerror = function () {
        ladeInflight = null;
        reject(new Error(
          'public/vendor/pdf-lib.min.js fehlt. Bitte einmalig tools/setup-pdf-lib.sh ausführen.'));
      };
      document.head.appendChild(s);
    });
    return ladeInflight;
  }
  /* Prüft die Verfügbarkeit ohne pdf-lib zu laden — für das UI, das den
   * ZUGFeRD-Knopf nur zeigen will, wenn das Asset vorhanden ist. */
  function istVerfuegbar() {
    if (getPdfLib()) return Promise.resolve(true);
    if (typeof fetch === 'undefined') return Promise.resolve(false);
    return fetch('vendor/pdf-lib.min.js', { method: 'HEAD' })
      .then(function (r) { return r.ok; }, function () { return false; });
  }

  /* ---- Hilfen ---------------------------------------------------------- */

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'utf8'));
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }
  function ladeAssetBytes(pfad) {
    if (typeof fetch !== 'undefined') {
      return fetch(pfad).then(function (r) {
        if (!r.ok) return null;
        return r.arrayBuffer().then(function (b) { return new Uint8Array(b); });
      }).catch(function () { return null; });
    }
    if (typeof require !== 'undefined') {
      try {
        var fs = require('fs');
        return Promise.resolve(new Uint8Array(fs.readFileSync(pfad)));
      } catch (e) { return Promise.resolve(null); }
    }
    return Promise.resolve(null);
  }
  function f2(n) {
    var v = Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    return v.toFixed(2);
  }
  function geld(n) { return f2(n).replace('.', ',') + ' EUR'; }

  /* Sehr minimaler Latin-1-Eskaper: pdf-lib's StandardFonts WinAnsiEncoding
   * unterstützt Latin-1; alles drüber (Emojis u. ä.) ersetzen wir durch '?'. */
  function ascii(s) {
    return String(s == null ? '' : s).replace(/[^\x20-\xff]/g, '?');
  }

  /* Liefert den §-14-tauglichen Klartext-Hinweis zu einer Steuer-Besonderheit
   * aus DERSELBEN STEUERLOGIK wie die CII/UBL-XML (eine Quelle der Wahrheit).
   * Leerstring, wenn kein Hinweis nötig ist (NORMAL/leer). Bei unbekanntem
   * Schalter oder fehlendem UBL-Modul: Roh-Wert + XML-Verweis als Fallback —
   * auf einem Pflichtbeleg ist ein Hinweis mit Verweis besser als gar keiner. */
  function steuerHinweisText(besonderheit) {
    if (!besonderheit || besonderheit === 'NORMAL') return '';
    var stl = (UBL && UBL.STEUERLOGIK && UBL.STEUERLOGIK[besonderheit]) || null;
    if (stl && stl.hinweis) return stl.hinweis;
    return 'Steuerlicher Hinweis: ' + besonderheit + ' — siehe XML.';
  }

  /* ---- Layout-Zeichnen ------------------------------------------------- */

  function zeichneRechnung(pdfDoc, page, font, fontBold, rechnung, eigene) {
    var W = page.getWidth(), H = page.getHeight();
    var marginX = 50, lineH = 14;
    var y = H - 60;
    function schreibe(text, opts) {
      opts = opts || {};
      var f = opts.bold ? fontBold : font;
      var groesse = opts.size || 10;
      var x = opts.x != null ? opts.x : marginX;
      page.drawText(ascii(text || ''), { x: x, y: y, size: groesse, font: f });
    }
    /* Eigene Anschrift klein oben */
    schreibe([eigene.name, eigene.strasse, (eigene.plz || '') + ' ' + (eigene.ort || '')]
      .filter(Boolean).join(' · '), { size: 8 });
    y -= 30;
    /* Kunden-Adressfeld */
    var k = rechnung.kundeSnapshot || {};
    schreibe(k.name || '', { bold: true });
    y -= lineH;
    if (k.strasse) { schreibe(k.strasse); y -= lineH; }
    if (k.plz || k.ort) { schreibe((k.plz || '') + ' ' + (k.ort || '')); y -= lineH; }
    if (k.land && k.land !== 'DE') { schreibe(k.land); y -= lineH; }
    y -= 20;
    /* Rechnungs-Header rechts */
    var headerY = H - 110, headerX = W - 250;
    function rs(text, dy, opts) {
      opts = opts || {};
      page.drawText(ascii(text), { x: headerX, y: headerY - dy,
        size: opts.size || 10, font: opts.bold ? fontBold : font });
    }
    rs('Rechnung', 0, { bold: true, size: 14 });
    rs('Nummer:        ' + (rechnung.nummer || '(Entwurf)'), 24);
    rs('Datum:         ' + (rechnung.datum || ''),           38);
    if (rechnung.leistungsdatum) rs('Leistungsdatum: ' + rechnung.leistungsdatum, 52);
    if (rechnung.faelligkeit)    rs('Fällig bis:    ' + rechnung.faelligkeit,    66);
    /* Positionen-Tabelle */
    y -= 6;
    schreibe('Pos  Bezeichnung                                Menge   Einzelpreis   Betrag', { bold: true });
    y -= 4; page.drawLine({ start: { x: marginX, y: y }, end: { x: W - marginX, y: y }, thickness: 0.5 });
    y -= 12;
    (rechnung.positionen || []).forEach(function (p, i) {
      var name = ascii(p.bezeichnung || '');
      if (name.length > 38) name = name.slice(0, 37) + '…';
      var menge = (p.menge || 0).toString();
      var preis = geld(p.einzelpreis || 0);
      var betrag = geld((p.menge || 0) * (p.einzelpreis || 0));
      page.drawText((i + 1) + '.   ' + name.padEnd(40, ' '),
        { x: marginX, y: y, size: 9, font: font });
      page.drawText(menge.padStart(6, ' '),
        { x: marginX + 282, y: y, size: 9, font: font });
      page.drawText(preis.padStart(14, ' '),
        { x: marginX + 322, y: y, size: 9, font: font });
      page.drawText(betrag.padStart(14, ' '),
        { x: marginX + 412, y: y, size: 9, font: font });
      y -= lineH;
    });
    y -= 6; page.drawLine({ start: { x: marginX, y: y }, end: { x: W - marginX, y: y }, thickness: 0.5 });
    y -= 14;
    /* Summen */
    function ssum(lbl, val) {
      page.drawText(ascii(lbl), { x: W - marginX - 200, y: y, size: 10, font: font });
      page.drawText(geld(val), { x: W - marginX - 80, y: y, size: 10, font: font });
      y -= lineH;
    }
    ssum('Netto:',  rechnung.netto || 0);
    ssum('USt:',    rechnung.ust   || 0);
    page.drawText('Brutto:', { x: W - marginX - 200, y: y, size: 11, font: fontBold });
    page.drawText(geld(rechnung.brutto || 0), { x: W - marginX - 80, y: y, size: 11, font: fontBold });
    y -= 24;
    /* Steuerhinweis — §-14-tauglicher Klartext aus der STEUERLOGIK
     * (s. steuerHinweisText), nicht das Roh-Enum drucken. */
    var stHinweis = steuerHinweisText(rechnung.besonderheit);
    if (stHinweis) {
      schreibe(stHinweis, { size: 9 });
      y -= lineH;
    }
    if (rechnung.zahlungsbedingungen) {
      schreibe(rechnung.zahlungsbedingungen, { size: 9 });
      y -= lineH;
    }
    /* Fußzeile */
    var fy = 40;
    page.drawText(ascii('Erzeugt mit OpenBilanz. Diese PDF enthält eine eingebettete XRechnung-XML ' +
      '(factur-x.xml) gemäß EN 16931. Bei maschineller Verarbeitung gilt die XML.'),
      { x: marginX, y: fy, size: 7, font: font });
    var ust = (eigene.ustId || eigene.stNr) ?
      (eigene.ustId ? 'USt-IdNr. ' + eigene.ustId : 'St.-Nr. ' + eigene.stNr) : '';
    var bank = eigene.bank ? [eigene.bank.iban, eigene.bank.bic].filter(Boolean).join(' / ') : '';
    page.drawText(ascii([eigene.name, ust, bank].filter(Boolean).join(' · ')),
      { x: marginX, y: fy - 10, size: 7, font: font });
  }

  /* ---- Hauptfunktion --------------------------------------------------- */

  function erzeuge(rechnung, eigene, ciiXml /*, options */) {
    return ladePdfLib().then(function (PDFLib) {
      return PDFLib.PDFDocument.create().then(function (pdfDoc) {
        pdfDoc.setTitle('Rechnung ' + (rechnung.nummer || ''));
        pdfDoc.setSubject('Ausgangsrechnung — Factur-X / ZUGFeRD');
        pdfDoc.setProducer('OpenBilanz');
        pdfDoc.setCreator('OpenBilanz');
        pdfDoc.setKeywords(['XRechnung', 'ZUGFeRD', 'Factur-X', 'Rechnung']);
        return Promise.all([
          ladeAssetBytes('vendor/LiberationSans-Regular.ttf'),
          ladeAssetBytes('vendor/LiberationSans-Bold.ttf')
        ]).then(function (fonts) {
          var p = Promise.resolve();
          var font, fontBold;
          if (fonts[0]) p = p.then(function () { return pdfDoc.embedFont(fonts[0]); })
                            .then(function (f) { font = f; });
          else          p = p.then(function () { return pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica); })
                            .then(function (f) { font = f; });
          if (fonts[1]) p = p.then(function () { return pdfDoc.embedFont(fonts[1]); })
                            .then(function (f) { fontBold = f; });
          else          p = p.then(function () { return pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold); })
                            .then(function (f) { fontBold = f; });
          return p.then(function () {
            var page = pdfDoc.addPage([595.28, 841.89]); /* A4 portrait */
            zeichneRechnung(pdfDoc, page, font, fontBold, rechnung, eigene);
            /* XML anhängen. AFRelationship=Alternative ist für inländische
             * BASIC/EN16931-Profile der robuste Default. */
            var xmlBytes = utf8(ciiXml);
            pdfDoc.attach(xmlBytes, 'factur-x.xml', {
              mimeType: 'application/xml',
              description: 'Factur-X invoice (EN 16931)',
              creationDate: new Date(),
              modificationDate: new Date(),
              afRelationship: PDFLib.AFRelationship.Alternative
            });
            return pdfDoc.save();
          });
        });
      });
    });
  }

  return { erzeuge: erzeuge, ladePdfLib: ladePdfLib, istVerfuegbar: istVerfuegbar,
           steuerHinweisText: steuerHinweisText };
});
