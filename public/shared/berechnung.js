/* ===========================================================================
 * berechnung.js  -  Rechenkern für Bilanz, GuV und Größenklasse
 * ---------------------------------------------------------------------------
 * Reine Rechenlogik (keine Darstellung). Läuft in Node und im Browser.
 *
 * Wichtige gesetzliche Regeln, die hier umgesetzt sind:
 *   - § 272 Abs. 1 HGB  Nettomethode bei nicht voll eingezahltem Stammkapital
 *   - § 268 Abs. 3 HGB  "Nicht durch Eigenkapital gedeckter Fehlbetrag"
 *   - § 275 HGB         GuV-Verrechnung (Gesamt-/Umsatzkostenverfahren)
 *   - § 267 / § 267a    Größenklassen-Einstufung (2-von-3-Regel)
 *   - Bilanzgleichung   Summe Aktiva = Summe Passiva
 * ========================================================================= */
(function (root, factory) {
  var Positionen = (typeof module !== 'undefined' && module.exports)
    ? require('./positionen.js')
    : root.Positionen;
  var api = factory(Positionen);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Berechnung = api;
})(typeof self !== 'undefined' ? self : this, function (Positionen) {
  'use strict';

  function num(v) {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    var s = String(v == null ? '' : v).replace(/\s/g, '');
    // Deutsche Zahl: Komma = Dezimaltrenner, Punkt = Tausender.
    if (s.indexOf(',') >= 0) {
      // "1.234,56" -> Tausenderpunkte raus, Komma wird Dezimalpunkt.
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
      // Kein Komma, aber reine 3er-Gruppierung ("1.234", "12.500", "2.500.000"):
      // Punkte sind Tausendertrenner. So bleibt "1.5"/"1.23" der Dezimalpunkt.
      s = s.replace(/\./g, '');
    }
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function cent(v) { return Math.round(num(v) * 100) / 100; }

  /* ---- Baum-Summen ------------------------------------------------------
   * Ergibt für JEDEN Knoten einen Wert: Blätter aus den erfassten Werten,
   * Elternknoten als Summe ihrer Kinder. Wenn ein Elternknoten Kinder ohne
   * Werte hat, aber selbst einen erfassten Wert besitzt (Eingabe auf höherer
   * Ebene), wird dieser Direktwert verwendet.
   * "Belegt" heißt: im werte-Objekt ist ein Wert ERFASST - auch eine
   * explizite 0 zählt. Sonst würde ein Elternwert (z. B. 100) Kinder, die
   * bewusst alle auf 0 gesetzt wurden, still überstimmen. */
  function istErfasst(v) {
    return v !== undefined && v !== null && String(v).trim() !== '';
  }
  function baumSummen(baum, werte, out, belegt) {
    out = out || {};
    belegt = belegt || {};
    for (var i = 0; i < baum.length; i++) {
      var k = baum[i];
      if (k.kinder && k.kinder.length) {
        baumSummen(k.kinder, werte, out, belegt);
        var summe = 0, hatKindWert = false;
        for (var j = 0; j < k.kinder.length; j++) {
          var kid = k.kinder[j].id;
          summe += out[kid] || 0;
          if (belegt[kid]) hatKindWert = true;
        }
        // Eingabe auf Elternebene (z.B. römisch) hat Vorrang, wenn kein Kind belegt ist
        out[k.id] = hatKindWert ? cent(summe) : cent(werte[k.id]);
        belegt[k.id] = hatKindWert || istErfasst(werte[k.id]);
      } else {
        out[k.id] = cent(werte[k.id]);
        belegt[k.id] = istErfasst(werte[k.id]);
      }
    }
    return out;
  }

  /* ---- Kapital nach § 272 Abs. 1 HGB (Nettomethode) --------------------- */
  function kapitalRechnen(kapital, modus) {
    kapital = kapital || {};
    var gezeichnet = cent(kapital.gezeichnet);
    var eingezahlt = cent(kapital.eingezahlt);
    var eingefordertOffen = cent(kapital.eingefordertOffen); // eingefordert, aber nicht eingezahlt
    // Nicht eingeforderte ausstehende Einlagen (§ 272 Abs. 1 S. 2 HGB): im Buchhaltungs-
    // Modus DIREKT aus dem gebuchten Konto 2910 (Ausstehende Einlagen, nicht eingefordert),
    // sonst aus den Eröffnungsbilanz-Eingaben abgeleitet (gezeichnet ./. eingezahlt ./. eingefordert).
    var nichtEingefordert;
    if (modus === 'BUCHHALTUNG' && kapital.nichtEingefordert != null && kapital.nichtEingefordert !== '') {
      nichtEingefordert = cent(kapital.nichtEingefordert);
    } else {
      nichtEingefordert = cent(gezeichnet - eingezahlt - eingefordertOffen);
    }
    if (nichtEingefordert < 0) nichtEingefordert = 0;
    if (nichtEingefordert > gezeichnet) nichtEingefordert = gezeichnet;
    // Eingefordertes Kapital = Nennbetrag ./. nicht eingeforderte ausstehende Einlagen
    var eingefordertesKapital = cent(gezeichnet - nichtEingefordert);
    return {
      gezeichnet: gezeichnet,                       // Nennbetrag (Stammkapital)
      eingezahlt: eingezahlt,                       // tatsächlich eingezahlt
      eingefordertOffen: eingefordertOffen,         // -> Aktivposten "Forderung"
      nichtEingefordert: nichtEingefordert,         // -> offen abgesetzt vom gez. Kapital
      eingefordertesKapital: eingefordertesKapital  // -> Passivposten A.I (Hauptspalte)
    };
  }

  /* ---- GuV-Berechnung (§ 275 HGB) --------------------------------------- */
  function rechneGuv(abschluss) {
    if (abschluss.art === 'EROEFFNUNGSBILANZ') {
      return { verfahren: null, werte: {}, jahresergebnis: 0, zeilen: [] };
    }
    var verfahren = abschluss.guvVerfahren || 'GKV';
    var schema = Positionen.guvSchema(verfahren);
    var erfasst = (abschluss.werte && abschluss.werte.guv) || {};
    var werte = {};

    // 1. Durchlauf: Blattwerte und Posten mit a/b-Kindern
    function blatt(p) {
      if (p.kinder && p.kinder.length) {
        var s = 0, hat = false;
        for (var i = 0; i < p.kinder.length; i++) {
          werte[p.kinder[i].id] = cent(erfasst[p.kinder[i].id]);
          s += werte[p.kinder[i].id];
          if (werte[p.kinder[i].id]) hat = true;
        }
        werte[p.id] = hat ? cent(s) : cent(erfasst[p.id]);
      } else if (!p.formel) {
        werte[p.id] = cent(erfasst[p.id]);
      }
    }
    schema.forEach(function (p) { if (!p.formel) blatt(p); });

    // 2. Durchlauf: Zwischensummen und Ergebnis nach Formel
    schema.forEach(function (p) {
      if (!p.formel) return;
      var s = 0;
      p.formel.forEach(function (ref) {
        var neg = ref.charAt(0) === '-';
        var id = neg ? ref.slice(1) : ref;
        var v = werte[id] || 0;
        s += neg ? -v : v;
      });
      werte[p.id] = cent(s);
    });

    var ergebnisId = schema[schema.length - 1].id;
    return { verfahren: verfahren, werte: werte, jahresergebnis: werte[ergebnisId] || 0, schema: schema };
  }

  /* ---- Bilanz-Berechnung ------------------------------------------------ */
  function rechneBilanz(abschluss, jahresergebnis) {
    var werte = abschluss.werte || {};
    var aktivaW = werte.aktiva || {};
    var passivaW = werte.passiva || {};
    var kap = kapitalRechnen(abschluss.kapital, abschluss.erfassungsmodus);

    // Aktiva-Baum summieren (ohne F)
    var aktivaBaum = Positionen.AKTIVA.filter(function (n) { return n.id !== 'F'; });
    var aktiva = baumSummen(aktivaBaum, aktivaW);

    // § 272 Abs. 1 Satz 3 HGB: eingeforderte, aber noch nicht eingezahlte
    // Einlagen werden unter den Forderungen (B.II) gesondert ausgewiesen.
    if (kap.eingefordertOffen > 0) {
      aktiva['B.II'] = cent((aktiva['B.II'] || 0) + kap.eingefordertOffen);
      aktiva['B']    = cent((aktiva['B'] || 0) + kap.eingefordertOffen);
    }

    // Passiva-Baum: P.A.I und P.A.V werden automatisch gesetzt
    var passivaW2 = {};
    for (var key in passivaW) passivaW2[key] = passivaW[key];
    passivaW2['P.A.I'] = kap.eingefordertesKapital;                       // § 272 Abs. 1
    passivaW2['P.A.V'] = abschluss.art === 'JAHRESABSCHLUSS' ? cent(jahresergebnis) : 0;
    var passiva = baumSummen(Positionen.PASSIVA, passivaW2);

    // Eigenkapital-Summe
    var ekSumme = passiva['P.A'];

    // § 268 Abs. 3 HGB: nicht durch Eigenkapital gedeckter Fehlbetrag
    var fehlbetrag = ekSumme < 0 ? cent(-ekSumme) : 0;
    aktiva['F'] = fehlbetrag;

    // Bilanzsummen
    var summeAktiva = cent(
      (aktiva['A'] || 0) + (aktiva['B'] || 0) + (aktiva['C'] || 0) +
      (aktiva['D'] || 0) + (aktiva['E'] || 0) + (aktiva['F'] || 0)
    );
    // § 268 Abs. 3 HGB: Ist das Eigenkapital negativ, wird es als "Nicht durch
    // Eigenkapital gedeckter Fehlbetrag" auf die Aktivseite reklassifiziert
    // (aktiva['F'] = -ekSumme). In der Passivsumme trägt das Eigenkapital dann 0 bei
    // (Math.max(P.A, 0)) - sonst würde das negative P.A doppelt zählen (einmal als
    // Fehlbetrag aktivseitig, einmal negativ passivseitig) und die Bilanz einer
    // korrekt gebuchten überschuldeten GmbH erschiene um den Fehlbetrag unausgeglichen.
    var summePassiva = cent(
      Math.max(passiva['P.A'] || 0, 0) + (passiva['P.B'] || 0) + (passiva['P.C'] || 0) +
      (passiva['P.D'] || 0) + (passiva['P.E'] || 0)
    );

    var differenz = cent(summeAktiva - summePassiva);

    return {
      aktiva: aktiva,
      passiva: passiva,
      kapital: kap,
      eingefordertesKapitalOffen: kap.eingefordertOffen,
      eigenkapital: ekSumme,
      fehlbetrag: fehlbetrag,
      summeAktiva: summeAktiva,
      summePassiva: summePassiva,
      differenz: differenz,
      ausgeglichen: Math.abs(differenz) < 0.005
    };
  }

  /* ---- Gesamtberechnung eines Abschlusses ------------------------------- */
  function berechne(abschluss) {
    var guv = rechneGuv(abschluss);
    var bilanz = rechneBilanz(abschluss, guv.jahresergebnis);
    return { guv: guv, bilanz: bilanz };
  }

  /* ---- Größenklassen-Einstufung (§ 267 / § 267a HGB) ------------------ */
  /* merkmale: { bilanzsumme, umsatz, arbeitnehmer }
   * gjBeginn: ISO-Datum des Geschäftsjahresbeginns
   * opts.wahlrechtNeueSchwellen: true -> neue Schwellen schon ab GJ 2023 */
  function bestimmeGroessenklasse(merkmale, gjBeginn, opts) {
    opts = opts || {};
    var S = Positionen.GROESSENKLASSEN.schwellen;
    var beginn = gjBeginn || '';
    var satz;
    if (beginn >= S.neu.gueltigAbGjBeginn) satz = S.neu;
    else if (opts.wahlrechtNeueSchwellen && beginn >= S.neu.wahlrechtAbGjBeginn) satz = S.neu;
    else satz = S.alt;

    function passt(grenze) {
      var t = 0;
      if (num(merkmale.bilanzsumme) <= grenze.bilanzsumme) t++;
      if (num(merkmale.umsatz)      <= grenze.umsatz)      t++;
      if (num(merkmale.arbeitnehmer)<= grenze.arbeitnehmer)t++;
      return t >= 2; // mind. zwei der drei Merkmale eingehalten
    }
    var klasse;
    if (passt(satz.kleinst)) klasse = 'KLEINST';
    else if (passt(satz.klein)) klasse = 'KLEIN';
    else if (passt(satz.mittel)) klasse = 'MITTEL';
    else klasse = 'GROSS';

    return {
      klasse: klasse,
      schwellensatz: satz === S.neu ? 'neu' : 'alt',
      angewandteSchwellen: satz,
      info: Positionen.GROESSENKLASSEN.klassen[klasse]
    };
  }

  /* ---- Plausibilitätsprüfungen ----------------------------------------
   * pruefe(abschluss, vorjahr?) - der zweite Parameter ist optional: ein
   * vollständiger Vorjahres-Abschluss derselben Struktur ermöglicht die
   * Abweichungsprüfung (§ 265 Abs. 2 HGB). Fehlt er, entfällt nur diese. */
  function pruefe(abschluss, vorjahr) {
    var r = berechne(abschluss);
    var meldungen = [];
    var kap = r.bilanz.kapital;

    if (!r.bilanz.ausgeglichen) {
      meldungen.push({ stufe: 'fehler',
        text: 'Bilanz ist nicht ausgeglichen. Aktiva ' + kap0(r.bilanz.summeAktiva) +
              ' EUR, Passiva ' + kap0(r.bilanz.summePassiva) + ' EUR, Differenz ' +
              kap0(r.bilanz.differenz) + ' EUR.' });
    }
    if (kap.gezeichnet > 0 && kap.gezeichnet < 25000 && (abschluss.rechtsform || 'GmbH') === 'GmbH') {
      meldungen.push({ stufe: 'warnung',
        text: 'Gezeichnetes Kapital ' + kap0(kap.gezeichnet) + ' EUR liegt unter dem ' +
              'Mindeststammkapital einer GmbH von 25.000 EUR (§ 5 Abs. 1 GmbHG).' });
    }
    if (kap.gezeichnet > 0 && (kap.eingezahlt + kap.eingefordertOffen) > kap.gezeichnet + 0.005) {
      meldungen.push({ stufe: 'fehler',
        text: 'Eingezahltes plus eingefordertes Kapital übersteigt das gezeichnete Kapital.' });
    }
    if (abschluss.art === 'EROEFFNUNGSBILANZ' && kap.gezeichnet >= 25000 &&
        kap.eingezahlt < 12500) {
      meldungen.push({ stufe: 'warnung',
        text: 'Vor Anmeldung der GmbH müssen mind. 12.500 EUR eingezahlt sein ' +
              '(§ 7 Abs. 2 GmbHG). Aktuell eingezahlt: ' + kap0(kap.eingezahlt) + ' EUR.' });
    }
    if (r.bilanz.fehlbetrag > 0) {
      meldungen.push({ stufe: 'warnung',
        text: 'Das Eigenkapital ist durch Verluste aufgebraucht. Es wird ein ' +
              '"Nicht durch Eigenkapital gedeckter Fehlbetrag" von ' +
              kap0(r.bilanz.fehlbetrag) + ' EUR ausgewiesen (§ 268 Abs. 3 HGB). ' +
              'Prüfen Sie eine mögliche Überschuldung.' });
    }

    // Eingabe-Konflikt Eltern-/Unterposten: baumSummen verwirft einen direkt auf
    // einem Oberposten erfassten Wert, sobald ein Unterposten belegt ist (die
    // Summe der Kinder hat Vorrang). Das soll nicht still passieren - der Nutzer
    // bekommt einen Hinweis, welcher Wert ignoriert wird.
    function findeEingabeKonflikte(baum, werteRoh, seite) {
      (baum || []).forEach(function (k) {
        if (!k.kinder || !k.kinder.length) return;
        var direkt = cent(num((werteRoh || {})[k.id]));
        var kindBelegt = k.kinder.some(function (kid) {
          return Math.abs(cent(num((werteRoh || {})[kid.id]))) >= 0.005;
        });
        if (Math.abs(direkt) >= 0.005 && kindBelegt) {
          meldungen.push({ stufe: 'warnung',
            text: 'Position ' + k.id + ' (' + seite + '): Der direkt erfasste Wert ' +
                  kap0(direkt) + ' EUR wird ignoriert, weil Unterposten belegt sind - ' +
                  'es zählt die Summe der Unterposten. Bitte den Betrag auf die ' +
                  'Unterposten verteilen oder die Eingabe auf der Oberposition leeren.' });
        }
        findeEingabeKonflikte(k.kinder, werteRoh, seite);
      });
    }
    findeEingabeKonflikte(Positionen.AKTIVA, abschluss.werte && abschluss.werte.aktiva, 'Aktiva');
    findeEingabeKonflikte(Positionen.PASSIVA, abschluss.werte && abschluss.werte.passiva, 'Passiva');

    /* --- erweiterte Plausibilitätsprüfungen --------------------------- */
    var istJA = abschluss.art === 'JAHRESABSCHLUSS';
    var verf = r.guv.verfahren;
    function guvSumme(ids) {
      var s = 0;
      for (var i = 0; i < (ids || []).length; i++) s += r.guv.werte[ids[i]] || 0;
      return s;
    }
    // Umsatzerlöse verfahrensunabhängig (nur eine der drei IDs ist belegt)
    function umsatzVon(g) {
      return (g.werte['gkv.1'] || 0) + (g.werte['ukv.1'] || 0) + (g.werte['kst.1'] || 0);
    }
    var idAfa    = { GKV: ['gkv.7'], KLEINST: ['kst.5'] }[verf] || [];
    var idBeteil = { GKV: ['gkv.9', 'gkv.10'], UKV: ['ukv.8', 'ukv.9'] }[verf] || [];
    var idEStr   = { GKV: ['gkv.14'], UKV: ['ukv.13'], KLEINST: ['kst.7'] }[verf] || [];

    // Eigenkapitalquote: dünne Kapitaldecke (nur bei ausgeglichener Bilanz mit
    // positivem EK - ein negatives EK ist bereits über den Fehlbetrag gemeldet)
    if (r.bilanz.ausgeglichen && r.bilanz.summeAktiva > 0 && r.bilanz.eigenkapital > 0) {
      var ekQuote = r.bilanz.eigenkapital / r.bilanz.summeAktiva;
      if (ekQuote < 0.10) {
        meldungen.push({ stufe: 'warnung',
          text: 'Eigenkapitalquote nur ' + (Math.round(ekQuote * 1000) / 10) + ' % ' +
                '(Eigenkapital ' + kap0(r.bilanz.eigenkapital) + ' EUR, Bilanzsumme ' +
                kap0(r.bilanz.summeAktiva) + ' EUR). Unter 10 % ist die Kapitaldecke ' +
                'dünn - bei weiteren Verlusten droht eine bilanzielle Überschuldung.' });
      }
    }

    if (istJA) {
      // Positives Ergebnis, aber keine Ertragsteuer/Steuerrückstellung erfasst
      var eStr = guvSumme(idEStr);
      var vorSteuer = r.guv.jahresergebnis + eStr;
      if (vorSteuer > 1 && eStr <= 0 && (r.bilanz.passiva['P.B.2'] || 0) <= 0) {
        meldungen.push({ stufe: 'warnung',
          text: 'Ergebnis vor Steuern ' + kap0(vorSteuer) + ' EUR, aber weder ein ' +
                'Ertragsteueraufwand in der GuV noch eine Steuerrückstellung (Posten ' +
                'P.B.2) erfasst. Eine GmbH schuldet auf den Gewinn Körperschaftsteuer, ' +
                'Solidaritätszuschlag und Gewerbesteuer - Steuerrückstellung prüfen.' });
      }
      // Abschreibungen gebucht, aber kein Anlagevermögen ausgewiesen
      var afa = guvSumme(idAfa);
      if (afa > 0 && (r.bilanz.aktiva['A'] || 0) <= 0) {
        meldungen.push({ stufe: 'warnung',
          text: 'Abschreibungen ' + kap0(afa) + ' EUR gebucht, aber kein Anlagevermögen ' +
                '(Posten A.) in der Bilanz. Prüfen, ob Anlagegüter erfasst sind - die ' +
                'Sofortabschreibung geringwertiger Wirtschaftsgüter ist allerdings zulässig.' });
      }
      // Beteiligungs-/Finanzanlageerträge ohne entsprechende Bilanzposten
      var beteil = guvSumme(idBeteil);
      var finanzVerm = (r.bilanz.aktiva['A.III'] || 0) + (r.bilanz.aktiva['B.III'] || 0);
      if (beteil > 0 && finanzVerm <= 0) {
        meldungen.push({ stufe: 'warnung',
          text: 'Erträge aus Beteiligungen/Finanzanlagen ' + kap0(beteil) + ' EUR gebucht, ' +
                'aber weder Finanzanlagen (A.III) noch Wertpapiere (B.III) in der Bilanz. ' +
                'Sind die Bestände am Stichtag noch vorhanden? (Bei unterjährigem Verkauf ok.)' });
      }
      // Wertpapiere des Umlaufvermögens am Stichtag -> Niederstwert-Erinnerung.
      // Konnten wir den Stichtagskurs hier nicht selbst prüfen, daher Hinweis.
      var wpUv = r.bilanz.aktiva['B.III'] || 0;
      if (wpUv > 0) {
        meldungen.push({ stufe: 'info',
          text: 'Wertpapiere des Umlaufvermögens (B.III) zum Stichtag ' + kap0(wpUv) + ' EUR. ' +
                'Strenges Niederstwertprinzip beachten (§ 253 Abs. 4 HGB): Liegt der ' +
                'Kurswert am Bilanzstichtag unter den Anschaffungskosten, ist zwingend auf ' +
                'den niedrigeren Wert abzuschreiben (Konto 7210 an 1500/1510).' });
      }
    }

    // Vorjahresvergleich (§ 265 Abs. 2, § 284 HGB): nur wenn ein Vorjahres-
    // Abschluss übergeben wurde. Abweichungen über 20 % sind erläuterungswürdig.
    if (vorjahr && (vorjahr.werte || vorjahr.kapital)) {
      var rv = berechne(vorjahr);
      var abw = function (jetzt, vor, label) {
        if (Math.abs(vor) < 1) return;
        var q = Math.abs(jetzt - vor) / Math.abs(vor);
        if (q > 0.20) {
          meldungen.push({ stufe: 'info',
            text: label + ' weicht um ' + Math.round(q * 100) + ' % vom Vorjahr ab ' +
                  '(Vorjahr ' + kap0(vor) + ' EUR, aktuell ' + kap0(jetzt) + ' EUR). ' +
                  'Wesentliche Abweichungen sind im Anhang zu erläutern (§ 284 HGB).' });
        }
      };
      abw(r.bilanz.summeAktiva, rv.bilanz.summeAktiva, 'Die Bilanzsumme');
      if (istJA && vorjahr.art === 'JAHRESABSCHLUSS') {
        abw(umsatzVon(r.guv), umsatzVon(rv.guv), 'Die Umsatzerlöse');
      }
    }

    return { berechnung: r, meldungen: meldungen };
  }
  function kap0(n) {
    return (Math.round(n * 100) / 100).toLocaleString
      ? (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(Math.round(n * 100) / 100);
  }

  return {
    num: num,
    cent: cent,
    baumSummen: baumSummen,
    kapitalRechnen: kapitalRechnen,
    rechneGuv: rechneGuv,
    rechneBilanz: rechneBilanz,
    berechne: berechne,
    bestimmeGroessenklasse: bestimmeGroessenklasse,
    pruefe: pruefe
  };
});
