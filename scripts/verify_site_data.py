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
    product_codes = {question.get("code") for question in product_name_questions}
    if len(product_codes) != 73:
        fail(f"产品货号应为73个，实际为{len(product_codes)}个", errors)

    visual_codes = {
        question.get("code") for question in product_questions
        if question.get("knowledgePoint") == "看图片选货号"
    }
    if visual_codes != product_codes:
        fail("并非所有最新产品都已生成图片题", errors)

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
    if bank_counts.get("品牌知识题库") != 36:
        fail("品牌知识题库题量不等于36", errors)
    if bank_counts.get("商家编码题库") != 715:
        fail("商家编码题库题量不等于715", errors)

    index_text = (ROOT / "index.html").read_text(encoding="utf-8")
    app_text = (ROOT / "app.js").read_text(encoding="utf-8")
    api_text = (ROOT / "api" / "cloud.js").read_text(encoding="utf-8")
    if 'app.js?v=20260710-cloud' not in index_text or 'const BUILD_VERSION = "20260710-cloud";' not in app_text:
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

    stable_product_ids = [question["id"] for question in product_questions]
    if any(not re.fullmatch(r"P-[0-9A-F]{12}", question_id) for question_id in stable_product_ids):
        fail("产品题目未全部使用稳定ID", errors)

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

