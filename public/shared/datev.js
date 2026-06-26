/* ===========================================================================
 * datev.js  -  DATEV-EXTF-Buchungsstapel: Import (parse) und Export (erzeuge)
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
  var Version = (typeof module !== 'undefined' && module.exports)
    ? require('./version.js') : root.Version;
  var api = factory(Version);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Datev = api;
})(typeof self !== 'undefined' ? self : this, function (Version) {
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

  /* DATEV-Belegdatum TTMM aus einem Datum — toleriert ISO 'YYYY-MM-DD' UND das
   * kompakte 'YYYYMMDD' (das Fallback-Stichtagsdatum liegt kompakt vor). Liefert
   * Leerstring, wenn kein vollständiges Datum vorhanden ist. */
  function ttmmAus(datum) {
    var d = String(datum || '').replace(/\D/g, '');
    if (d.length < 8) return '';
    return d.slice(6, 8) + d.slice(4, 6);
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

  /* Erzeugt einen DATEV-Buchungsstapel im EXTF-Format (CSV, semikolongetrennt):
   * Kopfsatz + Spaltenüberschriften + je Buchung eine Datenzeile (Format
   * Buchungsstapel, Version 13). Spaltenreihenfolge nach DATEV-Format-
   * beschreibung; vor Übergabe an den Steuerberater dessen DATEV-Import
   * gegenprüfen. */
  function erzeuge(a, u) {
    a = a || {}; u = u || {};
    var bu = a.buchungen || [];
    var jahr = String(a.gjBis || a.stichtag || '').slice(0, 4) ||
               String(new Date().getFullYear());
    var wjBeginn = String(a.gjVon || (jahr + '-01-01')).replace(/-/g, '');
    var bis = String(a.gjBis || a.stichtag || (jahr + '-12-31')).replace(/-/g, '');
    function q(s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; }
    function p2(x) { return (x < 10 ? '0' : '') + x; }
    var d = new Date();
    var ts = '' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) +
      p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()) + '000';
    var berater = String(u.datevBeraterNr || '').replace(/\D/g, '');
    var mandant = String(u.datevMandantNr || '').replace(/\D/g, '');
    var kopf = ['"EXTF"', '700', '21', '"Buchungsstapel"', '13', ts, '', '""',
      q('OpenBilanz v' + Version.app), '""', berater, mandant, wjBeginn, '4', wjBeginn, bis,
      q('OpenBilanz ' + (a.bezeichnung || '')), '""', '1', '', '0', '"EUR"',
      '', '', '', '', '', '', '', '', ''].join(';');
    var spalten = ['Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz',
      'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz', 'Konto', 'Gegenkonto', 'BU-Schluessel',
      'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext']
      .map(q).join(';');
    var zeilen = [];
    bu.forEach(function (b) {
      if (!b || !b.betrag) return;
      /* Belegdatum aus der Buchung (ISO), Fallback Wirtschaftsjahr-Ende (kompakt).
       * ttmmAus toleriert beide Formate — ohne das ergäbe das kompakte Fallback
       * ein verstümmeltes Belegdatum (Welle-2-Audit: '23' statt '3112'). */
      var ttmm = ttmmAus(b.datum) || ttmmAus(bis);
      var umsatz = (Math.round(Math.abs(Number(b.betrag)) * 100) / 100).toFixed(2)
        .replace('.', ',');
      zeilen.push([umsatz, '"S"', '"EUR"', '', '', '', b.soll, b.haben, '',
        ttmm, '', '', '', q(String(b.text || '').slice(0, 60))].join(';'));
    });
    return '﻿' + kopf + '\r\n' + spalten + '\r\n' +
      zeilen.join('\r\n') + (zeilen.length ? '\r\n' : '');
  }

  return { parse: parse, splitCsv: splitCsv, erzeuge: erzeuge };
});
