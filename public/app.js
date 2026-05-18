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
  ladeRechtlicheLinks();
}

/* Optionale Rechts-Links (Impressum/Datenschutz/Haftungsausschluss) in der
 * Seitenleiste. Nur für ÖFFENTLICH gehostete Instanzen gedacht: Der Betreiber
 * legt eine rechtliche-links.json neben die App. Fehlt die Datei — wie im
 * Repo und in der lokalen Variante — erscheinen keine Links (die lokale
 * Nutzung begründet keine Impressumspflicht). Vorlage: rechtliche-links.beispiel.json */
function ladeRechtlicheLinks() {
  var ziel = document.getElementById('rechtlicheLinks');
  if (!ziel || typeof fetch !== 'function') return;
  fetch('rechtliche-links.json').then(function (r) {
    return r.ok ? r.json() : null;
  }).then(function (cfg) {
    var links = cfg && cfg.links;
    if (!links || !links.length) return;
    ziel.className = 'sidebar-foot-legal';
    ziel.innerHTML = links.map(function (l) {
      /* Nur http(s)-Links zulassen - kein 'javascript:' o. Ä. als Schema. */
      var url = /^https?:\/\//i.test(String(l.url || '')) ? l.url : '#';
      return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' +
        esc(l.text || '') + '</a>';
    }).join('<span aria-hidden="true"> &middot; </span>');
  }).catch(function () {});
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
      if (!istEB) n.push(navUnter('buchhaltung', 'Buchhaltung'));
      if (!istEB) n.push(navUnter('steuer', 'Steuern'));
      if (!istEB) n.push(navUnter('ustva', 'Umsatzsteuer'));
      if (!istEB) n.push(navUnter('bwa', 'BWA'));
      if (!istEB) n.push(navUnter('kapst', 'Kapitalertragsteuer'));
      n.push(navUnter('ebilanz', 'E-Bilanz'));
      if (!istEB) n.push(navUnter('offenlegung', 'Offenlegung'));
      n.push(navUnter('druck', 'Druckansicht'));
    }
  });
  n.push('<div class="nav-item" data-akt="neu"><span class="ic">+</span><span>Neuer Abschluss</span></div>');
  n.push('<div class="nav-grp">Stammdaten</div>');
  n.push(navItem('stammdaten', '⌂', 'Unternehmensdaten'));
  n.push(navItem('anlagen', '▦', 'Anlagenverzeichnis'));
  n.push(navItem('verfahrensdoku', '✎', 'Verfahrensdokumentation'));
  n.push('<div class="nav-grp">Hilfe</div>');
  n.push(navItem('fristen', '⚠', 'Fristen &amp; Pflichten'));
  n.push(navItem('hilfe', '?', 'Buchungshilfe'));
  n.push(navItem('glossar', '≡', 'Glossar'));
  n.push(navItem('beschluesse', '§', 'Gesellschafterbeschlüsse'));
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
  else if (view === 'anlagen')    renderAnlagen(m);
  else if (view === 'verfahrensdoku') renderVerfahrensdoku(m);
  else if (view === 'editor')     renderEditor(m);
  else if (view === 'druck')      renderDruck(m);
  else if (view === 'ebilanz')    renderEbilanz(m);
  else if (view === 'offenlegung')renderOffenlegung(m);
  else if (view === 'steuer')     renderSteuer(m);
  else if (view === 'buchhaltung')renderBuchhaltung(m);
  else if (view === 'ustva')      renderUstva(m);
  else if (view === 'bwa')        renderBwa(m);
  else if (view === 'kapst')      renderKapst(m);
  else if (view === 'fristen')    renderFristen(m);
  else if (view === 'hilfe')      renderHilfe(m);
  else if (view === 'glossar')    renderGlossar(m);
  else if (view === 'beschluesse')renderBeschluesse(m);
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
  if (!S.unternehmen && !S.abschluesse.length) {
    html += '<div class="box box-info"><b>Zum Ausprobieren: Beispieldaten</b>' +
      'Lädt eine vollständige Beispiel-GmbH mit Eröffnungsbilanz und Jahresabschluss ' +
      '2024 &ndash; zum Erkunden des Tools ohne eigene Steuerdaten.' +
      '<div class="btn-reihe" style="margin-top:9px">' +
      '<button class="btn" data-demo="operativ">Beispiel: operative GmbH</button>' +
      '<button class="btn" data-demo="vv">Beispiel: vermögensverwaltende GmbH</button>' +
      '</div></div>';
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
  m.querySelectorAll('[data-demo]').forEach(function (el) {
    el.onclick = function () { demoLaden(el.dataset.demo); };
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
             ['immobilien', 'Immobilien-GmbH (eigener Grundbesitz)'],
             ['trading', 'Trading-/Wertpapier-GmbH'],
             ['hybrid', 'Hybrid (operativ + Kapitalanlage)'],
             ['vermögensverwaltend', 'vermögensverwaltend (Beteiligungen allgemein)']]);
  html += f('versteuerungsart', 'USt-Versteuerungsart',
            'Soll = Regelfall; Ist auf Antrag (§ 20 UStG, Vorjahresumsatz ≤ 800.000 €)', 'select',
            [['soll', 'Soll-Versteuerung (nach vereinbarten Entgelten)'],
             ['ist', 'Ist-Versteuerung (nach vereinnahmten Entgelten)']]);
  html += f('kleinunternehmer', 'Kleinunternehmer § 19 UStG',
            'ohne USt-Ausweis; Umsatzgrenze 25.000 € (Vorjahr) / 100.000 € (laufend)', 'select',
            [['nein', 'nein — Regelbesteuerung'],
             ['ja', 'ja — Kleinunternehmerregelung']]);
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

/* ---- Beispieldaten laden (Demodaten-Modul) ---------------------------- */
/* Baut aus einem Demo-Inhalt einen vollständigen Abschluss: frisches
 * neuerAbschluss()-Gerüst plus die fallspezifischen Felder. */
function demoAbschluss(inhalt) {
  var a = neuerAbschluss(inhalt.art);
  var klon = JSON.parse(JSON.stringify(inhalt));
  for (var k in klon) if (klon.hasOwnProperty(k)) a[k] = klon[k];
  return a;
}
/* Speichert eine Beispiel-GmbH samt Abschlüssen und springt zur Startseite. */
function demoLaden(schluessel) {
  var b = Demodaten.BEISPIELE[schluessel];
  if (!b) return;
  Store.speichereUnternehmen(JSON.parse(JSON.stringify(b.unternehmen)))
    .then(function (u) {
      S.unternehmen = (u && !u.fehler) ? u : b.unternehmen;
      return b.abschluesse.reduce(function (kette, inhalt) {
        return kette.then(function () {
          return Store.speichereAbschluss(demoAbschluss(inhalt));
        });
      }, Promise.resolve());
    })
    .then(function () { return Store.ladeState(); })
    .then(function (st) {
      S.unternehmen = st.unternehmen;
      S.abschluesse = st.abschluesse || [];
      renderNav();
      hinweisToast('Beispieldaten geladen (' + b.titel + ').');
      setView('start');
    });
}

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
  // Vorjahres-Abschluss für die Abweichungsprüfung (§ 265 Abs. 2 HGB) einmalig
  // je Vorjahr-Id nachladen und zwischenspeichern (aktualisiereStatus läuft bei
  // jeder Eingabe - kein Nachladen pro Tastendruck).
  var vj = (S.vorjahr && S.vorjahr.id === a.vorjahrId) ? S.vorjahr : null;
  if (!a.vorjahrId) { S.vorjahr = null; }
  else if (!vj && S.vorjahrLaedt !== a.vorjahrId) {
    S.vorjahrLaedt = a.vorjahrId;
    Store.ladeAbschluss(a.vorjahrId).then(function (v) {
      S.vorjahrLaedt = null;
      if (v && !v.fehler) { S.vorjahr = v; if (S.aktiv === a) aktualisiereStatus(); }
    });
  }
  var pr = Berechnung.pruefe(a, vj);
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
 * OFFENLEGUNG  -  Jahresabschluss beim Unternehmensregister (§ 325 HGB)
 * ========================================================================= */
/* Offenlegungs-Dokument: Umfang nach Größenklasse. Kleinst-/kleine GmbH legen
 * die GuV nicht offen (§ 326 HGB). */
function offenlegungDok(a, u, r) {
  var klasse = a.groessenklasse || 'KLEIN';
  var mitGuv = klasse === 'MITTEL' || klasse === 'GROSS';
  var h = '<h1>' + esc(u.name || 'Unternehmen') + '</h1>';
  h += '<div class="dok-sub">' + esc((u.plz || '') + ' ' + (u.ort || '')) +
    (u.hrNummer ? ' &middot; ' + esc(u.hrNummer) : '') + '</div>';
  h += '<h1 style="margin-top:14px">Jahresabschluss zur Offenlegung</h1>';
  h += '<div class="dok-sub">zum ' + datumDe(a.stichtag) +
    ' &middot; Geschäftsjahr ' + datumDe(a.gjVon) + ' bis ' + datumDe(a.gjBis) +
    '<br>' + klasseName(klasse) + '</div>';
  h += '<h2>Bilanz</h2><div class="dok-bilanz">' +
    '<div class="col">' + dokSeite('aktiva', r, null) + '</div>' +
    '<div class="col">' + dokSeite('passiva', r, null) + '</div></div>';
  if (r.bilanz.kapital.eingefordertOffen > 0) {
    h += '<p class="dok-fussnote">In den Forderungen und sonstigen ' +
      'Vermögensgegenständen sind ' + geld(r.bilanz.kapital.eingefordertOffen) +
      ' EUR eingefordertes, noch nicht eingezahltes Kapital enthalten ' +
      '(§ 272 Abs. 1 Satz 3 HGB).</p>';
  }
  if (mitGuv) h += '<h2>Gewinn- und Verlustrechnung</h2>' + dokGuv(a, r, null);
  h += dokAnhang(a);
  h += '<div class="dok-fuss">Offenlegung nach § 325 HGB. Erstellt mit OpenBilanz.</div>';
  return h;
}
function renderOffenlegung(m) {
  var a = S.aktiv, u = S.unternehmen || {};
  if (!a) { setView('start'); return; }
  if (a.art !== 'JAHRESABSCHLUSS') { setView('editor'); return; }
  var r = Berechnung.berechne(a);
  var klasse = a.groessenklasse || 'KLEIN';
  var frist = '';
  if (a.stichtag) {
    var d = new Date(a.stichtag);
    if (!isNaN(d.getTime())) { d.setFullYear(d.getFullYear() + 1); frist = d.toISOString().slice(0, 10); }
  }
  var umfang = klasse === 'KLEINST'
    ? 'nur die Bilanz (Hinterlegung statt Offenlegung möglich, § 326 Abs. 2 HGB)'
    : klasse === 'KLEIN'
    ? 'Bilanz und Anhang — die Gewinn- und Verlustrechnung ist nicht offenzulegen (§ 326 Abs. 1 HGB)'
    : 'Bilanz, Gewinn- und Verlustrechnung, Anhang und Lagebericht';

  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>';
  html += '<div class="kopf no-print"><h1>Offenlegung</h1>' +
    '<p>Jahresabschluss beim Unternehmensregister einreichen (§ 325 HGB).</p></div>';
  html += '<div class="box box-warn no-print"><b>Offenlegungspflicht</b>Jede GmbH ' +
    'reicht ihren Jahresabschluss binnen zwölf Monaten nach dem Bilanzstichtag beim ' +
    'Unternehmensregister (unternehmensregister.de) ein' +
    (frist ? ' — für diesen Abschluss bis spätestens <b>' + datumDe(frist) + '</b>' : '') +
    '. Bei Versäumnis droht ein Ordnungsgeld ab 2.500 EUR (§ 335 HGB). Einzureichen ' +
    'ist für diese Gesellschaft (' + klasseName(klasse) + '): ' + umfang + '.</div>';
  html += '<div class="box box-info no-print">Die Einreichung erfolgt über das ' +
    'Unternehmensregister als <b>PDF</b> (Dokument unten → „Drucken / als PDF ' +
    'speichern") oder maschinenlesbar als <b>XBRL</b>. Der Offenlegungs-Datensatz ' +
    'kann vom Steuer-E-Bilanz-Format abweichen — das aktuell geforderte Einreichungs' +
    'format vor der Übermittlung prüfen.</div>';
  html += '<div class="btn-reihe no-print">' +
    '<button class="btn btn-pri" id="ofDruck">Drucken / als PDF speichern</button>' +
    '<button class="btn" id="ofXbrl">XBRL herunterladen</button></div>';
  html += '<div class="dok" id="ofDok">' + offenlegungDok(a, u, r) + '</div>';
  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () { setView('editor'); };
  m.querySelector('#ofDruck').onclick = function () { window.print(); };
  m.querySelector('#ofXbrl').onclick = function () {
    Store.erzeugeXBRL(u, a, 'instanz').then(function (res) {
      ladeDatei(res.xml, res.dateiname || ('offenlegung_' + a.id + '.xml'),
        'application/xml; charset=utf-8');
    });
  };
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

  /* Kontennachweis (unverdichtete Kontensalden, § 5b EStG / JStG 2024) */
  var kn = (typeof Xbrl !== 'undefined' && Xbrl.kontennachweis) ? Xbrl.kontennachweis(a) : [];
  html += '<div class="karte"><h2>Kontennachweis</h2>' +
    '<div class="karte-hint">Unverdichtete Kontensalden je HGB-Position aus der ' +
    'Buchhaltung. Für Wirtschaftsjahre ab 2025 sind sie zur E-Bilanz mitzugeben ' +
    '(§ 5b EStG i. d. F. JStG 2024); diese Datei führt sie als Aufstellung mit.</div>';
  if (!kn.length) {
    html += '<div class="karte-hint">Keine Buchungen erfasst — ohne kontengenaue ' +
      'Buchführung liegt kein Kontennachweis vor. In der E-Bilanz wird stattdessen ' +
      'das Härtefall-Feld gesetzt.</div>';
  } else {
    html += '<table class="liste"><thead><tr><th>Position</th><th>Konto</th>' +
      '<th>Bezeichnung</th><th class="rechts">Saldo</th></tr></thead><tbody>';
    kn.forEach(function (g) {
      g.konten.forEach(function (k, i) {
        html += '<tr><td class="mono">' + (i === 0 ? esc(g.position) : '') + '</td>' +
          '<td class="mono">' + esc(k.nr) + '</td><td>' + esc(k.name) + '</td>' +
          '<td class="rechts mono">' + geld(k.saldo) + '</td></tr>';
      });
    });
    html += '</tbody></table>';
  }
  html += '</div>';

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
  html += sf('auslQuellensteuer', 'Anrechenbare ausländische Quellensteuer (EUR)',
    'auf ausländische Dividenden, § 26 KStG');
  html += sf('immobilienertrag', 'Begünstigter Grundstücksertrag (EUR)',
    'bei erweiterter Kürzung');
  html += sf('gezahlteGrundsteuer', 'Im Geschäftsjahr gezahlte Grundsteuer (EUR)',
    'einfache Kürzung § 9 Nr. 1 Satz 1 GewStG');
  html += '</div><div class="gitter" style="margin-top:12px">';
  html += sf('beteiligungUnter10', 'Streubesitz: Beteiligung unter 10 %',
    'Dividende voll körperschaftsteuerpflichtig (§ 8b Abs. 4 KStG)', 'check');
  html += sf('beteiligungUnter15', 'Beteiligung unter 15 %',
    'Dividende gewerbesteuerpflichtig (§ 8 Nr. 5 GewStG)', 'check');
  html += sf('erweiterteKuerzung', 'Erweiterte Grundstücks-Kürzung beantragt',
    'nur eigener Grundbesitz (§ 9 Nr. 1 Satz 2 GewStG)', 'check');
  html += sf('finanzunternehmen', 'Anteile im Handelsbestand (§ 8b Abs. 7 KStG)',
    'Trading-GmbH / Finanzunternehmen — keine 95-%-Freistellung', 'check');
  html += '</div></div>';
  html += '<div class="karte"><h2>Weitere Sonderfälle</h2>' +
    '<div class="karte-hint">Verlustvortrag, verdeckte Gewinnausschüttung und ' +
    'gewerbesteuerliche Hinzurechnungen. Leer lassen, wenn nicht zutreffend.</div>' +
    '<div class="gitter g2">';
  html += sf('verlustvortrag', 'Verlustvortrag aus Vorjahren (EUR)',
    '§ 10d EStG / § 10a GewStG, mit Mindestbesteuerung');
  html += sf('vga', 'Verdeckte Gewinnausschüttung (EUR)', '§ 8 Abs. 3 KStG');
  html += sf('zinsaufwand', 'Entgelte für Schulden / Zinsaufwand (EUR)',
    '§ 8 Nr. 1a GewStG — zu 100 %');
  html += sf('mietenBeweglich', 'Mieten/Pachten bewegliche WG (EUR)',
    '§ 8 Nr. 1d GewStG — zu 20 %');
  html += sf('mietenUnbeweglich', 'Mieten/Pachten unbewegliche WG (EUR)',
    '§ 8 Nr. 1e GewStG — zu 50 %');
  html += sf('lizenzen', 'Lizenz-/Konzessionsentgelte (EUR)',
    '§ 8 Nr. 1f GewStG — zu 25 %');
  html += '</div><div class="gitter" style="margin-top:12px">';
  html += sf('anteilseignerwechsel', 'Anteilseignerwechsel über 50 % im Zeitraum',
    'nicht genutzter Verlustvortrag kann untergehen (§ 8c KStG)', 'check');
  html += '</div></div>';
  html += '<div id="steuerErgebnis"></div>';

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
  var h = gmbhTypHinweis(a);
  h += tab('Körperschaftsteuer', s.kst.schritte);
  h += tab('Gewerbesteuer', s.gewst.schritte);
  h += '<div class="karte"><h2>Gesamtbelastung</h2><table class="pos-tab">' +
    steuerZeile({ text: 'Körperschaftsteuer + Solidaritätszuschlag',
      betrag: Berechnung.cent(s.kst.betrag + s.kst.soli) }) +
    steuerZeile({ text: 'Gewerbesteuer', betrag: s.gewst.betrag }) +
    (s.kst.auslQuellensteuer > 0 ? steuerZeile({ text: '- anrechenbare ausländische ' +
      'Quellensteuer (§ 26 KStG)', betrag: -s.kst.auslQuellensteuer }) : '') +
    steuerZeile({ text: 'Steuerbelastung gesamt', betrag: s.gesamtsteuer, summe: true }) +
    steuerZeile({ text: 'Ergebnis nach Steuern', betrag: s.ergebnisNachSteuern, summe: true }) +
    '</table><div class="karte-hint" style="margin-top:8px">Durchschnittliche ' +
    'Steuerbelastung: ' + geld(s.durchschnittsbelastung) + ' % des Ergebnisses vor ' +
    'Steuern.</div></div>';
  (s.hinweise || []).forEach(function (hw) {
    h += '<div class="box box-warn">' + esc(hw) + '</div>';
  });
  document.getElementById('steuerErgebnis').innerHTML = h;
}
/* Typ-spezifische steuerliche Hinweise je GmbH-Untertyp (Immobilien / Trading
 * / Hybrid). Erscheint oben in der Steuer-Auswertung und reagiert live auf die
 * Eingaben (insb. die erweiterte Grundstückskürzung). */
function gmbhTypHinweis(a) {
  var typ = (S.unternehmen && S.unternehmen.gmbhTyp) || '';
  var st = a.steuer || {};
  var info = {
    immobilien: '<b>Immobilien-GmbH</b>Verwaltet die GmbH ausschließlich eigenen ' +
      'Grundbesitz, stellt die erweiterte Grundstückskürzung (§ 9 Nr. 1 Satz 2 ' +
      'GewStG) den Grundstücksertrag praktisch vollständig von der Gewerbesteuer frei.',
    operativ: '<b>Operative GmbH</b>Normaler Gewerbebetrieb: Körperschaft- und ' +
      'Gewerbesteuer auf den Gewinn. Die § 8b-KStG- und § 9-GewStG-Angaben unten ' +
      'sind nur relevant, wenn die GmbH auch Beteiligungen oder eigenen Grundbesitz hält.',
    trading: '<b>Trading-/Wertpapier-GmbH</b>Die 95-%-Freistellung von Dividenden ' +
      'und Veräußerungsgewinnen aus Anteilen (§ 8b KStG) ist nicht an ' +
      'Ausschließlichkeit gebunden. <b>Achtung § 8b Abs. 7 KStG:</b> Werden die ' +
      'Anteile im Handelsbestand gehalten (typische Trading-/Daytrading-GmbH), ' +
      'entfällt die Freistellung — die Gewinne sind dann voll steuerpflichtig.',
    hybrid: '<b>Hybride GmbH</b>§ 8b KStG wirkt auf den Kapitalanlageteil unabhängig ' +
      'von der operativen Tätigkeit. Die erweiterte Grundstückskürzung dagegen ' +
      'entfällt, sobald eine operative Tätigkeit hinzukommt.',
    'vermögensverwaltend': '<b>Vermögensverwaltende GmbH</b>Beteiligungserträge und ' +
      'Veräußerungsgewinne sind nach § 8b KStG zu 95 % steuerfrei — die Streubesitz' +
      'grenzen (< 10 % / < 15 %) beachten.'
  };
  var h = '';
  if (info[typ]) h += '<div class="box box-info">' + info[typ] + '</div>';
  if (st.erweiterteKuerzung && typ && typ !== 'immobilien') {
    h += '<div class="box box-warn"><b>Erweiterte Kürzung gefährdet</b>Die erweiterte ' +
      'Grundstückskürzung setzt <b>ausschließlich</b> die Verwaltung eigenen ' +
      'Grundbesitzes voraus. Bei einer GmbH mit operativer oder sonstiger Tätigkeit ' +
      'entfällt sie <b>vollständig</b> (§ 9 Nr. 1 Satz 2 GewStG) — die Berechnung ' +
      'unten wäre dann zu niedrig angesetzt. Erweiterte Kürzung nur für die reine ' +
      'Immobilien-GmbH ansetzen.</div>';
  } else if (st.erweiterteKuerzung && !typ) {
    h += '<div class="box box-info">Die erweiterte Grundstückskürzung setzt ' +
      'ausschließlich eigenen Grundbesitz voraus. Art der Tätigkeit in den ' +
      'Unternehmensdaten setzen, damit dieser Punkt geprüft werden kann.</div>';
  }
  var anteile = Berechnung.num(st.beteiligungsertraege) > 0 ||
                Berechnung.num(st.veraeusserungsgewinne) > 0;
  if ((typ === 'trading' || typ === 'hybrid') && anteile && !st.finanzunternehmen) {
    h += '<div class="box box-warn"><b>§ 8b Abs. 7 KStG prüfen</b>Bei einer ' +
      'Trading-GmbH mit Anteilen im <b>Handelsbestand</b> sind Dividenden und ' +
      'Veräußerungsgewinne voll steuerpflichtig — die 95-%-Freistellung entfällt. ' +
      'Trifft das zu, unten „Anteile im Handelsbestand" ankreuzen.</div>';
  }
  if (st.finanzunternehmen) {
    h += '<div class="box box-info">§ 8b Abs. 7 KStG aktiv: Dividenden und ' +
      'Veräußerungsgewinne werden voll steuerpflichtig gerechnet — ohne die ' +
      '95-%-Freistellung.</div>';
  }
  return h;
}
function steuerZeile(z) {
  return '<tr class="' + (z.summe ? 'zeile-summe' : 'zeile-R') + '">' +
    '<td class="p-lbl">' + esc(z.text) + '</td>' +
    '<td class="p-wert"><span class="wert-ro">' + geld(z.betrag) + '</span></td></tr>';
}

/* ===========================================================================
 * BUCHHALTUNG (Modus 2) - Buchungsjournal nach SKR04
 * ========================================================================= */
/* DATEV-Buchungsstapel-Export (EXTF): siehe Datev.erzeuge in shared/datev.js. */
/* ===========================================================================
 * UMSATZSTEUER-VORANMELDUNG (UStVA)
 * ---------------------------------------------------------------------------
 * Bereitet die UStVA-Kennzahlen aus den SKR04-USt-Konten eines Zeitraums auf.
 * Eine Aufbereitung, kein ELSTER-Versand.
 * ========================================================================= */
/* Die UStVA-Kennzahlen-Berechnung liegt in public/shared/ustva.js (testbar). */
function renderUstva(m) {
  var a = S.aktiv;
  if (!a) { setView('start'); return; }
  if (a.art !== 'JAHRESABSCHLUSS') { setView('editor'); return; }
  a.buchungen = a.buchungen || [];
  var jahr = String(a.gjBis || a.stichtag || '').slice(0, 4) ||
             String(new Date().getFullYear());
  var von0 = a.gjVon || (jahr + '-01-01');
  var bis0 = a.gjBis || a.stichtag || (jahr + '-12-31');
  var vart = (S.unternehmen && S.unternehmen.versteuerungsart) === 'ist' ? 'ist' : 'soll';
  var klein = (S.unternehmen && S.unternehmen.kleinunternehmer) === 'ja';
  var vartText = vart === 'ist'
    ? 'Ist-Versteuerung (§ 20 UStG) — die Umsatzsteuer entsteht mit dem ' +
      'Zahlungseingang; Erlöse zum Zahlungsdatum buchen.'
    : 'Soll-Versteuerung (§ 13 UStG, Regelfall) — die Umsatzsteuer entsteht mit ' +
      'der Rechnungsstellung; Erlöse zum Rechnungsdatum buchen.';

  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>' +
    '<div class="kopf"><h1>Umsatzsteuer-Voranmeldung &ndash; ' + esc(a.bezeichnung) +
    '</h1><p>Bereitet die UStVA-Kennzahlen aus den Buchungen auf. Für eine ' +
    'monatliche Voranmeldung den Zeitraum auf den Monat einstellen.</p></div>';
  html += '<div class="box box-info"><b>Aufbereitung, kein Versand</b>Die ' +
    'Voranmeldung wird über ELSTER übermittelt. Hier werden die Kennzahlen aus den ' +
    'SKR04-Konten ermittelt: Erlöse 4400/4000 (19 %), 4300 (7 %), Vorsteuer ' +
    '1406/1401.<br><b>Versteuerungsart:</b> ' + vartText +
    ' (Einstellung in den Unternehmensdaten.)</div>';
  if (klein) {
    html += '<div class="box box-warn"><b>Kleinunternehmer (§ 19 UStG)</b>Laut ' +
      'Unternehmensdaten wird die Kleinunternehmerregelung angewendet: kein ' +
      'USt-Ausweis, kein Vorsteuerabzug. Eine Voranmeldung ist dann regelmäßig ' +
      'nicht abzugeben. Die Kennzahlen unten dienen nur der Übersicht.</div>';
  }
  html += '<div class="karte"><h2>Zeitraum</h2><div class="gitter g3">' +
    feldWrap('von', '', '<input type="date" id="ustVon" value="' + esc(von0) + '">') +
    feldWrap('bis', '', '<input type="date" id="ustBis" value="' + esc(bis0) + '">') +
    '</div></div>';
  html += '<div class="karte"><h2>Sonderfälle</h2><div class="karte-hint">' +
    'Beträge, die sich nicht aus den Buchungen ergeben — jeweils netto eintragen, ' +
    'sonst leer lassen.</div><div class="gitter g2">' +
    feldWrap('§ 13b: bezogene Leistungen 19 % (netto)', '',
      '<input type="number" step="0.01" id="ust13b19">') +
    feldWrap('§ 13b: bezogene Leistungen 7 % (netto)', '',
      '<input type="number" step="0.01" id="ust13b7">') +
    feldWrap('Steuerfreie Umsätze MIT Vorsteuerabzug', '',
      '<input type="number" step="0.01" id="ustSfMit">') +
    feldWrap('Steuerfreie Umsätze OHNE Vorsteuerabzug (§ 4 Nr. 12 u. a.)', '',
      '<input type="number" step="0.01" id="ustSfOhne">') +
    '</div></div><div id="ustvaErgebnis"></div>';
  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () { setView('editor'); };

  function zeile(kz, txt, betrag, opt) {
    opt = opt || {};
    return '<tr class="' + (opt.summe ? 'zeile-summe' : 'zeile-R') + '">' +
      '<td class="mono">' + (kz || '') + '</td><td class="p-lbl">' + txt + '</td>' +
      '<td class="p-wert"><span class="wert-ro">' + geld(betrag) + '</span></td></tr>';
  }
  function zahl(id) { var el = m.querySelector('#' + id); return el ? Berechnung.num(el.value) : 0; }
  function zeigen() {
    var von = m.querySelector('#ustVon').value, bis = m.querySelector('#ustBis').value;
    var u = Ustva.berechne(a.buchungen, von, bis, {
      versteuerungsart: vart, kleinunternehmer: klein,
      rc13b: { netto19: zahl('ust13b19'), netto7: zahl('ust13b7') },
      steuerfrei: { mitVorsteuer: zahl('ustSfMit'), ohneVorsteuer: zahl('ustSfOhne') }
    });
    var h = '<div class="karte"><h2>Kennzahlen</h2><table class="pos-tab">' +
      zeile('81', 'Steuerpflichtige Umsätze zum Steuersatz 19 % (netto)', u.kz81) +
      zeile('86', 'Steuerpflichtige Umsätze zum Steuersatz 7 % (netto)', u.kz86) +
      zeile('', 'Umsatzsteuer 19 %', u.ust19) +
      zeile('', 'Umsatzsteuer 7 %', u.ust7) +
      (u.kz84 ? zeile('84', 'Steuer auf bezogene Leistungen (§ 13b UStG)', u.kz84) : '') +
      (u.kz44 ? zeile('44', 'Steuerfreie Umsätze mit Vorsteuerabzug', u.kz44) : '') +
      (u.kz48 ? zeile('48', 'Steuerfreie Umsätze ohne Vorsteuerabzug', u.kz48) : '') +
      zeile('', '= Umsatzsteuer', Berechnung.cent(u.ustBerechnet + u.kz84), { summe: true }) +
      zeile('66', 'Abziehbare Vorsteuerbeträge', u.kz66) +
      zeile('83', 'Verbleibende Umsatzsteuer-Vorauszahlung', u.kz83, { summe: true }) +
      '</table>';
    h += '<div class="karte-hint" style="margin-top:8px">' +
      (u.kz83 < 0 ? 'Negativer Wert = Vorsteuerüberschuss (Erstattung). ' : '') +
      'In der Buchhaltung erfasste Umsatzsteuer (Konten 3806/3801): ' +
      geld(u.ustGebucht) + ' EUR' +
      (Math.abs(u.ustGebucht - u.ustBerechnet) > 0.5
        ? ' — weicht von der aus den Netto-Erlösen berechneten USt ab; bitte die ' +
          'USt-Buchungen prüfen.'
        : '.') + '</div></div>';
    (u.hinweise || []).forEach(function (hw) {
      h += '<div class="box box-warn">' + esc(hw) + '</div>';
    });
    document.getElementById('ustvaErgebnis').innerHTML = h;
  }
  ['ustVon', 'ustBis', 'ust13b19', 'ust13b7', 'ustSfMit', 'ustSfOhne'].forEach(function (id) {
    var el = m.querySelector('#' + id);
    if (el) el.addEventListener('input', zeigen);
  });
  zeigen();
}

/* ===========================================================================
 * KAPITALERTRAGSTEUER  -  Assistent zur Gewinnausschüttung
 * ========================================================================= */
function renderKapst(m) {
  var a = S.aktiv;
  if (!a) { setView('start'); return; }
  if (a.art !== 'JAHRESABSCHLUSS') { setView('editor'); return; }
  a.kapst = a.kapst || {};
  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>';
  html += '<div class="kopf"><h1>Kapitalertragsteuer &ndash; ' + esc(a.bezeichnung) +
    '</h1><p>Bei einer Gewinnausschüttung behält die GmbH Kapitalertragsteuer ein ' +
    'und meldet sie an. Dieser Assistent berechnet die Beträge.</p></div>';
  html += '<div class="box box-info"><b>Kapitalertragsteuer</b>Auf eine offene ' +
    'Gewinnausschüttung fallen 25 % Kapitalertragsteuer zzgl. 5,5 % Solidaritäts' +
    'zuschlag auf die Kapitalertragsteuer an (§§ 43, 43a EStG). Die GmbH behält ' +
    'den Betrag ein, zahlt nur den Nettobetrag aus und meldet die Steuer ' +
    'elektronisch über ELSTER an — bis zum 10. des auf den Zufluss folgenden ' +
    'Monats. Eine etwaige Kirchensteuer der Gesellschafter ist hier nicht ' +
    'abgebildet.</div>';
  html += '<div class="karte"><h2>Angaben</h2><div class="gitter g2">' +
    feldWrap('Ausschüttungsbetrag brutto (EUR)', 'beschlossene Ausschüttung',
      '<input class="zahl" type="text" inputmode="decimal" id="ksBrutto" value="' +
      eingabeWert(a.kapst.brutto) + '">') +
    feldWrap('Tag des Zuflusses / der Auszahlung', '',
      '<input type="date" id="ksDatum" value="' + esc(a.kapst.datum || '') + '">') +
    '</div></div><div id="ksErgebnis"></div>';
  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () {
    speichereStill().then(function () { setView('editor'); });
  };
  function zeile(lbl, betrag, summe) {
    return '<tr class="' + (summe ? 'zeile-summe' : 'zeile-R') + '"><td class="p-lbl">' +
      lbl + '</td><td class="p-wert"><span class="wert-ro">' + geld(betrag) +
      '</span></td></tr>';
  }
  function zeigen() {
    var brutto = Berechnung.num(m.querySelector('#ksBrutto').value);
    var datum = m.querySelector('#ksDatum').value;
    a.kapst.brutto = brutto; a.kapst.datum = datum;
    var kapst = Berechnung.cent(brutto * 0.25);
    var soli = Berechnung.cent(kapst * 0.055);
    var abzug = Berechnung.cent(kapst + soli);
    var frist = '';
    if (datum) {
      var d = new Date(datum);
      if (!isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + 1); d.setDate(10);
        frist = d.toISOString().slice(0, 10);
      }
    }
    var h = '<div class="karte"><h2>Berechnung</h2><table class="pos-tab">' +
      zeile('Ausschüttung brutto', brutto) +
      zeile('Kapitalertragsteuer 25 %', kapst) +
      zeile('Solidaritätszuschlag 5,5 % der Kapitalertragsteuer', soli) +
      zeile('= einzubehaltender Steuerabzug', abzug, true) +
      zeile('= Nettoauszahlung an die Gesellschafter', Berechnung.cent(brutto - abzug), true) +
      '</table><div class="karte-hint" style="margin-top:8px">' +
      (frist ? 'Anmeldung und Abführung bis spätestens <b>' + datumDe(frist) +
        '</b> (10. des Folgemonats) elektronisch über ELSTER. ' : '') +
      'Buchung: der einbehaltene Steuerabzug auf Konto 3700 (Verbindlichkeiten aus ' +
      'Steuern), die Nettoauszahlung über das Bankkonto. Den ' +
      'Ergebnisverwendungsbeschluss erzeugt der Reiter „Gesellschafterbeschlüsse".' +
      '</div></div>';
    document.getElementById('ksErgebnis').innerHTML = h;
  }
  m.querySelector('#ksBrutto').addEventListener('input', zeigen);
  m.querySelector('#ksDatum').addEventListener('input', zeigen);
  zeigen();
}

/* ===========================================================================
 * BWA  -  Betriebswirtschaftliche Auswertung
 * ========================================================================= */
/* Leitet aus der GuV eines Abschlusses die BWA-Kennzahlen ab. */
function bwaDaten(a, r) {
  var w = r.guv.werte || {};
  var v = a.guvVerfahren || 'GKV';
  function g(id) { return Berechnung.num(w[id]); }
  if (v === 'GKV') {
    var umsatz = g('gkv.1');
    var gesamt = Berechnung.cent(umsatz + g('gkv.2') + g('gkv.3'));
    var material = g('gkv.5');
    var rohertrag = Berechnung.cent(gesamt - material);
    var personal = g('gkv.6'), abschr = g('gkv.7'), sonstA = g('gkv.8'), sonstE = g('gkv.4');
    var betrErg = Berechnung.cent(rohertrag - personal - abschr - sonstA + sonstE);
    var finErg = Berechnung.cent(g('gkv.9') + g('gkv.10') + g('gkv.11') -
                                 g('gkv.12') - g('gkv.13'));
    var vorSt = Berechnung.cent(betrErg + finErg);
    var steuern = Berechnung.cent(g('gkv.14') + g('gkv.16'));
    return { verfahren: v, voll: true,
      zeilen: [
        ['Umsatzerlöse', umsatz],
        ['Bestandsveränderung / aktivierte Eigenleistung', Berechnung.cent(g('gkv.2') + g('gkv.3'))],
        ['= Gesamtleistung', gesamt, 'Z'],
        ['− Materialaufwand', -material],
        ['= Rohertrag', rohertrag, 'Z'],
        ['− Personalaufwand', -personal],
        ['− Abschreibungen', -abschr],
        ['− sonstige betriebliche Aufwendungen', -sonstA],
        ['+ sonstige betriebliche Erträge', sonstE],
        ['= Betriebsergebnis', betrErg, 'Z'],
        ['+ Finanzergebnis', finErg],
        ['= Ergebnis vor Steuern', vorSt, 'Z'],
        ['− Steuern', -steuern],
        ['= Jahresergebnis', Berechnung.cent(vorSt - steuern), 'S']
      ],
      umsatz: umsatz, gesamtleistung: gesamt, rohertrag: rohertrag,
      personal: personal, ergebnis: Berechnung.cent(vorSt - steuern) };
  }
  var umsatzX = v === 'UKV' ? g('ukv.1') : g('kst.1');
  return { verfahren: v, voll: false,
    zeilen: [['Umsatzerlöse', umsatzX],
             ['= Jahresergebnis', r.guv.jahresergebnis, 'S']],
    umsatz: umsatzX, ergebnis: r.guv.jahresergebnis };
}
function renderBwa(m) {
  var a = S.aktiv;
  if (!a) { setView('start'); return; }
  if (a.art !== 'JAHRESABSCHLUSS') { setView('editor'); return; }
  var r = Berechnung.berechne(a);
  var d = bwaDaten(a, r);
  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>';
  html += '<div class="kopf"><h1>BWA &ndash; ' + esc(a.bezeichnung) + '</h1>' +
    '<p>Betriebswirtschaftliche Auswertung aus der Gewinn- und Verlustrechnung — ' +
    'eine interne Auswertung, keine amtliche Rechnung.</p></div>';
  if (!d.voll) {
    html += '<div class="box box-info">Die strukturierte BWA leitet sich aus der ' +
      'Gesamtkosten-Gliederung ab. Dieser Abschluss nutzt das ' +
      (d.verfahren === 'UKV' ? 'Umsatzkostenverfahren' : 'verkürzte Kleinst-Verfahren') +
      ' — ausgewiesen werden Umsatz, Jahresergebnis und die Bilanzkennzahlen.</div>';
  }
  html += '<div class="karte"><h2>Kurzfristige Erfolgsrechnung</h2><table class="pos-tab">';
  d.zeilen.forEach(function (z) {
    var cls = z[2] === 'S' ? 'zeile-summe' : (z[2] === 'Z' ? 'zeile-Z' : 'zeile-R');
    html += '<tr class="' + cls + '"><td class="p-lbl">' + esc(z[0]) + '</td>' +
      '<td class="p-wert"><span class="wert-ro">' + geld(z[1]) + '</span></td></tr>';
  });
  html += '</table></div>';
  function proz(zaehler, nenner) {
    return nenner ? (Math.round(zaehler / nenner * 1000) / 10).toLocaleString('de-DE') + ' %'
                  : '–';
  }
  function kz(lbl, wert) {
    return '<tr class="zeile-R"><td class="p-lbl">' + lbl + '</td>' +
      '<td class="p-wert"><span class="wert-ro">' + wert + '</span></td></tr>';
  }
  html += '<div class="karte"><h2>Kennzahlen</h2><table class="pos-tab">' +
    kz('Umsatzrentabilität (Jahresergebnis / Umsatz)', proz(d.ergebnis, d.umsatz));
  if (d.voll) {
    html += kz('Rohertragsquote (Rohertrag / Gesamtleistung)',
      proz(d.rohertrag, d.gesamtleistung)) +
      kz('Personalkostenquote (Personal / Gesamtleistung)',
      proz(d.personal, d.gesamtleistung));
  }
  html += kz('Eigenkapitalquote (Eigenkapital / Bilanzsumme)',
    proz(r.bilanz.eigenkapital, r.bilanz.summeAktiva)) + '</table></div>';
  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () { setView('editor'); };
}

/* parseERechnung (XRechnung / ZUGFeRD): siehe Importe.parseERechnung in
 * shared/importe.js. */
/* Zeigt die geparste E-Rechnung und bietet die Übernahme als Buchung an. */
function eRechnungVorschau(m, a, kontoOpt, parsed) {
  var box = m.querySelector('#erVorschau');
  if (!box) return;
  if (parsed.fehler) {
    box.innerHTML = '<div class="box box-warn" style="margin-top:10px">' +
      esc(parsed.fehler) + '</div>';
    return;
  }
  var r = parsed.rechnung;
  var aufwOpt = kontoOpt.replace('value="6300"', 'value="6300" selected');
  box.innerHTML = '<table class="liste" style="margin-top:10px"><tbody>' +
    '<tr><td>Rechnungsnummer</td><td class="mono">' + esc(r.nummer || '—') + '</td></tr>' +
    '<tr><td>Rechnungsdatum</td><td class="mono">' + datumDe(r.datum) + '</td></tr>' +
    '<tr><td>Rechnungssteller</td><td>' + esc(r.verkaeufer || '—') + '</td></tr>' +
    '<tr><td>Nettobetrag</td><td class="rechts mono">' + geld(r.netto) + '</td></tr>' +
    '<tr><td>Umsatzsteuer</td><td class="rechts mono">' + geld(r.ust) + '</td></tr>' +
    '<tr><td>Bruttobetrag</td><td class="rechts mono">' + geld(r.brutto) + '</td></tr>' +
    '</tbody></table>' +
    '<div class="gitter g2" style="margin-top:10px">' +
    feldWrap('Aufwandskonto', 'Soll-Konto für den Nettobetrag',
      '<select id="erKonto">' + aufwOpt + '</select>') +
    '<div style="display:flex;align-items:flex-end"><button class="btn btn-pri" ' +
    'id="erUebernehmen">Als Eingangsrechnung buchen</button></div></div>';
  box.querySelector('#erUebernehmen').onclick = function () {
    var konto = box.querySelector('#erKonto').value, stamp = Date.now();
    var basis = 'Eingangsrechnung ' + (r.verkaeufer ? r.verkaeufer + ' ' : '') + (r.nummer || '');
    a.buchungen.push({ id: 'B-ER-' + stamp + '-0', datum: r.datum,
      betrag: Berechnung.cent(r.netto), text: basis.slice(0, 90),
      soll: konto, haben: '3300' });
    var n = 1;
    if (r.ust > 0.005) {
      a.buchungen.push({ id: 'B-ER-' + stamp + '-1', datum: r.datum,
        betrag: Berechnung.cent(r.ust), text: ('Vorsteuer ' + (r.nummer || '')).slice(0, 90),
        soll: '1406', haben: '3300' });
      n = 2;
    }
    speichereStill().then(function () {
      hinweisToast(n + ' Buchung(en) aus der E-Rechnung übernommen.');
      renderBuchhaltung(m);
    });
  };
}

/* parseCamt (CAMT.053), parseIbkrFlex (Interactive Brokers), bankKontoVorschlag
 * und isoDat: siehe shared/importe.js (Modul Importe). */
/* Rendert die Vorschau-Tabelle des Bankimports und bindet die Übernahme. */
function camtVorschau(m, a, kontoOpt, parsed, quelle, boxId) {
  quelle = quelle || 'IMP';
  var box = m.querySelector(boxId || '#camtVorschau');
  if (!box) return;
  if (parsed.fehler) {
    box.innerHTML = '<div class="box box-warn" style="margin-top:10px">' +
      esc(parsed.fehler) + '</div>';
    return;
  }
  var tx = parsed.tx;
  var bankOpt = SKR04.KONTEN.filter(function (k) { return /^18/.test(k.nr); })
    .map(function (k) {
      return '<option value="' + k.nr + '">' + k.nr + ' &ndash; ' + esc(k.name) + '</option>';
    }).join('');
  var h = '<div class="karte-hint" style="margin-top:10px">' + tx.length +
    ' Umsatz/-sätze gelesen. Ziel-Bankkonto wählen, Gegenkonto je Zeile prüfen, ' +
    'dann übernehmen.</div>' +
    feldWrap('Ziel-Bankkonto', 'der Auszug wird auf dieses Konto gebucht',
      '<select id="impBankkonto">' + bankOpt + '</select>') +
    '<table class="liste"><thead><tr><th></th><th>Datum</th><th>Partner</th>' +
    '<th>Verwendungszweck</th><th class="rechts">Betrag</th><th>Gegenkonto</th>' +
    '</tr></thead><tbody>';
  tx.forEach(function (t, i) {
    var vor = t.kontoHint || Importe.bankKontoVorschlag(t.zweck + ' ' + t.partner, t.eingang);
    var sel = kontoOpt.replace('value="' + vor + '"', 'value="' + vor + '" selected');
    h += '<tr><td><input type="checkbox" class="camtChk" data-i="' + i + '" checked></td>' +
      '<td class="mono">' + datumDe(t.datum) + '</td>' +
      '<td>' + esc(t.partner || '') + '</td>' +
      '<td>' + esc(String(t.zweck || '').slice(0, 70)) + '</td>' +
      '<td class="rechts mono">' + (t.eingang ? '+' : '−') + geld(t.betrag) + '</td>' +
      '<td><select class="camtKonto" data-i="' + i + '">' + sel + '</select></td></tr>';
  });
  h += '</tbody></table><div class="btn-reihe"><button class="btn btn-pri" ' +
    'id="camtUebernehmen">Ausgewählte Buchungen übernehmen</button></div>';
  box.innerHTML = h;
  box.querySelector('#camtUebernehmen').onclick = function () {
    var n = 0, stamp = Date.now();
    var bankKonto = (box.querySelector('#impBankkonto') || {}).value || '1800';
    box.querySelectorAll('.camtChk').forEach(function (chk) {
      if (!chk.checked) return;
      var i = parseInt(chk.dataset.i, 10), t = tx[i];
      var konto = box.querySelector('.camtKonto[data-i="' + i + '"]').value;
      a.buchungen.push({
        id: 'B-' + quelle + '-' + stamp + '-' + i, datum: t.datum,
        betrag: Berechnung.cent(t.betrag),
        text: ((t.partner ? t.partner + ' — ' : '') + (t.zweck || 'Umsatz')).slice(0, 90),
        soll: t.eingang ? bankKonto : konto, haben: t.eingang ? konto : bankKonto
      });
      n++;
    });
    if (!n) { alert('Keine Zeile ausgewählt.'); return; }
    speichereStill().then(function () {
      hinweisToast(n + ' Buchung(en) aus dem Import übernommen.');
      renderBuchhaltung(m);
    });
  };
}
/* Vorschau-Tabelle für den DATEV-Import (vollständige Soll/Haben-Buchungen). */
function datevVorschau(m, a, parsed, boxId) {
  var box = m.querySelector(boxId);
  if (!box) return;
  if (parsed.fehler) {
    box.innerHTML = '<div class="box box-warn" style="margin-top:10px">' +
      esc(parsed.fehler) + '</div>';
    return;
  }
  var bu = parsed.buchungen;
  var h = '<div class="karte-hint" style="margin-top:10px">' + bu.length +
    ' Buchung(en) gelesen' + (parsed.jahr ? ' (Wirtschaftsjahr ' + esc(parsed.jahr) + ')' : '') +
    '. Vor der Übernahme prüfen.</div>' +
    '<table class="liste"><thead><tr><th></th><th>Datum</th><th>Soll</th>' +
    '<th>Haben</th><th class="rechts">Betrag</th><th>Text</th></tr></thead><tbody>';
  bu.forEach(function (b, i) {
    h += '<tr><td><input type="checkbox" class="dtvImpChk" data-i="' + i + '" checked></td>' +
      '<td class="mono">' + datumDe(b.datum) + '</td>' +
      '<td class="mono">' + esc(b.soll) + '</td>' +
      '<td class="mono">' + esc(b.haben) + '</td>' +
      '<td class="rechts mono">' + geld(b.betrag) + '</td>' +
      '<td>' + esc(String(b.text || '').slice(0, 60)) + '</td></tr>';
  });
  h += '</tbody></table><div class="btn-reihe"><button class="btn btn-pri" ' +
    'id="dtvImpUebernehmen">Ausgewählte Buchungen übernehmen</button></div>';
  box.innerHTML = h;
  box.querySelector('#dtvImpUebernehmen').onclick = function () {
    var n = 0, stamp = Date.now();
    box.querySelectorAll('.dtvImpChk').forEach(function (chk) {
      if (!chk.checked) return;
      var b = bu[parseInt(chk.dataset.i, 10)];
      a.buchungen.push({
        id: 'B-DATEV-' + stamp + '-' + n, datum: b.datum,
        betrag: Berechnung.cent(b.betrag), text: String(b.text || '').slice(0, 90),
        soll: b.soll, haben: b.haben
      });
      n++;
    });
    if (!n) { alert('Keine Zeile ausgewählt.'); return; }
    speichereStill().then(function () {
      hinweisToast(n + ' Buchung(en) aus dem DATEV-Import übernommen.');
      renderBuchhaltung(m);
    });
  };
}
function renderBuchhaltung(m) {
  var a = S.aktiv;
  if (!a) { setView('start'); return; }
  if (a.art === 'EROEFFNUNGSBILANZ') { setView('editor'); return; }  // EB wird direkt erfasst
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

  /* Anfangsbestände / Eröffnungsbuchungen */
  html += eroeffnungsBox(a);

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

  /* Prüfkette / Integrität */
  if (a.buchungen.some(function (b) { return b.fest; })) {
    html += '<div class="karte"><h2>Prüfkette (Integrität)</h2>' +
      '<div class="karte-hint">Festgeschriebene Buchungen werden per SHA-256 ' +
      'lückenlos verkettet — jede Buchung sichert den Hash ihrer Vorgängerin. ' +
      'Eine nachträgliche Änderung bricht die Kette und wird hier erkennbar ' +
      '(§ 146 Abs. 4 AO). Für echte Beweiskraft den Ketten-Hash extern sichern ' +
      '(z. B. Git-Push, Ausdruck).</div>' +
      '<div class="btn-reihe"><button class="btn" id="buPruef">Integrität prüfen' +
      '</button></div><div id="pruefErgebnis"></div></div>';
  }

  /* DATEV-Export */
  if (a.buchungen.length) {
    html += '<div class="karte"><h2>DATEV-Export</h2>' +
      '<div class="karte-hint">Exportiert das Buchungsjournal als DATEV-Buchungs' +
      'stapel (Format EXTF) — für die Übergabe an den Steuerberater.</div>' +
      '<div class="gitter g3">' +
      feldWrap('Beraternummer', 'optional', '<input id="dtvBerater" inputmode="numeric">') +
      feldWrap('Mandantennummer', 'optional', '<input id="dtvMandant" inputmode="numeric">') +
      '<div style="display:flex;align-items:flex-end"><button class="btn btn-pri" ' +
      'id="dtvExport">DATEV-Buchungsstapel herunterladen</button></div></div>' +
      '<div class="karte-hint" style="margin-top:8px">Vor der Übergabe mit dem ' +
      'DATEV-Import des Steuerberaters gegenprüfen.</div></div>';
  }

  /* DATEV-Import */
  html += '<div class="karte"><h2>DATEV-Import</h2>' +
    '<div class="karte-hint">DATEV-Buchungsstapel im EXTF-Format einlesen — das ' +
    'Gegenstück zum Export. Soll/Haben-Richtung, Konten, Belegdatum und ' +
    'Buchungstext werden übernommen; jede Zeile vor dem Import prüfen.</div>' +
    '<input type="file" id="datevImpDatei" accept=".csv,text/csv,text/plain">' +
    '<div id="datevImpVorschau"></div></div>';

  /* Journal-Export (CSV / JSON) */
  if (a.buchungen.length) {
    html += '<div class="karte"><h2>Journal-Export</h2>' +
      '<div class="karte-hint">Das Buchungsjournal maschinenlesbar — CSV für die ' +
      'Tabellenkalkulation, JSON für eigene Skripte und Pipelines. Der vollständige ' +
      'Datenbestand liegt in der .obz-Sicherung (reines JSON); Aufbau aller ' +
      'Formate siehe DATENFORMATE.md.</div><div class="btn-reihe">' +
      '<button class="btn" id="journalCsv">Journal als CSV</button>' +
      '<button class="btn" id="journalJson">Journal als JSON</button></div></div>';
  }

  /* GDPdU-Export (Betriebsprüfung) */
  if (a.buchungen.length) {
    html += '<div class="karte"><h2>GDPdU-Export (Betriebsprüfung)</h2>' +
      '<div class="karte-hint">Datenträgerüberlassung nach GDPdU-Beschreibungs' +
      'standard: das Buchungsjournal als CSV und eine beschreibende index.xml für ' +
      'die Prüfsoftware der Finanzverwaltung. Beide Dateien in denselben Ordner ' +
      'legen.</div><div class="btn-reihe">' +
      '<button class="btn btn-pri" id="gdpduExport">GDPdU-Dateien herunterladen' +
      '</button></div></div>';
  }

  /* Bankimport CAMT.053 */
  html += '<div class="karte"><h2>Bankimport (CAMT.053)</h2>' +
    '<div class="karte-hint">Kontoauszug im Format CAMT.053 (ISO 20022) einlesen und ' +
    'halbautomatisch verbuchen. Das Ziel-Bankkonto wählst du in der Vorschau; der ' +
    'Verwendungszweck liefert je Zeile einen Kontovorschlag.</div>' +
    '<input type="file" id="camtDatei" accept=".xml,text/xml,application/xml">' +
    '<div id="camtVorschau"></div></div>';

  /* Bankimport MT940 */
  html += '<div class="karte"><h2>Bankimport (MT940)</h2>' +
    '<div class="karte-hint">Kontoauszug im klassischen SWIFT-Format MT940 ' +
    'einlesen — viele Banken bieten es alternativ zu CAMT.053. Verbuchung wie ' +
    'beim CAMT-Import: Ziel-Bankkonto in der Vorschau wählbar, je Zeile ein ' +
    'Kontovorschlag.</div>' +
    '<input type="file" id="mt940Datei" accept=".sta,.940,.txt,text/plain">' +
    '<div id="mt940Vorschau"></div></div>';

  /* Broker-Import (Interactive Brokers Flex) */
  html += '<div class="karte"><h2>Broker-Import (Interactive Brokers)</h2>' +
    '<div class="karte-hint">Flex-Query-Bericht (XML) von Interactive Brokers ' +
    'einlesen — Trades, Dividenden und Zinsen werden je Zeile als Buchung gegen ' +
    'das in der Vorschau gewählte Verrechnungs-/Bankkonto gebucht (Wertpapiere → ' +
    '1510).</div>' +
    '<input type="file" id="ibkrDatei" accept=".xml,text/xml,application/xml">' +
    '<div id="ibkrVorschau"></div></div>';

  /* E-Rechnung (XRechnung / ZUGFeRD) */
  html += '<div class="karte"><h2>E-Rechnung (XRechnung / ZUGFeRD)</h2>' +
    '<div class="karte-hint">Eingehende E-Rechnung als XML einlesen (XRechnung ' +
    'oder die XML aus einer ZUGFeRD-PDF). Die Beträge werden ausgelesen und als ' +
    'Eingangsrechnung gegen Verbindlichkeiten (3300) gebucht.</div>' +
    '<input type="file" id="erDatei" accept=".xml,text/xml,application/xml">' +
    '<div id="erVorschau"></div></div>';

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
    var kopf = Pruefkette.fortschreiben(a.buchungen);
    a.protokoll.push({ zeit: new Date().toISOString(),
      text: n + ' Buchung(en) festgeschrieben — Prüfketten-Hash ' +
        (kopf ? kopf.slice(0, 16) + '…' : '—') });
    speichereStill().then(function () { renderBuchhaltung(m); });
  };
  var buPruef = m.querySelector('#buPruef');
  if (buPruef) buPruef.onclick = function () {
    var r = Pruefkette.pruefe(a.buchungen);
    var box = m.querySelector('#pruefErgebnis');
    if (!box) return;
    if (r.ok) {
      box.innerHTML = '<div class="box box-gut"><b>Prüfkette intakt</b>' +
        r.anzahl + ' festgeschriebene Buchung(en) sind lückenlos verkettet.' +
        (r.kopf ? ' Ketten-Hash: <code>' + esc(r.kopf.slice(0, 24)) + '…</code>' : '') +
        (r.ohneHash ? ' (' + r.ohneHash + ' ältere Buchung(en) noch ohne Hash — ' +
          'werden bei der nächsten Festschreibung verkettet.)' : '') + '</div>';
    } else {
      box.innerHTML = '<div class="box box-warn"><b>Prüfkette unterbrochen</b>' +
        'Die festgeschriebene Buchung <code>' + esc(r.bruchId) + '</code> stimmt ' +
        'nicht mehr mit ihrem Prüf-Hash überein — sie wurde nach der Festschreibung ' +
        'verändert. Den ursprünglichen Stand aus einer Sicherung wiederherstellen.</div>';
    }
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
    if (!confirm('Kontensalden in Bilanz und GuV übernehmen?\n\nBereits direkt ' +
      'eingegebene Bilanz- und GuV-Werte dieses Abschlusses werden dabei ' +
      'überschrieben.')) return;
    uebernehmeSalden(a);
    speichereStill().then(function () {
      hinweisToast('Kontensalden in Bilanz und GuV übernommen.');
      setView('editor');
    });
  };
  var ebQuelle = m.querySelector('#ebQuelle');
  var ebVorschau = m.querySelector('#ebVorschau');
  if (ebQuelle && ebVorschau) {
    var ebVorschauZeigen = function () {
      ebVorschau.innerHTML = '<div class="karte-hint" style="margin-top:10px">Lädt …</div>';
      Store.ladeAbschluss(ebQuelle.value).then(function (q) {
        ebVorschau.innerHTML = eroeffnungsVorschauHtml(q);
      });
    };
    ebVorschauZeigen();
    ebQuelle.onchange = ebVorschauZeigen;
  }
  var ebBtn = m.querySelector('#ebUebernehmen');
  if (ebBtn) ebBtn.onclick = function () {
    eroeffnungUebernehmen(a, m.querySelector('#ebQuelle').value, m);
  };
  var dtv = m.querySelector('#dtvExport');
  if (dtv) dtv.onclick = function () {
    var txt = Datev.erzeuge(a, {
      datevBeraterNr: (m.querySelector('#dtvBerater') || {}).value,
      datevMandantNr: (m.querySelector('#dtvMandant') || {}).value
    });
    ladeDatei(txt, 'EXTF_Buchungsstapel_' + (a.bezeichnung || 'Abschluss')
      .replace(/[^\w]+/g, '_') + '.csv', 'text/csv;charset=utf-8');
  };
  var datevImpIn = m.querySelector('#datevImpDatei');
  if (datevImpIn) datevImpIn.onchange = function () {
    var f = datevImpIn.files && datevImpIn.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { datevVorschau(m, a, Datev.parse(rd.result), '#datevImpVorschau'); };
    rd.onerror = function () { alert('Die Datei konnte nicht gelesen werden.'); };
    rd.readAsText(f);
  };
  var mt940In = m.querySelector('#mt940Datei');
  if (mt940In) mt940In.onchange = function () {
    var f = mt940In.files && mt940In.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      camtVorschau(m, a, kontoOpt, Mt940.parse(rd.result), 'MT940', '#mt940Vorschau');
    };
    rd.onerror = function () { alert('Die Datei konnte nicht gelesen werden.'); };
    rd.readAsText(f);
  };
  function dateiBasis() {
    return (a.bezeichnung || 'Abschluss').replace(/[^\w]+/g, '_');
  }
  var journalCsvBtn = m.querySelector('#journalCsv');
  if (journalCsvBtn) journalCsvBtn.onclick = function () {
    ladeDatei(JournalExport.csv(a), 'Buchungsjournal_' + dateiBasis() + '.csv',
      'text/csv;charset=utf-8');
  };
  var journalJsonBtn = m.querySelector('#journalJson');
  if (journalJsonBtn) journalJsonBtn.onclick = function () {
    ladeDatei(JournalExport.json(a), 'Buchungsjournal_' + dateiBasis() + '.json',
      'application/json;charset=utf-8');
  };
  var gdpduBtn = m.querySelector('#gdpduExport');
  if (gdpduBtn) gdpduBtn.onclick = function () {
    var g = Gdpdu.erzeuge(a, S.unternehmen);
    ladeDatei(g.csv, g.csvDateiname, 'text/csv;charset=utf-8');
    setTimeout(function () {
      ladeDatei(g.indexXml, 'index.xml', 'application/xml;charset=utf-8');
    }, 400);
  };
  var camtIn = m.querySelector('#camtDatei');
  if (camtIn) camtIn.onchange = function () {
    var f = camtIn.files && camtIn.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      camtVorschau(m, a, kontoOpt, Importe.parseCamt(rd.result), 'CAMT', '#camtVorschau');
    };
    rd.onerror = function () { alert('Die Datei konnte nicht gelesen werden.'); };
    rd.readAsText(f);
  };
  var ibkrIn = m.querySelector('#ibkrDatei');
  if (ibkrIn) ibkrIn.onchange = function () {
    var f = ibkrIn.files && ibkrIn.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      camtVorschau(m, a, kontoOpt, Importe.parseIbkrFlex(rd.result), 'IBKR', '#ibkrVorschau');
    };
    rd.onerror = function () { alert('Die Datei konnte nicht gelesen werden.'); };
    rd.readAsText(f);
  };
  var erIn = m.querySelector('#erDatei');
  if (erIn) erIn.onchange = function () {
    var f = erIn.files && erIn.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { eRechnungVorschau(m, a, kontoOpt, Importe.parseERechnung(rd.result)); };
    rd.onerror = function () { alert('Die Datei konnte nicht gelesen werden.'); };
    rd.readAsText(f);
  };
}

/* ===========================================================================
 * Eröffnungsbuchungen / Saldenvortrag
 * ---------------------------------------------------------------------------
 * Eine Jahresabschluss-Buchhaltung beginnt nicht bei null: die Bestände der
 * Eröffnungsbilanz (bzw. des Vorjahres) werden zu Jahresbeginn als Eröffnungs-
 * buchungen gegen das Eröffnungsbilanzkonto 9000 übernommen (Bilanzidentität,
 * § 252 Abs. 1 Nr. 1 HGB).
 * ========================================================================= */

/* HGB-Positions-Label (mit Nummer) zu einer Positions-ID. */
function posLabel(id) {
  var n = Positionen.finde(Positionen.AKTIVA, id) ||
          Positionen.finde(Positionen.PASSIVA, id);
  return n ? (n.nr + ' ' + n.label) : id;
}

/* Plant die Eröffnungsbuchungen aus einem Quell-Abschluss: je belegter
 * Bilanzposition eine Buchung gegen das EBK 9000, das gezeichnete Kapital
 * gegen Konto 2900. Liefert zusätzlich den zu übernehmenden Kapitalblock.
 * Reine Planung - schreibt nichts. */
function eroeffnungsPlan(quelle) {
  var plan = [], warn = [];
  var aktiva = (quelle.werte && quelle.werte.aktiva) || {};
  var passiva = (quelle.werte && quelle.werte.passiva) || {};
  var kap = Berechnung.kapitalRechnen(quelle.kapital);

  function zeile(soll, haben, betrag, text) {
    plan.push({ soll: soll, haben: haben, betrag: Berechnung.cent(betrag), text: text });
  }
  /* Gezeichnetes Kapital (Nennbetrag) -> Konto 2900 */
  if (kap.gezeichnet >= 0.005) {
    zeile('9000', '2900', kap.gezeichnet, 'Eröffnungsbuchung: Gezeichnetes Kapital');
  }
  /* Aktiv-Positionen: Soll Sachkonto / Haben EBK */
  Object.keys(aktiva).forEach(function (id) {
    var v = Berechnung.cent(aktiva[id]);
    if (Math.abs(v) < 0.005) return;
    var k = SKR04.EB_KONTO[id];
    if (!k) { warn.push(posLabel(id)); return; }
    if (v >= 0) zeile(k, '9000', v, 'Eröffnungsbuchung: ' + posLabel(id));
    else        zeile('9000', k, -v, 'Eröffnungsbuchung: ' + posLabel(id));
  });
  /* Passiv-Positionen: Soll EBK / Haben Sachkonto */
  Object.keys(passiva).forEach(function (id) {
    if (id === 'P.A.I' || id === 'P.A.V') return;   // automatisch berechnet
    var v = Berechnung.cent(passiva[id]);
    if (Math.abs(v) < 0.005) return;
    var k = SKR04.EB_KONTO[id];
    if (!k) { warn.push(posLabel(id)); return; }
    if (v >= 0) zeile('9000', k, v, 'Eröffnungsbuchung: ' + posLabel(id));
    else        zeile(k, '9000', -v, 'Eröffnungsbuchung: ' + posLabel(id));
  });
  return { plan: plan, warn: warn, kapital: {
    gezeichnet: kap.gezeichnet, eingezahlt: kap.eingezahlt,
    eingefordertOffen: kap.eingefordertOffen } };
}

/* Karte „Anfangsbestände" in der Buchhaltung eines Jahresabschlusses. */
function eroeffnungsBox(a) {
  var bereits = a.buchungen.filter(function (b) { return b.eroeffnung; });
  var h = '<div class="karte"><div class="karte-kopf"><div>' +
    '<h2>Anfangsbestände &ndash; Eröffnungsbuchungen</h2>' +
    '<div class="karte-hint">Saldenvortrag aus der Eröffnungsbilanz bzw. dem ' +
    'Vorjahr (Bilanzidentität, § 252 Abs. 1 Nr. 1 HGB).</div></div></div>';

  if (bereits.length) {
    h += '<div class="box box-gut"><b>✓ Eröffnungsbuchungen vorhanden</b>' +
      bereits.length + ' Eröffnungsbuchung(en) sind erfasst (im Journal am Text ' +
      '&bdquo;Eröffnungsbuchung: …&ldquo; erkennbar). Zum Neu-Erzeugen diese zuerst ' +
      'löschen &ndash; möglich, solange sie nicht festgeschrieben sind.</div></div>';
    return h;
  }
  h += '<div class="box box-info"><b>Warum?</b>Eine Jahresabschluss-Buchhaltung ' +
    'beginnt nicht bei null. Die Schlussbestände des Vorjahres &ndash; im ersten ' +
    'Jahr die Eröffnungsbilanz &ndash; werden als Eröffnungsbuchungen gegen das ' +
    'Eröffnungsbilanzkonto <b>9000</b> übernommen. Erst darauf baut die laufende ' +
    'Buchhaltung auf, und erst dann geht die Bilanz auf.</div>';

  var quellen = S.abschluesse.filter(function (x) {
    return x.id !== a.id &&
      (x.art === 'EROEFFNUNGSBILANZ' || x.art === 'JAHRESABSCHLUSS');
  });
  if (!quellen.length) {
    h += '<div class="karte-hint">Kein anderer Abschluss vorhanden. Lege zuerst die ' +
      'Eröffnungsbilanz an &ndash; danach lässt sie sich hier übernehmen.</div></div>';
    return h;
  }
  var opts = quellen.map(function (x) {
    return '<option value="' + esc(x.id) + '"' +
      (a.vorjahrId === x.id ? ' selected' : '') + '>' + esc(x.bezeichnung) +
      (x.art === 'EROEFFNUNGSBILANZ' ? ' — Eröffnungsbilanz' : ' — Jahresabschluss') +
      '</option>';
  }).join('');
  h += '<div class="gitter g2">' +
    feldWrap('Quelle', 'Eröffnungsbilanz oder Vorjahres-Abschluss',
      '<select id="ebQuelle">' + opts + '</select>') +
    '<div style="display:flex;align-items:flex-end"><button class="btn btn-pri" ' +
    'id="ebUebernehmen">Anfangsbestände übernehmen</button></div>' +
    '</div><div id="ebVorschau"></div></div>';
  return h;
}

/* Vorschau-HTML der geplanten Eröffnungsbuchungen für eine Quelle. Dient
 * zugleich als Anleitung für die manuelle Erfassung. Erwartet den VOLL
 * geladenen Quell-Abschluss (S.abschluesse enthält nur Kurzinfos). */
function eroeffnungsVorschauHtml(quelle) {
  if (!quelle) {
    return '<div class="karte-hint" style="margin-top:10px">Quelle konnte nicht ' +
      'geladen werden.</div>';
  }
  var res = eroeffnungsPlan(quelle);
  if (!res.plan.length) {
    return '<div class="karte-hint" style="margin-top:10px">Die gewählte Quelle ' +
      'enthält keine übertragbaren Bestände.</div>';
  }
  var h = '<div class="karte-hint" style="margin-top:12px">Geplante Eröffnungs' +
    'buchungen &ndash; vor dem Übernehmen prüfbar, danach im Journal frei anpassbar. ' +
    'Für die manuelle Erfassung: genau diese Sätze gegen Konto 9000 buchen.</div>';
  h += '<table class="liste"><thead><tr><th>Soll</th><th>Haben</th>' +
    '<th class="rechts">Betrag</th><th>Text</th></tr></thead><tbody>';
  res.plan.forEach(function (p) {
    h += '<tr><td class="mono">' + esc(p.soll) + '</td>' +
      '<td class="mono">' + esc(p.haben) + '</td>' +
      '<td class="rechts mono">' + geld(p.betrag) + '</td>' +
      '<td>' + esc(p.text) + '</td></tr>';
  });
  h += '</tbody></table>';
  if (res.warn.length) {
    h += '<div class="box box-warn" style="margin-top:10px"><b>Nicht automatisch ' +
      'übertragbar</b>Für diese Positionen gibt es kein Standardkonto &ndash; bitte ' +
      'manuell gegen Konto 9000 buchen: ' + esc(res.warn.join('; ')) + '.</div>';
  }
  return h;
}

/* Erzeugt die Eröffnungsbuchungen aus der gewählten Quelle und übernimmt
 * deren Kapitalblock. Lädt die Quelle zuvor vollständig nach (S.abschluesse
 * enthält nur Kurzinfos ohne werte/kapital). */
function eroeffnungUebernehmen(a, quelleId, m) {
  Store.ladeAbschluss(quelleId).then(function (quelle) {
    if (!quelle) { alert('Quelle konnte nicht geladen werden.'); return; }
    eroeffnungAnwenden(a, quelle, m);
  });
}
function eroeffnungAnwenden(a, quelle, m) {
  var res = eroeffnungsPlan(quelle);
  if (!res.plan.length) {
    alert('Die gewählte Quelle enthält keine übertragbaren Bestände.'); return;
  }
  var txt = res.plan.length + ' Eröffnungsbuchung(en) aus „' +
    (quelle.bezeichnung || 'Quelle') + '" erzeugen?\n\nDie Buchungen werden ins ' +
    'Journal eingefügt und der Kapitalblock dieses Jahresabschlusses wird aus der ' +
    'Quelle übernommen.';
  if (res.warn.length) txt += '\n\nNicht übertragbar: ' + res.warn.join('; ');
  if (!confirm(txt)) return;

  var datum = a.gjVon || quelle.stichtag || a.stichtag ||
              new Date().toISOString().slice(0, 10);
  var stamp = Date.now();
  res.plan.forEach(function (p, idx) {
    a.buchungen.push({
      id: 'B-EB-' + stamp + '-' + idx,
      datum: datum, betrag: p.betrag, text: p.text,
      soll: p.soll, haben: p.haben, eroeffnung: true
    });
  });
  a.kapital = a.kapital || {};
  a.kapital.gezeichnet = res.kapital.gezeichnet;
  a.kapital.eingezahlt = res.kapital.eingezahlt;
  a.kapital.eingefordertOffen = res.kapital.eingefordertOffen;
  if (!a.vorjahrId) a.vorjahrId = quelle.id;
  a.protokoll.push({ zeit: new Date().toISOString(),
    text: res.plan.length + ' Eröffnungsbuchung(en) aus „' +
      (quelle.bezeichnung || 'Quelle') + '" übernommen' });
  speichereStill().then(function () {
    hinweisToast('Eröffnungsbuchungen erzeugt. Mit „Salden übernehmen" in die Bilanz.');
    renderBuchhaltung(m);
  });
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
    if (k.seite === 'EBK') return;               // Eröffnungsbilanzkonto: reines Verrechnungskonto
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
 * BUCHUNGSHILFE  -  erklaerte Standardfaelle mit konkreten Buchungssaetzen
 * ========================================================================= */
function renderHilfe(m) {
  /* Karte mit erklaerendem Text und optionaler Buchungssatz-Tabelle.
   * saetze: Array von [Soll-Konto, Haben-Konto, Geschaeftsvorfall]. */
  function fall(titel, text, saetze) {
    var h = '<div class="karte"><h2>' + titel + '</h2>';
    if (text) h += '<div class="karte-hint" style="margin-bottom:10px">' + text + '</div>';
    if (saetze && saetze.length) {
      h += '<table class="liste"><thead><tr><th>Soll</th><th>Haben</th>' +
        '<th>Geschäftsvorfall</th></tr></thead><tbody>';
      saetze.forEach(function (s) {
        h += '<tr><td class="mono">' + s[0] + '</td><td class="mono">' + s[1] +
          '</td><td>' + s[2] + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    return h + '</div>';
  }

  var html = '<div class="kopf"><h1>Buchungshilfe &amp; Standardfälle</h1>' +
    '<p>Wie typische Geschäftsvorfälle einer GmbH gebucht werden — mit konkreten ' +
    'Buchungssätzen nach dem Kontenrahmen SKR04.</p></div>';

  html += '<div class="box box-info"><b>Grundprinzip</b>Jede Buchung hat ein Soll- und ' +
    'ein Haben-Konto und denselben Betrag auf beiden Seiten. In der Buchhaltung erzeugt ' +
    '„Salden in Bilanz/GuV übernehmen“ aus den Kontensalden automatisch Bilanz und GuV. ' +
    'Eine HGB-Bilanzposition (z. B. „Sachanlagen“) bündelt dabei mehrere Konten.</div>';

  html += fall('1. GmbH-Gründung &amp; Eröffnungsbilanz',
    'Die <b>Eröffnungsbilanz</b> wird direkt erfasst — sie hat kein Buchungsjournal. ' +
    'Standardfall: 25.000 € Stammkapital gezeichnet, 12.500 € auf die Bank eingezahlt, ' +
    'die zweite Hälfte noch ausstehend und nicht eingefordert. Im Kapitalblock: ' +
    '<i>Gezeichnetes Kapital</i> 25.000, <i>davon eingezahlt</i> 12.500, <i>davon ' +
    'eingefordert aber unbezahlt</i> 0. Unter Aktiva <i>B.IV Kassenbestand/Bank</i> ' +
    '12.500. Die nicht eingeforderten 12.500 € werden offen vom gezeichneten Kapital ' +
    'abgesetzt (Nettomethode, § 272 Abs. 1 HGB) — die Bilanzsumme beträgt 12.500 €.',
    null);

  html += fall('2. Eröffnungsbuchungen — Saldenvortrag ins neue Jahr',
    'Eine Jahresabschluss-Buchhaltung beginnt nicht bei null: die Bestände der ' +
    'Eröffnungsbilanz (bzw. des Vorjahres) werden zu Jahresbeginn als Eröffnungs' +
    'buchungen gegen das Eröffnungsbilanzkonto <b>9000</b> übernommen. In der ' +
    'Buchhaltung macht das die Karte „Anfangsbestände“ automatisch. Schema:',
    [['Sachkonto', '9000', 'jeder Aktiv-Bestand (Bank, Anlagen, Forderungen …)'],
     ['9000', 'Sachkonto', 'jeder Passiv-Bestand (Verbindlichkeiten, Rückstellungen …)'],
     ['9000', '2900', 'gezeichnetes Kapital (Nennbetrag) ins neue Jahr'],
     ['1800', '9000', 'Beispiel: Bankguthaben 12.500 € ins neue Jahr']]);

  html += fall('3. Anlagevermögen &amp; Abschreibung',
    'Anlagegüter werden beim Kauf aktiviert und über die Nutzungsdauer abgeschrieben ' +
    '(AfA). Geringwertige Wirtschaftsgüter (GWG) dürfen sofort abgeschrieben werden.',
    [['0650', '1800', 'Büroeinrichtung gekauft, per Bank bezahlt'],
     ['0440', '1800', 'Maschine gekauft, per Bank bezahlt'],
     ['0670', '1800', 'geringwertiges Wirtschaftsgut (GWG) gekauft'],
     ['6260', '0670', 'GWG sofort abgeschrieben'],
     ['6220', '0650', 'jährliche Abschreibung (AfA) auf die Büroeinrichtung'],
     ['6221', '0240', 'jährliche Abschreibung auf ein Gebäude']]);

  html += '<div class="box box-info"><b>Aktivieren oder sofort als Aufwand?</b>' +
    'Anschaffungen über 800 € netto werden als Anlagevermögen aktiviert und über die ' +
    'Nutzungsdauer abgeschrieben. Bis 800 € netto sind es geringwertige Wirtschaftsgüter ' +
    '(GWG) und dürfen sofort abgeschrieben werden. Für Computerhardware und Software ' +
    'lässt die Finanzverwaltung eine Nutzungsdauer von einem Jahr zu (BMF-Schreiben vom ' +
    '22.02.2022) — wirtschaftlich also ebenfalls Sofortabschreibung. Laufende Kosten ' +
    '(Mobilfunk, Hosting, Abos) sind dagegen immer sofort Aufwand.</div>';

  html += fall('4. Digitale Betriebsmittel &amp; IT-Kosten',
    'Hardware, Software, Websites und laufende IT-Dienste — die häufigsten Fälle einer ' +
    'modernen GmbH. Der vereinfachte Kontenrahmen hat kein eigenes „EDV-Kosten“-Konto; ' +
    'laufende IT-Kosten laufen daher über „Telefon und Internet“ (6805) bzw. „sonstige ' +
    'betriebliche Aufwendungen“ (6300).',
    [['0650', '1800', 'PC, Mac oder Notebook gekauft (über 800 € netto, aktiviert)'],
     ['6220', '0650', 'Computer-Hardware abgeschrieben (Nutzungsdauer 1 Jahr möglich)'],
     ['0670', '1800', 'Smartphone/Handy bis 800 € netto gekauft (GWG)'],
     ['6260', '0670', 'GWG (Handy) sofort abgeschrieben'],
     ['0135', '1800', 'Software / Lizenz gekauft (aktiviert)'],
     ['6200', '0135', 'gekaufte Software abgeschrieben'],
     ['0135', '1800', 'Website von einer Agentur erstellen lassen (aktiviert)'],
     ['6200', '0135', 'Website abgeschrieben (Nutzungsdauer i. d. R. 3 Jahre)'],
     ['6805', '1800', 'Mobilfunk-/Telefonrechnung (laufend)'],
     ['6805', '1800', 'Internetanschluss (laufend)'],
     ['6300', '1800', 'Server-/Hosting-Gebühr (laufend)'],
     ['6300', '1800', 'Domain-Jahresgebühr (laufend)'],
     ['6300', '1800', 'Software-Abo / SaaS / Cloud-Dienst (laufend)'],
     ['6300', '3300', 'IT-Dienstleistung auf Rechnung (z. B. Programmierung)']]);

  html += fall('5. Laufende Einnahmen und Ausgaben',
    'Typische Geschäftsvorfälle des Jahres. Wird eine Rechnung nicht sofort bezahlt, ' +
    'läuft die Gegenbuchung über eine Forderung (1200) bzw. Verbindlichkeit (3300).',
    [['1800', '4400', 'Umsatzerlös erhalten — Nettobetrag (19 % USt)'],
     ['1800', '3806', 'darauf entfallende Umsatzsteuer 19 %'],
     ['1200', '4400', 'Leistung auf Rechnung erbracht (noch offen)'],
     ['1800', '1200', 'Kundenrechnung wird später bezahlt'],
     ['6310', '1800', 'Miete für Geschäftsräume gezahlt'],
     ['6020', '1800', 'Gehälter gezahlt'],
     ['6110', '1800', 'Sozialversicherungsbeiträge gezahlt'],
     ['6400', '1800', 'Versicherungsbeitrag gezahlt'],
     ['6825', '1800', 'Rechts- und Beratungskosten (Anwalt, Steuerberater)'],
     ['6650', '1800', 'Reisekosten gezahlt'],
     ['6300', '1800', 'Bankgebühren / Kontoführung'],
     ['6300', '3300', 'Lieferantenrechnung erhalten (noch offen)'],
     ['3300', '1800', 'Lieferantenrechnung bezahlt'],
     ['1800', '7100', 'Zinsen von der Bank erhalten'],
     ['7600', '1800', 'Körperschaftsteuer-Vorauszahlung ans Finanzamt']]);

  html += '<div class="box box-info"><b>Umsatzsteuer</b>Das Buchungsformular hat ein ' +
    'Soll- und ein Haben-Konto. Eine Rechnung mit Umsatzsteuer wird daher in zwei ' +
    'Buchungen erfasst: Nettoerlös auf das Erlöskonto (4400/4300), die Umsatzsteuer ' +
    'getrennt auf das USt-Konto (3806/3801). Bei Eingangsrechnungen analog mit ' +
    'Vorsteuer (1406/1401).</div>';

  html += '<div class="box box-info"><b>Wertpapiere: Umlauf- oder Anlagevermögen?</b>' +
    'Wertpapiere, die eine GmbH kurzfristig handelt, gehören ins <b>Umlaufvermögen</b> ' +
    '(Konto 1510, Bilanzposten B.III). Dort gilt das strenge Niederstwertprinzip ' +
    '(§ 253 Abs. 4 HGB): Sinkt der Kurs zum Bilanzstichtag unter die Anschaffungskosten, ' +
    'ist zwingend abzuschreiben. Dauerhaft gehaltene Beteiligungen sind dagegen ' +
    '<b>Finanzanlagen</b> (Konto 0820, Bilanzposten A.III). Die steuerliche Behandlung ' +
    'von Veräußerungsgewinnen und Dividenden (§ 8b KStG) bildet die Steuerschätzung ab.</div>';

  html += fall('6. Wertpapiergeschäfte (Trading- / vermögensverwaltende GmbH)',
    'Kauf, Verkauf und Bewertung von Wertpapieren des Umlaufvermögens. Gewinn oder ' +
    'Verlust eines Verkaufs ist die Differenz zwischen Verkaufserlös und Buchwert — er ' +
    'wird über ein eigenes Ertrags- (4906) bzw. Aufwandskonto (6905) erfasst. Ein ' +
    'Verkauf wird in zwei Buchungen abgebildet: zuerst der Erlös bis zur Höhe des ' +
    'Buchwerts, dann getrennt der realisierte Gewinn bzw. Verlust.',
    [['1510', '1800', 'Wertpapiere gekauft — Anschaffungskosten inkl. Spesen, per Bank bezahlt'],
     ['1800', '1510', 'Wertpapiere verkauft — Erlös bis zur Höhe des Buchwerts'],
     ['1800', '4906', 'realisierter Kursgewinn — Verkaufserlös über dem Buchwert'],
     ['6905', '1510', 'realisierter Kursverlust — Buchwert über dem Verkaufserlös'],
     ['7210', '1510', 'Abwertung zum Stichtag — Kurswert unter Anschaffungskosten (§ 253 Abs. 4 HGB)'],
     ['1800', '7000', 'Dividende / Beteiligungsertrag gutgeschrieben'],
     ['1800', '7100', 'Zinserträge (Anleihen, Tages- oder Festgeld)'],
     ['6300', '1800', 'Depot-, Order- oder sonstige Bankgebühren']]);

  html += fall('7. Jahresabschluss abschließen',
    'Sind alle Buchungen erfasst, in der Buchhaltung „Salden in Bilanz/GuV übernehmen“ ' +
    'klicken — die Kontensalden füllen Bilanz und GuV. Anschließend „Buchungen ' +
    'festschreiben“: festgeschriebene Buchungen sind unveränderlich (GoBD), Korrekturen ' +
    'nur noch per Stornobuchung. Den passenden Gesellschafterbeschluss zur Feststellung ' +
    'erzeugt der Reiter „Gesellschafterbeschlüsse“.', null);

  html += '<div class="box box-warn"><b>Keine Steuer- oder Rechtsberatung</b>Diese ' +
    'Beispiele sind eine vereinfachte Orientierung. Bei Sonderfällen (Sacheinlagen, ' +
    'gemischte Nutzung, Rückstellungen, latente Steuern) im Zweifel fachlichen Rat ' +
    'einholen.</div>';

  m.innerHTML = html;
}

/* ===========================================================================
 * GLOSSAR  -  durchsuchbare Erklärung der HGB-, Steuer- und E-Bilanz-Begriffe
 * ========================================================================= */
var GLOSSAR = [
  { g: 'Bilanz & Jahresabschluss', t: 'Eröffnungsbilanz',
    e: 'Bestandsaufnahme von Vermögen und Schulden zu Beginn des Handelsgewerbes. Jede GmbH muss sie zur Gründung aufstellen (§ 242 Abs. 1 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Jahresabschluss',
    e: 'Bilanz, Gewinn- und Verlustrechnung und Anhang zum Ende jedes Geschäftsjahres (§ 242, § 264 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Bilanz',
    e: 'Gegenüberstellung von Vermögen (Aktiva) und Kapital/Schulden (Passiva) zum Stichtag; die Gliederung gibt § 266 HGB vor.' },
  { g: 'Bilanz & Jahresabschluss', t: 'Gewinn- und Verlustrechnung (GuV)',
    e: 'Gegenüberstellung der Erträge und Aufwendungen eines Geschäftsjahres; sie endet mit dem Jahresüberschuss oder -fehlbetrag (§ 275 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Anhang',
    e: 'Erläuternder Teil des Jahresabschlusses mit den Bilanzierungsmethoden und gesetzlichen Pflichtangaben (§§ 284–288 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Gesamtkostenverfahren',
    e: 'GuV-Form, die alle Erträge und die nach Art gegliederten Aufwendungen einer Periode zeigt (§ 275 Abs. 2 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Umsatzkostenverfahren',
    e: 'GuV-Form, die den Umsatzerlösen die Herstellungskosten der verkauften Leistungen gegenüberstellt (§ 275 Abs. 3 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Größenklasse',
    e: 'Einstufung als Kleinst-, kleine, mittelgroße oder große Kapitalgesellschaft nach Bilanzsumme, Umsatz und Arbeitnehmerzahl (§ 267, § 267a HGB). Sie bestimmt den Umfang des Abschlusses.' },
  { g: 'Bilanz & Jahresabschluss', t: 'Kleinstkapitalgesellschaft',
    e: 'Kleinste Größenklasse (§ 267a HGB); sie darf eine stark verkürzte Bilanz und GuV aufstellen und weitgehend auf den Anhang verzichten.' },
  { g: 'Bilanz & Jahresabschluss', t: 'Anlagevermögen',
    e: 'Vermögensgegenstände, die dem Betrieb dauerhaft dienen — Posten A der Aktivseite (§ 266 Abs. 2 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Umlaufvermögen',
    e: 'Vermögensgegenstände, die nicht dauerhaft gehalten werden — Vorräte, Forderungen, Wertpapiere, Bank (Posten B der Aktivseite).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Gezeichnetes Kapital',
    e: 'Das im Gesellschaftsvertrag festgelegte Stammkapital der GmbH (Nennbetrag), mindestens 25.000 € (§ 272 Abs. 1 HGB, § 5 GmbHG).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Nettomethode',
    e: 'Ist das Stammkapital nicht voll eingezahlt, werden nicht eingeforderte Einlagen offen vom gezeichneten Kapital abgesetzt (§ 272 Abs. 1 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Rückstellung',
    e: 'Verbindlichkeit, die dem Grunde nach besteht, aber in Höhe oder Zeitpunkt ungewiss ist — etwa die Steuerrückstellung (§ 249 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Rechnungsabgrenzungsposten',
    e: 'Posten für Zahlungen, die einen Aufwand oder Ertrag eines anderen Geschäftsjahres betreffen (§ 250 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Nicht durch Eigenkapital gedeckter Fehlbetrag',
    e: 'Ausweis auf der Aktivseite, wenn Verluste das Eigenkapital übersteigen (§ 268 Abs. 3 HGB) — ein Warnsignal in Richtung Überschuldung.' },
  { g: 'Bilanz & Jahresabschluss', t: 'Niederstwertprinzip',
    e: 'Vorsichtsgebot: Vermögensgegenstände sind höchstens mit den Anschaffungskosten, bei niedrigerem Wert mit diesem anzusetzen (§ 253 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Abschreibung (AfA)',
    e: 'Verteilung der Anschaffungs- oder Herstellungskosten eines Anlageguts als Aufwand über seine Nutzungsdauer.' },
  { g: 'Bilanz & Jahresabschluss', t: 'Anlagenspiegel',
    e: 'Übersicht über die Entwicklung des Anlagevermögens (Zugänge, Abgänge, Abschreibungen); Pflichtangabe ab der kleinen GmbH (§ 284 Abs. 3 HGB).' },
  { g: 'Bilanz & Jahresabschluss', t: 'Vorjahresspalte',
    e: 'Im Jahresabschluss ist zu jedem Posten der entsprechende Vorjahreswert anzugeben (§ 265 Abs. 2 HGB).' },
  { g: 'Steuern', t: 'Körperschaftsteuer (KSt)',
    e: 'Steuer der Kapitalgesellschaft auf ihren Gewinn; Satz 15 % bis 2027, danach stufenweise sinkend bis 10 % ab 2032.' },
  { g: 'Steuern', t: 'Solidaritätszuschlag',
    e: 'Zuschlag von 5,5 % auf die Körperschaftsteuer.' },
  { g: 'Steuern', t: 'Gewerbesteuer (GewSt)',
    e: 'Gemeindesteuer auf den Gewerbeertrag; Steuermesszahl 3,5 %, multipliziert mit dem Hebesatz der Gemeinde.' },
  { g: 'Steuern', t: 'Hebesatz',
    e: 'Von der Gemeinde festgelegter Prozentsatz, mit dem der Gewerbesteuer-Messbetrag multipliziert wird (z. B. 400 %).' },
  { g: 'Steuern', t: 'Zu versteuerndes Einkommen (zvE)',
    e: 'Bemessungsgrundlage der Körperschaftsteuer: der handelsrechtliche Gewinn nach den steuerlichen Korrekturen.' },
  { g: 'Steuern', t: '§ 8b KStG',
    e: 'Dividenden und Veräußerungsgewinne aus Kapitalbeteiligungen sind bei der GmbH zu 95 % steuerfrei — zentral für die vermögensverwaltende GmbH.' },
  { g: 'Steuern', t: 'Verlustvortrag',
    e: 'Verluste eines Jahres mindern den steuerpflichtigen Gewinn der Folgejahre; über 1 Mio € greift die Mindestbesteuerung (§ 10d EStG, § 10a GewStG).' },
  { g: 'Steuern', t: 'Verdeckte Gewinnausschüttung',
    e: 'Vermögensvorteil an einen Gesellschafter außerhalb eines offenen Gewinnbeschlusses; sie erhöht das zu versteuernde Einkommen (§ 8 Abs. 3 KStG).' },
  { g: 'Steuern', t: 'Kapitalertragsteuer',
    e: '25 % Abgeltungsteuer (zzgl. Solidaritätszuschlag), die die GmbH bei einer Gewinnausschüttung einbehält und ans Finanzamt abführt.' },
  { g: 'Steuern', t: 'Erweiterte Grundstückskürzung',
    e: 'Verwaltet eine GmbH ausschließlich eigenen Grundbesitz, bleibt der Grundstücksertrag praktisch gewerbesteuerfrei (§ 9 Nr. 1 Satz 2 GewStG).' },
  { g: 'Steuern', t: 'Anrechenbare ausländische Quellensteuer',
    e: 'Im Ausland auf Dividenden einbehaltene Steuer, die unter Voraussetzungen auf die deutsche Körperschaftsteuer angerechnet wird (§ 26 KStG).' },
  { g: 'E-Bilanz, Buchhaltung & GoBD', t: 'E-Bilanz',
    e: 'Elektronische Übermittlung von Bilanz und GuV an das Finanzamt im XBRL-Format; Pflicht auch für die Eröffnungsbilanz (§ 5b EStG).' },
  { g: 'E-Bilanz, Buchhaltung & GoBD', t: 'Taxonomie',
    e: 'Amtliches Gliederungsschema der E-Bilanz; die Finanzverwaltung gibt jährlich eine neue Kerntaxonomie heraus (aktuell Version 6.9).' },
  { g: 'E-Bilanz, Buchhaltung & GoBD', t: 'XBRL',
    e: 'Standardisiertes XML-Format für Finanzberichte; die E-Bilanz wird als XBRL-Datei erzeugt.' },
  { g: 'E-Bilanz, Buchhaltung & GoBD', t: 'ERiC',
    e: 'ELSTER Rich Client — die amtliche Software zur Übermittlung der E-Bilanz; sie ist registrierungspflichtig und nicht frei verteilbar.' },
  { g: 'E-Bilanz, Buchhaltung & GoBD', t: 'GoBD',
    e: 'Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern in elektronischer Form — Verwaltungsvorgaben der Finanzverwaltung.' },
  { g: 'E-Bilanz, Buchhaltung & GoBD', t: 'Festschreibung',
    e: 'Buchungen werden unveränderlich gesetzt; eine Korrektur ist danach nur noch per Stornobuchung möglich (§ 146 AO, GoBD).' },
  { g: 'E-Bilanz, Buchhaltung & GoBD', t: 'SKR04',
    e: 'Standardkontenrahmen 04 — ein nach der Abschlussgliederung geordneter Kontenrahmen; OpenBilanz nutzt ihn in der Buchhaltung.' },
  { g: 'E-Bilanz, Buchhaltung & GoBD', t: 'Umsatzsteuer-Voranmeldung (UStVA)',
    e: 'Regelmäßige Meldung der Umsatzsteuer ans Finanzamt; die Zahllast ist die Umsatzsteuer abzüglich der abziehbaren Vorsteuer.' }
];
function renderGlossar(m) {
  var html = '<div class="kopf"><h1>Glossar</h1><p>Kurz erklärt: die HGB-, Steuer- ' +
    'und E-Bilanz-Begriffe, die in OpenBilanz vorkommen.</p></div>';
  html += '<div class="karte">' + feldWrap('Suche', 'Begriff oder Paragraf',
    '<input id="glsSuche" placeholder="z. B. Rückstellung oder § 266">') + '</div>';
  html += '<div id="glsListe"></div>';
  m.innerHTML = html;
  var inp = document.getElementById('glsSuche');
  function zeichne() {
    var q = inp.value.trim().toLowerCase();
    var gruppen = [], idx = {};
    GLOSSAR.forEach(function (x) {
      if (q && (x.t + ' ' + x.e).toLowerCase().indexOf(q) < 0) return;
      if (idx[x.g] == null) { idx[x.g] = gruppen.length; gruppen.push({ g: x.g, eintr: [] }); }
      gruppen[idx[x.g]].eintr.push(x);
    });
    var h = '';
    gruppen.forEach(function (gr) {
      h += '<div class="karte"><h2>' + esc(gr.g) + '</h2>';
      gr.eintr.forEach(function (x) {
        h += '<div style="margin-bottom:9px"><b>' + esc(x.t) + '</b>' +
          '<div class="karte-hint">' + esc(x.e) + '</div></div>';
      });
      h += '</div>';
    });
    document.getElementById('glsListe').innerHTML = h ||
      '<div class="box box-info">Kein Begriff gefunden.</div>';
  }
  inp.addEventListener('input', zeichne);
  zeichne();
}

/* ===========================================================================
 * GESELLSCHAFTERBESCHLÜSSE  -  Generator fuer Beschlussvorlagen
 * ========================================================================= */
function renderBeschluesse(m) {
  var u = S.unternehmen || {};
  var typen = [
    ['feststellung', 'Feststellung des Jahresabschlusses'],
    ['ergebnis',     'Ergebnisverwendung (Gewinn/Verlust)'],
    ['einlagen',     'Einforderung ausstehender Einlagen'],
    ['gf',           'Geschäftsführer (Bestellung / Abberufung / Entlastung)'],
    ['freitext',     'Sonstiger Beschluss (Freitext)']
  ];
  var html = '<div class="kopf"><h1>Gesellschafterbeschlüsse</h1>' +
    '<p>Erzeugt Beschlussvorlagen für die Gesellschafterversammlung — ausfüllen, ' +
    'drucken oder als PDF speichern.</p></div>';
  html += '<div class="box box-warn no-print"><b>Muster, keine Rechtsberatung</b>Die ' +
    'erzeugten Texte sind unverbindliche Vorlagen. Ladungs- und Formvorschriften sowie ' +
    'der Gesellschaftsvertrag sind eigenverantwortlich zu beachten.</div>';

  html += '<div class="karte no-print"><h2>Beschluss</h2><div class="gitter g2">';
  html += feldWrap('Art des Beschlusses', '', '<select id="bsTyp">' +
    typen.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') +
    '</select>');
  html += feldWrap('Datum der Beschlussfassung', '', '<input type="date" id="bsDatum" value="' +
    new Date().toISOString().slice(0, 10) + '">');
  html += feldWrap('Ort der Beschlussfassung', '', '<input id="bsOrt" value="' +
    esc(u.ort || '') + '">');
  html += feldWrap('Gesellschafter', 'Namen durch Komma getrennt — für die Unterschriften',
    '<input id="bsGesellschafter" placeholder="z. B. Max Mustermann, Erika Mustermann">');
  html += '</div><div id="bsSpez" class="gitter g2" style="margin-top:2px"></div>' +
    '<div class="btn-reihe"><button class="btn btn-pri" id="bsErzeugen">' +
    'Beschluss erzeugen</button></div></div>';
  html += '<div id="bsDok"></div>';
  m.innerHTML = html;

  var bsTyp = m.querySelector('#bsTyp');
  function spez() { document.getElementById('bsSpez').innerHTML = bsSpezHtml(bsTyp.value); }
  bsTyp.onchange = spez;
  spez();
  m.querySelector('#bsErzeugen').onclick = function () { bsErzeugen(m); };
}

/* Typ-spezifische Formularfelder. */
function bsSpezHtml(typ) {
  if (typ === 'feststellung' || typ === 'ergebnis') {
    var jas = S.abschluesse.filter(function (x) { return x.art === 'JAHRESABSCHLUSS'; });
    if (!jas.length) {
      return '<div class="karte-hint">Noch kein Jahresabschluss vorhanden — bitte ' +
        'zuerst einen Jahresabschluss anlegen.</div>';
    }
    var h = feldWrap('Jahresabschluss', 'Bilanzsumme und Ergebnis werden übernommen',
      '<select id="bsAbschluss">' + jas.map(function (x) {
        return '<option value="' + esc(x.id) + '">' + esc(x.bezeichnung) + '</option>';
      }).join('') + '</select>');
    if (typ === 'ergebnis') {
      h += feldWrap('Ausschüttung an Gesellschafter (EUR)', 'leer = keine Ausschüttung',
        '<input class="zahl" type="text" inputmode="decimal" id="bsAussch">');
      h += feldWrap('Einstellung in Gewinnrücklagen (EUR)', 'leer = keine Einstellung',
        '<input class="zahl" type="text" inputmode="decimal" id="bsRuecklage">');
      h += '<div class="karte-hint" style="grid-column:1/-1">Der verbleibende Betrag ' +
        'wird automatisch auf neue Rechnung vorgetragen.</div>';
    }
    return h;
  }
  if (typ === 'einlagen') {
    var u = S.unternehmen || {};
    return feldWrap('Gezeichnetes Kapital / Stammkapital (EUR)', '',
        '<input class="zahl" type="text" inputmode="decimal" id="bsGez" value="' +
        eingabeWert(u.stammkapital) + '">') +
      feldWrap('Bereits eingezahlt (EUR)', '',
        '<input class="zahl" type="text" inputmode="decimal" id="bsEinbez">') +
      feldWrap('Jetzt einzufordern (EUR)', '',
        '<input class="zahl" type="text" inputmode="decimal" id="bsEinf">') +
      feldWrap('Zahlungsfrist', '', '<input type="date" id="bsFrist">');
  }
  if (typ === 'freitext') {
    return feldWrap('Betreff / Überschrift', 'z. B. Sitzverlegung der Gesellschaft',
        '<input id="bsFtTitel">') +
      '<label class="feld" style="grid-column:1/-1"><span class="lbl">Beschlusstext</span>' +
      '<textarea id="bsFtText" rows="7" placeholder="Die Gesellschafter beschließen …">' +
      '</textarea></label>';
  }
  /* gf */
  var un = S.unternehmen || {};
  return feldWrap('Vorgang', '', '<select id="bsGfArt">' +
      '<option value="bestellung">Bestellung zum Geschäftsführer</option>' +
      '<option value="abberufung">Abberufung als Geschäftsführer</option>' +
      '<option value="entlastung">Entlastung des Geschäftsführers</option>' +
      '</select>') +
    feldWrap('Name', '', '<input id="bsGfName" value="' +
      esc((un.geschaeftsfuehrer || [])[0] || '') + '">') +
    feldWrap('Wirkung zum / Datum', '', '<input type="date" id="bsGfDatum">') +
    feldWrap('Geschäftsjahr', 'nur bei Entlastung, z. B. 2025', '<input id="bsGfJahr">');
}

/* Liest das Formular, erzeugt das Dokument (laedt bei Bedarf den Abschluss). */
function bsErzeugen(m) {
  var typ = m.querySelector('#bsTyp').value;
  function wert(id) { var el = m.querySelector(id); return el ? el.value : ''; }
  var gemein = {
    datum: wert('#bsDatum'), ort: wert('#bsOrt'),
    gesellschafter: wert('#bsGesellschafter').split(',')
      .map(function (x) { return x.trim(); }).filter(Boolean)
  };
  if (typ === 'feststellung' || typ === 'ergebnis') {
    var sel = m.querySelector('#bsAbschluss');
    if (!sel) { alert('Bitte zuerst einen Jahresabschluss anlegen.'); return; }
    var spez = { aussch: Berechnung.num(wert('#bsAussch')),
                 ruecklage: Berechnung.num(wert('#bsRuecklage')) };
    Store.ladeAbschluss(sel.value).then(function (ab) {
      if (!ab) { alert('Jahresabschluss konnte nicht geladen werden.'); return; }
      bsDokZeigen(m, beschlussDok(typ, gemein, spez, ab));
    });
    return;
  }
  if (typ === 'einlagen') {
    bsDokZeigen(m, beschlussDok('einlagen', gemein, {
      gez: Berechnung.num(wert('#bsGez')), einbez: Berechnung.num(wert('#bsEinbez')),
      einf: Berechnung.num(wert('#bsEinf')), frist: wert('#bsFrist')
    }, null));
    return;
  }
  if (typ === 'freitext') {
    bsDokZeigen(m, beschlussDok('freitext', gemein, {
      titel: wert('#bsFtTitel'), text: wert('#bsFtText')
    }, null));
    return;
  }
  bsDokZeigen(m, beschlussDok('gf', gemein, {
    art: wert('#bsGfArt'), name: wert('#bsGfName'),
    datum: wert('#bsGfDatum'), jahr: wert('#bsGfJahr')
  }, null));
}

function bsDokZeigen(m, dokHtml) {
  var box = m.querySelector('#bsDok');
  box.innerHTML = '<div class="btn-reihe no-print" style="margin:16px 0">' +
    '<button class="btn btn-pri" id="bsDrucken">Drucken / als PDF speichern</button></div>' +
    '<div class="dok">' + dokHtml + '</div>';
  box.querySelector('#bsDrucken').onclick = function () { window.print(); };
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Baut das vollstaendige Beschluss-Dokument. */
function beschlussDok(typ, g, s, ab) {
  function dat(iso, ersatz) { return iso ? datumDe(iso) : (ersatz || '—'); }
  var u = S.unternehmen || {};
  var firma = u.name || 'Gesellschaft';
  var sitz = ((u.plz || '') + ' ' + (u.ort || '')).trim();
  var h = '<h1>' + esc(firma) + '</h1>';
  h += '<div class="dok-sub">' + (sitz ? esc(sitz) : '') +
    (u.hrNummer ? (sitz ? ' &middot; ' : '') + esc(u.hrNummer) : '') + '</div>';
  h += '<h1 style="margin-top:14px">Beschluss der Gesellschafterversammlung</h1>';
  h += '<p>Die Gesellschafter der ' + esc(firma) + ' fassen am ' + dat(g.datum) +
    (g.ort ? ' in ' + esc(g.ort) : '') + ' folgenden Beschluss:</p>';
  h += beschlussText(typ, s, ab, dat);
  h += '<p style="margin-top:26px">' + esc(g.ort || '') + ', den ' + dat(g.datum) + '</p>';
  var namen = g.gesellschafter.length ? g.gesellschafter : ['', ''];
  h += '<div style="display:flex;gap:46px;flex-wrap:wrap;margin-top:30px">';
  namen.forEach(function (n) {
    h += '<div style="min-width:210px">' +
      '<div style="border-top:1px solid #444;padding-top:5px;font-size:13px">' +
      (esc(n) || '&nbsp;') + '</div>' +
      '<div style="font-size:11px;color:#666">Unterschrift Gesellschafter/in</div></div>';
  });
  h += '</div>';
  return h;
}

/* Liefert den eigentlichen Beschlusstext je Typ. */
function beschlussText(typ, s, ab, dat) {
  if (typ === 'feststellung') {
    var r = Berechnung.berechne(ab);
    var e = r.guv.jahresergebnis || 0;
    return '<h2>Feststellung des Jahresabschlusses</h2>' +
      '<p>Der von der Geschäftsführung aufgestellte Jahresabschluss zum ' +
      dat(ab.stichtag) + ' — bestehend aus Bilanz, Gewinn- und Verlustrechnung sowie ' +
      'Anhang — wird hiermit festgestellt.</p>' +
      '<p>Die Bilanzsumme beträgt ' + geld(r.bilanz.summeAktiva) + ' EUR. Das ' +
      'Geschäftsjahr schließt mit einem ' +
      (e >= 0 ? 'Jahresüberschuss' : 'Jahresfehlbetrag') + ' von ' +
      geld(Math.abs(e)) + ' EUR ab.</p>' +
      '<p class="dok-fussnote">Rechtsgrundlage: § 42a Abs. 2 GmbHG.</p>';
  }
  if (typ === 'ergebnis') {
    var r2 = Berechnung.berechne(ab);
    var erg = r2.guv.jahresergebnis || 0;
    if (erg < 0) {
      return '<h2>Verwendung des Jahresergebnisses</h2>' +
        '<p>Das Geschäftsjahr zum ' + dat(ab.stichtag) + ' schließt mit einem ' +
        'Jahresfehlbetrag von ' + geld(-erg) + ' EUR.</p>' +
        '<p>Der Jahresfehlbetrag wird auf neue Rechnung vorgetragen (Verlustvortrag).</p>' +
        '<p class="dok-fussnote">Rechtsgrundlage: § 29 GmbHG.</p>';
    }
    var aussch = Berechnung.cent(s.aussch), ruecklage = Berechnung.cent(s.ruecklage);
    var vortrag = Berechnung.cent(erg - aussch - ruecklage);
    var zeile = function (lbl, betrag) {
      return '<tr><td style="padding:3px 14px 3px 0">' + lbl + '</td>' +
        '<td style="text-align:right;font-variant-numeric:tabular-nums">' +
        geld(betrag) + ' EUR</td></tr>';
    };
    var h = '<h2>Verwendung des Jahresergebnisses</h2>' +
      '<p>Das Geschäftsjahr zum ' + dat(ab.stichtag) + ' schließt mit einem ' +
      'Jahresüberschuss von ' + geld(erg) + ' EUR. Über die Verwendung wird wie folgt ' +
      'beschlossen:</p><table style="margin:8px 0 4px"><tbody>' +
      zeile('Ausschüttung an die Gesellschafter', aussch) +
      zeile('Einstellung in die Gewinnrücklagen', ruecklage) +
      zeile('Vortrag auf neue Rechnung (Gewinnvortrag)', vortrag) +
      '</tbody></table>';
    if (aussch > 0) {
      h += '<p>Die Ausschüttung wird im Verhältnis der Geschäftsanteile ausgezahlt.</p>';
    }
    if (vortrag < -0.005) {
      h += '<p class="dok-fussnote" style="color:#a23">Hinweis: Ausschüttung und ' +
        'Einstellung übersteigen den Jahresüberschuss um ' + geld(-vortrag) +
        ' EUR — bitte die Beträge prüfen.</p>';
    }
    return h + '<p class="dok-fussnote">Rechtsgrundlage: § 29 GmbHG.</p>';
  }
  if (typ === 'einlagen') {
    var aus = Berechnung.cent(s.gez - s.einbez);
    var h2 = '<h2>Einforderung ausstehender Stammeinlagen</h2>' +
      '<p>Das Stammkapital der Gesellschaft beträgt ' + geld(s.gez) + ' EUR. Hierauf ' +
      'sind bisher ' + geld(s.einbez) + ' EUR eingezahlt; die ausstehenden Einlagen ' +
      'belaufen sich auf ' + geld(aus) + ' EUR.</p>' +
      '<p>Die Geschäftsführung wird angewiesen, von den Gesellschaftern ausstehende ' +
      'Einlagen in Höhe von <b>' + geld(s.einf) + ' EUR</b> einzufordern. Die ' +
      'eingeforderten Beträge sind bis zum ' + dat(s.frist, 'angegebenen Termin') +
      ' auf ein Geschäftskonto der Gesellschaft einzuzahlen.</p>';
    if (s.einf > aus + 0.005) {
      h2 += '<p class="dok-fussnote" style="color:#a23">Hinweis: Der einzufordernde ' +
        'Betrag übersteigt die ausstehenden Einlagen — bitte prüfen.</p>';
    }
    return h2 + '<p class="dok-fussnote">Rechtsgrundlage: § 46 Nr. 2 GmbHG.</p>';
  }
  if (typ === 'freitext') {
    var ftTitel = esc(s.titel) || 'Beschluss';
    var ftText = esc(s.text || '').replace(/\n/g, '<br>');
    return '<h2>' + ftTitel + '</h2><p>' + (ftText || '[Beschlusstext]') + '</p>';
  }
  /* gf */
  var name = esc(s.name) || '[Name]';
  if (s.art === 'abberufung') {
    return '<h2>Abberufung eines Geschäftsführers</h2>' +
      '<p>' + name + ' wird mit Wirkung zum ' + dat(s.datum, 'sofort') +
      ' als Geschäftsführer der Gesellschaft abberufen.</p>' +
      '<p class="dok-fussnote">Rechtsgrundlage: § 46 Nr. 5 GmbHG.</p>';
  }
  if (s.art === 'entlastung') {
    return '<h2>Entlastung der Geschäftsführung</h2>' +
      '<p>Dem Geschäftsführer ' + name + ' wird für das Geschäftsjahr ' +
      (esc(s.jahr) || '[Geschäftsjahr]') + ' Entlastung erteilt. Die Gesellschafter ' +
      'billigen die Geschäftsführung dieses Zeitraums.</p>' +
      '<p class="dok-fussnote">Rechtsgrundlage: § 46 Nr. 5 GmbHG.</p>';
  }
  return '<h2>Bestellung eines Geschäftsführers</h2>' +
    '<p>' + name + ' wird mit Wirkung zum ' + dat(s.datum, 'sofort') +
    ' zum Geschäftsführer der Gesellschaft bestellt. Die Vertretungsbefugnis richtet ' +
    'sich nach dem Gesellschaftsvertrag.</p>' +
    '<p class="dok-fussnote">Rechtsgrundlage: § 46 Nr. 5 GmbHG.</p>';
}

/* ===========================================================================
 * ANLAGENVERZEICHNIS & AfA
 * ---------------------------------------------------------------------------
 * Anlagengitter mit linearer und degressiver Abschreibung. Die Anlagegüter
 * werden unternehmensweit gehalten (S.unternehmen.anlagen); je Geschäftsjahr
 * ergeben sich AfA-Betrag und Buchwert. Aus dem Verzeichnis lassen sich der
 * Anlagenspiegel (§ 284 Abs. 3 HGB) und AfA-Buchungen für einen Jahres-
 * abschluss erzeugen.
 * ========================================================================= */

/* Standard-Abschreibungskonto (GuV) zu einem Anlage-Konto. */
function afaKontoZu(kontoNr) {
  var k = SKR04.kontoFinden(kontoNr);
  if (!k) return '6220';
  if (k.pos === 'A.I') return '6200';                 // immaterielle Vermögensgegenstände
  if (kontoNr === '0670') return '6260';              // GWG-Sofortabschreibung
  if (/^02/.test(kontoNr)) return '6221';             // Gebäude / grundstücksgleiche Bauten
  return '6220';                                      // sonstige Sachanlagen
}

/* AfA-Plan einer Anlage: [{ jahr, monate, afa, buchwert }] je Kalenderjahr.
 * Degressive AfA: höchstens das Dreifache der linearen, gedeckelt auf 30 %
 * (Regelung für bewegliche WG, Anschaffung 01.07.2025–31.12.2027); Wechsel zur
 * linearen Restwert-AfA, sobald diese höher ist. Erstes Jahr monatsgenau. */
function afaPlan(anlage) {
  var AK = Berechnung.num(anlage.anschaffungskosten);
  var ND = parseInt(anlage.nutzungsdauer, 10) || 0;
  var d = String(anlage.anschaffungsdatum || '');
  var jahr0 = parseInt(d.slice(0, 4), 10);
  var monat0 = parseInt(d.slice(5, 7), 10) || 1;
  if (!(AK > 0) || !ND || !jahr0) return [];
  var degressiv = anlage.methode === 'degressiv';
  var satz = Math.min(3 / ND, 0.30);
  var linJahr = AK / ND;
  var plan = [], bw = AK, jahr = jahr0, idx = 0, restMon = ND * 12;
  while (bw > 0.005 && plan.length < ND + 4 && restMon > 0) {
    var mon = (idx === 0) ? (13 - monat0) : 12;
    if (mon > restMon) mon = restMon;
    var afa;
    if (degressiv) {
      var afaDeg = bw * satz * (mon / 12);
      var afaLin = bw * mon / restMon;          // linear auf Restbuchwert/Restmonate
      afa = Math.max(afaDeg, afaLin);
    } else {
      afa = linJahr * (mon / 12);
    }
    if (afa > bw) afa = bw;
    afa = Math.round(afa * 100) / 100;
    bw = Math.round((bw - afa) * 100) / 100;
    plan.push({ jahr: jahr, monate: mon, afa: afa, buchwert: bw });
    restMon -= mon; jahr++; idx++;
  }
  if (bw > 0.005 && plan.length) {              // Rundungsrest in die letzte Zeile
    var last = plan[plan.length - 1];
    last.afa = Math.round((last.afa + bw) * 100) / 100;
    last.buchwert = 0;
  }
  return plan;
}
/* AfA-Zeile eines Kalenderjahres. */
function afaImJahr(anlage, jahr) {
  var p = afaPlan(anlage), i;
  for (i = 0; i < p.length; i++) if (p[i].jahr === jahr) return p[i];
  if (p.length && jahr > p[p.length - 1].jahr) return { jahr: jahr, monate: 0, afa: 0, buchwert: 0 };
  return { jahr: jahr, monate: 0, afa: 0, buchwert: Berechnung.num(anlage.anschaffungskosten) };
}
/* kumulierte AfA bis einschließlich Jahresende. */
function afaKumuliert(anlage, jahr) {
  var s = 0;
  afaPlan(anlage).forEach(function (z) { if (z.jahr <= jahr) s += z.afa; });
  return Math.round(s * 100) / 100;
}
/* AfA-Verlauf einer Anlage als Tabelle. */
function afaVerlaufHtml(an) {
  var p = afaPlan(an);
  if (!p.length) return '<div class="karte-hint">Unvollständige Angaben — kein AfA-Plan.</div>';
  var h = '<table class="liste"><thead><tr><th>Jahr</th><th>Monate</th>' +
    '<th class="rechts">AfA</th><th class="rechts">Buchwert Jahresende</th></tr></thead><tbody>';
  p.forEach(function (z) {
    h += '<tr><td class="mono">' + z.jahr + '</td><td class="mono">' + z.monate + '</td>' +
      '<td class="rechts mono">' + geld(z.afa) + '</td>' +
      '<td class="rechts mono">' + geld(z.buchwert) + '</td></tr>';
  });
  return h + '</tbody></table>';
}
/* Anlagenspiegel eines Geschäftsjahres (§ 284 Abs. 3 HGB). */
function anlagenspiegelHtml(jahr) {
  var anlagen = (S.unternehmen && S.unternehmen.anlagen) || [];
  if (!anlagen.length) return '<div class="karte-hint">Keine Anlagegüter erfasst.</div>';
  var t = { ak: 0, kumA: 0, afa: 0, kumE: 0, bw: 0 }, zeilen = '';
  anlagen.forEach(function (an) {
    var aJahr = parseInt(String(an.anschaffungsdatum || '').slice(0, 4), 10);
    if (aJahr && jahr < aJahr) return;                 // noch nicht im Bestand
    var ak = Berechnung.num(an.anschaffungskosten);
    var kumA = afaKumuliert(an, jahr - 1);
    var afa = afaImJahr(an, jahr).afa;
    var kumE = afaKumuliert(an, jahr);
    var bw = afaImJahr(an, jahr).buchwert;
    t.ak += ak; t.kumA += kumA; t.afa += afa; t.kumE += kumE; t.bw += bw;
    zeilen += '<tr><td>' + esc(an.bezeichnung || '') + '</td>' +
      '<td class="rechts mono">' + geld(ak) + '</td>' +
      '<td class="rechts mono">' + geld(kumA) + '</td>' +
      '<td class="rechts mono">' + geld(afa) + '</td>' +
      '<td class="rechts mono">' + geld(kumE) + '</td>' +
      '<td class="rechts mono">' + geld(bw) + '</td></tr>';
  });
  if (!zeilen) return '<div class="karte-hint">Im Jahr ' + jahr + ' kein Anlagegut im Bestand.</div>';
  return '<table class="liste" style="margin-top:10px"><thead><tr><th>Anlagegut</th>' +
    '<th class="rechts">Anschaffungskosten</th><th class="rechts">kum. AfA Anfang</th>' +
    '<th class="rechts">AfA ' + jahr + '</th><th class="rechts">kum. AfA Ende</th>' +
    '<th class="rechts">Buchwert Ende</th></tr></thead><tbody>' + zeilen +
    '<tr class="zeile-summe"><td>Summe</td>' +
    '<td class="rechts mono">' + geld(t.ak) + '</td>' +
    '<td class="rechts mono">' + geld(t.kumA) + '</td>' +
    '<td class="rechts mono">' + geld(t.afa) + '</td>' +
    '<td class="rechts mono">' + geld(t.kumE) + '</td>' +
    '<td class="rechts mono">' + geld(t.bw) + '</td></tr></tbody></table>';
}
/* Erzeugt die AfA-Buchungen des Geschäftsjahres in einem Jahresabschluss. */
function afaBuchungenErzeugen(jaId, m) {
  Store.ladeAbschluss(jaId).then(function (ja) {
    if (!ja) { alert('Jahresabschluss konnte nicht geladen werden.'); return; }
    var jahr = parseInt(String(ja.gjBis || ja.stichtag || '').slice(0, 4), 10);
    if (!jahr) { alert('Der Jahresabschluss hat kein Geschäftsjahr.'); return; }
    var anlagen = (S.unternehmen && S.unternehmen.anlagen) || [];
    ja.buchungen = ja.buchungen || [];
    ja.protokoll = ja.protokoll || [];
    var neu = 0, stamp = Date.now();
    anlagen.forEach(function (an, i) {
      var z = afaImJahr(an, jahr);
      if (!(z.afa > 0)) return;
      var quelle = (an.id || ('idx' + i)) + ':' + jahr;
      if (ja.buchungen.some(function (b) { return b.afaQuelle === quelle; })) return;
      ja.buchungen.push({
        id: 'B-AfA-' + stamp + '-' + i, datum: ja.gjBis || ja.stichtag,
        betrag: z.afa, text: 'Abschreibung ' + (an.bezeichnung || an.konto || '') + ' ' + jahr,
        soll: afaKontoZu(an.konto), haben: an.konto, afaQuelle: quelle
      });
      neu++;
    });
    if (!neu) {
      alert('Keine neuen AfA-Buchungen für ' + jahr + ' — entweder keine Abschreibung ' +
        'in diesem Jahr oder bereits gebucht.');
      return;
    }
    ja.protokoll.push({ zeit: new Date().toISOString(),
      text: neu + ' AfA-Buchung(en) aus dem Anlagenverzeichnis übernommen' });
    Store.speichereAbschluss(ja).then(function (g) {
      if (g && !g.fehler && S.aktiv && S.aktiv.id === ja.id) S.aktiv = g;
      hinweisToast(neu + ' AfA-Buchung(en) im Jahresabschluss erzeugt. Dort „Salden ' +
        'übernehmen" überträgt sie in Bilanz und GuV.');
    });
  });
}
function renderAnlagen(m) {
  if (!S.unternehmen) { setView('stammdaten'); return; }
  var u = S.unternehmen;
  if (!Array.isArray(u.anlagen)) u.anlagen = [];
  var anlagen = u.anlagen;
  var jahrJetzt = new Date().getFullYear();

  var html = '<div class="kopf"><h1>Anlagenverzeichnis &amp; AfA</h1>' +
    '<p>Anlagegüter mit linearer oder degressiver Abschreibung. Aus dem Verzeichnis ' +
    'entstehen Anlagenspiegel und AfA-Buchungen.</p></div>';
  html += '<div class="box box-info"><b>Abschreibung</b>Anlagegüter werden über ihre ' +
    'Nutzungsdauer abgeschrieben (AfA). Die <b>lineare</b> AfA verteilt die Anschaffungs' +
    'kosten gleichmäßig; die <b>degressive</b> AfA (bewegliche Wirtschaftsgüter, ' +
    'Anschaffung 01.07.2025–31.12.2027) schreibt anfangs mehr ab — höchstens das ' +
    'Dreifache der linearen, gedeckelt auf 30 %. Das erste Jahr wird monatsgenau ' +
    'gerechnet (§ 7 EStG).</div>';

  var kontoOpt = SKR04.KONTEN.filter(function (k) {
    return /^0/.test(k.nr) && (k.pos === 'A.I' || k.pos === 'A.II');
  }).map(function (k) {
    return '<option value="' + k.nr + '">' + k.nr + ' &ndash; ' + esc(k.name) + '</option>';
  }).join('');
  html += '<div class="karte"><h2>Anlagegut erfassen</h2><div class="gitter g3">' +
    feldWrap('Bezeichnung', '', '<input id="anBez">') +
    feldWrap('Anlagekonto (SKR04)', '', '<select id="anKonto">' + kontoOpt + '</select>') +
    feldWrap('Anschaffungsdatum', '', '<input type="date" id="anDatum">') +
    feldWrap('Anschaffungskosten (EUR, netto)', '',
      '<input class="zahl" type="text" inputmode="decimal" id="anAK">') +
    feldWrap('Nutzungsdauer (Jahre)', '', '<input type="number" id="anND" min="1" value="3">') +
    feldWrap('AfA-Methode', '', '<select id="anMethode">' +
      '<option value="linear">linear</option>' +
      '<option value="degressiv">degressiv</option></select>') +
    '</div><div class="btn-reihe"><button class="btn btn-pri" id="anAdd">' +
    'Anlagegut hinzufügen</button></div></div>';

  html += '<div class="karte"><div class="karte-kopf"><div><h2>Anlagegüter</h2>' +
    '<div class="karte-hint">' + anlagen.length + ' Anlagegut(-güter)' +
    (anlagen.length ? ' &middot; Buchwerte zum Jahresende ' + jahrJetzt : '') +
    '</div></div></div>';
  if (!anlagen.length) {
    html += '<div class="karte-hint">Noch keine Anlagegüter erfasst.</div>';
  } else {
    html += '<table class="liste"><thead><tr><th>Bezeichnung</th><th>Konto</th>' +
      '<th>Anschaffung</th><th class="rechts">AK</th><th>ND</th><th>Methode</th>' +
      '<th class="rechts">Buchwert</th><th></th></tr></thead><tbody>';
    anlagen.forEach(function (an, i) {
      html += '<tr><td>' + esc(an.bezeichnung || '') + '</td>' +
        '<td class="mono">' + esc(an.konto || '') + '</td>' +
        '<td class="mono">' + datumDe(an.anschaffungsdatum) + '</td>' +
        '<td class="rechts mono">' + geld(an.anschaffungskosten) + '</td>' +
        '<td class="mono">' + esc(an.nutzungsdauer) + ' J.</td>' +
        '<td>' + (an.methode === 'degressiv' ? 'degressiv' : 'linear') + '</td>' +
        '<td class="rechts mono">' + geld(afaImJahr(an, jahrJetzt).buchwert) + '</td>' +
        '<td class="rechts"><span class="btn btn-sm" data-verlauf="' + i + '">Verlauf</span> ' +
        '<span class="btn btn-sm btn-gefahr" data-andel="' + i + '">löschen</span></td></tr>';
      html += '<tr id="anVerlauf' + i + '" style="display:none"><td colspan="8">' +
        afaVerlaufHtml(an) + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';

  html += '<div class="karte"><h2>Anlagenspiegel <span class="reg">&middot; § 284 Abs. 3 HGB' +
    '</span></h2><div class="gitter g3">' +
    feldWrap('Geschäftsjahr', '', '<input type="number" id="anSpiegelJahr" value="' +
      jahrJetzt + '">') + '</div><div id="anSpiegel"></div></div>';

  var jas = S.abschluesse.filter(function (x) { return x.art === 'JAHRESABSCHLUSS'; });
  html += '<div class="karte"><h2>AfA-Buchungen übernehmen</h2>' +
    '<div class="karte-hint">Erzeugt für jedes Anlagegut die AfA-Buchung des ' +
    'Geschäftsjahres im Buchungsjournal des gewählten Jahresabschlusses (Soll ' +
    'Abschreibungskonto / Haben Anlagekonto). Anschließend dort „Salden übernehmen".</div>';
  if (!jas.length) {
    html += '<div class="karte-hint">Noch kein Jahresabschluss vorhanden.</div>';
  } else {
    html += '<div class="gitter g2">' +
      feldWrap('Jahresabschluss', '', '<select id="anJa">' + jas.map(function (x) {
        return '<option value="' + esc(x.id) + '">' + esc(x.bezeichnung) + '</option>';
      }).join('') + '</select>') +
      '<div style="display:flex;align-items:flex-end"><button class="btn btn-pri" ' +
      'id="anAfaBuchen">AfA-Buchungen erzeugen</button></div></div>';
  }
  html += '</div>';

  m.innerHTML = html;

  m.querySelector('#anAdd').onclick = function () {
    var bez = document.getElementById('anBez').value.trim();
    var ak = Berechnung.num(document.getElementById('anAK').value);
    var datum = document.getElementById('anDatum').value;
    if (!bez) { alert('Bitte eine Bezeichnung eingeben.'); return; }
    if (!ak) { alert('Bitte die Anschaffungskosten eingeben.'); return; }
    if (!datum) { alert('Bitte das Anschaffungsdatum eingeben.'); return; }
    anlagen.push({
      id: 'A-' + Date.now(), bezeichnung: bez,
      konto: document.getElementById('anKonto').value,
      anschaffungsdatum: datum, anschaffungskosten: ak,
      nutzungsdauer: parseInt(document.getElementById('anND').value, 10) || 1,
      methode: document.getElementById('anMethode').value
    });
    Store.speichereUnternehmen(u).then(function (g) {
      if (g && !g.fehler) S.unternehmen = g;
      hinweisToast('Anlagegut hinzugefügt.');
      renderAnlagen(m);
    });
  };
  m.querySelectorAll('[data-verlauf]').forEach(function (el) {
    el.onclick = function () {
      var z = document.getElementById('anVerlauf' + el.dataset.verlauf);
      if (z) z.style.display = z.style.display === 'none' ? '' : 'none';
    };
  });
  m.querySelectorAll('[data-andel]').forEach(function (el) {
    el.onclick = function () {
      if (!confirm('Anlagegut löschen?')) return;
      anlagen.splice(parseInt(el.dataset.andel, 10), 1);
      Store.speichereUnternehmen(u).then(function (g) {
        if (g && !g.fehler) S.unternehmen = g;
        renderAnlagen(m);
      });
    };
  });
  var sj = m.querySelector('#anSpiegelJahr');
  function zeigeSpiegel() {
    document.getElementById('anSpiegel').innerHTML =
      anlagenspiegelHtml(parseInt(sj.value, 10) || jahrJetzt);
  }
  sj.addEventListener('input', zeigeSpiegel);
  zeigeSpiegel();
  var ab = m.querySelector('#anAfaBuchen');
  if (ab) ab.onclick = function () {
    afaBuchungenErzeugen(m.querySelector('#anJa').value, m);
  };
}

/* ===========================================================================
 * GoBD-VERFAHRENSDOKUMENTATION
 * ---------------------------------------------------------------------------
 * Geführter Fragebogen: die unternehmensspezifischen Angaben werden erfasst,
 * der Rest ist vorformuliert. Ergebnis ist ein druckbares Dokument.
 * ========================================================================= */
function verfahrensDok(u) {
  var v = u.verfahrensdoku || {};
  function f(key, fallback) { return esc(v[key] || fallback || '—'); }
  var h = '<h1>' + esc(u.name || 'Unternehmen') + '</h1>';
  h += '<div class="dok-sub">' + esc((u.plz || '') + ' ' + (u.ort || '')) +
    (u.hrNummer ? ' &middot; ' + esc(u.hrNummer) : '') + '</div>';
  h += '<h1 style="margin-top:14px">Verfahrensdokumentation</h1>';
  h += '<div class="dok-sub">zur ordnungsmäßigen Buchführung nach den GoBD' +
    ' &middot; Stand ' + datumDe(new Date().toISOString().slice(0, 10)) + '</div>';
  h += '<h2>1. Allgemeines</h2><p>Diese Verfahrensdokumentation beschreibt das ' +
    'Verfahren der Buchführung und Belegverarbeitung der ' +
    esc(u.name || 'Gesellschaft') + ' nach den Grundsätzen zur ordnungsmäßigen ' +
    'Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in ' +
    'elektronischer Form sowie zum Datenzugriff (GoBD).</p>';
  h += '<h2>2. Belegwesen</h2>' +
    '<p><b>Verantwortlich für Belegerfassung und Buchführung:</b> ' +
    f('verantwortlich') + '</p>' +
    '<p><b>Erfassung und Behandlung der Belege:</b> ' +
    f('belegerfassung', 'Eingehende und ausgehende Belege werden zeitnah und ' +
      'vollständig erfasst und mit den Buchungen verknüpft.') + '</p>' +
    '<p><b>Ablage der Belege:</b> ' + f('belegablage') + '</p>';
  h += '<h2>3. Buchführung</h2>' +
    '<p><b>Eingesetzte Software:</b> ' + f('software', 'OpenBilanz') + '</p>' +
    '<p><b>Kontenrahmen:</b> ' + f('kontenrahmen', 'SKR04') + '</p>' +
    '<p>Die Buchungssätze werden im Buchungsjournal erfasst. Nach Abschluss ' +
    'eines Zeitraums werden die Buchungen <b>festgeschrieben</b>; festgeschriebene ' +
    'Buchungen sind unveränderlich und nicht mehr löschbar. Korrekturen erfolgen ' +
    'ausschließlich über <b>Stornobuchungen</b>; jede Festschreibung und jeder ' +
    'Storno wird im Änderungsprotokoll vermerkt (§ 146 Abs. 4 AO).</p>';
  h += '<h2>4. Datensicherung und IT</h2>' +
    '<p><b>Datensicherung — Ort und Rhythmus:</b> ' + f('datensicherung') + '</p>' +
    '<p>Die Daten werden lokal gehalten; eine vollständige Sicherungsdatei wird ' +
    'exportiert und an einem getrennten Ort aufbewahrt.</p>';
  h += '<h2>5. Aufbewahrung</h2>' +
    '<p><b>Aufbewahrungsort der Unterlagen:</b> ' + f('aufbewahrungsort') + '</p>' +
    '<p>Es gelten die gesetzlichen Aufbewahrungsfristen: 10 Jahre für ' +
    'Jahresabschlüsse, Eröffnungsbilanzen und Inventare, 8 Jahre für ' +
    'Buchungsbelege, 6 Jahre für Handels- und Geschäftsbriefe (§ 257 HGB, ' +
    '§ 147 AO).</p>';
  h += '<h2>6. Internes Kontrollsystem</h2><p>' +
    f('iks', 'Die erfassten Buchungen werden auf Vollständigkeit und Richtigkeit ' +
      'geprüft; die Bilanzgleichung wird laufend kontrolliert.') + '</p>';
  h += '<div class="dok-fuss">Erstellt mit OpenBilanz. Die Verfahrens' +
    'dokumentation ist bei Verfahrensänderungen fortzuschreiben.</div>';
  return h;
}
function renderVerfahrensdoku(m) {
  if (!S.unternehmen) { setView('stammdaten'); return; }
  var u = S.unternehmen;
  u.verfahrensdoku = u.verfahrensdoku || {};
  var v = u.verfahrensdoku;
  function fld(key, label, sub, typ) {
    var val = v[key] || '';
    if (typ === 'area') {
      return feldWrap(label, sub, '<textarea data-vd="' + key + '">' + esc(val) +
        '</textarea>');
    }
    return feldWrap(label, sub, '<input data-vd="' + key + '" value="' + esc(val) + '">');
  }
  var html = '<div class="kopf no-print"><h1>Verfahrensdokumentation</h1>' +
    '<p>Geführter Fragebogen für die GoBD-Verfahrensdokumentation.</p></div>';
  html += '<div class="box box-info no-print"><b>GoBD</b>Die GoBD verlangen eine ' +
    'Verfahrensdokumentation, die das Buchführungs- und Belegverfahren ' +
    'nachvollziehbar beschreibt. Die folgenden Angaben füllen die ' +
    'unternehmensspezifischen Teile; der Rest ist vorformuliert.</div>';
  html += '<div class="karte no-print"><h2>Angaben</h2><div class="gitter g2">' +
    fld('verantwortlich', 'Verantwortlich für Belegerfassung und Buchführung',
      'z. B. die Geschäftsführung') +
    fld('belegablage', 'Ablageort der Belege', 'z. B. Ordner, DMS, Cloud') +
    fld('software', 'Eingesetzte Software', 'Standard: OpenBilanz') +
    fld('kontenrahmen', 'Kontenrahmen', 'SKR04 oder SKR03') +
    fld('datensicherung', 'Datensicherung — Ort und Rhythmus',
      'z. B. .obz-Datei wöchentlich auf externe Platte') +
    fld('aufbewahrungsort', 'Aufbewahrungsort der Unterlagen', '') +
    '</div><div class="gitter" style="margin-top:12px">' +
    fld('belegerfassung', 'Erfassung und Behandlung der Belege', '', 'area') +
    fld('iks', 'Internes Kontrollsystem', '', 'area') +
    '</div><div class="btn-reihe"><button class="btn btn-pri" id="vdSpeichern">' +
    'Speichern &amp; aktualisieren</button></div></div>';
  html += '<div class="btn-reihe no-print"><button class="btn btn-pri" id="vdDruck">' +
    'Drucken / als PDF speichern</button></div>';
  html += '<div class="dok">' + verfahrensDok(u) + '</div>';
  m.innerHTML = html;
  m.querySelector('#vdSpeichern').onclick = function () {
    m.querySelectorAll('[data-vd]').forEach(function (el) { v[el.dataset.vd] = el.value; });
    Store.speichereUnternehmen(u).then(function (g) {
      if (g && !g.fehler) S.unternehmen = g;
      hinweisToast('Verfahrensdokumentation gespeichert.');
      renderVerfahrensdoku(m);
    });
  };
  m.querySelector('#vdDruck').onclick = function () { window.print(); };
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
