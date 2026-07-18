import hashlib
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "assets" / "product-images" / "daily"
EXPECTED_HASHES = {
    "1921.jpg": "e195faa49920770a5123ea5b6af8fd507e76ef409a7a57ee02e425f988ac2218",
    "2577.jpg": "fa095f45242b1687d15568f1d5705561463741a1df0b8abc7e9cb2478daf2fce",
    "2608.jpg": "5a82afb2697afb5e75c88e3c7f4ae325537dc2638e588c63db2291715848fcd6",
}


def test_requested_product_images_are_exact_replacements():
    for name, expected_hash in EXPECTED_HASHES.items():
        path = IMAGE_DIR / name
        assert path.exists(), name
        assert hashlib.sha256(path.read_bytes()).hexdigest() == expected_hash, name


def test_requested_product_images_remain_full_resolution():
    for name in EXPECTED_HASHES:
        with Image.open(IMAGE_DIR / name) as image:
            assert image.size == (1440, 1440), name
            assert image.mode == "RGB", name

