from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRODUCT_JSON = ROOT / "outputs" / "product_quiz" / "金尊产品知识库题库.json"
ROLE_JSON = ROOT / "outputs" / "role_quiz" / "岗位学习考核题库.json"
LETTERS = "ABCD"


class IdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()

    def handle_starttag(self, tag, attrs):
        self.ids.update(value for name, value in attrs if name == "id" and value)


def main() -> None:
    errors = []
    product = json.loads(PRODUCT_JSON.read_text(encoding="utf-8"))
    role = json.loads(ROLE_JSON.read_text(encoding="utf-8"))
    all_questions = product + role

    ids = [str(q.get("id", "")) for q in all_questions]
    if len(ids) != len(set(ids)):
        errors.append("题目ID存在重复")

    for q in all_questions:
        if "暂无其他有效资料" in json.dumps(q, ensure_ascii=False):
            errors.append(f"{q.get('id')}仍含占位符选项")
        answer = q.get("answer", "")
        if answer not in LETTERS:
            errors.append(f"{q.get('id')} 答案字母无效")
            continue
        actual = q.get(f"option{answer}Image", "") if q.get("knowledgePoint") == "看货号选图片" else q.get(f"option{answer}", "")
        if actual != q.get("answerText", ""):
            errors.append(f"{q.get('id')} 正确选项与答案内容不一致")
        options = [q.get(f"option{x}", "") for x in LETTERS if q.get(f"option{x}", "")]
        if len(options) < 4 or len(options) != len(set(options)):
            errors.append(f"{q.get('id')} 选项无效或重复")
        for field in ("questionImage", "optionAImage", "optionBImage", "optionCImage", "optionDImage"):
            image = q.get(field, "")
            if image and not (ROOT / image).is_file():
                errors.append(f"{q.get('id')} 图片不存在：{image}")

    product_codes = {str(q.get("code")) for q in product if q.get("knowledgePoint") == "产品名称"}
    image_codes = {str(q.get("code")) for q in product if q.get("knowledgePoint") == "看图片选货号"}
    moon_codes = {str(q.get("code")) for q in product if q.get("bank") == "月饼题库"}
    moon_image_codes = {str(q.get("code")) for q in product if q.get("bank") == "月饼题库" and q.get("knowledgePoint") == "看货号选图片"}
    if product_codes != image_codes:
        errors.append("并非所有产品货号都有看图片选货号题")
    if moon_codes != moon_image_codes:
        errors.append("并非所有月饼货号都有看货号选图片题")

    answer_counts = {letter: sum(q.get("answer") == letter for q in all_questions) for letter in LETTERS}
    if max(answer_counts.values()) - min(answer_counts.values()) > 1:
        errors.append("全题库答案字母分布不均衡：" + json.dumps(answer_counts, ensure_ascii=False))

    index_text = (ROOT / "index.html").read_text(encoding="utf-8")
    app_text = (ROOT / "app.js").read_text(encoding="utf-8")
    parser = IdParser()
    parser.feed(index_text)

    version = re.search(r'const BUILD_VERSION = "([^"]+)";', app_text)
    app_version = version.group(1) if version else ""
    if not app_version:
        errors.append("app.js缺少BUILD_VERSION")
    for asset in ("app.js", "styles.css"):
        if f"{asset}?v={app_version}" not in index_text:
            errors.append(f"{asset}版本号与BUILD_VERSION不一致")

    required_ids = {
        "loginForm", "registerForm", "resetForm", "resetName", "resetRole",
        "examSubmitStatus", "retryExamSubmitBtn", "adminDataWarning",
        "adminEmployeeForm", "adminEmployeeList",
    }
    missing = sorted(required_ids - parser.ids)
    if missing:
        errors.append("页面缺少必要DOM：" + ",".join(missing))

    forbidden = ("ADMIN_PHONES", "navigator.sendBeacon", 'mode: "no-cors"', 'syncLater("exam', 'POST /api/exam')
    for needle in forbidden:
        if needle in app_text:
            errors.append(f"app.js仍存在禁止项：{needle}")

    required = (
        "exam-start", "exam-submit", "Authorization", "jz_auth_token",
        "CLOUD_TIMEOUT_MS = 60000", "PRACTICE_AUTO_NEXT_DELAY_MS",
        "FORMAL_AUTO_NEXT_DELAY_MS", "adminEmployeeForm", "adminEmployeeList",
    )
    for needle in required:
        if needle not in app_text and needle not in index_text:
            errors.append(f"缺少必要标记：{needle}")

    result = {
        "ok": not errors,
        "totalQuestions": len(all_questions),
        "productQuestions": len(product),
        "roleQuestions": len(role),
        "productCodes": len(product_codes),
        "imageProductCodes": len(image_codes),
        "mooncakeCodes": len(moon_codes),
        "mooncakeImageCodes": len(moon_image_codes),
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

