# HANDOVER — OpenBilanz (gmbh-verwaltung)

**Stand: 2026-06-10 · HEAD `7837502` (v2.13.1) · in sync · Working-Tree sauber · 265 Tests grün**

> ✅ **KOMPLETT-REVIEW (Christin-Auftrag 2026-06-10) DURCHGEFÜHRT + ALLE FUNDE GEFIXT, live v2.13.1.**
> 3 Review-Subagenten (Security/Architektur/Tests-Doku). Behoben: Pfad-Traversal (`lib/store.js`
> sicher), Content-Disposition-Header-Injection (`server.js` sendText), SHA-256-Pin (setup-pdf-lib.sh);
> globales `unhandledrejection`-Netz + boot/speichereStill-`.catch` + vorjahrLaedt-Deadlock; Dead-Code
> (kontoOpt, unterschrift-pdf-Load); DRITTQUELLEN (ERPNext-GPLv3 + vendored Libs) + CHANGELOG-Footer;
> 13 neue Tests (CAMT/IBKR-Parser via DOMParser-Shim, obz-Krypto, bankKontoVorschlag, closing).
> BEWUSST OFFEN (NIEDRIG/kein Bug): `window.__kontoDdBound`-Flag (korrekt, nur Stil); store-idb-Test nur
> mit fake-indexeddb (Migration ist abgedeckt); setup-taxonomie/pyodide ohne Hash-Pin (große amtliche
> Multi-File-Assets). Server-Security-Fixes betreffen Selbst-Hoster (Git), nicht die statische Website.

> Heute zusätzlich (nach Audit): **T2** geführte Umbuchung (v2.12.0, `shared/umbuchung.js`). **4 Christin-
> Requests** (HUB-REQUESTS.md) verify-first abgearbeitet: Bankimport-Dropdown+Löschen (bereits live v2.9.0),
> Fristen-Übermittlung (v2.7.0), 2900/2910-Ausweis (v2.11.x, audit-bestätigt) — alle bereits da; **EINE
> echte Lücke gefixt:** „davon eingezahlt" fehlte im Bilanz-Ausweis+PDF (nur Eingabe-Karte hatte es) →
> ergänzt in **v2.13.0** (kapitalAusweisZeilen + bilanz-pdf.js). Status pro Request in HUB-REQUESTS.md ## STATUS.

> ✅ **CODEX-VOLL-AUDIT (T-0161) ERLEDIGT + LIVE.** 1 kritischer Bug gefunden+behoben: § 268 Abs. 3
> HGB — überschuldete GmbH (negatives EK) meldete Bilanz fälschlich unausgeglichen (negatives P.A
> doppelt gezählt). Fix `Math.max(P.A,0)` in `summePassiva` (berechnung.js), v2.11.1 (Commit
> `9d88867`), live verifiziert. Bestehender Test war auf das Bug-Verhalten geschrieben (inkonsistente
> Bücher) → mitkorrigiert + Regression-Test. Rest des Rechenkerns + alle 1024 SKR04-Konten (902
> generierte systematisch, 0 Fehlzuordnung) + §272/Bankimport/Rundung/PDF: sauber. Codex-Refute-Konsens.
> Deliverable: `.planning/OPENBILANZ-AUDIT.md` (Commit `7170dfc`) + Report `~/Report/`. An Christin via
> vdyofkr8 gemeldet. **Aktiver Auftrag jetzt: T2 → T3 (unten).**

Frische Session: lies zuerst dieses Doc + Memory `project-open-tasks.md`. Resume-Hinweise: `check_messages` zuerst;
an Christin meldet man via Orchestrator-Peer **vdyofkr8** (`send_message`). Pro fertigem Schritt live deployen
(tar-Weg s.u.) + öffentlich verifizieren + an vdyofkr8 melden. **SPARMODUS** aktiv (nur Christin-angeforderte/
kritische Arbeit). Versionsregel: MAJOR bleibt 2. **Tags pushen: `git push origin --tags`** (--follow-tags pusht
leichtgewichtige Tags NICHT — Stolperstein, s. Memory openbilanz-versionierungsregel).

## Heute erledigt + LIVE (5 Releases, alle Christin-Brake)
- **v2.8.0** Vollständiger SKR04-Kontenrahmen (122→1024 Konten buchbar, 902 Zusatzkonten aus ERPNext-Quelle,
  HGB-zugeordnet, kuratierte Vorrang). + Refute fand Bilanz-Bruch (Math.abs bei Kontra-Konten) → Abschluss-Logik
  nach `public/shared/kontenabschluss.js` extrahiert + vorzeichenrichtig.
- **v2.9.0** Bankimport: aufklappbares SKR04-Dropdown (lazy `<select>`, kontoDropdown/bindeKontoDropdowns) +
  Zeilen-Löschen-Button (camtDel).
- **v2.10.0** §272 gezeichnetes Kapital: offener Nettoausweis am BILDSCHIRM (kapitalAusweisZeilen).
- **v2.11.0** Ausstehende Einlagen BUCHBAR (Konto **2910**): verpuffte vorher → jetzt korrekt als nicht
  eingefordert erfasst, Bilanz gleicht aus. kapitalRechnen(kapital,modus) + uebernehmeSalden selbstkonsistent.
  R22-Codex fand Sticky-State/Phantom-Aktiva-Blocker → behoben. Buchungshilfe in der Kapital-Karte.

## (HISTORIE — ERLEDIGT, s. oben) CODEX-VOLL-AUDIT (Christin, Brake, KRITISCH)
**Auftrag (Hub/Christin 19:03–19:07 MESZ):** „Lass CODEX ausführlich über ALLE Berechnungen, Konten und Angaben
in OpenBilanz laufen — alle Konten und Angaben müssen von Claude UND Codex genehmigt sein."
- **4-Augen pro Position:** Codex-Refute versucht jede Buchung/Kontenzuordnung/Rechnung zu widerlegen, DU (Claude)
  prüfst gegen. Bestätigt erst wenn BEIDE freigeben.
- **Fix-Loop:** Codex-Finding + du stimmst zu → erst Recheck (Codex kann irren), wenn bestätigt SOFORT fixen, dann
  erneut beide prüfen bis grün. **Eindeutige Fehler = sofort fixen. Strittiges/Mehrdeutiges (HGB/SKR04-Auslegung,
  riskante Buchungslogik-Änderung, Claude/Codex uneins) = NICHT eigenmächtig → über Hub an Christin vorlegen
  (Optionen + Empfehlung).**
- **Umfang (mind.):** SKR04-Konten-Mappings (voller Kontenrahmen, 1460 Geldtransit, 6420, Umbuchungen), §272
  gezeichnetes Kapital + ausstehende Einlagen (2910, Eröffnungsbuchungen + Nettoausweis), Bilanzsummen/Aktiv=Passiv/
  GuV-Summen/Saldenkonsistenz, CAMT.053/MT940-Bankimport-Verbuchung, alle Rechen-/Rundungslogik, PDF-Zahlen.
- **Deliverable:** Audit-Doc **`.planning/OPENBILANZ-AUDIT.md`** (Sign-off-Tabelle: Position | Claude-Verdict |
  Codex-Verdict | Status ✅/⚠️/❌ | Begründung) + committen. Report nach `~/Report/` + Kurzfazit an Hub (geprüft/
  gefixt/offen). **DATEV NICHT scrapen** — Korrektheit aus HGB (§272 gemeinfrei) + SKR04-Fakten + eigener Logik.
- **Codex-Sparring:** `general-purpose` Subagent mit Refute-Prompt (codex-worker nicht im Agent-Tool verfügbar).
  Subagent dem Hub melden (POST /api/agent-subagents), in Tätigkeitsbericht als reviewer.
- **Reihenfolge:** Audit über den FERTIGEN Stand. T2/T3 unten ggf. ZUERST bauen, dann Audit über alles — ODER mit
  Christin/Hub klären, ob Audit jetzt über den Ist-Stand (T1+§272+Bankimport sind fertig) und T2/T3 separat.
  Empfehlung: Audit kann JETZT über den fertigen Kern laufen (T1/§272/Bankimport); T2/T3 danach + nachauditieren.

### Audit-Addenda (Christin 19:07/19:09 MESZ)
- **Recherche bei Abweichung:** nicht raten — gründlich belegen. PRIMÄR Gesetz/gemeinfrei (HGB §§242ff/266/272,
  EStG/AO, GoB, amtlicher SKR04). CROSS-CHECK DATEV-Hilfecenter/Literatur NUR zum Verifizieren welche Behandlung
  korrekt ist (Fakten/Recht frei). **COPYRIGHT hart:** DATEV-Prosa NIE wörtlich/umformuliert kopieren — Produkt-/
  Glossar-/Merkel-Texte = EIGENER Text, aufs Gesetz gestützt, mit Quelle (§/URL+Datum).
- **Merkel-Pflicht:** jede substanzielle Recherche → `POST http://192.168.20.81:8000/ingest {title,text,source_url,tags[]}`
  (Quelle+Datum+Tags+[[Verlinkung]]).
- **Sparmodus:** Recherche bounded (pro Abweichung, kein Blanket-Crawl), Teilarbeit ggf. auf Sonnet/Gateway,
  Audit-Kernurteil bleibt bei Claude+Codex.
- **Ticket = T-0161.** FIX statt nur reporten: Codex-Finding + Claude-Recheck-gegen-echten-Code bestätigt →
  direkt fixen (atomarer Commit); Falsch-Positive verwerfen + im Doc begründen. **ERST Merkel durchsuchen**
  (`GET http://192.168.20.81:8000/search?q=…` — Schlaubi hat DATEV evtl. schon geharvestet), nur Fehlendes holen.
  DATEV-Ref: doc 1029183 + Suche „ausstehende einlagen buchen und ausweisen". Audit-Doc-Spalten zusätzlich:
  „Fix angewandt (Commit)" + „Quelle DATEV/Gesetz".

## Queue T2/T3 (GO, nicht Brake)
- ✅ **T2 ERLEDIGT + LIVE (v2.12.0, Commit `134e344`).** Geführte Umbuchung zw. eigenen Konten:
  neue Karte „Geld umbuchen" im Buchhaltungs-Modus, erzeugt aus „von → nach + Betrag" automatisch
  den korrekten Satz (Aktiv an Aktiv: Soll=Ziel, Haben=Quelle), optional über Geldtransit 1460
  (2 Sätze, nettet auf 0). Logik in testbarem Modul `public/shared/umbuchung.js` (4 Tests, 250 grün);
  jede Buchung läuft zusätzlich durch BuchungsPruefung. Live verifiziert (umbuchung.js HTTP200,
  app.js umbAdd). OFFEN (Christin-Visual): Maske im Browser bedienen.
- ⏳ **T3 OFFEN (nächster Task) — durchsuchbares SKR04-Glossar.** Eigene kurze Erklärung je Konto
  (KEIN DATEV-Copy, research-rigor; Texte aufs Gesetz/HGB gestützt mit Quelle). View 'glossar' +
  GLOSSAR-Array existieren bereits, globale Suche findet SKR04 schon. **Content-lastig, etappenweise
  (erst ~40 häufigste Konten).** SPARMODUS-Hinweis: content/research-lastig → bevorzugt Sonnet/Haiku +
  niedriger Effort, etappenweise; unter Sparmodus zunächst ZURÜCKGESTELLT (an Christin gemeldet),
  zieht eine Session auf „weiter mit T3". RESUME: GLOSSAR-Array + view 'glossar' im app.js suchen,
  Batch der häufigsten Konten mit eigenen Kurztexten (§/HGB-Beleg) ergänzen, Findings→Merkel.
- **Blockiert:** Reddit oprctx4 (403, Text-Paste nötig).

## Schlüssel-Dateien
- `public/shared/kontenabschluss.js` — salden2werte (Abschluss-Aggregation, vorzeichenrichtig, 2900/2910-Kapital).
- `public/shared/berechnung.js` — kapitalRechnen(kapital,modus) §272, berechne() Bilanz/GuV.
- `public/shared/skr04.js` + `skr04-voll.js` (902 generiert, tools/gen-skr04-voll.js) + `tools/skr04-erpnext-source.json` (gitignored, GPL-Quelle).
- `public/app.js` — uebernehmeSalden (~4976), kapitalAusweisZeilen, camtVorschau, kontoDropdown, [data-pfad]-Handler (~1631).
- `public/shared/bilanz-pdf.js` — PDF-Bilanz (§272-Nettoausweis Z.108).

## Deploy + Verify
`tar -C public -czf - --exclude=pyodide --exclude=taxonomie --exclude=wheels --exclude=.git --exclude=rechtliche-links.json . | ssh root@openbilanz.de 'tar -xzf - -C /root/openbilanz/site/app && cd /root/openbilanz/site && docker compose restart'`
Verify: `curl -s https://openbilanz.de/app/shared/version.js | grep APP`. UI nicht autonom prüfbar → Christin-Visual.
