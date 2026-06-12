/* ===========================================================================
 * version.js  -  Programmversion von OpenBilanz
 * ---------------------------------------------------------------------------
 * AUTOMATISCH ERZEUGT von tools/stamp-version.js - nicht von Hand aendern.
 * Neu erzeugen mit:  npm run stamp   (vor jedem Release).
 *
 * Die Angaben werden in jeden Export (XBRL, DATEV, Journal) geschrieben,
 * damit nachvollziehbar bleibt, welcher Programmstand einen Abschluss
 * erzeugt hat.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Version = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var APP = '2.19.0';
  var COMMIT = '19aa370';
  return {
    app: APP,
    commit: COMMIT,
    /* z. B. "OpenBilanz v2.0.0 (a347259)" - fuer Export-Metadatenzeilen. */
    signatur: function () { return 'OpenBilanz v' + APP + ' (' + COMMIT + ')'; }
  };
});
