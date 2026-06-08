/* ===========================================================================
 * app.js  -  Oberfläche der OpenBilanz
 * ========================================================================= */
'use strict';

/* ---- Zustand ----------------------------------------------------------- */
var S = { unternehmen: null, abschluesse: [], aktiv: null, view: 'start', erklaerungen: true,
          mandanten: [], aktiverMandant: 'standard' };

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
/* ISO-Zeitstempel als „TT.MM.JJJJ HH:MM". */
function zeitstempelDe(iso) {
  if (!iso) return '–';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return datumDe(String(iso).slice(0, 10));
  return datumDe(String(iso).slice(0, 10)) + ' ' +
    ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
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
  var box = document.getElementById('dialogBox');
  box.innerHTML = html;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  document.getElementById('dialog').hidden = false;
  var fokus = box.querySelector('input, select, textarea, button');
  if (fokus) { try { fokus.focus(); } catch (e) {} }
}
function dialogZu() { document.getElementById('dialog').hidden = true; }

/* ---- Barrierefreiheit (WCAG 2.1/2.2) ---------------------------------- */
/* Klickbare Nicht-Button-Elemente (Span-Buttons, Nav, Kacheln) per Tastatur
 * bedienbar machen: tabindex + role. Idempotent - nach jedem Rendern aufrufbar. */
function barrierefrei() {
  var els = document.querySelectorAll('span.btn, .nav-item, .nav-unter, .kachel, .zurueck');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (el.tagName === 'BUTTON' || el.tagName === 'A') continue;
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  }
}
/* ---- Onboarding-Tour (3 Schritte beim ersten Start) ------------------- */
function zeigeOnboardingGesucht() {
  try { return !localStorage.getItem('ob.onboarding'); }
  catch (e) { return true; }
}
function markiereOnboardingGesehen() {
  try { localStorage.setItem('ob.onboarding', '1'); } catch (e) {}
}
function zeigeOnboarding(fertig) {
  var schritte = [
    {
      titel: 'Willkommen bei OpenBilanz',
      text: 'Selbstmach-Tool für die Buchhaltung einer GmbH — Eröffnungsbilanz, ' +
        'Jahresabschluss, E-Bilanz. Drei kurze Hinweise zur Bedienung, dann geht es los.'
    },
    {
      titel: '1. Direkteingabe oder Buchhaltung',
      text: 'Zwei Erfassungswege: <b>Direkteingabe</b> der Bilanzposten (gut für die ' +
        'Eröffnungsbilanz und feste Zahlen) oder die laufende <b>Buchhaltung</b> nach ' +
        'SKR04 mit automatischer Salden-Übernahme in Bilanz/GuV.'
    },
    {
      titel: '2. Festschreiben + Prüfkette',
      text: 'Buchungen lassen sich <b>festschreiben</b> (§ 146 AO) — danach unveränderlich, ' +
        'Korrektur nur per Stornobuchung. Die <b>Prüfkette</b> (SHA-256) erkennt jede ' +
        'nachträgliche Manipulation.'
    },
    {
      titel: '3. Befehlssuche Cmd/Ctrl+K',
      text: 'Mit <b>Cmd/Ctrl+K</b> öffnet sich jederzeit eine Befehlssuche: Reiter, ' +
        'SKR04-Konten und Glossarbegriffe direkt anspringen — schneller als die Navigation.'
    }
  ];
  var idx = 0;
  function rendere() {
    var s = schritte[idx];
    var letzter = idx === schritte.length - 1;
    dialog(
      '<h2 style="margin-top:0">' + esc(s.titel) + '</h2>' +
      '<div style="margin-bottom:12px">' + s.text + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">' +
      '<span class="bu-tag" style="margin-right:auto">' + (idx + 1) + ' / ' + schritte.length + '</span>' +
      (idx > 0 ? '<button class="btn" id="obZurueck">Zurück</button>' : '') +
      '<button class="btn btn-pri" id="obWeiter">' +
      (letzter ? 'Loslegen' : 'Weiter') + '</button>' +
      '<button class="btn" id="obSkip">Überspringen</button>' +
      '</div>'
    );
    document.getElementById('obWeiter').onclick = function () {
      if (letzter) {
        markiereOnboardingGesehen();
        dialogZu();
        if (fertig) fertig();
      } else {
        idx++; rendere();
      }
    };
    var z = document.getElementById('obZurueck');
    if (z) z.onclick = function () { idx--; rendere(); };
    document.getElementById('obSkip').onclick = function () {
      markiereOnboardingGesehen();
      dialogZu();
      if (fertig) fertig();
    };
  }
  rendere();
}

/* Einmalig: Mausrad in .zahl-Inputs erhöht/verringert den Betrag.
 * Default ±1, Shift ±10, Alt ±0,1, Ctrl/Meta ±100. */
function installMausrad() {
  document.addEventListener('wheel', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'INPUT' || !el.classList || !el.classList.contains('zahl')) return;
    if (document.activeElement !== el) return;  // nur im fokussierten Feld
    e.preventDefault();
    var schritt = 1;
    if (e.shiftKey) schritt = 10;
    if (e.altKey) schritt = 0.1;
    if (e.ctrlKey || e.metaKey) schritt = 100;
    var richtung = e.deltaY < 0 ? 1 : -1;
    var akt = Berechnung.num(el.value);
    var neu = akt + richtung * schritt;
    el.value = String(Math.round(neu * 100) / 100).replace('.', ',');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { passive: false });
}

/* Einmalig: Enter/Leertaste aktiviert fokussierte Span-Buttons, Escape
 * schließt einen offenen Dialog, Cmd/Ctrl+K öffnet die Befehlssuche. */
function installTastatur() {
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var dlg = document.getElementById('dialog');
      if (dlg && !dlg.hidden) { dialogZu(); return; }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      oeffneCommandPalette();
      return;
    }
    /* Alt+1..9: schneller Mandanten-Wechsel (Welle 7). */
    if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
      var liste = S.mandanten || [];
      var ziel = liste[parseInt(e.key, 10) - 1];
      if (ziel) { e.preventDefault(); mandantWechseln(ziel.id); }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      var el = e.target, t = el && el.tagName;
      if (!el || !el.classList) return;
      if (t === 'BUTTON' || t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || t === 'A') return;
      if (el.classList.contains('btn') || el.classList.contains('nav-item') ||
          el.classList.contains('nav-unter') || el.classList.contains('kachel') ||
          el.classList.contains('zurueck')) {
        e.preventDefault();
        el.click();
      }
    }
  });
}

/* ---- Command-Palette (Cmd/Ctrl+K) ------------------------------------- */
/* Sammelt alle erreichbaren Aktionen (Reiter, Abschlüsse, Konten,
 * Glossar-Begriffe) als Eintrag-Liste und filtert per Fuzzy-Match. */
function commandPaletteEintraege() {
  var ein = [];
  function add(label, sub, aktion, kat) {
    ein.push({ label: label, sub: sub, kategorie: kat || '', aktion: aktion });
  }
  add('Startseite', 'Übersicht', function () { setView('start'); }, 'Reiter');
  add('Unternehmensdaten', 'Stammdaten', function () { setView('stammdaten'); }, 'Reiter');
  add('Kunden', 'Stammdaten', function () { setView('kunden'); }, 'Reiter');
  add('Anlagenverzeichnis', 'Stammdaten · AfA', function () { setView('anlagen'); }, 'Reiter');
  add('Verfahrensdokumentation', 'GoBD', function () { setView('verfahrensdoku'); }, 'Reiter');
  add('Fristen und Pflichten', '§ 264, § 325 HGB', function () { setView('fristen'); }, 'Hilfe');
  add('Buchungshilfe', 'SKR04-Beispiele', function () { setView('hilfe'); }, 'Hilfe');
  add('Glossar', 'HGB, Steuer, E-Bilanz', function () { setView('glossar'); }, 'Hilfe');
  add('Gesellschafterbeschlüsse', 'GmbHG', function () { setView('beschluesse'); }, 'Hilfe');

  if (S.aktiv) {
    var bez = S.aktiv.bezeichnung || S.aktiv.stichtag || '';
    var istEB = S.aktiv.art === 'EROEFFNUNGSBILANZ';
    add('Bilanz & GuV bearbeiten', bez, function () { setView('editor'); }, 'Aktiver Abschluss');
    if (!istEB) {
      add('Buchhaltung', bez, function () { setView('buchhaltung'); }, 'Aktiver Abschluss');
      add('Ausgangsrechnungen', bez, function () { setView('rechnungen'); }, 'Aktiver Abschluss');
      add('Steuern (KSt, Soli, GewSt)', bez, function () { setView('steuer'); }, 'Aktiver Abschluss');
      add('Umsatzsteuer (UStVA)', bez, function () { setView('ustva'); }, 'Aktiver Abschluss');
      add('BWA', bez, function () { setView('bwa'); }, 'Aktiver Abschluss');
      add('Kapitalertragsteuer', bez, function () { setView('kapst'); }, 'Aktiver Abschluss');
      add('Offenlegung', bez, function () { setView('offenlegung'); }, 'Aktiver Abschluss');
    }
    add('E-Bilanz', bez, function () { setView('ebilanz'); }, 'Aktiver Abschluss');
    add('Druckansicht', bez, function () { setView('druck'); }, 'Aktiver Abschluss');
  }

  S.abschluesse.forEach(function (a) {
    if (S.aktiv && S.aktiv.id === a.id) return;
    var t = a.art === 'EROEFFNUNGSBILANZ' ? 'Eröffnungsbilanz öffnen' : 'Jahresabschluss öffnen';
    add(a.bezeichnung || a.stichtag || a.id, t,
        function () { mitSpeichern(function () { oeffneAbschluss(a.id); }); },
        'Abschluss');
  });
  add('Neuer Abschluss', 'Eröffnungsbilanz oder Jahresabschluss anlegen',
      function () { dialogNeuerAbschluss(); }, 'Aktion');

  if (typeof SKR04 !== 'undefined') {
    SKR04.alleKonten().forEach(function (k) {
      if (!k || !k.nr) return;
      add(k.nr + ' ' + (k.name || ''), 'SKR04 · ' + (k.seite || ''),
          function () { setView('hilfe'); }, 'Konto');
    });
  }
  if (typeof GLOSSAR !== 'undefined' && GLOSSAR.length) {
    GLOSSAR.forEach(function (b) {
      add(b.t, 'Glossar · ' + b.g, function () {
        setView('glossar');
        setTimeout(function () {
          var inp = document.getElementById('glossarSuche');
          if (inp) { inp.value = b.t; inp.dispatchEvent(new Event('input')); }
        }, 30);
      }, 'Glossar');
    });
  }
  return ein;
}

function oeffneCommandPalette() {
  var eintraege = commandPaletteEintraege();
  var aktiverIndex = 0;
  var lastTreffer = [];

  function renderListe(q) {
    lastTreffer = Palette.suche(eintraege, q, 40);
    aktiverIndex = 0;
    var lines = '';
    lastTreffer.forEach(function (e, i) {
      lines += '<div class="pal-item' + (i === 0 ? ' aktiv' : '') +
        '" data-idx="' + i + '">' +
        '<div class="pal-label">' + esc(e.label) + '</div>' +
        (e.sub ? '<div class="pal-sub">' + esc(e.sub) + '</div>' : '') +
        '</div>';
    });
    var meta = '<div class="pal-meta">' + lastTreffer.length + ' Treffer' +
      (eintraege.length > lastTreffer.length ? ' von ' + eintraege.length : '') + '</div>';
    document.getElementById('palErgebnisse').innerHTML = meta +
      '<div id="palListe" class="pal-liste">' + lines + '</div>';
    document.querySelectorAll('.pal-item').forEach(function (el, i) {
      el.onmouseenter = function () { setzeAktiv(i); };
      el.onclick = function () { waehleAktuellen(); };
    });
  }
  function setzeAktiv(i) {
    aktiverIndex = i;
    var items = document.querySelectorAll('.pal-item');
    items.forEach(function (el, k) {
      if (k === i) el.classList.add('aktiv'); else el.classList.remove('aktiv');
    });
    if (items[i]) items[i].scrollIntoView({ block: 'nearest' });
  }
  function waehleAktuellen() {
    var sel = lastTreffer[aktiverIndex];
    if (!sel) return;
    dialogZu();
    try { sel.aktion(); } catch (e) {}
  }

  dialog(
    '<h2 style="margin-top:0">Befehlssuche</h2>' +
    '<div class="pal-hint">Pfeil &uarr;&darr; navigieren · Enter wählen · Esc schließt</div>' +
    '<input id="palQuery" type="search" placeholder="Tippe Reiter, Konto, Begriff …" ' +
    'autocomplete="off" spellcheck="false" />' +
    '<div id="palErgebnisse"></div>'
  );
  var inp = document.getElementById('palQuery');
  inp.oninput = function () { renderListe(inp.value); };
  inp.onkeydown = function (e) {
    if (e.key === 'Enter') { e.preventDefault(); waehleAktuellen(); }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (lastTreffer.length) setzeAktiv((aktiverIndex + 1) % lastTreffer.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (lastTreffer.length) setzeAktiv((aktiverIndex - 1 + lastTreffer.length) % lastTreffer.length);
    }
  };
  renderListe('');
  inp.focus();
}

/* ---- Start ------------------------------------------------------------- */
function boot() {
  installTastatur();
  installMausrad();
  // Sichtbare Versionsanzeige in der Seitenleiste (Deploy-Verifikation).
  var vEl = document.getElementById('appVersion');
  if (vEl && typeof Version !== 'undefined') {
    vEl.textContent = 'v' + Version.app + ' (' + Version.commit + ')';
  }
  Store.ladeState().then(function (st) {
    S.unternehmen = st.unternehmen;
    S.abschluesse = st.abschluesse || [];
    S.mandanten = st.mandanten || [];
    S.aktiverMandant = st.aktiverMandant || (Store.getMandant ? Store.getMandant() : 'standard');
    renderNav();
    initBackupUI();
    if (pruefeDemoLink()) return;          // Deep-Link ?demo öffnet das Demo-Portal
    if (!S.unternehmen) {
      // Erster Start ohne Daten -> Onboarding-Tour, dann Stammdaten
      if (zeigeOnboardingGesucht()) {
        zeigeOnboarding(function () { setView('stammdaten'); });
      } else {
        setView('stammdaten');
      }
    } else {
      setView('start');
    }
    pruefeMigrationHinweis();   // Welle 7: nach v1->v2-IDB-Migration einmalig Backup empfehlen
  });
  if (Store.modus === 'website' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  ladeRechtlicheLinks();
}

/* Deep-Link-Einstieg fürs Demo-Portal: Wird die App mit ?demo geöffnet (über
 * den Demo-Portal-Button der Website), holt sie den Beispiel-Datensatz als
 * .obz-Sicherung vom Server und importiert ihn still in den Browser - so, als
 * hätte der Nutzer ein Backup eingespielt. Liegen bereits Daten vor, wird
 * NICHTS überschrieben. Gibt true zurück, wenn der Parameter greift. */
function pruefeDemoLink() {
  var hatDemo = false;
  try { hatDemo = new URLSearchParams(location.search).has('demo'); }
  catch (e) { hatDemo = false; }
  if (!hatDemo) return false;
  // Parameter aus der Adresszeile entfernen - ein Reload soll nicht erneut laden.
  if (window.history && history.replaceState) {
    history.replaceState({}, '', location.pathname);
  }
  // Nur im Website-Modus: stiller Import in die Browser-Datenbank.
  if (!Store.schreibeSnapshot) { setView('start'); return true; }
  if (S.unternehmen || S.abschluesse.length) {
    setView('start');
    hinweisToast('Es liegen bereits Daten vor — die Demo wurde nicht geladen.');
    return true;
  }
  fetch('/demo/lindgruen.obz')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then(function (buf) { return OBZ.entpacken(buf, function () { return ''; }); })
    .then(function (snapshot) { return Store.schreibeSnapshot(snapshot); })
    .then(function () { hinweisToast('Demo-Daten geladen.'); boot(); })
    .catch(function () {
      hinweisToast('Demo-Daten konnten nicht geladen werden.');
      setView('start');
    });
  return true;
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
  var mList = S.mandanten || [];
  var mOpts = mList.length
    ? mList.map(function (m) {
        return '<option value="' + esc(m.id) + '"' +
          (m.id === S.aktiverMandant ? ' selected' : '') + '>' + esc(m.name || m.id) + '</option>';
      }).join('')
    : '<option value="standard" selected>Standard</option>';
  n.push('<div class="nav-grp">Mandant</div>');
  n.push('<div class="nav-mandant" style="display:flex;gap:6px;padding:2px 10px 8px">' +
    '<select id="mandantWahl" style="flex:1;min-width:0" ' +
    'title="Aktiven Mandanten wählen (Alt+1..9)">' + mOpts + '</select>' +
    '<button class="btn" id="mandantNeu" style="padding:2px 10px" ' +
    'title="Neuen Mandanten anlegen">+</button></div>');
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
      if (!istEB) n.push(navUnter('rechnungen', 'Ausgangsrechnungen'));
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
  n.push(navItem('kunden', '☺', 'Kunden'));
  n.push(navItem('anlagen', '▦', 'Anlagenverzeichnis'));
  n.push(navItem('verfahrensdoku', '✎', 'Verfahrensdokumentation'));
  n.push('<div class="nav-grp">Hilfe</div>');
  n.push(navItem('fristen', '⚠', 'Fristen &amp; Pflichten'));
  n.push(navItem('hilfe', '?', 'Buchungshilfe'));
  n.push(navItem('glossar', '≡', 'Glossar'));
  n.push(navItem('beschluesse', '§', 'Gesellschafterbeschlüsse'));
  document.getElementById('nav').innerHTML = n.join('');

  var mw = document.getElementById('mandantWahl');
  if (mw) mw.onchange = function () { mandantWechseln(mw.value); };
  var mn = document.getElementById('mandantNeu');
  if (mn) mn.onclick = dialogNeuerMandant;

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
  barrierefrei();
}
function navUnter(view, label) {
  return '<div class="nav-unter' + (S.view === view ? ' aktiv' : '') +
         '" data-sub="' + view + '">' + label + '</div>';
}
/* ---- Mandanten-Wechsel/-Anlegen (Welle 7) ---------------------------- */
function ladeMandantState(fallbackId, zielView) {
  return Store.ladeState().then(function (st) {
    S.unternehmen = st.unternehmen;
    S.abschluesse = st.abschluesse || [];
    S.mandanten = st.mandanten || S.mandanten;
    S.aktiverMandant = st.aktiverMandant || fallbackId;
    renderNav();
    setView(zielView || (S.unternehmen ? 'start' : 'stammdaten'));
  });
}
function mandantWechseln(id) {
  if (!id || id === S.aktiverMandant) return;
  mitSpeichern(function () {
    if (Store.setMandant) Store.setMandant(id);
    S.aktiv = null;
    ladeMandantState(id);
  });
}
function dialogNeuerMandant() {
  dialog('<h3>Neuer Mandant</h3>' +
    '<p class="karte-hint">Eine weitere Firma/Gesellschaft anlegen. Jeder Mandant hat ' +
    'eigene Stammdaten und Abschlüsse; gespeicherte Daten bleiben getrennt.</p>' +
    feldWrap('Name', 'z. B. Zweite GmbH', '<input id="nmName" autocomplete="off">') +
    '<div class="btn-reihe"><button class="btn btn-pri" id="nmOk">Anlegen</button>' +
    '<button class="btn" id="nmAb">Abbrechen</button></div>');
  document.getElementById('nmAb').onclick = dialogZu;
  document.getElementById('nmOk').onclick = function () {
    var name = (document.getElementById('nmName').value || '').trim();
    if (!name) return;
    dialogZu();
    Store.mandantAnlegen(name).then(function (r) {
      if (r && r.ok === false) { hinweisToast('Diesen Mandanten gibt es schon.'); return; }
      var neuId = (r && r.id) || name;
      if (Store.setMandant) Store.setMandant(neuId);
      S.aktiv = null;
      ladeMandantState(neuId, 'stammdaten').then(function () {
        hinweisToast('Mandant „' + name + '" angelegt.');
      });
    });
  };
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
/* Welle 7 (W3): Nach der einmaligen IDB-v1->v2-Migration (Einbahn, kein Auto-
 * Backup im Browser) EINMALIG zum Backup-Export raten. Das Flag wird in
 * store-idb.js onupgradeneeded gesetzt und hier nach Anzeige geloescht. */
function pruefeMigrationHinweis() {
  if (!Store.getMeta) return;                      /* nur Website-Modus (IndexedDB) */
  Store.getMeta('mandantenMigrationHinweis').then(function (flag) {
    if (!flag) return;
    Store.setMeta('mandantenMigrationHinweis', null);   /* nur einmal zeigen */
    dialog('<h3>Daten aktualisiert</h3>' +
      '<p>OpenBilanz unterstützt jetzt mehrere Mandanten. Ihre vorhandenen Daten wurden ' +
      'automatisch dem Mandanten &bdquo;Standard&ldquo; zugeordnet &ndash; es geht nichts ' +
      'verloren.</p>' +
      '<div class="box box-warn"><b>Empfehlung</b>Diese Aktualisierung der Browser-Datenbank ' +
      'lässt sich technisch nicht rückgängig machen. Exportieren Sie zur Sicherheit jetzt ' +
      'einmal ein Backup (.obz).</div>' +
      '<div class="btn-reihe"><button class="btn btn-pri" id="mhExport">Backup exportieren</button>' +
      '<button class="btn" id="mhSpaeter">Später</button></div>');
    var ex = document.getElementById('mhExport'), sp = document.getElementById('mhSpaeter');
    if (sp) sp.onclick = dialogZu;
    if (ex) ex.onclick = function () { dialogZu(); exportiereBackup(); };
  }, function () {});
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
  else if (view === 'assistent')  renderAssistent(m);
  else if (view === 'druck')      renderDruck(m);
  else if (view === 'ebilanz')    renderEbilanz(m);
  else if (view === 'offenlegung')renderOffenlegung(m);
  else if (view === 'steuer')     renderSteuer(m);
  else if (view === 'buchhaltung')renderBuchhaltung(m);
  else if (view === 'kunden')     renderKunden(m);
  else if (view === 'rechnungen') renderRechnungen(m);
  else if (view === 'ustva')      renderUstva(m);
  else if (view === 'bwa')        renderBwa(m);
  else if (view === 'kapst')      renderKapst(m);
  else if (view === 'fristen')    renderFristen(m);
  else if (view === 'hilfe')      renderHilfe(m);
  else if (view === 'glossar')    renderGlossar(m);
  else if (view === 'beschluesse')renderBeschluesse(m);
  barrierefrei();
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
  /* „löschen" je Abschluss nur, wenn in den Unternehmensdaten freigeschaltet */
  var loeschbar = !!(S.unternehmen && S.unternehmen.loeschenAktiv);
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

  // Health-Check-Banner: Stammdaten, Abschlüsse, letztes Backup
  var letzteBuchung = null;
  S.abschluesse.forEach(function (x) {
    var max = (x.buchungenStichproben && x.buchungenStichproben.letzteBuchung) || null;
    if (max && (!letzteBuchung || max > letzteBuchung)) letzteBuchung = max;
  });
  // Health-Banner sofort mit synchronen Infos rendern; Backup-Stand asynchron nachladen.
  html += '<div id="healthBanner" class="karte" style="margin-top:14px"><h2>Status</h2>' +
    '<div id="healthListe" class="karte-hint">wird ermittelt …</div></div>';

  // Drohende Fristen-Box (rot + gelb), wenn vorhanden
  if (S.abschluesse.length) {
    var akut = Fristen.naechsteFristen(S.unternehmen, S.abschluesse).filter(function (f) {
      return f.ampel === 'rot' || f.ampel === 'gelb';
    }).slice(0, 4);
    if (akut.length) {
      html += '<div class="box box-warn" style="margin-top:14px"><b>Drohende Fristen</b>';
      akut.forEach(function (f) {
        var farbe = f.ampel === 'rot' ? '#c14545' : '#e3b341';
        var dot = '<span style="display:inline-block;width:9px;height:9px;' +
          'border-radius:50%;background:' + farbe + ';margin-right:6px"></span>';
        var rest = f.restTage < 0
          ? '<b>' + (-f.restTage) + ' Tage überfällig</b>'
          : 'in ' + f.restTage + ' Tagen';
        html += '<div style="margin-top:4px">' + dot + esc(f.titel) +
          ' &middot; ' + rest + ' &middot; ' + esc(f.frist) + '</div>';
      });
      html += '<div style="margin-top:8px"><span class="btn btn-sm" data-fristenlink="1">' +
        'Alle Fristen ansehen</span></div></div>';
    }
  }

  // Zeitleiste je Mandant: EB -> JA -> JA in zeitlicher Folge (Welle 7, c).
  if (S.abschluesse.length) {
    html += '<div class="karte" style="margin-top:18px"><h2>Zeitleiste</h2>' +
      '<div class="karte-hint">Abschlüsse dieses Mandanten in zeitlicher Folge &ndash; ' +
      'zum Öffnen anklicken.</div>' +
      '<div class="zeitleiste" style="display:flex;flex-wrap:wrap;align-items:center;' +
      'gap:8px;margin-top:12px">';
    S.abschluesse.forEach(function (a, i) {
      if (i) html += '<span style="opacity:.45">&rarr;</span>';
      var istEB = a.art === 'EROEFFNUNGSBILANZ';
      var jahr = (a.stichtag || '').slice(0, 4) || '–';
      var fest = a.status === 'FESTGESTELLT';
      html += '<span class="tag ' + (istEB ? 'tag-eb' : 'tag-ja') + '" data-oeffne="' + a.id +
        '" style="cursor:pointer' + (fest ? '' : ';opacity:.7') + '" title="' +
        esc(a.bezeichnung || '') + (fest ? ' (festgestellt)' : ' (Entwurf)') + '">' +
        (istEB ? 'EB ' : 'JA ') + esc(jahr) + '</span>';
    });
    html += '</div></div>';
  }

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
        '<td class="rechts"><span class="btn btn-sm">öffnen</span>' +
        (loeschbar ? ' <span class="btn btn-sm btn-gefahr" data-abdel="' + a.id +
          '">löschen</span>' : '') +
        '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  m.innerHTML = html;
  m.querySelectorAll('[data-oeffne]').forEach(function (el) {
    el.onclick = function () { oeffneAbschluss(el.dataset.oeffne); };
  });
  m.querySelectorAll('[data-abdel]').forEach(function (el) {
    el.onclick = function (ev) {
      ev.stopPropagation();                       // nicht zugleich den Abschluss öffnen
      var id = el.dataset.abdel;
      if (!confirm('Diesen Abschluss endgültig löschen?')) return;
      Store.loescheAbschluss(id).then(function () {
        return Store.ladeState();
      }).then(function (st) {
        S.abschluesse = st.abschluesse || [];
        if (S.aktiv && S.aktiv.id === id) S.aktiv = null;
        renderNav();
        hinweisToast('Abschluss gelöscht.');
        setView('start');
      });
    };
  });
  m.querySelectorAll('[data-fristenlink]').forEach(function (el) {
    el.onclick = function () { setView('fristen'); };
  });

  // Health-Banner asynchron befüllen (Backup-Stand aus Store).
  (function () {
    function rendere(opts) {
      var box = m.querySelector('#healthListe');
      if (!box) return;
      var liste = HealthCheck.pruefe(S.unternehmen, S.abschluesse, opts);
      var farbe = { ok: '#5dc98f', achtung: '#e3b341', info: '#7c91a0' };
      box.innerHTML = '<ul style="margin:0;padding-left:6px;list-style:none">' +
        liste.map(function (p) {
          var c = farbe[p.status] || '#7c91a0';
          var dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;' +
            'background:' + c + ';margin-right:7px;vertical-align:middle"></span>';
          return '<li style="margin:4px 0">' + dot + '<b>' + esc(p.titel) + ':</b> ' +
            esc(p.detail) + '</li>';
        }).join('') + '</ul>';
    }
    var opts = { modus: Store.modus };
    if (Store.modus === 'website' && Store.backupStatus) {
      Store.backupStatus().then(function (b) {
        opts.letzteSicherung = b && b.exportiertAm;
        rendere(opts);
      }, function () { rendere(opts); });
    } else {
      rendere(opts);
    }
  })();
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
/* Felder der Unternehmensdaten, deren Änderungen protokolliert werden. */
var STAMM_FELDER = [
  ['name', 'Firmenname'], ['rechtsform', 'Rechtsform'], ['strasse', 'Straße'],
  ['plz', 'PLZ'], ['ort', 'Ort'], ['registergericht', 'Registergericht'],
  ['hrNummer', 'Handelsregisternummer'], ['finanzamt', 'Finanzamt'],
  ['steuernummer', 'Steuernummer'], ['wirtschaftsidnr', 'Wirtschafts-IdNr.'],
  ['gruendungsdatum', 'Gründungsdatum'], ['geschaeftsjahrTyp', 'Geschäftsjahr'],
  ['stammkapital', 'Stammkapital'], ['guvVerfahrenStandard', 'GuV-Verfahren'],
  ['gmbhTyp', 'Art der Tätigkeit'], ['versteuerungsart', 'USt-Versteuerungsart'],
  ['kleinunternehmer', 'Kleinunternehmer']
];
/* Vergleicht zwei Unternehmens-Stände und liefert lesbare Änderungstexte. */
function stammdatenDiff(alt, neu) {
  function wert(v) { return (v == null || v === '') ? '—' : String(v); }
  var aenderungen = [];
  STAMM_FELDER.forEach(function (f) {
    if (wert(alt[f[0]]) !== wert(neu[f[0]])) {
      aenderungen.push(f[1] + ': „' + wert(alt[f[0]]) + '" → „' + wert(neu[f[0]]) + '"');
    }
  });
  var ga = (alt.geschaeftsfuehrer || []).join(', ');
  var gb = (neu.geschaeftsfuehrer || []).join(', ');
  if (ga !== gb) aenderungen.push('Geschäftsführer: „' + wert(ga) + '" → „' + wert(gb) + '"');
  return aenderungen;
}
/* Löscht ALLE Daten (Unternehmen + sämtliche Abschlüsse) und stellt den leeren
 * Anfangszustand wieder her — funktioniert in beiden Betriebsarten. */
function alleDatenLoeschen() {
  if (Store.schreibeSnapshot) {                 // Website-Modus: ein sauberer Schnitt
    return Store.schreibeSnapshot({ unternehmen: null, abschluesse: [] });
  }
  // Selbst-Hosting: jeden Abschluss und die Unternehmensdatei einzeln entfernen
  var ids = (S.abschluesse || []).map(function (a) { return a.id; });
  return ids.reduce(function (kette, id) {
    return kette.then(function () { return Store.loescheAbschluss(id); });
  }, Promise.resolve()).then(function () {
    return Store.loescheUnternehmen ? Store.loescheUnternehmen() : null;
  });
}
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

  var prot = u.aenderungsprotokoll || [];
  if (prot.length) {
    html += '<div class="karte"><h2>Änderungsprotokoll</h2>' +
      '<div class="karte-hint">Protokollierte Änderungen an den Unternehmensdaten ' +
      '(neueste zuerst). Buchungen sind separat über die GoBD-Festschreibung gesichert.' +
      '</div><table class="liste"><thead><tr><th>Zeitpunkt</th><th>Änderung</th>' +
      '</tr></thead><tbody>';
    prot.slice().reverse().forEach(function (e) {
      html += '<tr><td class="mono">' + esc(zeitstempelDe(e.zeit)) + '</td><td>' +
        (e.aenderungen || []).map(esc).join('<br>') + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  html += '<div class="btn-reihe"><button class="btn btn-pri" id="stammSpeichern">' +
          'Stammdaten speichern</button></div>';

  if (S.unternehmen) {
    var loeschAktiv = !!S.unternehmen.loeschenAktiv;
    html += '<div class="karte"><h2>Löschfunktionen</h2>' +
      '<label class="checkz"><input type="checkbox" id="loeschToggle"' +
      (loeschAktiv ? ' checked' : '') + '>' +
      '<span>Löschen von Abschlüssen erlauben &ndash; blendet einen ' +
      '&bdquo;löschen&ldquo;-Schalter an jedem Abschluss sowie das Zurücksetzen ' +
      'aller Daten ein. Standardmäßig aus, damit nichts versehentlich gelöscht ' +
      'wird.</span></label>';
    if (loeschAktiv) {
      html += '<div class="box box-warn" style="margin-top:12px"><b>Alle Daten ' +
        'zurücksetzen</b>Löscht die Unternehmensdaten und <b>alle</b> Abschlüsse ' +
        'unwiderruflich und stellt den leeren Anfangszustand her &ndash; etwa, um ' +
        'geladene Beispieldaten wieder zu entfernen.</div>' +
        '<div class="btn-reihe"><button class="btn btn-gefahr" id="datenReset">' +
        'Alle Daten löschen</button></div>';
    }
    html += '</div>';
  }
  m.innerHTML = html;

  var loeschToggle = m.querySelector('#loeschToggle');
  if (loeschToggle) loeschToggle.onchange = function () {
    S.unternehmen.loeschenAktiv = loeschToggle.checked;
    Store.speichereUnternehmen(S.unternehmen).then(function (g) {
      if (g && !g.fehler) S.unternehmen = g;
      renderStammdaten(m);
    });
  };
  var datenReset = m.querySelector('#datenReset');
  if (datenReset) datenReset.onclick = function () {
    if (!confirm('Wirklich ALLE Daten löschen — Unternehmensdaten und sämtliche ' +
      'Abschlüsse? Das lässt sich nicht rückgängig machen.')) return;
    alleDatenLoeschen().then(function () {
      S.unternehmen = null; S.abschluesse = []; S.aktiv = null;
      hinweisToast('Alle Daten gelöscht.');
      boot();
    });
  };

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
    var aenderungen = S.unternehmen ? stammdatenDiff(u, neu) : ['Unternehmensdaten angelegt'];
    if (aenderungen.length) {
      neu.aenderungsprotokoll = neu.aenderungsprotokoll || [];
      neu.aenderungsprotokoll.push({ zeit: new Date().toISOString(), aenderungen: aenderungen });
    }
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
/* Kontexthilfe: Begriff mit Glossar-Erklärung als Tooltip (natives title-
 * Attribut, auch von Screenreadern vorgelesen). Findet die Erklärung im
 * GLOSSAR; ohne Treffer wird der Begriff unverändert ausgegeben. */
function gtip(begriff, anzeige) {
  var txt = anzeige || begriff, bl = String(begriff).toLowerCase(), treffer = null;
  for (var i = 0; i < GLOSSAR.length; i++) {
    if (GLOSSAR[i].t.toLowerCase().indexOf(bl) >= 0) { treffer = GLOSSAR[i]; break; }
  }
  return treffer
    ? '<abbr class="gtip" title="' + esc(treffer.e) + '">' + esc(txt) + '</abbr>'
    : esc(txt);
}
function hinweisToast(t) {
  var d = document.createElement('div');
  d.setAttribute('role', 'status');
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
      if (vj) {
        a.vorjahrId = vj.id;
        // Folgt der Jahresabschluss direkt einer unterjährigen Eröffnungsbilanz,
        // ist sein erstes Geschäftsjahr ein Rumpfwirtschaftsjahr: Beginn =
        // Gründungstag (Stichtag der Eröffnungsbilanz), nicht der 01.01.
        if (vj.art === 'EROEFFNUNGSBILANZ' &&
            parseInt(String(vj.stichtag).slice(0, 4), 10) === j &&
            String(vj.stichtag) > j + '-01-01') {
          a.gjVon = vj.stichtag;
          a.bezeichnung = 'Jahresabschluss ' + j + ' (Rumpfgeschäftsjahr)';
        }
      }
    }
    Store.speichereAbschluss(a).then(function (gesp) {
      dialogZu();
      nachSpeichern();
      Store.ladeState().then(function (st) {
        S.abschluesse = st.abschluesse || [];
        S.aktiv = gesp;
        assiSchritt = 0;
        setView(art === 'EROEFFNUNGSBILANZ' ? 'assistent' : 'editor');
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
 * ERFASSUNGS-ASSISTENT  -  geführte Eröffnungsbilanz in kleinen Schritten
 * ---------------------------------------------------------------------------
 * Führt Schritt für Schritt durch Kapital, Aktiva und Passiva einer Eröffnungs-
 * bilanz statt eines großen Formulars. Schreibt direkt in S.aktiv (kapital /
 * werte.aktiva / werte.passiva); zum klassischen Formular ist jederzeit ein
 * Wechsel möglich.
 * ========================================================================= */
var assiSchritt = 0;
var ASSI_SCHRITTE = [
  { titel: 'Kapital der GmbH',
    text: 'Das Stammkapital laut Gesellschaftsvertrag und wie viel davon schon ' +
      'eingezahlt ist. Mindeststammkapital der GmbH: 25.000 €, davon mindestens ' +
      '12.500 € vor der Handelsregister-Anmeldung eingezahlt.',
    felder: [
      { bereich: 'kapital', key: 'gezeichnet',
        label: 'Stammkapital (gezeichnetes Kapital, EUR)', sub: 'Nennbetrag laut Vertrag' },
      { bereich: 'kapital', key: 'eingezahlt',
        label: 'davon bereits eingezahlt (EUR)', sub: 'auf das Geschäftskonto geflossen' },
      { bereich: 'kapital', key: 'eingefordertOffen',
        label: 'eingefordert, aber noch nicht eingezahlt (EUR)', sub: 'meist 0' }
    ]},
  { titel: 'Was besitzt die GmbH? (Aktiva)',
    text: 'Die Vermögenswerte zum Stichtag der Eröffnungsbilanz. Felder, die nicht ' +
      'zutreffen, einfach leer lassen.',
    felder: [
      { bereich: 'aktiva', key: 'B.IV', label: 'Bankguthaben und Kasse (EUR)',
        sub: 'Bilanzposten B.IV' },
      { bereich: 'aktiva', key: 'A.II', label: 'Sachanlagen (EUR)',
        sub: 'Maschinen, Ausstattung, Gebäude — A.II' },
      { bereich: 'aktiva', key: 'A.III', label: 'Finanzanlagen (EUR)',
        sub: 'Beteiligungen, Wertpapiere — A.III' },
      { bereich: 'aktiva', key: 'B.II', label: 'Forderungen (EUR)',
        sub: 'noch offene Forderungen — B.II' },
      { bereich: 'aktiva', key: 'B.I', label: 'Vorräte (EUR)',
        sub: 'Waren, Roh- und Hilfsstoffe — B.I' }
    ]},
  { titel: 'Schulden und Rücklagen (Passiva)',
    text: 'Verbindlichkeiten und Rückstellungen zum Stichtag. Das gezeichnete Kapital ' +
      'aus Schritt 1 wird automatisch ergänzt.',
    felder: [
      { bereich: 'passiva', key: 'P.C', label: 'Verbindlichkeiten (EUR)',
        sub: 'Bankdarlehen, offene Rechnungen — P.C' },
      { bereich: 'passiva', key: 'P.B', label: 'Rückstellungen (EUR)',
        sub: 'ungewisse Verbindlichkeiten — P.B' },
      { bereich: 'passiva', key: 'P.A.II', label: 'Kapitalrücklage (EUR)',
        sub: 'Aufgeld über dem Nennbetrag — P.A.II' }
    ]},
  { titel: 'Prüfen und fertigstellen',
    text: 'Stimmt die Bilanz? Aktiva und Passiva müssen gleich hoch sein. Bei einer ' +
      'Differenz die vorherigen Schritte prüfen.', uebersicht: true }
];
function assiWert(a, f) {
  if (f.bereich === 'kapital') return (a.kapital || {})[f.key];
  return ((a.werte || {})[f.bereich] || {})[f.key];
}
function assiSetz(a, f, v) {
  if (f.bereich === 'kapital') { a.kapital = a.kapital || {}; a.kapital[f.key] = v; }
  else {
    a.werte = a.werte || {};
    a.werte[f.bereich] = a.werte[f.bereich] || {};
    a.werte[f.bereich][f.key] = v;
  }
}
function renderAssistent(m) {
  var a = S.aktiv;
  if (!a || a.art !== 'EROEFFNUNGSBILANZ') { setView(a ? 'editor' : 'start'); return; }
  if (assiSchritt < 0) assiSchritt = 0;
  if (assiSchritt >= ASSI_SCHRITTE.length) assiSchritt = ASSI_SCHRITTE.length - 1;
  var s = ASSI_SCHRITTE[assiSchritt], n = ASSI_SCHRITTE.length;
  var html = '<div class="kopf"><h1>Geführte Erfassung &ndash; Eröffnungsbilanz</h1>' +
    '<p>Schritt ' + (assiSchritt + 1) + ' von ' + n + '. Die Angaben werden bei jedem ' +
    'Schritt gespeichert.</p></div>';
  html += '<div class="btn-reihe no-print" style="margin-bottom:8px">' +
    '<button class="btn btn-sm" data-assi-formular>Zum klassischen Formular wechseln' +
    '</button></div>';
  html += '<div class="karte"><h2>' + esc(s.titel) + '</h2>' +
    '<div class="karte-hint" style="margin-bottom:10px">' + s.text + '</div>';
  if (s.uebersicht) {
    var pr = Berechnung.pruefe(a), r = pr.berechnung;
    html += '<div class="status-zeile"><span>Summe Aktiva</span><span class="mono">' +
      geld(r.bilanz.summeAktiva) + ' EUR</span></div>' +
      '<div class="status-zeile"><span>Summe Passiva</span><span class="mono">' +
      geld(r.bilanz.summePassiva) + ' EUR</span></div>' +
      '<div class="status-zeile"><span>Differenz</span><span class="mono">' +
      geld(r.bilanz.differenz) + ' EUR</span></div>';
    html += r.bilanz.ausgeglichen
      ? '<div class="status-ampel ampel-gut">✓ Die Bilanz ist ausgeglichen</div>'
      : '<div class="status-ampel ampel-fehler">✕ Aktiva und Passiva stimmen noch nicht ' +
        'überein — mit „Zurück" die Werte prüfen.</div>';
    pr.meldungen.forEach(function (mld) {
      html += '<div class="meldung m-' + mld.stufe + '">' + esc(mld.text) + '</div>';
    });
  } else {
    html += '<div class="gitter g2">';
    s.felder.forEach(function (f, i) {
      html += feldWrap(f.label, f.sub, '<input class="zahl" type="text" inputmode="decimal" ' +
        'data-assi-feld="' + i + '" value="' + eingabeWert(assiWert(a, f)) + '">');
    });
    html += '</div>';
  }
  html += '<div class="btn-reihe" style="margin-top:14px">';
  if (assiSchritt > 0) html += '<button class="btn" data-assi-zurueck>Zurück</button>';
  if (assiSchritt < n - 1) html += '<button class="btn btn-pri" data-assi-weiter>Weiter</button>';
  else html += '<button class="btn btn-pri" data-assi-fertig>Fertigstellen</button>';
  html += '</div></div>';
  m.innerHTML = html;

  m.querySelectorAll('[data-assi-feld]').forEach(function (el) {
    el.addEventListener('input', function () {
      assiSetz(a, s.felder[parseInt(el.dataset.assiFeld, 10)], Berechnung.num(el.value));
    });
  });
  function weiter(delta, fertig) {
    speichereStill().then(function () {
      if (fertig) { hinweisToast('Eröffnungsbilanz erfasst.'); setView('editor'); return; }
      assiSchritt += delta;
      renderAssistent(m);
    });
  }
  var z = m.querySelector('[data-assi-zurueck]');
  if (z) z.onclick = function () { weiter(-1); };
  var w = m.querySelector('[data-assi-weiter]');
  if (w) w.onclick = function () { weiter(1); };
  var fert = m.querySelector('[data-assi-fertig]');
  if (fert) fert.onclick = function () { weiter(0, true); };
  var fmod = m.querySelector('[data-assi-formular]');
  if (fmod) fmod.onclick = function () {
    speichereStill().then(function () { setView('editor'); });
  };
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

  /* Vorjahresvergleich (Diff-View) */
  if (!istEB) {
    html += '<div class="karte" id="vergleichKarte"><h2>Vorjahresvergleich ' +
      '<span class="reg">&middot; § 265 Abs. 2 HGB</span></h2>' +
      '<div class="karte-hint">Δ-Übersicht zwischen Vorjahr und aktuellem Abschluss. ' +
      'Wesentliche Abweichungen sind im Anhang zu erläutern.</div>' +
      '<div id="vergleichBox"><i>Verknüpfen Sie unter „Eckdaten" einen Vorjahres-' +
      'Abschluss, dann erscheint hier die Δ-Tabelle.</i></div></div>';
  }

  /* Closing-Checkliste */
  if (!istEB) {
    var ck = Closing.pruefeJaReadiness(a);
    var offen = ck.filter(function (p) { return p.status === 'offen'; }).length;
    var info  = ck.filter(function (p) { return p.status === 'info'; }).length;
    var ok2   = ck.filter(function (p) { return p.status === 'ok'; }).length;
    html += '<div class="karte"><h2>Abschluss-Checkliste</h2>' +
      '<div class="karte-hint">Erinnerungsstütze vor der Feststellung: ' +
      ok2 + ' erledigt, ' + offen + ' offen, ' + info + ' zur Prüfung.</div>' +
      '<table class="liste"><tbody>';
    ck.forEach(function (p, i) {
      var farbe = p.status === 'ok'    ? '#5dc98f'
                : p.status === 'offen' ? '#c14545'
                : '#7c91a0';
      var ic = p.status === 'ok' ? '✓' : p.status === 'offen' ? '!' : '?';
      var dot = '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;' +
        'background:' + farbe + ';color:#fff;text-align:center;line-height:18px;font-size:11px;' +
        'font-weight:600;margin-right:6px">' + ic + '</span>';
      var sprung = p.sprung
        ? ' <span class="btn btn-sm" data-csprung="' + esc(JSON.stringify(p.sprung)) +
          '">öffnen</span>'
        : '';
      html += '<tr><td>' + dot + '<b>' + esc(p.titel) + '</b>' +
        (p.paragraph ? ' <span class="reg">· ' + esc(p.paragraph) + '</span>' : '') +
        '<div class="karte-hint" style="margin-top:2px">' + esc(p.detail) + '</div></td>' +
        '<td class="rechts">' + sprung + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  /* Anhang */
  html += anhangKarte(a);

  m.innerHTML =
    '<span class="zurueck" data-z="start">&larr; Übersicht</span>' +
    '<div class="editor-grid"><div>' +
    html.replace('<span class="zurueck" data-z="start">&larr; Übersicht</span>', '') +
    '</div><aside class="statusbox"><div id="statusbox"></div></aside></div>';

  bindeEditor(m);
  bindeClosingSpruenge(m);
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
  aktualisiereVergleichBox();
}

/* Befüllt die Vorjahresvergleichs-Karte. Funktioniert nur, wenn ein
 * Vorjahres-Abschluss verknüpft und nachgeladen wurde. */
function aktualisiereVergleichBox() {
  var box = document.getElementById('vergleichBox');
  if (!box) return;
  var a = S.aktiv, vj = (S.vorjahr && S.vorjahr.id === a.vorjahrId) ? S.vorjahr : null;
  if (!a.vorjahrId) {
    box.innerHTML = '<i>Verknüpfen Sie unter „Eckdaten" einen Vorjahres-Abschluss, ' +
      'dann erscheint hier die Δ-Tabelle.</i>';
    return;
  }
  if (!vj) {
    box.innerHTML = '<i>Vorjahres-Abschluss wird geladen …</i>';
    return;
  }
  var r  = Berechnung.berechne(a);
  var rv = Berechnung.berechne(vj);

  function pfeil(d) {
    if (Math.abs(d) < 0.005) return '<span style="color:var(--ink-mut)">—</span>';
    return d > 0
      ? '<span style="color:#5dc98f">▲</span>'
      : '<span style="color:#c14545">▼</span>';
  }
  function prozent(neu, alt) {
    if (Math.abs(alt) < 0.005) return alt === 0 && neu === 0 ? '—' : 'neu';
    var p = ((neu - alt) / Math.abs(alt)) * 100;
    return (p > 0 ? '+' : '') + (Math.round(p * 10) / 10) + ' %';
  }
  function row(label, alt, neu) {
    var d = neu - alt;
    if (Math.abs(alt) < 0.005 && Math.abs(neu) < 0.005) return '';
    return '<tr><td>' + esc(label) + '</td>' +
      '<td class="rechts mono">' + geld(alt) + '</td>' +
      '<td class="rechts mono">' + geld(neu) + '</td>' +
      '<td class="rechts mono">' + geld(d) + '</td>' +
      '<td class="rechts mono">' + prozent(neu, alt) + '</td>' +
      '<td class="rechts">' + pfeil(d) + '</td></tr>';
  }
  function tabelle(titel, eintraege) {
    if (!eintraege.length) return '';
    return '<h3 style="margin-top:14px">' + esc(titel) + '</h3>' +
      '<table class="liste"><thead><tr><th>Position</th>' +
      '<th class="rechts">Vorjahr</th><th class="rechts">Aktuell</th>' +
      '<th class="rechts">Δ EUR</th><th class="rechts">Δ %</th><th></th>' +
      '</tr></thead><tbody>' + eintraege.join('') + '</tbody></table>';
  }

  // Bilanz-Aktiva
  var aktiva = [], passiva = [], guv = [];
  function durchlaufe(baum, ergebnis, pruefer) {
    baum.forEach(function (p) {
      if (p.id) {
        var v = pruefer(p.id);
        ergebnis.push(row(p.label || p.id, v.alt, v.neu));
      }
      if (p.kinder) durchlaufe(p.kinder, ergebnis, pruefer);
    });
  }
  durchlaufe(Positionen.AKTIVA, aktiva, function (id) {
    return { alt: rv.bilanz.aktiva[id] || 0, neu: r.bilanz.aktiva[id] || 0 };
  });
  durchlaufe(Positionen.PASSIVA, passiva, function (id) {
    return { alt: rv.bilanz.passiva[id] || 0, neu: r.bilanz.passiva[id] || 0 };
  });
  // GuV-Positionen je Verfahren
  var verf = r.guv.verfahren;
  var guvBaum = { GKV: Positionen.GUV_GKV, UKV: Positionen.GUV_UKV,
                  KLEINST: Positionen.GUV_KLEINST }[verf] || [];
  if (rv.guv.verfahren === verf) {
    guvBaum.forEach(function (p) {
      if (!p.id) return;
      var alt = rv.guv.werte[p.id] || 0, neu = r.guv.werte[p.id] || 0;
      var z = row(p.label || p.id, alt, neu);
      if (z) guv.push(z);
    });
  } else {
    guv.push('<tr><td colspan="6"><i>Vorjahr-GuV verwendet ein anderes Verfahren (' +
      esc(rv.guv.verfahren) + ' vs. ' + esc(verf) + ') — kein Direktvergleich.</i></td></tr>');
  }

  // Summen oben
  var kopf = tabelle('Bilanzsummen', [
    row('Aktiva gesamt', rv.bilanz.summeAktiva, r.bilanz.summeAktiva),
    row('Eigenkapital',  rv.bilanz.eigenkapital, r.bilanz.eigenkapital),
    row('Jahresergebnis', rv.guv.jahresergebnis || 0, r.guv.jahresergebnis || 0)
  ].filter(Boolean));
  var t1 = tabelle('Aktiva', aktiva.filter(Boolean));
  var t2 = tabelle('Passiva', passiva.filter(Boolean));
  var t3 = tabelle('Gewinn- und Verlustrechnung (' + verf + ')', guv);
  box.innerHTML = kopf + t1 + t2 + t3;
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
  var istJA = a.art === 'JAHRESABSCHLUSS';
  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>' +
    '<div class="btn-reihe no-print" style="margin-bottom:6px">' +
    '<button class="btn btn-pri" id="btnVollPdf">Vollständiges PDF (ausfüllbar)</button>' +
    '<button class="btn" id="btnDrucken">Drucken (Browser)</button>' +
    (istJA ? '<button class="btn" id="btnStbPaket">Steuerberater-Paket als ZIP</button>' : '') +
    '</div>' +
    '<div class="no-print" style="margin-bottom:14px;font-size:12px;color:#666;line-height:1.5">' +
    'Das <b>vollständige PDF</b> enthält die komplette ' + (istJA ? 'Bilanz, GuV und Anhang' : 'Bilanz') +
    ' und ausfüllbare Felder für Ort, Datum und Unterschrift — <b>ohne gestempeltes Datum</b>, ' +
    'also rückwirkend zum Stichtag ausfüllbar. Beim „Drucken (Browser)" blendet der Browser oben ' +
    'Datum/URL ein (im Druckdialog unter „Kopf- und Fußzeilen" abschaltbar).</div>';
  html += '<div class="dok" id="dok">' + dokInhalt(a, u, r, null) + '</div>';
  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () { setView('editor'); };
  m.querySelector('#btnDrucken').onclick = function () { window.print(); };
  var btnPdf = m.querySelector('#btnVollPdf');
  if (btnPdf) btnPdf.onclick = function () {
    if (typeof BilanzPdf === 'undefined') { alert('PDF-Modul nicht verfügbar.'); return; }
    btnPdf.disabled = true;
    BilanzPdf.erzeuge(u, a, r).then(function (bytes) {
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var aEl = document.createElement('a');
      aEl.href = url;
      aEl.download = (istJA ? 'jahresabschluss_' : 'eroeffnungsbilanz_') + (a.id || 'openbilanz') + '.pdf';
      document.body.appendChild(aEl); aEl.click(); aEl.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      btnPdf.disabled = false;
    }).catch(function (e) {
      btnPdf.disabled = false;
      alert('PDF konnte nicht erzeugt werden: ' + (e && e.message || e));
    });
  };
  var btnPaket = m.querySelector('#btnStbPaket');
  if (btnPaket) btnPaket.onclick = function () { erzeugeSteuerberaterPaket(a, u, r); };

  if (a.vorjahrId) {
    Store.ladeAbschluss(a.vorjahrId).then(function (vja) {
      if (vja && !vja.fehler) {
        var rv = Berechnung.berechne(vja);
        document.getElementById('dok').innerHTML = dokInhalt(a, u, r, rv);
      }
    });
  }
}

/* Steuerberater-Paket: Bilanz/GuV/Anhang als HTML, Saldenliste/Journal als
 * CSV/JSON, DATEV-EXTF-Buchungsstapel und ein Manifest in einer ZIP. */
function erzeugeSteuerberaterPaket(a, u, r) {
  var basis = (a.bezeichnung || 'Abschluss').replace(/[^\w]+/g, '_');
  // Bilanz/GuV/Anhang als eigenständiges HTML (mit unseren Druck-Styles ge-inlined ginge auch,
  // aber das HTML-Snippet kann jeder Browser direkt öffnen).
  var dokHtml = '<!doctype html><html lang="de"><head><meta charset="utf-8">' +
    '<title>' + esc(u.name || '') + ' — ' + esc(a.bezeichnung || '') + '</title>' +
    '<style>body{font-family:Georgia,serif;max-width:800px;margin:30px auto;color:#222}' +
    'h1{font-size:18px;margin:14px 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:2px}' +
    'table{border-collapse:collapse;width:100%}td,th{padding:3px 6px;border-bottom:1px dotted #ddd;vertical-align:top}' +
    '.rechts{text-align:right}.mono{font-family:"Courier New",monospace}' +
    '.dok-bilanz{display:grid;grid-template-columns:1fr 1fr;gap:24px}' +
    '.dok-sub{color:#666;font-size:12px;margin-top:2px}.dok-fussnote{font-size:11px;color:#555;margin-top:6px}' +
    '</style></head><body>' + dokInhalt(a, u, r, null) + '</body></html>';

  // Saldenliste als CSV
  var saldenCsv = 'Konto;Bezeichnung;Soll;Haben;Saldo\r\n';
  var s = kontenSalden(a);
  Object.keys(s).sort().forEach(function (nr) {
    var k = SKR04.kontoFinden(nr) || { name: '' };
    var saldo = s[nr].soll - s[nr].haben;
    saldenCsv += nr + ';"' + (k.name || '').replace(/"/g, '""') + '";' +
      saldo2(s[nr].soll) + ';' + saldo2(s[nr].haben) + ';' + saldo2(saldo) + '\r\n';
  });
  function saldo2(n) {
    return (Math.round((+n || 0) * 100) / 100).toFixed(2).replace('.', ',');
  }

  // Manifest
  var manifest = {
    erzeugt: new Date().toISOString(),
    openbilanz: { version: (typeof Version !== 'undefined' && Version.signatur && Version.signatur()) || 'unbekannt' },
    mandant: {
      name: u.name || '',
      steuernummer: u.steuernummer || '',
      hrNummer: u.hrNummer || ''
    },
    abschluss: {
      id: a.id,
      art: a.art,
      bezeichnung: a.bezeichnung,
      stichtag: a.stichtag,
      gjVon: a.gjVon,
      gjBis: a.gjBis,
      guvVerfahren: a.guvVerfahren,
      groessenklasse: a.groessenklasse
    },
    dateien: ['bilanz.html', 'saldenliste.csv', 'journal.csv', 'journal.json', 'datev-extf.csv']
  };

  var dateien = [
    { name: 'bilanz.html', content: dokHtml },
    { name: 'saldenliste.csv', content: saldenCsv },
    { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }
  ];
  if (a.buchungen && a.buchungen.length) {
    dateien.push({ name: 'journal.csv', content: JournalExport.csv(a) });
    dateien.push({ name: 'journal.json', content: JournalExport.json(a) });
    dateien.push({ name: 'datev-extf.csv', content: Datev.erzeuge(a, {}) });
  }

  var zip = StbPaket.baueZip(dateien);
  ladeDatei(zip, 'Steuerberater-Paket_' + basis + '.zip', 'application/zip');
  hinweisToast('Steuerberater-Paket erstellt (' + dateien.length + ' Dateien).');
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
    '<p>Überschlägige Berechnung von ' + gtip('Körperschaftsteuer', 'Körperschaft-') +
    ' und ' + gtip('Gewerbesteuer') + ' &ndash; mit den Besonderheiten der ' +
    'vermögensverwaltenden GmbH (' + gtip('§ 8b KStG') + ', § 9 GewStG). Fachbegriffe ' +
    'mit gepunkteter Linie zeigen beim Überfahren eine Kurzerklärung; das vollständige ' +
    'Glossar steht im gleichnamigen Reiter.</p></div>';
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

  // Kommentar / Notizen zur BWA (z. B. fuer Bank, Gesellschafter, Steuerberater)
  html += '<div class="karte"><h2>Kommentar / Notizen</h2>' +
    '<div class="karte-hint">Freitext zur Erläuterung der BWA. Wird auf der ' +
    'Druckansicht (BWA-Block) mit ausgegeben — gut für Vorlage bei Bank oder ' +
    'Gesellschafterversammlung.</div>' +
    '<textarea id="bwaKommentar" rows="5" style="width:100%;font-family:inherit">' +
    esc(a.bwaKommentar || '') + '</textarea>' +
    '<div class="btn-reihe" style="margin-top:8px">' +
    '<button class="btn" id="bwaKomSpeichern">Kommentar speichern</button>' +
    '<span id="bwaKomStatus" class="bu-tag" style="margin-left:10px"></span></div></div>';

  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () { setView('editor'); };
  var btn = m.querySelector('#bwaKomSpeichern');
  if (btn) btn.onclick = function () {
    a.bwaKommentar = document.getElementById('bwaKommentar').value;
    speichereStill().then(function () {
      var st = document.getElementById('bwaKomStatus');
      if (st) {
        st.textContent = 'gespeichert';
        setTimeout(function () { if (st) st.textContent = ''; }, 2500);
      }
    });
  };
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
  // Duplikatserkennung: dieselbe XML-/PDF-Datei darf nicht zweimal eingelesen werden
  var dup = parsed.dateiHash && (a.buchungen || []).filter(function (b) {
    return b.eRechnungHash === parsed.dateiHash;
  });
  var dupBox = '';
  if (dup && dup.length) {
    dupBox = '<div class="box box-warn" style="margin-top:10px">' +
      '<b>Diese E-Rechnung wurde bereits eingelesen.</b> ' +
      'Erste Erfassung am ' + esc(datumDe((dup[0].datum || '').slice(0, 10))) +
      ' (Buchungs-ID ' + esc(dup[0].id || '') + '). Eine zweite Übernahme würde ' +
      'doppelte Aufwand- und Vorsteuer-Buchungen erzeugen — bitte stattdessen die ' +
      'vorhandene Buchung prüfen.</div>';
  }
  var aufwOpt = kontoOpt.replace('value="6300"', 'value="6300" selected');
  var profilZeile = r.profil
    ? '<tr><td>Profil</td><td>' + esc(r.profil) + '</td></tr>' : '';
  var warnBox = '';
  if (r.warnungen && r.warnungen.length) {
    warnBox = '<div class="box box-warn" style="margin-top:10px"><b>Plausibilität:</b>' +
      '<ul style="margin:6px 0 0 18px">' +
      r.warnungen.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') +
      '</ul></div>';
  }
  var posBlock = '';
  if (r.positionen && r.positionen.length) {
    posBlock = '<details style="margin-top:10px"><summary>' + r.positionen.length +
      ' Position(en)</summary>' +
      '<table class="liste"><thead><tr><th>Bezeichnung</th>' +
      '<th class="rechts">Menge</th><th>Einheit</th>' +
      '<th class="rechts">Einzelpreis</th><th class="rechts">Netto</th>' +
      '<th class="rechts">USt %</th></tr></thead><tbody>' +
      r.positionen.map(function (p) {
        return '<tr><td>' + esc(p.bezeichnung || '—') + '</td>' +
          '<td class="rechts mono">' + (p.menge || 0) + '</td>' +
          '<td class="mono">' + esc(p.einheit || '') + '</td>' +
          '<td class="rechts mono">' + geld(p.einzelpreis) + '</td>' +
          '<td class="rechts mono">' + geld(p.netto) + '</td>' +
          '<td class="rechts mono">' + (p.ustSatz || 0) + '</td></tr>';
      }).join('') + '</tbody></table></details>';
  }
  box.innerHTML = dupBox + '<table class="liste" style="margin-top:10px"><tbody>' +
    '<tr><td>Rechnungsnummer</td><td class="mono">' + esc(r.nummer || '—') + '</td></tr>' +
    '<tr><td>Rechnungsdatum</td><td class="mono">' + datumDe(r.datum) + '</td></tr>' +
    '<tr><td>Rechnungssteller</td><td>' + esc(r.verkaeufer || '—') + '</td></tr>' +
    profilZeile +
    '<tr><td>Nettobetrag</td><td class="rechts mono">' + geld(r.netto) + '</td></tr>' +
    '<tr><td>Umsatzsteuer</td><td class="rechts mono">' + geld(r.ust) + '</td></tr>' +
    '<tr><td>Bruttobetrag</td><td class="rechts mono">' + geld(r.brutto) + '</td></tr>' +
    '</tbody></table>' + warnBox + posBlock +
    '<div class="gitter g2" style="margin-top:10px">' +
    feldWrap('Aufwandskonto', 'Soll-Konto für den Nettobetrag',
      '<select id="erKonto">' + aufwOpt + '</select>') +
    '<div style="display:flex;align-items:flex-end"><button class="btn btn-pri" ' +
    'id="erUebernehmen">Als Eingangsrechnung buchen</button></div></div>';
  box.querySelector('#erUebernehmen').onclick = function () {
    if (dup && dup.length) {
      if (!confirm('Diese E-Rechnung ist bereits als Buchung erfasst. Trotzdem ' +
        'erneut übernehmen? (Erzeugt doppelte Buchungen.)')) return;
    }
    var konto = box.querySelector('#erKonto').value, stamp = Date.now();
    var basis = 'Eingangsrechnung ' + (r.verkaeufer ? r.verkaeufer + ' ' : '') + (r.nummer || '');
    var hash = parsed.dateiHash || null;
    a.buchungen.push({ id: 'B-ER-' + stamp + '-0', datum: r.datum,
      betrag: Berechnung.cent(r.netto), text: basis.slice(0, 90),
      soll: konto, haben: '3300', eRechnungHash: hash });
    var n = 1;
    if (r.ust > 0.005) {
      a.buchungen.push({ id: 'B-ER-' + stamp + '-1', datum: r.datum,
        betrag: Berechnung.cent(r.ust), text: ('Vorsteuer ' + (r.nummer || '')).slice(0, 90),
        soll: '1406', haben: '3300', eRechnungHash: hash });
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
  var bankOpt = SKR04.alleKonten().filter(function (k) { return /^18/.test(k.nr); })
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
    var vor = t.kontoHint || Importe.bankKontoVorschlag(t.zweck + ' ' + t.partner, t.eingang,
      (S.unternehmen && S.unternehmen.kontierungsregeln) || []);
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
    var fmtLabel = quelle === 'CAMT' ? 'CAMT.053'
      : quelle === 'IBKR' ? 'Broker (IBKR Flex)' : quelle;
    a.importLog = ImportProtokoll.anhaengen(a.importLog,
      ImportProtokoll.eintrag(fmtLabel, tx, { uebernommen: n }));
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
    a.importLog = ImportProtokoll.anhaengen(a.importLog,
      ImportProtokoll.eintrag('DATEV', bu, { uebernommen: n }));
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
  if (!a.importLog) a.importLog = [];
  a.buchungen.forEach(function (b, i) { if (!b.id) b.id = 'B-leg-' + i; });
  var html = '<span class="zurueck" data-z="editor">&larr; zurück zum Editor</span>';
  html += '<div class="kopf"><h1>Buchhaltung &ndash; ' + esc(a.bezeichnung) + '</h1>' +
    '<p>Erfassen Sie Buchungssätze nach dem Kontenrahmen SKR04. Aus den Kontensalden ' +
    'lassen sich Bilanz und GuV automatisch befüllen.</p></div>';

  html += '<div class="box box-info"><b>Hinweis</b>Dieser Modus ist die Grundlage für die ' +
    'laufende Buchhaltung. Mit &bdquo;Salden übernehmen&ldquo; werden die Kontensalden in ' +
    'die Positionen der Bilanz/GuV dieses Abschlusses übertragen.<br><br>' +
    '<b>Belege:</b> Wer beim Buchen eine Beleg-Datei mitgibt, dem speichert OpenBilanz nur ' +
    'den <i>SHA-256-Hash</i> und Metadaten — die Datei selbst bleibt im eigenen Dateisystem ' +
    'beim Nutzer. Bei einer späteren Prüfung weist man die Zugehörigkeit über den Hash nach.</div>';

  // Faellige wiederkehrende Vorlagen (unaufdringliche Hinweisbox)
  var faelligeListe = Vorlagen.faellige(
    (S.unternehmen && S.unternehmen.eigeneVorlagen) || [],
    a.stichtag || undefined
  );
  if (faelligeListe.length) {
    html += '<div class="box box-warn"><b>Wiederkehrende Buchungen fällig</b>' +
      faelligeListe.length + ' Vorlage(n) sind seit dem letzten Anwenden wieder fällig. ' +
      'Übernahme legt einen Entwurf ins Formular — Festschreibung wie immer manuell.' +
      '<ul style="margin-top:8px">';
    faelligeListe.forEach(function (f, i) {
      html += '<li>' + esc(f.vorlage.name) + ' · ' + esc(f.vorlage.soll) + ' an ' +
        esc(f.vorlage.haben) +
        (f.vorlage.betrag ? ' · ' + geld(f.vorlage.betrag) : '') +
        ' &nbsp;<span class="btn btn-sm" data-faellig="' + i + '">übernehmen</span></li>';
    });
    html += '</ul></div>';
  }

  /* Erfassungsformular */
  SKR04.setEigene((S.unternehmen && S.unternehmen.eigeneKonten) || []);
  var kontoOpt = SKR04.alleKonten().map(function (k) {
    return '<option value="' + k.nr + '">' + k.nr + ' &ndash; ' + esc(k.name) + '</option>';
  }).join('');
  var vorlagen = Vorlagen.sortiert((S.unternehmen && S.unternehmen.eigeneVorlagen) || []);
  var vorlageOpts = vorlagen.length
    ? '<select id="buVorlage"><option value="">— Vorlage anwenden —</option>' +
      vorlagen.map(function (v, i) {
        return '<option value="' + i + '">' + esc(v.name) + '</option>';
      }).join('') + '</select>'
    : '';
  html += '<div class="karte"><h2>Buchung erfassen</h2>' +
    '<div class="karte-hint">Tastatur: <b>Enter</b> springt zum nächsten Feld, ' +
    '<b>Shift+Enter</b> bucht sofort, <b>Esc</b> leert Betrag und Text.</div>' +
    '<div class="gitter g3">' +
    feldWrap('Datum', '', '<input type="date" id="buDatum" value="' +
      esc(a.stichtag || '') + '">') +
    feldWrap('Betrag (EUR)', '', '<input class="zahl" type="text" inputmode="decimal" id="buBetrag">') +
    feldWrap('Buchungstext', '', '<input id="buText">') +
    feldWrap('Soll-Konto', '', '<select id="buSoll">' + kontoOpt + '</select>') +
    feldWrap('Haben-Konto', '', '<select id="buHaben">' + kontoOpt + '</select>') +
    (vorlageOpts ? feldWrap('Vorlage', vorlagen.length + ' vorhanden', vorlageOpts) : '') +
    feldWrap('Beleg', 'optional, nur Hash & Name werden gespeichert',
      '<input type="file" id="buBeleg">') +
    '<div style="display:flex;align-items:flex-end"><button class="btn btn-pri" id="buAdd">' +
    'Buchung hinzufügen</button></div>' +
    '</div>' +
    '<div id="buAutoHint" class="karte-hint" style="margin-top:8px;display:none"></div>' +
    '</div>';

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
      '<th>Haben</th><th class="rechts">Betrag</th><th>Beleg</th><th></th></tr></thead><tbody>';
    a.buchungen.forEach(function (b, i) {
      var aktion;
      if (b.fest) {
        if (b.storniert) aktion = '<span class="bu-tag">storniert</span>';
        else if (b.stornoVon) aktion = '<span class="bu-tag">Storno</span>';
        else aktion = '<span class="btn btn-sm" data-storno="' + esc(b.id) + '">stornieren</span>';
      } else {
        aktion = '<span class="btn btn-sm btn-gefahr" data-del="' + i + '">löschen</span>';
      }
      var belegZelle = b.beleg
        ? '<span class="bu-tag" title="' + esc(b.beleg.sha256 || '') + '">📎 ' +
          esc(b.beleg.name || '—') + '</span>'
        : '<span class="bu-tag" style="opacity:0.5">—</span>';
      html += '<tr><td class="mono">' + (b.fest ? '🔒 ' : '') + datumDe(b.datum) + '</td>' +
        '<td>' + esc(b.text || '') + '</td>' +
        '<td class="mono">' + esc(b.soll) + '</td><td class="mono">' + esc(b.haben) + '</td>' +
        '<td class="rechts mono">' + geld(b.betrag) + '</td>' +
        '<td>' + belegZelle + '</td>' +
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

  /* Nutzerdefinierte Konten — zusätzliche Sachkonten zum SKR04-Auszug */
  var eigeneK = (S.unternehmen && S.unternehmen.eigeneKonten) || [];
  var vorlageOpt = SKR04.KONTEN.filter(function (k) { return k.seite !== 'EBK'; })
    .map(function (k) {
      return '<option value="' + k.nr + '">' + k.nr + ' &ndash; ' + esc(k.name) + '</option>';
    }).join('');
  html += '<div class="karte"><h2>Eigene Konten</h2>' +
    '<div class="karte-hint">Fehlt ein Konto im SKR04-Auszug? Hier eigene Konten ' +
    'anlegen. Über ein <b>Vorlage-Konto</b> erbt das neue Konto dessen Bilanz-/GuV-' +
    'Zuordnung &ndash; es erscheint danach in allen Konto-Auswahllisten.</div>';
  if (eigeneK.length) {
    html += '<table class="liste"><thead><tr><th>Konto</th><th>Bezeichnung</th>' +
      '<th>verhält sich wie</th><th></th></tr></thead><tbody>';
    eigeneK.forEach(function (k, i) {
      var vk = SKR04.kontoFinden(k.vorlage);
      html += '<tr><td class="mono">' + esc(k.nr) + '</td><td>' + esc(k.name) + '</td>' +
        '<td class="mono">' + esc(k.vorlage || '?') +
        (vk ? ' <span style="font-family:inherit">&ndash; ' + esc(vk.name) + '</span>' : '') +
        '</td><td class="rechts"><span class="btn btn-sm btn-gefahr" data-ekdel="' + i +
        '">löschen</span></td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<div class="karte-hint">Noch keine eigenen Konten angelegt.</div>';
  }
  html += '<div class="gitter g3" style="margin-top:10px">' +
    feldWrap('Kontonummer', 'z. B. 6644', '<input id="ekNr">') +
    feldWrap('Bezeichnung', 'z. B. Bewirtungskosten', '<input id="ekName">') +
    feldWrap('Verhält sich wie', 'Vorlage-Konto',
      '<select id="ekVorlage">' + vorlageOpt + '</select>') +
    '</div><div class="btn-reihe"><button class="btn" id="ekAdd">Konto anlegen' +
    '</button></div></div>';

  /* Nutzerpflegbare Kontierungsregeln für den Bankimport */
  var regeln = (S.unternehmen && S.unternehmen.kontierungsregeln) || [];
  var regelKontoOpt = SKR04.alleKonten().filter(function (k) { return k.seite !== 'EBK'; })
    .map(function (k) {
      return '<option value="' + k.nr + '">' + k.nr + ' &ndash; ' + esc(k.name) + '</option>';
    }).join('');
  html += '<div class="karte"><h2>Kontierungsregeln</h2>' +
    '<div class="karte-hint">Eigene Regeln für die Kontovorschläge des Bankimports: ' +
    'enthält Verwendungszweck oder Partner einen Suchbegriff, wird das zugeordnete ' +
    'Gegenkonto vorgeschlagen. Eigene Regeln haben Vorrang vor den eingebauten.</div>';
  if (regeln.length) {
    html += '<table class="liste"><thead><tr><th>Suchbegriff</th><th>Gegenkonto</th>' +
      '<th></th></tr></thead><tbody>';
    regeln.forEach(function (r, i) {
      var rk = SKR04.kontoFinden(r.konto);
      html += '<tr><td>' + esc(r.muster) + '</td>' +
        '<td class="mono">' + esc(r.konto) + (rk ? ' &ndash; ' + esc(rk.name) : '') + '</td>' +
        '<td class="rechts"><span class="btn btn-sm btn-gefahr" data-regeldel="' + i +
        '">löschen</span></td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<div class="karte-hint">Noch keine eigenen Regeln — es greifen die ' +
      'eingebauten Vorschläge.</div>';
  }
  html += '<div class="gitter g2" style="margin-top:10px">' +
    feldWrap('Suchbegriff', 'z. B. ein Lieferantenname', '<input id="regelMuster">') +
    feldWrap('Gegenkonto', '', '<select id="regelKonto">' + regelKontoOpt + '</select>') +
    '</div><div class="btn-reihe"><button class="btn" id="regelAdd">Regel hinzufügen' +
    '</button></div></div>';

  /* Buchungsvorlagen (haeufige Geschaeftsvorfaelle) */
  var vorlKontoOpt = SKR04.alleKonten().filter(function (k) { return k.seite !== 'EBK'; })
    .map(function (k) {
      return '<option value="' + k.nr + '">' + k.nr + ' &ndash; ' + esc(k.name) + '</option>';
    }).join('');
  html += '<div class="karte"><h2>Buchungsvorlagen</h2>' +
    '<div class="karte-hint">Häufige Geschäftsvorfälle als Vorlage speichern — bei der ' +
    'Buchungserfassung über das Vorlage-Dropdown übernommen. Felder, die nicht in der ' +
    'Vorlage gesetzt sind, bleiben für die manuelle Eingabe frei.</div>';
  if (vorlagen.length) {
    html += '<table class="liste"><thead><tr><th>Name</th><th>Text</th>' +
      '<th>Soll</th><th>Haben</th><th class="rechts">Betrag</th>' +
      '<th>Wiederkehrend</th><th></th></tr></thead><tbody>';
    vorlagen.forEach(function (v, i) {
      var w = v.wiederkehrend && v.wiederkehrend.takt;
      var wText = w ? esc(w) +
        (v.wiederkehrend.letzteAusfuehrung
          ? ' · nächste: ' + esc(Vorlagen.naechsteFaelligkeit(v) || '–')
          : ' · neu')
        : '—';
      html += '<tr><td>' + esc(v.name) + '</td><td>' + esc(v.text || '') + '</td>' +
        '<td class="mono">' + esc(v.soll) + '</td>' +
        '<td class="mono">' + esc(v.haben) + '</td>' +
        '<td class="rechts mono">' + (v.betrag ? geld(v.betrag) : '—') + '</td>' +
        '<td>' + wText + '</td>' +
        '<td class="rechts"><span class="btn btn-sm btn-gefahr" data-vorldel="' + i +
        '">löschen</span></td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<div class="karte-hint">Noch keine Vorlagen angelegt.</div>';
  }
  html += '<div class="gitter g3" style="margin-top:10px">' +
    feldWrap('Name', 'z. B. Adobe Creative Cloud', '<input id="vorlName">') +
    feldWrap('Buchungstext', 'optional', '<input id="vorlText">') +
    feldWrap('Default-Betrag', 'optional', '<input class="zahl" id="vorlBetrag" inputmode="decimal">') +
    feldWrap('Soll-Konto', '', '<select id="vorlSoll">' + vorlKontoOpt + '</select>') +
    feldWrap('Haben-Konto', '', '<select id="vorlHaben">' + vorlKontoOpt + '</select>') +
    feldWrap('Wiederkehrend', 'optional', '<select id="vorlTakt">' +
      '<option value="">— nein —</option>' +
      '<option value="monatlich">monatlich</option>' +
      '<option value="quartalsweise">quartalsweise</option>' +
      '<option value="jaehrlich">jährlich</option></select>') +
    '<div style="display:flex;align-items:flex-end"><button class="btn" id="vorlAdd">' +
    'Vorlage speichern</button></div>' +
    '</div></div>';

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
    '<div class="karte-hint">Eingehende E-Rechnung als XML oder als ZUGFeRD-/' +
    'Factur-X-PDF einlesen. Profil, Beträge und Positionen werden ausgelesen, ' +
    'Plausi (Brutto = Netto + USt, Summe Positionen = Netto, Pflichtfelder) ' +
    'geprüft, und die Eingangsrechnung wird gegen Verbindlichkeiten (3300) ' +
    'gebucht.</div>' +
    '<input type="file" id="erDatei" ' +
    'accept=".xml,.pdf,text/xml,application/xml,application/pdf">' +
    '<div id="erVorschau"></div></div>';

  /* Importprotokoll: nachvollziehbare Übersicht der Datei-Importe (GoBD). */
  if (a.importLog && a.importLog.length) {
    html += '<div class="karte"><h2>Importprotokoll</h2>' +
      '<div class="karte-hint">Welche Datei-Importe wurden wann in diesen Abschluss ' +
      'übernommen (jüngste zuerst) — für die Nachvollziehbarkeit nach GoBD.</div>' +
      '<table class="liste"><thead><tr><th>Zeitpunkt</th><th>Format</th>' +
      '<th class="rechts">Übernommen</th><th class="rechts">Erkannt</th>' +
      '<th>Datumsbereich</th></tr></thead><tbody>';
    a.importLog.forEach(function (e) {
      var br = e.datumsbereich
        ? datumDe(e.datumsbereich.von) + ' &ndash; ' + datumDe(e.datumsbereich.bis) : '—';
      html += '<tr><td class="mono">' + esc(zeitstempelDe(e.zeit)) + '</td>' +
        '<td>' + esc(e.format) + '</td>' +
        '<td class="rechts mono">' + esc(String(e.anzahlUebernommen)) + '</td>' +
        '<td class="rechts mono">' + esc(String(e.anzahlErkannt)) + '</td>' +
        '<td class="mono">' + br + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  m.innerHTML = html;
  m.querySelector('[data-z]').onclick = function () { setView('editor'); };

  // Tastatur-Workflow in der Buchungs-Maske:
  //   Enter         -> zum nächsten Feld der Eingabe-Kette
  //   Shift+Enter   -> Buchung sofort hinzufügen (überspringt die Kette)
  //   Esc          -> Formularfelder leeren (Datum bleibt)
  (function () {
    var kette = ['buDatum', 'buBetrag', 'buText', 'buSoll', 'buHaben'];
    kette.forEach(function (id, idx) {
      var el = document.getElementById(id);
      if (!el) return;
      el.onkeydown = function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) { document.getElementById('buAdd').click(); return; }
          var n = kette[idx + 1];
          if (n) {
            var nx = document.getElementById(n);
            if (nx) { try { nx.focus(); if (nx.select) nx.select(); } catch (ex) {} }
          } else {
            document.getElementById('buAdd').click();
          }
        } else if (e.key === 'Escape') {
          // Esc im Formular leert die Eingaben (Datum bleibt erhalten)
          ['buBetrag', 'buText'].forEach(function (k) {
            var x = document.getElementById(k); if (x) x.value = '';
          });
          var fokus = document.getElementById('buBetrag');
          if (fokus) fokus.focus();
        }
      };
    });
  })();

  // Autocomplete: Vorschläge aus dem eigenen Journal beim Tippen des Buchungstexts.
  var buText = m.querySelector('#buText');
  var buHint = m.querySelector('#buAutoHint');
  function renderAutoHint() {
    if (!buText || !buHint) return;
    var t = buText.value;
    var sV = Autocomplete.vorschlaege(t, a.buchungen, { feld: 'soll', k: 3 });
    var hV = Autocomplete.vorschlaege(t, a.buchungen, { feld: 'haben', k: 3 });
    if (!sV.length && !hV.length) { buHint.style.display = 'none'; buHint.innerHTML = ''; return; }
    function chip(v, feld) {
      var k = SKR04.kontoFinden(v.konto);
      return '<span class="btn btn-sm" data-acfeld="' + feld + '" data-ackonto="' + esc(v.konto) +
        '">' + esc(v.konto) + (k ? ' &middot; ' + esc(k.name) : '') +
        ' &middot; ' + v.score + '&times;</span> ';
    }
    var h = '<b>Aus dem Journal:</b> ';
    if (sV.length) h += 'Soll → ' + sV.map(function (v) { return chip(v, 'buSoll'); }).join('');
    if (hV.length) h += ' &nbsp; Haben → ' + hV.map(function (v) { return chip(v, 'buHaben'); }).join('');
    buHint.innerHTML = h;
    buHint.style.display = '';
    buHint.querySelectorAll('[data-ackonto]').forEach(function (el) {
      el.onclick = function () {
        var sel = document.getElementById(el.dataset.acfeld);
        if (sel) sel.value = el.dataset.ackonto;
      };
    });
  }
  if (buText) buText.oninput = renderAutoHint;

  m.querySelector('#buAdd').onclick = function () {
    var b = {
      id: 'B-' + Date.now(),
      datum: document.getElementById('buDatum').value,
      betrag: Berechnung.num(document.getElementById('buBetrag').value),
      text: document.getElementById('buText').value,
      soll: document.getElementById('buSoll').value,
      haben: document.getElementById('buHaben').value
    };
    var weiter = function () {
      var pr = BuchungsPruefung.pruefe(b, {
        beginn: a.geschaeftsjahrVon, stichtag: a.stichtag, erlaubeEbk: false
      });
      if (!pr.ok) { alert('Buchung nicht plausibel:\n• ' + pr.fehler.join('\n• ')); return; }
      if (pr.warnungen.length) {
        if (!confirm('Hinweise zur Buchung:\n• ' + pr.warnungen.join('\n• ') +
          '\n\nTrotzdem buchen?')) return;
      }
      a.buchungen.push(b);
      speichereStill().then(function () { renderBuchhaltung(m); });
    };
    var belegInput = document.getElementById('buBeleg');
    var belegFile = belegInput && belegInput.files && belegInput.files[0];
    if (!belegFile) { weiter(); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var bytes = new Uint8Array(rd.result);
      Belege.sha256Hex(bytes).then(function (hash) {
        b.beleg = {
          name: belegFile.name,
          sha256: hash,
          groesseBytes: belegFile.size,
          eingelesenAm: new Date().toISOString()
        };
        weiter();
      }).catch(function (e) {
        alert('Beleg-Hash konnte nicht berechnet werden: ' + e.message);
      });
    };
    rd.onerror = function () { alert('Belegdatei konnte nicht gelesen werden.'); };
    rd.readAsArrayBuffer(belegFile);
  };
  m.querySelectorAll('[data-del]').forEach(function (el) {
    el.onclick = function () {
      var idx = parseInt(el.dataset.del, 10);
      var weg = a.buchungen[idx];
      // Wird eine Stornobuchung gelöscht, verliert der stornierte Original-
      // eintrag seine „storniert"-Markierung wieder — sonst bliebe er als
      // storniert markiert, ohne dass eine Gegenbuchung existiert.
      if (weg && weg.stornoVon) {
        a.buchungen.forEach(function (b) {
          if (b.id === weg.stornoVon) b.storniert = false;
        });
      }
      a.buchungen.splice(idx, 1);
      speichereStill().then(function () { renderBuchhaltung(m); });
    };
  });
  var regelAdd = m.querySelector('#regelAdd');
  if (regelAdd) regelAdd.onclick = function () {
    var muster = document.getElementById('regelMuster').value.trim();
    if (!muster) { alert('Bitte einen Suchbegriff eingeben.'); return; }
    if (!S.unternehmen) { alert('Bitte zuerst die Unternehmensdaten anlegen.'); return; }
    S.unternehmen.kontierungsregeln = S.unternehmen.kontierungsregeln || [];
    S.unternehmen.kontierungsregeln.push({ muster: muster,
      konto: document.getElementById('regelKonto').value });
    Store.speichereUnternehmen(S.unternehmen).then(function (g) {
      if (g && !g.fehler) S.unternehmen = g;
      hinweisToast('Kontierungsregel hinzugefügt.');
      renderBuchhaltung(m);
    });
  };
  var ekAdd = m.querySelector('#ekAdd');
  if (ekAdd) ekAdd.onclick = function () {
    var nr = document.getElementById('ekNr').value.trim();
    var name = document.getElementById('ekName').value.trim();
    var vorlage = document.getElementById('ekVorlage').value;
    if (!nr || !name) { alert('Bitte Kontonummer und Bezeichnung eingeben.'); return; }
    if (SKR04.kontoFinden(nr)) {
      alert('Konto ' + nr + ' gibt es bereits — bitte eine andere Nummer wählen.'); return;
    }
    if (!S.unternehmen) { alert('Bitte zuerst die Unternehmensdaten anlegen.'); return; }
    var v = SKR04.kontoFinden(vorlage);
    if (!v) { alert('Vorlage-Konto nicht gefunden.'); return; }
    S.unternehmen.eigeneKonten = S.unternehmen.eigeneKonten || [];
    S.unternehmen.eigeneKonten.push({ nr: nr, name: name, vorlage: vorlage,
      seite: v.seite, pos: v.pos, kat: v.kat });
    Store.speichereUnternehmen(S.unternehmen).then(function (g) {
      if (g && !g.fehler) S.unternehmen = g;
      hinweisToast('Konto ' + nr + ' angelegt.');
      renderBuchhaltung(m);
    });
  };
  m.querySelectorAll('[data-ekdel]').forEach(function (el) {
    el.onclick = function () {
      if (!S.unternehmen || !S.unternehmen.eigeneKonten) return;
      if (!confirm('Eigenes Konto löschen? Bereits gebuchte Sätze behalten die ' +
        'Kontonummer, verlieren aber die Bezeichnung.')) return;
      S.unternehmen.eigeneKonten.splice(parseInt(el.dataset.ekdel, 10), 1);
      Store.speichereUnternehmen(S.unternehmen).then(function (g) {
        if (g && !g.fehler) S.unternehmen = g;
        renderBuchhaltung(m);
      });
    };
  });
  m.querySelectorAll('[data-regeldel]').forEach(function (el) {
    el.onclick = function () {
      if (!S.unternehmen || !S.unternehmen.kontierungsregeln) return;
      S.unternehmen.kontierungsregeln.splice(parseInt(el.dataset.regeldel, 10), 1);
      Store.speichereUnternehmen(S.unternehmen).then(function (g) {
        if (g && !g.fehler) S.unternehmen = g;
        renderBuchhaltung(m);
      });
    };
  });
  // Hilfsfunktion: Vorlage als Buchungsentwurf ins Formular schreiben
  function uebernehmeVorlage(v) {
    if (!v) return;
    var datumF = document.getElementById('buDatum');
    var datum = (datumF && datumF.value) || a.stichtag || '';
    var b = Vorlagen.anwenden(v, datum);
    document.getElementById('buText').value = b.text || '';
    document.getElementById('buSoll').value = b.soll || document.getElementById('buSoll').value;
    document.getElementById('buHaben').value = b.haben || document.getElementById('buHaben').value;
    if (b.betrag) document.getElementById('buBetrag').value = b.betrag;
    if (b.datum && datumF) datumF.value = b.datum;
    // Bei wiederkehrenden Vorlagen merken, wann zuletzt angewendet wurde.
    if (v.wiederkehrend) {
      Vorlagen.markiereAusgefuehrt(v, datum);
      Store.speichereUnternehmen(S.unternehmen).then(function (g) {
        if (g && !g.fehler) S.unternehmen = g;
      });
    }
    document.getElementById('buBetrag').focus();
  }

  // Vorlage auf das Erfassungsformular anwenden (Dropdown im Formular)
  var buVorl = m.querySelector('#buVorlage');
  if (buVorl) buVorl.onchange = function () {
    var i = parseInt(buVorl.value, 10);
    if (!isFinite(i)) return;
    uebernehmeVorlage(vorlagen[i]);
    buVorl.selectedIndex = 0;
  };
  // "Übernehmen"-Knopf in der Fälligkeits-Hinweisbox
  m.querySelectorAll('[data-faellig]').forEach(function (el) {
    el.onclick = function () {
      var idx = parseInt(el.dataset.faellig, 10);
      if (!isFinite(idx) || !faelligeListe[idx]) return;
      uebernehmeVorlage(faelligeListe[idx].vorlage);
      renderBuchhaltung(m);
    };
  });
  var vorlAdd = m.querySelector('#vorlAdd');
  if (vorlAdd) vorlAdd.onclick = function () {
    var v = {
      name: document.getElementById('vorlName').value.trim(),
      text: document.getElementById('vorlText').value.trim(),
      betrag: document.getElementById('vorlBetrag').value.trim(),
      soll: document.getElementById('vorlSoll').value,
      haben: document.getElementById('vorlHaben').value
    };
    if (v.betrag) v.betrag = Berechnung.num(v.betrag);
    var takt = document.getElementById('vorlTakt').value;
    if (takt) v.wiederkehrend = { takt: takt };
    var p = Vorlagen.pruefe(v);
    if (!p.ok) { alert('Vorlage ungültig:\n• ' + p.fehler.join('\n• ')); return; }
    if (!S.unternehmen) { alert('Bitte zuerst die Unternehmensdaten anlegen.'); return; }
    S.unternehmen.eigeneVorlagen = S.unternehmen.eigeneVorlagen || [];
    S.unternehmen.eigeneVorlagen.push(v);
    Store.speichereUnternehmen(S.unternehmen).then(function (g) {
      if (g && !g.fehler) S.unternehmen = g;
      hinweisToast('Vorlage „' + v.name + '" gespeichert.');
      renderBuchhaltung(m);
    });
  };
  m.querySelectorAll('[data-vorldel]').forEach(function (el) {
    el.onclick = function () {
      if (!S.unternehmen || !S.unternehmen.eigeneVorlagen) return;
      var sortL = Vorlagen.sortiert(S.unternehmen.eigeneVorlagen);
      var ziel = sortL[parseInt(el.dataset.vorldel, 10)];
      if (!ziel) return;
      if (!confirm('Vorlage „' + (ziel.name || '') + '" löschen?')) return;
      S.unternehmen.eigeneVorlagen = S.unternehmen.eigeneVorlagen
        .filter(function (x) { return x !== ziel; });
      Store.speichereUnternehmen(S.unternehmen).then(function (g) {
        if (g && !g.fehler) S.unternehmen = g;
        renderBuchhaltung(m);
      });
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
    var anzahl = (a.buchungen || []).filter(function (b) {
      return !b.storniert;
    }).length;
    Belege.sha256Hex(txt).then(function (hash) {
      var letzter = a.letzterDatevExport;
      var diffText = '';
      if (letzter && letzter.hash) {
        if (letzter.hash === hash) {
          diffText = 'Inhalt identisch zur letzten Ausgabe (' +
            datumDe((letzter.zeit || '').slice(0, 10)) + ').';
        } else {
          var dn = anzahl - (letzter.anzahl || 0);
          diffText = 'Geändert seit letztem Export (' +
            datumDe((letzter.zeit || '').slice(0, 10)) + '): ' +
            (dn === 0 ? 'gleiche Anzahl, andere Buchungen'
              : (dn > 0 ? '+' + dn : dn) + ' Buchung(en) Differenz') + '.';
        }
      } else {
        diffText = 'Erster DATEV-Export für diesen Abschluss (' + anzahl + ' Buchungen).';
      }
      a.letzterDatevExport = { hash: hash, anzahl: anzahl, zeit: new Date().toISOString() };
      speichereStill().then(function () {
        ladeDatei(txt, 'EXTF_Buchungsstapel_' + (a.bezeichnung || 'Abschluss')
          .replace(/[^\w]+/g, '_') + '.csv', 'text/csv;charset=utf-8');
        hinweisToast(diffText);
      });
    }).catch(function () {
      // Hash nicht verfuegbar -> Export trotzdem ausliefern
      ladeDatei(txt, 'EXTF_Buchungsstapel_' + (a.bezeichnung || 'Abschluss')
        .replace(/[^\w]+/g, '_') + '.csv', 'text/csv;charset=utf-8');
    });
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
    /* PDF (ZUGFeRD/Factur-X) am Dateinamen oder MIME-Typ erkennen — der
     * Stream wird dann binär gelesen, das PDF/A-3-Attachment extrahiert und
     * die eingebettete XML an parseERechnung weitergereicht. Alles andere
     * (.xml) wird wie bisher als Text gelesen. Zusätzlich wird der SHA-256
     * der Quelldatei in parsed.dateiHash gesetzt — Grundlage für die
     * Duplikatserkennung in eRechnungVorschau. */
    var istPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
    rd.onerror = function () { alert('Die Datei konnte nicht gelesen werden.'); };
    if (istPdf) {
      rd.onload = function () {
        var box = m.querySelector('#erVorschau');
        if (box) box.innerHTML = '<div class="karte-hint" style="margin-top:10px">' +
          'PDF wird entpackt &hellip;</div>';
        var bytes = new Uint8Array(rd.result);
        Promise.all([
          Importe.parseERechnungPdf(bytes).catch(function (err) {
            return { fehler: 'PDF-Anhang konnte nicht entpackt werden: ' +
                     (err && err.message || err) };
          }),
          Belege.sha256Hex(bytes)
        ]).then(function (res) {
          var parsed = res[0] || {};
          parsed.dateiHash = res[1];
          eRechnungVorschau(m, a, kontoOpt, parsed);
        });
      };
      rd.readAsArrayBuffer(f);
    } else {
      rd.onload = function () {
        var parsed = Importe.parseERechnung(rd.result) || {};
        Belege.sha256Hex(rd.result).then(function (h) {
          parsed.dateiHash = h;
          eRechnungVorschau(m, a, kontoOpt, parsed);
        });
      };
      rd.readAsText(f);
    }
  };
}

/* ===========================================================================
 * Kunden-Stammdaten + eigene Rechnungs-Angaben
 * ---------------------------------------------------------------------------
 * View 'kunden': pflegt die Liste der Rechnungs-Adressaten sowie die eigenen
 * Angaben, die in Ausgangsrechnungen erscheinen (Bank, USt-IdNr., HR-Nr.,
 * Ansprechpartner). Beide werden in S.unternehmen mitgepflegt.
 * ========================================================================= */

/* Hängt an USt-ID-Inputs (data-ra="ustId", data-k="ustId") einen kleinen
 * Status-Span an, der nach jeder Eingabe rot/orange/grün die Strukturprüfung
 * anzeigt. Online-Abgleich beim BZSt/VIES findet hier ausdrücklich nicht
 * statt — nur Format und (für DE/AT/NL/IT) Prüfziffer. */
function bindeUstIdChecks(container) {
  if (typeof UstId === 'undefined') return;
  var inputs = container.querySelectorAll('input[data-ra="ustId"], input[data-k="ustId"]');
  inputs.forEach(function (el) {
    if (el.dataset.ustidBound) return;
    el.dataset.ustidBound = '1';
    var span = document.createElement('span');
    span.style.cssText = 'margin-left:8px;font-size:12px;display:inline-block';
    el.insertAdjacentElement('afterend', span);
    function check() {
      var v = el.value.trim();
      if (!v) { span.textContent = ''; return; }
      var r = UstId.pruefe(v);
      if (!r.ok) {
        span.textContent = '✗ ' + (r.fehler || 'ungültig');
        span.style.color = '#a4262c';
      } else if (r.hinweis) {
        span.textContent = '✓ Format ok (' + r.land + ', Prüfziffer nicht implementiert)';
        span.style.color = '#8a6700';
      } else {
        span.textContent = '✓ ' + r.land + ' — Format + Prüfziffer ok';
        span.style.color = '#1a8a31';
      }
    }
    el.addEventListener('input', check);
    el.addEventListener('blur', check);
    check();
  });
}

function renderKunden(m) {
  if (!S.unternehmen) {
    alert('Bitte zuerst die Unternehmensdaten anlegen.'); setView('stammdaten'); return;
  }
  var u = Ausgangsrechnung.defaults(S.unternehmen);
  var eigene = u.rechnungsAngaben || {};
  if (!eigene.bank) eigene.bank = {};
  function ev(pfad, label, sub, typ) {
    var v = getNested(eigene, pfad);
    return feldWrap(label, sub, '<input data-ra="' + pfad + '" type="' + (typ || 'text') +
      '" value="' + esc(v == null ? '' : v) + '">');
  }
  function fv(pfad, label, sub, typ) {
    var v = getNested(u, pfad);
    return feldWrap(label, sub, '<input data-u="' + pfad + '" type="' + (typ || 'text') +
      '" value="' + esc(v == null ? '' : v) + '">');
  }
  var html = '';
  html += '<div class="kopf"><h1>Kunden &amp; Rechnungs-Angaben</h1>' +
          '<p>Diese Angaben erscheinen auf Ihren Ausgangsrechnungen ' +
          'und in den erzeugten XRechnungs-Dateien.</p></div>';

  /* --- Eigene Rechnungs-Angaben ------------------------------------------ */
  html += '<div class="karte"><h2>Eigene Rechnungs-Angaben</h2>' +
          '<div class="karte-hint">Was leer bleibt, wird aus den ' +
          '<a href="#" data-z-stammdaten>Unternehmensdaten</a> ' +
          'übernommen. Wenn Sie hier explizit etwas eintragen, hat das auf der ' +
          'Rechnung Vorrang.</div>';
  html += '<div class="gitter g2">';
  html += ev('name',            'Name auf der Rechnung',  'optional, sonst Firmenname');
  html += ev('strasse',         'Straße + Hausnr.',       'optional');
  html += '<div class="gitter g2" style="gap:13px">' +
          ev('plz',             'PLZ') +
          ev('ort',             'Ort') + '</div>';
  html += ev('stNr',            'Steuernummer',           'wird ausgewiesen, wenn keine USt-IdNr. vorhanden');
  html += ev('ustId',           'USt-IdNr.',              'z. B. DE298765432 — Pflicht bei §13b/innergem.');
  html += ev('registergericht', 'Registergericht');
  html += ev('hrNummer',        'HR-Nummer',              'z. B. HRB 38120');
  html += ev('ansprechpartner', 'Ansprechpartner',        'erscheint im Kontaktblock');
  html += ev('telefon',         'Telefon');
  html += ev('email',           'E-Mail');
  html += '</div>';
  html += '<h3 style="margin-top:14px">Bankverbindung (für SEPA-PaymentMeans)</h3>';
  html += '<div class="gitter g2">';
  html += ev('bank.iban',       'IBAN');
  html += ev('bank.bic',        'BIC',                    'optional');
  html += ev('bank.institut',   'Kreditinstitut',         'optional');
  html += '</div>';
  html += '<div class="btn-reihe"><button class="btn btn-pri" id="raSpeichern">' +
          'Rechnungs-Angaben speichern</button></div>';
  html += '</div>';

  /* --- Rechnungsnummernkreis -------------------------------------------- */
  html += '<div class="karte"><h2>Rechnungsnummernkreis</h2>' +
          '<div class="karte-hint">§ 14 Abs. 4 Nr. 4 UStG verlangt eine ' +
          'einmalig vergebene Rechnungsnummer. Platzhalter: ' +
          '<code>{JAHR}</code> für das Rechnungsjahr, <code>{NR:04}</code> für ' +
          'die nächste Nummer mit vier Stellen führender Null. Beim Jahreswechsel ' +
          'wird der Zähler automatisch zurückgesetzt.</div>' +
          '<div class="gitter g2">' +
          fv('rechnungsnummern.schema',    'Nummernschema', 'z. B. RE-{JAHR}-{NR:04}') +
          fv('rechnungsnummern.naechste',  'Nächste Nummer', 'einmalig manuell anpassbar, z. B. nach Migration', 'number') +
          '</div>' +
          '<div class="btn-reihe"><button class="btn" id="nrSpeichern">' +
          'Nummernkreis speichern</button></div>' +
          '</div>';

  /* --- Kundenliste ------------------------------------------------------- */
  html += '<div class="karte"><h2>Kunden</h2>' +
          '<div class="karte-hint">Liste der Rechnungs-Adressaten. Neue Kunden ' +
          'werden direkt im Rechnungs-Editor anlegbar; hier können Sie sie ' +
          'pflegen oder löschen. Beim Versenden einer Rechnung wird der ' +
          'aktuelle Kundendatensatz als Snapshot mit der Rechnung eingefroren.</div>';
  if (!u.kunden.length) {
    html += '<div class="karte-hint" style="margin-top:8px">— noch keine Kunden angelegt —</div>';
  } else {
    html += '<table class="liste"><thead><tr><th>Name</th><th>Anschrift</th>' +
            '<th>USt-IdNr.</th><th></th></tr></thead><tbody>';
    u.kunden.forEach(function (k, i) {
      html += '<tr><td><b>' + esc(k.name || '—') + '</b>' +
              (k.email ? '<br><span class="sub mono">' + esc(k.email) + '</span>' : '') +
              '</td>' +
              '<td>' + esc(k.strasse || '') + (k.strasse ? ', ' : '') +
              esc(k.plz || '') + ' ' + esc(k.ort || '') +
              (k.land && k.land !== 'DE' ? ' (' + esc(k.land) + ')' : '') + '</td>' +
              '<td class="mono">' + esc(k.ustId || '') + '</td>' +
              '<td class="rechts"><button class="btn-mini" data-kund-edit="' + i + '">bearbeiten</button> ' +
              '<button class="btn-mini btn-warn" data-kund-del="' + i + '">löschen</button></td>' +
              '</tr>';
    });
    html += '</tbody></table>';
  }
  html += '<div class="btn-reihe"><button class="btn btn-pri" id="kundNeu">+ Neuer Kunde</button></div>';
  html += '<div id="kundEditor"></div>';
  html += '</div>';

  m.innerHTML = html;

  /* Link zu Stammdaten */
  var zLink = m.querySelector('[data-z-stammdaten]');
  if (zLink) zLink.onclick = function (e) { e.preventDefault(); setView('stammdaten'); };

  /* Eigene Rechnungs-Angaben speichern */
  m.querySelector('#raSpeichern').onclick = function () {
    var neu = {};
    m.querySelectorAll('[data-ra]').forEach(function (el) {
      setNested(neu, el.dataset.ra, el.value.trim());
    });
    var un = JSON.parse(JSON.stringify(u));
    un.rechnungsAngaben = neu;
    Store.speichereUnternehmen(un).then(function (g) {
      if (g && !g.fehler) { S.unternehmen = g; hinweisToast('Rechnungs-Angaben gespeichert.'); }
    });
  };

  /* Nummernkreis speichern */
  m.querySelector('#nrSpeichern').onclick = function () {
    var un = JSON.parse(JSON.stringify(u));
    un.rechnungsnummern = un.rechnungsnummern || {};
    un.rechnungsnummern.schema = m.querySelector('[data-u="rechnungsnummern.schema"]').value.trim()
      || 'RE-{JAHR}-{NR:04}';
    var n = parseInt(m.querySelector('[data-u="rechnungsnummern.naechste"]').value, 10);
    if (!(n > 0)) n = 1;
    un.rechnungsnummern.naechste = n;
    Store.speichereUnternehmen(un).then(function (g) {
      if (g && !g.fehler) { S.unternehmen = g; hinweisToast('Nummernkreis gespeichert.'); }
    });
  };

  /* Kunden-Aktionen */
  m.querySelectorAll('[data-kund-edit]').forEach(function (b) {
    b.onclick = function () { renderKundeBearbeiten(m, parseInt(b.dataset.kundEdit, 10)); };
  });
  m.querySelectorAll('[data-kund-del]').forEach(function (b) {
    b.onclick = function () {
      var i = parseInt(b.dataset.kundDel, 10);
      var k = u.kunden[i];
      if (!confirm('Kunde „' + (k && k.name || '') + '" wirklich löschen?')) return;
      var un = JSON.parse(JSON.stringify(u));
      un.kunden.splice(i, 1);
      Store.speichereUnternehmen(un).then(function (g) {
        if (g && !g.fehler) { S.unternehmen = g; hinweisToast('Kunde gelöscht.'); renderKunden(m); }
      });
    };
  });
  m.querySelector('#kundNeu').onclick = function () { renderKundeBearbeiten(m, -1); };

  bindeUstIdChecks(m);
}

/* Inline-Editor für einen Kunden. idx === -1 → neuer Kunde. */
function renderKundeBearbeiten(m, idx) {
  var u = Ausgangsrechnung.defaults(S.unternehmen);
  var bestehend = idx >= 0 ? u.kunden[idx] : null;
  var k = bestehend ? JSON.parse(JSON.stringify(bestehend))
                    : { id: 'K-' + Date.now(), name: '', strasse: '', plz: '', ort: '',
                        land: 'DE', ustId: '', email: '' };
  var box = m.querySelector('#kundEditor');
  function f(name, label, sub, typ) {
    return feldWrap(label, sub, '<input data-k="' + name + '" type="' + (typ || 'text') +
      '" value="' + esc(k[name] || '') + '">');
  }
  /* VIES-Online-Check nur im Selbst-Hosting-Modus anbieten — Browser-Modus
   * würde an CORS scheitern, und wir wollen keinen Drittanbieter-Proxy. */
  var serverModus = (typeof Store !== 'undefined' && Store.modus !== 'website');
  var letzterCheck = k.ustIdPruefung;
  var checkInfo = '';
  if (letzterCheck) {
    var dat = (letzterCheck.antwortAm || '').slice(0, 10);
    checkInfo = '<div class="karte-hint" style="margin-top:6px">' +
      (letzterCheck.gueltig
        ? '<span style="color:#1a8a31">✓ VIES bestätigte am ' + esc(dat) + '</span>'
        : '<span style="color:#a4262c">✗ VIES am ' + esc(dat) +
          ': ' + esc(letzterCheck.fehler || 'als ungültig zurückgemeldet') + '</span>') +
      (letzterCheck.name ? '<br>Name lt. VIES: ' + esc(letzterCheck.name) : '') +
      (letzterCheck.adresse ? '<br>Adresse: ' + esc(letzterCheck.adresse) : '') +
      '</div>';
  }
  box.innerHTML = '<div class="karte" style="margin-top:10px"><h3>' +
    (idx >= 0 ? 'Kunde bearbeiten' : 'Neuer Kunde') + '</h3>' +
    '<div class="gitter g2">' +
    f('name',    'Name / Firma') +
    f('strasse', 'Straße + Hausnr.') +
    '<div class="gitter g2" style="gap:13px">' + f('plz', 'PLZ') + f('ort', 'Ort') + '</div>' +
    f('land',    'Land',        'ISO-2 (DE, AT, FR, …)') +
    f('ustId',   'USt-IdNr.',   'z. B. DE123456789 — Pflicht bei §13b / innergem.') +
    f('email',   'E-Mail') +
    '</div>' +
    checkInfo +
    (serverModus ?
      '<div class="btn-reihe" style="margin-top:6px">' +
      '<button class="btn" id="kundVies">USt-IdNr. online bei VIES prüfen</button>' +
      '<span id="kundViesMsg" class="sub" style="margin-left:10px"></span>' +
      '</div>' : '') +
    '<div class="btn-reihe">' +
    '<button class="btn btn-pri" id="kundSave">Speichern</button> ' +
    '<button class="btn" id="kundAbort">Abbrechen</button>' +
    '</div></div>';
  bindeUstIdChecks(box);
  var viesBtn = box.querySelector('#kundVies');
  if (viesBtn) viesBtn.onclick = function () {
    var ust = box.querySelector('[data-k="ustId"]').value.trim();
    if (!ust) { alert('Bitte eine USt-IdNr. eingeben.'); return; }
    var hin = 'OpenBilanz fragt jetzt die EU-Datenbank VIES nach ' + ust +
              '. Dabei wird die Nummer (und nichts sonst) an ' +
              'ec.europa.eu/taxation_customs/vies übertragen. Fortfahren?';
    if (!confirm(hin)) return;
    var msg = box.querySelector('#kundViesMsg');
    msg.textContent = 'Frage VIES …';
    msg.style.color = '';
    fetch('/api/ustid/check?ustid=' + encodeURIComponent(ust))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.fehler) {
          msg.textContent = '✗ ' + d.fehler;
          msg.style.color = '#a4262c';
          k.ustIdPruefung = { antwortAm: d.antwortAm || new Date().toISOString(),
            gueltig: false, fehler: d.fehler, quelle: 'VIES' };
          return;
        }
        k.ustIdPruefung = d;
        msg.textContent = d.gueltig
          ? '✓ VIES bestätigt: ' + (d.name || ust)
          : '✗ VIES: USt-IdNr. ist nicht gültig.';
        msg.style.color = d.gueltig ? '#1a8a31' : '#a4262c';
        renderKundeBearbeiten(m, idx);
      }, function (err) {
        msg.textContent = '✗ Anfrage fehlgeschlagen: ' + (err && err.message || err);
        msg.style.color = '#a4262c';
      });
  };
  box.querySelector('#kundAbort').onclick = function () { box.innerHTML = ''; };
  box.querySelector('#kundSave').onclick = function () {
    box.querySelectorAll('[data-k]').forEach(function (el) {
      k[el.dataset.k] = el.value.trim();
    });
    if (!k.name) { alert('Bitte einen Namen eingeben.'); return; }
    if (!k.land) k.land = 'DE';
    var nun = new Date().toISOString().slice(0, 10);
    if (!k.angelegtAm) k.angelegtAm = nun;
    k.geaendertAm = nun;
    var un = JSON.parse(JSON.stringify(u));
    if (idx >= 0) un.kunden[idx] = k; else un.kunden.push(k);
    Store.speichereUnternehmen(un).then(function (g) {
      if (g && !g.fehler) {
        S.unternehmen = g;
        hinweisToast(idx >= 0 ? 'Kunde gespeichert.' : 'Kunde angelegt.');
        renderKunden(m);
      }
    });
  };
}

/* ===========================================================================
 * Ausgangsrechnungen — Liste, Editor, Vorschau, Versand, XML-Download
 * ---------------------------------------------------------------------------
 * View 'rechnungen' (Sub-View eines Abschlusses): pflegt die ausgehenden
 * Rechnungen eines Jahres. Entwürfe lassen sich frei bearbeiten; beim
 * „Versenden" wird die Rechnung mit einer lückenlosen Nummer aus dem
 * Nummernkreis versehen, der Buchungssatz (Forderung an Erlöse + USt) in
 * a.buchungen eingefügt und beides GoBD-konform festgeschrieben (fest=true).
 * Die XRechnung-UBL-XML kann jederzeit als Download abgerufen werden.
 * ========================================================================= */

/* Steuerlogik-Auswahl für das UI. Reihenfolge bewusst: häufigster Fall zuerst. */
var AR_STEUERFAELLE = [
  ['NORMAL',              'Inland mit USt-Ausweis (Regelfall)'],
  ['REVERSE_CHARGE_13b',  '§ 13b UStG — Steuerschuldnerschaft des Empfängers'],
  ['INNERGEM_LIEFERUNG',  'Innergemeinschaftliche Lieferung steuerfrei (§ 4 Nr. 1 b)'],
  ['INNERGEM_LEISTUNG',   'EU-Sonstige Leistung — Reverse-Charge (§ 3a Abs. 2)'],
  ['KLEINUNTERNEHMER_19', '§ 19 UStG — Kleinunternehmer ohne USt-Ausweis'],
  ['STEUERFREI_§4',       'Steuerfrei nach § 4 UStG']
];
/* Gebräuchliche UN/ECE-Recommendation-20-Einheiten für die Schnellauswahl. */
var AR_EINHEITEN = [
  ['C62', 'Stück'], ['HUR', 'Stunde'], ['DAY', 'Tag'], ['MTR', 'Meter'],
  ['MTQ', 'm²'], ['MTK', 'm³'], ['KGM', 'kg'], ['LTR', 'Liter'],
  ['EA',  'Einheit'], ['MIN', 'Minute'], ['MON', 'Monat']
];

function renderRechnungen(m) {
  var a = S.aktiv;
  if (!a) { setView('start'); return; }
  if (!a.ausgangsrechnungen) a.ausgangsrechnungen = [];
  /* Sub-Routing: ?id=... rendert direkt den Editor für diese Rechnung. */
  var html = '';
  html += '<div class="kopf"><h1>Ausgangsrechnungen</h1>' +
          '<p>Rechnungen dieses Geschäftsjahres. Entwürfe bleiben editierbar; ' +
          'beim Versenden wird die Nummer aus dem Nummernkreis vergeben und der ' +
          'Buchungssatz automatisch in die Buchhaltung übernommen.</p></div>';

  /* Status-Zähler */
  var entw = 0, vers = 0, stor = 0;
  a.ausgangsrechnungen.forEach(function (r) {
    if (r.status === 'VERSENDET') vers++;
    else if (r.status === 'STORNIERT') stor++;
    else entw++;
  });
  html += '<div class="karte"><h2>Übersicht</h2>' +
    '<table class="liste" style="max-width:380px"><tbody>' +
    '<tr><td>Entwürfe</td><td class="rechts mono">' + entw + '</td></tr>' +
    '<tr><td>Versendet</td><td class="rechts mono">' + vers + '</td></tr>' +
    '<tr><td>Storniert</td><td class="rechts mono">' + stor + '</td></tr>' +
    '</tbody></table></div>';

  /* Liste */
  html += '<div class="karte"><h2>Rechnungen</h2>';
  if (!a.ausgangsrechnungen.length) {
    html += '<div class="karte-hint">— noch keine Rechnungen erstellt —</div>';
  } else {
    html += '<table class="liste"><thead><tr><th>Nummer</th><th>Datum</th>' +
            '<th>Kunde</th><th class="rechts">Brutto</th><th>Status</th>' +
            '<th></th></tr></thead><tbody>';
    /* neueste zuerst */
    a.ausgangsrechnungen.slice().reverse().forEach(function (r) {
      var idx = a.ausgangsrechnungen.indexOf(r);
      var kname = (r.kundeSnapshot && r.kundeSnapshot.name) || '—';
      html += '<tr><td class="mono">' + esc(r.nummer || '(Entwurf)') + '</td>' +
              '<td class="mono">' + datumDe(r.datum) + '</td>' +
              '<td>' + esc(kname) + '</td>' +
              '<td class="rechts mono">' + geld(r.brutto || 0) + '</td>' +
              '<td>' + esc(r.status || 'ENTWURF') + (r.fest ? ' 🔒' : '') + '</td>' +
              '<td class="rechts">' +
              '<button class="btn-mini" data-ar-edit="' + idx + '">' +
              (r.fest ? 'ansehen' : 'bearbeiten') + '</button> ' +
              '<button class="btn-mini" data-ar-xml="' + idx + '">XML</button>' +
              (r.fest ? '' : ' <button class="btn-mini btn-warn" data-ar-del="' + idx + '">löschen</button>') +
              '</td></tr>';
    });
    html += '</tbody></table>';
  }
  html += '<div class="btn-reihe">' +
          '<button class="btn btn-pri" id="arNeu">+ Neue Rechnung</button>' +
          '</div></div>';

  html += '<div id="arEditor"></div>';

  m.innerHTML = html;

  m.querySelector('#arNeu').onclick = function () { arEditor(m, -1); };
  m.querySelectorAll('[data-ar-edit]').forEach(function (b) {
    b.onclick = function () { arEditor(m, parseInt(b.dataset.arEdit, 10)); };
  });
  m.querySelectorAll('[data-ar-xml]').forEach(function (b) {
    b.onclick = function () { arXmlDownload(parseInt(b.dataset.arXml, 10)); };
  });
  m.querySelectorAll('[data-ar-del]').forEach(function (b) {
    b.onclick = function () {
      var i = parseInt(b.dataset.arDel, 10);
      var r = a.ausgangsrechnungen[i];
      if (r && r.fest) { alert('Versendete Rechnungen können nicht gelöscht werden.'); return; }
      if (!confirm('Rechnungs-Entwurf löschen?')) return;
      a.ausgangsrechnungen.splice(i, 1);
      speichereStill().then(function () { renderRechnungen(m); });
    };
  });
}

/* Inline-Editor für eine Rechnung. idx === -1 → neuer Entwurf. */
function arEditor(m, idx) {
  var a = S.aktiv;
  if (!S.unternehmen) { alert('Bitte zuerst Unternehmensdaten anlegen.'); return; }
  var u = Ausgangsrechnung.defaults(S.unternehmen);
  var bestehend = idx >= 0 ? a.ausgangsrechnungen[idx] : null;
  var r = bestehend ? JSON.parse(JSON.stringify(bestehend))
                    : arNeuEntwurf(a, u);
  var fest = !!r.fest;
  /* Hilfsfunktion: Kundenliste als <option> */
  function kundenOpt() {
    if (!u.kunden.length) {
      return '<option value="">— noch keine Kunden — </option>';
    }
    return '<option value="">— Kunde wählen —</option>' +
      u.kunden.map(function (k) {
        return '<option value="' + esc(k.id) + '"' +
               (r.kundeId === k.id ? ' selected' : '') + '>' +
               esc(k.name) + (k.ort ? ' · ' + esc(k.ort) : '') + '</option>';
      }).join('');
  }
  function fall(v, lab) {
    return '<option value="' + esc(v) + '"' +
           (r.besonderheit === v ? ' selected' : '') + '>' + esc(lab) + '</option>';
  }
  function einheitOpt(sel) {
    return AR_EINHEITEN.map(function (e) {
      return '<option value="' + e[0] + '"' + (sel === e[0] ? ' selected' : '') +
        '>' + e[0] + ' (' + e[1] + ')</option>';
    }).join('');
  }
  function ro(t) { return fest ? ' readonly disabled' : ''; }
  function disabled() { return fest ? ' disabled' : ''; }

  /* Positionen-Block */
  function posTab() {
    var rows = (r.positionen || []).map(function (p, i) {
      return '<tr data-ar-pos="' + i + '">' +
        '<td><input type="text" data-pf="bezeichnung" value="' + esc(p.bezeichnung || '') + '"' + ro() + '></td>' +
        '<td><input type="number" step="0.0001" min="0" data-pf="menge" value="' +
          esc(p.menge != null ? p.menge : '') + '"' + ro() + ' style="width:90px"></td>' +
        '<td><select data-pf="einheit"' + disabled() + '>' + einheitOpt(p.einheit || 'C62') + '</select></td>' +
        '<td><input type="number" step="0.01" min="0" data-pf="einzelpreis" value="' +
          esc(p.einzelpreis != null ? p.einzelpreis : '') + '"' + ro() + ' style="width:110px"></td>' +
        '<td><input type="number" step="0.01" min="0" data-pf="ustSatz" value="' +
          esc(p.ustSatz != null ? p.ustSatz : '') + '"' + ro() + ' style="width:70px"></td>' +
        '<td class="rechts mono">' + geld(Berechnung.num(p.menge) * Berechnung.num(p.einzelpreis)) + '</td>' +
        '<td>' + (fest ? '' :
          '<button class="btn-mini btn-warn" data-pos-del="' + i + '">×</button>') + '</td>' +
        '</tr>';
    }).join('');
    return '<table class="liste"><thead><tr><th>Bezeichnung</th><th>Menge</th>' +
      '<th>Einheit</th><th>Einzelpreis</th><th>USt %</th>' +
      '<th class="rechts">Netto-Position</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      (fest ? '' :
        '<div class="btn-reihe"><button class="btn" id="posAdd">+ Position</button></div>');
  }

  var box = m.querySelector('#arEditor');
  var html = '<div class="karte" style="margin-top:10px">';
  html += '<h3>' + (fest ? 'Rechnung ansehen ' : (idx >= 0 ? 'Rechnung bearbeiten' : 'Neue Rechnung')) +
          (r.nummer ? ' — <span class="mono">' + esc(r.nummer) + '</span>' : '') +
          (fest ? ' 🔒' : '') + '</h3>';
  if (!u.kunden.length) {
    html += '<div class="box box-info" style="margin-bottom:10px">' +
            'Noch keine Kunden angelegt. ' +
            '<a href="#" data-z-kunden>Jetzt zur Kundenverwaltung</a> wechseln, ' +
            'um den ersten Kunden anzulegen.</div>';
  }
  html += '<div class="gitter g2">';
  html += feldWrap('Kunde', '', '<select data-r="kundeId"' + disabled() + '>' + kundenOpt() + '</select>');
  html += feldWrap('Steuerlogik', '', '<select data-r="besonderheit"' + disabled() + '>' +
    AR_STEUERFAELLE.map(function (s) { return fall(s[0], s[1]); }).join('') + '</select>');
  html += feldWrap('Rechnungsdatum', '', '<input type="date" data-r="datum" value="' + esc(r.datum || '') + '"' + ro() + '>');
  html += feldWrap('Leistungsdatum',
    'oder Zeitraum unten — eines ist Pflicht',
    '<input type="date" data-r="leistungsdatum" value="' + esc(r.leistungsdatum || '') + '"' + ro() + '>');
  html += feldWrap('Leistungszeitraum von', 'optional',
    '<input type="date" data-r="leistungszeitraumVon" value="' + esc(r.leistungszeitraumVon || '') + '"' + ro() + '>');
  html += feldWrap('Leistungszeitraum bis', 'optional',
    '<input type="date" data-r="leistungszeitraumBis" value="' + esc(r.leistungszeitraumBis || '') + '"' + ro() + '>');
  html += feldWrap('Fälligkeit', 'BT-9 PaymentDueDate',
    '<input type="date" data-r="faelligkeit" value="' + esc(r.faelligkeit || '') + '"' + ro() + '>');
  html += feldWrap('Zahlungsbedingungen', '',
    '<input type="text" data-r="zahlungsbedingungen" value="' + esc(r.zahlungsbedingungen || '') + '"' + ro() + '>');
  html += feldWrap('Bestell-/Auftragsnr.', 'optional, BT-13',
    '<input type="text" data-r="bestellnr" value="' + esc(r.bestellnr || '') + '"' + ro() + '>');
  html += feldWrap('Leitweg-ID (B2G)', 'optional, BT-10; ohne Eintrag wird Kundenname gesetzt',
    '<input type="text" data-r="leitwegId" value="' + esc(r.leitwegId || '') + '"' + ro() + '>');
  html += '</div>';
  html += '<h4 style="margin-top:14px">Positionen</h4>';
  html += '<div id="posBlock">' + posTab() + '</div>';
  html += '<h4 style="margin-top:14px">Hinweis-Text</h4>';
  html += feldWrap('Freitext für die Rechnungs-Note', 'erscheint zusätzlich zum Steuerhinweis',
    '<input type="text" data-r="hinweis" value="' + esc(r.hinweis || '') + '"' + ro() + '>');
  /* Live-Vorschau */
  html += '<div id="arVorschau" class="box" style="margin-top:14px"></div>';
  /* Aktionen */
  if (fest) {
    html += '<div class="btn-reihe">' +
      '<button class="btn btn-pri" id="arXml">XRechnung-UBL herunterladen</button> ' +
      '<button class="btn" id="arXmlCii">XRechnung-CII herunterladen</button> ' +
      '<button class="btn" id="arPdf" hidden>ZUGFeRD-PDF herunterladen</button> ' +
      '<button class="btn" id="arClose">Schließen</button>' +
      '</div>';
  } else {
    html += '<div class="btn-reihe">' +
      '<button class="btn btn-pri" id="arSpeichern">Entwurf speichern</button> ' +
      '<button class="btn btn-pri" id="arSenden">Versenden &amp; festschreiben</button> ' +
      '<button class="btn" id="arXml">XRechnung-UBL (Entwurf) herunterladen</button> ' +
      '<button class="btn" id="arXmlCii">XRechnung-CII (Entwurf) herunterladen</button> ' +
      '<button class="btn" id="arPdf" hidden>ZUGFeRD-PDF (Entwurf) herunterladen</button> ' +
      '<button class="btn" id="arClose">Schließen</button>' +
      '</div>';
  }
  html += '</div>';
  box.innerHTML = html;

  /* Sync von Eingaben in das Modell + Live-Vorschau */
  function lese() {
    box.querySelectorAll('[data-r]').forEach(function (el) {
      if (el.disabled) return;
      r[el.dataset.r] = el.value;
    });
    box.querySelectorAll('[data-ar-pos]').forEach(function (tr) {
      var i = parseInt(tr.dataset.arPos, 10);
      var p = r.positionen[i];
      tr.querySelectorAll('[data-pf]').forEach(function (el) {
        if (el.disabled) return;
        var f = el.dataset.pf;
        if (f === 'menge' || f === 'einzelpreis' || f === 'ustSatz') {
          p[f] = Berechnung.num(el.value);
        } else {
          p[f] = el.value;
        }
      });
    });
    /* Kunde-Snapshot synchron halten, solange Entwurf */
    if (r.kundeId) {
      var k = u.kunden.find(function (x) { return x.id === r.kundeId; });
      if (k) r.kundeSnapshot = JSON.parse(JSON.stringify(k));
    } else {
      r.kundeSnapshot = r.kundeSnapshot || {};
    }
    var s = XRechnungUBL.summen(r);
    r.netto = s.netto; r.ust = s.ust; r.brutto = s.brutto;
  }
  function aktualisiereVorschau() {
    lese();
    var eigene = Ausgangsrechnung.eigeneAusUnternehmen(S.unternehmen);
    var pr = XRechnungUBL.pruefe(r, eigene);
    var v = box.querySelector('#arVorschau');
    var vp = '<div class="gitter g2" style="gap:14px">';
    vp += '<div><b>Summen</b><br>' +
          '<div>Netto: <span class="mono">' + geld(r.netto) + '</span></div>' +
          '<div>USt: <span class="mono">' + geld(r.ust) + '</span></div>' +
          '<div><b>Brutto: <span class="mono">' + geld(r.brutto) + '</span></b></div>' +
          (r.nummer ? '<div>Nummer: <span class="mono">' + esc(r.nummer) + '</span></div>' :
            '<div>Nächste Nummer: <span class="mono">' +
            esc(Ausgangsrechnung.naechsteNummer(u, r.datum)) + '</span></div>') +
          '</div>';
    vp += '<div><b>Pflichtcheck</b><br>';
    if (pr.ok && !pr.hinweise.length) {
      vp += '<div style="color:#1a8a31">✓ Alle Pflichtfelder sind belegt.</div>';
    } else {
      if (pr.fehler.length) vp += '<ul style="margin:6px 0 0 18px;color:#a4262c">' +
        pr.fehler.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
      if (pr.hinweise.length) vp += '<ul style="margin:6px 0 0 18px">' +
        pr.hinweise.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>';
    }
    vp += '</div></div>';
    v.innerHTML = vp;
  }
  function reposTab() {
    var pb = box.querySelector('#posBlock');
    pb.innerHTML = posTab();
    bindePositionen();
    aktualisiereVorschau();
  }
  function bindePositionen() {
    box.querySelectorAll('[data-pf]').forEach(function (el) {
      el.oninput = aktualisiereVorschau;
      el.onchange = aktualisiereVorschau;
    });
    var pa = box.querySelector('#posAdd');
    if (pa) pa.onclick = function () {
      r.positionen.push({ id: 'P-' + Date.now(), bezeichnung: '', menge: 1,
        einheit: 'C62', einzelpreis: 0, ustSatz: 19 });
      reposTab();
    };
    box.querySelectorAll('[data-pos-del]').forEach(function (b) {
      b.onclick = function () {
        r.positionen.splice(parseInt(b.dataset.posDel, 10), 1);
        reposTab();
      };
    });
  }
  /* Initial-Bindings */
  box.querySelectorAll('[data-r]').forEach(function (el) {
    el.oninput = aktualisiereVorschau;
    el.onchange = aktualisiereVorschau;
  });
  bindePositionen();
  aktualisiereVorschau();
  var zk = box.querySelector('[data-z-kunden]');
  if (zk) zk.onclick = function (e) { e.preventDefault(); setView('kunden'); };

  var closeBtn = box.querySelector('#arClose');
  if (closeBtn) closeBtn.onclick = function () { box.innerHTML = ''; };

  var saveBtn = box.querySelector('#arSpeichern');
  if (saveBtn) saveBtn.onclick = function () {
    lese();
    r.status = 'ENTWURF';
    if (idx >= 0) a.ausgangsrechnungen[idx] = r;
    else a.ausgangsrechnungen.push(r);
    speichereStill().then(function () {
      hinweisToast('Entwurf gespeichert.');
      renderRechnungen(m);
    });
  };

  var sendBtn = box.querySelector('#arSenden');
  if (sendBtn) sendBtn.onclick = function () {
    lese();
    var eigene = Ausgangsrechnung.eigeneAusUnternehmen(S.unternehmen);
    var pr = XRechnungUBL.pruefe(r, eigene);
    if (!pr.ok) {
      alert('Pflichtcheck fehlgeschlagen:\n\n' + pr.fehler.join('\n'));
      return;
    }
    if (!confirm('Rechnung versenden und festschreiben?\n' +
                 'Es wird eine lückenlose Rechnungsnummer aus dem Nummernkreis vergeben, ' +
                 'der Buchungssatz wird der Buchhaltung hinzugefügt und beides GoBD-fest markiert.')) return;
    /* Tatsächlicher Vergabevorgang im Unternehmensobjekt — der Counter
     * wird in u (kopiert) gezogen, anschließend zurück nach S.unternehmen. */
    var un = JSON.parse(JSON.stringify(Ausgangsrechnung.defaults(S.unternehmen)));
    var neueNr = Ausgangsrechnung.vergebeNummer(un, r.datum);
    r.nummer = neueNr;
    r.status = 'VERSENDET';
    r.fest = true;
    r.versandAm = new Date().toISOString();
    r.protokoll = r.protokoll || [];
    r.protokoll.push({ zeit: r.versandAm, was: 'Versendet — Nummer ' + neueNr + ' vergeben.' });
    /* Buchungssätze erzeugen und in a.buchungen einfügen */
    var stamp = Date.now();
    var neueBu = Ausgangsrechnung.buchungenAusRechnung(r, String(stamp));
    neueBu.forEach(function (b) { b.fest = true; });
    a.buchungen = a.buchungen || [];
    a.buchungen.push.apply(a.buchungen, neueBu);
    r.buchungId = neueBu[0] ? neueBu[0].id : '';
    /* Rechnung in den Abschluss schreiben */
    if (idx >= 0) a.ausgangsrechnungen[idx] = r;
    else a.ausgangsrechnungen.push(r);
    /* Prüfkette für die neu festgeschriebenen Buchungen fortschreiben */
    try {
      if (typeof Pruefkette !== 'undefined' && Pruefkette.fortschreiben) {
        Pruefkette.fortschreiben(a.buchungen);
      }
    } catch (e) { /* Prüfkette ist Best-Effort */ }
    /* Unternehmens-Counter persistieren */
    Store.speichereUnternehmen(un).then(function (g) {
      if (g && !g.fehler) S.unternehmen = g;
      speichereStill().then(function () {
        hinweisToast('Rechnung ' + neueNr + ' versendet und verbucht.');
        renderNav();
        renderRechnungen(m);
      });
    });
  };

  function downloadXml(syntax) {
    lese();
    var eigene = Ausgangsrechnung.eigeneAusUnternehmen(S.unternehmen);
    /* Für Entwurfs-Download trotzdem rendern — die Nummer kann (Entwurf) sein.
     * Wir setzen für den Download eine Platzhalter-Nummer, falls keine da. */
    var rExport = JSON.parse(JSON.stringify(r));
    if (!rExport.nummer) rExport.nummer = 'ENTWURF-' + (new Date()).toISOString().slice(0, 10);
    var xml = (syntax === 'cii' ? XRechnungCII : XRechnungUBL).render(rExport, eigene);
    var suffix = syntax === 'cii' ? '_cii' : '_ubl';
    var dateiname = 'xrechnung_' + (rExport.nummer || 'ENTWURF').replace(/[^A-Za-z0-9._-]/g, '_') +
      suffix + '.xml';
    ladeDatei(xml, dateiname, 'application/xml;charset=utf-8');
  }
  var xmlBtn = box.querySelector('#arXml');
  if (xmlBtn) xmlBtn.onclick = function () { downloadXml('ubl'); };
  var xmlBtnCii = box.querySelector('#arXmlCii');
  if (xmlBtnCii) xmlBtnCii.onclick = function () { downloadXml('cii'); };

  /* ZUGFeRD-Hybrid-PDF: Knopf nur freischalten, wenn pdf-lib im vendor-
   * Verzeichnis liegt. Sonst bleibt der Knopf hidden — der User wird im
   * Demo/Setup über tools/setup-pdf-lib.sh informiert (README). */
  var pdfBtn = box.querySelector('#arPdf');
  if (pdfBtn && typeof ZugferdPdf !== 'undefined') {
    ZugferdPdf.istVerfuegbar().then(function (ok) {
      if (!ok) return;
      pdfBtn.hidden = false;
      pdfBtn.onclick = function () {
        lese();
        var eigene = Ausgangsrechnung.eigeneAusUnternehmen(S.unternehmen);
        var rExport = JSON.parse(JSON.stringify(r));
        if (!rExport.nummer) rExport.nummer = 'ENTWURF-' + (new Date()).toISOString().slice(0, 10);
        var ciiXml = XRechnungCII.render(rExport, eigene);
        pdfBtn.disabled = true; pdfBtn.textContent = 'PDF wird erzeugt …';
        ZugferdPdf.erzeuge(rExport, eigene, ciiXml).then(function (bytes) {
          pdfBtn.disabled = false;
          pdfBtn.textContent = 'ZUGFeRD-PDF herunterladen';
          var name = 'zugferd_' + (rExport.nummer || 'ENTWURF').replace(/[^A-Za-z0-9._-]/g, '_') + '.pdf';
          /* ladeDatei nimmt String — wir wrappen via Blob direkt. */
          var blob = new Blob([bytes], { type: 'application/pdf' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = name;
          document.body.appendChild(a); a.click();
          setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 1000);
        }, function (err) {
          pdfBtn.disabled = false;
          pdfBtn.textContent = 'ZUGFeRD-PDF herunterladen';
          alert('PDF konnte nicht erzeugt werden:\n\n' + (err && err.message || err));
        });
      };
    });
  }
}

/* Erzeugt einen neuen Entwurf mit sinnvollen Defaults. */
function arNeuEntwurf(a, u) {
  var heute = new Date().toISOString().slice(0, 10);
  return {
    id: 'AR-' + Date.now(),
    nummer: '',
    art: 'RECHNUNG',
    datum: heute,
    leistungsdatum: heute,
    leistungszeitraumVon: '',
    leistungszeitraumBis: '',
    kundeId: '',
    kundeSnapshot: {},
    bestellnr: '',
    leitwegId: '',
    faelligkeit: '',
    zahlungsbedingungen: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
    positionen: [{ id: 'P-' + Date.now(), bezeichnung: '', menge: 1,
                   einheit: 'C62', einzelpreis: 0, ustSatz: 19 }],
    besonderheit: (S.unternehmen && S.unternehmen.kleinunternehmer === 'ja') ?
      'KLEINUNTERNEHMER_19' : 'NORMAL',
    netto: 0, ust: 0, brutto: 0,
    hinweis: '',
    status: 'ENTWURF', fest: false,
    versandAm: '', buchungId: '',
    protokoll: []
  };
}

/* XML-Download aus der Listenansicht (ohne Editor zu öffnen). */
function arXmlDownload(idx) {
  var a = S.aktiv;
  var r = a && a.ausgangsrechnungen && a.ausgangsrechnungen[idx];
  if (!r) return;
  var eigene = Ausgangsrechnung.eigeneAusUnternehmen(S.unternehmen);
  var rExport = JSON.parse(JSON.stringify(r));
  if (!rExport.nummer) rExport.nummer = 'ENTWURF-' + (new Date()).toISOString().slice(0, 10);
  var xml = XRechnungUBL.render(rExport, eigene);
  var dateiname = 'xrechnung_' + (rExport.nummer || 'ENTWURF').replace(/[^A-Za-z0-9._-]/g, '_') + '.xml';
  ladeDatei(xml, dateiname, 'application/xml;charset=utf-8');
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

  // Datum der Eröffnungsbuchung: Ist die Quelle eine Eröffnungsbilanz, gilt
  // deren Stichtag (der Gründungstag - ggf. unterjährig) und NICHT stur der
  // 01.01.; bei einem Vorjahres-Abschluss als Quelle der Beginn des neuen
  // Geschäftsjahres (a.gjVon).
  var datum = (quelle.art === 'EROEFFNUNGSBILANZ')
    ? (quelle.stichtag || a.gjVon || a.stichtag)
    : (a.gjVon || quelle.stichtag || a.stichtag);
  datum = datum || new Date().toISOString().slice(0, 10);
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
  var trends = monatsTrend(a);
  var h = '<table class="liste"><thead><tr><th>Konto</th><th>Bezeichnung</th>' +
    '<th class="rechts">Soll</th><th class="rechts">Haben</th><th class="rechts">Saldo</th>' +
    '<th>Trend</th></tr></thead><tbody>';
  keys.forEach(function (nr) {
    var k = SKR04.kontoFinden(nr) || { name: 'unbekannt' };
    var saldo = s[nr].soll - s[nr].haben;
    h += '<tr><td class="mono">' + esc(nr) + '</td><td>' + esc(k.name) + '</td>' +
      '<td class="rechts mono">' + geld(s[nr].soll) + '</td>' +
      '<td class="rechts mono">' + geld(s[nr].haben) + '</td>' +
      '<td class="rechts mono">' + geld(saldo) + '</td>' +
      '<td>' + sparkline(trends[nr] || []) + '</td></tr>';
  });
  h += '</tbody></table>';
  return h;
}

/* Berechnet je Konto die kumulierten Monatsende-Salden ueber die Monate des
 * Geschaeftsjahres. Rueckgabe: { kontoNr: [salde_jan, salde_feb, ...] }.
 * Buchungen werden nach dem Soll-/Haben-Saldo (Soll-Haben) je Periode summiert. */
function monatsTrend(a) {
  if (!a || !a.buchungen || !a.buchungen.length) return {};
  var beginn = a.gjVon || a.stichtag;
  if (!beginn) return {};
  var von = new Date(beginn);
  if (isNaN(von.getTime())) return {};
  // 12 Monate ab Geschaeftsjahresbeginn (Rumpfgeschaeftsjahre haben dann ggf. Lücken — egal)
  var monatsKeys = [];
  for (var i = 0; i < 12; i++) {
    var d = new Date(von.getFullYear(), von.getMonth() + i, 1);
    monatsKeys.push(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2));
  }
  var perKonto = {};   // { konto: { 'YYYY-MM': saldo } }
  function add(konto, key, betrag) {
    perKonto[konto] = perKonto[konto] || {};
    perKonto[konto][key] = (perKonto[konto][key] || 0) + betrag;
  }
  a.buchungen.forEach(function (b) {
    if (!b.datum || b.storniert) return;
    var key = String(b.datum).slice(0, 7);
    add(b.soll, key, +b.betrag || 0);   // Soll-Seite: +
    add(b.haben, key, -(+b.betrag || 0)); // Haben-Seite: -
  });
  var trends = {};
  Object.keys(perKonto).forEach(function (nr) {
    var lauf = 0, arr = [];
    monatsKeys.forEach(function (k) { lauf += perKonto[nr][k] || 0; arr.push(lauf); });
    trends[nr] = arr;
  });
  return trends;
}

/* Inline-SVG-Sparkline. werte = Array von Zahlen. */
function sparkline(werte) {
  if (!werte || werte.length < 2) return '<span class="bu-tag">—</span>';
  var w = 80, h = 18, n = werte.length;
  var min = Math.min.apply(null, werte), max = Math.max.apply(null, werte);
  var range = max - min;
  if (range === 0) range = 1;  // alle Punkte gleich -> flache Linie zentriert
  var pkt = werte.map(function (v, i) {
    var x = (i / (n - 1)) * w;
    var y = h - ((v - min) / range) * h;
    return Math.round(x * 100) / 100 + ',' + Math.round(y * 100) / 100;
  }).join(' ');
  var last = werte[werte.length - 1], first = werte[0];
  var farbe = last > first ? '#5dc98f' : last < first ? '#c14545' : '#7c91a0';
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
    '" style="vertical-align:middle"><polyline points="' + pkt +
    '" fill="none" stroke="' + farbe + '" stroke-width="1.5" /></svg>';
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

  // Lebende Fristen-Uebersicht aus dem aktuellen Datenbestand
  var liveFristen = Fristen.naechsteFristen(S.unternehmen, S.abschluesse);
  if (liveFristen.length) {
    html += '<div class="karte"><h2>Aktuelle Fristen (aus Ihren Daten)</h2>' +
      '<div class="karte-hint">Berechnet aus den Stichtagen Ihrer angelegten ' +
      'Abschlüsse — rot = verstrichen, gelb = innerhalb 30 Tagen, grün = > 30 Tage.</div>' +
      '<table class="liste"><thead><tr><th>Frist</th><th>Datum</th>' +
      '<th class="rechts">Resttage</th><th>Grundlage</th><th>Pflicht</th>' +
      '</tr></thead><tbody>';
    liveFristen.forEach(function (f) {
      var farbe = f.ampel === 'rot'  ? '#c14545'
                : f.ampel === 'gelb' ? '#e3b341'
                : '#5dc98f';
      var dot = '<span style="display:inline-block;width:10px;height:10px;' +
        'border-radius:50%;background:' + farbe + ';margin-right:6px"></span>';
      var rest = f.restTage < 0
        ? (-f.restTage) + ' Tage überfällig'
        : f.restTage + ' Tage';
      var sprung = f.sprung
        ? ' <span class="btn btn-sm" data-fsprung="' + esc(JSON.stringify(f.sprung)) +
          '">öffnen</span>'
        : '';
      html += '<tr><td>' + dot + esc(f.titel) + '</td>' +
        '<td class="mono">' + esc(f.frist) + '</td>' +
        '<td class="rechts mono">' + esc(rest) + '</td>' +
        '<td>' + esc(f.paragraph) + '</td>' +
        '<td>' + sprung + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }

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
  m.querySelectorAll('[data-fsprung]').forEach(function (el) {
    el.onclick = function () {
      var s;
      try { s = JSON.parse(el.dataset.fsprung); } catch (e) { return; }
      if (s.abschlussId) mitSpeichern(function () { oeffneAbschluss(s.abschlussId); });
      else if (s.view) setView(s.view);
    };
  });
}

/* Klick-Handler für die Sprung-Buttons in der Closing-Checkliste (Editor). */
function bindeClosingSpruenge(m) {
  m.querySelectorAll('[data-csprung]').forEach(function (el) {
    el.onclick = function () {
      var s;
      try { s = JSON.parse(el.dataset.csprung); } catch (e) { return; }
      if (s.view) setView(s.view);
    };
  });
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
     ['6855', '1800', 'Bankgebühren, Kontoführung, Depotgebühren (Nebenkosten Geldverkehr)'],
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
     ['6855', '1800', 'Depot-, Order- oder sonstige Bankgebühren (Nebenkosten Geldverkehr)']]);

  html += fall('6a. Stillhaltergeschäfte und Optionsprämien',
    'Beim Stillhaltergeschäft (Verkauf einer Option) vereinnahmt die GmbH die Prämie ' +
    'sofort. Realisiert wird das Ergebnis erst bei Ausübung, Glattstellung oder Verfall ' +
    '— bis dahin ist ein <b>schwebendes Geschäft</b> entstanden. Droht am Bilanzstichtag ' +
    'ein Verlust (innerer Wert der Option übersteigt die vereinnahmte Prämie), ist eine ' +
    '<b>Drohverlustrückstellung</b> nach § 249 Abs. 1 HGB zu bilden (Standardkonto ' +
    'SKR04: 3070 Sonstige Rückstellungen). Steuerlich relevant: § 15 Abs. 4 Satz 3 EStG ' +
    'beschränkt Verluste aus Stillhaltergeschäften nur auf Termingeschäfte — für ' +
    'Optionsprämien gilt die volle Verrechnung. Praxis-Tipp: Vereinnahmte Prämien und ' +
    'Glattstellungsverluste in eigenen Unterkonten zu 4830/6300 führen (Eigene-Konten-' +
    'Verwaltung in den Stammdaten), damit der Steuerberater sie sofort findet.',
    [['1800', '4830', 'Optionsprämie als Stillhalter vereinnahmt (per Bank, Sonst. betr. Erträge)'],
     ['6300', '1800', 'Glattstellung mit Verlust — Differenz Prämie ./. Rückkaufpreis'],
     ['1800', '6300', 'Verfall der Option zugunsten des Stillhalters — Storno der Aufwandsbuchung entfällt; die Prämie bleibt Ertrag'],
     ['6300', '3070', 'Drohverlustrückstellung am Stichtag (§ 249 Abs. 1 HGB, sonstige Rückstellungen)'],
     ['3070', '6300', 'Auflösung der Drohverlustrückstellung im Folgejahr bei Glattstellung']]);

  html += fall('6b. Fremdwährung und Stichtagsbewertung (§ 256a HGB)',
    'Fremdwährungsbestände (USD-Depot, GBP-Forderung, CHF-Darlehen) werden am ' +
    'Bilanzstichtag bewertet — und zwar abhängig von der <b>Restlaufzeit</b>:<br>' +
    '<b>≤ 1 Jahr (§ 256a Satz 2 HGB):</b> zwingend zum Devisenkassamittelkurs am ' +
    'Stichtag — auch nach oben. Realisations- und Imparitätsprinzip sind hier ' +
    'ausser Kraft.<br>' +
    '<b>> 1 Jahr:</b> es gelten die allgemeinen Bewertungsprinzipien — Vermögen ' +
    'nach Niederstwertprinzip (nur abwerten), Schulden nach Höchstwertprinzip ' +
    '(nur aufwerten).<br>' +
    'Der eingebaute Helper rechnet das korrekt vor; die Buchung erfolgt manuell ' +
    'als Sammelbuchung am Stichtag. Optionsprämien aus Fremdwährungsdepots ' +
    'durchlaufen separat den Stillhalter-Workflow (Abschnitt 6a).',
    [['1800', '4830', 'kurzfristige Forderung: Aufwertung am Stichtag (Sonst. betr. Ertrag)'],
     ['6300', '1800', 'kurzfristige Forderung: Abwertung am Stichtag (Sonst. betr. Aufwand)'],
     ['6300', '1510', 'langfristige Wertpapiere: Abwertung Niederstwert (§ 253 HGB)'],
     ['6300', '3150', 'langfristige Verbindlichkeit: Aufwertung Höchstwert (§ 252 HGB)']]);

  html += '<div class="box box-info"><b>Praxis</b>Für Erträge und Aufwendungen ' +
    'aus Währungsumrechnung sind im DATEV-SKR04 üblicherweise eigene Unterkonten ' +
    'angelegt (z. B. „4838 Erträge aus Währungsumrechnung" und „6886 Aufwendungen ' +
    'aus Währungsumrechnung"). OpenBilanz nutzt die Sammelposten 4830 / 6300 — bei ' +
    'Bedarf in <b>Stammdaten → Eigene Konten</b> ein passendes Unterkonto anlegen ' +
    'und in den Buchungen verwenden.</div>';

  html += fall('6c. Termingeschäfte (Futures, CFDs)',
    'Termingeschäfte werden über die laufende Variation Margin abgerechnet — der ' +
    'Broker bucht Tag für Tag Gewinne und Verluste gegen das Margin-Konto. Bilanz' +
    'wirksam wird das Ergebnis erst bei <b>Glattstellung</b>; bis dahin entsteht ' +
    'ein schwebendes Geschäft. Bei einer Trading-GmbH läuft die laufende Variation ' +
    'Margin über ein eigenes <b>Verrechnungskonto</b> (Vorschlag: 1361 als ' +
    'Sonstige Vermögensgegenstände); beim Stichtag wird der offene Saldo ' +
    'analysiert und ggf. eine Drohverlustrückstellung (3070, vgl. 6a) gebildet.<br>' +
    '<b>Steuerlich wichtig:</b> § 15 Abs. 4 Satz 3 EStG beschränkt Verluste aus ' +
    'Termingeschäften — sie sind nur mit gleichartigen Gewinnen verrechenbar. Die ' +
    'Steuerschätzung in OpenBilanz bildet diese Beschränkung nicht automatisch ab; ' +
    'ein Hinweis im Anhang ist empfehlenswert.',
    [['1361', '1800', 'Margin-Einzahlung an den Broker'],
     ['1361', '4906', 'tägliche Variation Margin: realisierter Gewinn'],
     ['6905', '1361', 'tägliche Variation Margin: realisierter Verlust'],
     ['1800', '1361', 'Margin-Rückzahlung bei Glattstellung der Position'],
     ['6300', '3070', 'Drohverlustrückstellung am Stichtag (offener Verlust droht)']]);

  html += fall('7. Jahresabschluss abschließen',
    'Sind alle Buchungen erfasst, in der Buchhaltung „Salden in Bilanz/GuV übernehmen“ ' +
    'klicken — die Kontensalden füllen Bilanz und GuV. Anschließend „Buchungen ' +
    'festschreiben“: festgeschriebene Buchungen sind unveränderlich (GoBD), Korrekturen ' +
    'nur noch per Stornobuchung. Den passenden Gesellschafterbeschluss zur Feststellung ' +
    'erzeugt der Reiter „Gesellschafterbeschlüsse“.', null);

  html += '<h2 style="margin-top:30px">E-Rechnung — Empfang &amp; Versand</h2>';

  html += fall('8. Eingangsrechnung einlesen (XRechnung oder ZUGFeRD-PDF)',
    'In der <b>Buchhaltung</b> die Karte „E-Rechnung (XRechnung / ZUGFeRD)“ aufrufen ' +
    'und entweder eine .xml (XRechnung in UBL- oder CII-Syntax) oder eine .pdf ' +
    '(ZUGFeRD-/Factur-X-Hybrid) auswählen. OpenBilanz extrahiert bei der PDF die ' +
    'eingebettete XML aus dem PDF/A-3-Anhang, erkennt das Profil, listet die ' +
    'Positionen und prüft die Plausibilität (Brutto = Netto + USt, Summe Positionen ' +
    '= Netto, Pflichtfelder § 14 UStG vorhanden). Mit dem Knopf „Als Eingangsrechnung ' +
    'buchen“ wird der folgende Standard-Buchungssatz erzeugt — das Aufwandskonto ' +
    'kannst du vorher auswählen.',
    [['6300', '3300', 'Eingangsrechnung (Netto) gegen Verbindlichkeiten aLuL'],
     ['1406', '3300', 'enthaltene Vorsteuer 19 % auf Verbindlichkeit umgehängt']]);

  html += '<div class="box box-info"><b>Empfangs-Pflicht seit 1.1.2025</b>' +
    'Jede inlandsansässige GmbH muss eingehende B2B-Rechnungen im strukturierten ' +
    'XRechnungs- oder ZUGFeRD-Format annehmen können. Eine reine PDF ohne XML genügt ' +
    'als Eingangsrechnung im B2B-Inland nicht mehr — Lieferanten dürfen sie weiterhin ' +
    'schicken (Übergangsfristen bis 31.12.2027), bis dahin gilt die alte ' +
    'PDF/Papier-Form aber als legitimer Beleg.</div>';

  html += fall('9. Kunden &amp; eigene Rechnungs-Angaben pflegen',
    'Bevor du die erste Ausgangsrechnung schreibst, einmalig im Menü <b>Stammdaten → ' +
    'Kunden</b> einrichten:<br>' +
    '<b>(a) Eigene Rechnungs-Angaben</b> — Name auf der Rechnung, Anschrift, ' +
    'Steuernummer ODER USt-IdNr. (eines davon ist § 14 UStG-Pflicht), Bankverbindung ' +
    '(IBAN landet als SEPA-PaymentMeans im XML), Registergericht und HR-Nummer. ' +
    'Felder, die leer bleiben, werden automatisch aus den Unternehmensdaten gezogen.<br>' +
    '<b>(b) Rechnungsnummernkreis</b> — das Schema (z. B. <span class="mono">RE-{JAHR}-{NR:04}</span>) ' +
    'und die nächste Nummer. Der Zähler setzt beim Jahreswechsel automatisch zurück. ' +
    'Wichtig: §14 UStG verlangt eine einmalig vergebene Rechnungsnummer — manuell ' +
    'reinpfuschen erst, wenn du wirklich verstehst was du tust.<br>' +
    '<b>(c) Kundenliste</b> — pro Kunde Name, Anschrift, Land (ISO-2: DE/AT/FR/…), ' +
    'USt-IdNr. (Pflicht bei § 13b oder innergemeinschaftlichen Geschäften), E-Mail. ' +
    'Die USt-IdNr. wird live strukturell geprüft (für DE/AT/NL/IT auch die Prüfziffer); ' +
    'im Selbst-Hosting-Modus gibt es zusätzlich einen „Online prüfen“-Knopf, der die ' +
    'qualifizierte Bestätigung beim VIES holt und das Ergebnis archiviert.', null);

  html += fall('10. Ausgangsrechnung erstellen und versenden',
    'Im jeweiligen Abschluss-Jahr <b>Ausgangsrechnungen → + Neue Rechnung</b>. ' +
    'Kunde auswählen, Datum + Leistungsdatum setzen, Steuerlogik wählen (Regelfall, ' +
    '§ 13b Reverse-Charge, innergem. Lieferung/Leistung, § 19 Kleinunternehmer, ' +
    '§ 4 steuerfrei), Positionen erfassen (Bezeichnung, Menge, Einheit, Einzelpreis, ' +
    'USt-Satz). Die Live-Vorschau zeigt sofort Brutto und den § 14-Pflichtcheck.<br><br>' +
    'Zwei Wege:<br>' +
    '<b>Entwurf speichern</b> — bleibt editierbar, noch keine Nummer, noch keine Buchung.<br>' +
    '<b>Versenden &amp; festschreiben</b> — vergibt die nächste freie Nummer aus dem ' +
    'Nummernkreis, erzeugt den Buchungssatz (siehe unten) und markiert beides als ' +
    'GoBD-fest (Hash in der Prüfkette). Danach nur noch per Stornobuchung änderbar.<br><br>' +
    'Buchungssatz für den Regelfall:',
    [['1200', '4400', 'Forderung aus Lieferungen und Leistungen (Netto, 19 %)'],
     ['1200', '3806', 'Umsatzsteuer 19 %'],
     ['1200', '4300', 'analog für Erlöse zu 7 %'],
     ['1200', '4336', '§ 13b — Erlöse Reverse-Charge, kein USt-Ausweis']]);

  html += fall('11. XRechnung-XML herunterladen (UBL oder CII)',
    'Im Rechnungs-Editor stehen unten zwei Download-Knöpfe: <b>XRechnung-UBL</b> und ' +
    '<b>XRechnung-CII</b>. Beides sind gleichberechtigte EN-16931-Syntaxen mit der ' +
    'KoSIT-Customization-ID für XRechnung 3.x. UBL ist im deutschen Markt etwas ' +
    'häufiger; CII ist die Basis für ZUGFeRD-Hybrid-PDFs. <br><br>' +
    'Vor der ersten produktiven Nutzung: die Datei mit dem KoSIT-Validator (Apache 2.0, ' +
    'externes Java-Tool) gegenprüfen — der prüft XSD und Schematron der amtlichen ' +
    'Regeln. Solange der Knopf in OpenBilanz die XML nur erzeugt, ohne sie extern ' +
    'validiert zu haben, bleibt die README-Zeile bei 🟡.', null);

  html += fall('12. ZUGFeRD-Hybrid-PDF erzeugen (optional)',
    'Wenn dein Empfänger zusätzlich zur reinen XRechnung-XML eine PDF mit ' +
    'eingebetteter XML wünscht (ZUGFeRD / Factur-X), gibt es im Rechnungs-Editor ' +
    'einen dritten Download-Knopf. Voraussetzung ist <b>einmalig</b>:<br><br>' +
    '<span class="mono" style="display:block;padding:8px;background:#f5f5f5;border-radius:4px">' +
    './tools/setup-pdf-lib.sh</span><br>' +
    'Das Skript lädt pdf-lib (MIT), das sRGB-ICC-Profil und die Liberation-Sans-Schrift ' +
    'einmal lokal nach <span class="mono">public/vendor/</span> — analog zu Pyodide/' +
    'Arelle. Kein Runtime-CDN, keine Drittabhängigkeit zur Laufzeit. Der ZUGFeRD-Knopf ' +
    'erscheint im UI automatisch, sobald das vendor-Asset vorhanden ist.<br><br>' +
    '<b>Konformitäts-Hinweis</b>: OpenBilanz erzeugt eine funktionierende Hybrid-PDF ' +
    'mit korrekt eingebetteter Factur-X-CII-XML — der Empfang via parseERechnungPdf ' +
    'liest sie roundtrip-sicher zurück. Volle PDF/A-3-Konformität (vollständiger ' +
    'XMP-Stream, OutputIntent mit ICC, Tagged-PDF) ist noch nicht extern Mustang-' +
    'validiert. Für reines B2B-Inland reicht die XRechnung-XML rechtlich ohnehin — ' +
    'die Hybrid-PDF ist Komfort, keine Pflicht.', null);

  html += fall('13. Hinweis zum Selbst-Hosting-Modus für VIES-Online-Prüfung',
    'Die qualifizierte USt-IdNr.-Bestätigung beim VIES funktioniert <b>nur im Selbst-' +
    'Hosting-Modus</b> (gestartet via <span class="mono">./start.sh</span> oder ' +
    '<span class="mono">node server.js</span>). Im reinen Website-Modus blockiert ' +
    'der Browser den Direkt-Aufruf an die EU-Stelle (kein CORS) — die strukturelle ' +
    'Offline-Prüfung bleibt aber überall verfügbar. Bei jedem Klick auf den ' +
    '„Online prüfen“-Knopf erscheint ein Datenschutz-Hinweis: außer der USt-IdNr. ' +
    'wird nichts an Dritte übertragen.', null);

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
  // außerplanmäßige Teilwertabschreibung (§ 253 Abs. 3 S. 5/6 HGB)
  var twJahr = parseInt(String(anlage.teilwertDatum || '').slice(0, 4), 10) || 0;
  var twBetrag = Berechnung.num(anlage.teilwertBetrag);
  // Abgang (Verkauf/Verschrottung) - der Plan endet im Abgangsjahr
  var abJahr = parseInt(String(anlage.abgangDatum || '').slice(0, 4), 10) || 0;
  var abMonat = parseInt(String(anlage.abgangDatum || '').slice(5, 7), 10) || 12;
  var plan = [], bw = AK, jahr = jahr0, restMon = ND * 12;
  while (bw > 0.005 && plan.length < ND + 4 && restMon > 0) {
    var startM = (jahr === jahr0) ? monat0 : 1;
    var endM = (abJahr && jahr === abJahr) ? abMonat : 12;
    var mon = Math.max(0, endM - startM + 1);
    if (mon > restMon) mon = restMon;
    var afa;
    if (degressiv) {
      afa = Math.max(bw * satz * (mon / 12), restMon > 0 ? bw * mon / restMon : bw);
    } else {
      afa = linJahr * (mon / 12);
    }
    if (afa > bw) afa = bw;
    afa = Math.round(afa * 100) / 100;
    var tw = 0;
    if (twJahr === jahr && twBetrag > 0) {
      tw = Math.min(twBetrag, Math.round((bw - afa) * 100) / 100);
      if (tw < 0) tw = 0;
    }
    bw = Math.round((bw - afa - tw) * 100) / 100;
    var istAbgang = !!(abJahr && jahr === abJahr);
    plan.push({ jahr: jahr, monate: mon, afa: afa, teilwert: tw,
                buchwert: bw, abgang: istAbgang });
    restMon -= mon;
    if (istAbgang) break;             // nach dem Abgangsjahr endet der Plan
    jahr++;
  }
  // Rundungsrest in die letzte Zeile (nur ohne Abgang - beim Abgang bleibt
  // der Restbuchwert stehen und wird über die Abgangsbuchung ausgebucht)
  if (bw > 0.005 && plan.length && !plan[plan.length - 1].abgang) {
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
  if (p.length && jahr > p[p.length - 1].jahr)
    return { jahr: jahr, monate: 0, afa: 0, teilwert: 0, buchwert: 0 };
  return { jahr: jahr, monate: 0, afa: 0, teilwert: 0,
           buchwert: Berechnung.num(anlage.anschaffungskosten) };
}
/* kumulierte Abschreibung (planmäßige AfA + Teilwert) bis Jahresende. */
function afaKumuliert(anlage, jahr) {
  var s = 0;
  afaPlan(anlage).forEach(function (z) {
    if (z.jahr <= jahr) s += z.afa + (z.teilwert || 0);
  });
  return Math.round(s * 100) / 100;
}
/* Abgangsjahr einer Anlage (0 = kein Abgang erfasst). */
function abgangsJahr(anlage) {
  return parseInt(String((anlage && anlage.abgangDatum) || '').slice(0, 4), 10) || 0;
}
/* Restbuchwert zum Abgang (Buchwert am Ende des Abgangsjahres). */
function restbuchwertAbgang(anlage) {
  var p = afaPlan(anlage);
  var z = p[p.length - 1];
  return (z && z.abgang) ? z.buchwert : 0;
}
/* AfA-Verlauf einer Anlage als Tabelle. */
function afaVerlaufHtml(an) {
  var p = afaPlan(an);
  if (!p.length) return '<div class="karte-hint">Unvollständige Angaben — kein AfA-Plan.</div>';
  var h = '<table class="liste"><thead><tr><th>Jahr</th><th>Monate</th>' +
    '<th class="rechts">AfA</th><th class="rechts">Teilwert-AfA</th>' +
    '<th class="rechts">Buchwert Jahresende</th></tr></thead><tbody>';
  p.forEach(function (z) {
    h += '<tr><td class="mono">' + z.jahr + (z.abgang ? ' · Abgang' : '') + '</td>' +
      '<td class="mono">' + z.monate + '</td>' +
      '<td class="rechts mono">' + geld(z.afa) + '</td>' +
      '<td class="rechts mono">' + (z.teilwert ? geld(z.teilwert) : '–') + '</td>' +
      '<td class="rechts mono">' + geld(z.buchwert) + '</td></tr>';
  });
  return h + '</tbody></table>';
}
/* Anlagenspiegel eines Geschäftsjahres (§ 284 Abs. 3 HGB). */
function anlagenspiegelHtml(jahr) {
  var anlagen = (S.unternehmen && S.unternehmen.anlagen) || [];
  if (!anlagen.length) return '<div class="karte-hint">Keine Anlagegüter erfasst.</div>';
  var t = { ak: 0, kumA: 0, abg: 0, afa: 0, kumE: 0, bw: 0 }, zeilen = '';
  anlagen.forEach(function (an) {
    var aJahr = parseInt(String(an.anschaffungsdatum || '').slice(0, 4), 10);
    if (aJahr && jahr < aJahr) return;                 // noch nicht im Bestand
    var abJ = abgangsJahr(an);
    if (abJ && jahr > abJ) return;                     // bereits abgegangen
    var ak = Berechnung.num(an.anschaffungskosten);
    var kumA = afaKumuliert(an, jahr - 1);
    var zJ = afaImJahr(an, jahr);
    var afa = Berechnung.cent(zJ.afa + (zJ.teilwert || 0));
    var istAbgang = abJ === jahr;
    var abg = istAbgang ? ak : 0;
    var kumE = istAbgang ? 0 : afaKumuliert(an, jahr);
    var bw = istAbgang ? 0 : zJ.buchwert;
    t.ak += ak; t.kumA += kumA; t.abg += abg; t.afa += afa; t.kumE += kumE; t.bw += bw;
    zeilen += '<tr><td>' + esc(an.bezeichnung || '') + (istAbgang ? ' · Abgang' : '') + '</td>' +
      '<td class="rechts mono">' + geld(ak) + '</td>' +
      '<td class="rechts mono">' + geld(kumA) + '</td>' +
      '<td class="rechts mono">' + (abg ? geld(abg) : '–') + '</td>' +
      '<td class="rechts mono">' + geld(afa) + '</td>' +
      '<td class="rechts mono">' + geld(kumE) + '</td>' +
      '<td class="rechts mono">' + geld(bw) + '</td></tr>';
  });
  if (!zeilen) return '<div class="karte-hint">Im Jahr ' + jahr + ' kein Anlagegut im Bestand.</div>';
  return '<table class="liste" style="margin-top:10px"><thead><tr><th>Anlagegut</th>' +
    '<th class="rechts">Anschaffungskosten</th><th class="rechts">kum. AfA Anfang</th>' +
    '<th class="rechts">Abgang (AK)</th><th class="rechts">Abschreibung ' + jahr + '</th>' +
    '<th class="rechts">kum. AfA Ende</th><th class="rechts">Buchwert Ende</th>' +
    '</tr></thead><tbody>' + zeilen +
    '<tr class="zeile-summe"><td>Summe</td>' +
    '<td class="rechts mono">' + geld(t.ak) + '</td>' +
    '<td class="rechts mono">' + geld(t.kumA) + '</td>' +
    '<td class="rechts mono">' + geld(t.abg) + '</td>' +
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
    function buchung(b) {
      if (ja.buchungen.some(function (x) { return x.afaQuelle === b.afaQuelle; })) return;
      b.id = 'B-AfA-' + stamp + '-' + ja.buchungen.length;
      b.datum = ja.gjBis || ja.stichtag;
      ja.buchungen.push(b);
      neu++;
    }
    anlagen.forEach(function (an, i) {
      var key = an.id || ('idx' + i);
      var z = afaImJahr(an, jahr);
      var afaGes = Berechnung.cent(z.afa + (z.teilwert || 0));
      if (afaGes > 0) {
        buchung({ betrag: afaGes, soll: afaKontoZu(an.konto), haben: an.konto,
          text: 'Abschreibung ' + (an.bezeichnung || an.konto || '') + ' ' + jahr +
            (z.teilwert > 0 ? ' (inkl. Teilwertabschreibung)' : ''),
          afaQuelle: key + ':' + jahr });
      }
      // Abgang: Restbuchwert ausbuchen, Erlös vereinnahmen, Ergebnis ausweisen
      if (abgangsJahr(an) === jahr) {
        var R = restbuchwertAbgang(an);
        var E = Berechnung.cent(an.abgangErloes);
        var minER = Math.min(E, R);
        if (minER > 0) {
          buchung({ betrag: minER, soll: '1800', haben: an.konto,
            text: 'Anlagenabgang ' + (an.bezeichnung || '') + ' — Buchwert/Erlös',
            afaQuelle: key + ':abgang-bw:' + jahr });
        }
        if (E > R) {
          buchung({ betrag: Berechnung.cent(E - R), soll: '1800', haben: '4900',
            text: 'Gewinn aus Anlagenabgang ' + (an.bezeichnung || ''),
            afaQuelle: key + ':abgang-gewinn:' + jahr });
        } else if (R > E) {
          buchung({ betrag: Berechnung.cent(R - E), soll: '6900', haben: an.konto,
            text: 'Verlust aus Anlagenabgang ' + (an.bezeichnung || ''),
            afaQuelle: key + ':abgang-verlust:' + jahr });
        }
      }
    });
    if (!neu) {
      alert('Keine neuen Anlagen-Buchungen für ' + jahr + ' — entweder nichts ' +
        'abzuschreiben/kein Abgang in diesem Jahr oder bereits gebucht.');
      return;
    }
    ja.protokoll.push({ zeit: new Date().toISOString(),
      text: neu + ' Anlagen-Buchung(en) (AfA/Abgang) aus dem Anlagenverzeichnis übernommen' });
    Store.speichereAbschluss(ja).then(function (g) {
      if (g && !g.fehler && S.aktiv && S.aktiv.id === ja.id) S.aktiv = g;
      hinweisToast(neu + ' Anlagen-Buchung(en) im Jahresabschluss erzeugt. Dort „Salden ' +
        'übernehmen" überträgt sie in Bilanz und GuV.');
    });
  });
}
/* Dialog: Abgang (Verkauf/Verschrottung) und Teilwertabschreibung erfassen. */
function dialogAnlageSonderfall(i) {
  var u = S.unternehmen;
  var an = u && u.anlagen && u.anlagen[i];
  if (!an) return;
  var html = '<h3>Abgang / Teilwertabschreibung</h3>' +
    '<p class="karte-hint">' + esc(an.bezeichnung || 'Anlagegut') + '</p>' +
    '<div class="box box-info"><b>Abgang</b>Verkauf oder Verschrottung. Der AfA-Plan ' +
    'endet im Abgangsjahr (zeitanteilig); die Abgangsbuchungen entstehen anschließend ' +
    'über „AfA-Buchungen übernehmen".</div>' +
    '<div class="gitter g2">' +
    feldWrap('Abgangsdatum', 'leer = kein Abgang',
      '<input type="date" id="asAbDatum" value="' + esc(an.abgangDatum || '') + '">') +
    feldWrap('Verkaufserlös (EUR, netto)', '0 bei Verschrottung',
      '<input class="zahl" type="text" inputmode="decimal" id="asAbErloes" value="' +
      eingabeWert(an.abgangErloes) + '">') +
    '</div>' +
    '<div class="box box-info" style="margin-top:12px"><b>Teilwertabschreibung</b>' +
    'Außerplanmäßige Abschreibung auf einen voraussichtlich dauerhaft niedrigeren Wert ' +
    '(§ 253 Abs. 3 Satz 5 HGB) — zusätzlich zur planmäßigen AfA.</div>' +
    '<div class="gitter g2">' +
    feldWrap('Datum der Teilwertabschreibung', 'leer = keine',
      '<input type="date" id="asTwDatum" value="' + esc(an.teilwertDatum || '') + '">') +
    feldWrap('Betrag (EUR)', '',
      '<input class="zahl" type="text" inputmode="decimal" id="asTwBetrag" value="' +
      eingabeWert(an.teilwertBetrag) + '">') +
    '</div>' +
    '<div class="btn-reihe" style="margin-top:16px">' +
    '<button class="btn btn-pri" id="asOk">Speichern</button>' +
    '<button class="btn" id="asAbbruch">Abbrechen</button></div>';
  dialog(html);
  document.getElementById('asAbbruch').onclick = dialogZu;
  document.getElementById('asOk').onclick = function () {
    var abD = document.getElementById('asAbDatum').value;
    var twD = document.getElementById('asTwDatum').value;
    an.abgangDatum = abD || '';
    an.abgangErloes = abD ? Berechnung.num(document.getElementById('asAbErloes').value) : 0;
    an.teilwertDatum = twD || '';
    an.teilwertBetrag = twD ? Berechnung.num(document.getElementById('asTwBetrag').value) : 0;
    Store.speichereUnternehmen(u).then(function (g) {
      if (g && !g.fehler) S.unternehmen = g;
      dialogZu();
      hinweisToast('Anlagegut aktualisiert.');
      setView('anlagen');
    });
  };
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

  SKR04.setEigene((S.unternehmen && S.unternehmen.eigeneKonten) || []);
  var kontoOpt = SKR04.alleKonten().filter(function (k) {
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
      var abJ = abgangsJahr(an);
      html += '<tr><td>' + esc(an.bezeichnung || '') +
        (abJ ? ' <span class="tag tag-eb">Abgang ' + datumDe(an.abgangDatum) + '</span>' : '') +
        (an.teilwertBetrag ? ' <span class="tag tag-entwurf">Teilwert-AfA</span>' : '') + '</td>' +
        '<td class="mono">' + esc(an.konto || '') + '</td>' +
        '<td class="mono">' + datumDe(an.anschaffungsdatum) + '</td>' +
        '<td class="rechts mono">' + geld(an.anschaffungskosten) + '</td>' +
        '<td class="mono">' + esc(an.nutzungsdauer) + ' J.</td>' +
        '<td>' + (an.methode === 'degressiv' ? 'degressiv' : 'linear') + '</td>' +
        '<td class="rechts mono">' + geld(afaImJahr(an, jahrJetzt).buchwert) + '</td>' +
        '<td class="rechts"><span class="btn btn-sm" data-verlauf="' + i + '">Verlauf</span> ' +
        '<span class="btn btn-sm" data-ansond="' + i + '">Abgang/Teilwert</span> ' +
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
  m.querySelectorAll('[data-ansond]').forEach(function (el) {
    el.onclick = function () { dialogAnlageSonderfall(parseInt(el.dataset.ansond, 10)); };
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
  /* v1-Sicherung: unternehmen = Objekt; v2 (mandantenfähig): Array je Mandant. */
  var uref = Array.isArray(snapshot.unternehmen) ? snapshot.unternehmen[0] : snapshot.unternehmen;
  var firma = (uref && uref.name) || 'ohne Firmenname';
  var mAnz = Array.isArray(snapshot.mandanten) ? snapshot.mandanten.length : 0;
  var datum = snapshot.exportiertAm ? datumDe(snapshot.exportiertAm.slice(0, 10)) : 'unbekannt';
  dialog('<h3>Backup importieren</h3>' +
    '<p>Sicherung vom <b>' + esc(datum) + '</b> &ndash; ' + esc(firma) + ', ' +
    anz + ' Abschluss' + (anz === 1 ? '' : 'e') +
    (mAnz > 1 ? ' aus ' + mAnz + ' Mandanten' : '') + '.</p>' +
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
