from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageFile, ImageFilter, ImageOps


ImageFile.LOAD_TRUNCATED_IMAGES = True


ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "assets" / "product-images"
MAX_LONG_EDGE = 1200
LARGE_FILE_BYTES = 180_000
LOW_RES_LONG_EDGE = 480
LOW_RES_TARGET_EDGE = 720


def encode_jpeg(image: Image.Image, quality: int) -> bytes:
    output = BytesIO()
    image.save(
        output,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=True,
        subsampling="4:2:0",
    )
    return output.getvalue()


def resized(image: Image.Image, target_edge: int) -> Image.Image:
    width, height = image.size
    scale = target_edge / max(width, height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def optimize(path: Path) -> tuple[int, int, tuple[int, int], tuple[int, int]] | None:
    before = path.stat().st_size
    with Image.open(path) as source:
        already_progressive = bool(source.info.get("progressive") or source.info.get("progression"))
        source = ImageOps.exif_transpose(source).convert("RGB")
        original_size = source.size
        longest_edge = max(source.size)

        if longest_edge < LOW_RES_LONG_EDGE:
            # Traditional resampling improves browser presentation without inventing product details.
            output_image = resized(source, LOW_RES_TARGET_EDGE).filter(
                ImageFilter.UnsharpMask(radius=1.2, percent=115, threshold=3)
            )
            quality = 90
        elif longest_edge > MAX_LONG_EDGE or (before > LARGE_FILE_BYTES and not already_progressive):
            output_image = resized(source, min(longest_edge, MAX_LONG_EDGE))
            quality = 82
        else:
            return None

        data = encode_jpeg(output_image, quality)
        path.write_bytes(data)
        return before, len(data), original_size, output_image.size


def main() -> None:
    changed = []
    for path in sorted(IMAGE_ROOT.rglob("*.jpg")):
        result = optimize(path)
        if result:
            changed.append((path.relative_to(ROOT), *result))

    before_total = sum(item[1] for item in changed)
    after_total = sum(item[2] for item in changed)
    print(f"optimized={len(changed)}")
    print(f"bytes_before={before_total}")
    print(f"bytes_after={after_total}")
    print(f"saved={before_total - after_total}")
    for path, before, after, old_size, new_size in changed:
        print(f"{path}: {old_size}->{new_size}, {before}->{after}")


if __name__ == "__main__":
    main()
