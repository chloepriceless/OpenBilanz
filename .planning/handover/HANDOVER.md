# HANDOVER — OpenBilanz (gmbh-verwaltung)

**Stand: 2026-06-08 ~17:10 · HEAD `ccf0f62` · in sync · Working-Tree sauber · 245 Tests grün**

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

## ▶▶ NÄCHSTER GROSSER AUFTRAG (Christin, Brake, KRITISCH) — CODEX-VOLL-AUDIT ◀◀
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

## Danach: T2 + T3 (GO, nicht Brake)
- **T2** geführte Umbuchungs-Vorlage zw. eigenen Konten (Geldtransit 1460). Bausteine: Buchungsmaske buSoll/buHaben
  (kontoDropdown), eigene Konten ekAdd, Vorlagen eigeneVorlagen. „klein".
- **T3** durchsuchbares SKR04-Glossar (eigene Texte je Konto, KEIN DATEV-Copy, research-rigor). View 'glossar' +
  GLOSSAR-Array existieren. Content-lastig, etappenweise (erst ~40 häufigste).
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
