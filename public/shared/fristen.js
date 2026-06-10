/* ===========================================================================
 * fristen.js  -  laufende Fristen pro Abschluss mit Ampel-Bewertung
 * ---------------------------------------------------------------------------
 * Aus Unternehmen + Abschluss-Liste eine lebende Frist-Uebersicht erzeugen.
 *
 *   naechsteFristen(unternehmen, abschluesse, heute?) -> [{
 *     titel:      'Jahresabschluss aufstellen 2024'
 *     frist:      'YYYY-MM-DD'   (Datum der Pflicht)
 *     restTage:   17            (positiv = Frist liegt in der Zukunft)
 *     ampel:      'rot'         (verstrichen)
 *               | 'gelb'        (≤ 30 Tage bis Frist)
 *               | 'gruen'       (mehr als 30 Tage)
 *     paragraph:  '§ 264 Abs. 1 HGB'
 *     sprung:     { view: 'editor', abschlussId: '...' }   - optional
 *   }, ...]
 *
 * Pure Funktion - liefert Daten, kein DOM. UI uebernimmt app.js.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Fristen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function iso(d) { return d.toISOString().slice(0, 10); }
  function parse(s) {
    if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
    if (!s) return null;
    var d = new Date(String(s));
    return isNaN(d.getTime()) ? null : d;
  }
  function addMonate(d, m) {
    // Robust gegen Monatsende: 31.01. + 1 Monat = 28./29.02., nicht 03.03.
    var ziel = new Date(d.getFullYear(), d.getMonth() + m, 1);
    var letzterTag = new Date(ziel.getFullYear(), ziel.getMonth() + 1, 0).getDate();
    return new Date(ziel.getFullYear(), ziel.getMonth(),
      Math.min(d.getDate(), letzterTag));
  }
  function addJahre(d, j) {
    return addMonate(d, j * 12);
  }
  function tagsZwischen(a, b) {
    // Ganze Tage, lokal-Zeitzonen-unabhaengig: ueber 10 Tage Differenz akzeptabel.
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }
  function ampel(restTage) {
    if (restTage < 0) return 'rot';
    if (restTage <= 30) return 'gelb';
    return 'gruen';
  }

  /* Übermittlungs-Hinweise je Pflicht-Art: WOHIN + WIE die Sache übermittelt wird.
   * Rechtsstand mit Primärquelle verifiziert (§ 325 HGB: Einreichung beim
   * Unternehmensregister, NICHT mehr Bundesanzeiger — seit DiRUG 2022; § 18 UStG:
   * elektronisch über die amtliche Schnittstelle = ELSTER ans Finanzamt). */
  var UEBERMITTLUNG = {
    offenlegung: {
      text: 'Elektronisch an das Unternehmensregister übermitteln (seit 2022 dort, ' +
            'nicht mehr beim Bundesanzeiger).',
      link: 'https://www.unternehmensregister.de', linkText: 'unternehmensregister.de'
    },
    ustva: {
      text: 'Elektronisch über ELSTER ans Finanzamt (authentifiziert, amtlich ' +
            'vorgeschriebener Datensatz).',
      link: 'https://www.elster.de', linkText: 'elster.de'
    },
    aufstellung: {
      text: 'Interne Pflicht — keine Übermittlung an eine Behörde. Grundlage für die ' +
            'Offenlegung und die E-Bilanz ans Finanzamt (ELSTER/ERiC, § 5b EStG).',
      link: 'https://www.elster.de', linkText: 'elster.de (E-Bilanz)'
    },
    aufbewahrung: {
      text: 'Keine Abgabe — im Unternehmen geordnet aufbewahren und auf Verlangen ' +
            '(z. B. Betriebsprüfung) vorlegen.'
    },
    'aufbewahrung-belege': {
      text: 'Keine Abgabe — Belege im Unternehmen aufbewahren und auf Verlangen ' +
            '(z. B. Betriebsprüfung) vorlegen.'
    }
  };
  function uebermittlungFuer(art) { return UEBERMITTLUNG[art] || null; }

  function naechsteFristen(unternehmen, abschluesse, heute) {
    var h = parse(heute) || new Date();
    var heuteIso = iso(h);
    var liste = [];

    // Pro Abschluss: Aufstellungs- und Offenlegungsfristen
    (abschluesse || []).forEach(function (a) {
      var stichtag = parse(a.stichtag);
      if (!stichtag) return;
      var bez = a.bezeichnung || a.stichtag || '';
      // Eroeffnungsbilanz: nur Aufbewahrungsfrist
      if (a.art === 'EROEFFNUNGSBILANZ') {
        var aufEB = addJahre(stichtag, 10);
        liste.push({
          titel: 'Aufbewahrung Eröffnungsbilanz · ' + bez,
          frist: iso(aufEB),
          restTage: tagsZwischen(aufEB, h),
          ampel: ampel(tagsZwischen(aufEB, h)),
          paragraph: '§ 257 HGB · § 147 AO',
          art: 'aufbewahrung',
          sprung: { view: 'editor', abschlussId: a.id }
        });
        return;
      }
      // Jahresabschluss aufstellen (§ 264 Abs. 1 HGB): kleine und Kleinst-
      // Kapitalgesellschaften 6 Monate (Satz 4), mittelgroße/große 3 Monate
      // (Satz 3) nach dem Abschlussstichtag. Ohne Einstufung: 6 Monate
      // (Zielgruppe des Tools ist die kleine GmbH).
      var istKlein = !a.groessenklasse || a.groessenklasse === 'KLEINST' ||
                     a.groessenklasse === 'KLEIN';
      var aufstellung = addMonate(stichtag, istKlein ? 6 : 3);
      liste.push({
        titel: 'Jahresabschluss aufstellen · ' + bez,
        frist: iso(aufstellung),
        restTage: tagsZwischen(aufstellung, h),
        ampel: ampel(tagsZwischen(aufstellung, h)),
        paragraph: istKlein ? '§ 264 Abs. 1 S. 4 HGB (6 Monate, kleine/Kleinst-KapG)'
                            : '§ 264 Abs. 1 S. 3 HGB (3 Monate, mittelgroße/große KapG)',
        art: 'aufstellung',
        sprung: { view: 'editor', abschlussId: a.id }
      });
      // Offenlegung: 12 Monate nach Stichtag (§ 325 Abs. 1a HGB)
      var offenlegung = addJahre(stichtag, 1);
      liste.push({
        titel: 'Offenlegung beim Unternehmensregister · ' + bez,
        frist: iso(offenlegung),
        restTage: tagsZwischen(offenlegung, h),
        ampel: ampel(tagsZwischen(offenlegung, h)),
        paragraph: '§ 325 Abs. 1a HGB',
        art: 'offenlegung',
        sprung: { view: 'offenlegung', abschlussId: a.id }
      });
      // Aufbewahrung: 10 Jahre nach Stichtag (Jahresabschluss, Bücher, Inventare)
      var auf = addJahre(stichtag, 10);
      liste.push({
        titel: 'Aufbewahrung · ' + bez,
        frist: iso(auf),
        restTage: tagsZwischen(auf, h),
        ampel: ampel(tagsZwischen(auf, h)),
        paragraph: '§ 257 HGB · § 147 AO',
        art: 'aufbewahrung',
        sprung: null
      });
      // Aufbewahrung Buchungsbelege: 8 Jahre (verkürzt durch BEG IV, Bundesrat
      // 18.10.2024, anzuwenden ab 01.01.2025). Nur Belege - Bücher/Abschlüsse
      // bleiben bei 10 Jahren (§ 257 Abs. 1 Nr. 4 i.V.m. Abs. 4 HGB / § 147 AO).
      var aufBel = addJahre(stichtag, 8);
      liste.push({
        titel: 'Aufbewahrung Buchungsbelege · ' + bez,
        frist: iso(aufBel),
        restTage: tagsZwischen(aufBel, h),
        ampel: ampel(tagsZwischen(aufBel, h)),
        paragraph: '§ 257 Abs. 1 Nr. 4 HGB · § 147 AO (BEG IV)',
        art: 'aufbewahrung-belege',
        sprung: null
      });
    });

    // UStVA: naechster 10. eines Monats (Vormonats-USt). Kleinunternehmer
    // (Unternehmen.kleinunternehmer === true) skip.
    if (!unternehmen || !unternehmen.kleinunternehmer) {
      var jahr = h.getFullYear(), monat = h.getMonth(), tag = h.getDate();
      // Wenn der 10. dieses Monats noch nicht erreicht ist, ist er der naechste Termin;
      // sonst der 10. des Folgemonats.
      var ustVa = (tag <= 10)
        ? new Date(jahr, monat, 10)
        : new Date(jahr, monat + 1, 10);
      liste.push({
        titel: 'UStVA für ' + monatsname(monat, tag <= 10),
        frist: iso(ustVa),
        restTage: tagsZwischen(ustVa, h),
        ampel: ampel(tagsZwischen(ustVa, h)),
        paragraph: '§ 18 UStG',
        art: 'ustva',
        sprung: null
      });
    }

    // Sortierung: drohende Fristen (rot, gelb) zuerst, danach nach Datum
    var sortIdx = { rot: 0, gelb: 1, gruen: 2 };
    liste.sort(function (a, b) {
      if (a.ampel !== b.ampel) return sortIdx[a.ampel] - sortIdx[b.ampel];
      return a.frist.localeCompare(b.frist);
    });
    // Übermittlungs-Hinweis (wohin/wie) je Eintrag anhängen
    liste.forEach(function (f) { f.uebermittlung = uebermittlungFuer(f.art); });
    return liste;
  }

  function monatsname(monatIdx0, vormonat) {
    var namen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    var idx = vormonat ? (monatIdx0 - 1 + 12) % 12 : monatIdx0;
    return namen[idx];
  }

  return { naechsteFristen: naechsteFristen, uebermittlungFuer: uebermittlungFuer };
});
