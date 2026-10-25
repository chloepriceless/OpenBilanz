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

  /* Bearbeiten einer offenen (nicht festgeschriebenen) Buchung.
   * felder: Teilmenge von { datum, betrag, text, soll, haben }.
   * Festgeschriebene Buchungen sind unveraenderlich (§ 146 Abs. 4 AO) - dort
   * bleibt nur die Stornobuchung. Bei einer Stornobuchung muessen Konten und
   * Betrag die Originalbuchung spiegeln; aenderbar sind nur Datum und Text.
   * Alle uebrigen Felder (id, beleg, eRechnungHash, eroeffnung ...) bleiben.
   *
   * Rueckgabe: { ok, fehler[], warnungen[], buchung, aenderungen[{feld, alt, neu}] }
   *   buchung ist eine Kopie; das Original wird nicht veraendert. */
  var BEARBEITBAR = ['datum', 'betrag', 'text', 'soll', 'haben'];

  function bearbeite(alt, felder, kontext) {
    kontext = kontext || {};
    felder = felder || {};
    if (!alt || typeof alt !== 'object') {
      return { ok: false, fehler: ['Buchung fehlt'], warnungen: [], aenderungen: [] };
    }
    if (alt.fest) {
      return { ok: false, warnungen: [], aenderungen: [], fehler: [
        'Buchung ist festgeschrieben - Korrektur nur per Stornobuchung'] };
    }
    var neu = {}, k;
    for (k in alt) if (Object.prototype.hasOwnProperty.call(alt, k)) neu[k] = alt[k];

    var aenderungen = [], f = [];
    BEARBEITBAR.forEach(function (feld) {
      if (!Object.prototype.hasOwnProperty.call(felder, feld)) return;
      var v = felder[feld];
      var gleich;
      if (feld === 'betrag') {
        v = Math.round(+v * 100) / 100;
        gleich = Math.abs(v - (+alt.betrag)) < 0.005;
      } else {
        v = v == null ? '' : String(v);
        gleich = v === String(alt[feld] == null ? '' : alt[feld]);
      }
      if (gleich) return;
      if (alt.stornoVon && feld !== 'datum' && feld !== 'text') {
        f.push('Stornobuchung: Konten und Betrag spiegeln die Originalbuchung ' +
          'und sind nicht aenderbar');
        return;
      }
      aenderungen.push({ feld: feld, alt: alt[feld], neu: v });
      neu[feld] = v;
    });

    // 9000 erlaubt bei Eroeffnungsbuchungen und bei Stornobuchungen: deren Konten
    // sind gesperrt und spiegeln das Original (Storno einer Eroeffnungsbuchung
    // traegt selbst kein eroeffnung-Kennzeichen).
    var pr = pruefe(neu, {
      beginn: kontext.beginn, stichtag: kontext.stichtag,
      erlaubeEbk: kontext.erlaubeEbk || !!alt.eroeffnung || !!alt.stornoVon
    });
    // Doppelte Meldung vermeiden, wenn mehrere gesperrte Felder geaendert wurden
    f = f.filter(function (x, i) { return f.indexOf(x) === i; }).concat(pr.fehler);
    return { ok: f.length === 0, fehler: f, warnungen: pr.warnungen,
      buchung: neu, aenderungen: aenderungen };
  }

  return { pruefe: pruefe, bearbeite: bearbeite };
});
