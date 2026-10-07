"""Deterministically remove known contact-sheet spillover from OOTIE demo media.

The coordinates were visually audited per asset. Re-running is safe: already-cropped
files are skipped. This script does not generate or fetch any new imagery.
"""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]

GARMENT_BOTTOM = {
    16: 186, 17: 187, 18: 187,
    **{index: 166 for index in range(25, 40)},
}

OOTD_BOTTOM = {index: 343 for index in range(1, 16)}


def crop_group(group: str, bounds: dict[int, int]) -> int:
    changed = 0
    for index, bottom in bounds.items():
        path = ROOT / "public" / "demo" / group / f"{index:02d}.webp"
        with Image.open(path) as image:
            if image.height <= bottom:
                continue
            cleaned = image.convert("RGB").crop((0, 0, image.width, bottom))
            cleaned.save(path, "WEBP", quality=94, method=6)
            changed += 1
    return changed


def optimize_extension_mockup() -> tuple[int, int]:
    source = ROOT / "public" / "assets" / "extension-mockup.png"
    target = ROOT / "public" / "assets" / "extension-mockup.webp"
    if not source.exists():
        return (0, target.stat().st_size if target.exists() else 0)

    original_size = source.stat().st_size
    with Image.open(source) as image:
        image.convert("RGB").save(target, "WEBP", quality=84, method=6)
    return (original_size, target.stat().st_size)


if __name__ == "__main__":
    garment_count = crop_group("garments", GARMENT_BOTTOM)
    ootd_count = crop_group("ootd", OOTD_BOTTOM)
    original_bytes, optimized_bytes = optimize_extension_mockup()
    print(f"garments repaired: {garment_count}")
    print(f"ootd repaired: {ootd_count}")
    print(f"extension mockup: {original_bytes} -> {optimized_bytes} bytes")
