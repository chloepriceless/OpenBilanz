# Welle 7 — Mehrmandanten (Multi-Tenant): Scope-Skizze

Status: Hub-GO „im Prinzip" (2026-06-05), wartet auf Freigabe dieser Skizze.
Danach Bau in Teilschritten, Schritt (a) Codex-gesparrt (R22: Datenmodell-/
Schema-Migration). Owner: Pfenni (gmbh-verwaltung).

## Ist-Zustand (verifiziert am Code)
- **Einfirmig.** Server (`lib/store.js`): `data/unternehmen.json` (1 Firma) +
  `data/abschluesse/<id>.json` (n Abschlüsse).
- **Browser** (`public/shared/store-idb.js`): IndexedDB, Stores `unternehmen` (1),
  `abschluesse` (n, key `id`, Index `stichtag`) + meta (File-Handles).
- **Abstraktion** (`public/shared/store-adapter.js`): `ladeState() ->
  { unternehmen, abschluesse:[Kurzinfo] }`, kapselt Selbst-Hosting vs. Website.

## Ziel-Datenmodell (Mandanten-Ebene via `mandantId`)
- **Server:** `data/mandanten/<mandantId>/{unternehmen.json, abschluesse/}` +
  `data/mandanten.json` (Index: id, name, angelegtAm). `lib/store.js` +
  `store-adapter.js` bekommen `mandantId`-Parameter durchgereicht.
- **Browser (IDB):** DB-VERSION-Bump → neuer Store `mandanten`; `abschluesse`
  erhält `mandantId` (Index, ggf. Compound-Key `[mandantId, id]`); `unternehmen`
  wird pro Mandant gehalten (Key `mandantId`).

## Migration (kritischer Punkt)
- **Browser:** in `onupgradeneeded` — Alt-Layout → automatisch Mandant
  „Standard" anlegen, bestehende `unternehmen`/`abschluesse` diesem zuordnen.
  Muss **idempotent + verlustfrei** sein. Test gegen einen Alt-Snapshot (DB ohne
  `mandantId`) → nach Migration alle Daten unter „Standard" auffindbar.
- **Server:** vorhandene `data/unternehmen.json` + `data/abschluesse/` →
  `data/mandanten/standard/` verschieben, `mandanten.json` schreiben. Reversibel
  (reine Dateioperation, Backup vorher).

## UI
- Header-Dropdown „Mandant" (aktiver Mandant), Hotkey **Alt+1..9** für Schnellwahl.
- Alle Views (Buchhaltung, Editor, Steuer, UStVA, Fristen, Health, …) auf den
  aktiven Mandanten scopen.
- Zeitleiste je Mandant (EB → JA 2024 → JA 2025 …) — baut auf vorhandener
  `vorjahrId`-Verkettung auf.

## Risiko & Bindung
- **IDB-Schema-Migration = heikelster, schwer reversibler Punkt** (Browser-
  Datenverlust bei Fehler, kein Server-Backup im Website-Modus). → **R22
  architektur-/datenmodell-kritisch ⇒ Codex-4-Augen (Refute) auf Migration +
  Adapter VOR Merge/Deploy.** Server-Migration dagegen reversibel.
- Keine echten Buchungen/Geldbewegungen berührt → Christin-OK-Grenze nicht tangiert.

## Aufwand & Vorgehen (Teilschritte)
- **L** (4 Schichten + Migration + UI). Inkrementell, jeder Schritt grün + committet:
  - **(a)** Store/Adapter mandantfähig + Migration (Server + IDB) + Tests.
    ← **Codex-gesparrt, ZUERST.** Hier liegt das Korrektheitsrisiko.
  - **(b)** UI: Mandanten-Switch (Dropdown + Alt+1..9), Views scopen.
  - **(c)** Zeitleiste je Mandant.
- README-Status erst auf ✅, wenn vom Nutzer real durchgeklickt (Memory-Regel).

## Freigabe-Frage an den Hub
Ist (a) so plausibel? Wenn ja → ich baue Schritt (a) (Codex-Refute auf
Migration+Adapter, dann Tests), committe atomar, melde mit Commit-Artefakt.
