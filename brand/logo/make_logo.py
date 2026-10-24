"""Generate BLACKLINE 'Horizon' logo SVGs. Letters are hand-built monoline shapes
on a 100-unit cap height, so the files need no font."""
import os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

BLACK = "#0B0B0C"
WHITE = "#F4F4F2"
BLUE = "#2D5BFF"
S = 14  # stroke weight in cap-height units (cap height = 100)

# Each glyph: (width, path centre-lines). Drawn with butt caps + miter joins,
# then clipped to the 0..100 cap band so diagonals end flat on the baseline/cap line.
GLYPHS = {
    "B": (73, "M7 50H44A21.5 21.5 0 0 1 44 93H7V7H40A21.5 21.5 0 0 1 40 50H7"),
    "L": (58, "M7 0V93H58"),
    "A": (81, "M4.5 108L40.5 -8L76.5 108M17 68H64"),
    "C": (86, "M80.4 19.6A43 43 0 1 0 80.4 80.4"),
    "K": (74, "M7 0V100M70 -8L7 67.2M31 39L74 106"),
    "I": (14, "M7 0V100"),
    "N": (76, "M7 0V100M69 0V100M7 -10L69 110"),
    "E": (60, "M60 7H7V93H60M7 50H55"),
}
GAP = 58
KERN = {("L", "A"): -12}


def wordmark(x0, colour, uid):
    """Return (svg fragment, width) for BLACKLINE starting at x0."""
    parts, x, prev = [], x0, None
    for ch in "BLACKLINE":
        if prev:
            x += GAP + KERN.get((prev, ch), 0)
        w, d = GLYPHS[ch]
        parts.append(f'<path transform="translate({x:g} 0)" d="{d}"/>')
        x += w
        prev = ch
    width = x - x0
    frag = (
        f'<clipPath id="cap-{uid}"><rect x="{x0 - 20:g}" y="0" width="{width + 40:g}" height="100"/></clipPath>'
        f'<g clip-path="url(#cap-{uid})" fill="none" stroke="{colour}" stroke-width="{S}" '
        f'stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4">'
        + "".join(parts) + "</g>"
    )
    return frag, width


LINE = 9       # horizon line weight
TEXT_GAP = 88  # space between line and lettering
DOT_R = 17
DOT_GAP = 19


def svg(w, h, body, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
        f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'
    )


def full_lockup(fg, dot):
    left = 300
    text, tw = wordmark(left + TEXT_GAP, fg, "f")
    rx = left + TEXT_GAP + tw + TEXT_GAP
    body = (
        f'<rect x="0" y="{50 - LINE / 2:g}" width="{left}" height="{LINE}" fill="{fg}"/>'
        + text
        + f'<rect x="{rx:g}" y="{50 - LINE / 2:g}" width="{left}" height="{LINE}" fill="{fg}"/>'
        + f'<circle cx="{rx + left + DOT_GAP + DOT_R:g}" cy="50" r="{DOT_R}" fill="{dot}"/>'
    )
    return svg(rx + left + DOT_GAP + 2 * DOT_R, 100, body, "BLACKLINE")


def compact_lockup(fg, dot):
    text, tw = wordmark(0, fg, "c")
    rx, ln = tw + TEXT_GAP, 180
    body = (
        text
        + f'<rect x="{rx:g}" y="{50 - LINE / 2:g}" width="{ln}" height="{LINE}" fill="{fg}"/>'
        + f'<circle cx="{rx + ln + DOT_GAP + DOT_R:g}" cy="50" r="{DOT_R}" fill="{dot}"/>'
    )
    return svg(rx + ln + DOT_GAP + 2 * DOT_R, 100, body, "BLACKLINE")


def icon(tile, fg, dot, line=28, dot_d=64, pad=88, radius=112):
    span = 512 - 2 * pad
    gap = 22
    ln = span - gap - dot_d
    body = (
        f'<rect width="512" height="512" rx="{radius}" fill="{tile}"/>'
        f'<rect x="{pad}" y="{256 - line / 2:g}" width="{ln}" height="{line}" fill="{fg}"/>'
        f'<circle cx="{pad + ln + gap + dot_d / 2:g}" cy="256" r="{dot_d / 2:g}" fill="{dot}"/>'
    )
    return svg(512, 512, body, "BLACKLINE")


files = {
    "blackline-logo-black.svg": full_lockup(BLACK, BLUE),
    "blackline-logo-white.svg": full_lockup(WHITE, BLUE),
    "blackline-logo-mono-black.svg": full_lockup(BLACK, BLACK),
    "blackline-logo-mono-white.svg": full_lockup(WHITE, WHITE),
    "blackline-compact-black.svg": compact_lockup(BLACK, BLUE),
    "blackline-compact-white.svg": compact_lockup(WHITE, BLUE),
    "blackline-icon-dark.svg": icon(BLACK, WHITE, BLUE),
    "blackline-icon-light.svg": icon(WHITE, BLACK, BLUE),
    # Chunkier geometry so it stays crisp at 16-32 px.
    "favicon.svg": icon(BLACK, WHITE, BLUE, line=56, dot_d=120, pad=72, radius=96),
}
for name, content in files.items():
    with open(os.path.join(OUT, name), "w") as f:
        f.write(content)
print("\n".join(files))
