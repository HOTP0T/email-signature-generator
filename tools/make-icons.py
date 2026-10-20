#!/usr/bin/env python3
"""Render the contact icons to PNG, one file per icon and tone: icons/<name>-<hex>.png.

Mail apps can't draw SVG or keep embedded images, so the signature links to these hosted PNGs.
The tones are read from ICON_TONES in app.js, so the page and the files never disagree.

Needs Playwright for Python and a Chrome/Chromium:
    python3 tools/make-icons.py [--chrome /path/to/chrome]
"""
import argparse, pathlib, re
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "icon-src"
OUT = ROOT / "icons"
NAMES = ["phone", "smartphone", "map-pin", "wechat"]
SIZE = 48  # px; shown at 13-15 px, so sharp on 3x screens

def tones():
    js = (ROOT / "app.js").read_text()
    block = re.search(r"var ICON_TONES = \[(.*?)\];", js, re.S).group(1)
    return re.findall(r'"([0-9a-f]{6})"', block)

def svg_for(name, hex_):
    s = (SRC / f"{name}.svg").read_text()
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<title>.*?</title>", "", s)
    s = s.replace("currentColor", f"#{hex_}")
    if 'fill="none"' not in s:  # filled brand icons (Simple Icons) carry no colour of their own
        s = s.replace("<svg ", f'<svg fill="#{hex_}" ', 1)
    # Resize the <svg> element only: inner shapes such as <rect> carry their own width / height.
    s = re.sub(r"<svg\b[^>]*>", lambda m: re.sub(r'\s(width|height)="\d+"', "", m.group(0)), s, count=1)
    return s.replace("<svg ", f'<svg width="{SIZE}" height="{SIZE}" ', 1)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", help="path to a Chrome/Chromium executable")
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chrome) if args.chrome else p.chromium.launch()
        page = browser.new_page(device_scale_factor=1)
        count = 0
        for hex_ in tones():
            for name in NAMES:
                page.set_content('<html><body style="margin:0;background:transparent">'
                                 f'<div id="i" style="width:{SIZE}px;height:{SIZE}px">{svg_for(name, hex_)}</div></body></html>')
                page.locator("#i").screenshot(path=str(OUT / f"{name}-{hex_}.png"), omit_background=True)
                count += 1
        browser.close()
    print(f"{count} icons in {OUT}")

if __name__ == "__main__":
    main()
