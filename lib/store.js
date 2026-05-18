/* ===========================================================================
 * lib/store.js  -  Dateibasierte Persistenz
 * ---------------------------------------------------------------------------
 * Speichert alle Daten als lesbare JSON-Dateien im Ordner ./data:
 *   data/unternehmen.json          - Stammdaten der GmbH
 *   data/abschluesse/<id>.json     - je ein Abschluss (Eröffnungsbilanz/JA)
 *
 * Die Daten bleiben vollständig lokal. Der Ordner ./data kann mit jedem
 * Backup-Werkzeug gesichert oder mit Git versioniert werden — Git hält dann
 * eine nachvollziehbare Änderungshistorie der Buchführung fest.
 * ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');

var DATA = path.join(__dirname, '..', 'data');
var ABSCHL = path.join(DATA, 'abschluesse');

function init() {
  if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
  if (!fs.existsSync(ABSCHL)) fs.mkdirSync(ABSCHL, { recursive: true });
}
function leseJSON(datei, fallback) {
  try { return JSON.parse(fs.readFileSync(datei, 'utf8')); }
  catch (e) { return fallback; }
}
function schreibeJSON(datei, obj) {
  init();
  /* Atomar schreiben: erst in eine temporaere Datei, dann umbenennen. Ein
   * Absturz waehrend des Schreibens laesst so die bestehende Datei intakt,
   * statt eine halb geschriebene (und beim Lesen still als null verworfene)
   * JSON-Datei zu hinterlassen. rename ist auf demselben Dateisystem atomar. */
  var tmp = datei + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, datei);
}

function ladeUnternehmen() {
  return leseJSON(path.join(DATA, 'unternehmen.json'), null);
}
function speichereUnternehmen(obj) {
  schreibeJSON(path.join(DATA, 'unternehmen.json'), obj);
  return obj;
}

function listeAbschluesse() {
  init();
  return fs.readdirSync(ABSCHL)
    .filter(function (f) { return /\.json$/.test(f); })
    .map(function (f) { return leseJSON(path.join(ABSCHL, f), null); })
    .filter(Boolean)
    .sort(function (a, b) { return (a.stichtag || '').localeCompare(b.stichtag || ''); });
}
function ladeAbschluss(id) {
  return leseJSON(path.join(ABSCHL, sicher(id) + '.json'), null);
}
function speichereAbschluss(obj) {
  if (!obj.id) obj.id = 'A-' + Date.now();
  obj.geaendertAm = new Date().toISOString();
  schreibeJSON(path.join(ABSCHL, sicher(obj.id) + '.json'), obj);
  return obj;
}
function loescheAbschluss(id) {
  var datei = path.join(ABSCHL, sicher(id) + '.json');
  if (fs.existsSync(datei)) { fs.unlinkSync(datei); return true; }
  return false;
}
function loescheUnternehmen() {
  var datei = path.join(DATA, 'unternehmen.json');
  if (fs.existsSync(datei)) { fs.unlinkSync(datei); return true; }
  return false;
}
function sicher(id) { return String(id).replace(/[^A-Za-z0-9_.\-]/g, '_'); }

module.exports = {
  DATA: DATA,
  init: init,
  ladeUnternehmen: ladeUnternehmen,
  speichereUnternehmen: speichereUnternehmen,
  loescheUnternehmen: loescheUnternehmen,
  listeAbschluesse: listeAbschluesse,
  ladeAbschluss: ladeAbschluss,
  speichereAbschluss: speichereAbschluss,
  loescheAbschluss: loescheAbschluss
};
