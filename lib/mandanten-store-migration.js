/* ===========================================================================
 * lib/mandanten-store-migration.js  -  Server-Dateilayout: einfirmig -> Mandanten
 * ---------------------------------------------------------------------------
 * Migriert das dateibasierte Layout (Selbst-Hosting) von
 *   data/unternehmen.json , data/abschluesse/<id>.json        (einfirmig)
 * auf
 *   data/mandanten.json (Index)
 *   data/mandanten/<mandantId>/unternehmen.json
 *   data/mandanten/<mandantId>/abschluesse/<id>.json
 *
 * Sicherheitsauflagen (Hub-Refute, Auflage 3):
 *   - ZWINGEND Pre-Backup nach data/.backup-pre-mandanten-<ts>/ VOR der ersten
 *     Schreiboperation.
 *   - KOPIEREN statt verschieben; die Originaldateien bleiben unangetastet
 *     (doppelte Absicherung, voll reversibel). Re-Lauf wird durch die Existenz
 *     von data/mandanten/ verhindert (idempotent).
 *   - Verifikation nach dem Kopieren (Anzahl + Parsebarkeit) BEVOR der Lauf als
 *     erfolgreich gilt; schlaegt sie fehl -> migriert:false + Backup bleibt.
 *
 * Die mandanten.json-Metadaten werden aus der reinen, getesteten Transform
 * (public/shared/mandanten-migration.js) abgeleitet -> konsistent zur Browser-
 * Migration, keine doppelte Logik.
 *
 * Reine Funktion auf einem uebergebenen baseDir -> gegen ein Temp-Verzeichnis
 * testbar, ohne das echte data/ anzufassen.
 * ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var Transform = require('../public/shared/mandanten-migration.js');

function jsonDateien(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); });
}
function leseJSON(f, fb) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fb; }
}

/* Altes (einfirmiges) Layout vorhanden UND noch nicht migriert? */
function istAltesLayout(baseDir) {
  if (fs.existsSync(path.join(baseDir, 'mandanten'))) return false;   // schon migriert
  var hatUnt = fs.existsSync(path.join(baseDir, 'unternehmen.json'));
  var hatAbschl = jsonDateien(path.join(baseDir, 'abschluesse')).length > 0;
  return hatUnt || hatAbschl;
}

/* migriereDateiLayout(baseDir, opts) -> Report
 *   opts.ts:    Zeitstempel-Suffix fuer den Backup-Ordner (Default: jetzt).
 *   opts.jetzt: ISO fuer mandant.angelegtAm (Default: jetzt).
 * Report: { migriert:Boolean, grund?, backupDir?, mandantId?, anzahlAbschluesse?, mandanten? }
 */
function migriereDateiLayout(baseDir, opts) {
  opts = opts || {};
  if (fs.existsSync(path.join(baseDir, 'mandanten'))) {
    return { migriert: false, grund: 'bereits-migriert' };
  }
  if (!istAltesLayout(baseDir)) {
    return { migriert: false, grund: 'keine-altdaten' };
  }

  var ts = opts.ts || new Date().toISOString().replace(/[:.]/g, '-');
  var jetzt = opts.jetzt || new Date().toISOString();

  var untSrc = path.join(baseDir, 'unternehmen.json');
  var abschlSrc = path.join(baseDir, 'abschluesse');
  var srcAbschlDateien = jsonDateien(abschlSrc);

  // --- 1) Pre-Backup (kopieren) VOR jeder Zielschreibung -------------------
  var backupDir = path.join(baseDir, '.backup-pre-mandanten-' + ts);
  fs.mkdirSync(backupDir, { recursive: true });
  if (fs.existsSync(untSrc)) {
    fs.copyFileSync(untSrc, path.join(backupDir, 'unternehmen.json'));
  }
  if (srcAbschlDateien.length) {
    fs.cpSync(abschlSrc, path.join(backupDir, 'abschluesse'), { recursive: true });
  }

  // --- 2) Quelle einlesen (fuer mandanten.json-Metadaten) -----------------
  var unternehmen = fs.existsSync(untSrc) ? leseJSON(untSrc, null) : null;
  var abschluesse = srcAbschlDateien.map(function (f) {
    return leseJSON(path.join(abschlSrc, f), null);
  }).filter(Boolean);

  // --- 3) Ziel-Layout standard/ aufbauen (KOPIEREN, Originale bleiben) -----
  var mandantDir = path.join(baseDir, 'mandanten', Transform.STANDARD_ID);
  var zielAbschl = path.join(mandantDir, 'abschluesse');
  fs.mkdirSync(zielAbschl, { recursive: true });
  if (fs.existsSync(untSrc)) {
    fs.copyFileSync(untSrc, path.join(mandantDir, 'unternehmen.json'));
  }
  srcAbschlDateien.forEach(function (f) {
    fs.copyFileSync(path.join(abschlSrc, f), path.join(zielAbschl, f));
  });

  // --- 4) mandanten.json aus der reinen Transform ableiten ----------------
  var v2 = Transform.migriere({ unternehmen: unternehmen, abschluesse: abschluesse },
    { jetzt: jetzt });
  fs.writeFileSync(path.join(baseDir, 'mandanten.json'),
    JSON.stringify(v2.mandanten, null, 2), 'utf8');

  // --- 5) Verifikation: Anzahl + Parsebarkeit im Ziel ---------------------
  var zielDateien = jsonDateien(zielAbschl);
  var anzahlOk = zielDateien.length === srcAbschlDateien.length;
  var parseOk = zielDateien.every(function (f) {
    return leseJSON(path.join(zielAbschl, f), null) !== null;
  });
  var untOk = !fs.existsSync(untSrc) ||
    leseJSON(path.join(mandantDir, 'unternehmen.json'), null) !== null;

  if (!anzahlOk || !parseOk || !untOk) {
    return { migriert: false, grund: 'verifikation-fehlgeschlagen',
      backupDir: backupDir, erwartet: srcAbschlDateien.length, kopiert: zielDateien.length };
  }

  return {
    migriert: true,
    backupDir: backupDir,
    mandantId: Transform.STANDARD_ID,
    anzahlAbschluesse: abschluesse.length,
    mandanten: v2.mandanten
  };
}

module.exports = {
  istAltesLayout: istAltesLayout,
  migriereDateiLayout: migriereDateiLayout
};
