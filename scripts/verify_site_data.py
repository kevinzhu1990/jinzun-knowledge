from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PRODUCT_JSON = ROOT / "outputs" / "product_quiz" / "金尊产品知识库题库.json"
ROLE_JSON = ROOT / "outputs" / "role_quiz" / "岗位学习考核题库.json"
PRODUCT_BANKS = {"月饼题库", "日常年货题库", "业务场景题库"}
LETTERS = "ABCD"


class IdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name == "id" and value:
                self.ids.add(value)


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def main() -> None:
    errors: list[str] = []
    product_questions = json.loads(PRODUCT_JSON.read_text(encoding="utf-8"))
    role_questions = json.loads(ROLE_JSON.read_text(encoding="utf-8"))
    all_questions = product_questions + role_questions

    ids = [question.get("id", "") for question in all_questions]
    if len(ids) != len(set(ids)):
        fail("题目ID存在重复", errors)

    for question in all_questions:
        answer = question.get("answer", "")
        if answer not in LETTERS:
            fail(f"{question.get('id')} 的答案字母无效", errors)
            continue
        if question.get("knowledgePoint") == "看货号选图片":
            actual = question.get(f"option{answer}Image", "")
        else:
            actual = question.get(f"option{answer}", "")
        if actual != question.get("answerText", ""):
            fail(f"{question.get('id')} 的正确选项与答案内容不一致", errors)
        options = [question.get(f"option{letter}", "") for letter in LETTERS]
        options = [option for option in options if option]
        if len(options) < 2 or len(options) != len(set(options)):
            fail(f"{question.get('id')} 的选项无效或重复", errors)
        for field in ["questionImage", "optionAImage", "optionBImage", "optionCImage", "optionDImage"]:
            image = question.get(field, "")
            if image and not (ROOT / image).is_file():
                fail(f"{question.get('id')} 引用的图片不存在：{image}", errors)

    product_name_questions = [
        question for question in product_questions
        if question.get("bank") in PRODUCT_BANKS and question.get("knowledgePoint") == "产品名称"
    ]
    product_codes = {question.get("code") for question in product_name_questions if question.get("code")}
    if not product_codes:
        fail("产品题库没有可识别的产品货号", errors)

    visual_codes = {
        question.get("code") for question in product_questions
        if question.get("knowledgePoint") == "看图片选货号"
    }
    if not visual_codes or not visual_codes.issubset(product_codes):
        fail("图片题货号必须是产品题库中的有效货号", errors)

    code_2576 = [
        question for question in product_questions
        if question.get("code") == "2576" and question.get("knowledgePoint") == "产品名称"
    ]
    if len(code_2576) != 1 or code_2576[0].get("answerText") != "2608杏仁饼258g":
        fail("货号2576的产品名称不是2608杏仁饼258g", errors)

    bank_counts: dict[str, int] = {}
    for question in product_questions:
        bank = question.get("bank", "")
        bank_counts[bank] = bank_counts.get(bank, 0) + 1
    if any(count < 1 for count in bank_counts.values()):
        fail("题库存在空题库", errors)

    index_text = (ROOT / "index.html").read_text(encoding="utf-8")
    app_text = (ROOT / "app.js").read_text(encoding="utf-8")
    api_text = (ROOT / "api" / "cloud.js").read_text(encoding="utf-8")
    app_version = re.search(r'const BUILD_VERSION = "([^"]+)";', app_text)
    app_src_version = re.search(r'app\.js\?v=([^"&]+)', index_text)
    if not app_version or not app_src_version or app_version.group(1) != app_src_version.group(1):
        fail("首页与脚本版本号不一致", errors)
    if "JZ_ADMIN_PHONES" in index_text:
        fail("网页仍包含公开管理员号码配置", errors)
    if 'const API_BASE = "https://jinzun-knowledge.vercel.app";' not in app_text or "const CLOUD_ENABLED = true;" not in app_text:
        fail("网页端云同步未启用或云端地址未配置", errors)
    if "INTERNAL_API_TOKEN" not in api_text or "Unauthorized" not in api_text:
        fail("云端接口未启用服务器鉴权", errors)

    parser = IdParser()
    parser.feed(index_text)
    required_ids = {
        "authView", "bankSelect", "searchInput", "learnPagination", "quizSetupStatus",
        "quizRunner", "quizResult", "mobileSidebarToggle", "sidebarTools",
    }
    missing_ids = sorted(required_ids - parser.ids)
    if missing_ids:
        fail(f"页面缺少必要组件：{', '.join(missing_ids)}", errors)

    if any(not re.fullmatch(r"P-\d{4}", question["id"]) for question in product_questions):
        fail("产品题目ID格式不稳定", errors)
    if any(not re.fullmatch(r"R-\d{4}", question["id"]) for question in role_questions):
        fail("岗位题目ID格式不稳定", errors)

    result = {
        "ok": not errors,
        "totalQuestions": len(all_questions),
        "productAndReferenceQuestions": len(product_questions),
        "roleQuestions": len(role_questions),
        "productCodes": len(product_codes),
        "imageProductCodes": len(visual_codes),
        "bankCounts": bank_counts,
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

