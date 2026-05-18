/* ===========================================================================
 * server.js  -  Lokaler Webserver der OpenBilanz
 * ---------------------------------------------------------------------------
 * Zero-Dependency: nutzt nur die Node-Standardbibliothek (kein npm install).
 * Starten mit:  node server.js   (oder ./start.sh)
 * Danach im Browser öffnen:  http://localhost:3000
 * ========================================================================= */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

var store = require('./lib/store.js');
var xbrl = require('./public/shared/xbrl.js');

var PORT = parseInt(process.env.PORT, 10) || 3000;
/* Standardmäßig nur auf der Loopback-Adresse lauschen: Das Tool hat KEINE
 * Authentifizierung und im Selbst-Hosting-Modus liegen die Steuerdaten
 * serverseitig (./data). Eine Bindung auf alle Interfaces (0.0.0.0) würde sie
 * jedem im selben Netz zugänglich machen. Für einen bewussten Netzwerk-Zugriff
 * HOST=0.0.0.0 setzen — nur in einem vertrauenswürdigen Netz tun. */
var HOST = process.env.HOST || '127.0.0.1';
var PUBLIC = path.join(__dirname, 'public');

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon'
};

function sendJSON(res, code, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
function sendText(res, code, typ, body, dateiname) {
  var h = { 'Content-Type': typ };
  if (dateiname) h['Content-Disposition'] = 'attachment; filename="' + dateiname + '"';
  res.writeHead(code, h);
  res.end(body);
}
function leseBody(req, cb) {
  var data = '';
  req.on('data', function (c) { data += c; if (data.length > 5e6) req.destroy(); });
  req.on('end', function () {
    if (!data) return cb(null, {});
    try { cb(null, JSON.parse(data)); } catch (e) { cb(e); }
  });
}

function statisch(res, urlPfad) {
  var rel = urlPfad === '/' ? '/index.html' : urlPfad;
  var datei = path.normalize(path.join(PUBLIC, rel));
  if (datei.indexOf(PUBLIC) !== 0) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(datei, function (err, buf) {
    if (err) { res.writeHead(404); return res.end('Nicht gefunden: ' + rel); }
    /* Selbst-Hosting-Modus: den Betriebsmodus in index.html umschreiben, damit
     * der Browser die Node-API statt IndexedDB nutzt. */
    if (rel === '/index.html') {
      buf = Buffer.from(String(buf).replace(
        'name="openbilanz-mode" content="website"',
        'name="openbilanz-mode" content="selfhost"'));
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(datei)] || 'application/octet-stream' });
    res.end(buf);
  });
}

/* ---- API ---------------------------------------------------------------- */
function api(req, res, pfad, query) {
  // Zustand laden
  if (pfad === '/api/state' && req.method === 'GET') {
    return sendJSON(res, 200, {
      unternehmen: store.ladeUnternehmen(),
      abschluesse: store.listeAbschluesse().map(function (a) {
        return { id: a.id, art: a.art, bezeichnung: a.bezeichnung, stichtag: a.stichtag,
                 groessenklasse: a.groessenklasse, status: a.status };
      })
    });
  }
  // Unternehmen speichern
  if (pfad === '/api/unternehmen' && req.method === 'PUT') {
    return leseBody(req, function (e, body) {
      if (e) return sendJSON(res, 400, { fehler: 'Ungueltige Daten' });
      sendJSON(res, 200, store.speichereUnternehmen(body));
    });
  }
  // Einzelnen Abschluss laden
  if (pfad === '/api/abschluss' && req.method === 'GET') {
    var a = store.ladeAbschluss(query.id);
    return a ? sendJSON(res, 200, a) : sendJSON(res, 404, { fehler: 'Nicht gefunden' });
  }
  // Abschluss speichern (anlegen/aktualisieren)
  if (pfad === '/api/abschluss' && req.method === 'PUT') {
    return leseBody(req, function (e, body) {
      if (e) return sendJSON(res, 400, { fehler: 'Ungueltige Daten' });
      sendJSON(res, 200, store.speichereAbschluss(body));
    });
  }
  // Abschluss löschen
  if (pfad === '/api/abschluss' && req.method === 'DELETE') {
    return sendJSON(res, 200, { geloescht: store.loescheAbschluss(query.id) });
  }
  // E-Bilanz erzeugen und herunterladen
  //   form=ebilanz (Standard): XBRL im ELSTER-EBilanz-Container (Übermittlung)
  //   form=instanz:            reine XBRL-Instanz (zum Validieren)
  if (pfad === '/api/xbrl' && req.method === 'GET') {
    var ab = store.ladeAbschluss(query.id);
    var un = store.ladeUnternehmen();
    if (!ab) return sendJSON(res, 404, { fehler: 'Abschluss nicht gefunden' });
    try {
      var instanz = query.form === 'instanz';
      var erg = instanz ? xbrl.erzeugeXBRL(un || {}, ab) : xbrl.erzeugeEBilanz(un || {}, ab);
      var name = (instanz ? 'xbrl-instanz_' : 'ebilanz_') + (ab.id || 'abschluss') + '.xml';
      return sendText(res, 200, 'application/xml; charset=utf-8', erg.xml, name);
    } catch (ex) {
      return sendJSON(res, 500, { fehler: 'XBRL-Erzeugung fehlgeschlagen: ' + ex.message });
    }
  }
  // E-Bilanz gegen die amtliche Taxonomie validieren (nutzt Arelle, falls vorhanden)
  if (pfad === '/api/validate' && req.method === 'GET') {
    var vab = store.ladeAbschluss(query.id);
    var vun = store.ladeUnternehmen();
    if (!vab) return sendJSON(res, 404, { fehler: 'Abschluss nicht gefunden' });
    try {
      var verg = xbrl.erzeugeXBRL(vun || {}, vab);
      return require('./lib/validate.js').pruefe(verg.xml, function (ergebnis) {
        ergebnis.warnungen = verg.warnungen;
        sendJSON(res, 200, ergebnis);
      });
    } catch (ex) {
      return sendJSON(res, 500, { fehler: 'Validierung fehlgeschlagen: ' + ex.message });
    }
  }
  sendJSON(res, 404, { fehler: 'Unbekannter API-Endpunkt' });
}

/* ---- Server ------------------------------------------------------------- */
var server = http.createServer(function (req, res) {
  var u = require('url').parse(req.url, true);
  if (u.pathname.indexOf('/api/') === 0) {
    try { api(req, res, u.pathname, u.query); }
    catch (e) { sendJSON(res, 500, { fehler: e.message }); }
  } else {
    statisch(res, u.pathname);
  }
});

store.init();
server.listen(PORT, HOST, function () {
  var lokal = HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1';
  console.log('');
  console.log('  OpenBilanz läuft.');
  console.log('  Im Browser öffnen:  http://localhost:' + PORT);
  if (!lokal) {
    console.log('');
    console.log('  ACHTUNG: HOST=' + HOST + ' — der Server ist im Netzwerk');
    console.log('  erreichbar und hat KEINE Authentifizierung. Jeder, der den');
    console.log('  Port erreicht, kann die Buchhaltungsdaten lesen und ändern.');
    console.log('  Nur in einem vertrauenswürdigen Netz verwenden.');
  }
  console.log('');
  console.log('  Beenden mit Strg+C');
  console.log('');
});
