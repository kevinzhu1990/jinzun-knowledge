import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROLE_JSON = ROOT / "outputs" / "role_quiz" / "岗位学习考核题库.json"


def load_questions():
    return json.loads(ROLE_JSON.read_text(encoding="utf-8"))


def is_formal(question):
    return (
        question.get("verificationStatus") == "verified"
        and question.get("effectiveForFormalExam") is True
        and question.get("sourceConflict") is False
        and question.get("semanticDuplicate") is False
        and question.get("humanReviewStatus") == "approved"
    )


def test_all_role_questions_are_ready_for_formal_exam():
    questions = load_questions()
    assert len(questions) == 315
    assert all(is_formal(question) for question in questions)


def test_legacy_role_questions_have_traceable_internal_sources_and_realistic_options():
    questions = [
        question for question in load_questions()
        if not str(question.get("id", "")).startswith(("OPS-", "WDT-"))
    ]
    assert len(questions) == 64
    forbidden = ("只发表情", "随便猜", "不回答", "保存个人密码", "直接删掉原文", "客户星座")
    for question in questions:
        assert question.get("sourceId", "").startswith("INTERNAL-")
        assert question.get("sourceType") == "internal_sop"
        assert question.get("answerBasis") == "internal_sop"
        options = [question[f"option{letter}"] for letter in "ABCD"]
        assert len(set(options)) == 4
        assert question[f"option{question['answer']}"] == question["answerText"]
        assert not any(term in option for option in options for term in forbidden)


def test_wangdiantong_questions_are_split_by_employee_role():
    questions = [question for question in load_questions() if str(question.get("id", "")).startswith("WDT-")]
    expected = {
        "客服": ("旺店通-客服", 37),
        "审单": ("旺店通-审单", 32),
        "运营": ("旺店通-运营", 26),
        "采购": ("旺店通-采购", 16),
        "管理": ("旺店通-管理", 10),
    }
    assert len(questions) == 121
    assert "全员" not in {question.get("role") for question in questions}
    for role, (bank, count) in expected.items():
        matching = [question for question in questions if question.get("role") == role]
        assert len(matching) == count, role
        assert {question.get("bank") for question in matching} == {bank}
        assert all(is_formal(question) for question in matching)


def test_every_account_role_has_a_formal_all_staff_bank():
    questions = load_questions()
    roles = ["运营", "客服", "美工", "主播", "中控", "采购", "财务", "行政", "审单", "仓储", "管理", "新员工"]
    for role in roles:
        available = [question for question in questions if question.get("bank") == "飞书使用题库"
                     and question.get("role") in (role, "全员") and is_formal(question)]
        assert available, role


def test_role_specific_banks_are_formally_available():
    expected = {"客服": "客服题库", "美工": "美工题库", "审单": "岗位场景题库", "仓储": "岗位场景题库"}
    questions = load_questions()
    for role, bank in expected.items():
        assert any(question.get("bank") == bank and question.get("role") in (role, "全员") and is_formal(question)
                   for question in questions), (role, bank)
