import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("import_operations_quiz", ROOT / "scripts" / "import_operations_quiz.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_seed_has_expected_platform_counts_before_deduplication():
    questions = module.load_seed()
    counts = module.platform_counts(questions)
    assert counts == {"拼多多": 30, "天猫/淘宝": 30, "抖音电商": 30, "京东": 20, "视频号": 20}


def test_video_channel_bank_is_corrected_by_id_prefix():
    question = {"id": "OPS-WX-001", "bank": "运营-拼多多"}
    assert module.correct_bank(question) == "运营-视频号"


def test_dedupe_keeps_first_question_and_records_duplicate_ids():
    questions = [
        {"id": "A", "question": "消费者看到商品后应该先做什么？"},
        {"id": "B", "question": "消费者看到商品后应该先做什么？"},
    ]
    kept, removed = module.dedupe_questions(questions)
    assert [q["id"] for q in kept] == ["A"]
    assert removed[0]["removedId"] == "B"


def test_imported_questions_are_not_template_questions():
    questions = module.load_seed()
    for question in questions:
        assert not any(text in question["question"] for text in ("场景编号", "发现具体情况为", "涉及客户、商品或订单信息"))
        assert "先删除聊天记录并让同事口头处理" not in str(question)
        assert "先照旧做完，出问题再补记录" not in str(question)


def test_imported_questions_have_valid_answers_and_unique_options_after_dedupe():
    questions, _ = module.dedupe_questions(module.load_seed())
    assert len({q["id"] for q in questions}) == len(questions)
    assert len({q["question"] for q in questions}) == len(questions)
    for question in questions:
        options = [question[f"option{x}"] for x in "ABCD"]
        assert len(set(options)) == 4
        assert question["answerText"] == question[f"option{question['answer']}"]
        if question.get("riskLevel") == "redline":
            assert question.get("mandatory") is True


def test_answer_letters_are_balanced_after_randomized_option_order():
    questions, _ = module.dedupe_questions(module.load_seed())
    randomized = module.randomize_options([dict(question) for question in questions])
    counts = {letter: sum(q["answer"] == letter for q in randomized) for letter in "ABCD"}
    assert max(counts.values()) - min(counts.values()) <= 1
    for question in randomized:
        assert question["answerText"] == question[f"option{question['answer']}"]

