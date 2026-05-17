/* ===========================================================================
 * app.js  -  Oberfläche der OpenBilanz
 * ========================================================================= */
'use strict';

/* ---- Zustand ----------------------------------------------------------- */
var S = { unternehmen: null, abschluesse: [], aktiv: null, view: 'start', erklaerungen: true };

/* ---- Persistenz -------------------------------------------------------- */
window.OPENBILANZ_MODE = (function () {
  var m = document.querySelector('meta[name="openbilanz-mode"]');
  return (m && m.content) || 'website';
})();
var Store = StoreAdapter.waehle();   /* Website: IndexedDB - Selbst-Hosting: Node-API */
var BackupHandle = null;             /* gemerktes Datei-Handle der .obz-Sicherung */
var SitzungsPasswort = null;         /* optionales Backup-Passwort, nur im Sitzungsspeicher */

/* Loest einen Datei-Download im Browser aus. */
function ladeDatei(inhalt, name, mime) {
  var blob = new Blob([inhalt], { type: mime || 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

/* ---- Formatierung ------------------------------------------------------ */
function geld(n) {
  n = Math.round((Number(n) || 0) * 100) / 100;
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function eingabeWert(n) {
  if (n == null || n === '' || Number(n) === 0) return '';
  return String(n).replace('.', ',');
}
function datumDe(iso) {
  if (!iso) return '–';
  var t = String(iso).split('-');
  return t.length === 3 ? t[2] + '.' + t[1] + '.' + t[0] : iso;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function setNested(obj, pfad, wert) {
  var t = pfad.split('.'), o = obj;
  for (var i = 0; i < t.length - 1; i++) { if (o[t[i]] == null) o[t[i]] = {}; o = o[t[i]]; }
  o[t[t.length - 1]] = wert;
}
function getNested(obj, pfad) {
  var t = pfad.split('.'), o = obj;
  for (var i = 0; i < t.length; i++) { if (o == null) return undefined; o = o[t[i]]; }
  return o;
}

/* ---- Dialog ------------------------------------------------------------ */
function dialog(html) {
  document.getElementById('dialogBox').innerHTML = html;
  document.getElementById('dialog').hidden = false;
}
function dialogZu() { document.getElementById('dialog').hidden = true; }

/* ---- Start ------------------------------------------------------------- */
function boot() {
  Store.ladeState().then(function (st) {
    S.unternehmen = st.unternehmen;
    S.abschluesse = st.abschluesse || [];
    renderNav();
    initBackupUI();
    if (!S.unternehmen) setView('stammdaten');
    else setView('start');
  });
  if (Store.modus === 'website' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
}

/* ---- Navigation -------------------------------------------------------- */
function renderNav() {
  document.getElementById('firmaName').textContent =
    (S.unternehmen && S.unternehmen.name) || 'Keine Firma';
  var n = [];
  n.push('<div class="nav-grp">Übersicht</div>');
  n.push(navItem('start', '⌂', 'Startseite'));
  n.push('<div class="nav-grp">Bilanzen &amp; Abschlüsse</div>');
  if (!S.abschluesse.length) n.push('<div class="nav-sub">noch keine vorhanden</div>');
  S.abschluesse.forEach(function (a) {
    var ic = a.art === 'EROEFFNUNGSBILANZ' ? '◈' : '▤';
    var offen = S.aktiv && S.aktiv.id === a.id;
    n.push('<div class="nav-item' + (offen ? ' aktiv' : '') + '" data-oeffne="' + a.id + '">' +
           '<span class="ic">' + ic + '</span><span>' + esc(a.bezeichnung || a.stichtag) + '</span></div>');
    if (offen) {
      var istEB = a.art === 'EROEFFNUNGSBILANZ';
      n.push(navUnter('editor', istEB ? 'Bilanz' : 'Bilanz &amp; GuV'));
      n.push(navUnter('buchhaltung', 'Buchhaltung'));
      if (!istEB) n.push(navUnter('steuer', 'Steuern'));
      n.push(navUnter('ebilanz', 'E-Bilanz'));
      n.push(navUnter('druck', 'Druckansicht'));
    }
  });
  n.push('<div class="nav-item" data-akt="neu"><span class="ic">+</span><span>Neuer Abschluss</span></div>');
  n.push('<div class="nav-grp">Stammdaten</div>');
  n.push(navItem('stammdaten', '⌂', 'Unternehmensdaten'));
  n.push('<div class="nav-grp">Hilfe</div>');
  n.push(navItem('fristen', '⚠', 'Fristen &amp; Pflichten'));
  document.getElementById('nav').innerHTML = n.join('');

  document.querySelectorAll('#nav .nav-item, #nav .nav-unter').forEach(function (el) {
    el.onclick = function () {
      if (el.dataset.oeffne) {
        if (S.aktiv && S.aktiv.id === el.dataset.oeffne) return setView('editor');
        return mitSpeichern(function () { oeffneAbschluss(el.dataset.oeffne); });
      }
      if (el.dataset.akt === 'neu') return dialogNeuerAbschluss();
      if (el.dataset.sub)  return mitSpeichern(function () { setView(el.dataset.sub); });
      if (el.dataset.view) return mitSpeichern(function () { setView(el.dataset.view); });
    };
  });
}
function navUnter(view, label) {
  return '<div class="nav-unter' + (S.view === view ? ' aktiv' : '') +
         '" data-sub="' + view + '">' + label + '</div>';
}
/* Fuehrt fn aus; sichert vorher stillschweigend, wenn der Editor offen ist. */
function mitSpeichern(fn) {
  if (S.view === 'editor' && S.aktiv) speichereStill().then(fn);
  else fn();
}
function navItem(view, ic, label) {
  return '<div class="nav-item' + (S.view === view ? ' aktiv' : '') + '" data-view="' + view + '">' +
         '<span class="ic">' + ic + '</span><span>' + label + '</span></div>';
}
function setView(view) {
  S.view = view;
  renderNav();
  var m = document.getElementById('main');
  m.scrollTop = 0;
  if (view === 'start')       renderStart(m);
  else if (view === 'stammdaten') renderStammdaten(m);
  else if (view === 'editor')     renderEditor(m);
  else if (view === 'druck')      renderDruck(m);
  else if (view === 'ebilanz')    renderEbilanz(m);
  else if (view === 'steuer')     renderSteuer(m);
  else if (view === 'buchhaltung')renderBuchhaltung(m);
  else if (view === 'fristen')    renderFristen(m);
}
function oeffneAbschluss(id) {
  Store.ladeAbschluss(id).then(function (a) {
    if (!a || a.fehler) return;
    S.aktiv = a;
    setView('editor');
  });
}

/* ===========================================================================
 * STARTSEITE
 * ========================================================================= */
function renderStart(m) {
  var eb = S.abschluesse.filter(function (a) { return a.art === 'EROEFFNUNGSBILANZ'; });
  var ja = S.abschluesse.filter(function (a) { return a.art === 'JAHRESABSCHLUSS'; });
  var html = '';
  html += '<div class="kopf"><h1>' + esc((S.unternehmen && S.unternehmen.name) || 'OpenBilanz') +
          '</h1><p>Erstellen Sie Eröffnungsbilanz und Jahresabschluss Ihrer GmbH ' +
          'selbst &ndash; nach HGB, inklusive E-Bilanz für das Finanzamt.</p></div>';

  if (!eb.length) {
    html += '<div class="box box-info"><b>Erster Schritt: Eröffnungsbilanz</b>' +
            'Jede GmbH muss zu Beginn ihres Handelsgewerbes eine Eröffnungsbilanz ' +
            'aufstellen (§ 242 Abs. 1 HGB). Legen Sie hier als Erstes Ihre ' +
            'Eröffnungsbilanz an.</div>';
  }
  html += '<div class="kachel-reihe">';
  html += kachel('Eröffnungsbilanz', 'Anlegen / öffnen', eb.length, 'neu-eb');
  html += kachel('Jahresabschlüsse', 'Bilanz, GuV, Anhang', ja.length, 'neu-ja');
  html += kachel('Fristen', 'Aufstellung &amp; Offenlegung', '⚠', 'fristen');
  html += '</div>';

  if (S.abschluesse.length) {
    html += '<div class="karte" style="margin-top:18px"><h2>Ihre Abschlüsse</h2>' +
            '<div class="karte-hint">Klicken Sie einen Eintrag zum Bearbeiten an.</div>' +
            '<table class="liste"><thead><tr><th>Bezeichnung</th><th>Art</th>' +
            '<th>Stichtag</th><th>Größe</th><th>Status</th><th></th></tr></thead><tbody>';
    S.abschluesse.forEach(function (a) {
      html += '<tr data-oeffne="' + a.id + '" style="cursor:pointer">' +
        '<td><b>' + esc(a.bezeichnung || '–') + '</b></td>' +
        '<td>' + (a.art === 'EROEFFNUNGSBILANZ'
          ? '<span class="tag tag-eb">Eröffnungsbilanz</span>'
          : '<span class="tag tag-ja">Jahresabschluss</span>') + '</td>' +
        '<td class="mono">' + datumDe(a.stichtag) + '</td>' +
        '<td>' + esc(klasseName(a.groessenklasse)) + '</td>' +
        '<td>' + (a.status === 'FESTGESTELLT'
          ? '<span class="tag tag-fest">festgestellt</span>'
          : '<span class="tag tag-entwurf">Entwurf</span>') + '</td>' +
        '<td class="rechts"><span class="btn btn-sm">öffnen</span></td></tr>';
    });
    html += '</tbody></table></div>';
  }
  m.innerHTML = html;
  m.querySelectorAll('[data-oeffne]').forEach(function (el) {
    el.onclick = function () { oeffneAbschluss(el.dataset.oeffne); };
  });
  m.querySelectorAll('.kachel').forEach(function (el) {
    el.onclick = function () {
      if (el.dataset.k === 'neu-eb') dialogNeuerAbschluss('EROEFFNUNGSBILANZ');
      else if (el.dataset.k === 'neu-ja') dialogNeuerAbschluss('JAHRESABSCHLUSS');
      else if (el.dataset.k === 'fristen') setView('fristen');
    };
  });
}
function kachel(tag, titel, zahl, k) {
  return '<div class="kachel" data-k="' + k + '"><div class="k-tag">' + tag + '</div>' +
         '<div class="k-titel">' + titel + '</div><div class="k-zahl">' + zahl + '</div></div>';
}
function klasseName(k) {
  var K = Positionen.GROESSENKLASSEN.klassen;
  return (k && K[k] && K[k].name) || '–';
}

/* ===========================================================================
 * STAMMDATEN
 * ========================================================================= */
function renderStammdaten(m) {
  var u = S.unternehmen || { rechtsform: 'GmbH', geschaeftsjahrTyp: 'kalenderjahr',
                             stammkapital: 25000, guvVerfahrenStandard: 'GKV' };
  function f(pfad, label, sub, typ, opt) {
    var v = getNested(u, pfad);
    if (typ === 'select') {
      var os = opt.map(function (o) {
        return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('');
      return feldWrap(label, sub, '<select data-u="' + pfad + '">' + os + '</select>');
    }
    return feldWrap(label, sub, '<input data-u="' + pfad + '" type="' + (typ || 'text') +
      '" value="' + esc(v == null ? '' : v) + '">');
  }
  var html = '';
  html += '<div class="kopf"><h1>Unternehmensdaten</h1>' +
          '<p>Stammdaten Ihrer GmbH. Sie erscheinen auf allen Bilanzen, im Anhang und ' +
          'in der E-Bilanz.</p></div>';
  html += '<div class="karte"><h2>Firma</h2><div class="gitter g2">';
  html += f('name', 'Firmenname', 'vollständig lt. Handelsregister');
  html += f('rechtsform', 'Rechtsform', '', 'select',
            [['GmbH', 'GmbH'], ['UG', 'UG (haftungsbeschränkt)'], ['gGmbH', 'gemeinnützige GmbH']]);
  html += f('strasse', 'Straße und Hausnummer');
  html += '<div class="gitter g2" style="gap:13px">' +
          f('plz', 'PLZ') + f('ort', 'Ort') + '</div>';
  html += f('registergericht', 'Registergericht', 'z. B. Amtsgericht Berlin (Charlottenburg)');
  html += f('hrNummer', 'Handelsregisternummer', 'z. B. HRB 123456');
  html += '</div></div>';

  html += '<div class="karte"><h2>Finanzamt &amp; Steuer</h2><div class="gitter g2">';
  html += f('finanzamt', 'Zuständiges Finanzamt');
  html += f('steuernummer', 'Steuernummer', '13-stellig, für die E-Bilanz');
  html += f('wirtschaftsidnr', 'Wirtschafts-Identifikationsnummer', 'sofern vorhanden');
  html += '</div></div>';

  html += '<div class="karte"><h2>Gründung &amp; Geschäftsjahr</h2><div class="gitter g2">';
  html += f('gruendungsdatum', 'Gründungsdatum', 'Tag des Notarvertrags / Beginn', 'date');
  html += f('geschaeftsjahrTyp', 'Geschäftsjahr', '', 'select',
            [['kalenderjahr', 'Kalenderjahr (01.01.–31.12.)'], ['abweichend', 'abweichendes Geschäftsjahr']]);
  html += f('stammkapital', 'Stammkapital (EUR)', 'Mindestens 25.000 EUR bei der GmbH', 'number');
  html += f('guvVerfahrenStandard', 'GuV-Verfahren (Standard)', '', 'select',
            [['GKV', 'Gesamtkostenverfahren'], ['UKV', 'Umsatzkostenverfahren']]);
  html += f('gmbhTyp', 'Art der Tätigkeit', 'beeinflusst Hinweise und Steuer', 'select',
            [['operativ', 'operativ tätige GmbH'],
             ['vermögensverwaltend', 'vermögensverwaltende GmbH (Immobilien, Beteiligungen)']]);
  html += '</div></div>';

  html += '<div class="karte"><h2>Geschäftsführung</h2>' +
          '<div class="karte-hint">Namen der Geschäftsführer, durch Komma getrennt.</div>' +
          feldWrap('Geschäftsführer', '', '<input data-u="geschaeftsfuehrerText" value="' +
            esc((u.geschaeftsfuehrer || []).join(', ')) + '">') + '</div>';

  html += '<div class="btn-reihe"><button class="btn btn-pri" id="stammSpeichern">' +
          'Stammdaten speichern</button></div>';
  m.innerHTML = html;

  m.querySelector('#stammSpeichern').onclick = function () {
    var neu = JSON.parse(JSON.stringify(u));
    m.querySelectorAll('[data-u]').forEach(function (el) {
      var p = el.dataset.u;
      if (p === 'geschaeftsfuehrerText') {
        neu.geschaeftsfuehrer = el.value.split(',').map(function (x) { return x.trim(); })
          .filter(Boolean);
      } else if (el.type === 'number') {
        setNested(neu, p, Berechnung.num(el.value));
      } else {
        setNested(neu, p, el.value);
      }
    });
    if (!neu.name) { alert('Bitte den Firmennamen eingeben.'); return; }
    Store.speichereUnternehmen(neu).then(function (gespeichert) {
      S.unternehmen = gespeichert;
      renderNav();
      hinweisToast('Stammdaten gespeichert.');
      nachSpeichern();
      if (!S.abschluesse.length) dialogNeuerAbschluss('EROEFFNUNGSBILANZ');
      else setView('start');
    });
  };
}
function feldWrap(label, sub, inner) {
  return '<label class="feld"><span class="lbl">' + label +
         (sub ? ' <span class="sub">&ndash; ' + sub + '</span>' : '') + '</span>' + inner + '</label>';
}
function hinweisToast(t) {
  var d = document.createElement('div');
  d.textContent = t;
  d.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);' +
    'background:#152634;color:#fff;padding:10px 18px;border-radius:7px;z-index:99;font-size:13px';
  document.body.appendChild(d);
  setTimeout(function () { d.remove(); }, 2600);
}

/* ===========================================================================
 * NEUER ABSCHLUSS (Dialog)
 * ========================================================================= */
function dialogNeuerAbschluss(vorgabeArt) {
  if (!S.unternehmen) { alert('Bitte zuerst die Unternehmensdaten anlegen.'); setView('stammdaten'); return; }
  var u = S.unternehmen;
  var jahr = new Date().getFullYear();
  var html = '<h3>Neuen Abschluss anlegen</h3>' +
    '<p class="karte-hint">Wählen Sie die Art des Abschlusses.</p>' +
    '<div class="gitter" style="gap:11px">' +
    feldWrap('Art', '', '<select id="naArt">' +
      '<option value="EROEFFNUNGSBILANZ">Eröffnungsbilanz (zur Gründung)</option>' +
      '<option value="JAHRESABSCHLUSS">Jahresabschluss (Bilanz + GuV)</option></select>') +
    '<div id="naFelder"></div>' +
    '</div>' +
    '<div class="btn-reihe" style="margin-top:16px">' +
    '<button class="btn btn-pri" id="naOk">Anlegen</button>' +
    '<button class="btn" id="naAbbruch">Abbrechen</button></div>';
  dialog(html);
  var artSel = document.getElementById('naArt');
  if (vorgabeArt) artSel.value = vorgabeArt;

  function felder() {
    var art = artSel.value;
    var box = document.getElementById('naFelder');
    if (art === 'EROEFFNUNGSBILANZ') {
      box.innerHTML = feldWrap('Stichtag (Gründungsdatum)', '', '<input type="date" id="naStichtag" value="' +
        esc(u.gruendungsdatum || '') + '">');
    } else {
      box.innerHTML =
        feldWrap('Geschäftsjahr', '', '<input type="number" id="naJahr" value="' + jahr + '">') +
        '<div class="karte-hint" style="margin-top:6px">Bei Kalenderjahr: 01.01.–31.12. ' +
        'des angegebenen Jahres. Der Bilanzstichtag ist der 31.12.</div>';
    }
  }
  felder();
  artSel.onchange = felder;
  document.getElementById('naAbbruch').onclick = dialogZu;
  document.getElementById('naOk').onclick = function () {
    var art = artSel.value;
    var a = neuerAbschluss(art);
    if (art === 'EROEFFNUNGSBILANZ') {
      a.stichtag = document.getElementById('naStichtag').value || u.gruendungsdatum;
      a.bezeichnung = 'Eröffnungsbilanz ' + datumDe(a.stichtag);
    } else {
      var j = parseInt(document.getElementById('naJahr').value, 10) || jahr;
      a.gjVon = j + '-01-01';
      a.gjBis = j + '-12-31';
      a.stichtag = j + '-12-31';
      a.bezeichnung = 'Jahresabschluss ' + j;
      var vj = S.abschluesse.filter(function (x) { return x.stichtag < a.stichtag; })
        .sort(function (x, y) { return y.stichtag.localeCompare(x.stichtag); })[0];
      if (vj) a.vorjahrId = vj.id;
    }
    Store.speichereAbschluss(a).then(function (gesp) {
      dialogZu();
      nachSpeichern();
      Store.ladeState().then(function (st) {
        S.abschluesse = st.abschluesse || [];
        S.aktiv = gesp;
        setView('editor');
      });
    });
  };
}
function neuerAbschluss(art) {
  var u = S.unternehmen || {};
  var sk = Number(u.stammkapital) || 25000;
  return {
    id: 'A-' + Date.now(),
    art: art,
    bezeichnung: '',
    stichtag: '',
    gjVon: '', gjBis: '',
    groessenklasse: 'KLEINST',
    groessenklasseAuto: art === 'JAHRESABSCHLUSS',
    guvVerfahren: u.guvVerfahrenStandard || 'GKV',
    erfassungsmodus: 'DIREKT',
    kapital: { gezeichnet: sk, eingezahlt: art === 'EROEFFNUNGSBILANZ' ? sk / 2 : sk,
               eingefordertOffen: 0 },
    werte: { aktiva: {}, passiva: {}, guv: {} },
    merkmale: { bilanzsumme: 0, umsatz: 0, arbeitnehmer: 0 },
    anhang: { methoden: STANDARD_METHODEN, arbeitnehmer: 0, restlaufzeit5: '',
              haftungsverhaeltnisse: 'Es bestehen keine Haftungsverhältnisse im Sinne des § 251 HGB.',
              organkredite: 'Es wurden keine Vorschüsse oder Kredite an Mitglieder der ' +
                'Geschäftsführung gewährt (§ 285 Nr. 9 Buchst. c HGB).',
              ergebnisverwendung: '', sonstiges: '' },
    buchungen: [],
    notizen: '',
    status: 'ENTWURF'
  };
}
var STANDARD_METHODEN =
  'Die Bilanzierung und Bewertung erfolgt nach den Vorschriften des HGB unter ' +
  'Beachtung der Grundsätze ordnungsmäßiger Buchführung. Vermögensgegenstände ' +
  'des Anlagevermögens werden zu Anschaffungs- oder Herstellungskosten, vermindert ' +
  'um planmäßige Abschreibungen, angesetzt. Forderungen sind zum Nennwert ' +
  'angesetzt. Verbindlichkeiten sind zum Erfüllungsbetrag passiviert.';

/* ===========================================================================
 * EDITOR  (Bilanz + GuV + Kapital + Anhang)
 * ========================================================================= */
/* ---- Erklaerungen zu jeder Position der Eroeffnungsbilanz -------------- */
var ERKLAERUNG = {
  'kapital.gezeichnet': { was: 'Das im Gesellschaftsvertrag festgelegte Stammkapital (Nennbetrag). Bei der GmbH mindestens 25.000 € (§ 5 GmbHG).', beispiel: '25.000 € bei einer Standard-GmbH.' },
  'kapital.eingezahlt': { was: 'Der Teil des Stammkapitals, der schon auf das Geschäftskonto eingezahlt ist. Vor der Handelsregister-Anmeldung müssen mindestens 12.500 € eingezahlt sein (§ 7 GmbHG).', beispiel: '12.500 € — die Hälfte zur Gründung eingezahlt.' },
  'kapital.eingefordertOffen': { was: 'Betrag, den die GmbH von den Gesellschaftern bereits angefordert hat, der aber noch nicht auf dem Konto ist. Erscheint als Forderung auf der Aktivseite.', beispiel: 'Meist 0 € — der Rest wird oft erst später eingefordert.' },
  'A':   { was: 'Alles, was dauerhaft dem Geschäftsbetrieb dient (länger als ein Jahr).', beispiel: 'Gebäude, Maschinen, Firmen-Pkw, langfristige Beteiligungen.' },
  'A.I': { was: 'Nicht-körperliche Werte: gekaufte Software, Lizenzen, Patente, ein entgeltlich erworbener Firmenwert.', beispiel: 'Eine als Sacheinlage eingebrachte Software-Lizenz, 4.000 €. Bei reiner Bargründung: 0 €.' },
  'A.II':{ was: 'Körperliche, dauerhaft genutzte Gegenstände — Grundstücke, Gebäude, Maschinen, Fahrzeuge, Büroausstattung.', beispiel: 'Ein als Sacheinlage eingebrachter Firmen-Pkw, 15.000 €. Bei Bargründung: 0 €.' },
  'A.III':{ was: 'Langfristige Geldanlagen: Beteiligungen an anderen Firmen, Anteile, Wertpapiere zur Daueranlage.', beispiel: 'Eine 30-%-Beteiligung an einer anderen GmbH, 10.000 €.' },
  'B':   { was: 'Vermögen, das nur kurzfristig im Unternehmen ist und sich laufend umschlägt.', beispiel: 'Bankguthaben, Kasse, Warenvorräte, offene Kundenforderungen.' },
  'B.I': { was: 'Roh-, Hilfs- und Betriebsstoffe, Waren, unfertige und fertige Erzeugnisse.', beispiel: 'Ein als Sacheinlage eingebrachtes Warenlager, 5.000 €. Bei Bargründung: 0 €.' },
  'B.II':{ was: 'Geld, das der GmbH zusteht, aber noch nicht da ist (offene Rechnungen, Vorsteuer). Hier erscheint auch eingefordertes, noch nicht eingezahltes Stammkapital.', beispiel: 'Eine neue GmbH hat meist 0 € — es wurde noch nichts geleistet.' },
  'B.III':{ was: 'Kurzfristig gehaltene Wertpapiere (nicht zur Daueranlage bestimmt).', beispiel: 'Bei Gründung in der Regel 0 €.' },
  'B.IV':{ was: 'Bargeld in der Kasse und Guthaben auf den Geschäftskonten — bei einer Bargründung der wichtigste Aktivposten.', beispiel: 'Das auf das Geschäftskonto eingezahlte Stammkapital, z. B. 12.500 €.' },
  'C':   { was: 'Vor dem Stichtag gezahlte Beträge, die wirtschaftlich erst ein späteres Jahr betreffen.', beispiel: 'Im Dezember vorausgezahlte Januar-Miete. Bei Gründung meist 0 €.' },
  'D':   { was: 'Künftige Steuerentlastung aus Unterschieden zwischen Handels- und Steuerbilanz.', beispiel: 'Für eine kleine GmbH selten relevant — meist 0 €.' },
  'E':   { was: 'Sonderposten, wenn Deckungsvermögen (z. B. für Pensionen) verrechnet wird.', beispiel: 'Sehr selten — bei Gründung 0 €.' },
  'P.A': { was: 'Das Kapital, das den Gesellschaftern gehört — bei Gründung im Wesentlichen das Stammkapital.', beispiel: 'Gezeichnetes Kapital 25.000 €.' },
  'P.A.II':{ was: 'Einlagen der Gesellschafter, die über das Stammkapital hinausgehen (Aufgeld, freiwillige Zuzahlungen).', beispiel: 'Bei einer reinen Bargründung zu 25.000 €: 0 €.' },
  'P.A.III':{ was: 'Aus früheren Gewinnen einbehaltene (nicht ausgeschüttete) Beträge.', beispiel: 'Bei Gründung 0 € — es gab noch keinen Gewinn.' },
  'P.A.IV':{ was: 'Ergebnis aus Vorjahren, das weder ausgeschüttet noch in Rücklagen gestellt wurde.', beispiel: 'Bei Gründung 0 €.' },
  'P.B': { was: 'Verpflichtungen, die dem Grund nach feststehen, aber in Höhe oder Zeitpunkt noch ungewiss sind.', beispiel: 'Steuer- oder Pensionsrückstellungen. Bei Gründung meist 0 €.' },
  'P.C': { was: 'Sicher feststehende Schulden gegenüber Dritten — Darlehen, offene Lieferantenrechnungen, Steuerschulden.', beispiel: 'Ein zur Gründung aufgenommenes Bankdarlehen; bei reiner Bargründung: 0 €.' },
  'P.D': { was: 'Vor dem Stichtag erhaltene Beträge, die wirtschaftlich ein späteres Jahr betreffen.', beispiel: 'Bei Gründung meist 0 €.' },
  'P.E': { was: 'Künftige Steuerbelastung aus Unterschieden zwischen Handels- und Steuerbilanz.', beispiel: 'Für kleine GmbH selten — meist 0 €.' }
};
function erklSichtbar() {
  return S.erklaerungen && S.aktiv && S.aktiv.art === 'EROEFFNUNGSBILANZ';
}
function erklRow(id) {
  if (!erklSichtbar() || !ERKLAERUNG[id]) return '';
  var e = ERKLAERUNG[id];
  return '<tr class="erkl-zeile"><td colspan="3"><span class="erkl">' +
    '<b>Gefordert:</b> ' + esc(e.was) + ' <b>Beispiel:</b> ' + esc(e.beispiel) +
    '</span></td></tr>';
}
function erklFeld(key, label) {
  if (!erklSichtbar() || !ERKLAERUNG[key]) return '';
  var e = ERKLAERUNG[key];
  return '<div class="erkl"><b>' + esc(label) + ':</b> ' + esc(e.was) +
    ' <b>Beispiel:</b> ' + esc(e.beispiel) + '</div>';
}

function renderEditor(m) {
  var a = S.aktiv;
  if (!a) { setView('start'); return; }
  var istEB = a.art === 'EROEFFNUNGSBILANZ';

  var html = '';
  html += '<span class="zurueck" data-z="start">&larr; Übersicht</span>';
  html += '<div class="kopf karte-kopf"><div><h1>' + esc(a.bezeichnung) + '</h1>' +
          '<p>' + (istEB
            ? 'Eröffnungsbilanz nach § 242 Abs. 1 HGB zum ' + datumDe(a.stichtag) + '.'
            : 'Jahresabschluss (Bilanz, GuV, Anhang) zum ' + datumDe(a.stichtag) + '.') + '</p></div>' +
          '<div class="btn-reihe">' +
          '<button class="btn btn-pri" id="edSpeichern">Speichern</button>' +
          '</div></div>';

  if (istEB) {
    html += '<div class="box box-info"><b>Was ist die Eröffnungsbilanz?</b>' +
      'Jede GmbH stellt zu Beginn ihres Geschäftsbetriebs eine Eröffnungsbilanz auf ' +
      '(§ 242 Abs. 1 HGB). Sie zeigt zum Gründungsstichtag, was die GmbH besitzt ' +
      '(Aktiva) und woher das Geld stammt (Passiva) — beide Seiten ergeben denselben ' +
      'Betrag. Bei der typischen Bargründung ist sie kurz: auf der Aktivseite das ' +
      'eingezahlte Stammkapital als Bankguthaben, auf der Passivseite das gezeichnete ' +
      'Kapital. Zu jeder Position finden Sie unten — wenn „Erklärungen" aktiv ist — ' +
      'was gefordert wird und ein Beispiel.</div>';
  }

  /* Eckdaten */
  html += '<div class="karte"><h2>Eckdaten</h2><div class="gitter g3">';
  html += feldWrap('Bezeichnung', '', '<input data-pfad="bezeichnung" value="' +
    esc(a.bezeichnung) + '">');
  html += feldWrap('Bilanzstichtag', '', '<input type="date" data-pfad="stichtag" value="' +
    esc(a.stichtag) + '">');
  if (!istEB) {
    html += feldWrap('Geschäftsjahr von', '', '<input type="date" data-pfad="gjVon" value="' +
      esc(a.gjVon) + '">');
    html += feldWrap('Geschäftsjahr bis', '', '<input type="date" data-pfad="gjBis" value="' +
      esc(a.gjBis) + '">');
    var vjOpt = '<option value="">– kein Vorjahr –</option>' +
      S.abschluesse.filter(function (x) { return x.id !== a.id; }).map(function (x) {
        return '<option value="' + x.id + '"' + (a.vorjahrId === x.id ? ' selected' : '') + '>' +
          esc(x.bezeichnung) + '</option>';
      }).join('');
    html += feldWrap('Vorjahres-Abschluss', 'für die Vorjahresspalte (§ 265 Abs. 2 HGB)',
      '<select data-pfad="vorjahrId">' + vjOpt + '</select>');
    html += feldWrap('GuV-Verfahren', '', '<select data-pfad="guvVerfahren">' +
      opt('GKV', 'Gesamtkostenverfahren (§ 275 Abs. 2)', a.guvVerfahren) +
      opt('UKV', 'Umsatzkostenverfahren (§ 275 Abs. 3)', a.guvVerfahren) +
      opt('KLEINST', 'Verkürzt für Kleinstgesellschaften (§ 275 Abs. 5)', a.guvVerfahren) +
      '</select>');
  }
  html += feldWrap('Größenklasse', '', '<select data-pfad="groessenklasse">' +
    opt('KLEINST', 'Kleinstkapitalgesellschaft (§ 267a)', a.groessenklasse) +
    opt('KLEIN', 'kleine Kapitalgesellschaft (§ 267 Abs. 1)', a.groessenklasse) +
    opt('MITTEL', 'mittelgroße Kapitalgesellschaft', a.groessenklasse) +
    opt('GROSS', 'große Kapitalgesellschaft', a.groessenklasse) +
    '</select>');
  html += '</div></div>';

  /* Kapital */
  html += '<div class="karte"><h2>Gezeichnetes Kapital ' +
          '<span class="reg">&middot; § 272 Abs. 1 HGB</span></h2>' +
          '<div class="karte-hint">Bei der GmbH ist das Stammkapital das gezeichnete Kapital. ' +
          'Nicht eingeforderte ausstehende Einlagen werden offen vom gezeichneten Kapital ' +
          'abgesetzt (Nettomethode).</div><div class="gitter g3">';
  html += feldWrap('Gezeichnetes Kapital (Nennbetrag)', 'Stammkapital lt. Vertrag',
    '<input class="zahl" type="text" inputmode="decimal" data-pfad="kapital.gezeichnet" value="' +
    eingabeWert(a.kapital.gezeichnet) + '">');
  html += feldWrap('davon eingezahlt', 'tatsächlich auf das Konto eingezahlt',
    '<input class="zahl" type="text" inputmode="decimal" data-pfad="kapital.eingezahlt" value="' +
    eingabeWert(a.kapital.eingezahlt) + '">');
  html += feldWrap('davon eingefordert, aber unbezahlt', 'von der GmbH angefordert, noch offen',
    '<input class="zahl" type="text" inputmode="decimal" data-pfad="kapital.eingefordertOffen" value="' +
    eingabeWert(a.kapital.eingefordertOffen) + '">');
  html += '</div>' +
    (erklSichtbar() ? '<div class="erkl-box">' +
      erklFeld('kapital.gezeichnet', 'Gezeichnetes Kapital') +
      erklFeld('kapital.eingezahlt', 'davon eingezahlt') +
      erklFeld('kapital.eingefordertOffen', 'davon eingefordert, aber unbezahlt') +
      '</div>' : '') +
    '<table class="pos-tab" style="margin-top:10px">' +
    kapZeile('Nicht eingeforderte ausstehende Einlagen (offen abgesetzt)', 'kapital:nichtEingefordert') +
    kapZeile('= Eingefordertes Kapital (Ausweis Passiva A. I.)', 'kapital:eingefordertesKapital') +
    '</table></div>';

  /* Bilanz */
  html += '<div class="karte"><div class="karte-kopf"><div>' +
    '<h2>Bilanz <span class="reg">&middot; § 266 HGB</span></h2>' +
    '<div class="karte-hint">Tragen Sie die Beträge je Position ein. Summen und ' +
    'Bilanzgleichung werden automatisch berechnet.</div></div>' +
    (istEB ? '<label class="checkz" style="align-items:center;white-space:nowrap">' +
      '<input type="checkbox" id="chkErkl"' + (S.erklaerungen ? ' checked' : '') +
      '><span>Erklärungen</span></label>' : '') +
    '</div>' +
    '<div class="bilanz-seiten">' +
    '<div><div class="seite-titel">Aktiva</div>' + bilanzSeite('aktiva') + '</div>' +
    '<div><div class="seite-titel">Passiva</div>' + bilanzSeite('passiva') + '</div>' +
    '</div></div>';

  /* GuV */
  if (!istEB) {
    html += '<div class="karte"><h2>Gewinn- und Verlustrechnung ' +
      '<span class="reg">&middot; § 275 HGB</span></h2>' +
      '<div class="karte-hint">Erträge positiv eingeben, Aufwendungen ebenfalls als ' +
      'positive Zahl &ndash; das Vorzeichen ergibt sich aus der Position.</div>' +
      '<div id="guvBox">' + guvTabelle(a) + '</div></div>';
  }

  /* Anhang */
  html += anhangKarte(a);

  m.innerHTML =
    '<span class="zurueck" data-z="start">&larr; Übersicht</span>' +
    '<div class="editor-grid"><div>' +
    html.replace('<span class="zurueck" data-z="start">&larr; Übersicht</span>', '') +
    '</div><aside class="statusbox"><div id="statusbox"></div></aside></div>';

  bindeEditor(m);
  aktualisiereStatus();
}
function opt(v, label, akt) {
  return '<option value="' + v + '"' + (akt === v ? ' selected' : '') + '>' + label + '</option>';
}
function kapZeile(label, zelle) {
  return '<tr class="zeile-R"><td class="p-lbl">' + label + '</td>' +
    '<td class="p-wert"><span class="wert-ro" data-zelle="' + zelle + '">0,00</span></td></tr>';
}

/* ---- Bilanzseite rendern ---------------------------------------------- */
function bilanzSeite(seite) {
  var baum = seite === 'aktiva' ? Positionen.AKTIVA : Positionen.PASSIVA;
  var rows = [];
  baum.forEach(function (b) {
    if (b.kinder && b.kinder.length) {
      rows.push(zeileSum(b, seite));
      b.kinder.forEach(function (k) {
        rows.push(b.auto || k.auto ? zeileAuto(k, seite) : zeileInput(k, seite));
        if (seite === 'aktiva' && k.id === 'B.II') rows.push(hinweisBII());
      });
    } else if (b.auto) {
      rows.push(zeileAuto(b, seite));
    } else {
      rows.push(zeileInput(b, seite));
    }
  });
  rows.push('<tr class="zeile-summe"><td class="p-nr"></td><td class="p-lbl">' +
    (seite === 'aktiva' ? 'Summe Aktiva' : 'Summe Passiva') + '</td>' +
    '<td class="p-wert"><span class="wert-ro" data-zelle="' +
    (seite === 'aktiva' ? 'summeAktiva' : 'summePassiva') + '">0,00</span></td></tr>');
  return '<table class="pos-tab">' + rows.join('') + '</table>';
}
function zeileSum(node, seite) {
  return '<tr class="zeile-B"><td class="p-nr">' + node.nr + '</td>' +
    '<td class="p-lbl">' + esc(node.label) + '</td>' +
    '<td class="p-wert"><span class="wert-ro" data-zelle="' + seite + ':' + node.id +
    '">0,00</span></td></tr>' + erklRow(node.id);
}
function zeileInput(node, seite) {
  var cls = node.typ === 'B' ? 'zeile-B' : (node.typ === 'R' ? 'zeile-R' : 'zeile-N');
  var v = ((S.aktiv.werte && S.aktiv.werte[seite]) || {})[node.id];
  return '<tr class="' + cls + '"><td class="p-nr">' + node.nr + '</td>' +
    '<td class="p-lbl">' + esc(node.label) + '</td>' +
    '<td class="p-wert"><input class="zahl" type="text" inputmode="decimal" ' +
    'data-werte="' + seite + '" data-pos="' + node.id + '" value="' + eingabeWert(v) +
    '"></td></tr>' + erklRow(node.id);
}
function zeileAuto(node, seite) {
  return '<tr class="zeile-auto"><td class="p-nr">' + node.nr + '</td>' +
    '<td class="p-lbl">' + esc(node.label) + autoHinweis(node.id) + '</td>' +
    '<td class="p-wert"><span class="wert-ro" data-zelle="' + seite + ':' + node.id +
    '">0,00</span></td></tr>' + erklRow(node.id);
}
function autoHinweis(id) {
  if (id === 'P.A.I') return ' <span class="sub">(aus Kapitalangaben)</span>';
  if (id === 'P.A.V') return ' <span class="sub">(aus der GuV)</span>';
  if (id === 'F')     return ' <span class="sub">(§ 268 Abs. 3 HGB)</span>';
  return '';
}
function hinweisBII() {
  return '<tr><td colspan="3" class="mini-hint" id="hintBII"></td></tr>';
}

/* ---- GuV-Tabelle ------------------------------------------------------- */
function guvTabelle(a) {
  var schema = Positionen.guvSchema(a.guvVerfahren);
  var rows = schema.map(function (p) {
    var berechnet = !!p.formel;
    var cls = 'zeile-' + (p.art === 'Z' ? 'Z' : p.art === 'S' ? 'S' : 'N') +
              (p.art === 'A' ? ' art-A' : '');
    var wertZelle = berechnet
      ? '<span class="wert-ro" data-zelle="guv:' + p.id + '">0,00</span>'
      : '<input class="zahl" type="text" inputmode="decimal" data-werte="guv" data-pos="' +
        p.id + '" value="' + eingabeWert((a.werte.guv || {})[p.id]) + '">';
    return '<tr class="' + cls + '"><td class="g-nr">' + p.nr + '</td>' +
      '<td class="g-lbl">' + esc(p.label) + '</td>' +
      '<td class="g-wert">' + wertZelle + '</td></tr>';
  });
  return '<table class="pos-tab guv-tab">' + rows.join('') + '</table>';
}

/* ---- Anhang ------------------------------------------------------------ */
function anhangKarte(a) {
  var kleinst = a.groessenklasse === 'KLEINST';
  var h = '<div class="karte"><h2>Anhang' + (a.art === 'EROEFFNUNGSBILANZ'
    ? ' / Erläuterungen' : '') + ' <span class="reg">&middot; §§ 284 ff. HGB</span></h2>';
  if (kleinst) {
    h += '<div class="box box-info" style="margin-bottom:12px"><b>Kleinstkapitalgesellschaft</b>' +
      'Sie dürfen auf einen Anhang verzichten (§ 264 Abs. 1 Satz 5 HGB), wenn die ' +
      'folgenden Angaben unter der Bilanz gemacht werden. Genau das macht die Druckansicht.</div>';
  }
  h += '<div class="gitter">';
  if (!kleinst) {
    h += feldWrap('Bilanzierungs- und Bewertungsmethoden', '§ 284 Abs. 2 Nr. 1 HGB',
      '<textarea data-pfad="anhang.methoden">' + esc(a.anhang.methoden || '') + '</textarea>');
  }
  h += '<div class="gitter g2">' +
    feldWrap('Durchschnittliche Zahl der Arbeitnehmer', '§ 285 Nr. 7 HGB',
      '<input type="number" data-pfad="anhang.arbeitnehmer" value="' +
      esc(a.anhang.arbeitnehmer || '') + '">') +
    feldWrap('Verbindlichkeiten mit Restlaufzeit > 5 Jahre (EUR)', '§ 285 Nr. 1 HGB',
      '<input data-pfad="anhang.restlaufzeit5" value="' + esc(a.anhang.restlaufzeit5 || '') + '">') +
    '</div>';
  h += feldWrap('Haftungsverhältnisse', '§ 251 / § 268 Abs. 7 HGB',
    '<textarea data-pfad="anhang.haftungsverhaeltnisse">' +
    esc(a.anhang.haftungsverhaeltnisse || '') + '</textarea>');
  h += feldWrap('Vorschüsse / Kredite an die Geschäftsführung', '§ 285 Nr. 9 Buchst. c HGB',
    '<textarea data-pfad="anhang.organkredite">' + esc(a.anhang.organkredite || '') + '</textarea>');
  if (a.art === 'JAHRESABSCHLUSS') {
    h += feldWrap('Vorschlag zur Ergebnisverwendung', 'Verwendung des Jahresergebnisses',
      '<textarea data-pfad="anhang.ergebnisverwendung">' +
      esc(a.anhang.ergebnisverwendung || '') + '</textarea>');
  }
  h += feldWrap('Sonstige Angaben', 'optional',
    '<textarea data-pfad="anhang.sonstiges">' + esc(a.anhang.sonstiges || '') + '</textarea>');
  h += '</div></div>';
  return h;
}

/* ---- Editor: Ereignisse ------------------------------------------------ */
function bindeEditor(m) {
  m.querySelectorAll('[data-z]').forEach(function (el) {
    el.onclick = function () { speichereStill().then(function () { setView(el.dataset.z); }); };
  });
  m.querySelectorAll('[data-v]').forEach(function (el) {
    el.onclick = function () { speichereStill().then(function () { setView(el.dataset.v); }); };
  });
  var sp = m.querySelector('#edSpeichern');
  if (sp) sp.onclick = function () {
    speichereStill().then(function () { hinweisToast('Abschluss gespeichert.'); });
  };
  var ce = m.querySelector('#chkErkl');
  if (ce) ce.onchange = function () { S.erklaerungen = ce.checked; renderEditor(m); };
  // Bilanz-/GuV-Positionswerte (IDs enthalten Punkte -> eigene Behandlung)
  m.querySelectorAll('[data-pos]').forEach(function (el) {
    el.addEventListener('input', function () {
      var b = el.dataset.werte;
      if (!S.aktiv.werte) S.aktiv.werte = {};
      if (!S.aktiv.werte[b]) S.aktiv.werte[b] = {};
      S.aktiv.werte[b][el.dataset.pos] = Berechnung.num(el.value);
      aktualisiereStatus();
    });
  });
  // Übrige Felder
  m.querySelectorAll('[data-pfad]').forEach(function (el) {
    var ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, function () {
      var p = el.dataset.pfad, v = el.value;
      if (el.classList.contains('zahl') || el.type === 'number') v = Berechnung.num(v);
      setNested(S.aktiv, p, v);
      if (p === 'groessenklasse') S.aktiv.groessenklasseAuto = false;
      if (p === 'guvVerfahren') { renderEditor(document.getElementById('main')); return; }
      aktualisiereStatus();
    });
  });
}
function speichereStill() {
  return Store.speichereAbschluss(S.aktiv).then(function (g) {
    if (g && !g.fehler) S.aktiv = g;
    return Store.ladeState();
  }).then(function (st) {
    S.abschluesse = st.abschluesse || [];
    renderNav();
    return nachSpeichern();
  });
}

/* ---- Editor: Statusberechnung ----------------------------------------- */
function aktualisiereStatus() {
  var a = S.aktiv;
  // Größenklasse automatisch
  if (a.groessenklasseAuto) {
    var vor = Berechnung.berechne(a);
    var merk = {
      bilanzsumme: vor.bilanz.summeAktiva,
      umsatz: (a.merkmale && a.merkmale.umsatz) || vor.guv.werte['gkv.1'] ||
              vor.guv.werte['ukv.1'] || vor.guv.werte['kst.1'] || 0,
      arbeitnehmer: (a.anhang && a.anhang.arbeitnehmer) || 0
    };
    var ek = Berechnung.bestimmeGroessenklasse(merk, a.gjVon || a.stichtag, {});
    a.groessenklasse = ek.klasse;
  }
  var pr = Berechnung.pruefe(a);
  var r = pr.berechnung;

  document.querySelectorAll('[data-zelle]').forEach(function (el) {
    var z = el.dataset.zelle, wert = 0;
    if (z === 'summeAktiva') wert = r.bilanz.summeAktiva;
    else if (z === 'summePassiva') wert = r.bilanz.summePassiva;
    else if (z.indexOf('aktiva:') === 0) wert = r.bilanz.aktiva[z.slice(7)] || 0;
    else if (z.indexOf('passiva:') === 0) wert = r.bilanz.passiva[z.slice(8)] || 0;
    else if (z.indexOf('guv:') === 0) wert = r.guv.werte[z.slice(4)] || 0;
    else if (z === 'kapital:nichtEingefordert') wert = r.bilanz.kapital.nichtEingefordert;
    else if (z === 'kapital:eingefordertesKapital') wert = r.bilanz.kapital.eingefordertesKapital;
    el.textContent = geld(wert);
  });
  var hb = document.getElementById('hintBII');
  if (hb) {
    hb.textContent = r.bilanz.kapital.eingefordertOffen > 0
      ? 'Darin enthalten: ' + geld(r.bilanz.kapital.eingefordertOffen) +
        ' EUR eingefordertes, noch nicht eingezahltes Kapital (automatisch, § 272 Abs. 1 S. 3 HGB).'
      : '';
  }
  renderStatusbox(pr);
}
function renderStatusbox(pr) {
  var r = pr.berechnung, a = S.aktiv;
  var h = '<div class="karte"><h2>Bilanz-Status</h2>';
  h += statusZeile('Summe Aktiva', geld(r.bilanz.summeAktiva) + ' EUR');
  h += statusZeile('Summe Passiva', geld(r.bilanz.summePassiva) + ' EUR');
  h += statusZeile('Differenz', geld(r.bilanz.differenz) + ' EUR');
  h += r.bilanz.ausgeglichen
    ? '<div class="status-ampel ampel-gut">✓ Bilanz ist ausgeglichen</div>'
    : '<div class="status-ampel ampel-fehler">✕ Aktiva und Passiva stimmen nicht überein</div>';
  if (a.art === 'JAHRESABSCHLUSS') {
    h += '<div class="status-zeile gross"><span>Jahresergebnis</span><span>' +
      geld(r.guv.jahresergebnis) + ' EUR</span></div>';
    h += '<div class="karte-hint" style="margin-top:2px">' +
      (r.guv.jahresergebnis >= 0 ? 'Jahresüberschuss' : 'Jahresfehlbetrag') + '</div>';
  }
  h += '<div class="status-zeile" style="margin-top:8px"><span>Größenklasse</span><span>' +
    klasseName(a.groessenklasse) + '</span></div>';
  h += '</div>';

  h += '<div class="karte"><h2>Prüfung</h2>';
  if (!pr.meldungen.length) {
    h += '<div class="meldung m-info">Keine Beanstandungen.</div>';
  } else {
    pr.meldungen.forEach(function (mld) {
      h += '<div class="meldung m-' + mld.stufe + '">' + esc(mld.text) + '</div>';
    });
  }
  h += '</div>';
  document.getElementById('statusbox').innerHTML = h;
}
function statusZeile(l, v) {
  return '<div class="status-zeile"><span>' + l + '</span><span class="mono">' + v + '</span></div>';
}

/* ===========================================================================
 * DRUCKANSICHT
 * ========================================================================= */
function renderDruck(m) {
  var a = S.aktiv, u = S.unternehmen || {};
  if (!a) { setView('start'); return; }
  var r = Berechnung.berechne(a);
  var vj = a.vorjahrId ? null : null; // Vorjahr wird unten geladen
  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>' +
    '<div class="btn-reihe no-print" style="margin-bottom:14px">' +
    '<button class="btn btn-pri" id="btnDrucken">Drucken / als PDF speichern</button>' +
    '</div>';
  html += '<div class="dok" id="dok">' + dokInhalt(a, u, r, null) + '</div>';
  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () { setView('editor'); };
  m.querySelector('#btnDrucken').onclick = function () { window.print(); };

  if (a.vorjahrId) {
    Store.ladeAbschluss(a.vorjahrId).then(function (vja) {
      if (vja && !vja.fehler) {
        var rv = Berechnung.berechne(vja);
        document.getElementById('dok').innerHTML = dokInhalt(a, u, r, rv);
      }
    });
  }
}
function dokInhalt(a, u, r, rv) {
  var istEB = a.art === 'EROEFFNUNGSBILANZ';
  var titel = istEB ? 'Eröffnungsbilanz' : 'Jahresabschluss';
  var h = '';
  h += '<h1>' + esc(u.name || 'Unternehmen') + '</h1>';
  h += '<div class="dok-sub">' + esc((u.plz || '') + ' ' + (u.ort || '')) +
       (u.hrNummer ? ' &middot; ' + esc(u.hrNummer) : '') + '</div>';
  h += '<h1 style="margin-top:14px">' + titel + '</h1>';
  h += '<div class="dok-sub">zum ' + datumDe(a.stichtag) +
       (istEB ? '' : ' &middot; Geschäftsjahr ' + datumDe(a.gjVon) + ' bis ' + datumDe(a.gjBis)) +
       '<br>' + klasseName(a.groessenklasse) + '</div>';

  /* Bilanz in Kontoform */
  h += '<h2>Bilanz</h2><div class="dok-bilanz">';
  h += '<div class="col">' + dokSeite('aktiva', r, rv) + '</div>';
  h += '<div class="col">' + dokSeite('passiva', r, rv) + '</div>';
  h += '</div>';

  /* § 272 Abs. 1 S. 3 HGB: das eingeforderte, noch nicht eingezahlte Kapital
     wird zusaetzlich als Fussnote zur Bilanz bezeichnet */
  if (r.bilanz.kapital.eingefordertOffen > 0) {
    h += '<p class="dok-fussnote">In den Forderungen und sonstigen ' +
      'Vermögensgegenständen sind ' + geld(r.bilanz.kapital.eingefordertOffen) +
      ' EUR eingefordertes, noch nicht eingezahltes Kapital enthalten ' +
      '(§ 272 Abs. 1 Satz 3 HGB).</p>';
  }

  /* GuV */
  if (!istEB) {
    h += '<h2>Gewinn- und Verlustrechnung</h2>' + dokGuv(a, r, rv);
  }

  /* Anhang / Angaben unter der Bilanz */
  h += dokAnhang(a);

  /* Fuss */
  h += '<div class="dok-fuss">Aufgestellt nach den Vorschriften des HGB. ' +
       'Erstellt mit OpenBilanz.</div>';
  h += '<div class="dok-unterschrift"><div class="us">Ort, Datum</div>' +
       '<div class="us">Geschäftsführung' +
       ((u.geschaeftsfuehrer && u.geschaeftsfuehrer.length)
         ? '<br>' + esc(u.geschaeftsfuehrer.join(', ')) : '') + '</div></div>';
  return h;
}
/* § 265 Abs. 8 HGB: ein Posten ohne Betrag braucht nicht aufgefuehrt zu werden -
   es sei denn, im Vorjahr stand unter diesem Posten ein Betrag. */
function dzSichtbar(w, v) {
  return Math.abs(Number(w) || 0) >= 0.005 || Math.abs(Number(v) || 0) >= 0.005;
}
function dokSeite(seite, r, rv) {
  var baum = seite === 'aktiva' ? Positionen.AKTIVA : Positionen.PASSIVA;
  var werte = seite === 'aktiva' ? r.bilanz.aktiva : r.bilanz.passiva;
  var werteV = rv ? (seite === 'aktiva' ? rv.bilanz.aktiva : rv.bilanz.passiva) : null;
  var kap = r.bilanz.kapital, kapV = rv ? rv.bilanz.kapital : null;
  var h = '<div class="dok-zeile lvl-B" style="border:none"><span class="dz-lbl">' +
    (seite === 'aktiva' ? 'AKTIVA' : 'PASSIVA') + '</span>' +
    (rv ? '<span class="dz-wert" style="font-size:10px">Vorjahr</span>' : '') + '</div>';
  baum.forEach(function (b) {
    var grpSichtbar = dzSichtbar(werte[b.id], werteV ? werteV[b.id] : 0);
    // Eigenkapital stets ausweisen, solange ein gezeichnetes Kapital besteht
    if (b.id === 'P.A' && kap.gezeichnet > 0) grpSichtbar = true;
    if (!grpSichtbar) return;
    h += dokZeile(b, werte, werteV, 'B');
    if (b.kinder) {
      b.kinder.forEach(function (k) {
        // § 272 Abs. 1 S. 3 HGB: gezeichnetes Kapital mit offener Absetzung
        // der nicht eingeforderten ausstehenden Einlagen
        if (seite === 'passiva' && k.id === 'P.A.I' && kap.nichtEingefordert > 0) {
          h += dokZeileWert(k.nr, k.label, kap.gezeichnet,
                kapV ? kapV.gezeichnet : null, 'R');
          h += dokDavonZeile('Nicht eingeforderte ausstehende Einlagen',
                -kap.nichtEingefordert, kapV ? -kapV.nichtEingefordert : null);
          h += dokDavonZeile('Eingefordertes Kapital', kap.eingefordertesKapital,
                kapV ? kapV.eingefordertesKapital : null);
          return;
        }
        if (!dzSichtbar(werte[k.id], werteV ? werteV[k.id] : 0)) return;
        h += dokZeile(k, werte, werteV, k.typ === 'R' ? 'R' : 'N');
        // § 272 Abs. 1 S. 3 HGB: eingefordertes, noch nicht eingezahltes
        // Kapital gesondert unter den Forderungen ausweisen
        if (seite === 'aktiva' && k.id === 'B.II' && kap.eingefordertOffen > 0) {
          h += dokDavonZeile('davon eingefordertes, noch nicht eingezahltes Kapital',
                kap.eingefordertOffen, kapV ? kapV.eingefordertOffen : null);
        }
      });
    }
  });
  var sW = seite === 'aktiva' ? r.bilanz.summeAktiva : r.bilanz.summePassiva;
  var sV = rv ? (seite === 'aktiva' ? rv.bilanz.summeAktiva : rv.bilanz.summePassiva) : null;
  h += '<div class="dok-zeile summe"><span class="dz-lbl">' +
    (seite === 'aktiva' ? 'Summe Aktiva' : 'Summe Passiva') + '</span>' +
    '<span class="dz-wert">' + geld(sW) + (rv ? '  |  ' + geld(sV) : '') + ' EUR</span></div>';
  return h;
}
function dokZeile(node, werte, werteV, lvl) {
  var v = werteV ? (werteV[node.id] || 0) : null;
  return dokZeileWert(node.nr, node.label, werte[node.id] || 0, v, lvl);
}
function dokZeileWert(nr, label, w, v, lvl) {
  return '<div class="dok-zeile lvl-' + lvl + '"><span class="dz-lbl">' +
    (nr ? esc(nr) + ' ' : '') + esc(label) + '</span><span class="dz-wert">' +
    geld(w) + (v != null ? '  |  ' + geld(v) : '') + '</span></div>';
}
function dokDavonZeile(label, w, v) {
  return '<div class="dok-zeile dz-davon"><span class="dz-lbl">' + esc(label) +
    '</span><span class="dz-wert">' + geld(w) +
    (v != null ? '  |  ' + geld(v) : '') + '</span></div>';
}
function dokGuv(a, r, rv) {
  var schema = Positionen.guvSchema(a.guvVerfahren);
  var h = '';
  schema.forEach(function (p) {
    var w = r.guv.werte[p.id] || 0;
    var v = rv ? (rv.guv.werte[p.id] || 0) : null;
    var summe = p.art === 'Z' || p.art === 'S';
    h += '<div class="dok-zeile' + (summe ? ' summe' : '') + '">' +
      '<span class="dz-lbl">' + p.nr + ' ' + esc(p.label) + '</span>' +
      '<span class="dz-wert">' + (p.art === 'A' ? '−' : '') + geld(w) +
      (rv ? '  |  ' + geld(v) : '') + ' EUR</span></div>';
  });
  return h;
}
function dokAnhang(a) {
  var an = a.anhang || {};
  var kleinst = a.groessenklasse === 'KLEINST';
  var h = '';
  if (kleinst) {
    h += '<h2>Angaben unter der Bilanz (§ 264 Abs. 1 Satz 5 HGB)</h2>';
    h += '<p><b>Haftungsverhältnisse:</b> ' + esc(an.haftungsverhaeltnisse || '–') + '</p>';
    h += '<p><b>Vorschüsse und Kredite an Organmitglieder:</b> ' +
         esc(an.organkredite || '–') + '</p>';
  } else {
    h += '<h2>Anhang</h2>';
    if (an.methoden) h += '<p><b>Bilanzierungs- und Bewertungsmethoden:</b> ' +
      esc(an.methoden) + '</p>';
    h += '<p><b>Durchschnittliche Zahl der Arbeitnehmer:</b> ' +
      esc(an.arbeitnehmer || 0) + '</p>';
    if (an.restlaufzeit5) h += '<p><b>Verbindlichkeiten mit Restlaufzeit über 5 Jahre:</b> ' +
      esc(an.restlaufzeit5) + ' EUR</p>';
    h += '<p><b>Haftungsverhältnisse:</b> ' + esc(an.haftungsverhaeltnisse || '–') + '</p>';
    h += '<p><b>Vorschüsse und Kredite an Organmitglieder:</b> ' +
      esc(an.organkredite || '–') + '</p>';
    if (an.ergebnisverwendung) h += '<p><b>Vorschlag zur Ergebnisverwendung:</b> ' +
      esc(an.ergebnisverwendung) + '</p>';
  }
  if (an.sonstiges) h += '<p><b>Sonstige Angaben:</b> ' + esc(an.sonstiges) + '</p>';
  return h;
}

/* ===========================================================================
 * E-BILANZ
 * ========================================================================= */
function renderEbilanz(m) {
  var a = S.aktiv;
  if (!a) { setView('start'); return; }
  var r = Berechnung.berechne(a);
  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>';
  html += '<div class="kopf"><h1>E-Bilanz</h1>' +
    '<p>Bilanz und GuV elektronisch ans Finanzamt &ndash; Pflicht für jede GmbH ' +
    '(§ 5b EStG), auch für die Eröffnungsbilanz.</p></div>';

  /* 1. Datei erzeugen */
  html += '<div class="karte"><h2>1. E-Bilanz-Datei erzeugen ' +
    '<span class="reg">&middot; Kerntaxonomie ' + Taxonomie.VERSION +
    ', Stand ' + Taxonomie.STAND + '</span></h2>' +
    '<div class="karte-hint">Der <b>EBilanz-Container</b> ist die Übermittlungsform; ' +
    'die reine <b>XBRL-Instanz</b> dient zum Validieren.</div><div class="btn-reihe">' +
    '<button class="btn btn-pri" id="dlEbilanz">EBilanz-Container herunterladen</button>' +
    '<button class="btn" id="dlInstanz">XBRL-Instanz herunterladen</button>' +
    '</div></div>';

  /* 2. Validieren */
  var valTitel = Store.modus === 'website' ? '2. E-Bilanz prüfen'
                                           : '2. Gegen die amtliche Taxonomie prüfen';
  var valHint = Store.modus === 'website'
    ? 'Schnelle Konsistenz- und Pflichtangaben-Prüfung im Browser.'
    : 'Validierung mit Arelle gegen die Taxonomie ' + Taxonomie.VERSION +
      ' &ndash; findet Fehler vor der Übermittlung.';
  html += '<div class="karte"><div class="karte-kopf"><div>' +
    '<h2>' + valTitel + '</h2>' +
    '<div class="karte-hint">' + valHint + '</div></div>' +
    '<button class="btn btn-pri" id="valBtn">Jetzt prüfen</button></div>';
  if (Store.modus === 'website') {
    html += '<div class="karte-hint" style="margin-top:11px"><b>Experimentell:</b> ' +
      'vollständige Validierung gegen die amtliche Taxonomie direkt im Browser ' +
      '(Arelle via Pyodide). Erfordert einmalig den Download der Pyodide-/Arelle-' +
      'Assets über <code>tools/setup-pyodide.sh</code>; der erste Lauf lädt ' +
      'größere Dateien.</div>' +
      '<button class="btn" id="valArelleBtn" style="margin-top:6px">' +
      'Vollständige Taxonomie-Prüfung (Arelle)</button>';
  }
  html += '<div id="valErgebnis"></div></div>';

  /* 3. Übermittlung */
  html += '<div class="karte"><h2>3. Übermittlung ans Finanzamt</h2>' +
    '<div class="box box-warn"><b>Mein ELSTER kann keine E-Bilanz</b>' +
    'Es gibt dort kein E-Bilanz-Formular und keinen XBRL-Upload. Die Übermittlung ' +
    'läuft technisch über ERiC (ELSTER Rich Client).</div>' +
    '<table class="frist-tab"><tbody>' +
    fr('1. ERiC beziehen', 'Als Entwickler bei ELSTER registrieren (kostenlos, ' +
       'elster.de/Entwickler) und ERiC herunterladen.') +
    fr('2. Hersteller-ID + Zertifikat', 'Hersteller-ID beantragen, ELSTER-Organisations' +
       'zertifikat der GmbH erstellen.') +
    fr('3. Übermitteln', 'Den EBilanz-Container über eine ERiC-fähige Software senden ' +
       '&ndash; z. B. das Open-Source-Projekt taxel (github.com/quambene/taxel).') +
    fr('Alternative', 'Eine E-Bilanz-Software oder das Steuerbüro nur für den Versand ' +
       'nutzen &ndash; die Daten sind hier bereits fertig erzeugt.') +
    '</tbody></table></div>';

  /* Werteübersicht */
  html += '<div class="karte"><h2>Werteübersicht (HGB-Position &rarr; Taxonomie)</h2>' +
    '<div class="karte-hint">Alle Beträge mit dem zugehörigen Taxonomie-Element.</div>' +
    '<table class="werte-tab"><thead><tr><th>HGB-Position</th>' +
    '<th>Taxonomie-Element (de-gaap-ci)</th><th class="rechts">Betrag EUR</th></tr></thead><tbody>';
  var flachA = Positionen.flach(Positionen.AKTIVA);
  var flachP = Positionen.flach(Positionen.PASSIVA);
  flachA.concat(flachP).forEach(function (n) {
    var el = Taxonomie.bilanzElement(n.id);
    if (!el) return;
    var seite = n.id.charAt(0) === 'P' ? r.bilanz.passiva : r.bilanz.aktiva;
    html += werteZeile(n.nr + ' ' + n.label, el, seite[n.id] || 0);
  });
  if (a.art === 'JAHRESABSCHLUSS') {
    Positionen.guvSchema(a.guvVerfahren).forEach(function (p) {
      var el = Taxonomie.guvElement(p.id);
      if (!el) return;
      html += werteZeile(p.nr + ' ' + p.label, el, r.guv.werte[p.id] || 0);
    });
  }
  html += '</tbody></table></div>';

  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () { setView('editor'); };
  m.querySelector('#dlEbilanz').onclick = function () {
    Store.erzeugeXBRL(S.unternehmen, a, 'ebilanz').then(function (r) {
      ladeDatei(r.xml, r.dateiname, 'application/xml; charset=utf-8');
    });
  };
  m.querySelector('#dlInstanz').onclick = function () {
    Store.erzeugeXBRL(S.unternehmen, a, 'instanz').then(function (r) {
      ladeDatei(r.xml, r.dateiname, 'application/xml; charset=utf-8');
    });
  };
  m.querySelector('#valBtn').onclick = function () {
    var box = document.getElementById('valErgebnis');
    box.innerHTML = '<div class="meldung m-info">Prüfung läuft &hellip;</div>';
    Store.validiere(S.unternehmen, a).then(function (e) {
      box.innerHTML = ebilanzValErgebnis(e);
    }).catch(function () {
      box.innerHTML = '<div class="meldung m-fehler">Prüfung nicht möglich.</div>';
    });
  };
  var valArelle = m.querySelector('#valArelleBtn');
  if (valArelle) valArelle.onclick = function () {
    var box = document.getElementById('valErgebnis');
    box.innerHTML = '<div class="meldung m-info">Arelle-Prüfung wird vorbereitet &hellip;</div>';
    Store.erzeugeXBRL(S.unternehmen, a, 'instanz').then(function (r) {
      return BrowserValidate.pruefeTaxonomie(r.xml, function (status) {
        box.innerHTML = '<div class="meldung m-info">' + esc(status) + '</div>';
      });
    }).then(function (log) {
      box.innerHTML = arelleErgebnis(log);
    }).catch(function (e) {
      box.innerHTML = '<div class="meldung m-fehler">Arelle-Prüfung fehlgeschlagen: ' +
        esc((e && e.message) || String(e)) + '</div>';
    });
  };
}
function ebilanzValErgebnis(e) {
  var h = '';
  var amtlich = e.methode !== 'js-konsistenz';
  if (e.ok === true) {
    h += '<div class="status-ampel ampel-gut">✓ ' + (amtlich
      ? 'Gültig &ndash; keine Beanstandungen gegen die amtliche Taxonomie.'
      : 'Keine Beanstandungen in der Konsistenzprüfung.') + '</div>';
  } else if (e.ok === false) {
    h += '<div class="status-ampel ampel-fehler">✕ ' + e.fehler.length +
      ' Beanstandung(en):</div>';
    e.fehler.forEach(function (f) {
      h += '<div class="meldung m-fehler"><b>[' + esc(f.code) + ']</b> ' + esc(f.text) + '</div>';
    });
  } else {
    h += '<div class="meldung m-warnung">Prüfung nicht durchgeführt. ' +
      (e.arelleVerfuegbar ? '' : 'Arelle ist nicht installiert (pip install arelle-release). ') +
      (e.taxonomiePaket ? '' : 'Taxonomie-Paket fehlt &ndash; siehe tools/setup-taxonomie.sh. ') +
      '</div>';
  }
  (e.hinweise || []).forEach(function (hw) {
    h += '<div class="meldung m-info">' + esc(hw) + '</div>';
  });
  (e.warnungen || []).forEach(function (w) {
    h += '<div class="meldung m-warnung">' + esc(w) + '</div>';
  });
  return h;
}
/* Wertet das Arelle-Protokoll aus und zeigt ein klares Urteil + Rohprotokoll. */
function arelleErgebnis(log) {
  var fehler = 0, warnung = 0;
  String(log || '').split(/\r?\n/).forEach(function (z) {
    var m = z.match(/^\[(\w+)\]/);
    if (!m) return;
    var lvl = m[1].toUpperCase();
    if (lvl === 'ERROR' || lvl === 'CRITICAL') fehler++;
    else if (lvl === 'WARNING') warnung++;
  });
  var h = '<div class="karte"><h2>Arelle-Ergebnis (amtliche Taxonomie)</h2>';
  if (fehler === 0) {
    h += '<div class="status-ampel ampel-gut">✓ Strukturell gültig &ndash; keine ' +
      'formalen Beanstandungen' +
      (warnung ? ' (' + warnung + ' Hinweis' + (warnung === 1 ? '' : 'e') + ')' : '') +
      ' gegen die amtliche Taxonomie.</div>';
  } else {
    h += '<div class="status-ampel ampel-fehler">✕ ' + fehler + ' formale Beanstandung(en)' +
      (warnung ? ', ' + warnung + ' Hinweis(e)' : '') + ' gegen die Taxonomie.</div>';
  }
  h += '<div class="karte-hint" style="margin-top:8px">Arelle prüft den <b>formalen ' +
    'Aufbau</b> (XBRL-Struktur, Taxonomie-Konformität) &ndash; nicht die inhaltliche ' +
    'Plausibilität wie Bilanzgleichung oder Pflichtangaben. Dafür ist „Jetzt prüfen".</div>' +
    '<div class="karte-hint" style="margin-top:8px">Vollständiges Arelle-Protokoll:</div>' +
    '<pre class="arelle-log">' + esc(log || '(keine Ausgabe)') + '</pre></div>';
  return h;
}
function werteZeile(label, el, wert) {
  return '<tr><td>' + esc(label) + '</td><td class="el">' + esc(el) +
    '</td><td class="rechts mono">' + geld(wert) + '</td></tr>';
}

/* ===========================================================================
 * STEUERN  (Körperschaft-, Gewerbesteuer, Soli - auch für vv-GmbH)
 * ========================================================================= */
function renderSteuer(m) {
  var a = S.aktiv;
  if (!a) { setView('start'); return; }
  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>';
  html += '<div class="kopf"><h1>Steuern &ndash; ' + esc(a.bezeichnung) + '</h1>' +
    '<p>Überschlägige Berechnung von Körperschaft- und Gewerbesteuer &ndash; mit ' +
    'den Besonderheiten der vermögensverwaltenden GmbH (§ 8b KStG, § 9 GewStG).</p></div>';
  if (a.art !== 'JAHRESABSCHLUSS') {
    html += '<div class="box box-info">Die Steuerberechnung steht beim ' +
      'Jahresabschluss zur Verfügung &ndash; sie baut auf der GuV auf.</div>';
    m.innerHTML = html;
    m.querySelector('[data-z]').onclick = function () { setView('editor'); };
    return;
  }
  html += '<div class="box box-warn"><b>Orientierungsrechnung</b>Eine überschlägige ' +
    'Schätzung, keine verbindliche Steuerberechnung. Hinzurechnungen und Kürzungen ' +
    'nach §§ 8/9 GewStG sind nur teilweise abgebildet. Im Zweifel Steuerberater ' +
    'hinzuziehen.</div>';

  a.steuer = a.steuer || {};
  function sf(pfad, label, sub, typ) {
    var v = getNested(a, 'steuer.' + pfad);
    if (typ === 'check') {
      return '<label class="checkz"><input type="checkbox" data-st="' + pfad + '"' +
        (v ? ' checked' : '') + '><span>' + label +
        (sub ? ' <span class="sub">&ndash; ' + sub + '</span>' : '') + '</span></label>';
    }
    return feldWrap(label, sub, '<input class="zahl" type="text" inputmode="decimal" ' +
      'data-st="' + pfad + '" value="' + eingabeWert(v) + '">');
  }
  html += '<div class="karte"><h2>Angaben</h2><div class="gitter g2">';
  html += sf('hebesatz', 'Gewerbesteuer-Hebesatz (%)', 'Ihrer Gemeinde, z. B. 400');
  html += sf('nichtAbziehbareAufwendungen', 'Nicht abziehbare Betriebsausgaben (EUR)',
    'z. B. 30 % Bewirtung, Geschenke');
  html += sf('beteiligungsertraege', 'Beteiligungserträge / Dividenden (EUR)', '§ 8b KStG');
  html += sf('veraeusserungsgewinne', 'Veräußerungsgewinne aus Anteilen (EUR)',
    '§ 8b Abs. 2 KStG');
  html += sf('immobilienertrag', 'Begünstigter Grundstücksertrag (EUR)',
    'bei erweiterter Kürzung');
  html += sf('einfacheKuerzungGrundbesitzwert', 'Grundsteuerwert des Grundbesitzes (EUR)',
    'für einfache Kürzung 0,11 %');
  html += '</div><div class="gitter" style="margin-top:12px">';
  html += sf('beteiligungUnter10', 'Streubesitz: Beteiligung unter 10 %',
    'Dividende voll körperschaftsteuerpflichtig (§ 8b Abs. 4 KStG)', 'check');
  html += sf('beteiligungUnter15', 'Beteiligung unter 15 %',
    'Dividende gewerbesteuerpflichtig (§ 8 Nr. 5 GewStG)', 'check');
  html += sf('erweiterteKuerzung', 'Erweiterte Grundstücks-Kürzung beantragt',
    'nur eigener Grundbesitz (§ 9 Nr. 1 Satz 2 GewStG)', 'check');
  html += '</div></div><div id="steuerErgebnis"></div>';

  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () {
    speichereStill().then(function () { setView('editor'); });
  };
  m.querySelectorAll('[data-st]').forEach(function (el) {
    var ev = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, function () {
      var wert = el.type === 'checkbox' ? el.checked
        : (el.classList.contains('zahl') ? Berechnung.num(el.value) : el.value);
      setNested(a, 'steuer.' + el.dataset.st, wert);
      steuerErgebnis(a);
    });
  });
  steuerErgebnis(a);
}
function steuerErgebnis(a) {
  var guv = Berechnung.rechneGuv(a);
  var s = Steuer.berechne(a, guv);
  function tab(titel, schritte) {
    var h = '<div class="karte"><h2>' + titel + '</h2><table class="pos-tab">';
    schritte.forEach(function (z) { h += steuerZeile(z); });
    return h + '</table></div>';
  }
  var h = tab('Körperschaftsteuer', s.kst.schritte);
  h += tab('Gewerbesteuer', s.gewst.schritte);
  h += '<div class="karte"><h2>Gesamtbelastung</h2><table class="pos-tab">' +
    steuerZeile({ text: 'Körperschaftsteuer + Solidaritätszuschlag',
      betrag: Berechnung.cent(s.kst.betrag + s.kst.soli) }) +
    steuerZeile({ text: 'Gewerbesteuer', betrag: s.gewst.betrag }) +
    steuerZeile({ text: 'Steuerbelastung gesamt', betrag: s.gesamtsteuer, summe: true }) +
    steuerZeile({ text: 'Ergebnis nach Steuern', betrag: s.ergebnisNachSteuern, summe: true }) +
    '</table><div class="karte-hint" style="margin-top:8px">Durchschnittliche ' +
    'Steuerbelastung: ' + geld(s.durchschnittsbelastung) + ' % des Ergebnisses vor ' +
    'Steuern.</div></div>';
  document.getElementById('steuerErgebnis').innerHTML = h;
}
function steuerZeile(z) {
  return '<tr class="' + (z.summe ? 'zeile-summe' : 'zeile-R') + '">' +
    '<td class="p-lbl">' + esc(z.text) + '</td>' +
    '<td class="p-wert"><span class="wert-ro">' + geld(z.betrag) + '</span></td></tr>';
}

/* ===========================================================================
 * BUCHHALTUNG (Modus 2) - Buchungsjournal nach SKR04
 * ========================================================================= */
function renderBuchhaltung(m) {
  var a = S.aktiv;
  if (!a) { setView('start'); return; }
  if (!a.buchungen) a.buchungen = [];
  if (!a.protokoll) a.protokoll = [];
  a.buchungen.forEach(function (b, i) { if (!b.id) b.id = 'B-leg-' + i; });
  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>';
  html += '<div class="kopf"><h1>Buchhaltung &ndash; ' + esc(a.bezeichnung) + '</h1>' +
    '<p>Erfassen Sie Buchungssätze nach dem Kontenrahmen SKR04. Aus den Kontensalden ' +
    'lassen sich Bilanz und GuV automatisch befüllen.</p></div>';

  html += '<div class="box box-info"><b>Hinweis</b>Dieser Modus ist die Grundlage für die ' +
    'laufende Buchhaltung. Mit &bdquo;Salden übernehmen&ldquo; werden die Kontensalden in ' +
    'die Positionen der Bilanz/GuV dieses Abschlusses übertragen.</div>';

  /* Erfassungsformular */
  var kontoOpt = SKR04.KONTEN.map(function (k) {
    return '<option value="' + k.nr + '">' + k.nr + ' &ndash; ' + esc(k.name) + '</option>';
  }).join('');
  html += '<div class="karte"><h2>Buchung erfassen</h2>' +
    '<div class="gitter g3">' +
    feldWrap('Datum', '', '<input type="date" id="buDatum" value="' +
      esc(a.stichtag || '') + '">') +
    feldWrap('Betrag (EUR)', '', '<input class="zahl" type="text" inputmode="decimal" id="buBetrag">') +
    feldWrap('Buchungstext', '', '<input id="buText">') +
    feldWrap('Soll-Konto', '', '<select id="buSoll">' + kontoOpt + '</select>') +
    feldWrap('Haben-Konto', '', '<select id="buHaben">' + kontoOpt + '</select>') +
    '<div style="display:flex;align-items:flex-end"><button class="btn btn-pri" id="buAdd">' +
    'Buchung hinzufügen</button></div>' +
    '</div></div>';

  /* Journal */
  var offeneBu = a.buchungen.filter(function (b) { return !b.fest; }).length;
  html += '<div class="karte"><div class="karte-kopf"><div><h2>Buchungsjournal</h2>' +
    '<div class="karte-hint">' + a.buchungen.length + ' Buchung(en)' +
    (a.buchungen.length ? (offeneBu ? ', davon ' + offeneBu + ' nicht festgeschrieben'
                                    : ' &middot; alle festgeschrieben') : '') +
    '</div></div><div class="btn-reihe">' +
    (offeneBu ? '<button class="btn" id="buFest">Buchungen festschreiben</button>' : '') +
    '<button class="btn" id="buUebernehmen">Salden in Bilanz/GuV übernehmen</button>' +
    '</div></div>';
  if (!a.buchungen.length) {
    html += '<div class="karte-hint">Noch keine Buchungen erfasst.</div>';
  } else {
    html += '<table class="liste"><thead><tr><th>Datum</th><th>Text</th><th>Soll</th>' +
      '<th>Haben</th><th class="rechts">Betrag</th><th></th></tr></thead><tbody>';
    a.buchungen.forEach(function (b, i) {
      var aktion;
      if (b.fest) {
        if (b.storniert) aktion = '<span class="bu-tag">storniert</span>';
        else if (b.stornoVon) aktion = '<span class="bu-tag">Storno</span>';
        else aktion = '<span class="btn btn-sm" data-storno="' + esc(b.id) + '">stornieren</span>';
      } else {
        aktion = '<span class="btn btn-sm btn-gefahr" data-del="' + i + '">löschen</span>';
      }
      html += '<tr><td class="mono">' + (b.fest ? '🔒 ' : '') + datumDe(b.datum) + '</td>' +
        '<td>' + esc(b.text || '') + '</td>' +
        '<td class="mono">' + esc(b.soll) + '</td><td class="mono">' + esc(b.haben) + '</td>' +
        '<td class="rechts mono">' + geld(b.betrag) + '</td>' +
        '<td class="rechts">' + aktion + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';

  /* Saldenliste */
  html += '<div class="karte"><h2>Summen- und Saldenliste</h2>' +
    saldenliste(a) + '</div>';

  /* Änderungsprotokoll (GoBD) */
  if (a.protokoll.length) {
    html += '<div class="karte"><h2>Änderungsprotokoll</h2><table class="liste"><tbody>';
    a.protokoll.slice().reverse().forEach(function (p) {
      html += '<tr><td class="mono">' + datumDe((p.zeit || '').slice(0, 10)) +
        '</td><td>' + esc(p.text) + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () { setView('editor'); };
  m.querySelector('#buAdd').onclick = function () {
    var b = {
      id: 'B-' + Date.now(),
      datum: document.getElementById('buDatum').value,
      betrag: Berechnung.num(document.getElementById('buBetrag').value),
      text: document.getElementById('buText').value,
      soll: document.getElementById('buSoll').value,
      haben: document.getElementById('buHaben').value
    };
    if (!b.betrag) { alert('Bitte einen Betrag eingeben.'); return; }
    a.buchungen.push(b);
    speichereStill().then(function () { renderBuchhaltung(m); });
  };
  m.querySelectorAll('[data-del]').forEach(function (el) {
    el.onclick = function () {
      a.buchungen.splice(parseInt(el.dataset.del, 10), 1);
      speichereStill().then(function () { renderBuchhaltung(m); });
    };
  });
  var buFest = m.querySelector('#buFest');
  if (buFest) buFest.onclick = function () {
    if (!confirm('Alle noch nicht festgeschriebenen Buchungen festschreiben? ' +
      'Danach sind sie unveränderlich — Korrekturen nur noch per Stornobuchung.')) return;
    var n = 0;
    a.buchungen.forEach(function (b) {
      if (!b.fest) { b.fest = true; b.festAm = new Date().toISOString(); n++; }
    });
    a.protokoll.push({ zeit: new Date().toISOString(),
      text: n + ' Buchung(en) festgeschrieben' });
    speichereStill().then(function () { renderBuchhaltung(m); });
  };
  m.querySelectorAll('[data-storno]').forEach(function (el) {
    el.onclick = function () {
      var orig = null, k;
      for (k = 0; k < a.buchungen.length; k++) {
        if (a.buchungen[k].id === el.dataset.storno) { orig = a.buchungen[k]; break; }
      }
      if (!orig || orig.storniert) return;
      orig.storniert = true;
      a.buchungen.push({
        id: 'B-' + Date.now(), datum: new Date().toISOString().slice(0, 10),
        betrag: orig.betrag, text: 'Storno: ' + (orig.text || orig.id),
        soll: orig.haben, haben: orig.soll, stornoVon: orig.id
      });
      a.protokoll.push({ zeit: new Date().toISOString(),
        text: 'Stornobuchung zu „' + (orig.text || orig.id) + '" erstellt' });
      speichereStill().then(function () { renderBuchhaltung(m); });
    };
  });
  m.querySelector('#buUebernehmen').onclick = function () {
    uebernehmeSalden(a);
    speichereStill().then(function () {
      hinweisToast('Kontensalden in Bilanz und GuV übernommen.');
      setView('editor');
    });
  };
}
function kontenSalden(a) {
  var s = {};
  (a.buchungen || []).forEach(function (b) {
    s[b.soll] = s[b.soll] || { soll: 0, haben: 0 };
    s[b.haben] = s[b.haben] || { soll: 0, haben: 0 };
    s[b.soll].soll += Berechnung.num(b.betrag);
    s[b.haben].haben += Berechnung.num(b.betrag);
  });
  return s;
}
function saldenliste(a) {
  var s = kontenSalden(a);
  var keys = Object.keys(s).sort();
  if (!keys.length) return '<div class="karte-hint">Noch keine Buchungen.</div>';
  var h = '<table class="liste"><thead><tr><th>Konto</th><th>Bezeichnung</th>' +
    '<th class="rechts">Soll</th><th class="rechts">Haben</th><th class="rechts">Saldo</th>' +
    '</tr></thead><tbody>';
  keys.forEach(function (nr) {
    var k = SKR04.kontoFinden(nr) || { name: 'unbekannt' };
    var saldo = s[nr].soll - s[nr].haben;
    h += '<tr><td class="mono">' + esc(nr) + '</td><td>' + esc(k.name) + '</td>' +
      '<td class="rechts mono">' + geld(s[nr].soll) + '</td>' +
      '<td class="rechts mono">' + geld(s[nr].haben) + '</td>' +
      '<td class="rechts mono">' + geld(saldo) + '</td></tr>';
  });
  h += '</tbody></table>';
  return h;
}
function uebernehmeSalden(a) {
  var s = kontenSalden(a);
  var aktiva = {}, passiva = {}, guv = {};
  Object.keys(s).forEach(function (nr) {
    var k = SKR04.kontoFinden(nr);
    if (!k) return;
    var saldo = s[nr].soll - s[nr].haben;       // Aktiv: Soll-Saldo; Passiv: Haben-Saldo
    if (nr === '2900') {                         // Gezeichnetes Kapital -> Kapitalblock
      a.kapital = a.kapital || {};
      a.kapital.gezeichnet = Berechnung.cent(-saldo);
      if (!a.kapital.eingezahlt) a.kapital.eingezahlt = Berechnung.cent(-saldo);
      return;
    }
    if (k.seite === 'AKTIV') {
      aktiva[k.pos] = Berechnung.cent((aktiva[k.pos] || 0) + saldo);
    } else if (k.seite === 'PASSIV') {
      if (k.pos === 'P.A.I' || k.pos === 'P.A.V') return;   // werden automatisch berechnet
      passiva[k.pos] = Berechnung.cent((passiva[k.pos] || 0) - saldo);
    } else if (k.seite === 'ERTRAG' || k.seite === 'AUFWAND') {
      var gid = SKR04.KAT_GUV[k.kat] && SKR04.KAT_GUV[k.kat][a.guvVerfahren || 'GKV'];
      if (gid) guv[gid] = Berechnung.cent((guv[gid] || 0) + Math.abs(saldo));
    }
  });
  a.werte = a.werte || {};
  a.werte.aktiva = aktiva;
  a.werte.passiva = passiva;
  a.werte.guv = guv;
  a.erfassungsmodus = 'BUCHHALTUNG';
}

/* ===========================================================================
 * FRISTEN & PFLICHTEN
 * ========================================================================= */
function renderFristen(m) {
  var html = '<div class="kopf"><h1>Fristen &amp; Pflichten</h1>' +
    '<p>Die wichtigsten gesetzlichen Pflichten rund um den Jahresabschluss einer ' +
    'kleinen GmbH.</p></div>';

  html += '<div class="karte"><h2>Was ist abzugeben?</h2><table class="frist-tab"><tbody>' +
    fr('Eröffnungsbilanz', 'Zu Beginn des Handelsgewerbes (§ 242 Abs. 1 HGB). ' +
       'Elektronisch ans Finanzamt nach § 5b EStG.') +
    fr('Jahresabschluss aufstellen', 'Bilanz + GuV + Anhang. Kleine/Kleinst-GmbH: ' +
       'innerhalb von 6 Monaten nach dem Bilanzstichtag (§ 264 Abs. 1 S. 4 HGB), ' +
       'kein Lagebericht.') +
    fr('E-Bilanz ans Finanzamt', 'Bilanz und GuV elektronisch per Datenfernübertragung ' +
       '(§ 5b EStG), als XBRL über ERiC.') +
    fr('Offenlegung', 'Beim Unternehmensregister, innerhalb von 12 Monaten nach dem ' +
       'Bilanzstichtag (§ 325 Abs. 1a HGB). Kleine GmbH: nur Bilanz + Anhang. ' +
       'Kleinst-GmbH: nur Bilanz, Hinterlegung möglich (§ 326 HGB).') +
    fr('Körperschaft-, Gewerbe-, Umsatzsteuererklärung', 'Elektronisch über ELSTER. ' +
       'Ohne Berater regulär 7 Monate nach Jahresende.') +
    '</tbody></table></div>';

  html += '<div class="karte"><h2>Wenn die Offenlegung versäumt wird</h2>' +
    '<div class="box box-warn"><b>Ordnungsgeld &ndash; § 335 HGB</b>' +
    'Das Bundesamt für Justiz setzt bei verspäteter Offenlegung ein Ordnungsgeld fest ' +
    '(mindestens 2.500 EUR). Bei verspäteter Nachholung: Kleinst-GmbH ab 500 EUR, ' +
    'kleine GmbH ab 1.000 EUR.</div></div>';

  html += '<div class="karte"><h2>Aufbewahrung</h2><table class="frist-tab"><tbody>' +
    fr('10 Jahre', 'Jahresabschlüsse, Eröffnungsbilanzen, Inventare, Handelsbücher ' +
       '(§ 257 HGB, § 147 AO).') +
    fr('8 Jahre', 'Buchungsbelege (seit 2025 verkürzt durch das 4. Bürokratie' +
       'entlastungsgesetz).') +
    fr('6 Jahre', 'Empfangene und abgesandte Handels-/Geschäftsbriefe.') +
    '</tbody></table></div>';

  html += '<div class="box box-info"><b>Wichtiger Hinweis</b>Dieses Tool unterstützt Sie ' +
    'bei der Erstellung der Bilanzen, ersetzt aber keine Steuer- oder Rechtsberatung. ' +
    'Bei komplexen Sachverhalten (Sacheinlagen, latente Steuern, Bewertungsfragen) ziehen ' +
    'Sie im Zweifel fachlichen Rat hinzu.</div>';

  m.innerHTML = html;
}
function fr(d, t) {
  return '<tr><td class="f-d">' + d + '</td><td>' + t + '</td></tr>';
}

/* ===========================================================================
 * BACKUP / EXPORT / IMPORT  (nur Website-Modus)
 * ---------------------------------------------------------------------------
 * Beim Speichern wird die IndexedDB beschrieben; ist eine Sicherungsdatei
 * bekannt, wird diese zusätzlich lautlos aktualisiert. So lässt sich der Stand
 * jederzeit auf ein anderes Gerät / in einen anderen Browser übernehmen.
 * Die .obz-Datei ist das einzige verlässliche Backup.
 * ========================================================================= */
function initBackupUI() {
  var leiste = document.getElementById('backupLeiste');
  var hinweis = document.getElementById('datenHinweis');
  if (!Store.unterstuetztExport) { if (leiste) leiste.hidden = true; return; }
  if (hinweis) hinweis.hidden = true;
  if (!leiste) return;
  leiste.hidden = false;
  leiste.innerHTML =
    '<div class="backup-status" id="backupStatus">&ndash;</div>' +
    '<div class="backup-btns">' +
    '<button class="btn-mini" id="btnSichern">Sichern</button>' +
    '<button class="btn-mini" id="btnImport">Backup öffnen</button></div>';
  document.getElementById('btnSichern').onclick = function () { exportiereBackup(); };
  document.getElementById('btnImport').onclick = function () { importiereBackup(); };
  Store.getMeta('fileHandle').then(function (h) { BackupHandle = h || null; });
  aktualisiereBackup();
}

/* Aktualisiert die Backup-Anzeige in der Seitenleiste. */
function aktualisiereBackup() {
  if (!Store.unterstuetztExport) return Promise.resolve();
  return Store.backupStatus().then(function (b) {
    var el = document.getElementById('backupStatus');
    if (!el) return;
    if (b.aenderungen > 0) {
      el.className = 'backup-status offen';
      el.textContent = '● ' + b.aenderungen + ' ungesicherte Änderung' +
        (b.aenderungen === 1 ? '' : 'en');
    } else if (b.exportiertAm) {
      el.className = 'backup-status gut';
      el.textContent = '✓ Gesichert am ' + datumDe(b.exportiertAm.slice(0, 10));
    } else {
      el.className = 'backup-status';
      el.textContent = 'Noch kein Backup erstellt';
    }
  });
}

/* Nach jedem Speichern: Persistenz anfordern, bekannte Datei lautlos
 * aktualisieren, Anzeige nachführen. */
function nachSpeichern() {
  if (!Store.unterstuetztExport) return Promise.resolve();
  persistAnfordern();
  if (BackupHandle && FileIO.unterstuetztPicker) {
    return schreibeBackup(BackupHandle).then(aktualisiereBackup, function () {
      return aktualisiereBackup();
    });
  }
  return aktualisiereBackup();
}

var persistGeprueft = false;
function persistAnfordern() {
  if (persistGeprueft || !navigator.storage || !navigator.storage.persist) return;
  persistGeprueft = true;
  navigator.storage.persisted().then(function (schon) {
    if (!schon) navigator.storage.persist();
  });
}

/* Erzeugt die .obz-Bytes und schreibt sie (handle bekannt -> lautlos). */
function schreibeBackup(handle) {
  return Store.leseSnapshot().then(function (snap) {
    return OBZ.packen(snap, SitzungsPasswort);
  }).then(function (bytes) {
    return FileIO.exportieren(bytes, 'openbilanz-backup.obz', handle);
  }).then(function (neuHandle) {
    if (neuHandle) { BackupHandle = neuHandle; return Store.setMeta('fileHandle', neuHandle); }
  }).then(function () {
    return Store.markiereExport();
  });
}

/* Explizites Sichern über den Knopf in der Seitenleiste. */
function exportiereBackup() {
  if (BackupHandle) {
    schreibeBackup(BackupHandle).then(function () {
      aktualisiereBackup(); hinweisToast('Backup gespeichert.');
    }, fehlerToast);
    return;
  }
  dialogBackupPasswort(function (pw) {
    SitzungsPasswort = pw || null;
    schreibeBackup(null).then(function () {
      aktualisiereBackup(); hinweisToast('Backup gespeichert.');
    }, fehlerToast);
  });
}

/* Backup-Datei einlesen und übernehmen (ersetzt den aktuellen Stand). */
function importiereBackup() {
  var dateiPromise;
  try { dateiPromise = FileIO.importieren(); }
  catch (e) { fehlerToast(e); return; }
  dateiPromise.then(function (buf) {
    return OBZ.entpacken(buf, function () {
      return new Promise(function (resolve) { dialogPasswortAbfrage(resolve); });
    });
  }).then(function (snapshot) {
    dialogImportBestaetigen(snapshot, function () {
      Store.schreibeSnapshot(snapshot).then(function () {
        return Store.setMeta('fileHandle', null);   /* nicht die Quelldatei überschreiben */
      }).then(function () {
        BackupHandle = null;
        SitzungsPasswort = null;
        hinweisToast('Backup importiert.');
        boot();
      });
    });
  }, fehlerToast);
}

/* ---- Backup-Dialoge ---------------------------------------------------- */
function dialogBackupPasswort(weiter) {
  dialog('<h3>Backup speichern</h3>' +
    '<p class="karte-hint">Die Sicherungsdatei (.obz) kann optional mit einem ' +
    'Passwort geschützt werden. Ohne Passwort wird sie als lesbares JSON ' +
    'gespeichert.</p>' +
    feldWrap('Passwort', 'optional',
      '<input type="password" id="bpPw" autocomplete="new-password">') +
    '<div class="box box-warn"><b>Hinweis</b>Ein vergessenes Passwort kann nicht ' +
    'wiederhergestellt werden.</div>' +
    '<div class="btn-reihe"><button class="btn btn-pri" id="bpOk">Datei wählen &amp; sichern</button>' +
    '<button class="btn" id="bpAb">Abbrechen</button></div>');
  document.getElementById('bpAb').onclick = dialogZu;
  document.getElementById('bpOk').onclick = function () {
    var pw = document.getElementById('bpPw').value;
    dialogZu();
    weiter(pw);
  };
}
function dialogPasswortAbfrage(weiter) {
  dialog('<h3>Passwort erforderlich</h3>' +
    '<p class="karte-hint">Diese Sicherung ist verschlüsselt.</p>' +
    feldWrap('Passwort', '',
      '<input type="password" id="paPw" autocomplete="current-password">') +
    '<div class="btn-reihe"><button class="btn btn-pri" id="paOk">Entschlüsseln</button>' +
    '<button class="btn" id="paAb">Abbrechen</button></div>');
  document.getElementById('paAb').onclick = function () { dialogZu(); weiter(''); };
  document.getElementById('paOk').onclick = function () {
    var pw = document.getElementById('paPw').value;
    dialogZu();
    weiter(pw);
  };
}
function dialogImportBestaetigen(snapshot, weiter) {
  var anz = (snapshot.abschluesse || []).length;
  var firma = (snapshot.unternehmen && snapshot.unternehmen.name) || 'ohne Firmenname';
  var datum = snapshot.exportiertAm ? datumDe(snapshot.exportiertAm.slice(0, 10)) : 'unbekannt';
  dialog('<h3>Backup importieren</h3>' +
    '<p>Sicherung vom <b>' + esc(datum) + '</b> &ndash; ' + esc(firma) + ', ' +
    anz + ' Abschluss' + (anz === 1 ? '' : 'e') + '.</p>' +
    '<div class="box box-warn"><b>Achtung</b>Der Import ersetzt alle aktuell in ' +
    'diesem Browser gespeicherten Daten.</div>' +
    '<div class="btn-reihe"><button class="btn btn-pri" id="ibOk">Importieren</button>' +
    '<button class="btn" id="ibAb">Abbrechen</button></div>');
  document.getElementById('ibAb').onclick = dialogZu;
  document.getElementById('ibOk').onclick = function () { dialogZu(); weiter(); };
}

/* Roter Hinweis-Toast für Fehler (ignoriert abgebrochene Dateiauswahl). */
function fehlerToast(e) {
  if (e && e.name === 'AbortError') return;
  var d = document.createElement('div');
  d.textContent = (e && e.message) || String(e || 'Fehler');
  d.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);' +
    'background:#a4262c;color:#fff;padding:10px 18px;border-radius:7px;z-index:99;' +
    'font-size:13px;max-width:80%';
  document.body.appendChild(d);
  setTimeout(function () { d.remove(); }, 4500);
}

/* ---- Los ---------------------------------------------------------------- */
boot();
