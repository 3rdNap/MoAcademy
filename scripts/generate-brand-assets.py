#!/usr/bin/env python3
"""Generate the Women's Month ("wo") brand assets from the source artwork.

MoAcademy becomes WoAcademy every August for South Africa's Women's Month, so
the seasonal marks live in `public/` alongside the year-round blue ones. This
script rebuilds them from `brand/wo-academy-logo.png` (the supplied artwork) so
they can be regenerated instead of being opaque committed binaries.

The "wo" letterform is lifted from the artwork itself — it is *not* the "m" of
the year-round mark flipped, which is close but wrong (the real w has wider,
tapered inner slits). Everything else is redrawn in Poppins, the lockup's
actual typeface, which `next/font` caches under `.next/static/media` after a
build, so the type stays crisp at any size.

Usage:  npm run build          # once, so the Poppins webfonts are cached
        python3 scripts/generate-brand-assets.py
Needs:  pip install Pillow fonttools brotli
"""

from __future__ import annotations

import glob
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "brand", "wo-academy-logo.png")
PUBLIC = os.path.join(ROOT, "public")

# The Women's Month lilac, sampled from the supplied artwork.
LILAC = (226, 169, 241)
PLUM = (59, 16, 73)  # brand-950 of the lilac scale — the social card ground

# Where each element sits in the source artwork, in source pixels.
LOCKUP = (172, 414, 1033, 588)  # x0, y0, x1, y1 of the whole lockup
WO = (172, 420, 507, 568)  # the lilac "wo"
PARTS = {  # relative to the lockup's top-left, as (x0, y0, x1, y1)
    "wo": (0, 6, 335, 154),
    "rule": (343, 6, 346, 174),
    "academy": (373, 27, 822, 90),
    "smart": (373, 117, 601, 131),
    "tm": (831, 0, 861, 13),
}


# --------------------------------------------------------------------------
# fonts
# --------------------------------------------------------------------------
def load_poppins() -> tuple[bytes, bytes]:
    """Return (ExtraBold, Medium) TTF bytes from the next/font cache.

    next/font splits each face into unicode-range subsets, several of which
    carry the same family and weight but only a slice of the alphabet. Pick by
    glyph coverage, not by filename — the first ExtraBold in sorted order is a
    subset with no basic-Latin capitals and silently renders ACADEMY as tofu.
    """
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        sys.exit("fonttools is required:  pip install fonttools brotli")

    needed = set("ACADEMYSMRTLENIG™" + "abcdefghilmnoprstuvwy" + " .'\u00b7")

    found: dict[str, bytes] = {}
    for path in sorted(glob.glob(os.path.join(ROOT, ".next/static/media/*.woff2"))):
        try:
            font = TTFont(path, fontNumber=0)
        except Exception:
            continue
        family = font["name"].getDebugName(1) or ""
        if not family.startswith("Poppins"):
            continue
        weight = font["OS/2"].usWeightClass
        key = {800: "extrabold", 500: "medium"}.get(weight)
        if not key or key in found:
            continue
        cmap = font.getBestCmap()
        if any(ord(ch) not in cmap for ch in needed):
            continue  # a partial subset — keep looking
        font.flavor = None
        buf = io.BytesIO()
        font.save(buf)
        found[key] = buf.getvalue()

    missing = {"extrabold", "medium"} - found.keys()
    if missing:
        sys.exit(
            f"Poppins {', '.join(sorted(missing))} not found in .next/static/media — "
            "run `npm run build` first so next/font caches the webfonts."
        )
    return found["extrabold"], found["medium"]


def cap_box(font: ImageFont.FreeTypeFont, text: str, tracking: float) -> tuple[int, int]:
    """Rendered (width, height) of `text` at `tracking` extra px per gap."""
    probe = Image.new("L", (16, 16))
    draw = ImageDraw.Draw(probe)
    width = 0.0
    for i, ch in enumerate(text):
        width += draw.textlength(ch, font=font)
        if i < len(text) - 1:
            width += tracking
    box = draw.textbbox((0, 0), text, font=font)
    return round(width), box[3] - box[1]


def fit_font(ttf: bytes, text: str, target_h: int) -> ImageFont.FreeTypeFont:
    """Binary-search the point size whose rendered cap height is `target_h`."""
    lo, hi = 4, max(16, target_h * 6)
    best = ImageFont.truetype(io.BytesIO(ttf), lo)
    while lo <= hi:
        mid = (lo + hi) // 2
        font = ImageFont.truetype(io.BytesIO(ttf), mid)
        _, h = cap_box(font, text, 0)
        if h <= target_h:
            best, lo = font, mid + 1
        else:
            hi = mid - 1
    return best


def draw_tracked(
    img: Image.Image, xy: tuple[int, int], text: str,
    font: ImageFont.FreeTypeFont, fill, target_w: int,
) -> None:
    """Draw `text` letterspaced so its ink spans exactly `target_w`."""
    draw = ImageDraw.Draw(img)
    natural, _ = cap_box(font, text, 0)
    gaps = max(1, len(text) - 1)
    tracking = (target_w - natural) / gaps
    # Align to the ink box, not the em box, so it lands where measured.
    box = draw.textbbox((0, 0), text, font=font)
    x = xy[0] - box[0]
    y = xy[1] - box[1]
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


# --------------------------------------------------------------------------
# the "wo" letterform
# --------------------------------------------------------------------------
def wo_alpha() -> Image.Image:
    """The 'wo' as a soft alpha mask lifted from the artwork.

    The mark is one flat colour on white, so coverage per pixel is recoverable
    exactly: p = a*lilac + (1-a)*white  =>  a = (255 - p) / (255 - lilac). Using
    the green channel (the widest gap) keeps the antialiased edges intact, and
    the counter inside the 'o' stays white, so it falls out as transparent.
    """
    src = Image.open(SOURCE).convert("RGBA")
    src = Image.alpha_composite(Image.new("RGBA", src.size, (255, 255, 255, 255)), src)
    crop = src.convert("RGB").crop(WO)
    green = crop.split()[1]
    span = 255 - LILAC[1]
    return green.point(lambda v: max(0, min(255, round((255 - v) * 255 / span))))


def tinted(alpha: Image.Image, size: tuple[int, int], colour) -> Image.Image:
    """Scale the mask to `size` and paint it `colour` on transparency."""
    mask = alpha.resize(size, Image.LANCZOS)
    out = Image.new("RGBA", size, (*colour, 0))
    out.putalpha(mask)
    return out


# --------------------------------------------------------------------------
# assets
# --------------------------------------------------------------------------
def build_mark(alpha: Image.Image) -> None:
    """public/wo-mark.png — the standalone mark, padded like mo-mark.png."""
    h = 304  # match the year-round mark's ink height
    w = round(h * alpha.width / alpha.height)
    pad_x, pad_y = 23, 23
    canvas = Image.new("RGBA", (w + pad_x * 2, h + pad_y * 2), (255, 255, 255, 0))
    canvas.alpha_composite(tinted(alpha, (w, h), LILAC), (pad_x, pad_y))
    canvas.save(os.path.join(PUBLIC, "wo-mark.png"))
    print(f"  wo-mark.png        {canvas.size[0]}x{canvas.size[1]}")


def build_lockup(alpha: Image.Image, eb: bytes, md: bytes, scale: float = 3.0) -> None:
    """public/wo-lockup.png — mark + rule + ACADEMY / SMART LEARNING + TM."""
    lw = LOCKUP[2] - LOCKUP[0] + 1
    lh = LOCKUP[3] - LOCKUP[1] + 1
    S = lambda v: round(v * scale)  # noqa: E731
    pad = S(14)
    canvas = Image.new("RGBA", (S(lw) + pad * 2, S(lh) + pad * 2), (255, 255, 255, 0))
    draw = ImageDraw.Draw(canvas)
    ink = (0, 0, 0, 255)

    x0, y0, x1, y1 = PARTS["wo"]
    canvas.alpha_composite(
        tinted(alpha, (S(x1 - x0 + 1), S(y1 - y0 + 1)), LILAC), (pad + S(x0), pad + S(y0))
    )

    x0, y0, x1, y1 = PARTS["rule"]
    draw.rectangle(
        [pad + S(x0), pad + S(y0), pad + S(x1), pad + S(y1)], fill=ink
    )

    for key, ttf, text in (
        ("academy", eb, "ACADEMY"),
        ("smart", md, "SMART LEARNING"),
        ("tm", md, "TM"),
    ):
        x0, y0, x1, y1 = PARTS[key]
        font = fit_font(ttf, text, S(y1 - y0 + 1))
        draw_tracked(canvas, (pad + S(x0), pad + S(y0)), text, font, ink, S(x1 - x0 + 1))

    canvas.save(os.path.join(PUBLIC, "wo-lockup.png"))
    print(f"  wo-lockup.png      {canvas.size[0]}x{canvas.size[1]}")


def build_icons(alpha: Image.Image) -> None:
    """public/wo-icon-{192,512}.png — the mark centred on white, like the blue ones."""
    for size in (192, 512):
        canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        w = round(size * 0.645)
        h = round(w * alpha.height / alpha.width)
        canvas.alpha_composite(
            tinted(alpha, (w, h), LILAC), ((size - w) // 2, (size - h) // 2)
        )
        canvas.convert("RGB").save(os.path.join(PUBLIC, f"wo-icon-{size}.png"))
        print(f"  wo-icon-{size}.png    {size}x{size}")


def build_og(alpha: Image.Image, eb: bytes, md: bytes) -> None:
    """public/wo-og-image.png — the 1200x630 social card, Women's Month edition."""
    W, H = 1200, 630
    card = Image.new("RGBA", (W, H), (*PLUM, 255))

    # Lockup, matching the year-round card's placement.
    lock_h = 157
    lw = LOCKUP[2] - LOCKUP[0] + 1
    lh = LOCKUP[3] - LOCKUP[1] + 1
    s = lock_h / lh
    S = lambda v: round(v * s)  # noqa: E731
    ox, oy = (W - round(lw * s)) // 2, 157

    x0, y0, x1, y1 = PARTS["wo"]
    card.alpha_composite(
        tinted(alpha, (S(x1 - x0 + 1), S(y1 - y0 + 1)), LILAC), (ox + S(x0), oy + S(y0))
    )
    x0, y0, x1, y1 = PARTS["rule"]
    ImageDraw.Draw(card).rectangle(
        [ox + S(x0), oy + S(y0), ox + S(x1), oy + S(y1)], fill=(255, 255, 255, 255)
    )
    for key, ttf, text, colour in (
        ("academy", eb, "ACADEMY", (255, 255, 255, 255)),
        ("smart", md, "SMART LEARNING", (*LILAC, 255)),
        ("tm", md, "TM", (255, 255, 255, 255)),
    ):
        x0, y0, x1, y1 = PARTS[key]
        font = fit_font(ttf, text, max(1, S(y1 - y0 + 1)))
        draw_tracked(card, (ox + S(x0), oy + S(y0)), text, font, colour, S(x1 - x0 + 1))

    # Straplines.
    for text, ttf, cap_h, y, colour, track in (
        ("Smart Learning for every student", md, 32, 439, (255, 255, 255, 255), 0),
        ("Courses \u00b7 Wo the AI tutor \u00b7 Study guides \u00b7 Practice", md, 24, 497, (*LILAC, 255), 0),
        ("CELEBRATING WOMEN'S MONTH IN SOUTH AFRICA", md, 16, 560, (233, 200, 246, 255), 4),
    ):
        font = fit_font(ttf, text, cap_h)
        natural, _ = cap_box(font, text, track)
        draw_tracked(card, ((W - natural) // 2, y), text, font, colour, natural)

    card.convert("RGB").save(os.path.join(PUBLIC, "wo-og-image.png"))
    print(f"  wo-og-image.png    {W}x{H}")


def main() -> None:
    if not os.path.exists(SOURCE):
        sys.exit(f"missing source artwork: {SOURCE}")
    eb, md = load_poppins()
    alpha = wo_alpha()
    print("Writing Women's Month brand assets:")
    build_mark(alpha)
    build_lockup(alpha, eb, md)
    build_icons(alpha)
    build_og(alpha, eb, md)


if __name__ == "__main__":
    main()
