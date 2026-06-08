/* ===========================================================================
 * bilanz-pdf.js  -  Vollständiges, ausfüllbares Bilanz-/Jahresabschluss-PDF
 * ---------------------------------------------------------------------------
 * Erzeugt EIN PDF mit dem KOMPLETTEN Dokument (Kopf, Bilanz in Kontoform
 * Aktiva|Passiva, GuV bei Jahresabschluss, Anhang/Angaben, Fuß) PLUS den
 * INTERAKTIVEN AcroForm-Feldern Ort, Datum und Unterschrift(en) der
 * Geschäftsführung — direkt im PDF ausfüllbar und unterschreibbar.
 *
 * Bewusst KEIN automatisches Erstell-/Heute-Datum: das Datum ist ein
 * ausfüllbares Feld, damit das Dokument rückwirkend (zum Stichtag) ausgefüllt
 * werden kann (Anforderung Christin, T-0153).
 *
 * Eigener, reiner Daten-Extraktor (bilanzZeilen/guvZeilen/anhangAbsaetze) statt
 * Refactoring des getesteten HTML-Renderers (dokSeite) — null Risiko für die
 * Web-Ansicht, HGB-§266-Gliederung ist stabil; Konsistenz via Summen-Test.
 *
 * Nutzt pdf-lib (MIT): Browser über vendor/pdf-lib.min.js (lazy), Node über
 * require('pdf-lib'). Gleiches Lade-Muster wie unterschrift-pdf.js / zugferd-pdf.js.
 *
 *   erzeuge(u, a, r)  -> Promise<Uint8Array>   (PDF-Bytes mit Formularfeldern)
 *   bilanzZeilen(seite, r) -> [{nr,label,betrag,ebene,betragText}]   (rein)
 *   guvZeilen(a, r)        -> [{nr,label,ebene,betragText}]          (rein)
 *   anhangAbsaetze(a)      -> {titel, absaetze:[{strong,text}]}      (rein)
 *   istVerfuegbar()        -> Boolean
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BilanzPdf = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- pdf-lib laden (Browser lazy / Node require) ---------------------- */
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

  function getPositionen() {
    if (typeof Positionen !== 'undefined') return Positionen;
    if (typeof self !== 'undefined' && self.Positionen) return self.Positionen;
    if (typeof window !== 'undefined' && window.Positionen) return window.Positionen;
    if (typeof require !== 'undefined') { try { return require('./positionen'); } catch (e) {} }
    return null;
  }

  /* ---- reine Helfer ----------------------------------------------------- */
  function geld(n) {
    n = Math.round((Number(n) || 0) * 100) / 100;
    var neg = n < 0; n = Math.abs(n);
    var s = n.toFixed(2).split('.');
    var g = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + g + ',' + s[1];
  }
  function dzSichtbar(w) { return Math.abs(Number(w) || 0) >= 0.005; }
  function datumDe(iso) {
    if (!iso) return '–';
    var t = String(iso).split('-');
    return t.length === 3 ? t[2] + '.' + t[1] + '.' + t[0] : String(iso);
  }
  function gfNamen(u) {
    var roh = (u && (u.geschaeftsfuehrerText || u.geschaeftsfuehrer)) || '';
    var arr = String(roh).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return arr.length ? arr : [''];
  }
  function klasseName(k) {
    var P = getPositionen();
    var K = P && P.GROESSENKLASSEN && P.GROESSENKLASSEN.klassen;
    return (k && K && K[k] && K[k].name) || '';
  }

  /* ---- Daten-Extraktoren (rein, Node-testbar) --------------------------- */
  function bilanzZeilen(seite, r) {
    var P = getPositionen();
    var baum = seite === 'aktiva' ? P.AKTIVA : P.PASSIVA;
    var werte = seite === 'aktiva' ? r.bilanz.aktiva : r.bilanz.passiva;
    var kap = r.bilanz.kapital, z = [];
    function push(nr, label, betrag, ebene) {
      z.push({ nr: nr, label: label, betrag: betrag, ebene: ebene, betragText: geld(betrag) });
    }
    baum.forEach(function (b) {
      var sicht = dzSichtbar(werte[b.id]);
      if (b.id === 'P.A' && kap.gezeichnet > 0) sicht = true;
      if (!sicht) return;
      push(b.nr, b.label, werte[b.id] || 0, 'B');
      if (!b.kinder) return;
      b.kinder.forEach(function (k) {
        // § 272 Abs. 1 S. 3 HGB: gezeichnetes Kapital mit offener Absetzung
        if (seite === 'passiva' && k.id === 'P.A.I' && kap.nichtEingefordert > 0) {
          push(k.nr, k.label, kap.gezeichnet, 'R');
          push(null, 'Nicht eingeforderte ausstehende Einlagen', -kap.nichtEingefordert, 'davon');
          push(null, 'Eingefordertes Kapital', kap.eingefordertesKapital, 'davon');
          // Aufgliederung des eingeforderten Kapitals (informativ): wie viel ist
          // tatsächlich eingezahlt und wie viel eingefordert, aber noch nicht eingezahlt.
          push(null, 'davon eingezahlt', kap.eingezahlt || 0, 'davon');
          if (kap.eingefordertOffen > 0) {
            push(null, 'davon eingefordert, noch nicht eingezahlt', kap.eingefordertOffen, 'davon');
          }
          return;
        }
        if (!dzSichtbar(werte[k.id])) return;
        push(k.nr, k.label, werte[k.id] || 0, k.typ === 'R' ? 'R' : 'N');
        // § 272 Abs. 1 S. 3 HGB: eingefordertes, noch nicht eingezahltes Kapital
        if (seite === 'aktiva' && k.id === 'B.II' && kap.eingefordertOffen > 0) {
          push(null, 'davon eingefordertes, noch nicht eingezahltes Kapital',
            kap.eingefordertOffen, 'davon');
        }
      });
    });
    var sW = seite === 'aktiva' ? r.bilanz.summeAktiva : r.bilanz.summePassiva;
    z.push({ nr: null, label: seite === 'aktiva' ? 'Summe Aktiva' : 'Summe Passiva',
      betrag: sW, ebene: 'summe', betragText: geld(sW) + ' EUR' });
    return z;
  }
  function guvZeilen(a, r) {
    var P = getPositionen(), schema = P.guvSchema(a.guvVerfahren);
    return schema.map(function (p) {
      var w = r.guv.werte[p.id] || 0;
      return {
        nr: p.nr, label: p.label,
        ebene: (p.art === 'Z' || p.art === 'S') ? 'summe' : 'N',
        betragText: (p.art === 'A' ? '-' : '') + geld(w) + ' EUR'
      };
    });
  }
  function anhangAbsaetze(a) {
    var an = a.anhang || {}, kleinst = a.groessenklasse === 'KLEINST';
    var out = { titel: '', absaetze: [] };
    function p(strong, text) { out.absaetze.push({ strong: strong, text: text }); }
    if (kleinst) {
      out.titel = 'Angaben unter der Bilanz (§ 264 Abs. 1 Satz 5 HGB)';
      p('Haftungsverhältnisse:', an.haftungsverhaeltnisse || '–');
      p('Vorschüsse und Kredite an Organmitglieder:', an.organkredite || '–');
    } else {
      out.titel = 'Anhang';
      if (an.methoden) p('Bilanzierungs- und Bewertungsmethoden:', an.methoden);
      p('Durchschnittliche Zahl der Arbeitnehmer:', String(an.arbeitnehmer || 0));
      if (an.restlaufzeit5) p('Verbindlichkeiten mit Restlaufzeit über 5 Jahre:', an.restlaufzeit5 + ' EUR');
      p('Haftungsverhältnisse:', an.haftungsverhaeltnisse || '–');
      p('Vorschüsse und Kredite an Organmitglieder:', an.organkredite || '–');
      if (an.ergebnisverwendung) p('Vorschlag zur Ergebnisverwendung:', an.ergebnisverwendung);
    }
    if (an.sonstiges) p('Sonstige Angaben:', an.sonstiges);
    return out;
  }

  /* ---- Renderer --------------------------------------------------------- */
  function erzeuge(u, a, r) {
    u = u || {}; a = a || {};
    return ladePdfLib().then(function (PL) {
      return PL.PDFDocument.create().then(function (doc) {
        return Promise.all([
          doc.embedFont(PL.StandardFonts.Helvetica),
          doc.embedFont(PL.StandardFonts.HelveticaBold),
          doc.embedFont(PL.StandardFonts.HelveticaOblique)
        ]).then(function (fonts) {
          var font = fonts[0], bold = fonts[1], obl = fonts[2];
          var form = doc.getForm();
          var W = 595.28, H = 841.89, ML = 56, MR = 56, MT = 72, MB = 56;
          var innerW = W - ML - MR, contentRight = W - MR;
          var black = PL.rgb(0.13, 0.13, 0.13), grau = PL.rgb(0.42, 0.42, 0.42),
              grauL = PL.rgb(0.78, 0.78, 0.78);
          var st = { page: null, y: 0 };

          function prep(s) {
            s = String(s == null ? '' : s)
              .replace(/[−‒—]/g, '-')
              .replace(/ /g, ' ')
              .replace(/[‘’‚]/g, "'")
              .replace(/[“”„]/g, '"');
            try { font.widthOfTextAtSize(s, 10); return s; }
            catch (e) { return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?'); }
          }
          function wOf(s, size, f) { return (f || font).widthOfTextAtSize(prep(s), size); }
          function draw(s, x, y, size, f, color) {
            st.page.drawText(prep(s), { x: x, y: y, size: size, font: f || font, color: color || black });
          }
          function drawRight(s, xEnd, y, size, f, color) { draw(s, xEnd - wOf(s, size, f), y, size, f, color); }
          function drawCenter(s, y, size, f, color) { draw(s, (W - wOf(s, size, f)) / 2, y, size, f, color); }
          // zentriert, schrumpft die Schrift bis der Text in die Inhaltsbreite passt
          function drawCenterFit(s, y, maxSize, minSize, f, color) {
            var size = maxSize;
            while (size > minSize && wOf(s, size, f) > innerW) size -= 0.5;
            drawCenter(s, y, size, f, color);
          }
          function line(x1, x2, yy, th, color) {
            st.page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: th || 0.7, color: color || grauL });
          }
          function neueSeite() { st.page = doc.addPage([W, H]); st.y = H - MT; }
          function room(h) { if (st.y - h < MB) neueSeite(); }
          function wrap(s, maxW, size, f) {
            var words = prep(s).split(/\s+/), lines = [], cur = '';
            words.forEach(function (w) {
              if (!w) return;
              var t = cur ? cur + ' ' + w : w;
              if (!cur || wOf(t, size, f) <= maxW) cur = t;
              else { lines.push(cur); cur = w; }
            });
            if (cur) lines.push(cur);
            return lines.length ? lines : [''];
          }
          function sektionTitel(t) {
            room(24); draw(t, ML, st.y, 11, bold); st.y -= 5;
            line(ML, contentRight, st.y, 0.8, grauL); st.y -= 14;
          }
          // gemischt fett (strong) + normal, fließender Umbruch
          function paragraph(strong, rest, x0, maxW, size) {
            var tokens = [], spaceW = wOf(' ', size, font);
            if (strong) prep(strong).split(/\s+/).forEach(function (w) { if (w) tokens.push({ t: w, b: true }); });
            prep(rest).split(/\s+/).forEach(function (w) { if (w) tokens.push({ t: w, b: false }); });
            room(size + 4); var cx = x0, first = true;
            tokens.forEach(function (tok) {
              var f = tok.b ? bold : font, ww = wOf(tok.t, size, f);
              if (!first && cx + ww > x0 + maxW) { st.y -= (size + 3); cx = x0; room(size + 3); }
              draw(tok.t, cx, st.y, size, f, tok.b ? black : black);
              cx += ww + spaceW; first = false;
            });
            st.y -= (size + 3);
          }

          /* --- Kopf (zentriert, KEIN Datum) --- */
          neueSeite();
          drawCenterFit(u.name || u.firma || 'Unternehmen', st.y, 15, 9, bold); st.y -= 17;
          var kopfSub = ((u.plz || '') + ' ' + (u.ort || '')).trim();
          if (u.hrNummer) kopfSub += (kopfSub ? '  ·  ' : '') + u.hrNummer;
          if (kopfSub) { drawCenter(kopfSub, st.y, 9.5, font, grau); st.y -= 22; } else st.y -= 8;
          var istEB = a.art === 'EROEFFNUNGSBILANZ';
          drawCenter(istEB ? 'Eröffnungsbilanz' : 'Jahresabschluss', st.y, 15, bold); st.y -= 15;
          var z2 = 'zum ' + datumDe(a.stichtag) +
            (istEB ? '' : '  ·  Geschäftsjahr ' + datumDe(a.gjVon) + ' bis ' + datumDe(a.gjBis));
          drawCenter(z2, st.y, 9.5, font, grau); st.y -= 12;
          var kn = klasseName(a.groessenklasse);
          if (kn) { drawCenter(kn, st.y, 9.5, font, grau); st.y -= 24; } else st.y -= 12;

          /* --- Bilanz zweispaltig Aktiva | Passiva (einseitig) --- */
          sektionTitel('Bilanz');
          var colGap = 26, colW = (innerW - colGap) / 2;
          var xA0 = ML, xAEnd = ML + colW, xP0 = ML + colW + colGap, xPEnd = contentRight;
          var yHead = st.y;
          draw('AKTIVA', xA0, yHead, 9, bold);
          draw('PASSIVA', xP0, yHead, 9, bold);
          var yTop = yHead - 16;
          function renderSpalte(zeilen, x0, xEnd) {
            var yy = yTop, betragW = 70;
            zeilen.forEach(function (zz) {
              var ind = zz.ebene === 'R' ? 10 : zz.ebene === 'N' ? 20 : zz.ebene === 'davon' ? 24 : 0;
              var f = (zz.ebene === 'B' || zz.ebene === 'summe') ? bold : (zz.ebene === 'davon' ? obl : font);
              var col = zz.ebene === 'davon' ? grau : black;
              var size = zz.ebene === 'davon' ? 8 : zz.ebene === 'N' ? 8.5 : 9;
              var lblTxt = (zz.nr ? zz.nr + ' ' : '') + (zz.ebene === 'B' ? String(zz.label).toUpperCase() : zz.label);
              var lines = wrap(lblTxt, (xEnd - x0) - betragW - 4 - ind, size, f);
              if (zz.ebene === 'summe') { yy -= 4; line(x0, xEnd, yy + 9, 0.7, grau); }
              lines.forEach(function (ln, i) {
                draw(ln, x0 + ind, yy, size, f, col);
                if (i === 0 && zz.betragText) drawRight(zz.betragText, xEnd, yy, size, f, col);
                yy -= (size + 3.5);
              });
              yy -= 2;
            });
            return yy;
          }
          var yA = renderSpalte(bilanzZeilen('aktiva', r), xA0, xAEnd);
          var yP = renderSpalte(bilanzZeilen('passiva', r), xP0, xPEnd);
          st.y = Math.min(yA, yP) - 14;

          // § 272 Abs. 1 S. 3 HGB Fußnote (eingefordertes offenes Kapital)
          if (r.bilanz.kapital.eingefordertOffen > 0) {
            paragraph('', 'In den Forderungen und sonstigen Vermögensgegenständen sind ' +
              geld(r.bilanz.kapital.eingefordertOffen) + ' EUR eingefordertes, noch nicht ' +
              'eingezahltes Kapital enthalten (§ 272 Abs. 1 Satz 3 HGB).', ML, innerW, 8.5);
            st.y -= 4;
          }

          /* --- GuV (nur Jahresabschluss) --- */
          if (!istEB) {
            st.y -= 6; sektionTitel('Gewinn- und Verlustrechnung');
            guvZeilen(a, r).forEach(function (zz) {
              var f = zz.ebene === 'summe' ? bold : font;
              var lines = wrap((zz.nr ? zz.nr + ' ' : '') + zz.label, innerW - 95, 9, f);
              room(lines.length * 12.5 + 4);
              if (zz.ebene === 'summe') line(ML, contentRight, st.y + 9, 0.6, grau);
              lines.forEach(function (ln, i) {
                draw(ln, ML, st.y, 9, f);
                if (i === 0) drawRight(zz.betragText, contentRight, st.y, 9, f);
                st.y -= 12.5;
              });
              st.y -= 2;
            });
          }

          /* --- Anhang / Angaben unter der Bilanz --- */
          st.y -= 10;
          var an = anhangAbsaetze(a);
          sektionTitel(an.titel);
          an.absaetze.forEach(function (p) { paragraph(p.strong, p.text, ML, innerW, 9); st.y -= 3; });

          /* --- Fuß --- */
          st.y -= 10; room(18);
          draw('Aufgestellt nach den Vorschriften des HGB. Erstellt mit OpenBilanz.',
            ML, st.y, 8.5, font, grau);
          st.y -= 44;

          /* --- Unterschriftsblock als AcroForm-Felder --- */
          var gf = gfNamen(u);
          room(60 + gf.length * 52);
          function feld(nameStr, x, y, w, h) {
            var fld = form.createTextField(nameStr);
            fld.addToPage(st.page, { x: x, y: y, width: w, height: h, borderWidth: 1, borderColor: grauL });
            return fld;
          }
          var fy = st.y - 4;
          draw('Ort', ML, fy + 23, 9, font, grau); feld('ort', ML, fy, 210, 18);
          draw('Datum', ML + 250, fy + 23, 9, font, grau); feld('datum', ML + 250, fy, 150, 18);
          st.y = fy - 50;
          gf.forEach(function (nm, i) {
            var ly = st.y;
            draw('Unterschrift Geschäftsführung' + (nm ? ' — ' + nm : ''), ML, ly + 25, 9, font, grau);
            feld('unterschrift_' + (i + 1), ML, ly, 330, 22);
            st.y = ly - 52;
          });

          return doc.save();
        });
      });
    });
  }

  return {
    erzeuge: erzeuge,
    bilanzZeilen: bilanzZeilen,
    guvZeilen: guvZeilen,
    anhangAbsaetze: anhangAbsaetze,
    gfNamen: gfNamen,
    geld: geld,
    istVerfuegbar: istVerfuegbar
  };
});
