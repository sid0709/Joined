#!/usr/bin/env python3
"""Strip the flat gray preview mat from logo-source.jpg and write public PNGs."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "logo-source.jpg"
PUBLIC = ROOT / "public"


def is_preview_mat(r: int, g: int, b: int) -> bool:
    chroma = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3
    return chroma <= 12 and avg >= 125


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if is_preview_mat(r, g, b):
                px[x, y] = (r, g, b, 0)

    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - im.width) // 2
    oy = (side - im.height) // 2
    canvas.paste(im, (ox, oy), im)
    im = canvas

    (PUBLIC / "icons").mkdir(parents=True, exist_ok=True)
    im.save(PUBLIC / "logo.png", optimize=True)
    for size in (16, 32, 48, 128):
        im.resize((size, size), Image.LANCZOS).save(PUBLIC / "icons" / f"icon{size}.png", optimize=True)
    im.save(ROOT / "assets" / "logo.png", optimize=True)


if __name__ == "__main__":
    main()
