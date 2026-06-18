/* ===========================================================================
 * validate-browser.js  -  E-Bilanz-Pruefung im Browser (Website-Modus)
 * ---------------------------------------------------------------------------
 * Im Website-Modus laeuft keine Server-Validierung. Dieses Modul prueft die
 * erzeugte XBRL-Instanz rein im Browser auf Konsistenz und Pflichtangaben:
 *   - XBRL wohlgeformt, Grundgeruest (Kontexte, Einheit, Fakten)
 *   - Bilanzgleichung Aktiva = Passiva
 *   - Pflichtangaben (Firma, Bilanzstichtag, Steuernummer)
 *
 * Das ersetzt NICHT die vollstaendige Pruefung gegen die amtliche Taxonomie
 * (Arelle). Diese ist als gesonderter, optionaler Schritt vorgesehen
 * (Pyodide/Arelle im Browser) und wird hier kuenftig eingehaengt.
 *
 * Ergebnis-Form identisch zu lib/validate.js, damit die Anzeige beide kann.
 * ========================================================================= */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BrowserValidate = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  function num(v) {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    var s = String(v == null ? '' : v).replace(/\s/g, '');
    // Deutsche Zahl: Komma = Dezimaltrenner, Punkt = Tausender. (Zuvor entfernte
    // diese Funktion die Tausenderpunkte NICHT -> "1.234,56" wurde zu 1.234.)
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function eur(n) {
    return num(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function byLocal(doc, name) {
    var all = doc.getElementsByTagName('*'), out = [], i;
    for (i = 0; i < all.length; i++) if (all[i].localName === name) out.push(all[i]);
    return out;
  }

  /* JS-Konsistenzpruefung. xml = XBRL-Instanz (String). Promise<ergebnis>. */
  function pruefe(xml, unternehmen, abschluss) {
    var fehler = [], hinweise = [];
    var u = unternehmen || {}, a = abschluss || {};

    /* --- XBRL wohlgeformt + Grundgeruest --------------------------------- */
    var doc = null;
    try {
      doc = new DOMParser().parseFromString(String(xml || ''), 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) {
        fehler.push({ code: 'XML', text: 'Die erzeugte XBRL-Datei ist nicht wohlgeformt.' });
        doc = null;
      }
    } catch (e) {
      fehler.push({ code: 'XML', text: 'XBRL-Datei nicht lesbar: ' + e.message });
    }
    if (doc) {
      if (!doc.documentElement || doc.documentElement.localName !== 'xbrl') {
        fehler.push({ code: 'XBRL', text: 'Kein gueltiges xbrli:xbrl-Wurzelelement.' });
      }
      if (byLocal(doc, 'context').length < 1) {
        fehler.push({ code: 'XBRL', text: 'Keine xbrli:context-Angaben enthalten.' });
      }
      if (byLocal(doc, 'unit').length < 1) {
        fehler.push({ code: 'XBRL', text: 'Keine Einheit (xbrli:unit) enthalten.' });
      }
      var ident = byLocal(doc, 'identifier')[0];
      var stnr = ident ? String(ident.textContent || '').replace(/[^0-9]/g, '') : '';
      if (stnr === '00000000000') {
        fehler.push({ code: 'STEUERNR', text: 'Die E-Bilanz enthaelt nur eine Platzhalter-' +
          'Steuernummer. Vor der Uebermittlung die 13-stellige Steuernummer eintragen.' });
      } else if (stnr && !/^[0-9]{13}$/.test(stnr)) {
        hinweise.push('Die Steuernummer hat nicht die erwarteten 13 Stellen (' +
          stnr.length + ').');
      }
      var alle = doc.getElementsByTagName('*'), faktAnz = 0, nilAnz = 0, i;
      for (i = 0; i < alle.length; i++) {
        if (alle[i].getAttribute && alle[i].getAttribute('contextRef')) {
          faktAnz++;
          var nil = alle[i].getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'nil');
          if (nil === 'true') nilAnz++;
        }
      }
      if (faktAnz === 0) {
        fehler.push({ code: 'XBRL', text: 'Die E-Bilanz enthaelt keine Wertangaben (Fakten).' });
      } else {
        hinweise.push(faktAnz + ' uebermittelte Position(en), davon ' + nilAnz +
          ' ohne Wert (xsi:nil).');
      }
    }

    /* --- Bilanzgleichung ------------------------------------------------- */
    if (root.Berechnung) {
      try {
        var r = root.Berechnung.berechne(a);
        var sa = num(r.bilanz.summeAktiva), sp = num(r.bilanz.summePassiva);
        var diff = Math.abs(sa - sp);
        if (diff > 0.009) {
          fehler.push({ code: 'BILANZ', text: 'Bilanzgleichung verletzt: Aktiva ' +
            eur(sa) + ' ungleich Passiva ' + eur(sp) + ' (Differenz ' + eur(diff) + ').' });
        }
      } catch (e) { /* Rechenkern nicht anwendbar - ueberspringen */ }
    }

    /* --- Pflichtangaben -------------------------------------------------- */
    if (!u.name) {
      fehler.push({ code: 'STAMMDATEN', text: 'Kein Firmenname hinterlegt.' });
    }
    if (!a.stichtag && !u.gruendungsdatum) {
      fehler.push({ code: 'STAMMDATEN', text: 'Kein Bilanzstichtag gesetzt.' });
    }
    if (!u.steuernummer) {
      hinweise.push('Es ist keine Steuernummer hinterlegt - fuer die Uebermittlung erforderlich.');
    }

    hinweise.push('Geprueft wurden Aufbau, Konsistenz und Pflichtangaben im Browser. ' +
      'Die vollstaendige Pruefung gegen die amtliche Taxonomie (Arelle) ist damit ' +
      'nicht abgedeckt.');

    return Promise.resolve({
      methode: 'js-konsistenz',
      arelleVerfuegbar: false,
      taxonomiePaket: null,
      ok: fehler.length === 0,
      fehler: fehler,
      hinweise: hinweise,
      warnungen: []
    });
  }

  /* EXPERIMENTELL: vollstaendige Validierung gegen die amtliche Taxonomie
   * via Arelle in einem Pyodide-Web-Worker. Setzt die per
   * tools/setup-pyodide.sh bereitgestellten Assets voraus.
   * xml = XBRL-Instanz; aufFortschritt(text) optional.
   * Rueckgabe: Promise<String> mit der Arelle-Logausgabe. */
  function pruefeTaxonomie(xml, aufFortschritt) {
    return new Promise(function (resolve, reject) {
      var w;
      try { w = new Worker('pyodide-worker.js'); }
      catch (e) { reject(new Error('Web Worker nicht verfuegbar.')); return; }
      w.onmessage = function (ev) {
        var d = ev.data || {};
        if (d.typ === 'status') { if (aufFortschritt) aufFortschritt(d.text); }
        else if (d.typ === 'ergebnis') { w.terminate(); resolve(d.log); }
        else if (d.typ === 'fehler') { w.terminate(); reject(new Error(d.text)); }
      };
      w.onerror = function (ev) {
        w.terminate();
        reject(new Error('Pyodide-Worker-Fehler: ' + ((ev && ev.message) || 'unbekannt') +
          ' — sind die Assets via tools/setup-pyodide.sh installiert?'));
      };
      w.postMessage({ typ: 'pruefe', xml: xml });
    });
  }

  return { pruefe: pruefe, pruefeTaxonomie: pruefeTaxonomie };
});
