/* ===========================================================================
 * mt940.js  -  Parser für SWIFT-MT940-Kontoauszüge
 * ---------------------------------------------------------------------------
 * MT940 ist das klassische deutsche Kontoauszugsformat; viele Banken bieten
 * es alternativ oder anstelle von CAMT.053 an. Zeilenbasiertes Textformat mit
 * Feld-Tags (:NN:). Relevant für den Bankimport:
 *   :61: Umsatzzeile (Wertstellung, Soll/Haben, Betrag)
 *   :86: Verwendungszweck / Auftraggeber (strukturiert per ?NN-Subfeldern)
 *
 * parse(text) liefert { tx: [{ datum, betrag, eingang, zweck, partner }] }
 * oder { fehler: '…' } - dieselbe Form wie der CAMT.053-Parser, damit die
 * Import-Vorschau wiederverwendet werden kann.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mt940 = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* YYMMDD -> YYYY-MM-DD (zweistelliges Jahr wird als 20YY gelesen). */
  function isoDatum(yymmdd) {
    if (!/^\d{6}$/.test(yymmdd)) return '';
    return '20' + yymmdd.slice(0, 2) + '-' + yymmdd.slice(2, 4) + '-' + yymmdd.slice(4, 6);
  }

  /* :61: Umsatzzeile - Wertstellung, Soll/Haben-Kennzeichen und Betrag. */
  function parse61(inhalt) {
    var c = inhalt.split('\n')[0];
    var valuta = c.slice(0, 6);
    var rest = c.slice(6);
    /* optionales Buchungsdatum MMDD */
    if (/^\d{4}/.test(rest)) rest = rest.slice(4);
    /* Soll/Haben-Kennzeichen: C, D, RC (Storno Gutschrift), RD (Storno Last). */
    var mk = rest.match(/^(RC|RD|C|D)/);
    var mark = mk ? mk[1] : 'C';
    rest = rest.slice(mark.length);
    /* optionaler Währungs-/Funds-Code (ein Buchstabe) vor dem Betrag */
    if (/^[A-Za-z]/.test(rest)) rest = rest.slice(1);
    var am = rest.match(/^([\d.]*\d,\d{1,2}|\d+)/);
    var betrag = am ? parseFloat(am[1].replace(/\./g, '').replace(',', '.')) : 0;
    return {
      datum: isoDatum(valuta),
      betrag: Math.abs(betrag),
      eingang: mark === 'C' || mark === 'RD',
      zweck: '', partner: ''
    };
  }

  /* :86: Verwendungszweck. Strukturiert: ?20-?29 = Zweck, ?32/?33 = Name. */
  function parse86(inhalt) {
    var c = inhalt.replace(/\n/g, '');
    if (c.indexOf('?') >= 0) {
      var zweck = '', partner = '', re = /\?(\d\d)([^?]*)/g, mm;
      while ((mm = re.exec(c))) {
        var code = parseInt(mm[1], 10);
        if (code >= 20 && code <= 29) zweck += mm[2];
        else if (code === 32 || code === 33) partner += mm[2];
      }
      return { zweck: zweck.trim(), partner: partner.trim() };
    }
    return { zweck: c.trim(), partner: '' };
  }

  function parse(text) {
    var roh = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var bloecke = [], cur = null;
    roh.split('\n').forEach(function (ln) {
      var m = ln.match(/^:(\d{2}[A-Z]?):(.*)$/);
      if (m) { cur = { tag: m[1].replace(/[A-Z]$/, ''), inhalt: m[2] }; bloecke.push(cur); }
      else if (cur && ln !== '-') { cur.inhalt += '\n' + ln; }
    });
    var tx = [], offen = null;
    bloecke.forEach(function (b) {
      if (b.tag === '61') {
        if (offen) tx.push(offen);
        offen = parse61(b.inhalt);
      } else if (b.tag === '86' && offen) {
        var info = parse86(b.inhalt);
        offen.zweck = info.zweck;
        offen.partner = info.partner;
      }
    });
    if (offen) tx.push(offen);
    if (!tx.length) {
      return { fehler: 'Keine Umsätze (:61:) gefunden — ist das eine MT940-Datei?' };
    }
    return { tx: tx };
  }

  return { parse: parse, isoDatum: isoDatum };
});
