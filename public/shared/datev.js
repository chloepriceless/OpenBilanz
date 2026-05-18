/* ===========================================================================
 * datev.js  -  Parser für DATEV-EXTF-Buchungsstapel (Import)
 * ---------------------------------------------------------------------------
 * Liest einen DATEV-Buchungsstapel im EXTF-Format ein - das Gegenstück zum
 * vorhandenen Export. Aufbau der Datei:
 *   Zeile 1  Kopfsatz   ("EXTF";700;21;"Buchungsstapel";13;…;WJ-Beginn;…)
 *   Zeile 2  Spaltenüberschriften
 *   Zeile 3+ Buchungszeilen (semikolongetrennt, Felder optional in "…")
 *
 * Maßgebliche Spalten: Umsatz, Soll/Haben-Kennzeichen, Konto, Gegenkonto,
 * Belegdatum (TTMM), Buchungstext. Das Jahr stammt aus dem Kopfsatz
 * (Wirtschaftsjahresbeginn).
 *
 * parse(text) liefert { buchungen: [{ datum, betrag, soll, haben, text }],
 * jahr } oder { fehler: '…' }.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Datev = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Zerlegt eine DATEV-CSV-Zeile (Trenner ';', Felder optional in "…"). */
  function splitCsv(zeile) {
    var out = [], cur = '', q = false, i, c;
    for (i = 0; i < zeile.length; i++) {
      c = zeile.charAt(i);
      if (q) {
        if (c === '"' && zeile.charAt(i + 1) === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') { q = true; }
      else if (c === ';') { out.push(cur); cur = ''; }
      else { cur += c; }
    }
    out.push(cur);
    return out;
  }

  /* DATEV-Betrag "1.234,56" -> 1234.56 */
  function betragNum(s) {
    var v = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }

  function parse(text) {
    var roh = String(text || '').replace(/^﻿/, '')
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var zeilen = roh.split('\n').filter(function (l) { return l.length > 0; });
    if (!zeilen.length || zeilen[0].indexOf('EXTF') < 0) {
      return { fehler: 'Keine DATEV-EXTF-Datei — die Kopfzeile "EXTF" fehlt.' };
    }
    if (zeilen.length < 3) {
      return { fehler: 'Die Datei enthält keine Buchungszeilen.' };
    }
    /* Jahr aus dem Kopfsatz: erstes 8-stellige Datum 20YYMMDD. */
    var jahr = '';
    splitCsv(zeilen[0]).forEach(function (f) {
      var d = String(f).replace(/\D/g, '');
      if (!jahr && d.length === 8 && d.slice(0, 2) === '20') jahr = d.slice(0, 4);
    });

    var spalten = splitCsv(zeilen[1]).map(function (s) { return s.toLowerCase().trim(); });
    function idx(teil) {
      for (var i = 0; i < spalten.length; i++) {
        if (spalten[i].indexOf(teil) >= 0) return i;
      }
      return -1;
    }
    /* "soll/haben-kennzeichen" - das längere Stück trennt die Spalte sicher von
     * der Umsatzspalte "Umsatz (ohne Soll/Haben-Kz)". */
    var iUms = idx('umsatz'), iSH = idx('soll/haben-kennzeichen'), iKto = idx('konto'),
        iGeg = idx('gegenkonto'), iDat = idx('belegdatum'), iTxt = idx('buchungstext');
    if (iUms < 0 || iKto < 0 || iGeg < 0) {
      return { fehler: 'Die Spalten Umsatz/Konto/Gegenkonto fehlen — kein gültiger ' +
        'DATEV-Buchungsstapel.' };
    }
    var buchungen = [];
    for (var r = 2; r < zeilen.length; r++) {
      var z = splitCsv(zeilen[r]);
      if (z.length < 3) continue;
      var betrag = betragNum(z[iUms]);
      if (!betrag) continue;
      var sh = String(iSH >= 0 ? z[iSH] : 'S').toUpperCase().replace(/[^SH]/g, '') || 'S';
      var konto = String(z[iKto] || '').replace(/\D/g, '');
      var gegen = String(z[iGeg] || '').replace(/\D/g, '');
      if (!konto || !gegen) continue;
      /* Soll/Haben-Kennzeichen bezieht sich auf "Konto". */
      var soll = sh === 'H' ? gegen : konto;
      var haben = sh === 'H' ? konto : gegen;
      var bd = String(iDat >= 0 ? z[iDat] : '').replace(/\D/g, '');
      var datum = (bd.length >= 4 && jahr)
        ? jahr + '-' + bd.slice(2, 4) + '-' + bd.slice(0, 2) : '';
      buchungen.push({
        datum: datum, betrag: Math.round(betrag * 100) / 100,
        soll: soll, haben: haben,
        text: String(iTxt >= 0 ? z[iTxt] : '').trim()
      });
    }
    if (!buchungen.length) {
      return { fehler: 'Keine verwertbaren Buchungszeilen gefunden.' };
    }
    return { buchungen: buchungen, jahr: jahr };
  }

  return { parse: parse, splitCsv: splitCsv };
});
