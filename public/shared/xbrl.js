/* ===========================================================================
 * xbrl.js  -  Erzeugung der E-Bilanz als XBRL-Instanz
 * ---------------------------------------------------------------------------
 * Erzeugt aus einem Abschluss die E-Bilanz nach der amtlichen
 * E-Bilanz-Kerntaxonomie 6.9 (§ 5b EStG). Zwei Ausgabeformen:
 *
 *   erzeugeXBRL(u,a)    -> reine XBRL-Instanz <xbrli:xbrl> (zum Validieren,
 *                          z. B. mit Arelle gegen die amtliche Taxonomie)
 *   erzeugeEBilanz(u,a) -> XBRL eingebettet in den ELSTER-Container <EBilanz>
 *                          (Namespace rzf.fin-nrw.de/.../2016) - dies ist die
 *                          Form, die eine ERiC-fähige Software uebermittelt.
 *
 * Laeuft als UMD-Modul in Node (require) UND im Browser (<script>). Im Browser
 * stammen Taxonomie/Berechnung aus den zuvor geladenen <script>-Globals.
 *
 * Hinweise zur Übermittlung:
 *  - Mein ELSTER bietet KEIN E-Bilanz-Formular und keinen XBRL-Upload.
 *  - Die Übermittlung ans Finanzamt erfolgt technisch über ERiC
 *    (ELSTER Rich Client). Diese Datei erzeugt die Nutzdaten.
 *  - Vor Echtuebermittlung mit einem XBRL-Validator (Arelle) gegen die
 *    amtliche Taxonomie 6.9 prüfen.
 * ========================================================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./taxonomie.js'), require('./berechnung.js'));
  } else {
    root.Xbrl = factory(root.Taxonomie, root.Berechnung);
  }
})(typeof self !== 'undefined' ? self : this, function (Taxonomie, Berechnung) {
  'use strict';

  var EBILANZ_NS = 'http://rzf.fin-nrw.de/RMS/EBilanz/2016/XMLSchema';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function betrag(n) { return (Math.round(Number(n) * 100) / 100).toFixed(2); }
  function nurZiffern(s) { return String(s || '').replace(/[^0-9]/g, ''); }
  function ohneTrenn(iso) { return String(iso || '').replace(/-/g, ''); }

  /* Baut die reine XBRL-Instanz (<xbrli:xbrl> ... </xbrli:xbrl>).
   * Rueckgabe: { zeilen: [String], warnungen: [String], stichtag: 'YYYY-MM-DD' } */
  function xbrlInstanz(unternehmen, abschluss) {
    var warn = [];
    var u = unternehmen || {};
    var r = Berechnung.berechne(abschluss);
    var istEB = abschluss.art === 'EROEFFNUNGSBILANZ';

    var stichtag = abschluss.stichtag || u.gruendungsdatum || '';
    var gjVon = abschluss.gjVon || stichtag;
    var gjBis = abschluss.gjBis || stichtag;

    var steuernr = nurZiffern(u.steuernummer);
    if (!steuernr) {
      steuernr = '00000000000';
      warn.push('Keine Steuernummer hinterlegt - im context steht ein Platzhalter. ' +
                'Vor der Übermittlung die 13-stellige Steuernummer eintragen.');
    }
    if (!stichtag) warn.push('Kein Bilanzstichtag gesetzt.');

    var pre = Taxonomie.NS;
    var L = [];
    L.push('  <xbrli:xbrl' +
      ' xmlns:xbrli="' + pre.xbrli + '"' +
      ' xmlns:link="' + pre.link + '"' +
      ' xmlns:xlink="' + pre.xlink + '"' +
      ' xmlns:iso4217="' + pre.iso4217 + '"' +
      ' xmlns:xsi="' + pre.xsi + '"' +
      ' xmlns:de-gcd="' + pre['de-gcd'] + '"' +
      ' xmlns:de-gaap-ci="' + pre['de-gaap-ci'] + '">');

    var gaapSchema = abschluss.groessenklasse === 'KLEINST'
      ? Taxonomie.SCHEMA.gaapMicro : Taxonomie.SCHEMA.gaap;
    L.push('    <link:schemaRef xlink:type="simple" xlink:href="' + esc(Taxonomie.SCHEMA.gcd) + '"/>');
    L.push('    <link:schemaRef xlink:type="simple" xlink:href="' + esc(gaapSchema) + '"/>');

    function kontext(id, periodeXML) {
      L.push('    <xbrli:context id="' + id + '">');
      L.push('      <xbrli:entity><xbrli:identifier scheme="http://www.rzf-nrw.de/Steuernummer">' +
             esc(steuernr) + '</xbrli:identifier></xbrli:entity>');
      L.push('      <xbrli:period>' + periodeXML + '</xbrli:period>');
      L.push('    </xbrli:context>');
    }
    kontext('I', '<xbrli:instant>' + esc(stichtag) + '</xbrli:instant>');
    kontext('D', '<xbrli:startDate>' + esc(gjVon) + '</xbrli:startDate>' +
                 '<xbrli:endDate>' + esc(gjBis) + '</xbrli:endDate>');
    L.push('    <xbrli:unit id="EUR"><xbrli:measure>iso4217:EUR</xbrli:measure></xbrli:unit>');

    /* --- GCD-Modul: Stammdaten --- */
    function gcd(name, ctx, wert) {
      if (wert == null || wert === '') return;
      L.push('    <de-gcd:' + name + ' contextRef="' + ctx + '">' + esc(wert) + '</de-gcd:' + name + '>');
    }
    L.push('    <!-- GCD-Modul: Stammdaten -->');
    gcd('genInfo.company.id.name', 'D', u.name);
    gcd('genInfo.company.id.location.street', 'D', u.strasse);
    gcd('genInfo.company.id.location.zipCode', 'D', u.plz);
    gcd('genInfo.company.id.location.city', 'D', u.ort);
    gcd('genInfo.report.period.balSheetClosingDate', 'D', stichtag);
    gcd('genInfo.report.period.fiscalYearBegin', 'D', gjVon);
    gcd('genInfo.report.period.fiscalYearEnd', 'D', gjBis);
    gcd('genInfo.doc.id.generationDate', 'D', new Date().toISOString().slice(0, 10));
    warn.push('GCD-Auswahlfelder (Rechtsform, Bilanzart, GuV-Format, Rechnungslegungs' +
              'standard) sind je nach ERiC-/Taxonomie-Version als Auswahlwerte zu ergaenzen.');

    /* --- GAAP-Modul: Bilanz (Stichtagswerte, context I) --- */
    function fakt(elem, ctx, wert) {
      if (wert == null || isNaN(Number(wert))) {
        L.push('    <de-gaap-ci:' + elem + ' contextRef="' + ctx +
               '" unitRef="EUR" decimals="2" xsi:nil="true"/>');
      } else {
        L.push('    <de-gaap-ci:' + elem + ' contextRef="' + ctx +
               '" unitRef="EUR" decimals="2">' + betrag(wert) + '</de-gaap-ci:' + elem + '>');
      }
    }
    L.push('    <!-- GAAP-Modul: Bilanz -->');
    var emit = {};
    function bilanzFakt(posId, wert) {
      var el = Taxonomie.bilanzElement(posId);
      if (!el || emit['B:' + el]) return;
      emit['B:' + el] = true;
      fakt(el, 'I', wert);
    }
    bilanzFakt('AKTIVA_SUMME', r.bilanz.summeAktiva);
    bilanzFakt('PASSIVA_SUMME', r.bilanz.summePassiva);
    Object.keys(r.bilanz.aktiva).forEach(function (id) { bilanzFakt(id, r.bilanz.aktiva[id]); });
    Object.keys(r.bilanz.passiva).forEach(function (id) { bilanzFakt(id, r.bilanz.passiva[id]); });

    var kap = r.bilanz.kapital;
    L.push('    <de-gaap-ci:' + Taxonomie.KAPITAL.eingefordertesKapital +
           ' contextRef="I" unitRef="EUR" decimals="2">' + betrag(kap.eingefordertesKapital) +
           '</de-gaap-ci:' + Taxonomie.KAPITAL.eingefordertesKapital + '>');
    if (kap.nichtEingefordert > 0) {
      L.push('    <de-gaap-ci:' + Taxonomie.KAPITAL.nichtEingefordert +
             ' contextRef="I" unitRef="EUR" decimals="2">' + betrag(kap.nichtEingefordert) +
             '</de-gaap-ci:' + Taxonomie.KAPITAL.nichtEingefordert + '>');
    }

    /* --- GAAP-Modul: GuV (Zeitraumwerte, context D) --- */
    if (!istEB && r.guv.schema) {
      L.push('    <!-- GAAP-Modul: Gewinn- und Verlustrechnung -->');
      var emitG = {};
      r.guv.schema.forEach(function (p) {
        var el = Taxonomie.guvElement(p.id);
        if (!el || emitG[el]) return;
        emitG[el] = true;
        if (r.guv.werte[p.id] != null) fakt(el, 'D', r.guv.werte[p.id]);
      });
    }

    L.push('  </xbrli:xbrl>');
    return { zeilen: L, warnungen: warn, stichtag: stichtag };
  }

  /* Reine XBRL-Instanz (standalone, validierbar). */
  function erzeugeXBRL(unternehmen, abschluss) {
    var inst = xbrlInstanz(unternehmen, abschluss);
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!-- E-Bilanz XBRL-Instanz, Kerntaxonomie ' + Taxonomie.VERSION +
      ' (Stand ' + Taxonomie.STAND + ') - erzeugt mit OpenBilanz -->\n' +
      inst.zeilen.join('\n').replace(/^  /, '').replace(/\n  /g, '\n');
    return { xml: xml, warnungen: inst.warnungen };
  }

  /* XBRL eingebettet in den ELSTER-EBilanz-Container (Übermittlungsform). */
  function erzeugeEBilanz(unternehmen, abschluss) {
    var inst = xbrlInstanz(unternehmen, abschluss);
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!-- E-Bilanz im ELSTER-EBilanz-Container, Kerntaxonomie ' + Taxonomie.VERSION +
      ' - erzeugt mit OpenBilanz. Übermittlung über ERiC. -->\n' +
      '<EBilanz xmlns="' + EBILANZ_NS + '" version="1">\n' +
      '  <stichtag>' + esc(ohneTrenn(inst.stichtag)) + '</stichtag>\n' +
      inst.zeilen.join('\n') + '\n' +
      '</EBilanz>\n';
    return { xml: xml, warnungen: inst.warnungen };
  }

  return { erzeugeXBRL: erzeugeXBRL, erzeugeEBilanz: erzeugeEBilanz };
});
