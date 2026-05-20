/* ===========================================================================
 * vorlagen.js  -  Buchungsvorlagen (haeufige Geschaeftsvorfaelle als Template)
 * ---------------------------------------------------------------------------
 * Eine Vorlage beschreibt einen wiederkehrenden Buchungsfall mit:
 *   name         Anzeigename, z. B. "Adobe Creative Cloud (monatlich)"
 *   text         Buchungstext (uebernommen in die Buchung)
 *   soll, haben  Konten (SKR04-Nummern)
 *   betrag       optional - Default-Betrag
 *   ustSchluessel optional - "19" | "7" | "0" | "13b" | "ig"
 *
 * pruefe(v) liefert { ok, fehler } - rein syntaktisch (keine Konto-Kataloge).
 * anwenden(v, datum) liefert ein Buchungs-Vorlage-Objekt mit { datum, text,
 * soll, haben, betrag, ustSchluessel }, das in das Erfassungsformular fliesst.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Vorlagen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pruefe(v) {
    var f = [];
    if (!v || typeof v !== 'object') return { ok: false, fehler: ['Vorlage fehlt'] };
    if (!v.name || !String(v.name).trim()) f.push('Name fehlt');
    if (!v.soll || !/^\d{3,6}$/.test(String(v.soll))) f.push('Soll-Konto ungueltig');
    if (!v.haben || !/^\d{3,6}$/.test(String(v.haben))) f.push('Haben-Konto ungueltig');
    if (v.soll === v.haben && v.soll) f.push('Soll und Haben sind identisch');
    if (v.betrag != null && v.betrag !== '') {
      var n = +v.betrag;
      if (!isFinite(n) || n <= 0) f.push('Betrag ungueltig');
    }
    return { ok: f.length === 0, fehler: f };
  }

  function anwenden(v, datum) {
    if (!v) return null;
    return {
      datum: datum || '',
      text: v.text || v.name || '',
      soll: String(v.soll || ''),
      haben: String(v.haben || ''),
      betrag: (v.betrag != null && v.betrag !== '') ? +v.betrag : '',
      ustSchluessel: v.ustSchluessel || ''
    };
  }

  /* Sortiert Vorlagen nach Anzeigename (alphabetisch, de). */
  function sortiert(liste) {
    return (liste || []).slice().sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '', 'de');
    });
  }

  return { pruefe: pruefe, anwenden: anwenden, sortiert: sortiert };
});
