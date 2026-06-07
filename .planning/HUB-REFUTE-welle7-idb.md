# Hub-Re-Refute — Welle 7 (Mehrmandanten) / IndexedDB-Schema-Migration

- **Reviewer:** Hub (adversarieller Re-Refute-Gate), read-only
- **Datum:** 2026-06-07
- **Repo-Stand:** HEAD `285823a` (6 Welle-7-Commits seit `a8bbc77`/v2.2.0)
- **Test-Lauf (read-only, Temp-Dirs):** `node tests/run.js` → **218 bestanden, 0 fehlgeschlagen**
- **Scope:** v1→v2 IndexedDB-Migration im Website-Modus (`public/shared/store-idb.js`),
  reine Transform (`public/shared/mandanten-migration.js`), Server-Datei-Migration
  (`lib/store.js` + `lib/mandanten-store-migration.js`), Adapter, UI-Switcher, Zeitleiste, Tests.

## Verdikt

**DEPLOY-SAFE: JA — mit einer Auflage (manueller Browser-Smoke-Test der IDB-onupgradeneeded-
Migration mit echter v1-Bestands-DB), die im CHANGELOG und Code bereits als Gate dokumentiert ist.**

Es wurde **kein BLOCKER** gefunden. Die Migration ist sauber konstruiert: verlustfrei,
idempotent, kopiert-statt-verschiebt (Server), Pre-Backup (Server), Phantom-Mandant-frei,
korrekte Script-Ladereihenfolge, und mit einer getesteten reinen Transform als Single-Source-
of-Truth für die Zuordnungsregel. Die Befunde sind 1 substanzielle WARNUNG (fehlende
automatisierte IDB-Laufzeitabdeckung — vom Team selbst eingeräumt) plus mehrere kleinere
WARNUNGEN/Hinweise. Keiner davon droht Datenverlust im Normalpfad.

| Schwere   | Anzahl |
|-----------|--------|
| BLOCKER   | **0**  |
| WARNUNG   | **6**  |
| OK (geprüft, sauber) | 9 |

---

## 1. DATENVERLUST beim IDB-Versions-Upgrade

### OK — Singleton→standard-Zuordnung ist verlustfrei
`public/shared/store-idb.js:43-70` (`migriereV1zuV2`). Der v1-Singleton
(`unternehmen._id='singleton'`) wird gelesen, das alte Objekt **unverändert übernommen**,
nur `_id`/`mandantId` auf `'standard'` gesetzt und neu geschrieben; der alte Schlüssel
`'singleton'` wird gelöscht. Es wird **kein Feld gedroppt**. Die Abschlüsse werden per
Cursor an Ort und Stelle aktualisiert (`c.update(rec)`, `store-idb.js:60`) — kein Delete,
kein Re-Insert, keine ID-Änderung. Beleg-Gegentest: die reine Transform-Tests
`tests/run.js:1417` („verlustfrei (id-Menge identisch)") und `:1400` decken die identische
Regel ab.

### OK — kein destruktives `createObjectStore`/`clear` auf Bestandsdaten
`store-idb.js:84-91`: Im `oldVersion < 2`-Zweig wird **nur** der neue Store `mandanten`
und der neue Index `mandantId` additiv angelegt (beide guarded mit `contains(...)`).
Die Bestands-Stores `unternehmen`/`abschluesse` werden **nicht** gelöscht/neu erstellt.
`createObjectStore` für `unternehmen`/`abschluesse`/`meta` läuft ausschließlich im
`oldVersion < 1`-Zweig (`store-idb.js:78-83`), also nur bei Frischinstallation.

### OK — Frischinstallation migriert nichts
`store-idb.js:94`: `migriereV1zuV2` wird nur bei `e.oldVersion >= 1` aufgerufen. Eine
neue DB (oldVersion 0) durchläuft beide Zweige rein additiv, ohne Migration. Korrekt.

### WARNUNG W1 — `name`-Quelle bei großem Altbestand
`store-idb.js:49`: Mandantenname = `u.name || u.firma || 'Standard'`. Konsistent zu
`Transform.nameFuer` (`mandanten-migration.js:93-100`). Kein Datenverlust, nur kosmetisch:
hatte ein v1-Unternehmen weder `name` noch `firma`, heißt der Mandant generisch „Standard".
Akzeptabel; erwähnt für Vollständigkeit.

---

## 2. IDEMPOTENZ / Re-Run-Sicherheit (Abbruch mitten in der Migration)

### OK — IDB-Versionsupgrade ist atomar (all-or-nothing)
Die gesamte `onupgradeneeded`-Logik läuft in der **`versionchange`-Transaktion**
(`store-idb.js:76-97`). Bricht der Tab/Browser **vor** dem Commit dieser Transaktion ab
(Crash/Close), wird die **gesamte** Version-2-Transaktion **zurückgerollt** — die DB
bleibt auf v1 mit unveränderten Daten. Beim nächsten Öffnen läuft `onupgradeneeded`
erneut sauber von v1 aus. Es gibt **keinen** Zwischenzustand „v2-Schema da, Daten halb
migriert", weil Schema-Anlage und Datenmigration in **derselben** Transaktion stecken.
Das ist die korrekte IDB-Semantik und der entscheidende Grund, warum hier — anders als
beim Server — keine manuelle Idempotenz-Sperre nötig ist. **Kein Blocker.**

### OK — Server-Migration ist explizit idempotent + abbruchsicher
`lib/mandanten-store-migration.js:42-47,56-61`: Re-Lauf wird durch Existenz von
`data/mandanten/` verhindert (`istAltesLayout` liefert dann `false`). **Kopieren statt
Verschieben** (`migration.js:90-95`) + **Pre-Backup vor erster Zielschreibung**
(`:70-78`) + **Verifikation** (Anzahl + Parsebarkeit, `:104-115`) bevor der Lauf als
erfolgreich gilt. Schlägt die Verifikation fehl → `migriert:false`, Backup bleibt,
Originale unangetastet. Test: `tests/run.js:1998` („init migriert altes Layout",
prüft Pre-Backup + Original-Erhalt).

### WARNUNG W2 — reine Transform repariert partiellen Stand (Stärke), aber IDB-Pfad
ruft sie zur Laufzeit NICHT
Die Transform behandelt EDGE1 (abgebrochener Lauf: A1 hat schon `mandantId`, A2 nicht)
durch **Vervollständigen statt Verschlucken** — `mandanten-migration.js:76-81`, Test
`tests/run.js:1461`. Das ist robust. **Aber:** Die laufzeit-IDB-Migration
(`migriereV1zuV2`) verlässt sich auf die Transaktions-Atomik (siehe oben) und ruft die
Transform **nicht** auf; sie greift nur im Import-Pfad (`schreibeSnapshot`,
`store-idb.js:301`). Solange die Atomik-Annahme stimmt (sie stimmt), entsteht der
EDGE1-Zustand im IDB nie. Risiko nur, falls künftig jemand `migriereV1zuV2` außerhalb
einer versionchange-Tx oder mehrstufig aufruft — dann fehlte die Reparatur. Heute OK,
als Architektur-Hinweis vermerkt.

---

## 3. ROLLBACK / Backup vor Migration

### WARNUNG W3 (substanziell, akzeptiert) — IDB-Upgrade ist EINBAHN, KEIN Auto-Backup im Browser
`store-idb.js:35` setzt `VERSION = 2`. IndexedDB kann per Design **nicht** auf eine
niedrigere Version zurück; ein Downgrade-Open würde `VersionError` werfen. Anders als der
Server (`.backup-pre-mandanten-<ts>/`, `migration.js:70-78`) legt der **Browser-Pfad VOR
der Migration KEIN automatisches Backup** an. Bei einem (sehr unwahrscheinlichen)
unentdeckten Migrationsbug wären Browser-Bestandsdaten nicht trivial wiederherstellbar.

**Warum kein Blocker:** (a) Die Migration mutiert vorhandene Records in-place und
all-or-nothing — der Datenverlust-Pfad ist eng. (b) Es existiert ein vollständiger,
mandantenübergreifender Export (`leseSnapshot`/.obz, `store-idb.js:277`), und alte
.obz-Sicherungen importieren weiter (`schreibeSnapshot`+Transform). (c) Das Team hat
diese Lücke selbst als Gate dokumentiert (CHANGELOG „manueller Browser-Smoke-Test … VOR
Deploy"). **Empfehlung (nicht-blockierend):** Vor Upgrade einmalig automatisch einen
.obz-Voll-Export auslösen ODER den Nutzer vor dem ersten v2-Start zum Export auffordern.

---

## 4. MANDANTEN-ISOLATION (Leak zwischen Mandanten)

### OK — Browser-Lesepfade filtern strikt nach `mandantId`
- `listeAbschluesse(store-idb.js:212-222)` liest **nur** über
  `index('mandantId').getAll(IDBKeyRange.only(m))` — keine ungefilterte Abfrage.
- `ladeAbschluss(store-idb.js:223-234)` hat eine **explizite Quergriff-Sperre**:
  `if ((a.mandantId || STD) !== m) return null;` (`:231`). Ein Abschluss eines fremden
  Mandanten ist über den aktiven Mandanten **nicht** ladbar, auch nicht per geratener ID.
- `loescheAbschluss(store-idb.js:248-259)` löscht nur, wenn `mandantId` passt (`:254`).
- `unternehmen` ist je Mandant über `_id = mandantId` getrennt (`store-idb.js:191-201`).
- Alt-Sätze ohne `mandantId` gelten konsistent als `'standard'` (`:231`, `:254`).

### OK — Server-Isolation durch getrennte Verzeichnisse + `sicher()`
`lib/store.js`: Daten liegen physisch unter `data/mandanten/<sicher(id)>/…`
(`store.js:41-42`). `sicher()` (`store.js:36-39`) entfernt Path-Traversal-Zeichen
(`[^A-Za-z0-9_.\-]`→`_`), identisch im Adapter (`store-adapter.js:54-57`) → **kein
`../`-Ausbruch** aus dem Mandanten-Ordner. Isolations-Test: `tests/run.js:1980`
(„Mandanten sind isoliert: standard vs. firma2" inkl. Quergriff-`null`-Checks).

### WARNUNG W4 — Server `ladeAbschluss` hat KEINE Inhalts-Quergriff-Sperre (durch
Pfad-Isolation aber abgedeckt)
`lib/store.js:124-126`: `ladeAbschluss(id, mandantId)` liest schlicht
`mandanten/<id>/abschluesse/<sicher(id)>.json`. Es gibt — anders als im IDB-Adapter —
**keinen** zusätzlichen `rec.mandantId === m`-Check. Die Isolation hängt hier **allein**
an der Verzeichnistrennung. Das ist heute ausreichend (verschiedene Mandanten ≠
verschiedene Ordner), aber **asymmetrisch** zum Browser. Falls jemals zwei Mandanten
denselben physischen Ordner teilen oder `mandantId` und Ordner divergieren, fehlt das
Sicherheitsnetz. Empfehlung: defensiver `mandantId`-Abgleich auch serverseitig, für
Symmetrie. Nicht-blockierend.

### WARNUNG W5 — Default-Mandant `'standard'` als Auffangbecken
Jeder Aufruf ohne `mandantId` landet bei `'standard'` (`mid()` `store-idb.js:38`,
`store.js:38`). Korrekt und gewollt für Backward-Kompatibilität, aber: ein vergessener
`mandant`-Query-Parameter auf einer Server-Route schreibt/liest still gegen `'standard'`
statt zu fehlern. Geprüft: alle `/api/*`-Routen leiten `mandant` korrekt durch
(`server.js:127,141-183,250-251`), Adapter hängt `mq()` überall an
(`store-adapter.js:62,77-109`). Heute kein Leck; als Fallstrick für künftige Routen
vermerkt.

---

## 5. KONKURRIERENDE TABS (versionchange / blocked)

### OK — `versionchange` UND `blocked` werden behandelt
- `store-idb.js:100`: `db.onversionchange = function () { db.close(); dbPromise = null; };`
  — ein bereits offener (alter) Tab schließt seine Verbindung, sobald ein anderer Tab das
  Upgrade auf v2 anstößt. Das **entblockt** das Upgrade automatisch.
- `store-idb.js:104`: `req.onblocked` rejectet mit klarer Nutzer-Botschaft
  („bitte andere OpenBilanz-Tabs schliessen") — falls ein Alt-Tab die Verbindung nicht
  rechtzeitig schließt (z. B. mitten in laufender Transaktion).
Beide Hälften des Standard-Multi-Tab-Vertrags sind vorhanden. **Kein Blocker.**

### WARNUNG W6 — `blocked` rejectet hart statt zu retrye/warten; `dbPromise` bleibt rejected
`store-idb.js:104` + `:72-73`: Bei `onblocked` wird das `dbPromise` **rejected** und im
Cache gehalten (`if (dbPromise) return dbPromise;`). Schließt der Nutzer danach den
Alt-Tab, **versucht die App nicht automatisch erneut** — alle Folgeaufrufe bekommen das
gecachte rejected Promise, bis die Seite neu geladen wird. Funktional kein Datenverlust
(es wird gar nicht migriert, solange blockiert), aber UX-rau: Nutzer muss selbst neu
laden. Empfehlung: bei `onblocked`/`onerror` `dbPromise = null` setzen, damit ein späterer
Aufruf erneut öffnen kann. Nicht-blockierend.

### Hinweis (OK) — Alter Tab nach versionchange im „toten" Zustand
Nach `db.close()` im Alt-Tab (`:100`) sind dessen weitere Store-Aufrufe rejected, bis er
neu öffnet (`dbPromise=null` triggert Re-Open beim nächsten `offen()`). Da `dbPromise` auf
`null` gesetzt wird, **heilt** der Alt-Tab beim nächsten Aufruf selbst und öffnet v2 —
korrekt. (Unterschied zu W6: dort blockt das andere Ende.)

---

## 6. TEST-LÜCKEN (echte Bestandsdaten vs. Greenfield)

### WARNUNG W3-bis / Haupt-WARNUNG — KEINE automatisierte Abdeckung der IDB-`onupgradeneeded`-Laufzeit
Bestätigt durch Suche: `grep -rniE "indexeddb|onupgradeneeded|fake-indexed" tests/` → **0 Treffer**.
Die Tests decken ab:
- **Reine Transform** sehr gut: v1→v2, verlustfrei, idempotent, EDGE1-partiell,
  Phantom-frei, Fremd-`mandantId`-Erhalt, tiefe Kopie (`tests/run.js:1400-1480`).
- **Server-Datei-Migration** echt: altes Layout → `mandanten/standard/`, Pre-Backup,
  Original-Erhalt, Isolation, Duplikat-Ablehnung (`tests/run.js:1500-1540, 1948-2027`).

**Nicht abgedeckt (die korrektheitskritische Stelle selbst):** Der tatsächliche
IDB-`onupgradeneeded`-Code (`migriereV1zuV2`, `store-idb.js:43-70`) läuft in **keinem
einzigen** Test — weder mit befüllter v1-DB noch leer. Das ist eine echte
Greenfield-vs.-Bestand-Lücke: die Regel ist über die Transform getestet, die **IDB-
Verdrahtung dieser Regel** (Cursor-`update`, Singleton-Delete+Re-Put, Mandant-Anlage,
Transaktions-Scope) ist es nicht.

**Warum trotzdem kein Blocker:** (a) Das Team räumt das explizit ein und hat einen
manuellen Browser-Smoke-Test + diese Hub-Re-Refute als Pflicht-Gate VOR Deploy gesetzt
(CHANGELOG [Unreleased]; `store-idb.js:22-23`). (b) Die Verdrahtung ist kurz, sequenziell
und gegen die getestete Regel review-bar (oben in §1/§2 zeilengenau verifiziert).
**Empfehlung (stark, nicht-blockierend):** `fake-indexeddb` als devDependency einziehen
und genau 2 Tests ergänzen: „befüllte v1-DB → nach Open v2: alle Daten unter 'standard',
Mandant 'standard' angelegt" und „leere v1-DB → kein Phantom-Mandant". Damit würde die
einzige verbleibende substanzielle Lücke geschlossen.

### Hinweis — aktiver Mandant nicht persistent (kein Daten-, sondern UX-Befund)
`public/app.js:8,348-349,513-519`: Der aktive Mandant lebt nur in-memory (`S.aktiverMandant`);
es gibt **keine** `localStorage`/`setMeta`-Persistenz der Auswahl. Nach Reload steht der
Nutzer wieder auf `'standard'`. Kein Datenverlust (alle Mandantendaten bleiben), nur
Komfort. Außerhalb des Migrations-Scopes, nur als Beobachtung.

---

## Ladereihenfolge / Build-Integrität (Quergeprüft)

### OK — Script-Reihenfolge im Browser korrekt
`public/index.html:80-81`: `mandanten-migration.js` wird **vor** `store-idb.js` geladen,
und `store-adapter.js` (`:85`) danach. Da `store-idb.js` die Transform zur **Factory-Zeit**
referenziert (`store-idb.js:25-31`, `var Transform = … root.MandantenMigration`), wäre eine
vertauschte Reihenfolge ein harter `undefined`-Bug gewesen (`STD` fiele auf Default zurück,
`schreibeSnapshot` → `Transform.migriere` würde werfen). Reihenfolge ist korrekt. SW-Cache
wurde mit-erhöht (`public/sw.js:18` `openbilanz-v6`), sodass alte Tabs den neuen Code
ziehen — sauber.

---

## Zusammenfassung der Auflagen vor Deploy

1. **(Pflicht, bereits vorgesehen)** Manueller Browser-Smoke-Test mit einer **echten v1-
   Bestands-DB**: Alt-DB mit Unternehmen + ≥2 Abschlüssen anlegen, neuen Code laden,
   prüfen: alle Daten unter Mandant „standard", Mandant „standard" mit korrektem Namen im
   Index, keine Phantom-Mandanten bei leerer DB, Zweittab-Verhalten (versionchange/blocked).
2. **(Empfohlen, nicht-blockierend)** `fake-indexeddb`-Tests für `migriereV1zuV2`
   ergänzen (W3-bis), Browser-Pre-Export vor v2-Upgrade (W3), `dbPromise=null` bei
   `onblocked`/`onerror` (W6), serverseitige `mandantId`-Quergriff-Sperre (W4).

Nach erfolgreichem Smoke-Test (Auflage 1) ist Welle 7 aus Sicht dieses Re-Refute
**deploy-frei**.
