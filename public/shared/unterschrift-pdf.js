/* ===========================================================================
 * unterschrift-pdf.js  -  Ausfüllbares Feststellungs-/Unterschriften-PDF
 * ---------------------------------------------------------------------------
 * Erzeugt ein einseitiges PDF mit INTERAKTIVEN AcroForm-Textfeldern für Ort,
 * Datum und die Unterschrift(en) der Geschäftsführer — direkt im PDF ausfüllbar
 * (kein Drucken-und-Handschrift nötig). Kopf trägt Firma + Bezeichnung des
 * Abschlusses (Eröffnungsbilanz/Jahresabschluss + Stichtag).
 *
 * Bewusst schlankes, festes Layout (eine Seite, Textzeilen + Eingabefelder an
 * festen Koordinaten) — robust und ohne komplexe Tabellen-Geometrie.
 *
 * Nutzt pdf-lib (MIT): Browser über das vendored vendor/pdf-lib.min.js (lazy),
 * Node über require('pdf-lib'). Gleiches Muster wie zugferd-pdf.js.
 *
 *   erzeuge(u, a)     -> Promise<Uint8Array>   (PDF-Bytes mit Formularfeldern)
 *   istVerfuegbar()   -> Boolean (pdf-lib schon geladen ODER nachladbar)
 *   gfNamen(u)        -> [String]  (Geschäftsführer-Namen, mind. 1 Eintrag)
 *   titelFuer(a)      -> String    (z. B. "Eröffnungsbilanz zum 2024-01-01")
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UnterschriftPdf = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getPdfLib() {
    if (typeof PDFLib !== 'undefined') return PDFLib;
    if (typeof self !== 'undefined' && self.PDFLib) return self.PDFLib;
    if (typeof window !== 'undefined' && window.PDFLib) return window.PDFLib;
    if (typeof require !== 'undefined') { try { return require('pdf-lib'); } catch (e) {} }
    return null;
  }
  function ladePdfLib() {
    var p = getPdfLib();
    if (p) return Promise.resolve(p);
    if (typeof document === 'undefined') {
      return Promise.reject(new Error('pdf-lib nicht verfügbar (Node: npm install pdf-lib).'));
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'vendor/pdf-lib.min.js'; s.async = true;
      s.onload = function () { var l = getPdfLib(); l ? resolve(l)
        : reject(new Error('pdf-lib geladen, aber PDFLib global fehlt.')); };
      s.onerror = function () { reject(new Error(
        'public/vendor/pdf-lib.min.js fehlt. Bitte tools/setup-pdf-lib.sh ausführen.')); };
      document.head.appendChild(s);
    });
  }
  function istVerfuegbar() { return !!getPdfLib() || typeof document !== 'undefined'; }

  /* Geschäftsführer-Namen aus den Stammdaten (kommagetrennt); mind. ein
   * (ggf. leeres) Unterschriftsfeld, damit immer unterzeichnet werden kann. */
  function gfNamen(u) {
    var roh = (u && (u.geschaeftsfuehrerText || u.geschaeftsfuehrer)) || '';
    var arr = String(roh).split(',').map(function (s) { return s.trim(); })
      .filter(Boolean);
    return arr.length ? arr : [''];
  }
  function titelFuer(a) {
    var art = (a && a.art) === 'JAHRESABSCHLUSS' ? 'Jahresabschluss' : 'Eröffnungsbilanz';
    return art + (a && a.stichtag ? ' zum ' + a.stichtag : '');
  }

  /* Baut das einseitige Formular-PDF. Reine Funktion (kein DOM-Seiteneffekt
   * außer dem lazy Script-Load von pdf-lib). */
  function erzeuge(u, a) {
    return ladePdfLib().then(function (PL) {
      return PL.PDFDocument.create().then(function (doc) {
        var page = doc.addPage([595.28, 841.89]); // A4 in pt
        return doc.embedFont(PL.StandardFonts.Helvetica).then(function (font) {
          return doc.embedFont(PL.StandardFonts.HelveticaBold).then(function (fb) {
            var form = doc.getForm();
            var mLeft = 56, top = 841.89 - 72;
            function txt(str, x, y, size, bold) {
              page.drawText(String(str == null ? '' : str),
                { x: x, y: y, size: size || 11, font: bold ? fb : font });
            }
            function feld(name, x, y, w, h) {
              var f = form.createTextField(name);
              f.addToPage(page, { x: x, y: y, width: w, height: h || 20, borderWidth: 1 });
              return f;
            }
            // Kopf
            txt((u && (u.name || u.firma)) || 'OpenBilanz', mLeft, top, 15, true);
            txt(titelFuer(a), mLeft, top - 22, 12);
            txt('Feststellung / Unterzeichnung', mLeft, top - 46, 11, true);
            txt('Die Felder unten sind direkt im PDF ausfüllbar und unterschreibbar.',
              mLeft, top - 64, 9);

            // Ort / Datum
            var y = top - 104;
            txt('Ort', mLeft, y + 22, 10);
            feld('ort', mLeft, y, 210, 20);
            txt('Datum', mLeft + 250, y + 22, 10);
            feld('datum', mLeft + 250, y, 160, 20);

            // Unterschrift(en) der Geschäftsführer
            var names = gfNamen(u), yy = y - 58;
            names.forEach(function (nm, i) {
              txt('Unterschrift Geschäftsführer' + (nm ? ' — ' + nm : ''),
                mLeft, yy + 24, 10);
              feld('unterschrift_' + (i + 1), mLeft, yy, 320, 24);
              yy -= 58;
            });

            return doc.save();
          });
        });
      });
    });
  }

  return {
    erzeuge: erzeuge, istVerfuegbar: istVerfuegbar,
    gfNamen: gfNamen, titelFuer: titelFuer
  };
});
