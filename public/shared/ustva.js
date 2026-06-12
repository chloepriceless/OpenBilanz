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
 *                              § 13b-Steuer wird trotzdem geschuldet und ist
 *                              insoweit voranzumelden (§ 18 Abs. 4a UStG).
 *   .rc13b {netto19,netto7}  - § 13b UStG, MANUELL erfasste Leistungsbezüge
 *                              (Drittland/Bauleistungen -> Kz 84/85).
 *   .gebucht13b {drittlandNetto} - Drittlands-/Bauleistungsanteil der GEBUCHTEN
 *                              § 13b-Beträge (3837/1407): wird von Kz 46/47
 *                              nach Kz 84/85 umgegliedert.
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
    var geb = opt.gebucht13b || {};
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

    /* § 13b UStG - Steuerschuldnerschaft des Leistungsempfängers.
     * Amtliche Kennzahlen-Semantik (UStVA-Vordruck):
     *   Kz 46/47 = sonstige Leistungen nach § 3a Abs. 2 UStG EU-ansässiger
     *              Unternehmer (§ 13b Abs. 1) - Kz 46 Bemessungsgrundlage,
     *              Kz 47 Steuer.
     *   Kz 84/85 = andere § 13b-Leistungen (§ 13b Abs. 2: Bauleistungen,
     *              Drittlands-Leistende) - Kz 84 Bemessungsgrundlage, Kz 85 Steuer.
     *   Kz 67    = die als Vorsteuer abziehbare § 13b-Steuer (getrennt von Kz 66).
     * GEBUCHTE § 13b-Beträge (3837 USt / 1407 VSt, je 19 %) fließen automatisch
     * ein: 3837 nach Kz 47 (EU-Regelfall, z. B. Auslands-SaaS aus dem
     * Gemeinschaftsgebiet); die Bemessungsgrundlage (Kz 46) wird aus der Steuer
     * rückgerechnet (kann durch Rundung der Einzelbuchungen um Cents von der
     * echten BMG abweichen - ELSTER nimmt volle Euro). Der Drittlands-/
     * Bauleistungsanteil der gebuchten Beträge wird über gebucht13b.drittlandNetto
     * nach Kz 84/85 umgegliedert; die Zahllast ist gegen die Aufteilung invariant. */
    var ust13bGebucht = hs('3837');           // USt nach § 13b 19 % (gebucht)
    var vst13bGebucht = sh('1407');           // abziehbare VSt nach § 13b 19 % (gebucht)
    var drittNetto = n(geb.drittlandNetto);
    var drittSteuer = cent(drittNetto * 0.19);
    var manuellSteuer = cent(n(rc.netto19) * 0.19 + n(rc.netto7) * 0.07);
    var kz47 = cent(ust13bGebucht - drittSteuer);
    var kz46 = cent(kz47 / 0.19);
    var kz84 = cent(n(rc.netto19) + n(rc.netto7) + drittNetto);
    var kz85 = cent(manuellSteuer + drittSteuer);
    /* § 4 UStG - steuerfreie Umsätze (rein nachrichtlich). */
    var kz44 = cent(n(sf.mitVorsteuer));    // steuerfrei MIT Vorsteuerabzug
    var kz48 = cent(n(sf.ohneVorsteuer));   // steuerfrei OHNE Vorsteuerabzug
    /* Kz 45 - übrige nicht steuerbare Umsätze (Leistungsort nicht im Inland):
     * 4338 (Drittland) + 4339 (anderes EU-Land, kein § 3a-Abs.-2-Fall).
     * Die EU-B2B-Leistungen nach § 3a Abs. 2 (Konto 4336) gehören dagegen in
     * Kz 21 + Zusammenfassende Meldung - nur Hinweis, keine Automatik. */
    var kz45 = cent(hs('4338') + hs('4339'));

    var hinweise = [];
    var kz66, kz67, kz83;
    if (klein) {
      /* § 19 UStG: kein USt-Ausweis, kein Vorsteuerabzug. ABER: die § 13b-Steuer
       * wird auch vom Kleinunternehmer geschuldet und ist insoweit voranzumelden
       * (§ 19 Abs. 1 lässt § 18 Abs. 4a UStG ausdrücklich unberührt; § 18 Abs. 4a
       * nennt die § 13b Abs. 5-Schuldner). Ein Vorsteuerabzug besteht mangels
       * steuerpflichtiger Ausgangsumsätze nicht (§ 15 Abs. 2 UStG). */
      kz66 = 0;
      kz67 = 0;
      kz83 = cent(kz85 + kz47);
      hinweise.push('Kleinunternehmer (§ 19 UStG): Es wird keine Umsatzsteuer ' +
        'ausgewiesen und kein Vorsteuerabzug geltend gemacht; eine ' +
        'Umsatzsteuer-Voranmeldung ist regelmäßig nicht abzugeben. Umsatzgrenze: ' +
        '25.000 EUR (Vorjahr) bzw. 100.000 EUR (laufendes Jahr). Die Kennzahlen ' +
        'dienen nur der Übersicht.');
      if (kz83 > 0 || vst13bGebucht > 0) {
        hinweise.push('Ausnahme § 13b UStG: Die Steuer auf bezogene § 13b-Leistungen (' +
          cent(kz85 + kz47).toFixed(2).replace('.', ',') + ' EUR, Kz 47/85) wird auch ' +
          'als Kleinunternehmer geschuldet - die Voranmeldung ist insoweit abzugeben ' +
          '(§ 18 Abs. 4a UStG). Die auf Konto 1407 gebuchte Vorsteuer ist NICHT ' +
          'abziehbar (§ 15 Abs. 2 UStG).');
      }
    } else {
      /* Kz 67 = § 13b-Vorsteuer, getrennt von Kz 66 (nur allgemeine Vorsteuer
       * aus Eingangsrechnungen): die tatsächlich GEBUCHTE 1407-Vorsteuer plus -
       * für die manuell erfassten Leistungen ohne Buchung - deren Steuer bei
       * unterstellter voller Abzugsberechtigung. */
      kz66 = cent(vorsteuerKonten);
      kz67 = cent(manuellSteuer + vst13bGebucht);
      kz83 = cent(ustBerechnet + kz85 + kz47 - kz66 - kz67);
      if (art === 'ist' && erloesUeberForderung > 0) {
        hinweise.push('Ist-Versteuerung (§ 20 UStG): Im Zeitraum wurden Erlöse von ' +
          erloesUeberForderung.toFixed(2).replace('.', ',') + ' EUR über ein ' +
          'Forderungskonto gebucht. Bei Ist-Versteuerung entsteht die Umsatzsteuer ' +
          'erst mit dem Zahlungseingang - diese Erlöse zum Zahlungsdatum erfassen, ' +
          'nicht zum Rechnungsdatum.');
      }
      if (manuellSteuer > 0) {
        hinweise.push('§ 13b UStG (manuell erfasst): Die Steuer von ' +
          manuellSteuer.toFixed(2).replace('.', ',') + ' EUR auf die manuell ' +
          'eingetragenen Leistungen wurde als Vorsteuer (Kz 67) gegengerechnet ' +
          '(volle Vorsteuerabzugsberechtigung unterstellt). Bei eingeschränktem ' +
          'Vorsteuerabzug ist der Betrag manuell zu kürzen.');
      }
      if ((ust13bGebucht !== 0 || vst13bGebucht !== 0) &&
          Math.abs(vst13bGebucht - ust13bGebucht) > 0.005) {
        hinweise.push('§ 13b UStG: Die gebuchte Vorsteuer (Konto 1407: ' +
          vst13bGebucht.toFixed(2).replace('.', ',') + ' EUR) weicht von der ' +
          'gebuchten Steuer (Konto 3837: ' + ust13bGebucht.toFixed(2).replace('.', ',') +
          ' EUR) ab. Das ist nur bei eingeschränktem Vorsteuerabzug richtig - ' +
          'sonst Buchungen prüfen (beide Seiten gehören paarweise gebucht).');
      }
      if (kz48 > 0) {
        hinweise.push('Steuerfreie Umsätze ohne Vorsteuerabzug (§ 4 Nr. 8 ff. UStG, ' +
          'z. B. Vermietung § 4 Nr. 12): Die darauf entfallende Vorsteuer ist nicht ' +
          'abziehbar - bei gemischten Umsätzen ist eine Vorsteueraufteilung nach ' +
          '§ 15 Abs. 4 UStG erforderlich.');
      }
    }
    /* Plausi-Hinweise unabhängig von der Besteuerungsform. */
    if (ust13bGebucht !== 0 && (n(rc.netto19) !== 0 || n(rc.netto7) !== 0)) {
      hinweise.push('Achtung, mögliche Doppelerfassung: Auf Konto 3837 sind § 13b-' +
        'Beträge GEBUCHT und zusätzlich sind manuelle § 13b-Leistungen eingetragen. ' +
        'Die manuellen Felder sind nur für Leistungen gedacht, die NICHT gebucht ' +
        'wurden - sonst erscheint dieselbe Leistung doppelt in der Voranmeldung.');
    }
    if (drittSteuer > ust13bGebucht) {
      hinweise.push('Die Drittland-Aufteilung (' + drittNetto.toFixed(2).replace('.', ',') +
        ' EUR netto = ' + drittSteuer.toFixed(2).replace('.', ',') + ' EUR Steuer) ist ' +
        'größer als die auf Konto 3837 gebuchte § 13b-Steuer (' +
        ust13bGebucht.toFixed(2).replace('.', ',') + ' EUR) - Eingabe prüfen.');
    }
    if (hs('3835') !== 0 || sh('1408') !== 0) {
      hinweise.push('Die generischen § 13b-Konten 3835/1408 (ohne Steuersatz) sind ' +
        'bebucht - sie können keiner Vordruckzeile automatisch zugeordnet werden. ' +
        'Auf 3837/1407 (19 %) umbuchen oder die Beträge manuell erfassen.');
    }
    if (hs('4336') !== 0) {
      hinweise.push('Erlöse auf Konto 4336 (sonstige Leistungen nach § 3a Abs. 2 UStG ' +
        'an EU-Unternehmer): gehören in Kz 21 und in die Zusammenfassende Meldung ' +
        '(§§ 18a, 18b UStG) - hier nicht automatisch ausgewiesen.');
    }
    if (hs('4339') !== 0) {
      hinweise.push('Erlöse auf Konto 4339 (im anderen EU-Land steuerbar) sind in ' +
        'Kz 45 enthalten. Werden diese Umsätze über das OSS-Verfahren erklärt, ' +
        'gehören sie nicht in die Voranmeldung - Kz 45 dann manuell kürzen.');
    }
    return {
      kz81: kz81, kz86: kz86, ust19: ust19, ust7: ust7,
      kz45: kz45, kz46: kz46, kz47: kz47,
      kz84: kz84, kz85: kz85, kz44: kz44, kz48: kz48,
      ust13bGebucht: ust13bGebucht, vst13bGebucht: vst13bGebucht,
      ustBerechnet: ustBerechnet, ustGebucht: ustGebucht,
      kz66: kz66, kz67: kz67,
      kz83: kz83, vorsteuerKonten: cent(vorsteuerKonten),
      versteuerungsart: art, kleinunternehmer: klein, hinweise: hinweise
    };
  }

  return { berechne: berechne, cent: cent,
           ERLOES_19: ERLOES_19, ERLOES_7: ERLOES_7, FORDERUNGEN: FORDERUNGEN };
});
