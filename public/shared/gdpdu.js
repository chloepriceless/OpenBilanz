/* ===========================================================================
 * gdpdu.js  -  GDPdU-Export (Datenträgerüberlassung, Z3-Zugriff)
 * ---------------------------------------------------------------------------
 * Erzeugt eine Datenträgerüberlassung nach dem GDPdU-Beschreibungsstandard:
 * das Buchungsjournal als CSV (reine Datenzeilen) und eine beschreibende
 * index.xml, die Spalten, Typen und Trennzeichen für die Prüfsoftware der
 * Finanzverwaltung (z. B. IDEA) definiert.
 *
 * erzeuge(abschluss, unternehmen) -> { csvDateiname, csv, indexXml }
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gdpdu = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function feld(s) {
    s = String(s == null ? '' : s);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function xmlEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function betrag2(v) {
    return (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
  }

  /* Spaltenbeschreibung des Buchungsjournals (Reihenfolge = CSV-Reihenfolge). */
  var SPALTEN = [
    { name: 'Datum',           typ: 'date' },
    { name: 'Soll',            typ: 'alpha' },
    { name: 'Haben',           typ: 'alpha' },
    { name: 'Betrag',          typ: 'num' },
    { name: 'Buchungstext',    typ: 'alpha' },
    { name: 'Festgeschrieben', typ: 'alpha' }
  ];

  /* CSV: reine Datenzeilen (ohne Kopf - die Spalten beschreibt die index.xml). */
  function csv(abschluss) {
    var bu = (abschluss && abschluss.buchungen) || [];
    var zeilen = bu.map(function (b) {
      return [
        feld(b.datum), feld(b.soll), feld(b.haben),
        betrag2(b.betrag).replace('.', ','), feld(b.text),
        b.fest ? 'ja' : 'nein'
      ].join(';');
    });
    return zeilen.join('\r\n') + (zeilen.length ? '\r\n' : '');
  }

  /* index.xml nach GDPdU-Beschreibungsstandard (gdpdu-01-09-2004.dtd). */
  function indexXml(abschluss, unternehmen, csvDateiname) {
    var a = abschluss || {}, u = unternehmen || {};
    var von = a.gjVon || a.stichtag || '';
    var bis = a.gjBis || a.stichtag || '';
    var spaltenXml = SPALTEN.map(function (s) {
      var typ = s.typ === 'num' ? '<Numeric><Accuracy>2</Accuracy></Numeric>'
        : s.typ === 'date' ? '<Date><Format>YYYY-MM-DD</Format></Date>'
        : '<AlphaNumeric/>';
      return '        <VariableColumn>\n' +
        '          <Name>' + xmlEsc(s.name) + '</Name>\n' +
        '          ' + typ + '\n' +
        '        </VariableColumn>';
    }).join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE DataSet SYSTEM "gdpdu-01-09-2004.dtd">\n' +
      '<DataSet>\n' +
      '  <Version>1.0</Version>\n' +
      '  <DataSupplier>\n' +
      '    <Name>' + xmlEsc(u.name || 'GmbH') + '</Name>\n' +
      '    <Location>' + xmlEsc(u.ort || '') + '</Location>\n' +
      '    <Comment>Datenträgerüberlassung aus OpenBilanz</Comment>\n' +
      '  </DataSupplier>\n' +
      '  <Media>\n' +
      '    <Name>Buchungsjournal ' + xmlEsc(a.bezeichnung || '') + '</Name>\n' +
      '    <Table>\n' +
      '      <URL><File>' + xmlEsc(csvDateiname) + '</File></URL>\n' +
      '      <Name>Buchungsjournal</Name>\n' +
      '      <Description>Buchungssätze des Abschlusses</Description>\n' +
      '      <Validity><Range><From>' + xmlEsc(von) + '</From><To>' + xmlEsc(bis) +
        '</To></Range><Format>YYYY-MM-DD</Format></Validity>\n' +
      '      <UTF8/>\n' +
      '      <DecimalSymbol>,</DecimalSymbol>\n' +
      '      <DigitGroupingSymbol>.</DigitGroupingSymbol>\n' +
      '      <Variable-Length>\n' +
      '        <ColumnDelimiter>;</ColumnDelimiter>\n' +
      '        <RecordDelimiter>&#13;&#10;</RecordDelimiter>\n' +
      '        <TextEncapsulator>"</TextEncapsulator>\n' +
      spaltenXml + '\n' +
      '      </Variable-Length>\n' +
      '    </Table>\n' +
      '  </Media>\n' +
      '</DataSet>\n';
  }

  function erzeuge(abschluss, unternehmen) {
    var basis = String((abschluss && abschluss.bezeichnung) || 'Abschluss')
      .replace(/[^\w]+/g, '_');
    var csvName = 'Buchungsjournal_' + basis + '.csv';
    return {
      csvDateiname: csvName,
      csv: csv(abschluss),
      indexXml: indexXml(abschluss, unternehmen, csvName)
    };
  }

  return { erzeuge: erzeuge, csv: csv, indexXml: indexXml, SPALTEN: SPALTEN };
});
