/* ===========================================================================
 * pyodide-worker.js  -  EXPERIMENTELL: Arelle-Validierung im Browser
 * ---------------------------------------------------------------------------
 * Web Worker, der Pyodide (CPython als WebAssembly) laedt, darin Arelle
 * installiert und eine XBRL-Instanz OFFLINE gegen die amtliche Taxonomie
 * validiert. Es verlassen keine Daten den Browser.
 *
 * Voraussetzung: die Assets unter public/pyodide/, public/wheels/ und
 * public/taxonomie/taxonomie.zip - bereitgestellt von tools/setup-pyodide.sh.
 *
 * Dieser Pfad ist ein Spike: die Kombination Arelle + Pyodide ist nicht
 * breit erprobt. Bei Problemen bleibt die JS-Konsistenzpruefung der
 * verlaessliche Weg.
 *
 * Nachrichten an den Hauptthread: { typ:'status', text } waehrend des Ladens,
 * { typ:'ergebnis', log } bei Erfolg, { typ:'fehler', text } bei Fehler.
 * ========================================================================= */
'use strict';

var pyodide = null;
var bereit = null;

function melde(typ, text) { postMessage({ typ: typ, text: text }); }

/* Laedt Pyodide, Arelle und die Taxonomie - nur beim ersten Aufruf. */
function initialisieren() {
  if (bereit) return bereit;
  bereit = (async function () {
    melde('status', 'Pyodide wird geladen …');
    importScripts('pyodide/pyodide.js');
    pyodide = await loadPyodide({ indexURL: 'pyodide/' });

    melde('status', 'Arelle und Abhängigkeiten werden installiert …');
    await pyodide.loadPackage('micropip');
    var antwort = await fetch('wheels/wheels.json');
    if (!antwort.ok) {
      throw new Error('wheels/wheels.json nicht gefunden — bitte tools/setup-pyodide.sh ausführen.');
    }
    var liste = null;
    try { liste = JSON.parse(await antwort.text()); } catch (e) { liste = null; }
    if (!Array.isArray(liste) || !liste.length) {
      throw new Error('wheels/wheels.json ist leer oder ungültig — tools/setup-pyodide.sh erneut ausführen.');
    }
    var urls = liste.map(function (w) { return 'wheels/' + w; });
    /* Standard deps=True: micropip loest Arelles Abhaengigkeiten (lxml, regex,
     * numpy …) aus der Pyodide-Distribution auf - ohne PyPI-Zugriff. */
    await pyodide.runPythonAsync(
      'import micropip\n' +
      'await micropip.install(' + JSON.stringify(urls) + ')\n');

    melde('status', 'Amtliche Taxonomie wird geladen …');
    var zip = new Uint8Array(await (await fetch('taxonomie/taxonomie.zip')).arrayBuffer());
    pyodide.FS.writeFile('/taxonomie.zip', zip);
  })();
  return bereit;
}

onmessage = function (e) {
  if (!e.data || e.data.typ !== 'pruefe') return;
  initialisieren().then(function () {
    melde('status', 'Validierung läuft …');
    pyodide.FS.writeFile('/instanz.xml', e.data.xml);
    return pyodide.runPythonAsync([
      'from arelle.api.Session import Session',
      'from arelle.RuntimeOptions import RuntimeOptions',
      '_opts = RuntimeOptions(entrypointFile="/instanz.xml",',
      '    internetConnectivity="offline", packages=["/taxonomie.zip"],',
      '    validate=True, keepOpen=False, logFile="logToBuffer",',
      '    logFormat="[%(levelname)s] [%(messageCode)s] %(message)s")',
      'with Session() as _s:',
      '    _s.run(_opts)',
      '    _log = _s.get_logs("text")',
      '_log'
    ].join('\n'));
  }).then(function (log) {
    postMessage({ typ: 'ergebnis', log: String(log || '') });
  }).catch(function (err) {
    postMessage({ typ: 'fehler', text: String((err && err.message) || err) });
  });
};
