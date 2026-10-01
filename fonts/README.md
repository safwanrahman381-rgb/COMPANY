# Fonts

Self-hosted so the site makes no third-party requests. Both families are under the
SIL Open Font License 1.1 (see `OFL-Archivo.txt` and `OFL-JetBrainsMono.txt`), which
allows bundling, subsetting and serving them with the site.

| File | Family | Axes | Unicode ranges |
|---|---|---|---|
| `archivo-latin.woff2` | Archivo | wdth 62–125, wght 100–900 | Latin |
| `archivo-latin-ext.woff2` | Archivo | wdth 62–125, wght 100–900 | Latin Extended |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | wght 100–800 | Latin |
| `jetbrains-mono-latin-ext.woff2` | JetBrains Mono | wght 100–800 | Latin Extended |

The `@font-face` rules in `styles.css` limit these to the weights the site used from
Google Fonts (Archivo 300–900, JetBrains Mono 400–500). The browser only downloads the
Latin Extended files if a page uses those characters (e.g. ŵ, ŷ).

## Source

- `ofl/archivo/Archivo[wdth,wght].ttf` and `ofl/jetbrainsmono/JetBrainsMono[wght].ttf`
  from https://github.com/google/fonts (commit `9710da1eacb3`).
- Subset to the same Latin / Latin Extended ranges Google Fonts serves, keeping every
  OpenType feature (the counters need `tnum`), with fontTools (`fbf9380`):

```sh
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATIN_EXT="U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
pyftsubset "Archivo[wdth,wght].ttf" --unicodes="$LATIN" --flavor=woff2 --layout-features='*' --no-hinting --output-file=archivo-latin.woff2
# …and the same for LATIN_EXT and for JetBrainsMono[wght].ttf
```
