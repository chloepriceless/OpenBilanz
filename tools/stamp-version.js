#!/usr/bin/env node
/* ===========================================================================
 * stamp-version.js  -  schreibt public/shared/version.js
 * ---------------------------------------------------------------------------
 * Liest die Version aus package.json und den Git-Kurz-Hash des aktuellen
 * Commits und erzeugt daraus public/shared/version.js. Diese Datei liefert
 * App-Version und Commit-Hash, die in jeden Export (XBRL, DATEV, Journal)
 * geschrieben werden - so bleibt nachvollziehbar, welcher Programmstand einen
 * Abschluss erzeugt hat.
 *
 * VOR JEDEM RELEASE ausfuehren:   npm run stamp
 * (danach version.js mitcommitten und den Versions-Tag v* setzen).
 * ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var app = require('../package.json').version;

var commit = 'unbekannt';
try {
  commit = cp.execSync('git rev-parse --short HEAD',
    { cwd: path.join(__dirname, '..') }).toString().trim();
} catch (e) {
  /* Kein Git-Checkout (z. B. aus einem ZIP entpackt) - Commit bleibt 'unbekannt'. */
}

var inhalt = [
  '/* ===========================================================================',
  ' * version.js  -  Programmversion von OpenBilanz',
  ' * ---------------------------------------------------------------------------',
  ' * AUTOMATISCH ERZEUGT von tools/stamp-version.js - nicht von Hand aendern.',
  ' * Neu erzeugen mit:  npm run stamp   (vor jedem Release).',
  ' *',
  ' * Die Angaben werden in jeden Export (XBRL, DATEV, Journal) geschrieben,',
  ' * damit nachvollziehbar bleibt, welcher Programmstand einen Abschluss',
  ' * erzeugt hat.',
  ' * ========================================================================= */',
  '(function (root, factory) {',
  '  var api = factory();',
  "  if (typeof module !== 'undefined' && module.exports) module.exports = api;",
  '  else root.Version = api;',
  "})(typeof self !== 'undefined' ? self : this, function () {",
  "  'use strict';",
  "  var APP = '" + app + "';",
  "  var COMMIT = '" + commit + "';",
  '  return {',
  '    app: APP,',
  '    commit: COMMIT,',
  '    /* z. B. "OpenBilanz v2.0.0 (a347259)" - fuer Export-Metadatenzeilen. */',
  "    signatur: function () { return 'OpenBilanz v' + APP + ' (' + COMMIT + ')'; }",
  '  };',
  '});',
  ''
].join('\n');

var ziel = path.join(__dirname, '..', 'public', 'shared', 'version.js');
fs.writeFileSync(ziel, inhalt);
console.log('version.js gestempelt:  OpenBilanz v' + app + ' (' + commit + ')');
