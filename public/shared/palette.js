/* ===========================================================================
 * palette.js  -  Command-Palette: Fuzzy-Suche und Sortierung
 * ---------------------------------------------------------------------------
 * Zero-Dependency-Fuzzy-Match (Subsequence-Score) fuer die Cmd/Ctrl+K-Palette.
 *
 * fuzzy(query, ziel) -> number
 *   >= 0  Match (kleiner ist besser; 0 = lueckenlos und direkt am Anfang)
 *    -1   kein Match (mind. ein Query-Zeichen fehlt im Ziel)
 *
 * suche(eintraege, query, max?) -> filtert und sortiert Eintraege
 *   Ein Eintrag hat mindestens { label } und optional { sub } (Untertitel,
 *   z. B. Kategorie oder Hilfstext). Die Suche prueft beide Felder; der
 *   bessere (kleinere) Score gewinnt. Label-Treffer werden gegenueber
 *   Sub-Treffern bevorzugt (kleiner Bonus).
 *
 * Das Modul liefert keine UI - die uebernimmt app.js (zeigt Eintraege,
 * filtert per suche(), ruft eintrag.aktion() auf).
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Palette = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function fuzzy(query, ziel) {
    if (query == null || query === '') return 0;
    var q = String(query).toLowerCase();
    var z = String(ziel == null ? '' : ziel).toLowerCase();
    var score = 0, letztePos = -1, i, pos;
    for (i = 0; i < q.length; i++) {
      // Whitespace in der Query ignorieren (mehrere Begriffe in einem Feld)
      if (q.charCodeAt(i) === 32) continue;
      pos = z.indexOf(q.charAt(i), letztePos + 1);
      if (pos === -1) return -1;
      score += pos - letztePos - 1;
      letztePos = pos;
    }
    return score;
  }

  function suche(eintraege, query, max) {
    if (!eintraege || !eintraege.length) return [];
    max = max || 30;
    var treffer = [], i, e, sL, sS, s, qLeer = (query == null || query === '');
    for (i = 0; i < eintraege.length; i++) {
      e = eintraege[i];
      if (!e) continue;
      sL = fuzzy(query, e.label);
      sS = e.sub ? fuzzy(query, e.sub) : -1;
      if (sL !== -1 && sS !== -1) s = Math.min(sL, sS + 0.5);
      else if (sL !== -1) s = sL;
      else if (sS !== -1) s = sS + 0.5;
      else continue;
      // Sub-Treffer leicht abwerten -> Label-Match gewinnt bei Gleichstand.
      treffer.push({ eintrag: e, score: s, ordnung: i });
    }
    treffer.sort(function (a, b) {
      if (a.score !== b.score) return a.score - b.score;
      return a.ordnung - b.ordnung;
    });
    // Bei leerer Query alphabetisch nach Label sortiert zurueckgeben.
    if (qLeer) {
      treffer.sort(function (a, b) {
        return (a.eintrag.label || '').localeCompare(b.eintrag.label || '', 'de');
      });
    }
    return treffer.slice(0, max).map(function (t) { return t.eintrag; });
  }

  return { fuzzy: fuzzy, suche: suche };
});
