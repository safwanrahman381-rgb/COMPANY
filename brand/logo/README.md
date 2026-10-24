# BLACKLINE logo ("Horizon")

The name sits on a horizon line that ends in a blue dot: the line is the system, the dot is the booked job.

The letters are custom shapes, not a font, so the files look the same everywhere.

## Which file to use

| Where | File |
|---|---|
| Website header, email signature, proposals | `svg/blackline-compact-black.svg` (light background) or `-white` (dark) |
| Hero, title slides, big banners | `svg/blackline-logo-black.svg` / `-white.svg` |
| One colour only (print, stamps, embroidery) | `svg/blackline-logo-mono-black.svg` / `-mono-white.svg` |
| Social profile picture, app icon | `png/blackline-icon-dark-1024.png` (or `-light`) |
| Website favicon | `svg/favicon.svg`, `png/favicon-32.png`, `png/favicon-16.png`, `png/apple-touch-icon.png`, `png/icon-192.png` |

Use the SVG files wherever you can (website, Canva, HighLevel). Use the PNGs where SVG isn't accepted.

## Colours

| Name | Hex | Use |
|---|---|---|
| Black | `#0B0B0C` | Logo on light backgrounds |
| Off-white | `#F4F4F2` | Logo on dark backgrounds, light page background |
| Signal blue | `#2D5BFF` | The dot only (and buttons/links on the site) |

## Rules

- Keep clear space around the logo of at least the height of the letters.
- Don't stretch, rotate, recolour the letters, or add shadows or effects.
- Smallest size: compact logo 120 px wide on screen; below that, use the icon.
- The blue dot is the only colour in the logo. In one-colour use it matches the letters.

## Editing

`make_logo.py` draws every SVG. `render.js` turns them into PNGs (needs Node and Playwright):

```
python3 make_logo.py svg
node render.js svg png
```
