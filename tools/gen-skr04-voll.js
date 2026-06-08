/* ===========================================================================
 * gen-skr04-voll.js  -  Generator für den vollständigen SKR04-Kontenrahmen
 * ---------------------------------------------------------------------------
 * Erzeugt public/shared/skr04-voll.js (ZUSATZ_KONTEN) aus der ERPNext-SKR04-
 * Quelle. Übernommen werden NUR faktische Daten (Kontonummer, Kurzbezeichnung,
 * HGB-Zuordnung) — Fakten sind nicht urheberrechtlich geschützt.
 *
 * Quelle (Build-Input, NICHT im Repo / GPLv3): tools/skr04-erpnext-source.json
 *   Download: https://raw.githubusercontent.com/frappe/erpnext/develop/
 *     erpnext/accounts/doctype/account/chart_of_accounts/verified/de_kontenplan_SKR04.json
 *
 * Strategie (siehe .planning/SKR04-VOLLSTAENDIG-DESIGN.md):
 *   - Bilanz (Klassen 0-3): HGB-Position aus dem Baumpfad (verifiziert).
 *   - GuV (Klassen 4-7): kat aus Nummernkreis (konservativ).
 *   - Kuratierte App-Konten (skr04.js KONTEN) haben Vorrang und werden NICHT
 *     überschrieben (bleiben Ground-Truth inkl. vv/eb-Flags + Sonderfälle).
 *   - Gefiltert: Personenkonten (5-stellig), Gruppen, Klasse 9 (statistisch).
 *
 * Lauf:  node tools/gen-skr04-voll.js
 * ========================================================================= */
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var SRC = path.join(__dirname, 'skr04-erpnext-source.json');
var OUT = path.join(ROOT, 'public', 'shared', 'skr04-voll.js');
var SKR04 = require(path.join(ROOT, 'public', 'shared', 'skr04.js'));

if (!fs.existsSync(SRC)) {
  console.error('FEHLT: ' + SRC + '\nDownload-URL siehe Datei-Header.');
  process.exit(1);
}
var erp = JSON.parse(fs.readFileSync(SRC, 'utf8'));

/* --- Baum -> echte 4-stellige Buchungs-Blätter (kein group, keine Kinder) --- */
var leaves = []; // {nr, name, path:[...]}
function walk(node, p) {
  Object.keys(node).forEach(function (k) {
    var v = node[k];
    if (!v || typeof v !== 'object') return;
    var children = {}, has = false;
    Object.keys(v).forEach(function (kk) {
      if (v[kk] && typeof v[kk] === 'object') { children[kk] = v[kk]; has = true; }
    });
    if (v.account_number && !has && v.is_group !== 1) {
      leaves.push({ nr: String(v.account_number), name: k.trim(), path: p.slice() });
    }
    if (has) walk(children, p.concat(k.trim()));
  });
}
walk(erp.tree, []);

/* --- Bilanz: Pfad -> {seite,pos} (Klassen 0-3) --- */
function pfadZuPos(p) {
  var j = p.join(' | ');
  if (/^Aktiva/.test(j)) {
    if (/A - Anlageverm.*I - Immateriell/.test(j)) return { seite: 'AKTIV', pos: 'A.I' };
    if (/A - Anlageverm.*II - Sachanlagen/.test(j)) return { seite: 'AKTIV', pos: 'A.II' };
    if (/A - Anlageverm.*III - Finanzanlagen/.test(j)) return { seite: 'AKTIV', pos: 'A.III' };
    if (/B - Umlaufverm.*I - Vorr/.test(j)) return { seite: 'AKTIV', pos: 'B.I' };
    if (/B - Umlaufverm.*II - Forderungen/.test(j)) return { seite: 'AKTIV', pos: 'B.II' };
    if (/B - Umlaufverm.*III - Wertpapiere/.test(j)) return { seite: 'AKTIV', pos: 'B.III' };
    if (/B - Umlaufverm.*IV - Kassen/.test(j)) return { seite: 'AKTIV', pos: 'B.IV' };
    if (/C - Rechnungsabgrenz/.test(j)) return { seite: 'AKTIV', pos: 'C' };
    if (/D - Aktive latente/.test(j)) return { seite: 'AKTIV', pos: 'D' };
  }
  if (/^Passiva - Eigenkapital/.test(j)) {
    if (/I - Gezeichnetes/.test(j)) return { seite: 'PASSIV', pos: 'P.A.I' };
    if (/II - Kapitalr/.test(j)) return { seite: 'PASSIV', pos: 'P.A.II' };
    if (/III - Gewinnr/.test(j)) return { seite: 'PASSIV', pos: 'P.A.III' };
    if (/IV - Gewinnvortrag/.test(j)) return { seite: 'PASSIV', pos: 'P.A.IV' };
    return null;   // unerkannter EK-Unterpfad -> sichtbar im unmapped-Report (nicht still P.A.III)
  }
  if (/^Passiva - Verbindlichkeiten/.test(j)) {
    if (/B - R.ckstellungen.*1 - /.test(j)) return { seite: 'PASSIV', pos: 'P.B.1' };
    if (/B - R.ckstellungen.*2 - /.test(j)) return { seite: 'PASSIV', pos: 'P.B.2' };
    if (/B - R.ckstellungen.*3 - /.test(j)) return { seite: 'PASSIV', pos: 'P.B.3' };
    if (/C - Verbindlichk.*1 - Anleihen/.test(j)) return { seite: 'PASSIV', pos: 'P.C.1' };
    if (/C - Verbindlichk.*2 - Verb. gg. Kredit/.test(j)) return { seite: 'PASSIV', pos: 'P.C.2' };
    if (/C - Verbindlichk.*3 - erhaltene/.test(j)) return { seite: 'PASSIV', pos: 'P.C.3' };
    if (/C - Verbindlichk.*4 - Verb. aus Lief/.test(j)) return { seite: 'PASSIV', pos: 'P.C.4' };
    if (/C - Verbindlichk.*5 - Verb. aus der Annahme/.test(j)) return { seite: 'PASSIV', pos: 'P.C.5' };
    if (/C - Verbindlichk.*6 - Verb. gg. verbund/.test(j)) return { seite: 'PASSIV', pos: 'P.C.6' };
    if (/C - Verbindlichk.*7 - Verb. gg. Untern/.test(j)) return { seite: 'PASSIV', pos: 'P.C.7' };
    if (/C - Verbindlichk.*8 - sonstige/.test(j)) return { seite: 'PASSIV', pos: 'P.C.8' };
    if (/D - Rechnungsabgrenz/.test(j)) return { seite: 'PASSIV', pos: 'P.D' };
    if (/E - Passive latente/.test(j)) return { seite: 'PASSIV', pos: 'P.E' };
  }
  return null;
}

/* --- GuV: Nummernkreis -> kat (Klassen 4-7), konservativ --- */
function nrZuKat(nrS) {
  var n = parseInt(nrS, 10);
  if (n >= 4800 && n <= 4819) return 'bestand';
  if (n >= 4820 && n <= 4829) return 'eigenleistung';
  if (n >= 4830 && n <= 4859) return 'sonstertrag';
  if (n >= 4860 && n <= 4869) return 'umsatz';            // Grundstückserträge V+V
  if (n >= 4000 && n <= 4799) return 'umsatz';            // Umsatzerlöse (inkl. Erlösschmälerungen)
  if (n >= 4870 && n <= 4999) return 'sonstertrag';
  if (n >= 5000 && n <= 5999) return 'material';
  if (n >= 6000 && n <= 6199) return 'personal';
  if (n >= 6200 && n <= 6299) return 'abschreibung';
  if (n >= 6300 && n <= 6999) return 'sonstaufwand';
  if (n >= 7000 && n <= 7009) return 'beteiligungsertrag';
  if (n >= 7010 && n <= 7099) return 'finanzanlageertrag';
  if (n >= 7100 && n <= 7199) return 'zinsertrag';
  if (n >= 7200 && n <= 7299) return 'finanzabschreibung';
  if (n >= 7300 && n <= 7399) return 'zinsaufwand';
  if (n >= 7400 && n <= 7499) return 'sonstertrag';       // a.o. Erträge (GKV: sonstige)
  if (n >= 7500 && n <= 7599) return 'sonstaufwand';      // a.o. Aufwendungen
  if (n >= 7600 && n <= 7649) return 'ertragsteuer';
  if (n >= 7650 && n <= 7699) return 'sonststeuer';
  if (n >= 7700 && n <= 7999) return 'sonstaufwand';
  return null;
}

var ERTRAG_KAT = { umsatz: 1, bestand: 1, eigenleistung: 1, sonstertrag: 1,
  beteiligungsertrag: 1, finanzanlageertrag: 1, zinsertrag: 1 };

/* Bekannte ERPNext-Einordnungsfehler (gegen HGB/Ground-Truth korrigiert).
 * Sanity-Check unten verifiziert, dass danach KEINE Klasse/Name-vs-Seite-
 * Widersprüche mehr offen sind (ausser bewusst akzeptierten Verrechnungskonten). */
var OVERRIDE = {
  '1181': { seite: 'AKTIV', pos: 'B.I' },    // geleistete Anz. auf Vorräte (ERPNext: A.I)
  '1184': { seite: 'AKTIV', pos: 'B.I' },
  '1185': { seite: 'AKTIV', pos: 'B.I' },
  '1186': { seite: 'AKTIV', pos: 'B.I' },
  '1895': { seite: 'PASSIV', pos: 'P.C.2' }  // Verb. gg. Kreditinstituten (ERPNext: B.IV)
};
var SANITY_OK = { '3695': 1 };               // bewusst akzeptiert: Anz.-Verrechnungskonto (Forderungscharakter, B.II)

/* --- App-Ground-Truth: Nummern + Zuordnung --- */
var appNr = {};
SKR04.KONTEN.forEach(function (k) { appNr[k.nr] = k; });

var zusatz = [], unmapped = [], diskrepanz = [], gefiltert = 0;

leaves.forEach(function (lf) {
  var nr = lf.nr;
  if (nr.length !== 4) { gefiltert++; return; }          // Personenkonten o.ä.
  if (nr[0] === '8' || nr[0] === '9') { gefiltert++; return; } // statistisch/Vortrag
  var seitePos;
  var kl = nr[0];
  if (kl >= '0' && kl <= '3') {
    var bp = pfadZuPos(lf.path);
    if (bp) seitePos = { seite: bp.seite, pos: bp.pos };
  } else if (kl >= '4' && kl <= '7') {
    var kat = nrZuKat(nr);
    if (kat) seitePos = { seite: ERTRAG_KAT[kat] ? 'ERTRAG' : 'AUFWAND', kat: kat };
  }
  if (OVERRIDE[nr]) seitePos = { seite: OVERRIDE[nr].seite, pos: OVERRIDE[nr].pos, kat: OVERRIDE[nr].kat };
  // Ground-Truth-Vergleich (Konten, die in beiden sind)
  if (appNr[nr]) {
    var a = appNr[nr];
    if (seitePos) {
      var gleich = seitePos.seite === a.seite &&
        (seitePos.pos || null) === (a.pos || null) &&
        (seitePos.kat || null) === (a.kat || null);
      if (!gleich) diskrepanz.push(nr + ' ' + a.name + ': APP=' + a.seite + '/' +
        (a.pos || a.kat) + '  GEN=' + seitePos.seite + '/' + (seitePos.pos || seitePos.kat));
    }
    return; // App-Vorrang: nicht in ZUSATZ
  }
  if (!seitePos) { unmapped.push(nr + ' ' + lf.name + '  [' + lf.path.join(' > ') + ']'); return; }
  var e = { nr: nr, name: lf.name, seite: seitePos.seite };
  if (seitePos.pos) e.pos = seitePos.pos; else e.kat = seitePos.kat;
  zusatz.push(e);
});

zusatz.sort(function (a, b) { return a.nr < b.nr ? -1 : a.nr > b.nr ? 1 : 0; });

/* --- skr04-voll.js schreiben (UMD) --- */
var header =
'/* ===========================================================================\n' +
' * skr04-voll.js  -  AUTOMATISCH ERZEUGT von tools/gen-skr04-voll.js\n' +
' * ---------------------------------------------------------------------------\n' +
' * Zusatz-Konten des vollständigen SKR04 (über die kuratierte skr04.js-Auswahl\n' +
' * hinaus). NICHT von Hand ändern - mit `node tools/gen-skr04-voll.js` neu bauen.\n' +
' *\n' +
' * Daten faktisch (Kontonr + Kurzbezeichnung + HGB-Zuordnung). Kontostruktur:\n' +
' * amtlicher DATEV-SKR04 (öffentlich). HGB-/GuV-Zuordnung abgeleitet aus der\n' +
' * ERPNext-SKR04-Vorlage (frappe/erpnext, GPLv3) - nur faktische Zuordnung,\n' +
' * gegen die kuratierte Auswahl (Ground-Truth) kalibriert. Kuratierte Konten in\n' +
' * skr04.js haben Vorrang. Siehe .planning/SKR04-VOLLSTAENDIG-DESIGN.md.\n' +
' * ========================================================================= */\n';
var body =
'(function (root, factory) {\n' +
'  var api = factory();\n' +
'  if (typeof module !== \'undefined\' && module.exports) module.exports = api;\n' +
'  else { root.SKR04_VOLL_KONTEN = api; }\n' +
'})(typeof self !== \'undefined\' ? self : this, function () {\n' +
'  \'use strict\';\n' +
'  return ' + JSON.stringify(zusatz, null, 0).replace(/\},\{/g, '},\n    {').replace(/^\[/, '[\n    ').replace(/\]$/, '\n  ]') + ';\n' +
'});\n';
fs.writeFileSync(OUT, header + body);

/* --- Report --- */
console.log('=== SKR04-Voll-Generator ===');
console.log('ERPNext-Blätter (4-stellig, buchbar): ' + leaves.length);
console.log('Gefiltert (Personen/statistisch/Vortrag): ' + gefiltert);
console.log('ZUSATZ_KONTEN geschrieben: ' + zusatz.length + ' -> ' + path.relative(ROOT, OUT));
console.log('  davon Bilanz (0-3): ' + zusatz.filter(function (z) { return z.pos; }).length +
  ', GuV (4-7): ' + zusatz.filter(function (z) { return z.kat; }).length);
console.log('Unmapped (NICHT aufgenommen, würden verpuffen): ' + unmapped.length);
unmapped.forEach(function (u) { console.log('  ? ' + u); });
console.log('Ground-Truth-Diskrepanzen (App gewinnt): ' + diskrepanz.length);
diskrepanz.forEach(function (d) { console.log('  ! ' + d); });
console.log('6420 vorhanden? ' + (zusatz.some(function (z) { return z.nr === '6420'; }) ? 'JA' : 'NEIN') +
  '  -> ' + JSON.stringify(zusatz.filter(function (z) { return z.nr === '6420'; })));

/* Sanity-Check: Klasse/Name-vs-Seite-Widersprüche (nach Override). */
var verdacht = [];
zusatz.forEach(function (k) {
  var kl = k.nr[0], name = k.name, pos = k.pos || '';
  if (SANITY_OK[k.nr]) return;
  if (/Verbindlichk|^Verb\./i.test(name) && k.seite === 'AKTIV') verdacht.push(k.nr + ' VERB auf AKTIV: ' + name);
  else if (/Forderung|Ausleihung/i.test(name) && k.seite === 'PASSIV') verdacht.push(k.nr + ' FORDERUNG auf PASSIV: ' + name);
  else if (kl === '0' && !/^A\./.test(pos)) verdacht.push(k.nr + ' Kl0 pos nicht A.*: ' + pos);
  else if (kl === '1' && k.seite === 'AKTIV' && /^A\./.test(pos)) verdacht.push(k.nr + ' Kl1 auf Anlageverm: ' + name);
  else if (kl === '2' && k.seite !== 'PASSIV') verdacht.push(k.nr + ' Kl2 nicht PASSIV: ' + name);
  else if (kl === '3' && k.seite !== 'PASSIV') verdacht.push(k.nr + ' Kl3 nicht PASSIV: ' + name);
  // GuV-Struktur (deterministisch, false-positive-frei): Kl4 = Ertrag, Kl5/6 = Aufwand.
  // (Kl7 ist gemischt: Finanzerträge/-aufwand/Steuern -> per Nummernkreis, hier nicht geprüft.)
  else if (kl === '4' && k.seite !== 'ERTRAG') verdacht.push(k.nr + ' Kl4 nicht ERTRAG: ' + name);
  else if ((kl === '5' || kl === '6') && k.seite !== 'AUFWAND') verdacht.push(k.nr + ' Kl5/6 nicht AUFWAND: ' + name);
});
console.log('Sanity-Check (Klasse/Name-vs-Seite) offene Verdachtsfälle: ' + verdacht.length);
verdacht.forEach(function (v) { console.log('  ⚠ ' + v); });
if (verdacht.length) { console.error('SANITY-CHECK NICHT SAUBER — Override/SANITY_OK ergänzen.'); process.exitCode = 2; }
