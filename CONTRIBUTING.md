# Mitwirken an OpenBilanz

Beitraege sind willkommen &ndash; egal ob Fehlerkorrektur, neue SKR04-Konten,
bessere E-Bilanz-Abdeckung oder Dokumentation.

## Entwicklung

Voraussetzung: **Node.js >= 18**. Es gibt bewusst **keine npm-Abhaengigkeiten**
(zero dependency) &ndash; bitte dabei bleiben.

```bash
node server.js        # Tool starten -> http://localhost:3000
npm test              # Test-Suite (node tests/run.js)
```

Fuer die E-Bilanz-Validierung zusaetzlich:

```bash
pip install arelle-release
./tools/setup-taxonomie.sh
node lib/validate.js <xbrl-datei>
```

## Architektur

| Pfad | Inhalt |
|---|---|
| `server.js` | Zero-Dependency-Webserver + JSON-API |
| `lib/` | Node-Module: Persistenz, XBRL-Erzeugung, Validierung |
| `public/shared/` | Geteilte Logik (laeuft in Node UND im Browser): HGB-Gliederung, Rechenkern, Taxonomie-Mapping, SKR04, Steuer |
| `public/` | Oberflaeche (Vanilla JS, kein Build-Schritt) |
| `tests/` | Test-Suite |

## Grundsaetze

- **Zero Dependencies.** Kein npm-Paket, kein Build-Schritt.
- **Geteilte Module** in `public/shared/` muessen in Node und im Browser
  laufen (UMD-Wrapper beibehalten).
- **Fachliche Korrektheit zuerst.** Aenderungen an Bilanz-/GuV-/Steuerlogik
  bitte mit Paragraphenbezug (HGB, EStG, GewStG, KStG) belegen.
- **Tests gruen halten.** Neue Logik braucht einen Test in `tests/run.js`.
  Aenderungen an der E-Bilanz mit Arelle gegen die amtliche Taxonomie pruefen.
- Sichtbare Texte (Oberflaeche, Labels, Meldungen) mit echten Umlauten
  (ae/oe/ue/ss vermeiden). Code-Bezeichner (Variablen, Properties, Enum-Werte,
  CSS-Klassen) bleiben dagegen ASCII.

## Pull Requests

1. Branch erstellen, Aenderung umsetzen.
2. `npm test` muss fehlerfrei durchlaufen.
3. Bei E-Bilanz-Aenderungen: Validierung dokumentieren.
4. PR mit kurzer Beschreibung und ggf. Paragraphenbezug.

## Kein Steuerrat

Das Projekt ist ein Werkzeug, keine Steuerberatung. Beitraege sollten diese
Linie wahren und im Zweifel auf fachliche Pruefung hinweisen.
