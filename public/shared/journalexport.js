/* ===========================================================================
 * journalexport.js  -  Buchungsjournal als CSV und JSON exportieren
 * ---------------------------------------------------------------------------
 * Maschinenlesbarer Export der Buchungssätze eines Abschlusses:
 *   csv(abschluss)  - Semikolon-CSV mit Kopfzeile, für Tabellenkalkulation.
 *   json(abschluss) - JSON mit Metadaten, für eigene Skripte/Pipelines.
 *
 * Der vollständige maschinenlesbare Datenexport (Unternehmen + alle
 * Abschlüsse) ist die unverschlüsselte .obz-Sicherung - sie ist reines JSON.
 * Aufbau aller Formate: siehe DATENFORMATE.md.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JournalExport = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* CSV-Feld: in "…" einschließen, sobald Sonderzeichen vorkommen. */
  function feld(s) {
    s = String(s == null ? '' : s);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function betrag2(v) {
    return (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
  }

  /* Buchungsjournal als CSV (Semikolon-getrennt, mit Kopfzeile, BOM für Excel). */
  function csv(abschluss) {
    var bu = (abschluss && abschluss.buchungen) || [];
    var zeilen = ['Datum;Soll;Haben;Betrag;Text;Festgeschrieben'];
    bu.forEach(function (b) {
      zeilen.push([
        feld(b.datum), feld(b.soll), feld(b.haben),
        betrag2(b.betrag).replace('.', ','), feld(b.text),
        b.fest ? 'ja' : 'nein'
      ].join(';'));
    });
    return '﻿' + zeilen.join('\r\n') + '\r\n';
  }

  /* Buchungsjournal als JSON mit Metadaten. */
  function json(abschluss) {
    var a = abschluss || {};
    return JSON.stringify({
      format: 'openbilanz-journal',
      version: 1,
      exportiertAm: new Date().toISOString(),
      abschluss: {
        id: a.id || null, bezeichnung: a.bezeichnung || null,
        art: a.art || null, stichtag: a.stichtag || null
      },
      buchungen: (a.buchungen || []).map(function (b) {
        return {
          datum: b.datum || null, soll: b.soll || null, haben: b.haben || null,
          betrag: Math.round((Number(b.betrag) || 0) * 100) / 100,
          text: b.text || '', festgeschrieben: !!b.fest
        };
      })
    }, null, 2);
  }

  return { csv: csv, json: json };
});
