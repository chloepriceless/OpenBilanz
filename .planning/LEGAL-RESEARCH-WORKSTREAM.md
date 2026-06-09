# Work-Stream: Rechtsgrundlagen + Rechtsprechung → Merkel (gemeinsam mit Bizzi)

**Auftrag (Christin via Orchestrator 9jssvkyj, 2026-06-09 ~15:38):** Alle relevanten Rechtsgrundlagen
durcharbeiten + nach Merkel ablegen, damit wir bessere Rechtstexte schreiben. **Kern: nicht nur
Gesetzestexte, sondern v.a. die juristischen URTEILE / Auslegung (Rechtsprechung)** — „das ist der viel
größere Teil". research-rigor, Primärquellen + Urteile mit Az., Merkel-Ingest mit Quelle+Datum+Tags.
**Eigener Work-Stream, KEIN Eil-Bedarf (Sparmodus).**

## Rollen
- **Bizzi (b1xqf4hz, orchestrator-bizzi) = LEAD.** Koordiniert die Aufteilung. Scope: Compliance/Vertrieb/
  DSGVO/UWG.
- **Pfenni (ich, gmbh-verwaltung/OpenBilanz).** Scope: **Steuer/USt/HGB/AO/GoBD/Bilanzrecht** + einschlägige
  **BFH-/FG-Rechtsprechung** (Az., Gericht, Datum, Leitsatz).

## Status (2026-06-09) — KOORDINATION MIT BIZZI ABGESCHLOSSEN / FESTGEZURRT
Bizzi (Lead) hat Aufteilung + Konvention + erste Etappe bestätigt. **LOCKED:**
- **Tag-Konvention (verbindlich, beide Domänen):** `tags = [rechtskorpus, rechtsprechung(nur bei Urteil),
  <gebiet>, <gericht>]` + `dvhub` wo produktrelevant (+ `openbilanz` für meine Bilanz-/HGB-Domäne).
  Text: Norm/§; bei Urteil Gericht + Az. + Datum + Leitsatz/**Auslegung**; `source_url`=Primärquelle
  (gesetze-im-internet/EUR-Lex/Gericht); `[[Verlinkung]]` zu Norm/verwandten Einträgen; **Stand-Datum**.
- **Überlapp:** GoBD/Aufbewahrung §147 AO + E-Rechnung (UStG-Ausstellung/Empfang) = **ICH** (Steuer-Sicht);
  Bizzi cross-verlinkt nur reine Form-/DDG-/CRA-Facetten auf meinen Eintrag (kein eigener Steuer-Eintrag).
- **Meine Welle 1 (Christin-/DVhub-relevanter Steuerkern):** USt-Leistungsort §3a + §19 Kleinunternehmer
  + E-Rechnung + GoBD/§147 AO.
- **Meine Welle 2:** HGB Bilanz/§267a/Offenlegung §325.
- **Bizzi:** Welle 1 = UWG §5/§5a/§7 + §§327ff BGB; Welle 2 = DSGVO/§5 DDG/CRA/ProdHaftG/AI Act/BFSG.
- **Vor jedem Ingest:** Merkel durchsuchen + Schlaubi (kcfu58ti) auf Vorrecherche prüfen (kein Duplikat).
- Gegenseitig kurz melden, wenn eine Welle durch ist.

## Konventionen (Vorschlag, mit Bizzi bestätigen)
- **Merkel-Ingest** `POST http://192.168.20.81:8000/ingest {title, text, source_url, tags[]}`.
  Vor JEDEM Ingest **Merkel durchsuchen** (`GET .../search?q=…`) — Schlaubi (kcfu58ti) hat evtl.
  Vorrecherche; nur Fehlendes holen.
- **Urteils-Eintrag:** Text enthält Az. + Gericht + Entscheidungsdatum + Leitsatz/Kernaussage + Bezug
  zum Produkt (OpenBilanz). `source_url` = amtliche/Primärquelle (z.B. bundesfinanzhof.de, juris,
  gesetze-im-internet.de). Tags z.B. `[rechtsprechung, <gebiet>, <gericht>, openbilanz]`. `[[Verlinkung]]`
  zur einschlägigen Norm-Note.
- **research-rigor:** Confidence-Label (VERIFIED/LIKELY/UNCERTAIN), nie aus Gedächtnis; Primärquelle.
  KEIN 1:1-Repost fremder kommerzieller Prosa (DATEV etc. nur interne Referenz).
- **Sparmodus:** Bulk-Recherche/Ingest bevorzugt günstigeres Modell (Gateway: sonnet/haiku/klick) +
  niedriger Effort; juristisches Kernurteil/Einordnung bleibt sorgfältig. Etappenweise, kein Blanket-Crawl;
  geteilte Haus-IP → gedrosselt crawlen (≤4 parallel + Delay).

## Merkel-Survey-Befund (2026-06-09) — wichtig für die Etappe
Merkel hat die **NORM-Seite** meiner Welle 1 bereits gut abgedeckt (Schlaubi-Vorrecherche, faktengeprüft):
USt-GmbH (Sätze/Vorsteuer/VA/Kleinunternehmer/Reverse-Charge), §19 UStG ab 2025 (25k/100k), E-Rechnung-
Zeitplan (Empfang 2025 / Versand >800k 2027 / alle 2028, NICHT B2C), §147 AO + §14b UStG Aufbewahrung,
GoBD digital (Stand 2025/2026) inkl. 2. Änderung 14.07.2025 (XML-Archivierung).
→ **LÜCKE = die RECHTSPRECHUNG** (Christins „viel größerer Teil"): BFH-/FG-Urteile mit Az., die diese
Normen AUSLEGEN, fehlen. **Darauf fokussiert die eigentliche Ingest-Arbeit** — NICHT die Normtexte
nochmal (Duplikat), sondern Leitentscheidungen + ihre Auslegung, je mit `[[Verlinkung]]` auf die
vorhandene Norm-Note.
Konkrete Urteils-Ziele Welle 1 (mit Primärquelle bundesfinanzhof.de/juris verifizieren, NIE aus Gedächtnis):
- **§147 AO / GoBD:** BFH zu Schätzungsbefugnis bei formellen/materiellen Buchführungsmängeln,
  Datenzugriff/Z3, Kassenführung, Zeitreihenvergleich.
- **§19 UStG:** BFH zur Gesamtumsatz-/Grenzberechnung, Wechsel Regelbesteuerung↔KU.
- **§3a UStG:** BFH/EuGH zum Leistungsort sonstiger Leistungen (B2B/B2C, elektronische Leistungen, MOSS/OSS).
- **E-Rechnung:** überwiegend BMF-Verwaltungsanweisung (wenig Rspr.) → Schreiben + ggf. erste FG-Fälle.

## Scope-Ergänzung + Quellen (Hub/Orchestrator 2026-06-09 15:42, bestätigt)
- **Scope erweitert:** zusätzlich **GmbHG (Kapital/Einlagen — §5/§7/§9 Mindest-/Einzahlung, ausstehende
  Einlagen, §30/§31 Kapitalerhaltung)** und **§§238 ff. HGB (Buchführungspflicht)**.
- **Gemeinfreie Primärquellen (verbindlich, kein Kommentar-/DATEV-Copy):**
  `gesetze-im-internet.de` (Normen), **`rechtsprechung-im-internet.de`** (BFH-/Bundesgerichts-Urteile,
  amtlich), `dejure.org` (Norm + Rspr.-Nachweise). EuGH: `curia.europa.eu`. Eigene Zusammenfassungen.
- **Modell/Kosten:** Sparmodus/„MiniMax", kostenbewusst, **parallel/nachgelagert** zur OpenBilanz-Arbeit
  (kein Opus-Grind; Web-Fetch der Primärquellen + sorgfältige juristische Einordnung; Bulk economical).

## Themen-Backlog (mein Scope — Reihenfolge mit Bizzi/Christin schärfen)
1. HGB-Bilanzrecht: §§238 ff. (Buchführungspflicht), §§242, 264–274 (Ansatz/Ausweis/Bewertung),
   §272 (Kapital/ausstehende Einlagen), §268 Abs.3 (Fehlbetrag) — Norm + Leitentscheidungen.
1b. GmbHG: §5/§7/§9 (Stammkapital/Einlagen/Differenzhaftung), §30/§31 (Kapitalerhaltung) + BGH/BFH-Rspr.
2. AO/GoBD: §§140–148 AO (Buchführungspflicht/Aufbewahrung §147), GoBD-BMF-Schreiben, E-Rechnung-Pflicht
   (Wachstumschancengesetz) — Verwaltungsanweisungen + Rechtsprechung.
3. UStG: Kleinunternehmer §19, Vorsteuer §15, USt-VA §18 — BFH-Rechtsprechung.
4. KStG/GewStG-Grundzüge (GmbH), Größenklassen §267/267a, Offenlegung §325 — soweit produktrelevant.

## Resume (frische Session)
1. `check_messages` — Antwort von Bizzi (Aufteilung/Tag-Konvention/Prio)? 
2. Sobald Split bestätigt: pro Thema **erst Merkel durchsuchen**, dann fehlende Norm + einschlägige Urteile
   (research-rigor) ingesten, Fortschritt an Orchestrator/Bizzi melden. Etappenweise, Sparmodus.
3. Kein Bizzi-Echo nach ~15 Min UND Arbeit nötig → einmal nachfragen; sonst (kein Eil) ruhen lassen.
