/* ===========================================================================
 * ustva.js  -  Umsatzsteuer-Voranmeldung: Kennzahlen-Aufbereitung
 * ---------------------------------------------------------------------------
 * Bereitet die UStVA-Kennzahlen aus den SKR04-USt-Konten eines Zeitraums auf.
 * Eine Aufbereitung, kein ELSTER-Versand.
 *
 * Versteuerungsart (Option .versteuerungsart):
 *   soll - Regelfall (§ 13 UStG): USt entsteht mit der Rechnungsstellung.
 *   ist  - auf Antrag (§ 20 UStG, Vorjahresumsatz <= 800.000 EUR): USt
 *          entsteht mit dem Zahlungseingang.
 *
 * Sonderfälle (weitere Optionen):
 *   .kleinunternehmer        - § 19 UStG: kein USt-Ausweis, kein Vorsteuerabzug.
 *   .rc13b {netto19,netto7}  - § 13b UStG: Steuerschuldnerschaft des
 *                              Leistungsempfängers (bezogene Leistungen).
 *   .steuerfrei {mitVorsteuer,ohneVorsteuer} - steuerfreie Umsätze § 4 UStG.
 *
 * Die Kennzahlen werden unabhängig von der Versteuerungsart gleich summiert -
 * sie folgen dem Buchungsdatum. Maßgeblich ist daher, dass die Erlöse
 * konsistent zur gewählten Art datiert werden.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ustva = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function cent(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function n(v) { return Number(v) || 0; }

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
   * Rückgabe: { kz81, kz86, ust19, ust7, kz84, kz44, kz48, ustBerechnet,
   *             ustGebucht, kz66, kz83, versteuerungsart, kleinunternehmer,
   *             hinweise: [String] } */
  function berechne(buchungen, von, bis, optionen) {
    var opt = optionen || {};
    var art = opt.versteuerungsart === 'ist' ? 'ist' : 'soll';
    var klein = !!opt.kleinunternehmer;
    var rc = opt.rc13b || {};
    var sf = opt.steuerfrei || {};

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
    var vorsteuerKonten = cent(sh('1406') + sh('1401'));   // abziehbare Vorsteuer

    /* § 13b UStG - Steuerschuldnerschaft des Leistungsempfängers. */
    var kz84 = cent(n(rc.netto19) * 0.19 + n(rc.netto7) * 0.07);
    /* § 4 UStG - steuerfreie Umsätze (rein nachrichtlich). */
    var kz44 = cent(n(sf.mitVorsteuer));    // steuerfrei MIT Vorsteuerabzug
    var kz48 = cent(n(sf.ohneVorsteuer));   // steuerfrei OHNE Vorsteuerabzug

    var hinweise = [];
    var kz66, kz83;
    if (klein) {
      /* § 19 UStG: kein USt-Ausweis, kein Vorsteuerabzug. */
      kz66 = 0;
      kz83 = 0;
      hinweise.push('Kleinunternehmer (§ 19 UStG): Es wird keine Umsatzsteuer ' +
        'ausgewiesen und kein Vorsteuerabzug geltend gemacht; eine ' +
        'Umsatzsteuer-Voranmeldung ist regelmäßig nicht abzugeben. Umsatzgrenze: ' +
        '25.000 EUR (Vorjahr) bzw. 100.000 EUR (laufendes Jahr). Die Kennzahlen ' +
        'dienen nur der Übersicht.');
    } else {
      /* Die nach § 13b geschuldete Steuer ist bei voller Abzugsberechtigung
       * zugleich als Vorsteuer abziehbar. */
      kz66 = cent(vorsteuerKonten + kz84);
      kz83 = cent(ustBerechnet + kz84 - kz66);
      if (art === 'ist' && erloesUeberForderung > 0) {
        hinweise.push('Ist-Versteuerung (§ 20 UStG): Im Zeitraum wurden Erlöse von ' +
          erloesUeberForderung.toFixed(2).replace('.', ',') + ' EUR über ein ' +
          'Forderungskonto gebucht. Bei Ist-Versteuerung entsteht die Umsatzsteuer ' +
          'erst mit dem Zahlungseingang - diese Erlöse zum Zahlungsdatum erfassen, ' +
          'nicht zum Rechnungsdatum.');
      }
      if (kz84 > 0) {
        hinweise.push('§ 13b UStG: Die geschuldete Steuer von ' +
          kz84.toFixed(2).replace('.', ',') + ' EUR wurde als Vorsteuer ' +
          'gegengerechnet (volle Vorsteuerabzugsberechtigung unterstellt). Bei ' +
          'eingeschränktem Vorsteuerabzug ist der Betrag manuell zu kürzen.');
      }
      if (kz48 > 0) {
        hinweise.push('Steuerfreie Umsätze ohne Vorsteuerabzug (§ 4 Nr. 8 ff. UStG, ' +
          'z. B. Vermietung § 4 Nr. 12): Die darauf entfallende Vorsteuer ist nicht ' +
          'abziehbar - bei gemischten Umsätzen ist eine Vorsteueraufteilung nach ' +
          '§ 15 Abs. 4 UStG erforderlich.');
      }
    }
    return {
      kz81: kz81, kz86: kz86, ust19: ust19, ust7: ust7,
      kz84: kz84, kz44: kz44, kz48: kz48,
      ustBerechnet: ustBerechnet, ustGebucht: ustGebucht, kz66: kz66,
      kz83: kz83, vorsteuerKonten: cent(vorsteuerKonten),
      versteuerungsart: art, kleinunternehmer: klein, hinweise: hinweise
    };
  }

  return { berechne: berechne, cent: cent,
           ERLOES_19: ERLOES_19, ERLOES_7: ERLOES_7, FORDERUNGEN: FORDERUNGEN };
});
