/* ===========================================================================
 * fx.js  -  Fremdwährungs-Stichtagsbewertung (§ 256a HGB)
 * ---------------------------------------------------------------------------
 * Bewertung von Vermögensgegenständen und Schulden in fremder Währung am
 * Bilanzstichtag.
 *
 * Regelwerk (§ 256a HGB):
 *  - Vermögensgegenstände und Schulden mit Restlaufzeit <= 1 Jahr werden ZWINGEND
 *    zum Devisenkassamittelkurs am Stichtag umgerechnet (§ 256a Satz 2 HGB).
 *    Das Realisations- und Imparitätsprinzip wird hier ausser Kraft gesetzt -
 *    es darf sowohl aufgewertet als auch abgewertet werden.
 *  - Bei Restlaufzeit > 1 Jahr greifen die allgemeinen Bewertungsprinzipien
 *    (§ 252 HGB):
 *      Vermoegen: Niederstwertprinzip - der niedrigere Wert von Anschaffungs-
 *                 kurs und Stichtagskurs ist anzusetzen (keine Aufwertung
 *                 über die Anschaffungskosten hinaus).
 *      Schulden:  Höchstwertprinzip - der höhere Wert von Entstehungs- und
 *                 Stichtagskurs ist anzusetzen (keine Abwertung unter den
 *                 Entstehungswert).
 *
 * Eingabe in EUR ueber den jeweiligen Kurs:
 *   buchwertEur:  bisheriger Buchwert in EUR (Anschaffungskurs oder Vorperiode)
 *   fwBetrag:     Betrag in der Fremdwaehrung
 *   kursStichtag: Devisenkassamittelkurs am Stichtag (Einheit: 1 FW = x EUR)
 *
 * Ergebnis:
 *   stichtagswertEur:  der nach § 256a anzusetzende Wert in EUR
 *   delta:             Differenz stichtagswertEur - buchwertEur (reine Wertaenderung)
 *   guvWirkung:        GuV-wirksamer Betrag: > 0 Ertrag, < 0 Aufwand, = 0 keine
 *                       Buchung. Bei Schulden gegenlaeufig zu delta (ein Anstieg
 *                       der Schuld ist Aufwand, ein Rueckgang Ertrag).
 *   regel:            'kurzfristig' | 'langfristig-niederstwert'
 *                       | 'langfristig-hoechstwert' | 'unveraendert' | 'kurs-fehlt'
 *   begruendung:      kurzer Begruendungssatz fuer das Buchungsjournal
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Fx = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function rd(n) { return Math.round(n * 100) / 100; }

  /* art: 'vermoegen' | 'schulden' (Forderung/Bank/WP = vermoegen;
   *      Darlehen/Verbindlichkeit = schulden)
   * restlaufzeitMonate: ganze Monate bis zur erwarteten Faelligkeit
   */
  function stichtagsbewertung(opts) {
    var o = opts || {};
    var art = o.art === 'schulden' ? 'schulden' : 'vermoegen';
    var buchwert = +o.buchwertEur || 0;
    var fw = +o.fwBetrag || 0;
    var kurs = +o.kursStichtag || 0;
    var monate = +o.restlaufzeitMonate;
    if (!isFinite(monate)) monate = 0;
    var stichtagsWertVoll = rd(fw * kurs);

    // Ohne gueltigen Stichtagskurs KEINE Bewertung erzwingen: mit kurs <= 0 waere
    // stichtagsWertVoll 0, und der kurzfristige Zweig schriebe den gesamten
    // Buchwert auf 0 ab. Buchwert unveraendert lassen + das fehlende Datum melden.
    if (!(kurs > 0)) {
      return {
        stichtagswertEur: rd(buchwert), delta: 0, guvWirkung: 0,
        regel: 'kurs-fehlt',
        begruendung: 'Kein gueltiger Devisenkassamittelkurs am Stichtag ' +
          'angegeben - keine Umrechnung vorgenommen.'
      };
    }

    var kurzfristig = monate <= 12;
    var wert, regel, begr;

    if (kurzfristig) {
      // § 256a Satz 2: zwingend zum Stichtagskurs, unabhaengig von Auf- oder
      // Abwertung. Realisations-/Imparitaetsprinzip ist ausgesetzt.
      wert = stichtagsWertVoll;
      regel = 'kurzfristig';
      begr = '§ 256a Satz 2 HGB - Restlaufzeit <= 1 Jahr: Bewertung zum ' +
        'Devisenkassamittelkurs am Stichtag.';
    } else if (art === 'vermoegen') {
      // § 252 i. V. m. § 253 HGB - Niederstwertprinzip: nur abwerten, nicht
      // ueber die Anschaffungskosten aufwerten.
      if (stichtagsWertVoll < buchwert) {
        wert = stichtagsWertVoll;
        regel = 'langfristig-niederstwert';
        begr = '§ 253 HGB Niederstwertprinzip: Kurswert unter Buchwert - ' +
          'Abwertung zum niedrigeren Stichtagswert.';
      } else {
        wert = buchwert;
        regel = 'unveraendert';
        begr = '§ 252 HGB Realisationsprinzip: keine Aufwertung ueber den ' +
          'Buchwert (Restlaufzeit > 1 Jahr).';
      }
    } else {
      // schulden: Hoechstwertprinzip - nur aufwerten, nicht abwerten.
      if (stichtagsWertVoll > buchwert) {
        wert = stichtagsWertVoll;
        regel = 'langfristig-hoechstwert';
        begr = '§ 252 HGB Imparitaetsprinzip: Schuld zum hoeheren Stichtags' +
          'wert (drohender Aufwand antizipieren).';
      } else {
        wert = buchwert;
        regel = 'unveraendert';
        begr = '§ 252 HGB: keine Abwertung der Schuld unter den Entstehungs' +
          'wert (Restlaufzeit > 1 Jahr).';
      }
    }

    var delta = rd(wert - buchwert);
    // Bei einer Schuld kehrt sich das Vorzeichen der GuV-Wirkung um:
    // ein Anstieg der Schuld ist Aufwand, ein Rueckgang ist Ertrag.
    var guvWirkung = art === 'schulden' ? -delta : delta;

    return {
      stichtagswertEur: rd(wert),
      delta: delta,
      guvWirkung: rd(guvWirkung),
      regel: regel,
      begruendung: begr
    };
  }

  return { stichtagsbewertung: stichtagsbewertung };
});
