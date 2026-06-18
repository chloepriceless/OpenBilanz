/* ===========================================================================
 * lib/validate.js  -  Validierung der E-Bilanz gegen die amtliche Taxonomie
 * ---------------------------------------------------------------------------
 * Prueft eine erzeugte XBRL-Instanz mit dem XBRL-Validator "Arelle" gegen die
 * amtliche E-Bilanz-Kerntaxonomie. So werden Fehler erkannt, BEVOR die
 * E-Bilanz ans Finanzamt geht.
 *
 * Voraussetzungen (siehe tools/setup-taxonomie.sh und README):
 *   - Arelle:     pip install arelle-release
 *   - Taxonomie:  das amtliche ZIP von esteuer.de / xbrl.de, abgelegt unter
 *                 ./taxonomie/  oder per Umgebungsvariable EBILANZ_TAXONOMIE
 *
 * Ist Arelle oder die Taxonomie nicht vorhanden, liefert das Modul einen
 * klaren Hinweis statt eines Fehlers (das Tool bleibt nutzbar).
 *
 * Auch als CLI nutzbar:  node lib/validate.js <xbrl-datei>
 * ========================================================================= */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');

/* Sucht das Taxonomie-Paket (ZIP) an den üblichen Orten. */
var _taxoCache = null;
function findeTaxonomie() {
  // Einmal gefundenen Pfad cachen -> keine readdirSync-I/O im Request-Pfad bei
  // jeder Validierung (ein Negativ-Ergebnis wird bewusst NICHT gecacht, damit ein
  // spaeter abgelegtes Paket noch gefunden wird).
  if (_taxoCache) return _taxoCache;
  if (process.env.EBILANZ_TAXONOMIE && fs.existsSync(process.env.EBILANZ_TAXONOMIE)) {
    _taxoCache = process.env.EBILANZ_TAXONOMIE;
    return _taxoCache;
  }
  // NUR das projekteigene ./taxonomie durchsuchen — NICHT das world-writable /tmp:
  // ein dort von beliebigen Nutzern abgelegtes ZIP gelangte sonst ueber
  // Arelle --packages in den Validierungslauf (Code-/Pfad-Injektion).
  var ort = path.join(__dirname, '..', 'taxonomie');
  try {
    var dateien = fs.readdirSync(ort).filter(function (f) {
      return /taxonomy.*\.zip$/i.test(f) || /german-gaap.*\.zip$/i.test(f);
    });
    if (dateien.length) { _taxoCache = path.join(ort, dateien.sort().reverse()[0]); return _taxoCache; }
  } catch (e) { /* Ordner existiert nicht */ }
  return null;
}

/* Prueft, ob Arelle (Python) verfuegbar ist. Ergebnis wird gecacht, damit der
 * synchrone Python-Aufruf nicht bei jeder Anfrage den Event-Loop blockiert
 * (Arelle nachinstalliert -> Server neu starten). */
var _arelleCache;
function arelleDa() {
  if (_arelleCache === undefined) {
    try {
      cp.execSync('python3 -c "import arelle"', { stdio: 'ignore' });
      _arelleCache = true;
    } catch (e) { _arelleCache = false; }
  }
  return _arelleCache;
}

/* Parst die Arelle-Ausgabe in strukturierte Befunde. */
function parseArelle(ausgabe) {
  var fehler = [], hinweise = [];
  ausgabe.split(/\r?\n/).forEach(function (z) {
    var m = z.match(/^\[([^\]]*)\]\s*(.*)$/);
    if (!m) return;
    var code = m[1], text = m[2].trim();
    if (!code || code === 'info') { if (text) hinweise.push(text); return; }
    fehler.push({ code: code, text: text });
  });
  return { fehler: fehler, hinweise: hinweise };
}

/* Hauptfunktion. xml = XBRL-Instanz als String. callback(ergebnis). */
function pruefe(xml, callback) {
  var ergebnis = {
    arelleVerfuegbar: arelleDa(),
    taxonomiePaket: findeTaxonomie(),
    ok: null, fehler: [], hinweise: [], warnungen: []
  };

  if (!ergebnis.arelleVerfuegbar) {
    ergebnis.hinweise.push('Arelle ist nicht installiert. Fuer die Validierung gegen die ' +
      'amtliche Taxonomie:  pip install arelle-release');
    return callback(ergebnis);
  }
  if (!ergebnis.taxonomiePaket) {
    ergebnis.hinweise.push('Taxonomie-Paket nicht gefunden. Bitte das amtliche ZIP nach ' +
      './taxonomie/ legen (siehe tools/setup-taxonomie.sh).');
    return callback(ergebnis);
  }

  var tmp = path.join(os.tmpdir(), 'gmbh-ebilanz-' + Date.now() + '-' + process.pid +
    '-' + Math.random().toString(36).slice(2, 8) + '.xml');
  try { fs.writeFileSync(tmp, xml, 'utf8'); }
  catch (e) { ergebnis.hinweise.push('Temporaere Datei nicht schreibbar.'); return callback(ergebnis); }

  var args = ['-m', 'arelle.CntlrCmdLine', '--validate', '--file', tmp,
              '--packages', ergebnis.taxonomiePaket];
  var kind = cp.spawn('python3', args, { timeout: 240000 });
  var aus = '';
  // Einmal-Garantie: 'error' UND 'close' koennen beide feuern (z. B. Spawn-Fehler
  // + anschliessendes close) -> callback duerfte sonst zweimal laufen und im
  // HTTP-Handler 'headers already sent' ausloesen.
  var fertig = false;
  function abschluss() { if (fertig) return; fertig = true; try { fs.unlinkSync(tmp); } catch (x) {} callback(ergebnis); }
  kind.stdout.on('data', function (d) { aus += d; });
  kind.stderr.on('data', function (d) { aus += d; });
  kind.on('error', function (e) {
    ergebnis.hinweise.push('Arelle konnte nicht gestartet werden: ' + e.message);
    abschluss();
  });
  kind.on('close', function () {
    if (fertig) return;
    var p = parseArelle(aus);
    ergebnis.fehler = p.fehler;
    ergebnis.hinweise = ergebnis.hinweise.concat(p.hinweise.filter(function (h) {
      return /package|validated|loaded/i.test(h);
    }));
    ergebnis.ok = p.fehler.length === 0;
    abschluss();
  });
}

module.exports = { pruefe: pruefe, findeTaxonomie: findeTaxonomie,
                   arelleDa: arelleDa, parseArelle: parseArelle };

/* --- CLI ---------------------------------------------------------------- */
if (require.main === module) {
  var datei = process.argv[2];
  if (!datei) { console.error('Aufruf: node lib/validate.js <xbrl-datei>'); process.exit(2); }
  pruefe(fs.readFileSync(datei, 'utf8'), function (e) {
    console.log('Arelle verfuegbar :', e.arelleVerfuegbar);
    console.log('Taxonomie-Paket   :', e.taxonomiePaket || '(nicht gefunden)');
    e.hinweise.forEach(function (h) { console.log('  Hinweis:', h); });
    if (e.ok === true) console.log('\nERGEBNIS: gueltig - keine Beanstandungen.');
    else if (e.ok === false) {
      console.log('\nERGEBNIS: ' + e.fehler.length + ' Beanstandung(en):');
      e.fehler.forEach(function (f) { console.log('  [' + f.code + '] ' + f.text); });
    } else console.log('\nERGEBNIS: nicht geprueft (Voraussetzungen fehlen).');
    process.exit(e.ok === false ? 1 : 0);
  });
}
