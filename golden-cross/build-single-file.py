"""Bundle the whole site into one self-contained HTML file (for previews/sharing).
Usage: python3 build-single-file.py  ->  writes golden-cross-website.html
"""
import re, base64, os, mimetypes
os.chdir(os.path.dirname(os.path.abspath(__file__)))
def data_uri(p):
    mime = mimetypes.guess_type(p)[0] or "application/octet-stream"
    if p.endswith(".woff2"): mime = "font/woff2"
    return f"data:{mime};base64," + base64.b64encode(open(p, "rb").read()).decode()

css = open("assets/css/styles.css").read()
css = re.sub(r'url\("\.\./fonts/([^"]+)"\)', lambda m: f'url("{data_uri("assets/fonts/" + m.group(1))}")', css)
css += """
.legal-overlay{display:none;position:fixed;inset:0;z-index:150;overflow:auto;background:var(--paper)}
.legal-overlay:target{display:block}
.legal-overlay .toc{display:none}
.legal-overlay .legal-layout{grid-template-columns:1fr}
.legal-close{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:14px var(--gutter);background:var(--green-900);color:#fff}
.legal-close a{color:#fff;font-weight:600;text-decoration:none}
.legal-overlay .page-hero{padding-top:48px}
"""
js = open("assets/js/config.js").read() + "\n" + open("assets/js/main.js").read()
html = open("index.html").read()

pages = {"privacy": "Privacy Policy", "cookies": "Cookie Policy", "terms": "Terms & Booking Conditions",
         "allergens": "Allergen Information", "accessibility": "Accessibility"}
overlays = ""
for slug, title in pages.items():
    main = re.search(r'<main id="main">(.*?)</main>', open(slug + ".html").read(), re.S).group(1)
    main = re.sub(r"<!--.*?-->", "", main, flags=re.S)
    main = re.sub(r'id="([^"]+)"', lambda m: f'id="{slug}-{m.group(1)}"', main)
    main = re.sub(r'href="#([^"]+)"', lambda m: f'href="#{slug}-{m.group(1)}"', main)
    overlays += (f'<div class="legal-overlay" id="page-{slug}" role="region" aria-label="{title}">'
                 f'<div class="legal-close"><strong>{title}</strong><a href="#top">✕ Close</a></div>{main}</div>\n')
for slug in pages:
    overlays = re.sub(rf'href="{slug}\.html(#[^"]*)?"', f'href="#page-{slug}"', overlays)
    html = re.sub(rf'href="{slug}\.html(#[^"]*)?"', f'href="#page-{slug}"', html)
overlays = overlays.replace('href="index.html#', 'href="#').replace('href="index.html"', 'href="#top"')

# Inline images that exist; drop references to ones that don't (gradient fallback shows instead)
def img(m):
    p = "assets/images/" + m.group(1)
    return f"url({data_uri(p)})" if os.path.exists(p) else "none"
html = re.sub(r"url\(assets/images/([^)]+)\)", img, html)

html = html.replace('<link rel="stylesheet" href="assets/css/styles.css">', f"<style>{css}</style>")
html = re.sub(r'\s*<link rel="(preload|manifest|apple-touch-icon)"[^>]*>', "", html)
html = html.replace('href="assets/images/favicon.svg"', f'href="{data_uri("assets/images/favicon.svg")}"')
html = re.sub(r'<script src="assets/js/config.js"></script>\s*<script src="assets/js/main.js"></script>',
              lambda m: f"{overlays}<script>{js}</script>", html)
assert '<script src="assets' not in html and "styles.css" not in html
open("golden-cross-website.html", "w").write(html)
print(f"golden-cross-website.html: {len(html)//1024} KB")
