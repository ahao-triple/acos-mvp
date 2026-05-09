from __future__ import annotations

import json
import math
import sys
from collections import deque
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent / "tap-gallery-analysis" / "pydeps"))

from PIL import Image, ImageDraw, ImageFilter

from generate_game_assets import (
    LEVELS,
    MASK_DIR,
    OUT,
    PREVIEW_DIR,
    REVEAL_DIR,
    THUMB_DIR,
    make_preview_html,
    make_previews,
)


SOURCE_DIR = Path("/Users/apple/.codex/generated_images/019e0a6e-004a-7580-9f3a-81a32582b8b1")
CONFIG_DIR = OUT / "level-configs"
SIZE = 1024
THUMB = 256

IMAGEGEN_SOURCE_BY_SLUG = {
    "star-medal": "ig_01a85e89cd76e8490169fea3d521d881918ee6b35f4fa16abc.png",
    "strawberry": "ig_01a85e89cd76e8490169fea4438c108191b9f216ee525264d9.png",
    "rocket": "ig_01a85e89cd76e8490169fea4721dbc819198060e5c7156cc39.png",
    "paint-palette": "ig_01a85e89cd76e8490169fea896cb188191962c894b77d69676.png",
    "ice-cream": "ig_01a85e89cd76e8490169fea8f409a48191a362c9f5b46d1471.png",
    "suitcase": "ig_01a85e89cd76e8490169fea945b180819186114ee5d78cb989.png",
    "camera": "ig_01a85e89cd76e8490169fea9b0f1848191a25856b9141fc808.png",
    "cupcake": "ig_01a85e89cd76e8490169feaa1594ec819190968b6ac4c0f23b.png",
    "kite": "ig_01a85e89cd76e8490169feaa78ace48191a488cab5f5338289.png",
    "gift-box": "ig_01a85e89cd76e8490169feaad8d06881918c7800a904831eff.png",
    "sunflower": "ig_01a85e89cd76e8490169feab4100a88191b27d7cae296fd22a.png",
    "robot-head": "ig_01a85e89cd76e8490169feac5c696081919c0df1c7c65c1a78.png",
    "hot-air-balloon": "ig_01a85e89cd76e8490169feacbb31ac81919bae170ed4f91be4.png",
    "teapot": "ig_01a85e89cd76e8490169fead140e348191b64ce989f775da0b.png",
}

PLAY_SPECS: dict[int, dict[str, Any]] = {
    1: {"board": (6, 6), "cellsTarget": 18, "moves": 45, "mechanics": ["tutorial", "infiniteEnergy"], "introCue": "tap"},
    2: {"board": (7, 6), "cellsTarget": 26, "moves": 60, "mechanics": ["normal"], "introCue": "none"},
    3: {"board": (7, 8), "cellsTarget": 32, "moves": 70, "mechanics": ["normal", "directionConflict"], "introCue": "moves"},
    4: {"board": (8, 8), "cellsTarget": 40, "moves": 85, "mechanics": ["hintIntro"], "introCue": "hint"},
    5: {"board": (8, 9), "cellsTarget": 45, "moves": 95, "mechanics": ["wrongMoveFeedback"], "introCue": "none"},
    6: {"board": (9, 9), "cellsTarget": 52, "moves": 105, "mechanics": ["normal"], "introCue": "none"},
    7: {"board": (9, 10), "cellsTarget": 58, "moves": 115, "mechanics": ["wrongMovePenalty"], "introCue": "none"},
    8: {"board": (10, 10), "cellsTarget": 64, "moves": 125, "mechanics": ["hint"], "introCue": "none"},
    9: {"board": (10, 11), "cellsTarget": 70, "moves": 135, "mechanics": ["directionConflict"], "introCue": "none"},
    10: {"board": (10, 12), "cellsTarget": 78, "moves": 150, "mechanics": ["bombIntro"], "introCue": "bomb"},
    11: {"board": (11, 11), "cellsTarget": 76, "moves": 145, "mechanics": ["lockedAreaIntro"], "introCue": "locked"},
    12: {"board": (11, 12), "cellsTarget": 84, "moves": 160, "mechanics": ["lockedArea"], "introCue": "none"},
    13: {"board": (12, 12), "cellsTarget": 92, "moves": 175, "mechanics": ["lockedArea", "twoUnlockGroups"], "introCue": "none"},
    14: {"board": (12, 13), "cellsTarget": 100, "moves": 185, "mechanics": ["lockedArea", "hint"], "introCue": "none"},
    15: {"board": (13, 13), "cellsTarget": 108, "moves": 200, "mechanics": ["lockedArea", "goldenIntro"], "introCue": "none"},
    16: {"board": (13, 14), "cellsTarget": 116, "moves": 215, "mechanics": ["bomb", "golden"], "introCue": "none"},
    17: {"board": (14, 14), "cellsTarget": 124, "moves": 225, "mechanics": ["timerIntro"], "introCue": "timer"},
    18: {"board": (14, 15), "cellsTarget": 132, "moves": 240, "mechanics": ["bomb", "timer"], "introCue": "none"},
    19: {"board": (15, 15), "cellsTarget": 142, "moves": 255, "mechanics": ["magnetIntro", "timer"], "introCue": "none"},
    20: {"board": (15, 16), "cellsTarget": 152, "moves": 270, "mechanics": ["freezeIntro", "timer"], "introCue": "none"},
    21: {"board": (16, 16), "cellsTarget": 164, "moves": 285, "mechanics": ["secretIntro"], "introCue": "secret"},
    22: {"board": (16, 17), "cellsTarget": 176, "moves": 300, "mechanics": ["secret", "hint"], "introCue": "none"},
    23: {"board": (17, 17), "cellsTarget": 186, "moves": 315, "mechanics": ["hammerIntro", "secret"], "introCue": "none"},
    24: {"board": (17, 18), "cellsTarget": 198, "moves": 330, "mechanics": ["lockedArea", "secret"], "introCue": "none"},
    25: {"board": (18, 18), "cellsTarget": 210, "moves": 350, "mechanics": ["timer", "freeze", "secret"], "introCue": "none"},
    26: {"board": (18, 19), "cellsTarget": 224, "moves": 365, "mechanics": ["bomb", "magnet", "hammer"], "introCue": "none"},
    27: {"board": (19, 19), "cellsTarget": 238, "moves": 380, "mechanics": ["multiLockedArea", "golden", "secret"], "introCue": "none"},
    28: {"board": (19, 20), "cellsTarget": 250, "moves": 400, "mechanics": ["timer", "lockedArea", "golden"], "introCue": "none"},
    29: {"board": (20, 20), "cellsTarget": 265, "moves": 420, "mechanics": ["secret", "timer", "bomb", "freeze"], "introCue": "none"},
    30: {"board": (21, 21), "cellsTarget": 280, "moves": 450, "mechanics": ["finalMix", "lockedArea", "secret", "timer", "allBoosters"], "introCue": "none"},
}


def is_checker_background(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a < 16:
        return True
    return max(r, g, b) - min(r, g, b) <= 18 and min(r, g, b) >= 198


def flood_clear_edge_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        idx = y * width + x
        if not seen[idx] and is_checker_background(pixels[x, y]):
            seen[idx] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height:
                enqueue(nx, ny)

    for y in range(height):
        for x in range(width):
            if seen[y * width + x]:
                pixels[x, y] = (0, 0, 0, 0)

    return rgba


def clear_paint_palette_hole(image: Image.Image) -> Image.Image:
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)

    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if seen[idx] or not is_checker_background(pixels[x, y]):
                continue
            queue = deque([(x, y)])
            seen[idx] = 1
            component: list[tuple[int, int]] = []
            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < width and 0 <= ny < height:
                        nidx = ny * width + nx
                        if not seen[nidx] and is_checker_background(pixels[nx, ny]):
                            seen[nidx] = 1
                            queue.append((nx, ny))
            if len(component) < 900:
                continue
            avg_x = sum(px for px, _ in component) / len(component)
            avg_y = sum(py for _, py in component) / len(component)
            if avg_x > width * 0.52 and height * 0.22 < avg_y < height * 0.56:
                for px, py in component:
                    pixels[px, py] = (0, 0, 0, 0)

    return image


def fit_to_canvas(image: Image.Image, target_fill: int = 900) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cropped = image.crop(bbox)
    scale = target_fill / max(cropped.size)
    resized = cropped.resize((round(cropped.width * scale), round(cropped.height * scale)), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(resized, ((SIZE - resized.width) // 2, (SIZE - resized.height) // 2))
    return out


def normalize_imagegen_source(path: Path, slug: str) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    image = flood_clear_edge_background(image)
    if slug == "paint-palette":
        image = clear_paint_palette_hole(image)
    image = fit_to_canvas(image)
    return image.filter(ImageFilter.UnsharpMask(radius=1.0, percent=110, threshold=2))


def make_mask_from_reveal(reveal: Image.Image) -> Image.Image:
    rgba = reveal.convert("RGBA")
    alpha = rgba.getchannel("A")
    solid_alpha = alpha.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.2))
    solid_alpha = solid_alpha.point(lambda a: 255 if a > 18 else 0)

    block = rgba.resize((80, 80), Image.Resampling.BILINEAR).resize((SIZE, SIZE), Image.Resampling.NEAREST)
    block = block.filter(ImageFilter.SMOOTH_MORE)
    block.putalpha(solid_alpha)

    edge_alpha = solid_alpha.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    outline = Image.new("RGBA", (SIZE, SIZE), (42, 54, 78, 0))
    outline.putalpha(edge_alpha.point(lambda a: min(96, a)))

    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(block)
    out.alpha_composite(outline)
    return out


def outward_direction(col: int, row: int, width: int, height: int) -> int:
    cx = (width - 1) / 2
    cy = (height - 1) / 2
    dx = col - cx
    dy = row - cy
    if abs(dx) > abs(dy):
        return 3 if dx < 0 else 1
    return 0 if dy < 0 else 2


def choose_cells(alpha: Image.Image, width: int, height: int, target: int) -> list[dict[str, Any]]:
    sampled = alpha.resize((width, height), Image.Resampling.BOX)
    ranked: list[tuple[float, int, int, int]] = []
    cx = (width - 1) / 2
    cy = (height - 1) / 2
    max_dist = math.hypot(cx + 1, cy + 1)
    for row in range(height):
        for col in range(width):
            coverage = sampled.getpixel((col, row)) / 255
            dist = math.hypot(col - cx, row - cy)
            center_bonus = 1 - dist / max_dist
            score = coverage + center_bonus * 0.06
            ranked.append((score, row * width + col, col, row))

    ranked.sort(reverse=True)
    selected = sorted(ranked[: min(target, width * height)], key=lambda item: item[1])
    cells: list[dict[str, Any]] = []
    for _, index, col, row in selected:
        cells.append({"index": index, "direction": outward_direction(col, row, width, height)})
    return cells


def add_special_cells(cells: list[dict[str, Any]], width: int, height: int, mechanics: list[str]) -> None:
    by_index = {cell["index"]: cell for cell in cells}

    def ordered_by_center() -> list[dict[str, Any]]:
        cx = (width - 1) / 2
        cy = (height - 1) / 2
        return sorted(cells, key=lambda cell: math.hypot(cell["index"] % width - cx, cell["index"] // width - cy))

    def ordered_by_bottom_right() -> list[dict[str, Any]]:
        return sorted(cells, key=lambda cell: ((cell["index"] // width) + (cell["index"] % width)), reverse=True)

    locked_keys = {"lockedAreaIntro", "lockedArea", "multiLockedArea", "finalMix"}
    if any(key in mechanics for key in locked_keys):
        locked_count = min(max(8, len(cells) // 5), 34)
        groups = 2 if "twoUnlockGroups" in mechanics or "multiLockedArea" in mechanics else 1
        for pos, cell in enumerate(ordered_by_bottom_right()[:locked_count]):
            cell["kind"] = "locked"
            cell["unlockGroup"] = 1 + (pos % groups)

    if "goldenIntro" in mechanics or "golden" in mechanics:
        for cell in ordered_by_center()[: max(2, len(cells) // 24)]:
            if cell.get("kind") is None:
                cell["kind"] = "golden"

    if "timerIntro" in mechanics or "timer" in mechanics:
        for cell in ordered_by_center()[:: max(4, len(cells) // 5)][: max(2, len(cells) // 28)]:
            if cell.get("kind") is None:
                cell["kind"] = "timer"

    if "bombIntro" in mechanics or "bomb" in mechanics or "finalMix" in mechanics:
        for cell in ordered_by_center()[1: 1 + max(1, len(cells) // 60)]:
            if cell.get("kind") is None:
                cell["kind"] = "bomb"

    if "secretIntro" in mechanics or "secret" in mechanics or "finalMix" in mechanics:
        secret_count = max(4, len(cells) // 9)
        stride = max(2, len(cells) // secret_count)
        for cell in cells[::stride][:secret_count]:
            if by_index[cell["index"]].get("kind") is None:
                cell["kind"] = "secret"


def first_tap_index(cells: list[dict[str, Any]], width: int, height: int) -> int | None:
    if not cells:
        return None

    def edge_distance(cell: dict[str, Any]) -> tuple[int, int]:
        row = cell["index"] // width
        col = cell["index"] % width
        return min(row, col, height - 1 - row, width - 1 - col), cell["index"]

    return min(cells, key=edge_distance)["index"]


def idle_delay(level_no: int) -> int:
    if level_no <= 5:
        return 5000
    if level_no <= 15:
        return 8000
    return 11000


def build_level_config(level: Any, reveal: Image.Image, art_status: str, source_file: str | None) -> dict[str, Any]:
    spec = PLAY_SPECS[level.no]
    width, height = spec["board"]
    cells = choose_cells(reveal.getchannel("A"), width, height, spec["cellsTarget"])
    add_special_cells(cells, width, height, spec["mechanics"])
    first_tap = first_tap_index(cells, width, height)

    guidance: dict[str, Any] = {
        "introCue": spec["introCue"],
        "weakHintEnabled": level.no <= 15,
        "revealFocus": True,
    }
    if first_tap is not None:
        guidance["firstTapIndex"] = first_tap

    return {
        "id": level.asset_id,
        "levelNo": level.no,
        "title": level.title,
        "subject": level.subject,
        "maskImage": f"assets/levels/masks/level-{level.no:03d}-{level.slug}-mask.png",
        "revealImage": f"assets/levels/reveal/level-{level.no:03d}-{level.slug}.png",
        "thumbnail": f"assets/levels/thumbs/level-{level.no:03d}-{level.slug}-thumb.png",
        "board": {
            "width": width,
            "height": height,
            "allowPan": level.no >= 6,
            "allowZoom": level.no >= 11,
            "initialZoom": 1,
        },
        "moves": spec["moves"],
        "cellsTarget": spec["cellsTarget"],
        "mechanics": spec["mechanics"],
        "idleHintDelayMs": idle_delay(level.no),
        "guidance": guidance,
        "cells": cells,
        "artStatus": art_status,
        "sourceImagegenFile": source_file,
    }


def write_manifest(configs: list[dict[str, Any]]) -> dict[str, Any]:
    level_entries = []
    for level, config in zip(LEVELS, configs, strict=True):
        level_entries.append(
            {
                "levelNo": level.no,
                "id": level.asset_id,
                "title": level.title,
                "subject": level.subject,
                "maskImage": config["maskImage"],
                "revealImage": config["revealImage"],
                "thumbnail": config["thumbnail"],
                "config": f"level-configs/level-{level.no:03d}.json",
                "palette": list(level.palette),
                "artStatus": config["artStatus"],
                "sourceImagegenFile": config["sourceImagegenFile"],
            }
        )

    data = {
        "designSize": {"width": 750, "height": 1334},
        "levelConfigIndex": "level-configs/levels.json",
        "levels": level_entries,
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
    (OUT / "asset-manifest.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


def write_readme() -> None:
    lines = [
        "# Generated Game Assets",
        "",
        "Original project assets for the 750x1334 Canvas tap-gallery game.",
        "",
        "## Contents",
        "",
        "- `assets/levels/reveal`: 1024x1024 transparent final reveal PNGs.",
        "- `assets/levels/masks`: 1024x1024 mask/config PNGs derived from the current reveal art.",
        "- `assets/levels/thumbs`: 256x256 thumbnails generated from reveal art.",
        "- `level-configs`: JSON level configs with board size, moves, mechanics, guidance, and generated cells.",
        "- `assets/ui`: UI and booster icons.",
        "- `assets/audio/sfx`: mono WAV sound effects.",
        "- `asset-manifest.json`: paths and metadata for game integration.",
        "- `previews/imagegen-source-contact-sheet.png`: source-image index for the integrated imagegen batch.",
        "",
        "Levels 1-14 currently use imagegen reveal art. Levels 15-30 keep the earlier programmatic art until their high-detail reveal images are generated.",
        "The first level is now Strawberry, and Star Medal has been moved to level 2.",
    ]
    (OUT / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    for directory in [MASK_DIR, REVEAL_DIR, THUMB_DIR, CONFIG_DIR, PREVIEW_DIR]:
        directory.mkdir(parents=True, exist_ok=True)

    configs: list[dict[str, Any]] = []
    source_map: list[dict[str, Any]] = []

    for level in LEVELS:
        filename = f"level-{level.no:03d}-{level.slug}.png"
        reveal_path = REVEAL_DIR / filename
        source_name = IMAGEGEN_SOURCE_BY_SLUG.get(level.slug)

        if source_name:
            source_path = SOURCE_DIR / source_name
            if not source_path.exists():
                raise FileNotFoundError(source_path)
            reveal = normalize_imagegen_source(source_path, level.slug)
            reveal.save(reveal_path)
            art_status = "imagegen"
            source_map.append(
                {
                    "levelNo": level.no,
                    "id": level.asset_id,
                    "slug": level.slug,
                    "sourceImagegenFile": source_name,
                    "revealImage": f"assets/levels/reveal/{filename}",
                }
            )
        else:
            if not reveal_path.exists():
                raise FileNotFoundError(f"Missing existing reveal art: {reveal_path}")
            reveal = Image.open(reveal_path).convert("RGBA")
            art_status = "programmatic-placeholder"

        mask = make_mask_from_reveal(reveal)
        mask.save(MASK_DIR / filename.replace(".png", "-mask.png"))
        reveal.resize((THUMB, THUMB), Image.Resampling.LANCZOS).save(THUMB_DIR / filename.replace(".png", "-thumb.png"))

        config = build_level_config(level, reveal, art_status, source_name)
        configs.append(config)
        (CONFIG_DIR / f"level-{level.no:03d}.json").write_text(
            json.dumps(config, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    (CONFIG_DIR / "levels.json").write_text(json.dumps(configs, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "imagegen-source-map.json").write_text(json.dumps(source_map, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest = write_manifest(configs)
    make_preview_html(manifest)
    make_previews()
    write_readme()
    print(f"Integrated {len(source_map)} imagegen reveals and wrote {len(configs)} level configs into {OUT}")


if __name__ == "__main__":
    main()
