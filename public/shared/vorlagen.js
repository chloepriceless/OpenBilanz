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

  /* --- Wiederkehrende Buchungen ----------------------------------------
   * Vorlage erhaelt optional ein Feld
   *   wiederkehrend: { takt: 'monatlich' | 'quartalsweise' | 'jaehrlich',
   *                    letzteAusfuehrung: 'YYYY-MM-DD' (optional) }
   * Wenn letzteAusfuehrung leer ist, wird die Vorlage ab dem ersten Anwenden
   * faellig - bis dahin ohne Belaestigung.
   */
  var MONATE = { monatlich: 1, quartalsweise: 3, jaehrlich: 12 };

  function iso(d) {
    // toISOString -> 'YYYY-MM-DD'; lokal/UTC unkritisch fuer reine Tagesvergleiche.
    return d.toISOString().slice(0, 10);
  }
  function parseDatum(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    var d = new Date(String(s));
    return isNaN(d.getTime()) ? null : d;
  }

  function naechsteFaelligkeit(vorlage) {
    var w = vorlage && vorlage.wiederkehrend;
    if (!w || !MONATE[w.takt]) return null;
    var ref = parseDatum(w.letzteAusfuehrung);
    if (!ref) {
      // Noch nie ausgefuehrt - faellig "heute" (Aufrufer entscheidet via istFaellig).
      return iso(new Date());
    }
    var d = new Date(ref.getFullYear(), ref.getMonth() + MONATE[w.takt], ref.getDate());
    return iso(d);
  }

  function istFaellig(vorlage, heute) {
    var n = naechsteFaelligkeit(vorlage);
    if (!n) return false;
    var h = heute instanceof Date ? iso(heute)
          : (typeof heute === 'string' && heute ? heute : iso(new Date()));
    return n <= h;
  }

  /* Alle faelligen Vorlagen aus einer Liste, plus naechsterTermin als Info. */
  function faellige(liste, heute) {
    return (liste || []).map(function (v) {
      return { vorlage: v, naechsterTermin: naechsteFaelligkeit(v) };
    }).filter(function (x) { return x.naechsterTermin && istFaellig(x.vorlage, heute); });
  }

  /* Setzt letzteAusfuehrung auf das angegebene Datum (oder heute) und
   * gibt die Vorlage zurueck. Aufrufer ist fuer das Persistieren zustaendig. */
  function markiereAusgefuehrt(vorlage, datum) {
    if (!vorlage) return vorlage;
    if (!vorlage.wiederkehrend) return vorlage;
    var d = parseDatum(datum) || new Date();
    vorlage.wiederkehrend.letzteAusfuehrung = iso(d);
    return vorlage;
  }

  return { pruefe: pruefe, anwenden: anwenden, sortiert: sortiert,
           naechsteFaelligkeit: naechsteFaelligkeit, istFaellig: istFaellig,
           faellige: faellige, markiereAusgefuehrt: markiereAusgefuehrt };
});
