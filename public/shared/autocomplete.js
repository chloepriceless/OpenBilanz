/* ===========================================================================
 * autocomplete.js  -  Konto-Vorschlaege aus dem eigenen Buchungsjournal
 * ---------------------------------------------------------------------------
 * Aus dem bisherigen Journal lernen: wenn "Adobe" frueher 3x auf 6805 gebucht
 * wurde, beim naechsten Mal vorschlagen. Frequency-Count ueber Tokens des
 * Buchungstextes, keine KI, kein Netzzugriff.
 *
 * vorschlaege(text, journal, opts) -> [{ konto, score }]
 *   text     Buchungstext des aktuellen Entwurfs
 *   journal  Array von Buchungen mit { text, soll, haben, storniert? }
 *   opts.feld   'soll' (default) oder 'haben'
 *   opts.k      max. Vorschlaege (default 3)
 *
 * Score = Anzahl Token-Treffer multipliziert mit Auftretens-Haeufigkeit.
 * Stornierte Buchungen werden ignoriert (sie verzerren das Lernen).
 *
 * Reine Funktion - Browser und Node, gut testbar.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Autocomplete = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function tokens(s) {
    if (s == null) return [];
    var t = String(s).toLowerCase().replace(/[^a-z0-9äöüß ]+/g, ' ');
    return t.split(/\s+/).filter(function (x) { return x && x.length >= 3; });
  }

  function vorschlaege(text, journal, opts) {
    opts = opts || {};
    var feld = opts.feld === 'haben' ? 'haben' : 'soll';
    var k = opts.k || 3;
    if (!journal || !journal.length) return [];
    var q = tokens(text);
    if (!q.length) return [];
    var qSet = {};
    for (var i = 0; i < q.length; i++) qSet[q[i]] = true;

    var konten = {}, anyMatch = false;
    for (var j = 0; j < journal.length; j++) {
      var b = journal[j];
      if (!b || b.storniert) continue;
      var konto = String(b[feld] || '');
      if (!konto) continue;
      var bTok = tokens(b.text);
      var match = 0;
      for (var t = 0; t < bTok.length; t++) {
        if (qSet[bTok[t]]) match++;
      }
      if (match > 0) {
        konten[konto] = (konten[konto] || 0) + match;
        anyMatch = true;
      }
    }
    if (!anyMatch) return [];
    var liste = [];
    for (var nr in konten) {
      if (Object.prototype.hasOwnProperty.call(konten, nr)) {
        liste.push({ konto: nr, score: konten[nr] });
      }
    }
    liste.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.konto.localeCompare(b.konto);
    });
    return liste.slice(0, k);
  }

  return { vorschlaege: vorschlaege, _tokens: tokens };
});
