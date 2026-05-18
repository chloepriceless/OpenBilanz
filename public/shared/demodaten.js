/* ===========================================================================
 * demodaten.js  -  Beispiel-Datensätze zum gefahrlosen Ausprobieren
 * ---------------------------------------------------------------------------
 * Zwei vollständige Beispiel-GmbHs (operativ tätig und vermögensverwaltend)
 * mit je einer Eröffnungsbilanz und einem Jahresabschluss 2024. Reine Daten -
 * das Laden in den Speicher übernimmt app.js (demoLaden).
 *
 * Die Abschluss-Objekte enthalten nur die fallspezifischen Felder; app.js legt
 * sie über ein frisches neuerAbschluss()-Gerüst (Anhang-Methoden, Status usw.).
 * Die Werte sind so gewählt, dass jede Bilanz ausgeglichen ist - tests/run.js
 * prüft das ab.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Demodaten = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BEISPIELE = {
    operativ: {
      titel: 'operative GmbH',
      unternehmen: {
        name: 'Beispiel Software GmbH', rechtsform: 'GmbH',
        strasse: 'Lindenstraße 12', plz: '10115', ort: 'Berlin',
        registergericht: 'Amtsgericht Berlin (Charlottenburg)', hrNummer: 'HRB 100001',
        gruendungsdatum: '2024-01-02', geschaeftsjahrTyp: 'kalenderjahr',
        stammkapital: 25000, guvVerfahrenStandard: 'GKV', gmbhTyp: 'operativ',
        versteuerungsart: 'soll', kleinunternehmer: 'nein',
        geschaeftsfuehrer: ['Alex Beispiel']
      },
      abschluesse: [
        { id: 'A-demo-op-eb', art: 'EROEFFNUNGSBILANZ', stichtag: '2024-01-02',
          bezeichnung: 'Eröffnungsbilanz 02.01.2024',
          kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
          werte: { aktiva: { 'B.IV': 25000 }, passiva: {}, guv: {} } },
        { id: 'A-demo-op-ja', art: 'JAHRESABSCHLUSS',
          gjVon: '2024-01-01', gjBis: '2024-12-31', stichtag: '2024-12-31',
          bezeichnung: 'Jahresabschluss 2024', vorjahrId: 'A-demo-op-eb',
          guvVerfahren: 'GKV',
          kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
          werte: {
            aktiva:  { 'A.II': 15000, 'B.IV': 40000 },
            passiva: { 'P.B.2': 8000, 'P.C.4': 5000 },
            guv: { 'gkv.1': 120000, 'gkv.6': 60000, 'gkv.7': 5000,
                   'gkv.8': 30000, 'gkv.14': 8000 }
          },
          steuer: { hebesatz: 400 } }
      ]
    },
    vv: {
      titel: 'vermögensverwaltende GmbH',
      unternehmen: {
        name: 'Beispiel Kapital GmbH', rechtsform: 'GmbH',
        strasse: 'Parkallee 8', plz: '20095', ort: 'Hamburg',
        registergericht: 'Amtsgericht Hamburg', hrNummer: 'HRB 200002',
        gruendungsdatum: '2024-01-02', geschaeftsjahrTyp: 'kalenderjahr',
        stammkapital: 50000, guvVerfahrenStandard: 'GKV', gmbhTyp: 'vermögensverwaltend',
        versteuerungsart: 'soll', kleinunternehmer: 'nein',
        geschaeftsfuehrer: ['Chris Beispiel']
      },
      abschluesse: [
        { id: 'A-demo-vv-eb', art: 'EROEFFNUNGSBILANZ', stichtag: '2024-01-02',
          bezeichnung: 'Eröffnungsbilanz 02.01.2024',
          kapital: { gezeichnet: 50000, eingezahlt: 50000, eingefordertOffen: 0 },
          werte: { aktiva: { 'B.IV': 50000 }, passiva: {}, guv: {} } },
        { id: 'A-demo-vv-ja', art: 'JAHRESABSCHLUSS',
          gjVon: '2024-01-01', gjBis: '2024-12-31', stichtag: '2024-12-31',
          bezeichnung: 'Jahresabschluss 2024', vorjahrId: 'A-demo-vv-eb',
          guvVerfahren: 'GKV',
          kapital: { gezeichnet: 50000, eingezahlt: 50000, eingefordertOffen: 0 },
          werte: {
            aktiva:  { 'A.III': 45000, 'B.IV': 30000 },
            passiva: { 'P.B.2': 2000, 'P.C.4': 8000 },
            guv: { 'gkv.8': 6000, 'gkv.9': 20000, 'gkv.11': 3000, 'gkv.14': 2000 }
          },
          steuer: { hebesatz: 400, beteiligungsertraege: 20000 } }
      ]
    }
  };

  return { BEISPIELE: BEISPIELE };
});
