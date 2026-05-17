# OpenBilanz — Marke & Corporate Identity

Referenz für Logo-Verwendung und Markenfarben. Alle Marken-Dateien liegen in
`public/assets/`.

## Logo-Dateien

| Datei | Inhalt | Wann verwenden |
|---|---|---|
| `assets/marke.png` | Icon **+** Schriftzug „OpenBilanz" (1440×320, transparent) | Standard-Logo überall dort, wo Platz für die volle Marke ist — z. B. Sidebar-Kopf |
| `assets/wortmarke.png` | nur der Schriftzug „OpenBilanz" (1171×249, transparent) | wenn das Icon schon woanders sichtbar ist oder der Platz schmal/breit ist |
| `assets/logo.png` | nur das Icon (1024×1024, transparent) | als alleinstehendes Symbol — Favicon-Quelle, App-Icon, kleine Flächen |
| `assets/favicon.png` | Icon, 64×64 | Browser-Tab (`<link rel="icon">`) |
| `assets/apple-touch-icon.png` | Icon, 180×180 | „Zum Home-Bildschirm hinzufügen" auf iOS |

`favicon.png` und `apple-touch-icon.png` werden aus `logo.png` skaliert — bei
einer Logo-Änderung neu erzeugen:

```bash
python3 -c "from PIL import Image; im=Image.open('public/assets/logo.png').convert('RGBA'); \
im.resize((64,64),Image.LANCZOS).save('public/assets/favicon.png'); \
im.resize((180,180),Image.LANCZOS).save('public/assets/apple-touch-icon.png')"
```

## Markenfarben

| Farbe | Hex | Verwendung |
|---|---|---|
| Markenblau (navy) | `#134276` | Wort „Open", Icon-Grundton |
| Markengrün (teal) | `#1e9f87` | Wort „Bilanz", Icon-Verlauf |

Das Icon selbst trägt einen Verlauf von `#134276` (oben links) nach `#1e9f87`
(unten rechts).

### UI-Farben (`public/styles.css`, `:root`)

Die Oberfläche nutzt aktuell eigene Token, die nah an der Marke liegen, aber
nicht identisch sind:

- `--akzent: #1f5a8f` — etwas heller als das Markenblau `#134276`
- Sidebar-Hintergrund `#152634` — sehr dunkles Navy
- `--gut: #1f7a4d` — Grün für „ok"-Zustände

Bei einer CI-Angleichung könnte `--akzent` auf `#134276` und die „gut"-Farbe
auf das Markengrün `#1e9f87` gezogen werden.

## Verwendungsregeln

- **Heller Untergrund bevorzugt.** Der Schriftzug „Open" ist dunkles Navy — auf
  dunklem Grund (z. B. der Sidebar) unlesbar. Marke/Wortmarke daher auf weißem
  oder hellem Untergrund platzieren. In der App sitzt die Marke deshalb auf
  einem weißen Balken im Sidebar-Kopf.
- **Nur das Icon** (`logo.png`) funktioniert auch auf dunklem Grund.
- Marke nicht verzerren — immer mit `height:auto` proportional skalieren.
- Etwas Schutzraum lassen; Mindestbreite der vollen Marke ca. 150 px.

## Aktuelle Einbindung

- Sidebar-Kopf: `assets/marke.png` (`index.html`, `.brand`)
- Browser-Tab / iOS: `assets/favicon.png`, `assets/apple-touch-icon.png`
- Der gedruckte Jahresabschluss bleibt **logo-frei** — es ist das amtliche
  Dokument der GmbH, nicht von OpenBilanz. Nur die Fußzeile vermerkt
  „Erstellt mit OpenBilanz."
