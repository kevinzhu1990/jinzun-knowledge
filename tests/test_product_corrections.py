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


def test_1930_is_mooncake_loose_piece():
    questions = [q for q in load_product_questions() if str(q.get("code")) == "1930"]
    assert questions
    assert all(q.get("productLine") == "月饼-散饼" for q in questions)


def test_2535_shelf_life_has_requested_distractors():
    questions = [q for q in load_product_questions() if str(q.get("code")) == "2535" and q.get("knowledgePoint") == "保质期"]
    assert len(questions) == 1
    question = questions[0]
    assert question["answerText"] == "90天"
    assert {question[f"option{x}"] for x in "ABCD"} == {"90天", "60天", "6个月", "12个月"}


def test_no_placeholder_options_remain():
    for question in load_product_questions():
        assert "暂无其他有效资料" not in json.dumps(question, ensure_ascii=False)

