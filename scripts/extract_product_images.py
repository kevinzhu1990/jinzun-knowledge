from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(r"D:\360MoveData\Users\PC\Desktop\26年金尊产品信息表（月饼+饼干）20260709更新.xlsx")
OVERRIDE_ROOT = ROOT / "sources" / "product_images" / "overrides"
MAX_LONG_EDGE = 1200
LOW_RES_LONG_EDGE = 480
LOW_RES_TARGET_EDGE = 720
ID_PATTERN = re.compile(r"(ID_[0-9A-F]+)", re.IGNORECASE)

MAIN_NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
IMAGE_NS = {
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "etc": "http://www.wps.cn/officeDocument/2017/etCustomData",
}

SHEET_CONFIG = {
    "26年月饼礼盒": {"code_col": "C", "image_col": "I", "folder": "mooncake"},
    "26年散饼": {"code_col": "B", "image_col": "G", "folder": "mooncake"},
    "26年糕点饼干": {"code_col": "B", "image_col": "G", "folder": "daily"},
}


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.findall(".//m:t", MAIN_NS))
        for item in root.findall("m:si", MAIN_NS)
    ]


def cell_value(cell: ET.Element, strings: list[str]) -> str:
    value = cell.findtext("m:v", default="", namespaces=MAIN_NS)
    if cell.attrib.get("t") == "s" and value:
        return strings[int(value)]
    if cell.attrib.get("t") == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//m:t", MAIN_NS))
    return value


def image_id(cell: ET.Element) -> str:
    formula = cell.findtext("m:f", default="", namespaces=MAIN_NS)
    value = cell.findtext("m:v", default="", namespaces=MAIN_NS)
    match = ID_PATTERN.search(f"{formula} {value}")
    return match.group(1).upper() if match else ""


def cell_image_targets(archive: zipfile.ZipFile) -> dict[str, str]:
    images = ET.fromstring(archive.read("xl/cellimages.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/cellimages.xml.rels"))
    rel_targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
    result = {}
    for item in images.findall("etc:cellImage", IMAGE_NS):
        props = item.find(".//xdr:cNvPr", IMAGE_NS)
        blip = item.find(".//a:blip", IMAGE_NS)
        if props is None or blip is None:
            continue
        rid = blip.attrib.get(f"{{{IMAGE_NS['r']}}}embed", "")
        name = props.attrib.get("name", "").upper()
        if name and rid in rel_targets:
            result[name] = "xl/" + rel_targets[rid].lstrip("/")
    return result


def resized(image: Image.Image, target_edge: int) -> Image.Image:
    width, height = image.size
    scale = target_edge / max(width, height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def write_web_jpeg(data: bytes, destination: Path) -> tuple[tuple[int, int], tuple[int, int], int]:
    with Image.open(BytesIO(data)) as source:
        source.load()
        image = ImageOps.exif_transpose(source).convert("RGB")
        original_size = image.size
        longest = max(image.size)
        if longest < LOW_RES_LONG_EDGE:
            image = resized(image, LOW_RES_TARGET_EDGE).filter(
                ImageFilter.UnsharpMask(radius=1.0, percent=100, threshold=3)
            )
        elif longest > MAX_LONG_EDGE:
            image = resized(image, MAX_LONG_EDGE)

        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(
            destination,
            format="JPEG",
            quality=90,
            optimize=True,
            progressive=True,
            subsampling="4:2:0",
        )
        return original_size, image.size, destination.stat().st_size


def main() -> None:
    source_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not source_path.exists():
        raise SystemExit(f"Product workbook not found: {source_path}")

    written = []
    with zipfile.ZipFile(source_path) as archive:
        strings = shared_strings(archive)
        targets = cell_image_targets(archive)
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        workbook_rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        sheet_targets = {item.attrib["Id"]: item.attrib["Target"] for item in workbook_rels}

        for sheet in workbook.findall(".//m:sheet", MAIN_NS):
            sheet_name = sheet.attrib.get("name", "")
            config = SHEET_CONFIG.get(sheet_name)
            if not config:
                continue
            rid = sheet.attrib[f"{{{MAIN_NS['r']}}}id"]
            target = sheet_targets[rid]
            sheet_path = target[1:] if target.startswith("/xl/") else "xl/" + target.lstrip("/")
            sheet_root = ET.fromstring(archive.read(sheet_path))

            for row in sheet_root.findall(".//m:row", MAIN_NS)[1:]:
                cells = {re.match(r"[A-Z]+", cell.attrib.get("r", "")).group(): cell for cell in row.findall("m:c", MAIN_NS)}
                code_cell = cells.get(config["code_col"])
                image_cell = cells.get(config["image_col"])
                if code_cell is None or image_cell is None:
                    continue
                code = cell_value(code_cell, strings).strip()
                identifier = image_id(image_cell)
                media_path = targets.get(identifier)
                if not code or not media_path:
                    continue
                destination = ROOT / "assets" / "product-images" / config["folder"] / f"{code}.jpg"
                override = OVERRIDE_ROOT / config["folder"] / f"{code}.jpg"
                source_label = str(override.relative_to(ROOT)) if override.exists() else media_path
                image_data = override.read_bytes() if override.exists() else archive.read(media_path)
                original_size, output_size, byte_count = write_web_jpeg(image_data, destination)
                written.append((code, sheet_name, source_label, original_size, output_size, byte_count))

    print(f"source={source_path}")
    print(f"extracted={len(written)}")
    for code, sheet, media, original_size, output_size, byte_count in written:
        print(f"{code}\t{sheet}\t{media}\t{original_size}->{output_size}\t{byte_count}")


if __name__ == "__main__":
    main()
