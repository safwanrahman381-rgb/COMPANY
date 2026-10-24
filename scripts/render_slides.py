"""Render BLACKLINE carousel/text-card slides to 1080x1350 PNGs.

Usage: python scripts/render_slides.py marketing/weeks/2026-W44-slides.json marketing/assets/2026-W44
Setup once: pip install playwright && python -m playwright install chromium
JSON: [{"post": "P01", "slides": [{"kicker": "", "title": "", "body": ""}]}]
"""
import html
import json
import os
import sys

from playwright.sync_api import sync_playwright

CSS = """
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;background:#000;color:#fff;font-family:'Inter','Helvetica Neue',Arial,sans-serif;
padding:110px 96px;display:flex;flex-direction:column}
.k{font-size:30px;letter-spacing:.14em;text-transform:uppercase;color:#7FA2FF;font-weight:600}
.line{width:120px;height:6px;background:#2F6BFF;margin:34px 0 44px;box-shadow:0 0 24px #2F6BFF}
h1{font-size:96px;line-height:1.04;font-weight:800;letter-spacing:-.02em}
p{font-size:44px;line-height:1.38;color:#D6D9E0;margin-top:44px;white-space:pre-line}
.m{margin:auto 0}
.f{display:flex;justify-content:space-between;font-size:26px;color:#8A8F9C}
"""


def page(slide, n, total):
    esc = lambda s: html.escape(s or "")
    body = f"<p>{esc(slide.get('body'))}</p>" if slide.get("body") else ""
    return (f"<html><head><style>{CSS}</style></head><body>"
            f"<div class='m'><div class='k'>{esc(slide.get('kicker'))}</div><div class='line'></div>"
            f"<h1>{esc(slide.get('title'))}</h1>{body}</div>"
            f"<div class='f'><span>Safwan · BLACKLINE</span><span>{n}/{total}</span></div></body></html>")


def main(src, out_dir):
    posts = json.load(open(src, encoding="utf-8"))
    os.makedirs(out_dir, exist_ok=True)
    made = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        tab = browser.new_page(viewport={"width": 1080, "height": 1350})
        for post in posts:
            slides = post["slides"]
            for i, slide in enumerate(slides, 1):
                tab.set_content(page(slide, i, len(slides)))
                tab.screenshot(path=os.path.join(out_dir, f"{post['post']}-{i:02d}.png"))
                made += 1
        browser.close()
    print(f"Rendered {made} slides to {out_dir}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
