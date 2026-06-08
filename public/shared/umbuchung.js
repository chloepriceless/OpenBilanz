/* ===========================================================================
 * umbuchung.js  -  Geführte Umbuchung zwischen eigenen Geldkonten
 * ---------------------------------------------------------------------------
 * Erzeugt aus einer laienverständlichen Eingabe ("von Konto -> nach Konto +
 * Betrag") den/die korrekten Buchungssatz/-sätze, ohne dass der Nutzer die
 * Begriffe Soll/Haben kennen muss. Reine Logik (Node + Browser), testbar.
 *
 * Buchungssemantik (durch die doppelte Buchführung determiniert):
 *   Geld fließt von der QUELLE zum ZIEL. Beide sind Aktivkonten (Bank/Kasse).
 *   - Direkt (1 Satz):  Soll = Ziel (wächst), Haben = Quelle (schrumpft).
 *       z.B. "Bank B an Bank A": Soll B / Haben A.
 *   - Über Geldtransit (2 Sätze, Konto 1460): nützlich, wenn die Überweisung
 *     getrennt auf beiden Kontoauszügen erscheint (Wertstellung an verschiedenen
 *     Tagen) - so passt jede Auszugszeile zu genau einer Buchung und 1460 nettet
 *     am Ende auf 0:
 *       (1) Soll 1460  / Haben Quelle   (Geld verlässt die Quelle in den Transit)
 *       (2) Soll Ziel  / Haben 1460     (Geld erreicht das Ziel aus dem Transit)
 * ========================================================================= */
(function (root, factory) {
  var api = factory(
    typeof require === 'function' ? require('./berechnung.js') : root.Berechnung
  );
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Umbuchung = api;
})(typeof self !== 'undefined' ? self : this, function (Berechnung) {
  'use strict';

  /* p: { von, nach, betrag, datum, text, ueberTransit, transitKonto, stamp }
   * Rückgabe: { ok, fehler:[...], buchungen:[{id,datum,betrag,text,soll,haben}] } */
  function buchungen(p) {
    p = p || {};
    var von = String(p.von == null ? '' : p.von).trim();
    var nach = String(p.nach == null ? '' : p.nach).trim();
    var betrag = Berechnung.cent(p.betrag);
    var fehler = [];
    if (!von) fehler.push('Quell-Konto (von) fehlt.');
    if (!nach) fehler.push('Ziel-Konto (nach) fehlt.');
    if (von && nach && von === nach) fehler.push('Quell- und Ziel-Konto sind identisch.');
    if (!(betrag > 0)) fehler.push('Der Betrag muss größer als 0,00 EUR sein.');
    if (fehler.length) return { ok: false, fehler: fehler, buchungen: [] };

    var transit = String(p.transitKonto || '1460').trim() || '1460';
    var datum = p.datum || '';
    var text = (p.text != null && String(p.text).trim())
      ? String(p.text).trim()
      : ('Umbuchung ' + von + ' → ' + nach);
    var stamp = p.stamp || 0;
    var bu;
    if (p.ueberTransit) {
      bu = [
        { id: 'B-UMB-' + stamp + '-0', datum: datum, betrag: betrag, text: text,
          soll: transit, haben: von },
        { id: 'B-UMB-' + stamp + '-1', datum: datum, betrag: betrag, text: text,
          soll: nach, haben: transit }
      ];
    } else {
      bu = [
        { id: 'B-UMB-' + stamp + '-0', datum: datum, betrag: betrag, text: text,
          soll: nach, haben: von }
      ];
    }
    return { ok: true, fehler: [], buchungen: bu };
  }

  return { buchungen: buchungen };
});
