import importlib.util
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("balance_quiz_options", ROOT / "scripts" / "balance_quiz_options.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_balancer_keeps_correct_text_and_balances_each_bank():
    questions = [
        {"id": "1", "bank": "x", "answer": "A", "answerText": "right", "optionA": "right", "optionB": "b", "optionC": "c", "optionD": "d"},
        {"id": "2", "bank": "x", "answer": "A", "answerText": "yes", "optionA": "yes", "optionB": "no", "optionC": "maybe", "optionD": "later"},
        {"id": "3", "bank": "x", "answer": "A", "answerText": "true", "optionA": "true", "optionB": "false", "optionC": "unknown", "optionD": "skip"},
        {"id": "4", "bank": "x", "answer": "A", "answerText": "ok", "optionA": "ok", "optionB": "bad", "optionC": "wait", "optionD": "stop"},
    ]
    result = module.balance_questions(questions)
    counts = Counter(q["answer"] for q in result)
    assert max(counts.values()) - min(counts.values()) <= 1
    assert all(q["answerText"] == q[f"option{q['answer']}"] for q in result)


def test_balancer_moves_image_fields_with_option():
    question = {
        "id": "image-1", "bank": "x", "answer": "A", "answerText": "img-a",
        "optionA": "img-a", "optionAImage": "a.jpg", "optionAImageWidth": 120,
        "optionB": "img-b", "optionBImage": "b.jpg", "optionBImageWidth": 130,
        "optionC": "img-c", "optionCImage": "c.jpg", "optionCImageWidth": 140,
        "optionD": "img-d", "optionDImage": "d.jpg", "optionDImageWidth": 150,
    }
    result = module.balance_questions([question], seed="force-d") [0]
    assert result["answerText"] == result[f"option{result['answer']}"]
    assert result[f"option{result['answer']}Image"] == "a.jpg"
    assert result[f"option{result['answer']}ImageWidth"] == 120

