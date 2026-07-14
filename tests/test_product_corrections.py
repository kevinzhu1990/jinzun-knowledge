import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_product_questions():
    path = next(ROOT.joinpath("outputs", "product_quiz").glob("*.json"))
    return json.loads(path.read_text(encoding="utf-8"))


def test_every_active_question_has_four_visible_options():
    files = [next(ROOT.joinpath("outputs", "product_quiz").glob("*.json")), next(ROOT.joinpath("outputs", "role_quiz").glob("岗位学习考核题库.json"))]
    for path in files:
        for question in json.loads(path.read_text(encoding="utf-8")):
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
