from __future__ import annotations

import json
import math
import os
import struct
import sys
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).parent / "tap-gallery-analysis" / "pydeps"))

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).parent
OUT = ROOT / "generated-game-assets"
LEVEL_DIR = OUT / "assets" / "levels"
MASK_DIR = LEVEL_DIR / "masks"
REVEAL_DIR = LEVEL_DIR / "reveal"
THUMB_DIR = LEVEL_DIR / "thumbs"
UI_DIR = OUT / "assets" / "ui"
SFX_DIR = OUT / "assets" / "audio" / "sfx"
PREVIEW_DIR = OUT / "previews"

SIZE = 1024
THUMB = 256
SCALE = 2
CANVAS = SIZE * SCALE


@dataclass(frozen=True)
class LevelAsset:
    no: int
    asset_id: str
    title: str
    slug: str
    subject: str
    palette: tuple[str, ...]


LEVELS: list[LevelAsset] = [
    LevelAsset(1, "level_001_strawberry", "Strawberry", "strawberry", "strawberry", ("#f94144", "#43aa8b", "#ffd166")),
    LevelAsset(2, "level_002_star_medal", "Star Medal", "star-medal", "star medal", ("#ffd447", "#2f80ed", "#ff8a3d")),
    LevelAsset(3, "level_003_rocket", "Rocket", "rocket", "rocket", ("#f2f5ff", "#ef476f", "#118ab2")),
    LevelAsset(4, "level_004_paint_palette", "Paint Palette", "paint-palette", "paint palette", ("#ffcf56", "#ef476f", "#06d6a0", "#118ab2")),
    LevelAsset(5, "level_005_ice_cream", "Ice Cream", "ice-cream", "ice cream", ("#ffafcc", "#bde0fe", "#f4a261", "#6d597a")),
    LevelAsset(6, "level_006_suitcase", "Suitcase", "suitcase", "suitcase", ("#f77f00", "#5a3e2b", "#fcbf49")),
    LevelAsset(7, "level_007_camera", "Camera", "camera", "camera", ("#3a4750", "#00b4d8", "#f7f7f7")),
    LevelAsset(8, "level_008_cupcake", "Cupcake", "cupcake", "cupcake", ("#ffafcc", "#ffd166", "#9b5de5", "#f15bb5")),
    LevelAsset(9, "level_009_kite", "Kite", "kite", "kite", ("#ef476f", "#ffd166", "#118ab2", "#06d6a0")),
    LevelAsset(10, "level_010_gift_box", "Gift Box", "gift-box", "gift box", ("#ef476f", "#ffd166", "#ffffff")),
    LevelAsset(11, "level_011_sunflower", "Sunflower", "sunflower", "sunflower", ("#f9c74f", "#6a4c2e", "#43aa8b")),
    LevelAsset(12, "level_012_robot_head", "Robot Head", "robot-head", "robot head", ("#8ecae6", "#219ebc", "#ffb703")),
    LevelAsset(13, "level_013_hot_air_balloon", "Hot Air Balloon", "hot-air-balloon", "hot air balloon", ("#ef476f", "#ffd166", "#118ab2", "#8ecae6")),
    LevelAsset(14, "level_014_teapot", "Teapot", "teapot", "teapot", ("#6ec6ff", "#fefae0", "#ffb703")),
    LevelAsset(15, "level_015_compass", "Compass", "compass", "compass", ("#ffd166", "#264653", "#ef476f")),
    LevelAsset(16, "level_016_skateboard", "Skateboard", "skateboard", "skateboard", ("#7209b7", "#f72585", "#4cc9f0")),
    LevelAsset(17, "level_017_castle", "Castle", "castle", "castle", ("#8ecae6", "#ffb703", "#fb8500")),
    LevelAsset(18, "level_018_pineapple", "Pineapple", "pineapple", "pineapple", ("#f9c74f", "#43aa8b", "#f8961e")),
    LevelAsset(19, "level_019_lighthouse", "Lighthouse", "lighthouse", "lighthouse", ("#f7f7f7", "#ef476f", "#118ab2")),
    LevelAsset(20, "level_020_umbrella", "Umbrella", "umbrella", "umbrella", ("#00b4d8", "#ffd166", "#ef476f")),
    LevelAsset(21, "level_021_train_front", "Train Front", "train-front", "train front", ("#2a9d8f", "#264653", "#e9c46a")),
    LevelAsset(22, "level_022_potion_bottle", "Potion Bottle", "potion-bottle", "potion bottle", ("#9b5de5", "#00f5d4", "#fee440")),
    LevelAsset(23, "level_023_music_note", "Music Note", "music-note", "music note badge", ("#3a86ff", "#ff006e", "#ffbe0b")),
    LevelAsset(24, "level_024_paper_lantern", "Paper Lantern", "paper-lantern", "paper lantern", ("#ff595e", "#ffca3a", "#6a4c93")),
    LevelAsset(25, "level_025_astronaut_helmet", "Astronaut Helmet", "astronaut-helmet", "astronaut helmet", ("#f7f7f7", "#3a86ff", "#8338ec")),
    LevelAsset(26, "level_026_treasure_chest", "Treasure Chest", "treasure-chest", "treasure chest", ("#8d5524", "#ffd166", "#ef476f")),
    LevelAsset(27, "level_027_crown", "Crown", "crown", "crown", ("#ffbe0b", "#fb5607", "#8338ec")),
    LevelAsset(28, "level_028_mountain_cabin", "Mountain Cabin", "mountain-cabin", "mountain cabin", ("#8d6e63", "#43aa8b", "#8ecae6")),
    LevelAsset(29, "level_029_fireworks_badge", "Fireworks Badge", "fireworks-badge", "fireworks badge", ("#3a0ca3", "#f72585", "#4cc9f0", "#ffbe0b")),
    LevelAsset(30, "level_030_trophy_tower", "Trophy Tower", "trophy-tower", "trophy tower", ("#ffbe0b", "#f77f00", "#4361ee")),
]


def hx(color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    color = color.lstrip("#")
    return int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16), alpha


def p(v: float) -> int:
    return int(round(v * SCALE))


def box(x0: float, y0: float, x1: float, y1: float) -> tuple[int, int, int, int]:
    return p(x0), p(y0), p(x1), p(y1)


def pts(points: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(p(x), p(y)) for x, y in points]


def darker(color: str, amount: float = 0.78) -> tuple[int, int, int, int]:
    r, g, b, a = hx(color)
    return int(r * amount), int(g * amount), int(b * amount), a


def lighter(color: str, amount: float = 1.18) -> tuple[int, int, int, int]:
    r, g, b, a = hx(color)
    return min(255, int(r * amount)), min(255, int(g * amount)), min(255, int(b * amount)), a


def new_canvas() -> Image.Image:
    return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))


def finish(img: Image.Image) -> Image.Image:
    return img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def fit_alpha_bbox(img: Image.Image, padding: int = 76) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    cropped = img.crop(bbox)
    max_side = max(cropped.size)
    scale = (SIZE - padding * 2) / max_side
    resized = cropped.resize((int(cropped.width * scale), int(cropped.height * scale)), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(resized, ((SIZE - resized.width) // 2, (SIZE - resized.height) // 2))
    return out


def polish_reveal(img: Image.Image, level: LevelAsset) -> Image.Image:
    base = finish(img)
    base = fit_alpha_bbox(base)
    alpha = base.getchannel("A")

    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shadow_alpha = alpha.filter(ImageFilter.GaussianBlur(18))
    shadow.putalpha(shadow_alpha.point(lambda a: int(a * 0.24)))
    shadow_colored = Image.new("RGBA", base.size, (42, 50, 80, 0))
    shadow_colored.putalpha(shadow.getchannel("A"))

    rim_alpha = alpha.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1.2))
    rim = Image.new("RGBA", base.size, (255, 255, 255, 0))
    rim.putalpha(rim_alpha.point(lambda a: min(115, int(a * 0.75))))

    top_light = Image.new("RGBA", base.size, (0, 0, 0, 0))
    light_draw = ImageDraw.Draw(top_light, "RGBA")
    light_draw.ellipse((-120, -160, 690, 520), fill=(255, 255, 255, 58))
    top_light.putalpha(Image.composite(top_light.getchannel("A"), Image.new("L", base.size, 0), alpha))

    shade = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade, "RGBA")
    shade_draw.ellipse((360, 430, 1220, 1250), fill=(42, 40, 80, 48))
    shade.putalpha(Image.composite(shade.getchannel("A"), Image.new("L", base.size, 0), alpha))

    texture = Image.new("RGBA", base.size, (0, 0, 0, 0))
    pixels = texture.load()
    seed = level.no * 97 + 11
    x = seed
    for yy in range(0, SIZE, 2):
        for xx in range(0, SIZE, 2):
            x = (1103515245 * x + 12345) & 0x7FFFFFFF
            v = 255 if (x & 7) == 0 else 0
            if v and alpha.getpixel((xx, yy)) > 10:
                pixels[xx, yy] = (255, 255, 255, 10)
    texture = texture.filter(ImageFilter.GaussianBlur(0.7))

    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    out.alpha_composite(shadow_colored)
    out.alpha_composite(base)
    out.alpha_composite(shade)
    out.alpha_composite(top_light)
    out.alpha_composite(texture)
    out.alpha_composite(rim)
    return out.filter(ImageFilter.UnsharpMask(radius=1.0, percent=115, threshold=2))


def save_asset(img: Image.Image, level: LevelAsset, filename: str) -> None:
    mask = finish(img)
    reveal = polish_reveal(img, level)
    mask.save(MASK_DIR / filename.replace(".png", "-mask.png"))
    reveal_path = REVEAL_DIR / filename
    if not reveal_path.exists():
        reveal.save(reveal_path)
    reveal_for_thumb = Image.open(reveal_path).convert("RGBA")
    reveal_for_thumb.resize((THUMB, THUMB), Image.Resampling.LANCZOS).save(THUMB_DIR / filename.replace(".png", "-thumb.png"))


def draw_soft_highlight(draw: ImageDraw.ImageDraw, xy: tuple[float, float, float, float]) -> None:
    draw.ellipse(box(*xy), fill=(255, 255, 255, 70))


def draw_star(draw: ImageDraw.ImageDraw, cx: float, cy: float, outer: float, inner: float, fill, outline=None, width=0, points_count=5) -> None:
    points = []
    for i in range(points_count * 2):
        radius = outer if i % 2 == 0 else inner
        angle = -math.pi / 2 + i * math.pi / points_count
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(pts(points), fill=fill)
    if outline and width:
        draw.line(pts(points + [points[0]]), fill=outline, width=p(width), joint="curve")


def draw_common_badge(draw: ImageDraw.ImageDraw, fill="#ffffff") -> None:
    draw.ellipse(box(210, 210, 814, 814), fill=hx(fill), outline=(255, 255, 255, 210), width=p(18))


def star_medal(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse(box(230, 260, 794, 824), fill=hx("#2f80ed"), outline=darker("#2f80ed"), width=p(20))
    draw_star(draw, 512, 525, 250, 112, hx("#ffd447"), darker("#ffd447"), 16)
    draw.ellipse(box(405, 410, 619, 624), fill=hx("#ff8a3d", 170))
    draw_soft_highlight(draw, (330, 330, 470, 430))


def strawberry(draw: ImageDraw.ImageDraw) -> None:
    body = [(512, 820), (265, 525), (300, 295), (512, 220), (724, 295), (759, 525)]
    draw.polygon(pts(body), fill=hx("#f94144"))
    draw.line(pts(body + [body[0]]), fill=darker("#f94144"), width=p(18), joint="curve")
    leaves = [(410, 260), (465, 160), (515, 265), (570, 160), (612, 270), (700, 230), (635, 330), (390, 330), (320, 230)]
    draw.polygon(pts(leaves), fill=hx("#43aa8b"))
    for x, y in [(430, 420), (540, 380), (630, 500), (465, 570), (570, 640), (380, 510)]:
        draw.ellipse(box(x - 18, y - 28, x + 18, y + 18), fill=hx("#ffd166"))
    draw_soft_highlight(draw, (365, 335, 485, 455))


def rocket(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(pts([(512, 120), (360, 410), (360, 690), (512, 820), (664, 690), (664, 410)]), fill=hx("#f2f5ff"))
    draw.line(pts([(512, 120), (360, 410), (360, 690), (512, 820), (664, 690), (664, 410), (512, 120)]), fill=darker("#118ab2"), width=p(16), joint="curve")
    draw.polygon(pts([(512, 120), (410, 330), (614, 330)]), fill=hx("#ef476f"))
    draw.ellipse(box(430, 380, 594, 544), fill=hx("#118ab2"), outline=hx("#ffffff"), width=p(14))
    draw.polygon(pts([(360, 620), (230, 760), (375, 730)]), fill=hx("#ef476f"))
    draw.polygon(pts([(664, 620), (794, 760), (649, 730)]), fill=hx("#ef476f"))
    draw.polygon(pts([(455, 800), (512, 935), (569, 800)]), fill=hx("#ffb703"))
    draw.polygon(pts([(482, 800), (512, 890), (542, 800)]), fill=hx("#fb5607"))


def paint_palette(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse(box(190, 250, 840, 780), fill=hx("#ffcf56"), outline=darker("#ffcf56"), width=p(18))
    draw.ellipse(box(580, 335, 745, 500), fill=(0, 0, 0, 0), outline=hx("#ffffff"), width=p(32))
    for c, x, y in [("#ef476f", 350, 395), ("#06d6a0", 430, 570), ("#118ab2", 570, 625), ("#9b5de5", 300, 590)]:
        draw.ellipse(box(x - 55, y - 55, x + 55, y + 55), fill=hx(c), outline=(255, 255, 255, 185), width=p(8))
    draw_soft_highlight(draw, (285, 320, 455, 420))


def ice_cream(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(pts([(405, 520), (620, 520), (545, 875), (480, 875)]), fill=hx("#f4a261"))
    draw.line(pts([(405, 520), (620, 520), (545, 875), (480, 875), (405, 520)]), fill=darker("#f4a261"), width=p(14))
    for y in [610, 700]:
        draw.line(pts([(430, y), (590, y + 60)]), fill=darker("#f4a261", 0.85), width=p(8))
        draw.line(pts([(590, y), (430, y + 60)]), fill=darker("#f4a261", 0.85), width=p(8))
    draw.ellipse(box(330, 260, 695, 615), fill=hx("#ffafcc"), outline=darker("#ffafcc"), width=p(16))
    draw.ellipse(box(425, 170, 735, 505), fill=hx("#bde0fe"), outline=darker("#bde0fe"), width=p(16))
    draw_soft_highlight(draw, (410, 300, 520, 410))


def suitcase(draw: ImageDraw.ImageDraw) -> None:
    draw.rounded_rectangle(box(220, 330, 804, 790), radius=p(70), fill=hx("#f77f00"), outline=darker("#f77f00"), width=p(18))
    draw.rounded_rectangle(box(380, 230, 644, 390), radius=p(70), outline=hx("#5a3e2b"), width=p(26))
    for x in [330, 694]:
        draw.rounded_rectangle(box(x - 34, 325, x + 34, 795), radius=p(26), fill=hx("#5a3e2b", 180))
    draw.rounded_rectangle(box(300, 475, 724, 630), radius=p(34), fill=hx("#fcbf49", 160))
    draw_soft_highlight(draw, (280, 380, 440, 480))


def camera(draw: ImageDraw.ImageDraw) -> None:
    draw.rounded_rectangle(box(190, 330, 834, 745), radius=p(76), fill=hx("#3a4750"), outline=darker("#3a4750"), width=p(18))
    draw.rounded_rectangle(box(310, 250, 500, 360), radius=p(42), fill=hx("#3a4750"))
    draw.ellipse(box(368, 390, 656, 678), fill=hx("#00b4d8"), outline=hx("#f7f7f7"), width=p(22))
    draw.ellipse(box(438, 460, 586, 608), fill=darker("#00b4d8", 0.62))
    draw.ellipse(box(700, 390, 770, 460), fill=hx("#f7f7f7"))
    draw_soft_highlight(draw, (415, 420, 500, 500))


def cupcake(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(pts([(330, 555), (695, 555), (640, 840), (385, 840)]), fill=hx("#ffd166"))
    draw.line(pts([(330, 555), (695, 555), (640, 840), (385, 840), (330, 555)]), fill=darker("#ffd166"), width=p(14))
    for x in [410, 512, 615]:
        draw.line(pts([(x, 580), (x - 35, 815)]), fill=darker("#ffd166", 0.84), width=p(9))
    for xy, c in [((310, 370, 500, 570), "#ffafcc"), ((435, 300, 630, 565), "#f15bb5"), ((560, 390, 735, 570), "#9b5de5")]:
        draw.ellipse(box(*xy), fill=hx(c), outline=darker(c), width=p(12))
    draw.ellipse(box(500, 235, 560, 295), fill=hx("#ef476f"))


def kite(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(pts([(512, 160), (780, 465), (512, 780), (245, 465)]), fill=hx("#ef476f"), outline=darker("#ef476f"), width=p(18))
    draw.polygon(pts([(512, 160), (512, 465), (245, 465)]), fill=hx("#ffd166"))
    draw.polygon(pts([(512, 465), (780, 465), (512, 780)]), fill=hx("#118ab2"))
    draw.line(pts([(512, 780), (545, 850), (500, 910), (555, 965)]), fill=hx("#06d6a0"), width=p(12))
    for x, y in [(545, 850), (500, 910), (555, 965)]:
        draw.polygon(pts([(x - 32, y), (x, y - 22), (x + 32, y), (x, y + 22)]), fill=hx("#ffd166"))


def gift_box(draw: ImageDraw.ImageDraw) -> None:
    draw.rounded_rectangle(box(230, 405, 795, 825), radius=p(48), fill=hx("#ef476f"), outline=darker("#ef476f"), width=p(18))
    draw.rectangle(box(480, 405, 545, 825), fill=hx("#ffd166"))
    draw.rectangle(box(230, 560, 795, 630), fill=hx("#ffd166"))
    draw.ellipse(box(365, 250, 525, 425), fill=hx("#ffd166"), outline=darker("#ffd166"), width=p(10))
    draw.ellipse(box(500, 250, 660, 425), fill=hx("#ffd166"), outline=darker("#ffd166"), width=p(10))
    draw_soft_highlight(draw, (300, 455, 420, 540))


def sunflower(draw: ImageDraw.ImageDraw) -> None:
    for i in range(16):
        a = i * math.tau / 16
        cx, cy = 512 + math.cos(a) * 230, 515 + math.sin(a) * 230
        draw.ellipse(box(cx - 82, cy - 46, cx + 82, cy + 46), fill=hx("#f9c74f"), outline=darker("#f9c74f"), width=p(8))
    draw.ellipse(box(315, 320, 710, 715), fill=hx("#6a4c2e"), outline=darker("#6a4c2e"), width=p(14))
    for x in [420, 512, 604]:
        for y in [430, 520, 610]:
            draw.ellipse(box(x - 18, y - 18, x + 18, y + 18), fill=darker("#6a4c2e", 0.55))
    draw.line(pts([(512, 690), (512, 900)]), fill=hx("#43aa8b"), width=p(34))
    draw.ellipse(box(355, 760, 520, 875), fill=hx("#43aa8b"))
    draw.ellipse(box(505, 785, 675, 900), fill=hx("#43aa8b"))


def robot_head(draw: ImageDraw.ImageDraw) -> None:
    draw.rounded_rectangle(box(260, 320, 764, 760), radius=p(90), fill=hx("#8ecae6"), outline=darker("#219ebc"), width=p(18))
    draw.line(pts([(512, 320), (512, 220)]), fill=darker("#219ebc"), width=p(14))
    draw.ellipse(box(475, 160, 550, 235), fill=hx("#ffb703"))
    draw.rounded_rectangle(box(345, 450, 455, 555), radius=p(32), fill=hx("#264653"))
    draw.rounded_rectangle(box(570, 450, 680, 555), radius=p(32), fill=hx("#264653"))
    draw.rounded_rectangle(box(385, 625, 640, 680), radius=p(22), fill=hx("#f7f7f7"))
    for x in [430, 485, 540, 595]:
        draw.line(pts([(x, 625), (x, 680)]), fill=darker("#219ebc"), width=p(6))


def hot_air_balloon(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse(box(260, 140, 764, 665), fill=hx("#ef476f"), outline=darker("#ef476f"), width=p(18))
    draw.pieslice(box(260, 140, 764, 665), 90, 270, fill=hx("#ffd166"))
    draw.pieslice(box(380, 140, 885, 665), 90, 270, fill=hx("#118ab2"))
    draw.line(pts([(405, 650), (455, 805), (570, 805), (620, 650)]), fill=darker("#118ab2"), width=p(10))
    draw.rounded_rectangle(box(415, 780, 610, 900), radius=p(24), fill=hx("#8ecae6"), outline=darker("#118ab2"), width=p(10))


def teapot(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse(box(300, 365, 720, 790), fill=hx("#6ec6ff"), outline=darker("#6ec6ff"), width=p(18))
    draw.ellipse(box(430, 270, 590, 390), fill=hx("#fefae0"), outline=darker("#6ec6ff"), width=p(12))
    draw.polygon(pts([(680, 480), (850, 405), (755, 570)]), fill=hx("#6ec6ff"), outline=darker("#6ec6ff"))
    draw.arc(box(205, 440, 380, 670), 80, 285, fill=darker("#6ec6ff"), width=p(30))
    draw.ellipse(box(465, 510, 560, 605), fill=hx("#ffb703", 160))
    draw_soft_highlight(draw, (385, 420, 505, 515))


def compass(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse(box(205, 205, 820, 820), fill=hx("#ffd166"), outline=darker("#264653"), width=p(24))
    draw.ellipse(box(295, 295, 730, 730), fill=hx("#f7f7f7"), outline=darker("#264653"), width=p(12))
    draw.polygon(pts([(512, 285), (575, 520), (512, 735), (450, 520)]), fill=hx("#ef476f"), outline=darker("#ef476f"))
    draw.polygon(pts([(512, 735), (575, 520), (512, 285), (450, 520)]), outline=darker("#264653"))
    draw.ellipse(box(470, 475, 555, 560), fill=hx("#264653"))


def skateboard(draw: ImageDraw.ImageDraw) -> None:
    draw.rounded_rectangle(box(165, 455, 860, 630), radius=p(90), fill=hx("#7209b7"), outline=darker("#7209b7"), width=p(18))
    draw.rounded_rectangle(box(260, 495, 760, 575), radius=p(42), fill=hx("#f72585", 185))
    for x in [310, 715]:
        draw.ellipse(box(x - 70, 640, x + 70, 780), fill=hx("#4cc9f0"), outline=darker("#4cc9f0"), width=p(12))
        draw.ellipse(box(x - 28, 682, x + 28, 738), fill=darker("#4cc9f0", 0.55))


def castle(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle(box(300, 420, 725, 820), fill=hx("#8ecae6"), outline=darker("#8ecae6"), width=p(16))
    for x in [245, 512, 780]:
        draw.rectangle(box(x - 85, 345, x + 85, 820), fill=hx("#8ecae6"), outline=darker("#8ecae6"), width=p(14))
        draw.polygon(pts([(x - 105, 345), (x, 210), (x + 105, 345)]), fill=hx("#fb8500"), outline=darker("#fb8500"))
    draw.rounded_rectangle(box(450, 640, 575, 820), radius=p(60), fill=hx("#264653"))
    for x in [250, 512, 775]:
        draw.rectangle(box(x - 35, 475, x + 35, 545), fill=hx("#ffb703"))


def pineapple(draw: ImageDraw.ImageDraw) -> None:
    leaves = [(512, 255), (430, 120), (480, 300), (345, 190), (445, 360), (290, 335), (455, 420), (575, 420), (735, 335), (585, 360), (680, 190), (545, 300), (595, 120)]
    draw.polygon(pts(leaves), fill=hx("#43aa8b"), outline=darker("#43aa8b"))
    draw.ellipse(box(315, 320, 710, 875), fill=hx("#f9c74f"), outline=darker("#f8961e"), width=p(18))
    for x in range(380, 670, 75):
        draw.line(pts([(x - 120, 360), (x + 170, 850)]), fill=darker("#f9c74f", 0.82), width=p(8))
        draw.line(pts([(x + 170, 360), (x - 120, 850)]), fill=darker("#f9c74f", 0.82), width=p(8))


def lighthouse(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(pts([(405, 835), (620, 835), (590, 330), (435, 330)]), fill=hx("#f7f7f7"), outline=darker("#118ab2"), width=p(16))
    for y in [430, 570, 710]:
        draw.polygon(pts([(427, y), (596, y - 45), (604, y + 28), (420, y + 72)]), fill=hx("#ef476f"))
    draw.rectangle(box(390, 230, 635, 340), fill=hx("#118ab2"), outline=darker("#118ab2"), width=p(12))
    draw.polygon(pts([(512, 140), (375, 230), (650, 230)]), fill=hx("#ef476f"))
    draw.ellipse(box(455, 245, 570, 315), fill=hx("#ffd166"))
    draw.rectangle(box(325, 835, 700, 900), fill=hx("#264653"))


def umbrella(draw: ImageDraw.ImageDraw) -> None:
    draw.pieslice(box(190, 220, 835, 865), 180, 360, fill=hx("#00b4d8"), outline=darker("#00b4d8"), width=p(18))
    for x, c in [(300, "#ffd166"), (512, "#ef476f"), (725, "#ffd166")]:
        draw.pieslice(box(x - 150, 420, x + 150, 720), 180, 360, fill=hx(c))
    draw.line(pts([(512, 540), (512, 850), (610, 850)]), fill=darker("#00b4d8"), width=p(22))
    draw.arc(box(555, 780, 680, 910), 0, 180, fill=darker("#00b4d8"), width=p(22))


def train_front(draw: ImageDraw.ImageDraw) -> None:
    draw.rounded_rectangle(box(275, 250, 750, 810), radius=p(100), fill=hx("#2a9d8f"), outline=darker("#264653"), width=p(18))
    draw.rounded_rectangle(box(345, 330, 680, 505), radius=p(32), fill=hx("#8ecae6"), outline=darker("#264653"), width=p(10))
    draw.ellipse(box(430, 560, 595, 725), fill=hx("#e9c46a"), outline=darker("#264653"), width=p(12))
    for x in [345, 680]:
        draw.ellipse(box(x - 45, 610, x + 45, 700), fill=hx("#f7f7f7"), outline=darker("#264653"), width=p(8))
    draw.rectangle(box(300, 805, 725, 880), fill=hx("#264653"))


def potion_bottle(draw: ImageDraw.ImageDraw) -> None:
    draw.rounded_rectangle(box(430, 180, 595, 350), radius=p(38), fill=hx("#9b5de5"), outline=darker("#9b5de5"), width=p(12))
    draw.rounded_rectangle(box(345, 330, 680, 835), radius=p(120), fill=hx("#00f5d4", 210), outline=darker("#9b5de5"), width=p(18))
    draw.pieslice(box(365, 515, 660, 825), 0, 180, fill=hx("#9b5de5", 180))
    draw.ellipse(box(430, 625, 515, 710), fill=hx("#fee440", 190))
    draw.ellipse(box(560, 575, 625, 640), fill=hx("#fee440", 150))
    draw_soft_highlight(draw, (405, 380, 495, 500))


def music_note(draw: ImageDraw.ImageDraw) -> None:
    draw_common_badge(draw, "#3a86ff")
    draw.ellipse(box(285, 620, 445, 780), fill=hx("#ff006e"))
    draw.ellipse(box(575, 565, 735, 725), fill=hx("#ff006e"))
    draw.rectangle(box(410, 290, 470, 700), fill=hx("#ff006e"))
    draw.rectangle(box(700, 235, 760, 640), fill=hx("#ff006e"))
    draw.polygon(pts([(410, 290), (760, 235), (760, 340), (410, 395)]), fill=hx("#ffbe0b"))


def paper_lantern(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse(box(280, 220, 745, 800), fill=hx("#ff595e"), outline=darker("#ff595e"), width=p(18))
    for x in [390, 512, 635]:
        draw.arc(box(x - 130, 230, x + 130, 790), 80, 280, fill=hx("#ffca3a"), width=p(10))
    for y in [330, 470, 610, 730]:
        draw.line(pts([(330, y), (695, y)]), fill=hx("#ffca3a"), width=p(8))
    draw.rectangle(box(420, 165, 605, 235), fill=hx("#6a4c93"))
    draw.rectangle(box(420, 785, 605, 850), fill=hx("#6a4c93"))
    draw.line(pts([(512, 850), (512, 940)]), fill=hx("#6a4c93"), width=p(10))


def astronaut_helmet(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse(box(225, 215, 800, 835), fill=hx("#f7f7f7"), outline=darker("#3a86ff"), width=p(20))
    draw.rounded_rectangle(box(340, 390, 685, 640), radius=p(92), fill=hx("#3a86ff"), outline=darker("#8338ec"), width=p(14))
    draw.ellipse(box(415, 435, 520, 530), fill=hx("#ffffff", 80))
    draw.rounded_rectangle(box(275, 650, 750, 820), radius=p(70), fill=hx("#8338ec", 150))
    for x in [315, 710]:
        draw.ellipse(box(x - 42, 500, x + 42, 625), fill=hx("#8338ec"))


def treasure_chest(draw: ImageDraw.ImageDraw) -> None:
    draw.rounded_rectangle(box(230, 420, 795, 810), radius=p(55), fill=hx("#8d5524"), outline=darker("#8d5524"), width=p(18))
    draw.pieslice(box(230, 250, 795, 590), 180, 360, fill=hx("#a86a2d"), outline=darker("#8d5524"), width=p(18))
    draw.rectangle(box(485, 310, 545, 810), fill=hx("#ffd166"))
    draw.rectangle(box(230, 555, 795, 625), fill=hx("#ffd166"))
    draw.rounded_rectangle(box(455, 570, 575, 705), radius=p(24), fill=hx("#ef476f"), outline=darker("#ef476f"), width=p(8))


def crown(draw: ImageDraw.ImageDraw) -> None:
    crown_pts = [(180, 740), (245, 335), (390, 575), (512, 260), (635, 575), (780, 335), (845, 740)]
    draw.polygon(pts(crown_pts), fill=hx("#ffbe0b"), outline=darker("#fb5607"))
    draw.line(pts(crown_pts + [crown_pts[0]]), fill=darker("#fb5607"), width=p(18), joint="curve")
    draw.rounded_rectangle(box(225, 695, 800, 830), radius=p(50), fill=hx("#ffbe0b"), outline=darker("#fb5607"), width=p(16))
    for x, c in [(340, "#8338ec"), (512, "#fb5607"), (685, "#3a86ff")]:
        draw.ellipse(box(x - 44, 620, x + 44, 708), fill=hx(c), outline=(255, 255, 255, 180), width=p(8))


def mountain_cabin(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(pts([(180, 745), (380, 415), (565, 745)]), fill=hx("#8ecae6"), outline=darker("#8ecae6"), width=p(12))
    draw.polygon(pts([(470, 745), (700, 360), (885, 745)]), fill=hx("#43aa8b"), outline=darker("#43aa8b"), width=p(12))
    draw.rectangle(box(330, 555, 705, 835), fill=hx("#8d6e63"), outline=darker("#8d6e63"), width=p(14))
    draw.polygon(pts([(290, 560), (512, 365), (745, 560)]), fill=hx("#f77f00"), outline=darker("#f77f00"), width=p(14))
    draw.rectangle(box(470, 680, 565, 835), fill=hx("#5a3e2b"))
    draw.rectangle(box(375, 635, 445, 710), fill=hx("#8ecae6"))


def fireworks_badge(draw: ImageDraw.ImageDraw) -> None:
    draw_common_badge(draw, "#3a0ca3")
    for cx, cy, color in [(400, 455, "#f72585"), (605, 390, "#4cc9f0"), (560, 620, "#ffbe0b")]:
        for i in range(10):
            a = i * math.tau / 10
            draw.line(pts([(cx, cy), (cx + math.cos(a) * 100, cy + math.sin(a) * 100)]), fill=hx(color), width=p(12))
        draw.ellipse(box(cx - 26, cy - 26, cx + 26, cy + 26), fill=hx("#ffffff"))
    draw.ellipse(box(300, 700, 725, 785), fill=hx("#4cc9f0", 130))


def trophy_tower(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse(box(290, 180, 735, 590), fill=hx("#ffbe0b"), outline=darker("#f77f00"), width=p(18))
    draw.rectangle(box(390, 180, 635, 520), fill=hx("#ffbe0b"))
    draw.arc(box(170, 240, 390, 545), 270, 90, fill=darker("#f77f00"), width=p(34))
    draw.arc(box(635, 240, 855, 545), 90, 270, fill=darker("#f77f00"), width=p(34))
    draw.rectangle(box(455, 570, 570, 745), fill=hx("#f77f00"))
    draw.rounded_rectangle(box(325, 735, 700, 845), radius=p(35), fill=hx("#4361ee"), outline=darker("#4361ee"), width=p(12))
    draw.rounded_rectangle(box(250, 835, 775, 925), radius=p(34), fill=hx("#ffbe0b"), outline=darker("#f77f00"), width=p(12))
    draw_soft_highlight(draw, (375, 235, 500, 355))


DRAWERS: dict[str, Callable[[ImageDraw.ImageDraw], None]] = {
    "star-medal": star_medal,
    "strawberry": strawberry,
    "rocket": rocket,
    "paint-palette": paint_palette,
    "ice-cream": ice_cream,
    "suitcase": suitcase,
    "camera": camera,
    "cupcake": cupcake,
    "kite": kite,
    "gift-box": gift_box,
    "sunflower": sunflower,
    "robot-head": robot_head,
    "hot-air-balloon": hot_air_balloon,
    "teapot": teapot,
    "compass": compass,
    "skateboard": skateboard,
    "castle": castle,
    "pineapple": pineapple,
    "lighthouse": lighthouse,
    "umbrella": umbrella,
    "train-front": train_front,
    "potion-bottle": potion_bottle,
    "music-note": music_note,
    "paper-lantern": paper_lantern,
    "astronaut-helmet": astronaut_helmet,
    "treasure-chest": treasure_chest,
    "crown": crown,
    "mountain-cabin": mountain_cabin,
    "fireworks-badge": fireworks_badge,
    "trophy-tower": trophy_tower,
}


def render_level_asset(level: LevelAsset) -> None:
    img = new_canvas()
    draw = ImageDraw.Draw(img, "RGBA")
    DRAWERS[level.slug](draw)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=105, threshold=3))
    filename = f"level-{level.no:03d}-{level.slug}.png"
    save_asset(img, level, filename)


def icon_base(color: str) -> Image.Image:
    img = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse((42, 42, 470, 470), fill=hx(color), outline=darker(color), width=12)
    draw.ellipse((120, 95, 250, 175), fill=(255, 255, 255, 80))
    return img


def save_icon(name: str, drawer: Callable[[ImageDraw.ImageDraw], None], base="#4cc9f0") -> None:
    img = icon_base(base)
    draw = ImageDraw.Draw(img, "RGBA")
    drawer(draw)
    img.save(UI_DIR / f"icon-{name}.png")


def make_icons() -> None:
    save_icon("energy", lambda d: (
        d.polygon([(255, 78), (135, 270), (245, 270), (198, 435), (378, 215), (268, 215)], fill=hx("#fff3b0"), outline=hx("#ffffff")),
    ), "#ff7a59")
    save_icon("hint", lambda d: (
        d.ellipse((170, 105, 342, 278), fill=hx("#fff3b0"), outline=hx("#ffffff"), width=10),
        d.rounded_rectangle((220, 275, 292, 365), radius=18, fill=hx("#fff3b0")),
        d.rectangle((210, 375, 302, 405), fill=hx("#ffffff")),
    ), "#6c63ff")
    save_icon("bomb", lambda d: (
        d.ellipse((150, 170, 350, 370), fill=hx("#3a3d4d"), outline=hx("#ffffff"), width=9),
        d.line((300, 170, 360, 100), fill=hx("#ffffff"), width=16),
        d.ellipse((345, 78, 405, 138), fill=hx("#ffbe0b")),
    ), "#fb5607")
    save_icon("magnet", lambda d: (
        d.arc((135, 110, 375, 390), 35, 325, fill=hx("#ffffff"), width=58),
        d.rectangle((125, 280, 195, 360), fill=hx("#ef476f")),
        d.rectangle((315, 280, 385, 360), fill=hx("#ef476f")),
    ), "#118ab2")
    save_icon("hammer", lambda d: (
        d.line((175, 350, 335, 190), fill=hx("#8d5524"), width=42),
        d.rounded_rectangle((220, 110, 395, 205), radius=24, fill=hx("#f7f7f7"), outline=hx("#ffffff"), width=8),
    ), "#8338ec")
    save_icon("freeze", lambda d: (
        d.line((256, 118, 256, 394), fill=hx("#ffffff"), width=22),
        d.line((136, 188, 376, 324), fill=hx("#ffffff"), width=22),
        d.line((376, 188, 136, 324), fill=hx("#ffffff"), width=22),
        d.ellipse((225, 225, 287, 287), fill=hx("#8ecae6")),
    ), "#00b4d8")
    save_icon("ad", lambda d: (
        d.rounded_rectangle((130, 160, 382, 335), radius=38, fill=hx("#ffffff")),
        d.polygon([(240, 205), (240, 292), (315, 248)], fill=hx("#3a86ff")),
    ), "#43aa8b")
    save_icon("coin", lambda d: (
        d.ellipse((145, 125, 367, 347), fill=hx("#ffbe0b"), outline=hx("#ffffff"), width=10),
        d.ellipse((198, 178, 314, 294), outline=hx("#f77f00"), width=16),
    ), "#f77f00")
    save_icon("moves", lambda d: (
        d.arc((150, 145, 360, 360), 20, 330, fill=hx("#ffffff"), width=30),
        d.polygon([(360, 150), (365, 250), (285, 205)], fill=hx("#ffffff")),
    ), "#3a86ff")


def osc(freq: float, duration: float, sr: int, amp: float = 0.5, kind: str = "sine") -> list[float]:
    samples = int(duration * sr)
    out = []
    for i in range(samples):
        t = i / sr
        env = min(1.0, i / max(1, int(sr * 0.01))) * min(1.0, (samples - i) / max(1, int(sr * 0.03)))
        if kind == "square":
            v = 1.0 if math.sin(math.tau * freq * t) >= 0 else -1.0
        else:
            v = math.sin(math.tau * freq * t)
        out.append(v * amp * env)
    return out


def chirp(f0: float, f1: float, duration: float, sr: int, amp: float = 0.5) -> list[float]:
    samples = int(duration * sr)
    out = []
    phase = 0.0
    for i in range(samples):
        k = i / max(1, samples - 1)
        freq = f0 + (f1 - f0) * k
        phase += math.tau * freq / sr
        env = min(1.0, i / max(1, int(sr * 0.015))) * min(1.0, (samples - i) / max(1, int(sr * 0.04)))
        out.append(math.sin(phase) * amp * env)
    return out


def noise(duration: float, sr: int, amp: float = 0.25, seed: int = 1) -> list[float]:
    samples = int(duration * sr)
    x = seed
    out = []
    for i in range(samples):
        x = (1103515245 * x + 12345) & 0x7FFFFFFF
        v = (x / 0x7FFFFFFF) * 2 - 1
        env = min(1.0, i / max(1, int(sr * 0.005))) * min(1.0, (samples - i) / max(1, int(sr * 0.08)))
        out.append(v * amp * env)
    return out


def mix(*tracks: list[float]) -> list[float]:
    length = max(len(t) for t in tracks)
    out = [0.0] * length
    for track in tracks:
        for i, v in enumerate(track):
            out[i] += v
    peak = max(0.001, max(abs(v) for v in out))
    if peak > 0.95:
        out = [v * 0.95 / peak for v in out]
    return out


def concat(*tracks: list[float], gap: float = 0.0, sr: int = 44100) -> list[float]:
    silence = [0.0] * int(gap * sr)
    out = []
    for idx, track in enumerate(tracks):
        if idx:
            out.extend(silence)
        out.extend(track)
    return out


def delay(track: list[float], seconds: float, sr: int = 44100) -> list[float]:
    return [0.0] * int(seconds * sr) + track


def write_wav(path: Path, samples: list[float], sr: int = 44100) -> None:
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        data = bytearray()
        for sample in samples:
            sample = max(-1.0, min(1.0, sample))
            data.extend(struct.pack("<h", int(sample * 32767)))
        wf.writeframes(bytes(data))


def make_sfx() -> None:
    sr = 44100
    effects: dict[str, list[float]] = {
        "tap": mix(chirp(620, 920, 0.08, sr, 0.36), osc(1240, 0.04, sr, 0.12)),
        "button": mix(chirp(520, 760, 0.055, sr, 0.28), osc(1040, 0.035, sr, 0.08)),
        "arrow-fly": mix(chirp(460, 1120, 0.28, sr, 0.25), noise(0.22, sr, 0.09, 7)),
        "invalid": concat(osc(220, 0.09, sr, 0.34), osc(155, 0.12, sr, 0.28), gap=0.015, sr=sr),
        "hint": mix(osc(880, 0.28, sr, 0.28), osc(1320, 0.18, sr, 0.15), delay(osc(1760, 0.13, sr, 0.12), 0.07, sr)),
        "weak-hint": mix(osc(740, 0.16, sr, 0.14), delay(osc(980, 0.13, sr, 0.09), 0.045, sr)),
        "bomb": mix(chirp(150, 58, 0.42, sr, 0.55), noise(0.28, sr, 0.28, 13)),
        "magnet": mix(chirp(520, 360, 0.16, sr, 0.22), chirp(360, 740, 0.22, sr, 0.26), delay(chirp(740, 520, 0.16, sr, 0.18), 0.12, sr)),
        "hammer": mix(noise(0.08, sr, 0.24, 31), chirp(130, 80, 0.22, sr, 0.48), delay(osc(850, 0.035, sr, 0.18), 0.01, sr)),
        "freeze": mix(chirp(1300, 620, 0.45, sr, 0.22), osc(1860, 0.18, sr, 0.08), delay(osc(2400, 0.12, sr, 0.06), 0.08, sr)),
        "unlock": concat(osc(660, 0.08, sr, 0.25), osc(880, 0.08, sr, 0.25), osc(1180, 0.14, sr, 0.22), gap=0.018, sr=sr),
        "reveal": concat(osc(523.25, 0.09, sr, 0.22), osc(659.25, 0.09, sr, 0.22), osc(783.99, 0.12, sr, 0.24), osc(1046.5, 0.22, sr, 0.22), gap=0.02, sr=sr),
        "win": concat(
            mix(osc(523.25, 0.16, sr, 0.20), osc(659.25, 0.16, sr, 0.16)),
            mix(osc(659.25, 0.16, sr, 0.20), osc(783.99, 0.16, sr, 0.16)),
            mix(osc(783.99, 0.28, sr, 0.22), osc(1046.5, 0.28, sr, 0.14)),
            gap=0.035,
            sr=sr,
        ),
        "energy-restore": concat(osc(392, 0.08, sr, 0.19), osc(523.25, 0.08, sr, 0.22), osc(783.99, 0.16, sr, 0.18), gap=0.02, sr=sr),
        "ad-reward": concat(osc(660, 0.08, sr, 0.18), osc(880, 0.08, sr, 0.18), osc(1320, 0.12, sr, 0.18), osc(1760, 0.18, sr, 0.14), gap=0.018, sr=sr),
        "level-start": mix(chirp(330, 660, 0.36, sr, 0.18), delay(osc(990, 0.14, sr, 0.09), 0.18, sr)),
    }
    for name, samples in effects.items():
        write_wav(SFX_DIR / f"{name}.wav", samples, sr)


def make_manifest() -> None:
    data = {
        "designSize": {"width": 750, "height": 1334},
        "levels": [
            {
                "levelNo": level.no,
                "id": level.asset_id,
                "title": level.title,
                "subject": level.subject,
                "maskImage": f"assets/levels/masks/level-{level.no:03d}-{level.slug}-mask.png",
                "revealImage": f"assets/levels/reveal/level-{level.no:03d}-{level.slug}.png",
                "thumbnail": f"assets/levels/thumbs/level-{level.no:03d}-{level.slug}-thumb.png",
                "palette": list(level.palette),
            }
            for level in LEVELS
        ],
        "ui": {
            name: f"assets/ui/icon-{name}.png"
            for name in ["energy", "hint", "bomb", "magnet", "hammer", "freeze", "ad", "coin", "moves"]
        },
        "sfx": {
            name: f"assets/audio/sfx/{name}.wav"
            for name in [
                "tap",
                "button",
                "arrow-fly",
                "invalid",
                "hint",
                "weak-hint",
                "bomb",
                "magnet",
                "hammer",
                "freeze",
                "unlock",
                "reveal",
                "win",
                "energy-restore",
                "ad-reward",
                "level-start",
            ]
        },
    }
    (OUT / "asset-manifest.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
    make_preview_html(data)
    (OUT / "README.md").write_text(
        "\n".join(
            [
                "# Generated Game Assets",
                "",
                "Original placeholder-production assets for the 750x1334 Canvas tap-gallery game.",
                "",
                "## Contents",
                "",
                "- `assets/levels/masks`: 30 transparent 1024x1024 simplified mask/config PNGs.",
                "- `assets/levels/reveal`: 30 transparent 1024x1024 final reveal PNGs.",
                "- `assets/levels/thumbs`: 30 transparent 256x256 thumbnails generated from reveal art.",
                "- `assets/ui`: UI and booster icons.",
                "- `assets/audio/sfx`: mono WAV sound effects.",
                "- `asset-manifest.json`: paths for game integration.",
                "",
                "These assets are generated for this project and do not use the original Tap Gallery artwork.",
            ]
        ),
        encoding="utf-8",
    )


def make_preview_html(data: dict) -> None:
    levels_html = "\n".join(
        f"""
        <article class="card">
          <img src="{level['thumbnail']}" alt="{level['title']}">
          <div class="title">{level['levelNo']:02d}. {level['title']}</div>
          <div class="path">{level['revealImage']}</div>
        </article>
        """
        for level in data["levels"]
    )
    ui_html = "\n".join(
        f"""
        <article class="icon-card">
          <img src="{path}" alt="{name}">
          <div class="title">{name}</div>
        </article>
        """
        for name, path in data["ui"].items()
    )
    sfx_html = "\n".join(
        f"""
        <article class="sound-card">
          <div>
            <div class="title">{name}</div>
            <div class="path">{path}</div>
          </div>
          <audio controls preload="none" src="{path}"></audio>
        </article>
        """
        for name, path in data["sfx"].items()
    )
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Generated Game Assets Preview</title>
  <style>
    :root {{
      color: #1f2933;
      background: #f4f6fb;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    body {{ margin: 0; padding: 28px; }}
    h1, h2 {{ margin: 0 0 16px; }}
    section {{ margin: 0 0 34px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }}
    .icon-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 16px; }}
    .card, .icon-card, .sound-card {{
      background: white;
      border: 1px solid #e3e8f2;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(34, 49, 80, 0.06);
    }}
    .card, .icon-card {{ padding: 14px; }}
    .card img {{ width: 100%; aspect-ratio: 1; object-fit: contain; display: block; }}
    .icon-card img {{ width: 96px; height: 96px; object-fit: contain; display: block; margin: 4px auto 12px; }}
    .title {{ font-size: 13px; font-weight: 700; margin-top: 8px; }}
    .path {{ font-size: 11px; color: #667085; overflow-wrap: anywhere; margin-top: 4px; }}
    .sound-list {{ display: grid; gap: 12px; }}
    .sound-card {{ padding: 14px; display: grid; grid-template-columns: minmax(180px, 1fr) minmax(240px, 360px); gap: 16px; align-items: center; }}
    audio {{ width: 100%; }}
    @media (max-width: 700px) {{
      body {{ padding: 16px; }}
      .sound-card {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <h1>Generated Game Assets Preview</h1>
  <section>
    <h2>Level Reveal Images</h2>
    <div class="grid">{levels_html}</div>
  </section>
  <section>
    <h2>UI Icons</h2>
    <div class="icon-grid">{ui_html}</div>
  </section>
  <section>
    <h2>Sound Effects</h2>
    <div class="sound-list">{sfx_html}</div>
  </section>
</body>
</html>
"""
    (OUT / "asset-preview.html").write_text(html, encoding="utf-8")


def make_previews() -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()

    cell_w, cell_h = 220, 250
    preview_size = 168
    cols = 5
    rows = math.ceil(len(LEVELS) / cols)
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), hx("#f6f7fb"))
    draw = ImageDraw.Draw(sheet, "RGBA")
    for idx, level in enumerate(LEVELS):
        col = idx % cols
        row = idx // cols
        x = col * cell_w
        y = row * cell_h
        draw.rounded_rectangle((x + 10, y + 10, x + cell_w - 10, y + cell_h - 10), radius=18, fill=(255, 255, 255, 255))
        img = Image.open(THUMB_DIR / f"level-{level.no:03d}-{level.slug}-thumb.png").convert("RGBA")
        img = img.resize((preview_size, preview_size), Image.Resampling.LANCZOS)
        sheet.alpha_composite(img, (x + (cell_w - preview_size) // 2, y + 24))
        label = f"{level.no:02d} {level.title}"
        draw.text((x + 22, y + 205), label, fill=hx("#293241"), font=font)
    sheet.save(PREVIEW_DIR / "levels-contact-sheet.png")

    icons = sorted(UI_DIR.glob("icon-*.png"))
    icon_cell = 150
    icon_sheet = Image.new("RGBA", (3 * icon_cell, math.ceil(len(icons) / 3) * 185), hx("#f6f7fb"))
    icon_draw = ImageDraw.Draw(icon_sheet, "RGBA")
    for idx, path in enumerate(icons):
        col = idx % 3
        row = idx // 3
        x = col * icon_cell
        y = row * 185
        icon_draw.rounded_rectangle((x + 10, y + 10, x + icon_cell - 10, y + 175), radius=18, fill=(255, 255, 255, 255))
        icon = Image.open(path).convert("RGBA").resize((96, 96), Image.Resampling.LANCZOS)
        icon_sheet.alpha_composite(icon, (x + 27, y + 24))
        icon_draw.text((x + 20, y + 132), path.stem.replace("icon-", ""), fill=hx("#293241"), font=font)
    icon_sheet.save(PREVIEW_DIR / "ui-icons-contact-sheet.png")


def main() -> None:
    for directory in [MASK_DIR, REVEAL_DIR, THUMB_DIR, UI_DIR, SFX_DIR, PREVIEW_DIR]:
        directory.mkdir(parents=True, exist_ok=True)
    for level in LEVELS:
        render_level_asset(level)
    make_icons()
    make_sfx()
    make_manifest()
    make_previews()
    print(f"Generated {len(LEVELS)} level images, {len(LEVELS)} thumbnails, UI icons, and SFX in {OUT}")


if __name__ == "__main__":
    main()
