/* ===========================================================================
 * tests/run.js  -  Test-Suite der OpenBilanz
 * ---------------------------------------------------------------------------
 * Zero-Dependency-Testlauf. Prueft Rechenkern, Kontenmapping, Taxonomie,
 * XBRL-Erzeugung und Steuerberechnung.
 *
 *   node tests/run.js          (oder: npm test)
 *
 * Die tiefe XBRL-Validierung gegen die amtliche Taxonomie erfolgt zusätzlich
 * mit Arelle - siehe lib/validate.js.
 * ========================================================================= */
'use strict';

var Positionen = require('../public/shared/positionen.js');
var Berechnung = require('../public/shared/berechnung.js');
var Taxonomie  = require('../public/shared/taxonomie.js');
var SKR04      = require('../public/shared/skr04.js');
var Steuer     = require('../public/shared/steuer.js');
var Ustva      = require('../public/shared/ustva.js');
var Mt940      = require('../public/shared/mt940.js');
var Datev      = require('../public/shared/datev.js');
var JournalExport = require('../public/shared/journalexport.js');
var Gdpdu      = require('../public/shared/gdpdu.js');
var Pruefkette = require('../public/shared/pruefkette.js');
var XBRL       = require('../public/shared/xbrl.js');

var tests = [], pass = 0, fail = 0;
function test(name, fn) { tests.push({ name: name, fn: fn }); }
function eq(a, b, msg) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 0.005) throw new Error((msg || '') + ' erwartet ' + b + ', war ' + a);
  } else if (a !== b) throw new Error((msg || '') + ' erwartet ' + b + ', war ' + a);
}
function ok(c, msg) { if (!c) throw new Error(msg || 'Bedingung nicht erfuellt'); }

/* ---- Rechenkern: Bilanz / § 272 HGB ---------------------------------- */
test('Eröffnungsbilanz Teileinzahlung ist ausgeglichen', function () {
  var eb = { art: 'EROEFFNUNGSBILANZ', kapital: { gezeichnet: 25000, eingezahlt: 12500,
    eingefordertOffen: 0 }, werte: { aktiva: { 'B.IV': 12500 }, passiva: {}, guv: {} } };
  var r = Berechnung.berechne(eb).bilanz;
  ok(r.ausgeglichen, 'Bilanz nicht ausgeglichen');
  eq(r.summeAktiva, 12500, 'Summe Aktiva');
  eq(r.passiva['P.A.I'], 12500, 'Eingefordertes Kapital (P.A.I)');
  eq(r.kapital.nichtEingefordert, 12500, 'nicht eingeforderte Einlagen');
});
test('§ 272: eingefordertes, nicht eingezahltes Kapital in B.II', function () {
  var eb = { art: 'EROEFFNUNGSBILANZ', kapital: { gezeichnet: 25000, eingezahlt: 12500,
    eingefordertOffen: 5000 }, werte: { aktiva: { 'B.IV': 12500 }, passiva: {}, guv: {} } };
  var r = Berechnung.berechne(eb).bilanz;
  ok(r.ausgeglichen, 'Bilanz nicht ausgeglichen');
  eq(r.aktiva['B.II'], 5000, 'B.II enthaelt eingefordertes Kapital');
  eq(r.passiva['P.A.I'], 17500, 'Eingefordertes Kapital');
  eq(r.summeAktiva, 17500, 'Summe Aktiva');
});
test('§ 268 Abs. 3: nicht durch EK gedeckter Fehlbetrag', function () {
  // Stammkapital 25.000 aufgezehrt durch Verlust 85.000 -> EK = -60.000
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 5000 }, passiva: { 'P.C.4': 125000 },
      guv: { 'gkv.8': 85000 } } };
  var r = Berechnung.berechne(ja).bilanz;
  eq(r.fehlbetrag, 60000, 'Fehlbetrag');
  ok(r.ausgeglichen, 'Bilanz trotz Fehlbetrag ausgeglichen');
});

/* ---- Rechenkern: GuV -------------------------------------------------- */
test('GuV Gesamtkostenverfahren: Jahresüberschuss', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    werte: { aktiva: {}, passiva: {}, guv: { 'gkv.1': 100000, 'gkv.6': 60000,
      'gkv.8': 15000, 'gkv.14': 5000 } } };
  var g = Berechnung.rechneGuv(ja);
  eq(g.werte['gkv.15'], 20000, 'Ergebnis nach Steuern');
  eq(g.jahresergebnis, 20000, 'Jahresüberschuss');
});
test('GuV Kleinst-verkürzt (§ 275 Abs. 5)', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'KLEINST',
    werte: { aktiva: {}, passiva: {}, guv: { 'kst.1': 50000, 'kst.4': 30000, 'kst.7': 3000 } } };
  var g = Berechnung.rechneGuv(ja);
  eq(g.jahresergebnis, 17000, 'Jahresüberschuss Kleinst');
});
test('Jahresüberschuss fliesst in P.A.V', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 45000 }, passiva: {}, guv: { 'gkv.1': 50000, 'gkv.8': 30000 } } };
  var r = Berechnung.berechne(ja);
  eq(r.bilanz.passiva['P.A.V'], 20000, 'Jahresüberschuss in P.A.V');
});

/* ---- Größenklassen § 267/267a -------------------------------------- */
test('Größenklasse: Kleinst (neue Schwellen ab 2024)', function () {
  var k = Berechnung.bestimmeGroessenklasse(
    { bilanzsumme: 400000, umsatz: 800000, arbeitnehmer: 8 }, '2026-01-01', {});
  eq(k.klasse, 'KLEINST', 'Klasse'); eq(k.schwellensatz, 'neu', 'Schwellensatz');
});
test('Größenklasse: klein bei Ueberschreiten von 2 Kleinst-Schwellen', function () {
  // Bilanzsumme und Umsatz über Kleinst-Grenze -> 2-von-3-Regel -> klein
  var k = Berechnung.bestimmeGroessenklasse(
    { bilanzsumme: 2000000, umsatz: 2000000, arbeitnehmer: 8 }, '2026-01-01', {});
  eq(k.klasse, 'KLEIN', 'zwei Kleinst-Schwellen ueberschritten -> klein');
});
test('Größenklasse: alte Schwellen vor 2024', function () {
  var k = Berechnung.bestimmeGroessenklasse(
    { bilanzsumme: 400000, umsatz: 800000, arbeitnehmer: 8 }, '2022-01-01', {});
  eq(k.schwellensatz, 'alt', 'vor 2024 -> alte Schwellen');
});

/* ---- Pruefungen ------------------------------------------------------- */
test('Prüfung meldet unausgeglichene Bilanz', function () {
  var eb = { art: 'EROEFFNUNGSBILANZ', kapital: { gezeichnet: 25000, eingezahlt: 25000,
    eingefordertOffen: 0 }, werte: { aktiva: { 'B.IV': 99999 }, passiva: {}, guv: {} } };
  var p = Berechnung.pruefe(eb);
  ok(p.meldungen.some(function (m) { return m.stufe === 'fehler'; }), 'Fehler erwartet');
});

/* ---- SKR04-Kontenmapping (Integritaet) ------------------------------- */
test('SKR04: jedes Konto-pos ist eine gueltige HGB-Position', function () {
  var alle = Positionen.AKTIVA.concat(Positionen.PASSIVA);
  SKR04.KONTEN.forEach(function (k) {
    if (k.seite === 'AKTIV' || k.seite === 'PASSIV') {
      ok(k.pos, 'Konto ' + k.nr + ' ohne pos');
      ok(Positionen.finde(alle, k.pos), 'Konto ' + k.nr + ': unbekannte Position ' + k.pos);
    }
  });
});
test('SKR04: jede GuV-Kategorie ist in KAT_GUV definiert', function () {
  SKR04.KONTEN.forEach(function (k) {
    if (k.seite === 'ERTRAG' || k.seite === 'AUFWAND') {
      ok(SKR04.KAT_GUV[k.kat], 'Konto ' + k.nr + ': unbekannte Kategorie ' + k.kat);
    }
  });
});
test('SKR04: Kontonummern eindeutig', function () {
  var seen = {};
  SKR04.KONTEN.forEach(function (k) {
    ok(!seen[k.nr], 'Doppelte Kontonummer ' + k.nr);
    seen[k.nr] = true;
  });
});
test('SKR04: KAT_GUV-Ziele sind gueltige GuV-Positionen', function () {
  ['GKV', 'UKV', 'KLEINST'].forEach(function (v) {
    var schema = Positionen.guvSchema(v);
    Object.keys(SKR04.KAT_GUV).forEach(function (kat) {
      var id = SKR04.KAT_GUV[kat][v];
      ok(schema.some(function (p) { return p.id === id; }),
         'KAT_GUV.' + kat + '.' + v + ' -> unbekannte Position ' + id);
    });
  });
});
test('SKR04: vermögensverwaltende Konten vorhanden', function () {
  ok(SKR04.vvKonten().length >= 10, 'zu wenige vv-Konten');
  ok(SKR04.kontoFinden('0820'), 'Beteiligungen (0820) fehlt');
  ok(SKR04.kontoFinden('7000'), 'Erträge aus Beteiligungen (7000) fehlt');
});
test('SKR04: mehrere Bankkonten für verschiedene Banken', function () {
  ['1800', '1810', '1820', '1830', '1840'].forEach(function (nr) {
    var k = SKR04.kontoFinden(nr);
    ok(k, 'Bankkonto ' + nr + ' fehlt');
    eq(k.pos, 'B.IV', 'Bankkonto ' + nr + ' muss auf Position B.IV zeigen');
  });
});
test('SKR04: Eröffnungsbilanzkonto 9000 ohne Bilanzseite', function () {
  var ebk = SKR04.kontoFinden('9000');
  ok(ebk, 'Konto 9000 (EBK) fehlt');
  eq(ebk.seite, 'EBK', 'Konto 9000 muss seite EBK haben (kein AKTIV/PASSIV)');
  ok(!ebk.pos && !ebk.kat, 'EBK darf keine Bilanz-/GuV-Zuordnung haben');
});
test('SKR04: EB_KONTO-Mapping verweist auf gültige Positionen und Bestandskonten', function () {
  var alle = Positionen.AKTIVA.concat(Positionen.PASSIVA);
  ok(SKR04.EB_KONTO, 'EB_KONTO-Mapping fehlt');
  Object.keys(SKR04.EB_KONTO).forEach(function (pos) {
    ok(Positionen.finde(alle, pos), 'EB_KONTO: unbekannte HGB-Position ' + pos);
    var konto = SKR04.kontoFinden(SKR04.EB_KONTO[pos]);
    ok(konto, 'EB_KONTO[' + pos + '] -> Konto ' + SKR04.EB_KONTO[pos] + ' fehlt');
    ok(konto.seite === 'AKTIV' || konto.seite === 'PASSIV',
       'EB_KONTO[' + pos + '] -> Konto ' + konto.nr + ' ist kein Bestandskonto');
  });
});

/* ---- Taxonomie-Mapping ----------------------------------------------- */
test('Taxonomie: Bilanz-Elemente sind nicht leer', function () {
  Object.keys(Taxonomie.BILANZ).forEach(function (id) {
    ok(typeof Taxonomie.BILANZ[id] === 'string' && Taxonomie.BILANZ[id].length > 3,
       'Element für ' + id + ' ungueltig');
  });
  ok(Taxonomie.BILANZ['AKTIVA_SUMME'] === 'bs.ass', 'Bilanzsumme Aktiva');
  ok(Taxonomie.BILANZ['PASSIVA_SUMME'] === 'bs.eqLiab', 'Bilanzsumme Passiva');
});
test('Taxonomie: GuV-Elemente sind nicht leer', function () {
  Object.keys(Taxonomie.GUV).forEach(function (id) {
    ok(typeof Taxonomie.GUV[id] === 'string' && Taxonomie.GUV[id].length > 3,
       'GuV-Element für ' + id + ' ungueltig');
  });
});

/* ---- XBRL-Erzeugung --------------------------------------------------- */
test('XBRL: reine Instanz enthaelt xbrli:xbrl und Fakten', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2026-12-31', gjVon: '2026-01-01',
    gjBis: '2026-12-31', groessenklasse: 'KLEINST', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 40000 }, passiva: {}, guv: { 'gkv.1': 80000 } } };
  var x = XBRL.erzeugeXBRL({ name: 'Test GmbH', steuernummer: '1122334455666' }, ja).xml;
  ok(x.indexOf('<xbrli:xbrl') > -1, 'xbrli:xbrl fehlt');
  ok(x.indexOf('de-gaap-ci:bs.ass') > -1, 'Bilanzsumme-Fakt fehlt');
  ok(x.indexOf('contextRef="D"') > -1, 'Zeitraum-Kontext fehlt');
});
test('XBRL: EBilanz-Container mit Stichtag', function () {
  var eb = { art: 'EROEFFNUNGSBILANZ', stichtag: '2026-03-01', groessenklasse: 'KLEINST',
    kapital: { gezeichnet: 25000, eingezahlt: 12500, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 12500 }, passiva: {}, guv: {} } };
  var x = XBRL.erzeugeEBilanz({ name: 'Test GmbH', steuernummer: '1122334455666' }, eb).xml;
  ok(x.indexOf('<EBilanz') > -1, 'EBilanz-Container fehlt');
  ok(x.indexOf('<stichtag>20260301</stichtag>') > -1, 'Stichtag falsch formatiert');
});
test('XBRL: ist wohlgeformtes XML', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2026-12-31', gjVon: '2026-01-01',
    gjBis: '2026-12-31', groessenklasse: 'KLEIN', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 5000 }, passiva: {}, guv: { 'gkv.1': 10000 } } };
  var x = XBRL.erzeugeEBilanz({ name: 'T', steuernummer: '1234567890123' }, ja).xml;
  var fs = require('fs'), cp = require('child_process'),
      os = require('os'), p = require('path');
  try { cp.execSync('python3 --version', { stdio: 'ignore' }); }
  catch (e) { return; }   // ohne python3 nicht pruefbar -> ueberspringen
  var tmp = p.join(os.tmpdir(), 'gv-xmltest-' + Date.now() + '.xml');
  fs.writeFileSync(tmp, x);
  try {
    cp.execSync('python3 -c "import xml.dom.minidom,sys;xml.dom.minidom.parse(sys.argv[1])" ' +
      tmp, { stdio: 'ignore' });
  } catch (e) { fs.unlinkSync(tmp); throw new Error('XML nicht wohlgeformt'); }
  fs.unlinkSync(tmp);
});
test('XBRL: Kontennachweis gruppiert die Kontensalden nach HGB-Position', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2025-12-31',
    buchungen: [ { soll: '1800', haben: '4400', betrag: 1000 },
                 { soll: '6310', haben: '1800', betrag: 200 } ] };
  var kn = XBRL.kontennachweis(ja);
  var bIV = kn.filter(function (g) { return g.position === 'B.IV'; })[0];
  ok(bIV, 'B.IV (Bank) als Positionsgruppe');
  eq(bIV.konten[0].nr, '1800', 'Konto 1800 unter B.IV');
  eq(bIV.konten[0].saldo, 800, 'Saldo Konto 1800 = 1000 - 200');
});
test('XBRL: Haertefall-Feld bei Direkteingabe ohne Buchungen', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2025-12-31',
    werte: { aktiva: {}, passiva: {}, guv: {} } };
  var r = XBRL.erzeugeXBRL({ steuernummer: '1234567890123' }, ja);
  ok(r.xml.indexOf('transmissionNotYetPossible') >= 0, 'Haertefall-Feld gesetzt');
});

/* ---- Steuerberechnung (vv-GmbH) -------------------------------------- */
test('Steuer: § 8b - 95 % der Dividenden steuerfrei', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, beteiligungsertraege: 100000 } };
  var g = { werte: {}, jahresergebnis: 100000 };
  var s = Steuer.berechne(ja, g);
  eq(s.kst.zvE, 5000, 'zvE = 5 % von 100.000');
  eq(s.kst.betrag, 750, 'KSt 15 % von 5.000');
});
test('Steuer: Streubesitz < 10 % - Dividende voll KSt-pflichtig', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, beteiligungsertraege: 100000,
    beteiligungUnter10: true } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.kst.zvE, 100000, 'zvE voll steuerpflichtig');
});
test('Steuer: erweiterte Kürzung § 9 Nr. 1 GewStG', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, erweiterteKuerzung: true,
    immobilienertrag: 80000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 80000 });
  eq(s.gewst.betrag, 0, 'erweiterte Kürzung -> keine Gewerbesteuer auf Immobilienertrag');
});
test('Steuer: § 8b Abs. 7 - Anteile im Handelsbestand voll steuerpflichtig', function () {
  var g = { werte: {}, jahresergebnis: 100000 };
  var ohne = Steuer.berechne({ steuer: { hebesatz: 400, beteiligungsertraege: 100000 } }, g);
  var mit = Steuer.berechne({ steuer: { hebesatz: 400, beteiligungsertraege: 100000,
    finanzunternehmen: true } }, g);
  eq(ohne.kst.zvE, 5000, '95 % steuerfrei ohne § 8b Abs. 7');
  eq(mit.kst.zvE, 100000, 'voll steuerpflichtig mit § 8b Abs. 7');
});
test('Steuer: KSt 15 % + Soli 5,5 % korrekt', function () {
  var s = Steuer.berechne({ steuer: { hebesatz: 400 } }, { werte: {}, jahresergebnis: 100000 });
  eq(s.kst.betrag, 15000, 'KSt');
  eq(s.kst.soli, 825, 'Soli');
});
test('Steuer: KSt-Satz jahresabhängig (Investitionssofortprogramm)', function () {
  eq(Steuer.kstSatz(2027), 0.15, 'Satz VZ 2027');
  eq(Steuer.kstSatz(2028), 0.14, 'Satz VZ 2028');
  eq(Steuer.kstSatz(2030), 0.12, 'Satz VZ 2030');
  eq(Steuer.kstSatz(2033), 0.10, 'Satz ab VZ 2032');
  eq(Steuer.kstSatz(0), 0.15, 'ohne VZ -> aktueller Satz');
});
test('Steuer: KSt-Betrag folgt dem VZ des Abschlusses', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2028-12-31', steuer: { hebesatz: 400 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.kst.satz, 0.14, 'Satz aus VZ 2028');
  eq(s.kst.betrag, 14000, 'KSt VZ 2028');
});

/* ---- UStVA / Versteuerungsart ---------------------------------------- */
test('UStVA: Kennzahlen aus Erlös- und Vorsteuerkonten', function () {
  var bu = [
    { datum: '2026-03-10', soll: '1200', haben: '4400', betrag: 10000 },  // Erlös 19 %
    { datum: '2026-03-10', soll: '1200', haben: '3806', betrag: 1900 },   // USt 19 %
    { datum: '2026-03-12', soll: '1406', haben: '1800', betrag: 570 },    // Vorsteuer 19 %
    { datum: '2026-03-12', soll: '6300', haben: '1800', betrag: 3000 }
  ];
  var u = Ustva.berechne(bu, '2026-03-01', '2026-03-31');
  eq(u.kz81, 10000, 'Kz 81 (Umsätze 19 %)');
  eq(u.ust19, 1900, 'USt 19 %');
  eq(u.kz66, 570, 'Kz 66 (abziehbare Vorsteuer)');
  eq(u.kz83, 1330, 'Kz 83 (Zahllast) = 1900 - 570');
  eq(u.ustGebucht, 1900, 'gebuchte USt aus Konto 3806');
});
test('UStVA: Versteuerungsart - Standard ist Soll', function () {
  var u = Ustva.berechne([], null, null);
  eq(u.versteuerungsart, 'soll', 'Standard Soll');
  eq(u.hinweise.length, 0, 'keine Hinweise');
});
test('UStVA: Ist-Versteuerung warnt bei Erlös über Forderungskonto', function () {
  var bu = [{ datum: '2026-05-02', soll: '1200', haben: '4400', betrag: 5000 }];
  var ist  = Ustva.berechne(bu, null, null, { versteuerungsart: 'ist' });
  var soll = Ustva.berechne(bu, null, null, { versteuerungsart: 'soll' });
  eq(ist.versteuerungsart, 'ist', 'Art ist');
  eq(ist.hinweise.length, 1, 'Ist: Hinweis auf Forderungsbuchung');
  eq(soll.hinweise.length, 0, 'Soll: kein Hinweis');
});
test('UStVA: Ist-Versteuerung ohne Forderungsbuchung - kein Hinweis', function () {
  // Erlös direkt über Bank gebucht (Zahlungseingang) -> Ist-konform
  var bu = [{ datum: '2026-05-02', soll: '1800', haben: '4400', betrag: 5000 }];
  var u = Ustva.berechne(bu, null, null, { versteuerungsart: 'ist' });
  eq(u.hinweise.length, 0, 'kein Hinweis bei Buchung über Geldkonto');
});
test('UStVA: Zeitraumfilter grenzt Buchungen ab', function () {
  var bu = [
    { datum: '2026-01-15', soll: '1800', haben: '4400', betrag: 1000 },
    { datum: '2026-02-15', soll: '1800', haben: '4400', betrag: 2000 }
  ];
  eq(Ustva.berechne(bu, '2026-01-01', '2026-01-31').kz81, 1000, 'nur Januar-Umsatz');
  eq(Ustva.berechne(bu, null, null).kz81, 3000, 'ohne Filter beide Umsätze');
});
test('UStVA: Kleinunternehmer § 19 - keine USt, kein Vorsteuerabzug', function () {
  var bu = [{ datum: '2026-04-01', soll: '1406', haben: '1800', betrag: 570 }];
  var u = Ustva.berechne(bu, null, null, { kleinunternehmer: true });
  eq(u.kleinunternehmer, true, 'Kleinunternehmer-Flag');
  eq(u.kz66, 0, 'kein Vorsteuerabzug');
  eq(u.kz83, 0, 'keine Zahllast');
  ok(u.hinweise.length >= 1, 'Hinweis zur Kleinunternehmerregelung');
});
test('UStVA: § 13b - geschuldete Steuer und Vorsteuer heben sich auf', function () {
  var u = Ustva.berechne([], null, null, { rc13b: { netto19: 1000 } });
  eq(u.kz84, 190, 'Kz 84 = 19 % von 1.000');
  eq(u.kz66, 190, '§ 13b-Steuer zugleich als Vorsteuer abziehbar');
  eq(u.kz83, 0, 'netto Null bei voller Abzugsberechtigung');
});
test('UStVA: § 13b zusätzlich zur eigenen Umsatzsteuer', function () {
  var bu = [{ datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 10000 }];
  var u = Ustva.berechne(bu, null, null, { rc13b: { netto19: 2000 } });
  eq(u.ust19, 1900, 'eigene USt 19 %');
  eq(u.kz84, 380, '§ 13b-Steuer 19 % von 2.000');
  eq(u.kz83, 1900, 'Zahllast = eigene USt (1900 + 380 - 380)');
});
test('UStVA: steuerfreie Umsätze ohne Vorsteuerabzug melden Kz 48 + Hinweis', function () {
  var u = Ustva.berechne([], null, null, { steuerfrei: { ohneVorsteuer: 12000 } });
  eq(u.kz48, 12000, 'Kz 48 (steuerfrei ohne Vorsteuerabzug)');
  ok(u.hinweise.some(function (h) { return h.indexOf('Vorsteueraufteilung') >= 0; }),
     'Hinweis auf Vorsteueraufteilung § 15 Abs. 4');
});

/* ---- Steuer: Verlustvortrag / Hinzurechnungen / vGA ------------------ */
test('Steuer: Verlustvortrag mindert zu versteuerndes Einkommen', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, verlustvortrag: 30000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 50000 });
  eq(s.kst.zvE, 20000, 'zvE = 50.000 - 30.000 Verlustvortrag');
  eq(s.verlustvortrag.eingesetztKst, 30000, 'voller Verlustvortrag genutzt');
  eq(s.verlustvortrag.restKst, 0, 'kein Restvortrag');
});
test('Steuer: Verlustvortrag begrenzt auf das Einkommen, Rest bleibt', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, verlustvortrag: 80000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 50000 });
  eq(s.kst.zvE, 0, 'zvE auf 0 gemindert');
  eq(s.verlustvortrag.restKst, 30000, 'Restvortrag 80.000 - 50.000');
});
test('Steuer: Mindestbesteuerung § 10d - 60 % über 1 Mio EUR', function () {
  var r = Steuer.verlustabzug(2000000, 5000000);
  eq(r.abzug, 1600000, 'abziehbar: 1 Mio voll + 60 % von 1 Mio');
  eq(r.rest, 3400000, 'verbleibender Vortrag');
});
test('Steuer: GewSt-Hinzurechnung § 8 Nr. 1 über Freibetrag', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, zinsaufwand: 250000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.hinzurechnungGewSt, 12500, '25 % von (250.000 - 200.000 Freibetrag)');
  eq(s.gewst.gewerbeertrag, 112500, 'Gewerbeertrag inkl. Hinzurechnung');
});
test('Steuer: GewSt-Hinzurechnung bleibt unter Freibetrag aus', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, zinsaufwand: 50000,
    mietenUnbeweglich: 100000 } };   // Basis 50.000 + 50 % v. 100.000 = 100.000
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.hinzurechnungGewSt, 0, 'unter 200.000 EUR keine Hinzurechnung');
});
test('Steuer: verdeckte Gewinnausschüttung erhöht KSt- und GewSt-Basis', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, vga: 20000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 50000 });
  eq(s.kst.zvE, 70000, 'zvE = 50.000 + 20.000 vGA');
  eq(s.gewst.gewerbeertrag, 70000, 'Gewerbeertrag inkl. vGA');
  ok(s.hinweise.some(function (h) { return h.indexOf('Gewinnausschüttung') >= 0; }),
     'vGA-Hinweis vorhanden');
});

/* ---- Bankimport MT940 ------------------------------------------------ */
test('MT940: liest Umsätze mit Betrag, Richtung und Verwendungszweck', function () {
  var sta = [
    ':20:STARTUMS', ':25:10010010/1234567', ':28C:00012/001',
    ':60F:C240301EUR1000,00',
    ':61:2403150315C1500,00NTRFNONREF',
    ':86:166?00GUTSCHRIFT?20Rechnung 2024-005?32MUSTER GMBH',
    ':61:2403160316D250,50NTRFNONREF',
    ':86:177?00LASTSCHRIFT?20Stromabschlag?32STADTWERKE',
    ':62F:C240331EUR2249,50'
  ].join('\n');
  var r = Mt940.parse(sta);
  eq(r.tx.length, 2, 'zwei Umsätze');
  eq(r.tx[0].datum, '2024-03-15', 'Wertstellungsdatum');
  eq(r.tx[0].betrag, 1500, 'Betrag Gutschrift');
  eq(r.tx[0].eingang, true, 'C-Kennzeichen = Eingang');
  eq(r.tx[0].zweck, 'Rechnung 2024-005', 'Verwendungszweck aus ?20');
  eq(r.tx[0].partner, 'MUSTER GMBH', 'Partner aus ?32');
  eq(r.tx[1].eingang, false, 'D-Kennzeichen = Ausgang');
  eq(r.tx[1].betrag, 250.5, 'Betrag Lastschrift');
});
test('MT940: meldet Fehler bei fremdem Format', function () {
  ok(Mt940.parse('irgendein Text ohne Tags').fehler, 'Fehler bei Nicht-MT940-Datei');
});

/* ---- DATEV-Import (EXTF) --------------------------------------------- */
test('DATEV: liest EXTF-Buchungsstapel mit Soll/Haben-Richtung', function () {
  var extf = [
    '"EXTF";700;21;"Buchungsstapel";13;20260518;;"";"OpenBilanz";"";;;20260101;4;' +
      '20260101;20261231;;;1;;0;"EUR"',
    'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;' +
      'WKZ Basis-Umsatz;Konto;Gegenkonto;BU-Schluessel;Belegdatum;Belegfeld 1;' +
      'Belegfeld 2;Skonto;Buchungstext',
    '1500,00;S;EUR;;;;1800;4400;;1503;;;;"Erloes Maerz"',
    '250,50;H;EUR;;;;1800;6310;;1603;;;;"Miete"'
  ].join('\r\n');
  var r = Datev.parse(extf);
  eq(r.buchungen.length, 2, 'zwei Buchungen');
  eq(r.jahr, '2026', 'Jahr aus dem Kopfsatz');
  eq(r.buchungen[0].soll, '1800', 'S-Kennzeichen: Konto ist Soll');
  eq(r.buchungen[0].haben, '4400', 'Gegenkonto ist Haben');
  eq(r.buchungen[0].betrag, 1500, 'Betrag');
  eq(r.buchungen[0].datum, '2026-03-15', 'Belegdatum TTMM + Jahr');
  eq(r.buchungen[1].soll, '6310', 'H-Kennzeichen: Gegenkonto ist Soll');
  eq(r.buchungen[1].haben, '1800', 'Konto ist Haben');
});
test('DATEV: meldet Fehler ohne EXTF-Kopfzeile', function () {
  ok(Datev.parse('a;b;c\n1;2;3').fehler, 'Fehler ohne EXTF-Kopf');
});

/* ---- Journal-Export CSV / JSON --------------------------------------- */
test('Journal-Export: CSV mit Kopfzeile und einer Zeile je Buchung', function () {
  var a = { buchungen: [
    { datum: '2026-03-01', soll: '1800', haben: '4400', betrag: 1190, text: 'Erlös', fest: true },
    { datum: '2026-03-05', soll: '6300', haben: '1800', betrag: 50, text: 'Büro' }
  ] };
  var zeilen = JournalExport.csv(a).replace(/^﻿/, '').replace(/\r\n$/, '').split('\r\n');
  eq(zeilen.length, 3, 'Kopfzeile + 2 Buchungen');
  eq(zeilen[0], 'Datum;Soll;Haben;Betrag;Text;Festgeschrieben', 'Kopfzeile');
  ok(zeilen[1].indexOf('1190,00') >= 0, 'Betrag mit Dezimalkomma');
  ok(zeilen[1].indexOf(';ja') >= 0 && zeilen[2].indexOf(';nein') >= 0, 'Festschreibungs-Spalte');
});
test('Journal-Export: JSON ist gültig und enthält die Buchungen', function () {
  var a = { id: 'A-1', bezeichnung: 'JA 2026', buchungen: [
    { datum: '2026-03-01', soll: '1800', haben: '4400', betrag: 100, text: 'x' }
  ] };
  var o = JSON.parse(JournalExport.json(a));
  eq(o.format, 'openbilanz-journal', 'Format-Kennung');
  eq(o.buchungen.length, 1, 'eine Buchung');
  eq(o.buchungen[0].betrag, 100, 'Betrag');
  eq(o.buchungen[0].festgeschrieben, false, 'Festschreibungs-Flag');
});
/* ---- GDPdU-Export ---------------------------------------------------- */
test('GDPdU-Export: CSV-Datenzeilen und beschreibende index.xml', function () {
  var a = { bezeichnung: 'JA 2026', gjVon: '2026-01-01', gjBis: '2026-12-31',
    buchungen: [ { datum: '2026-03-01', soll: '1800', haben: '4400',
      betrag: 1190, text: 'Erlös' } ] };
  var g = Gdpdu.erzeuge(a, { name: 'Test GmbH', ort: 'Berlin' });
  var zeilen = g.csv.replace(/\r\n$/, '').split('\r\n');
  eq(zeilen.length, 1, 'eine Datenzeile (ohne Kopf - Spalten beschreibt index.xml)');
  ok(zeilen[0].indexOf('1190,00') >= 0, 'Betrag mit Dezimalkomma');
  ok(g.indexXml.indexOf('<!DOCTYPE DataSet') >= 0, 'GDPdU-DTD referenziert');
  ok(g.indexXml.indexOf('<VariableColumn>') >= 0, 'Spaltenbeschreibung enthalten');
  ok(g.indexXml.indexOf(g.csvDateiname) >= 0, 'index.xml verweist auf die CSV-Datei');
});

/* ---- Prüfkette (Integrität festgeschriebener Buchungen) -------------- */
test('Prüfkette: SHA-256 stimmt mit den FIPS-180-4-Testvektoren', function () {
  eq(Pruefkette.sha256('abc'),
     'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256("abc")');
  eq(Pruefkette.sha256(''),
     'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA-256("")');
});
test('Prüfkette: verkettet festgeschriebene Buchungen und prüft sie', function () {
  var bu = [
    { id: 'B-1', datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 1190, text: 'a', fest: true },
    { id: 'B-2', datum: '2026-01-12', soll: '6300', haben: '1800', betrag: 50, text: 'b', fest: true },
    { id: 'B-3', datum: '2026-01-15', soll: '1800', haben: '4400', betrag: 200, text: 'c' }
  ];
  Pruefkette.fortschreiben(bu);
  ok(bu[0].hash && bu[1].hash, 'festgeschriebene Buchungen erhalten einen Hash');
  ok(!bu[2].hash, 'nicht festgeschriebene Buchung bleibt ohne Hash');
  var r = Pruefkette.pruefe(bu);
  eq(r.ok, true, 'Kette intakt');
  eq(r.anzahl, 2, 'zwei verkettete Buchungen');
});
test('Prüfkette: erkennt nachträgliche Änderung einer Buchung', function () {
  var bu = [
    { id: 'B-1', datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 1190, text: 'a', fest: true },
    { id: 'B-2', datum: '2026-01-12', soll: '6300', haben: '1800', betrag: 50, text: 'b', fest: true }
  ];
  Pruefkette.fortschreiben(bu);
  bu[0].betrag = 9999;   // Manipulation nach der Festschreibung
  var r = Pruefkette.pruefe(bu);
  eq(r.ok, false, 'Manipulation erkannt');
  eq(r.bruchId, 'B-1', 'die gebrochene Buchung wird benannt');
});
test('Prüfkette: spätere Festschreibung verlängert die Kette stabil', function () {
  var bu = [
    { id: 'B-1', datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 100, text: 'a', fest: true }
  ];
  Pruefkette.fortschreiben(bu);
  var h1 = bu[0].hash;
  bu.push({ id: 'B-2', datum: '2026-02-01', soll: '1800', haben: '4400', betrag: 200, text: 'b', fest: true });
  Pruefkette.fortschreiben(bu);
  eq(bu[0].hash, h1, 'bestehende Buchung behält ihren Hash');
  eq(Pruefkette.pruefe(bu).ok, true, 'die verlängerte Kette ist intakt');
});
test('Prüfkette: Storno-Markierung bricht die Kette nicht', function () {
  var bu = [
    { id: 'B-1', datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 100, text: 'a', fest: true }
  ];
  Pruefkette.fortschreiben(bu);
  bu[0].storniert = true;   // zulässige Storno-Markierung, kein Inhaltswechsel
  eq(Pruefkette.pruefe(bu).ok, true, 'Storno-Flag zählt nicht zum Buchungsinhalt');
});

/* ---- Lauf ------------------------------------------------------------- */
console.log('OpenBilanz - Test-Suite\n');
tests.forEach(function (t) {
  try { t.fn(); pass++; console.log('  OK    ' + t.name); }
  catch (e) { fail++; console.log('  FAIL  ' + t.name + '\n        -> ' + e.message); }
});
console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
