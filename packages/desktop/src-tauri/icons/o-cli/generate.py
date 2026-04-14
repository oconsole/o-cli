#!/usr/bin/env python3
"""Generate the O-CLI brand icon set from a procedurally-drawn master.

Renders a 1024×1024 master PNG of the O-CLI mark, then derives every
size + format Tauri's bundle.icon array references:

  o-cli/
    icon.png         (1024)
    1024x1024.png
    512x512.png
    256x256.png
    128x128@2x.png   (256, drawn at @2x density)
    128x128.png
    64x64.png
    32x32@2x.png     (64)
    32x32.png
    16x16@2x.png     (32)
    16x16.png
    icon.icns        (macOS — multi-resolution Apple icon container)
    icon.ico         (Windows — multi-resolution Microsoft icon container)

The mark itself: a rounded square in O-CLI purple (#6C3483 → #BB86FC
gradient) with a centered glyph that reads as both "O" (the brand
letter) and a terminal prompt frame, plus an underscore cursor.
Recognizable at 16×16, scales cleanly to 1024×1024.
"""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------

# Purple palette carried over from the OdooCLI rebrand era.
PURPLE_DEEP = (60, 21, 90, 255)        # background top
PURPLE_MID = (108, 52, 131, 255)       # background middle
PURPLE_LIGHT = (187, 134, 252, 255)    # accent / glyph
WHITE = (245, 240, 255, 255)
SHADOW = (20, 6, 36, 180)

MASTER_SIZE = 1024
CORNER_RADIUS_RATIO = 0.225  # macOS / Tauri rounded square ratio


# ---------------------------------------------------------------------------
# Drawing the master
# ---------------------------------------------------------------------------

def draw_gradient_background(size: int) -> Image.Image:
    """Diagonal-ish gradient: deep purple top-left → bright purple bottom-right."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size - 2)
            r = int(PURPLE_DEEP[0] * (1 - t) + PURPLE_LIGHT[0] * t * 0.85)
            g = int(PURPLE_DEEP[1] * (1 - t) + PURPLE_LIGHT[1] * t * 0.85)
            b = int(PURPLE_DEEP[2] * (1 - t) + PURPLE_LIGHT[2] * t * 0.85)
            px[x, y] = (r, g, b, 255)
    return img


def rounded_mask(size: int, radius_ratio: float) -> Image.Image:
    """Single-channel mask for the rounded-square clip."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def draw_o_glyph(canvas: Image.Image) -> None:
    """Draw a true 'O' ring + underscore cursor over the gradient background.

    Strategy: build a flat-color image of the ring/cursor on a transparent
    canvas, then alpha_composite it on top of the gradient. A true ring is
    made by drawing a filled outer ellipse on a mask layer and then drawing
    a transparent (alpha 0) inner ellipse to punch the hole — so the
    gradient underneath shows through and the "O" reads as a real letter,
    not a filled disc.
    """
    size = canvas.size[0]

    # Geometry
    cx, cy = size // 2, int(size * 0.45)
    outer_r = int(size * 0.32)
    ring_thickness = int(size * 0.075)
    inner_r = outer_r - ring_thickness
    bar_w = int(outer_r * 1.55)
    bar_h = int(size * 0.06)
    bar_y = cy + outer_r + int(size * 0.10)

    # The ring layer — flat-color filled outer ellipse, then a transparent
    # inner ellipse cuts the hole. ImageDraw.ellipse with fill=(0,0,0,0)
    # in RGBA mode genuinely zeroes the alpha rather than blending, which
    # is what we want for the punch-through.
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse(
        (cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r),
        fill=PURPLE_LIGHT,
    )
    rd.ellipse(
        (cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r),
        fill=(0, 0, 0, 0),
    )

    # Underscore cursor — drawn into the same layer in white.
    rd.rounded_rectangle(
        (cx - bar_w // 2, bar_y, cx + bar_w // 2, bar_y + bar_h),
        radius=bar_h // 2,
        fill=WHITE,
    )

    canvas.alpha_composite(ring)

    # Highlight arc on the top-left curve of the O for a tiny bit of depth.
    highlight = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    hl_draw = ImageDraw.Draw(highlight)
    hl_draw.arc(
        (
            cx - outer_r + ring_thickness // 2,
            cy - outer_r + ring_thickness // 2,
            cx + outer_r - ring_thickness // 2,
            cy + outer_r - ring_thickness // 2,
        ),
        start=200,
        end=330,
        fill=(255, 255, 255, 130),
        width=max(int(size * 0.011), 3),
    )
    canvas.alpha_composite(highlight)


def render_master(size: int = MASTER_SIZE) -> Image.Image:
    """Compose the full O-CLI mark at a given size."""
    bg = draw_gradient_background(size)

    # Soft inner glow at the center for depth
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        (
            int(size * 0.10),
            int(size * 0.10),
            int(size * 0.90),
            int(size * 0.90),
        ),
        fill=(187, 134, 252, 60),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.05))
    bg.alpha_composite(glow)

    draw_o_glyph(bg)

    # Apply the rounded-square clip
    mask = rounded_mask(size, CORNER_RADIUS_RATIO)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)
    return out


# ---------------------------------------------------------------------------
# Variants
# ---------------------------------------------------------------------------

# Tauri bundle.icon expects these names by convention.
PNG_VARIANTS = [
    ("16x16.png", 16),
    ("16x16@2x.png", 32),
    ("32x32.png", 32),
    ("32x32@2x.png", 64),
    ("64x64.png", 64),
    ("128x128.png", 128),
    ("128x128@2x.png", 256),
    ("256x256.png", 256),
    ("256x256@2x.png", 512),
    ("512x512.png", 512),
    ("512x512@2x.png", 1024),
    ("1024x1024.png", 1024),
    ("icon.png", 1024),
]

# Sizes ICNS officially supports without complaints from `iconutil`.
ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024]
ICO_SIZES = [16, 32, 48, 64, 128, 256]


def main() -> None:
    out_dir = Path(__file__).parent
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Rendering master {MASTER_SIZE}×{MASTER_SIZE}…")
    master = render_master(MASTER_SIZE)

    # Save all PNG sizes by Lanczos-resampling from the master.
    for name, size in PNG_VARIANTS:
        path = out_dir / name
        if size == MASTER_SIZE:
            master.save(path, "PNG")
        else:
            master.resize((size, size), Image.LANCZOS).save(path, "PNG")
        print(f"  ✓ {name}")

    # macOS .icns — Pillow's native ICNS encoder accepts the master and
    # picks valid sizes from its built-in table.
    icns_path = out_dir / "icon.icns"
    master.save(
        icns_path,
        format="ICNS",
        sizes=[(s, s) for s in ICNS_SIZES],
    )
    print(f"  ✓ icon.icns ({icns_path.stat().st_size} bytes)")

    # Windows .ico — Pillow's ICO encoder takes a sizes list and emits a
    # single multi-resolution container.
    ico_path = out_dir / "icon.ico"
    master.save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in ICO_SIZES],
    )
    print(f"  ✓ icon.ico ({ico_path.stat().st_size} bytes)")

    print("Done.")


if __name__ == "__main__":
    main()
