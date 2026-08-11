import json
import os
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import generate_product_quiz as generator
import verify_product_quiz as product_verifier

ROOT = Path(__file__).resolve().parents[1]


def load_product_questions():
    for path in ROOT.joinpath("outputs", "product_quiz").glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    raise AssertionError("product question JSON not found")


def test_retired_2576_is_fully_replaced_by_2608():
    questions = load_product_questions()
    serialized = json.dumps(questions, ensure_ascii=False)
    assert "2576" not in serialized
    current = [q for q in questions if str(q.get("code")) == "2608"]
    assert current
    assert all(q.get("productName") == "杏仁饼258g" for q in current)


def test_every_active_question_has_four_visible_options():
    role_path = next(ROOT.joinpath("outputs", "role_quiz").glob("岗位学习考核题库.json"))
    banks = [load_product_questions(), json.loads(role_path.read_text(encoding="utf-8"))]
    for questions in banks:
        for question in questions:
            assert all(question.get(f"option{letter}") or question.get(f"option{letter}Image") for letter in "ABCD"), question.get("id")


def test_all_loose_mooncake_codes_are_mooncake_loose_piece():
    loose_codes = {"1391", "1392", "1393", "1930", "1937", "1940", "2175", "2176"}
    all_questions = load_product_questions()
    for code in loose_codes:
        questions = [q for q in all_questions if str(q.get("code")) == code]
        assert questions, code
        assert all(q.get("productLine") == "月饼-散饼" for q in questions), code
        line_questions = [q for q in questions if q.get("knowledgePoint") == "产品线"]
        assert len(line_questions) == 1, code
        assert line_questions[0].get("answerText") == "月饼-散饼", code


def test_all_mooncake_box_types_match_latest_sheet():
    gift_box_codes = {
        "0206", "1133", "1658", "1753", "1956", "1966", "2318", "2319",
        "2617", "2622", "2631", "2637",
    }
    tin_codes = {
        "1122", "1761", "1972", "2067", "2212", "2277", "2307", "2397",
        "2398", "2415", "2423", "2425", "2522", "2528", "2535", "2536",
        "2538", "2545", "2547", "2552", "2557", "2602", "2605", "2607",
        "2616", "2618", "2621",
    }
    all_questions = load_product_questions()
    expected_lines = {
        **{code: "月饼-礼盒" for code in gift_box_codes},
        **{code: "月饼-铁罐" for code in tin_codes},
    }
    for code, expected_line in expected_lines.items():
        questions = [q for q in all_questions if str(q.get("code")) == code]
        assert questions, code
        assert all(q.get("productLine") == expected_line for q in questions), code
        line_questions = [q for q in questions if q.get("knowledgePoint") == "产品线"]
        assert len(line_questions) == 1, code
        assert line_questions[0].get("answerText") == expected_line, code


def test_2535_shelf_life_has_requested_distractors():
    questions = [q for q in load_product_questions() if str(q.get("code")) == "2535" and q.get("knowledgePoint") == "保质期"]
    assert len(questions) == 1
    question = questions[0]
    assert question["answerText"] == "90天"
    assert {question[f"option{x}"] for x in "ABCD"} == {"90天", "60天", "6个月", "12个月"}


def test_every_shelf_life_answer_matches_latest_excel():
    products, _ = product_verifier.load_authoritative_products()
    expected = {str(product["code"]): str(product["shelfLife"]) for product in products}
    questions = [question for question in load_product_questions() if question.get("knowledgePoint") == "保质期"]
    assert questions
    for question in questions:
        assert question["answerText"] == expected[str(question["code"])]


def test_generator_does_not_force_all_mooncake_shelf_life_to_90_days():
    source = (ROOT / "scripts" / "generate_product_quiz.py").read_text(encoding="utf-8")
    assert "correct='90天'" not in source


def test_no_placeholder_options_remain():
    for question in load_product_questions():
        assert "暂无其他有效资料" not in json.dumps(question, ensure_ascii=False)


def test_mooncake_bank_excludes_carton_dimensions_and_weight():
    forbidden_points = {"尺寸/外箱", "整箱重量", "箱重", "毛重"}
    forbidden_terms = ("整箱尺寸", "整箱重量", "箱重", "毛重")
    mooncake_questions = [q for q in load_product_questions() if q.get("bank") == "月饼题库"]
    assert mooncake_questions
    for question in mooncake_questions:
        assert question.get("knowledgePoint") not in forbidden_points, question.get("id")
        serialized = json.dumps(question, ensure_ascii=False)
        assert not any(term in serialized for term in forbidden_terms), question.get("id")


def test_1658_flavor_answer_is_correct_and_options_are_unique():
    questions = [q for q in load_product_questions() if str(q.get("code")) == "1658" and q.get("knowledgePoint") == "内配/口味"]
    assert len(questions) == 1
    question = questions[0]
    expected = "双黄莲蓉月饼250克*2；鲍鱼莲蓉月饼80克*1；豆沙月饼100克*3；凤梨水果味月饼80克*2；莲蓉月饼80克*2；五仁月饼250克*1"
    assert question["answerText"] == expected
    assert question[f"option{question['answer']}"] == expected
    normalized = [question[f"option{letter}"].replace(" ", "").replace("×", "*") for letter in "ABCD"]
    assert len(set(normalized)) == 4


def test_image_choice_questions_only_show_answer_letters():
    image_questions = [q for q in load_product_questions() if q.get("knowledgePoint") == "看货号选图片"]
    assert image_questions
    for question in image_questions:
        assert all(not question.get(f"option{letter}") for letter in "ABCD")
        assert all(question.get(f"option{letter}Image") for letter in "ABCD")


def test_merchant_codes_only_reference_active_products():
    questions = load_product_questions()
    active_codes = {
        str(question["code"])
        for question in questions
        if question.get("bank") in {"月饼题库", "日常年货题库"}
        and question.get("knowledgePoint") == "产品名称"
    }
    merchant_questions = [question for question in questions if question.get("bank") == "商家编码题库"]
    assert merchant_questions
    assert len(merchant_questions) < 715
    for question in merchant_questions:
        name_references = generator.merchant_name_references(question.get("productName", ""))
        assert name_references <= active_codes, (question.get("id"), "productName", name_references - active_codes)
        for field in ("answerText", "optionA", "optionB", "optionC", "optionD"):
            references = generator.merchant_code_references(question.get(field, ""))
            assert references, (question.get("id"), field)
            assert references <= active_codes, (question.get("id"), field, references - active_codes)


def test_1940_1392_combo_name_matches_merchant_code():
    matches = [
        question for question in load_product_questions()
        if question.get("answerText") == "JZ-1940*5+1392*5"
    ]
    assert len(matches) == 1
    question = matches[0]
    assert question["productName"] == "1940金尊陈皮豆沙月饼100g 散饼5个+1392金尊黄油椰蓉月饼100g 散饼5个"
    assert "1393" not in question["productName"]
    assert "1940金尊陈皮豆沙月饼100g 散饼5个" in question["question"]
    assert "1392金尊黄油椰蓉月饼100g 散饼5个" in question["question"]
