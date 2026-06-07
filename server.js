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
/* "Netzwerk-Betrieb" = an eine nicht-lokale Adresse gebunden. Der Server hat
 * keine Authentifizierung; im Netz erreichbar heisst daher: jeder mit Zugriff
 * auf den Port kann die Buchhaltungsdaten lesen und ändern. Dieser Modus ist
 * nur mit ausdrücklicher Bestätigung (OPENBILANZ_UNSAFE_NETWORK=1) erlaubt und
 * blendet zusätzlich eine Warnleiste in die Oberfläche ein. */
var NETZBETRIEB = !(HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1');
var NETZ_FREIGEGEBEN = process.env.OPENBILANZ_UNSAFE_NETWORK === '1';
var PUBLIC = path.join(__dirname, 'public');

/* Rote Warnleiste für den Netzwerk-Betrieb. Reines HTML mit Inline-Style — die
 * strenge CSP der index.html erlaubt kein Inline-JavaScript, Inline-Styles
 * dagegen schon (style-src 'unsafe-inline'). */
var NETZ_WARNUNG =
  '<div role="alert" style="position:sticky;top:0;z-index:99999;background:#b00020;' +
  'color:#fff;padding:.7rem 1rem;text-align:center;box-shadow:0 1px 6px rgba(0,0,0,.35);' +
  'font:600 14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif">' +
  '⚠ Netzwerk-Betrieb ohne Authentifizierung &ndash; jede Person mit Zugriff auf ' +
  'diesen Port kann die Buchhaltungsdaten lesen und &auml;ndern. Nur in einem ' +
  'vertrauensw&uuml;rdigen Netz verwenden.</div>';

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
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8',
                        'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function sendText(res, code, typ, body, dateiname) {
  var h = { 'Content-Type': typ };
  if (dateiname) h['Content-Disposition'] = 'attachment; filename="' + dateiname + '"';
  res.writeHead(code, h);
  res.end(body);
}
function leseBody(req, cb) {
  /* Chunks als Buffer sammeln und erst am Ende dekodieren - ein an einer
   * Chunk-Grenze geteiltes Mehrbyte-UTF-8-Zeichen (Umlaut, ß, €) wuerde sonst
   * zerstoert. */
  var chunks = [], laenge = 0, fertig = false;
  req.on('data', function (c) {
    if (fertig) return;
    laenge += c.length;
    if (laenge > 5e6) { fertig = true; req.destroy(); cb(new Error('Anfrage zu gross')); return; }
    chunks.push(c);
  });
  req.on('end', function () {
    if (fertig) return;
    fertig = true;
    var data = Buffer.concat(chunks).toString('utf8');
    if (!data) return cb(null, {});
    try { cb(null, JSON.parse(data)); } catch (e) { cb(e); }
  });
  req.on('error', function () { if (!fertig) { fertig = true; cb(new Error('Anfrage fehlerhaft')); } });
}

function statisch(res, urlPfad) {
  var rel = urlPfad === '/' ? '/index.html' : urlPfad;
  var datei = path.normalize(path.join(PUBLIC, rel));
  /* Pfadgrenze exakt pruefen: eine reine Praefixpruefung wuerde einen
   * Geschwisterordner namens 'public...' faelschlich zulassen. */
  if (datei !== PUBLIC && datei.indexOf(PUBLIC + path.sep) !== 0) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }
  fs.readFile(datei, function (err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Nicht gefunden');
    }
    /* Selbst-Hosting-Modus: den Betriebsmodus in index.html umschreiben, damit
     * der Browser die Node-API statt IndexedDB nutzt. */
    if (rel === '/index.html') {
      var html = String(buf).replace(
        'name="openbilanz-mode" content="website"',
        'name="openbilanz-mode" content="selfhost"');
      /* Im Netzwerk-Betrieb die rote Warnleiste direkt nach <body> einsetzen. */
      if (NETZBETRIEB) html = html.replace('<body>', '<body>\n' + NETZ_WARNUNG);
      buf = Buffer.from(html);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(datei)] || 'application/octet-stream',
      /* X-Frame-Options ergaenzt die CSP: 'frame-ancestors' aus dem <meta>-Tag
       * der index.html wird von Browsern ignoriert - nur ein echter
       * HTTP-Header schuetzt gegen Clickjacking. */
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(buf);
  });
}

/* ---- API ---------------------------------------------------------------- */
function api(req, res, pfad, query) {
  // Aktiver Mandant aus der Query (Default 'standard') - Welle 7.
  var mandant = (query && query.mandant) || store.STANDARD;
  // Mandanten-Index
  if (pfad === '/api/mandanten' && req.method === 'GET') {
    return sendJSON(res, 200, { mandanten: store.listeMandanten() });
  }
  if (pfad === '/api/mandanten' && req.method === 'POST') {
    return leseBody(req, function (e, body) {
      if (e) return sendJSON(res, 400, { fehler: 'Ungueltige Daten' });
      sendJSON(res, 200, store.mandantAnlegen((body && body.name) || '', body && body.id));
    });
  }
  // Zustand laden (je Mandant)
  if (pfad === '/api/state' && req.method === 'GET') {
    return sendJSON(res, 200, {
      aktiverMandant: mandant,
      mandanten: store.listeMandanten(),
      unternehmen: store.ladeUnternehmen(mandant),
      abschluesse: store.listeAbschluesse(mandant).map(function (a) {
        return { id: a.id, art: a.art, bezeichnung: a.bezeichnung, stichtag: a.stichtag,
                 groessenklasse: a.groessenklasse, status: a.status };
      })
    });
  }
  // Unternehmen speichern
  if (pfad === '/api/unternehmen' && req.method === 'PUT') {
    return leseBody(req, function (e, body) {
      if (e) return sendJSON(res, 400, { fehler: 'Ungueltige Daten' });
      sendJSON(res, 200, store.speichereUnternehmen(body, mandant));
    });
  }
  // Einzelnen Abschluss laden
  if (pfad === '/api/abschluss' && req.method === 'GET') {
    var a = store.ladeAbschluss(query.id, mandant);
    return a ? sendJSON(res, 200, a) : sendJSON(res, 404, { fehler: 'Nicht gefunden' });
  }
  // Abschluss speichern (anlegen/aktualisieren)
  if (pfad === '/api/abschluss' && req.method === 'PUT') {
    return leseBody(req, function (e, body) {
      if (e) return sendJSON(res, 400, { fehler: 'Ungueltige Daten' });
      sendJSON(res, 200, store.speichereAbschluss(body, mandant));
    });
  }
  // Abschluss löschen
  if (pfad === '/api/abschluss' && req.method === 'DELETE') {
    return sendJSON(res, 200, { geloescht: store.loescheAbschluss(query.id, mandant) });
  }
  // Unternehmen löschen (Teil des „Alle Daten zurücksetzen")
  if (pfad === '/api/unternehmen' && req.method === 'DELETE') {
    return sendJSON(res, 200, { geloescht: store.loescheUnternehmen(mandant) });
  }
  // E-Bilanz erzeugen und herunterladen
  //   form=ebilanz (Standard): XBRL im ELSTER-EBilanz-Container (Übermittlung)
  //   form=instanz:            reine XBRL-Instanz (zum Validieren)
  if (pfad === '/api/xbrl' && req.method === 'GET') {
    var ab = store.ladeAbschluss(query.id, mandant);
    var un = store.ladeUnternehmen(mandant);
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
  // USt-IdNr.-Bestätigungsanfrage gegen VIES (EU-Stelle). Nur im Selbst-
  // Hosting-Modus aktiv — der Browser darf VIES wegen fehlender CORS-Header
  // nicht direkt aufrufen. Opt-in geschieht im UI pro Aufruf (Knopfdruck).
  if (pfad === '/api/ustid/check' && req.method === 'GET') {
    var raw = String(query.ustid || '').toUpperCase().replace(/[\s.\-/]+/g, '');
    if (!/^[A-Z]{2}.+$/.test(raw)) {
      return sendJSON(res, 400, { fehler: 'Ungültiges Format der USt-IdNr.' });
    }
    var landP = raw.slice(0, 2);
    var nrP = raw.slice(2);
    // VIES erwartet 'EL' für Griechenland intern als 'EL'; manche Aufrufe
    // benutzen 'GR' — VIES kennt beide. Wir reichen unverändert durch.
    var url = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms/' +
              encodeURIComponent(landP) + '/vat/' + encodeURIComponent(nrP);
    var https = require('https');
    var antwortAm = new Date().toISOString();
    var anfrage = https.get(url, { timeout: 8000,
      headers: { 'Accept': 'application/json', 'User-Agent': 'OpenBilanz/1.0' }
    }, function (r) {
      var body = '';
      r.setEncoding('utf8');
      r.on('data', function (c) { body += c; });
      r.on('end', function () {
        try {
          if (r.statusCode < 200 || r.statusCode >= 300) {
            return sendJSON(res, 502,
              { fehler: 'VIES antwortete mit HTTP ' + r.statusCode, antwortAm: antwortAm });
          }
          var d = JSON.parse(body);
          sendJSON(res, 200, {
            gueltig:     !!d.isValid,
            land:        landP,
            ustid:       raw,
            name:        d.name || '',
            adresse:     d.address || '',
            quelle:      'VIES',
            antwortAm:   antwortAm,
            requestDate: d.requestDate || ''
          });
        } catch (e) {
          sendJSON(res, 502, { fehler: 'VIES-Antwort nicht lesbar: ' + e.message,
                               antwortAm: antwortAm });
        }
      });
    });
    anfrage.on('timeout', function () {
      anfrage.destroy();
      sendJSON(res, 504, { fehler: 'Zeitüberschreitung bei VIES (8 s).', antwortAm: antwortAm });
    });
    anfrage.on('error', function (err) {
      sendJSON(res, 502, { fehler: 'VIES nicht erreichbar: ' + err.message,
                            antwortAm: antwortAm });
    });
    return;
  }
  // E-Bilanz gegen die amtliche Taxonomie validieren (nutzt Arelle, falls vorhanden)
  if (pfad === '/api/validate' && req.method === 'GET') {
    var vab = store.ladeAbschluss(query.id, mandant);
    var vun = store.ladeUnternehmen(mandant);
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
/* Schutz vor DNS-Rebinding: Ein nur lokal (127.0.0.1) gebundener Server ohne
 * Authentifizierung darf ausschliesslich Anfragen mit lokalem Host-Header
 * beantworten - sonst koennte eine im Browser geoeffnete fremde Website per
 * DNS-Rebinding die lokale API erreichen und die Buchhaltungsdaten lesen oder
 * aendern. Bei bewusstem Netzwerk-Betrieb (HOST != Loopback) entfaellt die
 * Pruefung, da der erwartete Hostname dann nicht bekannt ist. */
function hostErlaubt(req) {
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') return true;
  var h = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

var server = http.createServer(function (req, res) {
  if (!hostErlaubt(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden host');
  }
  var u = require('url').parse(req.url, true);
  if (u.pathname.indexOf('/api/') === 0) {
    try { api(req, res, u.pathname, u.query); }
    catch (e) { sendJSON(res, 500, { fehler: e.message }); }
  } else {
    statisch(res, u.pathname);
  }
});

/* Netzwerk-Betrieb nur mit ausdrücklicher Bestätigung: ohne gesetztes
 * OPENBILANZ_UNSAFE_NETWORK=1 würde ein versehentliches HOST=0.0.0.0 die
 * Buchhaltungsdaten ungeschützt im Netz freigeben — dann lieber nicht starten. */
if (NETZBETRIEB && !NETZ_FREIGEGEBEN) {
  console.error('');
  console.error('  OpenBilanz wurde NICHT gestartet.');
  console.error('');
  console.error('  HOST=' + HOST + ' macht den Server im Netzwerk erreichbar.');
  console.error('  OpenBilanz hat KEINE Authentifizierung — jede Person, die den');
  console.error('  Port erreicht, könnte die Buchhaltungsdaten lesen und ändern.');
  console.error('');
  console.error('  Ist das bewusst gewollt — und nur in einem vertrauenswürdigen');
  console.error('  Netz! — zusätzlich diese Variable setzen:');
  console.error('');
  console.error('      OPENBILANZ_UNSAFE_NETWORK=1');
  console.error('');
  process.exit(1);
}

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
