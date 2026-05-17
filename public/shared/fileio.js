/* ===========================================================================
 * fileio.js  -  Datei-Export/-Import fuer die OpenBilanz-Sicherung (.obz)
 * ---------------------------------------------------------------------------
 * Zwei Wege mit automatischem Rueckfall:
 *
 *   File System Access API (Chrome/Edge): der Nutzer waehlt einmalig eine
 *     Datei; das Handle wird wiederverwendet, sodass jedes Speichern lautlos
 *     dieselbe Datei ueberschreibt - eine stets aktuelle Backup-Datei.
 *   Download-Fallback (Firefox/Safari): klassischer Datei-Download bzw.
 *     <input type=file> beim Import.
 *
 * Das gespeicherte Handle haelt der Aufrufer (in IndexedDB/meta). Berechtigungen
 * werden pro Sitzung neu geprueft (queryPermission/requestPermission).
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FileIO = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HAS_FSA = typeof window !== 'undefined' &&
                'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
  var TYP = { description: 'OpenBilanz-Sicherung',
              accept: { 'application/octet-stream': ['.obz'] } };

  /* Prueft/erbittet die noetige Berechtigung fuer ein gespeichertes Handle. */
  function rechtPruefen(handle, schreiben) {
    if (!handle || !handle.queryPermission) return Promise.resolve(false);
    var opt = schreiben ? { mode: 'readwrite' } : {};
    return handle.queryPermission(opt).then(function (s) {
      if (s === 'granted') return true;
      return handle.requestPermission(opt).then(function (s2) { return s2 === 'granted'; });
    }).catch(function () { return false; });
  }

  /* Schreibt Bytes in ein bekanntes Handle (lautloses Ueberschreiben). */
  function inHandleSchreiben(handle, bytes) {
    return rechtPruefen(handle, true).then(function (ok) {
      if (!ok) throw new Error('Keine Schreibberechtigung fuer die Sicherungsdatei.');
      return handle.createWritable().then(function (w) {
        return w.write(bytes).then(function () { return w.close(); });
      });
    }).then(function () { return handle; });
  }

  /* Export. bytes: Uint8Array. handle: optionales gespeichertes Handle.
   * Rueckgabe: Promise<FileSystemFileHandle|null> (null im Download-Fallback). */
  function exportieren(bytes, vorschlagName, handle) {
    if (HAS_FSA) {
      if (handle) {
        return inHandleSchreiben(handle, bytes).catch(function () {
          /* Handle ungueltig geworden -> neu auswaehlen lassen */
          return exportieren(bytes, vorschlagName, null);
        });
      }
      return window.showSaveFilePicker({ suggestedName: vorschlagName, types: [TYP] })
        .then(function (h) { return inHandleSchreiben(h, bytes); });
    }
    /* Fallback: Blob-Download */
    var blob = new Blob([bytes], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = vorschlagName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return Promise.resolve(null);
  }

  /* Import. Rueckgabe: Promise<ArrayBuffer>. */
  function importieren() {
    if (HAS_FSA) {
      return window.showOpenFilePicker({ types: [TYP], multiple: false })
        .then(function (hs) { return hs[0].getFile(); })
        .then(function (f) { return f.arrayBuffer(); });
    }
    return new Promise(function (resolve, reject) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.obz';
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        if (!f) return reject(new Error('Keine Datei gewaehlt.'));
        f.arrayBuffer().then(resolve, reject);
      };
      inp.click();
    });
  }

  return { unterstuetztPicker: HAS_FSA, exportieren: exportieren,
           importieren: importieren, rechtPruefen: rechtPruefen };
});
