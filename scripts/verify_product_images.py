from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def load_product_questions():
    for path in (ROOT / "outputs" / "product_quiz").glob("*.json"):
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
        if isinstance(payload, list):
            return payload
    raise RuntimeError("product question JSON not found")


def main() -> None:
    questions = load_product_questions()
    image_paths = sorted(
        {
            value
            for question in questions
            for value in (
                question.get("questionImage"),
                question.get("optionAImage"),
                question.get("optionBImage"),
                question.get("optionCImage"),
                question.get("optionDImage"),
            )
            if value
        }
    )

    errors = []
    for relative_path in image_paths:
        path = ROOT / relative_path
        if not path.exists():
            errors.append(f"missing image: {relative_path}")
            continue
        try:
            with Image.open(path) as image:
                image.load()
                width, height = image.size
                if max(width, height) < 560:
                    errors.append(f"image too small: {relative_path} ({width}x{height})")
        except Exception as error:
            errors.append(f"invalid image: {relative_path}: {error}")

    if errors:
        raise SystemExit("\n".join(errors))
    print(json.dumps({"ok": True, "activeImages": len(image_paths), "errors": []}, ensure_ascii=False))


if __name__ == "__main__":
    main()
