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
function findeTaxonomie() {
  if (process.env.EBILANZ_TAXONOMIE && fs.existsSync(process.env.EBILANZ_TAXONOMIE)) {
    return process.env.EBILANZ_TAXONOMIE;
  }
  var orte = [path.join(__dirname, '..', 'taxonomie'), '/tmp'];
  for (var i = 0; i < orte.length; i++) {
    try {
      var dateien = fs.readdirSync(orte[i]).filter(function (f) {
        return /taxonomy.*\.zip$/i.test(f) || /german-gaap.*\.zip$/i.test(f);
      });
      if (dateien.length) return path.join(orte[i], dateien.sort().reverse()[0]);
    } catch (e) { /* Ordner existiert nicht */ }
  }
  return null;
}

/* Prueft, ob Arelle (Python) verfuegbar ist. */
function arelleDa() {
  try {
    cp.execSync('python3 -c "import arelle"', { stdio: 'ignore' });
    return true;
  } catch (e) { return false; }
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

  var tmp = path.join(os.tmpdir(), 'gmbh-ebilanz-' + Date.now() + '.xml');
  try { fs.writeFileSync(tmp, xml, 'utf8'); }
  catch (e) { ergebnis.hinweise.push('Temporaere Datei nicht schreibbar.'); return callback(ergebnis); }

  var args = ['-m', 'arelle.CntlrCmdLine', '--validate', '--file', tmp,
              '--packages', ergebnis.taxonomiePaket];
  var kind = cp.spawn('python3', args, { timeout: 240000 });
  var aus = '';
  kind.stdout.on('data', function (d) { aus += d; });
  kind.stderr.on('data', function (d) { aus += d; });
  kind.on('error', function (e) {
    try { fs.unlinkSync(tmp); } catch (x) {}
    ergebnis.hinweise.push('Arelle konnte nicht gestartet werden: ' + e.message);
    callback(ergebnis);
  });
  kind.on('close', function () {
    try { fs.unlinkSync(tmp); } catch (x) {}
    var p = parseArelle(aus);
    ergebnis.fehler = p.fehler;
    ergebnis.hinweise = ergebnis.hinweise.concat(p.hinweise.filter(function (h) {
      return /package|validated|loaded/i.test(h);
    }));
    ergebnis.ok = p.fehler.length === 0;
    callback(ergebnis);
  });
}

module.exports = { pruefe: pruefe, findeTaxonomie: findeTaxonomie, arelleDa: arelleDa };

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
