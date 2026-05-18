/* ===========================================================================
 * ustva.js  -  Umsatzsteuer-Voranmeldung: Kennzahlen-Aufbereitung
 * ---------------------------------------------------------------------------
 * Bereitet die UStVA-Kennzahlen aus den SKR04-USt-Konten eines Zeitraums auf.
 * Eine Aufbereitung, kein ELSTER-Versand.
 *
 * Versteuerungsart (Option .versteuerungsart):
 *   soll - Regelfall (§ 13 UStG): die Umsatzsteuer entsteht mit der
 *          Rechnungsstellung. Erlöse sind zum Rechnungsdatum zu buchen.
 *   ist  - auf Antrag (§ 20 UStG, Vorjahresumsatz <= 800.000 EUR): die
 *          Umsatzsteuer entsteht mit dem Zahlungseingang. Erlöse sind zum
 *          Zahlungsdatum zu buchen.
 *
 * Die Kennzahlen werden in beiden Arten gleich summiert - sie folgen dem
 * Buchungsdatum. Maßgeblich ist daher, dass die Erlöse konsistent zur
 * gewählten Art datiert werden. Bei Ist-Versteuerung weist das Modul auf
 * Erlöse hin, die über ein Forderungskonto gebucht wurden - ein Indiz für
 * eine Buchung zum Rechnungs- statt zum Zahlungsdatum.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ustva = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function cent(v) { return Math.round((Number(v) || 0) * 100) / 100; }

  /* SKR04-Erlöskonten, aus denen die UStVA die steuerpflichtigen Umsätze zieht. */
  var ERLOES_19 = ['4400', '4000'];
  var ERLOES_7  = ['4300'];
  /* SKR04-Forderungskonten (B.II) - Indiz für eine Soll-typische Buchung. */
  var FORDERUNGEN = ['1200', '1240', '1340'];

  function istErloeskonto(nr) {
    return ERLOES_19.indexOf(nr) >= 0 || ERLOES_7.indexOf(nr) >= 0;
  }

  /* berechne(buchungen, von, bis, optionen)
   *   buchungen: [ { datum, soll, haben, betrag } ]
   *   von, bis:  ISO-Datum (einschließend), leer = unbegrenzt
   *   optionen.versteuerungsart: 'soll' (Standard) | 'ist'
   * Rückgabe: { kz81, kz86, ust19, ust7, ustBerechnet, ustGebucht, kz66, kz83,
   *             versteuerungsart, hinweise: [String] } */
  function berechne(buchungen, von, bis, optionen) {
    var opt = optionen || {};
    var art = opt.versteuerungsart === 'ist' ? 'ist' : 'soll';
    var s = {};
    var erloesUeberForderung = 0;
    (buchungen || []).forEach(function (b) {
      if (!b) return;
      var d = b.datum || '';
      if (von && d < von) return;
      if (bis && d > bis) return;
      var betrag = Number(b.betrag) || 0;
      if (b.soll)  { s[b.soll]  = s[b.soll]  || { soll: 0, haben: 0 }; s[b.soll].soll  += betrag; }
      if (b.haben) { s[b.haben] = s[b.haben] || { soll: 0, haben: 0 }; s[b.haben].haben += betrag; }
      /* Erlös (Haben) gebucht gegen eine Forderung (Soll) = typische Soll-Buchung */
      if (b.haben && istErloeskonto(b.haben) && FORDERUNGEN.indexOf(b.soll) >= 0) {
        erloesUeberForderung = cent(erloesUeberForderung + betrag);
      }
    });
    function hs(nr) { var k = s[nr]; return k ? cent(k.haben - k.soll) : 0; }
    function sh(nr) { var k = s[nr]; return k ? cent(k.soll - k.haben) : 0; }

    var kz81 = cent(hs('4400') + hs('4000'));   // Umsätze 19 % (netto)
    var kz86 = hs('4300');                      // Umsätze 7 % (netto)
    var ust19 = cent(kz81 * 0.19);
    var ust7  = cent(kz86 * 0.07);
    var ustBerechnet = cent(ust19 + ust7);
    var ustGebucht = cent(hs('3806') + hs('3801'));
    var kz66 = cent(sh('1406') + sh('1401'));   // abziehbare Vorsteuer

    var hinweise = [];
    if (art === 'ist' && erloesUeberForderung > 0) {
      hinweise.push('Ist-Versteuerung (§ 20 UStG): Im Zeitraum wurden Erlöse von ' +
        erloesUeberForderung.toFixed(2).replace('.', ',') + ' EUR über ein ' +
        'Forderungskonto gebucht. Bei Ist-Versteuerung entsteht die Umsatzsteuer ' +
        'erst mit dem Zahlungseingang - diese Erlöse zum Zahlungsdatum erfassen, ' +
        'nicht zum Rechnungsdatum.');
    }
    return {
      kz81: kz81, kz86: kz86, ust19: ust19, ust7: ust7,
      ustBerechnet: ustBerechnet, ustGebucht: ustGebucht, kz66: kz66,
      kz83: cent(ustBerechnet - kz66),
      versteuerungsart: art, hinweise: hinweise
    };
  }

  return { berechne: berechne, cent: cent,
           ERLOES_19: ERLOES_19, ERLOES_7: ERLOES_7, FORDERUNGEN: FORDERUNGEN };
});
