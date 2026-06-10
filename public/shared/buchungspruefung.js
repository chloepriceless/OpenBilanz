/* ===========================================================================
 * buchungspruefung.js  -  Plausibilitaet einer einzelnen Buchung
 * ---------------------------------------------------------------------------
 * Schnell-Plausi vor dem Aufnehmen einer Buchung in das Journal:
 *  - Pflichtfelder (Soll, Haben, Datum, Betrag)
 *  - Soll != Haben
 *  - Betrag > 0
 *  - Aufwand/Aufwand und Ertrag/Ertrag - typische Fehlbedienung
 *  - Datum innerhalb des Geschaeftsjahres (sofern kontext.beginn/stichtag gegeben)
 *  - Eroeffnungsbilanzkonto 9000 nur fuer Eroeffnungsbuchungen
 *
 * Rueckgabe: { ok, warnungen[], fehler[] }
 *   fehler -> harte Fehler (Buchung wird zurueckgewiesen)
 *   warnungen -> weiche Hinweise (User bestaetigt im UI)
 *
 * Reine Funktion - testbar in Node und Browser.
 * ========================================================================= */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BuchungsPruefung = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  function ladeSkr04() {
    if (typeof require === 'function') {
      try { return require('./skr04.js'); } catch (e) {}
    }
    return root && root.SKR04 ? root.SKR04 : null;
  }

  function pruefe(b, kontext) {
    kontext = kontext || {};
    var w = [], f = [];
    if (!b || typeof b !== 'object') return { ok: false, fehler: ['Buchung fehlt'], warnungen: [] };

    // Pflichtfelder
    if (!b.soll) f.push('Soll-Konto fehlt');
    if (!b.haben) f.push('Haben-Konto fehlt');
    if (b.soll && b.haben && String(b.soll) === String(b.haben)) {
      f.push('Soll und Haben sind identisch');
    }
    var betrag = +b.betrag;
    if (!isFinite(betrag) || betrag <= 0) f.push('Betrag fehlt oder ist nicht positiv');
    if (!b.datum) w.push('Buchungsdatum fehlt');

    // Konto-Konsistenz: Aufwand/Aufwand und Ertrag/Ertrag sind meist Fehlbuchungen
    var SKR04 = ladeSkr04();
    if (SKR04) {
      var sK = SKR04.kontoFinden(String(b.soll || ''));
      var hK = SKR04.kontoFinden(String(b.haben || ''));
      if (b.soll && !sK) w.push('Soll-Konto ' + b.soll + ' nicht im Kontenrahmen');
      if (b.haben && !hK) w.push('Haben-Konto ' + b.haben + ' nicht im Kontenrahmen');
      if (sK && hK) {
        if (sK.seite === 'AUFWAND' && hK.seite === 'AUFWAND') {
          w.push('Beide Konten sind Aufwandskonten - das ist selten richtig');
        }
        if (sK.seite === 'ERTRAG' && hK.seite === 'ERTRAG') {
          w.push('Beide Konten sind Ertragskonten - das ist selten richtig');
        }
      }
    }

    // Datums-Plausi gegen Geschaeftsjahr
    if (b.datum) {
      if (kontext.stichtag && String(b.datum) > String(kontext.stichtag)) {
        w.push('Buchungsdatum liegt nach dem Bilanzstichtag ' + kontext.stichtag);
      }
      if (kontext.beginn && String(b.datum) < String(kontext.beginn)) {
        w.push('Buchungsdatum liegt vor dem Geschaeftsjahresbeginn ' + kontext.beginn);
      }
    }

    // EBK 9000 nur in Eroeffnungsbuchungen
    var nutztEbk = String(b.soll) === '9000' || String(b.haben) === '9000';
    if (nutztEbk && !kontext.erlaubeEbk) {
      w.push('Konto 9000 (Eroeffnungsbilanzkonto) gehoert nur in Eroeffnungsbuchungen');
    }

    // 2910 (ausstehende Einlagen, nicht eingefordert) fuehrt einen SOLL-Saldo
    // (§ 272 Abs. 1 S. 2 HGB: offene Absetzung vom gezeichneten Kapital). Eine
    // HABEN-Buchung ist nur bei Einforderung/Einzahlung der Einlagen oder als
    // Korrektur richtig - sonst meist eine Verwechslung mit 2900.
    if (String(b.haben) === '2910') {
      w.push('Konto 2910 im Haben: nur richtig, wenn ausstehende Einlagen eingefordert/' +
        'eingezahlt werden (Auflösung der offenen Absetzung) - sonst Buchungsrichtung prüfen');
    }

    return { ok: f.length === 0, fehler: f, warnungen: w };
  }

  return { pruefe: pruefe };
});
