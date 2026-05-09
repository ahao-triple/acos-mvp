from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "tap-gallery-analysis" / "pydeps"))

from PIL import Image


def remove_checker_background(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    pixels = image.load()

    def is_background_like(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return max(r, g, b) - min(r, g, b) <= 10 and min(r, g, b) >= 205

    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        for y in (0, height - 1):
            if is_background_like(x, y):
                idx = y * width + x
                seen[idx] = 1
                queue.append((x, y))

    for y in range(height):
        for x in (0, width - 1):
            if is_background_like(x, y):
                idx = y * width + x
                seen[idx] = 1
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height:
                idx = ny * width + nx
                if not seen[idx] and is_background_like(nx, ny):
                    seen[idx] = 1
                    queue.append((nx, ny))

    for y in range(height):
        for x in range(width):
            if seen[y * width + x]:
                pixels[x, y] = (0, 0, 0, 0)

    bbox = image.getchannel("A").getbbox()
    if not bbox:
        image.resize((1024, 1024), Image.Resampling.LANCZOS).save(path)
        return

    cropped = image.crop(bbox)
    scale = 900 / max(cropped.size)
    resized = cropped.resize(
        (int(cropped.width * scale), int(cropped.height * scale)),
        Image.Resampling.LANCZOS,
    )
    output = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    output.alpha_composite(resized, ((1024 - resized.width) // 2, (1024 - resized.height) // 2))
    output.save(path)


def make_thumbnail(src: Path, dst: Path) -> None:
    Image.open(src).convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS).save(dst)


def main() -> None:
    base = Path("generated-game-assets/assets/levels")
    names = [
        "level-001-star-medal",
        "level-002-strawberry",
        "level-003-rocket",
    ]
    for name in names:
        reveal = base / "reveal" / f"{name}.png"
        thumb = base / "thumbs" / f"{name}-thumb.png"
        remove_checker_background(reveal)
        make_thumbnail(reveal, thumb)


if __name__ == "__main__":
    main()
