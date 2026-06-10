/* ===========================================================================
 * lib/store.js  -  Dateibasierte Persistenz (mandantenfaehig, Welle 7)
 * ---------------------------------------------------------------------------
 * Speichert alle Daten als lesbare JSON-Dateien im Ordner ./data. Seit Welle 7
 * mandantenfaehig (Mehrfirmen):
 *   data/mandanten.json                                 - Index aller Mandanten
 *   data/mandanten/<mandantId>/unternehmen.json         - Stammdaten je Mandant
 *   data/mandanten/<mandantId>/abschluesse/<id>.json    - Abschluesse je Mandant
 *
 * Alle Funktionen nehmen einen optionalen mandantId-Parameter (Default
 * 'standard'). Ohne aktive Mandanten-Auswahl verhaelt sich der Server damit wie
 * vorher einfirmig - nur liegen die Daten unter mandanten/standard/.
 *
 * Beim init() wird ein altes, einfirmiges Layout (data/unternehmen.json +
 * data/abschluesse/) automatisch + verlustfrei nach mandanten/standard/
 * migriert (Pre-Backup, kopieren-nicht-verschieben, Verifikation; siehe
 * lib/mandanten-store-migration.js).
 *
 * Die Daten bleiben vollstaendig lokal. Der Ordner ./data kann mit jedem
 * Backup-Werkzeug gesichert oder mit Git versioniert werden.
 * ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var Migration = require('./mandanten-store-migration.js');
var Transform = require('../public/shared/mandanten-migration.js');

var STANDARD = Transform.STANDARD_ID;            /* 'standard' */
var DATA = path.join(__dirname, '..', 'data');

/* Datenverzeichnis umstellen - primaer fuer Tests (Temp-Dir). */
function setDataDir(dir) { DATA = dir; }
function getDataDir() { return DATA; }

function sicher(id) {
  var s = String(id == null ? '' : id).replace(/[^A-Za-z0-9_.\-]/g, '_');
  /* Pfad-Traversal-Schutz: `sicher()` liefert genau EIN Pfadsegment (Slashes
   * werden zu '_'). Gefaehrlich sind nur reine Punkt-Segmente ('.', '..', ...),
   * die mit path.join aus dem Mandanten-/Abschluss-Verzeichnis ausbrechen
   * wuerden (z.B. mandant='..' -> data/mandanten/.. -> data/). Solche Segmente
   * auf STANDARD zuruecksetzen. Punkte INNERHALB eines Namens (v2.0) bleiben ok. */
  if (!s || /^\.+$/.test(s)) return STANDARD;
  return s;
}
function mandantenIndexDatei() { return path.join(DATA, 'mandanten.json'); }
function mandantDir(mandantId) { return path.join(DATA, 'mandanten', sicher(mandantId)); }
function abschlDir(mandantId) { return path.join(mandantDir(mandantId), 'abschluesse'); }

function leseJSON(datei, fallback) {
  try { return JSON.parse(fs.readFileSync(datei, 'utf8')); }
  catch (e) { return fallback; }
}
function schreibeJSON(datei, obj) {
  /* Atomar: erst Temp-Datei, dann umbenennen (rename ist auf demselben
   * Dateisystem atomar) - ein Absturz laesst die bestehende Datei intakt. */
  var dir = path.dirname(datei);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  var tmp = datei + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, datei);
}

/* ---- Init + Auto-Migration ------------------------------------------- */
function init() {
  if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
  /* Altes einfirmiges Layout -> mandanten/standard/ (idempotent, mit Backup). */
  if (Migration.istAltesLayout(DATA)) {
    Migration.migriereDateiLayout(DATA);
  }
  if (!fs.existsSync(mandantenIndexDatei())) {
    schreibeJSON(mandantenIndexDatei(), []);
  }
}

/* ---- Mandanten-Index ------------------------------------------------- */
function listeMandanten() {
  return leseJSON(mandantenIndexDatei(), []) || [];
}
/* Stellt sicher, dass der Mandant im Index steht (Upsert ohne Ueberschreiben). */
function ensureMandant(mandantId, name) {
  var id = sicher(mandantId);
  var liste = listeMandanten();
  if (liste.some(function (m) { return m && m.id === id; })) return liste;
  liste.push({
    id: id,
    name: name || (id === STANDARD ? 'Standard' : id),
    angelegtAm: new Date().toISOString()
  });
  schreibeJSON(mandantenIndexDatei(), liste);
  return liste;
}
function mandantAnlegen(name, idWunsch) {
  init();
  var id = sicher(idWunsch || name || ('m-' + Date.now()));
  var liste = listeMandanten();
  if (liste.some(function (m) { return m && m.id === id; })) {
    return { ok: false, grund: 'existiert', id: id };
  }
  ensureMandant(id, name);
  if (!fs.existsSync(abschlDir(id))) fs.mkdirSync(abschlDir(id), { recursive: true });
  return { ok: true, id: id, mandanten: listeMandanten() };
}

/* ---- Unternehmen (je Mandant) ---------------------------------------- */
function ladeUnternehmen(mandantId) {
  return leseJSON(path.join(mandantDir(mandantId), 'unternehmen.json'), null);
}
function speichereUnternehmen(obj, mandantId) {
  ensureMandant(mandantId, obj && (obj.name || obj.firma));
  schreibeJSON(path.join(mandantDir(mandantId), 'unternehmen.json'), obj);
  return obj;
}
function loescheUnternehmen(mandantId) {
  var datei = path.join(mandantDir(mandantId), 'unternehmen.json');
  if (fs.existsSync(datei)) { fs.unlinkSync(datei); return true; }
  return false;
}

/* ---- Abschluesse (je Mandant) ---------------------------------------- */
function listeAbschluesse(mandantId) {
  var dir = abschlDir(mandantId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(function (f) { return /\.json$/.test(f); })
    .map(function (f) { return leseJSON(path.join(dir, f), null); })
    .filter(Boolean)
    .sort(function (a, b) { return (a.stichtag || '').localeCompare(b.stichtag || ''); });
}
function ladeAbschluss(id, mandantId) {
  var a = leseJSON(path.join(abschlDir(mandantId), sicher(id) + '.json'), null);
  /* Defensive Quergriff-Sperre (W4, symmetrisch zum Browser): ein Satz mit
   * FREMDER mandantId wird nicht herausgegeben. Alt-Saetze ohne das Feld gelten
   * als passend (kein Bruch bestehender Daten). */
  if (a && a.mandantId && a.mandantId !== sicher(mandantId)) return null;
  return a;
}
function speichereAbschluss(objIn, mandantId) {
  ensureMandant(mandantId);
  /* Klonen statt mutieren (symmetrisch zu store-idb.js) - sonst veraendert
   * der Store still das Objekt des Aufrufers. */
  var obj = JSON.parse(JSON.stringify(objIn || {}));
  if (!obj.id) obj.id = 'A-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  obj.mandantId = sicher(mandantId);   /* W4: mandantId am Satz fuehren (Symmetrie + Quergriff-Sperre) */
  obj.geaendertAm = new Date().toISOString();
  schreibeJSON(path.join(abschlDir(mandantId), sicher(obj.id) + '.json'), obj);
  return obj;
}
function loescheAbschluss(id, mandantId) {
  var datei = path.join(abschlDir(mandantId), sicher(id) + '.json');
  if (fs.existsSync(datei)) { fs.unlinkSync(datei); return true; }
  return false;
}

module.exports = {
  setDataDir: setDataDir,
  getDataDir: getDataDir,
  sicher: sicher,                                  /* exportiert fuer Sicherheits-Tests */
  STANDARD: STANDARD,
  init: init,
  listeMandanten: listeMandanten,
  mandantAnlegen: mandantAnlegen,
  ladeUnternehmen: ladeUnternehmen,
  speichereUnternehmen: speichereUnternehmen,
  loescheUnternehmen: loescheUnternehmen,
  listeAbschluesse: listeAbschluesse,
  ladeAbschluss: ladeAbschluss,
  speichereAbschluss: speichereAbschluss,
  loescheAbschluss: loescheAbschluss
};
