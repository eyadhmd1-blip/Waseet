"""
Waseet App Icon Generator
Design: Dark navy background (#0F172A) + amber gold (#F59E0B)
Concept: Arabic letter "و" (Waw) as a golden arc with two connecting dots,
         symbolizing mediation between two parties.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os

# ── Colours ──────────────────────────────────────────────────────────────────
BG_TOP    = (15,  23,  42)   # #0F172A – deep navy
BG_BOT    = (30,  41,  59)   # #1E293B – slate surface
GOLD      = (245, 158,  11)  # #F59E0B – amber accent
GOLD_DIM  = (180, 115,   8)  # darker ring shade
WHITE     = (241, 245, 249)  # #F1F5F9
TRANSP    = (0, 0, 0, 0)

def hex_to_rgb(h): r=int(h[1:3],16); g=int(h[3:5],16); b=int(h[5:7],16); return (r,g,b)

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i]-c1[i])*t) for i in range(3))

def make_icon(size=1024, for_adaptive=False):
    """
    Visual concept:
      • Vertical gradient background (dark navy → slate)
      • Outer golden ring (subtle, low opacity)
      • Two golden dots top-left and top-right (the two parties)
      • A thick golden arc connecting them from below (the mediator / وسيط)
      • Arabic "و" letter rendered in white in the center of the arc
    The whole mark together reads as both a connection symbol and the first letter.
    """
    S = size
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── 1. Background gradient ────────────────────────────────────────────────
    for y in range(S):
        t = y / S
        col = lerp_color(BG_TOP, BG_BOT, t)
        draw.line([(0, y), (S, y)], fill=col + (255,))

    # ── 2. Subtle radial vignette glow (centre is slightly lighter) ───────────
    cx, cy = S // 2, S // 2
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r in range(int(S * 0.55), 0, -4):
        alpha = int(18 * (1 - r / (S * 0.55)))
        gdraw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(245, 158, 11, alpha))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    # ── 3. Outer decorative ring ──────────────────────────────────────────────
    ring_r  = int(S * 0.42)
    ring_w  = max(2, int(S * 0.012))
    draw.ellipse(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        outline=GOLD + (55,), width=ring_w
    )

    # ── 4. Main mark: large "U / bowl" arc — the mediator bridge ─────────────
    # Arc from ~200° to ~340° (open at top) – thick golden stroke
    arc_r   = int(S * 0.30)
    arc_w   = max(4, int(S * 0.055))
    arc_box = [cx - arc_r, cy - arc_r, cx + arc_r, cy + arc_r]

    # Draw arc by stacking slightly offset ellipses for thickness
    for d in range(-arc_w//2, arc_w//2 + 1, max(1, arc_w//8)):
        r2 = arc_r + d
        b  = [cx - r2, cy - r2, cx + r2, cy + r2]
        draw.arc(b, start=195, end=345, fill=GOLD + (230,), width=max(2, int(S*0.010)))

    # ── 5. Two dots at the arc ends (parties being connected) ─────────────────
    dot_r  = int(S * 0.048)
    angle1 = math.radians(195)
    angle2 = math.radians(345)
    x1 = int(cx + arc_r * math.cos(angle1))
    y1 = int(cy + arc_r * math.sin(angle1))
    x2 = int(cx + arc_r * math.cos(angle2))
    y2 = int(cy + arc_r * math.sin(angle2))

    # Outer halo for dots
    for dot, (dx, dy) in enumerate([(x1, y1), (x2, y2)]):
        halo_r = dot_r + max(2, int(S * 0.018))
        draw.ellipse([dx-halo_r, dy-halo_r, dx+halo_r, dy+halo_r],
                     fill=GOLD + (60,))
        draw.ellipse([dx-dot_r, dy-dot_r, dx+dot_r, dy+dot_r],
                     fill=GOLD + (255,))
        # inner white centre
        in_r = max(2, dot_r // 3)
        draw.ellipse([dx-in_r, dy-in_r, dx+in_r, dy+in_r],
                     fill=WHITE + (200,))

    # ── 6. Arabic letter "و" in the centre ───────────────────────────────────
    # We render it as geometric shapes since system fonts vary:
    # Shape: a small circle (head) + descender line going right then curling
    lc = int(S * 0.50)   # letter centre-x
    ly = int(S * 0.44)   # letter centre-y
    lw = max(2, int(S * 0.025))

    # Head of "و": hollow circle
    h_r = int(S * 0.095)
    draw.ellipse([lc - h_r, ly - h_r, lc + h_r, ly + h_r],
                 outline=WHITE + (240,), width=lw)

    # Tail: short arc descending right-down then curving back left
    tail_r = int(S * 0.075)
    tail_cx = lc + int(S * 0.000)
    tail_cy = ly + int(S * 0.085)
    draw.arc([tail_cx - tail_r, tail_cy - tail_r,
              tail_cx + tail_r, tail_cy + tail_r],
             start=270, end=90, fill=WHITE + (240,), width=lw)
    # connector from head bottom to tail top
    draw.line([lc, ly + h_r, lc, tail_cy - tail_r],
              fill=WHITE + (230,), width=lw)

    # ── 7. Wordmark "وسيط" small below the mark ───────────────────────────────
    # Draw small text label using a simple pixel approach (dots for letters)
    # We'll just draw a thin underline element since fonts may not embed Arabic
    line_y = cy + int(S * 0.40)
    line_w2 = int(S * 0.20)
    draw.rounded_rectangle(
        [cx - line_w2, line_y, cx + line_w2, line_y + max(2, int(S * 0.007))],
        radius=max(1, int(S * 0.003)),
        fill=GOLD + (160,)
    )

    # ── 8. Soft glow around entire icon (for visual depth) ────────────────────
    img = img.filter(ImageFilter.GaussianBlur(radius=0))  # no blur at full res

    return img


def save_icon(img, path, size):
    """Resize and save as PNG."""
    out = img.resize((size, size), Image.LANCZOS)
    out.save(path, "PNG", optimize=True)
    print(f"  OK {path}  ({size}x{size})")


def main():
    OUT = "assets/images"
    os.makedirs(OUT, exist_ok=True)

    print("\nGenerating Waseet icons...\n")

    # Main icon (1024×1024 with rounded corners baked in)
    icon = make_icon(1024)

    # Apply rounded-rect mask for icon.png (iOS/general)
    mask = Image.new("L", (1024, 1024), 0)
    mdraw = ImageDraw.Draw(mask)
    radius = 230   # ~22% corner radius — standard iOS squircle approximation
    mdraw.rounded_rectangle([0, 0, 1023, 1023], radius=radius, fill=255)
    icon_rounded = icon.copy()
    icon_rounded.putalpha(mask)

    save_icon(icon_rounded, f"{OUT}/icon.png", 1024)

    # Adaptive icon foreground (no rounded mask — Android clips it)
    adaptive = make_icon(1024, for_adaptive=True)
    save_icon(adaptive, f"{OUT}/adaptive-icon.png", 1024)

    # Splash icon (centred mark, slightly smaller)
    splash = make_icon(512)
    save_icon(splash, f"{OUT}/splash-icon.png", 512)

    # Favicon (small, simplified)
    fav = make_icon(64)
    save_icon(fav, f"{OUT}/favicon.png", 64)

    print("\nAll icons generated.\n")


if __name__ == "__main__":
    main()
