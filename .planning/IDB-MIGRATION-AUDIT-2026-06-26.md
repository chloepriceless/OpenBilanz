# Audit: Mandanten-IDB-Migration v1→v2 (Datenerhalt-Vollabdeckung)

_Welle-2, letzte offene Dimension. Session 2026-06-26. Datei nicht committet (Arbeits-Artefakt)._

## Scope
`public/shared/store-idb.js` → `migriereV1zuV2(t)` (Zeile 43–75), der einzige
Laufzeit-Datenverlust-kritische Pfad (Browser-IndexedDB, Website-Modus). Ziel:
**Datenerhalt beim v1→v2-Upgrade vollständig absichern** (Tests), Logik auf echte
Bugs prüfen.

## Logik-Audit (read-only)
Migration läuft in der versionchange-Transaktion `t`. Sequenz:
1. `unternehmen.get('singleton')` → falls vorhanden: `_id/mandantId='standard'`,
   alte 'singleton'-Zeile löschen, neu putten. Name = `u.name||u.firma||'Standard'`.
2. Cursor über `abschluesse`: jeder Satz ohne mandantId bekommt 'standard'
   (`if(!rec.mandantId)`-Guard erhält bestehende — EDGE1-Schutz).
3. Wenn echte Daten vorhanden (`hatDaten`): Mandant 'standard' anlegen + Backup-
   Hinweis-Flag (`mandantenMigrationHinweis`) in `meta`.

**Konsistenz zur getesteten Pure-Transform (`mandanten-migration.js`):**
- Namensregel name||firma||'Standard' ✓ identisch (`nameFuer`).
- mandantId-Erhalt ✓ identisch (`if(!mandantId)`).
- Fresh-Install kein Phantom ✓ identisch (`hatDaten`-Guard / unternehmen+abschluesse leer).

**Kein reachable Bug gefunden.** Die Transaktion bleibt durch verkettete
onsuccess-Requests aktiv (kein vorzeitiges Auto-Commit). Cursor-Iteration korrekt.

**Dokumentierte Divergenz (KEIN Muss-Fix — nicht-destruktiv/wiederherstellbar):**
Die Runtime legt IMMER nur Mandant 'standard' an. Ein v1-Abschluss mit FREMDER
mandantId würde erhalten (Guard `if(!mandantId)`), bekäme aber keinen mandanten-
Index-Eintrag → Waise.
- **Reachability (Refute-Korrektur 2026-06-26):** NICHT über die normale Schreib-API
  (v1-`speichereAbschluss` setzte nie mandantId), ABER über v1-`schreibeSnapshot`
  (Import) — der schrieb Abschlüsse VERBATIM (`8ea0f01:store-idb.js:157`), ohne
  mandantId zu strippen. → Ein crafted/fremdes Backup-JSON mit `mandantId:'fremd'`,
  v1-importiert, landet in einer Version-1-DB; das spätere Welle-7-Upgrade
  verwaist den Satz. „Unerreichbar" war also falsch — korrekt: **nur via crafted
  Import erreichbar.**
- **Warum kein Muss-Fix (R12):** Der Satz ist NICHT verloren — Guard erhält ihn, der
  mandantId-Index (vor der Migration angelegt) findet ihn weiter (`listeAbschluesse('fremd')`),
  `leseSnapshot` (`getAll`) nimmt ihn ins Voll-Backup, ein Restore-Roundtrip durch
  `Transform.migriere` legt den Stub-Mandanten an → voll wiederherstellbar. Folge ist
  „vorübergehend kein Mandanten-Tab", ausgelöst durch eine selbstgebastelte Datei.
  Korrektheitskritischen Migrationscode dafür umzubauen = Risiko ohne Nutzen.
- **Stattdessen Regressions-Pin (Test G6):** pinnt, dass die Migration den Fremd-Satz
  ERHÄLT (nicht droppt) + dass `leseSnapshot` ihn enthält → ein künftiges Refactor
  kann den weichen Waisen nicht versehentlich in physisches Löschen verwandeln.

## Abdeckungslücken (reachable, untested) → neue Test-Assertions
Bestehend (3): befüllt→standard verlustfrei · leer→kein Phantom · Isolation/Quergriff.

- **G1 (HIGH): Abschlüsse OHNE Unternehmen.** v1-Nutzer mit Abschlüssen, aber nie
  Stammdaten gespeichert. Erwartung: Name 'Standard', ALLE Abschlüsse erhalten
  (mandantId=standard), Mandant 'standard' angelegt, Flag gesetzt. Echter v1-Zustand.
- **G2 (MEDIUM): Unternehmen mit `firma` statt `name`.** Mandantenname-Fallback auf
  firma (dokumentierte Regel, untested). + ohne name/firma → 'Standard'.
- **G3 (MEDIUM): Bestehende meta-Einträge überleben.** Eine v1-`backup`-meta-Zeile
  muss die Migration unverändert überstehen (Migration ist rein additiv auf meta,
  ruft nie clear()). Datenerhalts-Garantie auf Meta-Ebene.
- **G4 (MEDIUM): Re-Open nach Migration läuft Migration NICHT erneut.** DB ist
  danach v2 → erneutes offen() darf migriereV1zuV2 nicht nochmal auslösen
  (kein Doppel-Mandant, Daten stabil). IDB-Versions-Idempotenz (≠ Pure-Transform-
  Idempotenz, die bereits getestet ist).

## Vorgehen
Test-only Änderung (kein Produktionslogik-Edit) → geringes Risiko, R22-Hard-Gate
nicht getriggert. Trotzdem adversarischer Refute-Review des Audits (R26, korrektheits-
kritischer Bereich): „Ist die Divergenz wirklich unerreichbar? Übersehe ich einen
echten Datenverlust-Pfad? Sind die Assertions korrekt/ausreichend?" Danach 4 Tests
ergänzen, 3 TZ-Läufe (default/Berlin/LA), committen.
