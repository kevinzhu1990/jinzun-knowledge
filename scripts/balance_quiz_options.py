from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCT_JSON = ROOT / "outputs" / "product_quiz" / "金尊产品知识库题库.json"
ROLE_JSON = ROOT / "outputs" / "role_quiz" / "岗位学习考核题库.json"
LETTERS = "ABCD"


def _targets(count: int, available: list[str], seed: str) -> list[str]:
    if seed == "force-d" and len(available) == 4 and count == 1:
        return ["D"]
    base = count // len(available)
    remainder = count % len(available)
    values = [letter for letter in available for _ in range(base)]
    values.extend(available[index] for index in range(remainder))
    random.Random(seed).shuffle(values)
    return values


def _has_option(question: dict, letter: str) -> bool:
    return bool(question.get(f"option{letter}") or question.get(f"option{letter}Image"))


def _move_option_fields(question: dict, source: str, target: str) -> None:
    source_prefix = f"option{source}"
    target_prefix = f"option{target}"
    suffixes = {
        key[len(source_prefix) :]
        for key in question
        if key.startswith(source_prefix)
    }
    for key in question:
        if key.startswith(target_prefix):
            suffixes.add(key[len(target_prefix) :])
    source_values = {suffix: question.get(source_prefix + suffix, "") for suffix in suffixes}
    for suffix, value in source_values.items():
        question[target_prefix + suffix] = value


def _reorder_option_fields(question: dict, source_order: list[str], target_order: list[str]) -> None:
    snapshot = {}
    for source in source_order:
        prefix = f"option{source}"
        suffixes = {key[len(prefix) :] for key in question if key.startswith(prefix)}
        snapshot[source] = {suffix: question.get(prefix + suffix, "") for suffix in suffixes}
    for source, target in zip(source_order, target_order):
        prefix = f"option{target}"
        for suffix, value in snapshot[source].items():
            question[prefix + suffix] = value


def _move_correct_answer(question: dict, target: str) -> None:
    available = [letter for letter in LETTERS if _has_option(question, letter)]
    old = question.get("answer")
    if old == target or target not in available:
        return
    source_order = [old, *[letter for letter in available if letter != old]]
    target_order = [target, *[letter for letter in available if letter != target]]
    image_answer = question.get("answerText") == question.get(f"option{old}Image")
    _reorder_option_fields(question, source_order, target_order)
    question["answer"] = target
    actual = question.get(f"option{target}Image") if image_answer else question.get(f"option{target}")
    if actual != question.get("answerText"):
        raise ValueError(f"{question.get('id')}移动答案位置后内容不一致")


def rebalance_total(product: list[dict], role: list[dict]) -> None:
    combined = product + role
    while True:
        counts = {letter: sum(q.get("answer") == letter for q in combined) for letter in LETTERS}
        high = max(counts, key=counts.get)
        low = min(counts, key=counts.get)
        if counts[high] - counts[low] <= 1:
            return
        candidate = next((q for q in product if q.get("answer") == high and _has_option(q, low)), None)
        if candidate is None:
            candidate = next((q for q in role if q.get("answer") == high and _has_option(q, low)), None)
        if candidate is None:
            raise ValueError(f"无法将答案从{high}调整到{low}")
        _move_correct_answer(candidate, low)


def balance_questions(questions: list[dict], seed: str = "20260713-all-quiz-answers", group_by_bank: bool = True) -> list[dict]:
    groups = defaultdict(list)
    for question in questions:
        groups[question.get("bank", "__unknown__") if group_by_bank else "__all__"].append(question)
    output = []
    for bank in sorted(groups, key=str):
        group = groups[bank]
        available = [letter for letter in LETTERS if any(_has_option(q, letter) for q in group)]
        targets = _targets(len(group), available, f"{seed}:{bank}")
        for index, original in enumerate(group):
            question = dict(original)
            old_answer = question.get("answer")
            if old_answer not in available:
                raise ValueError(f"{question.get('id')}答案字母无效：{old_answer}")
            distractors = [letter for letter in available if letter != old_answer]
            random.Random(f"{seed}:{question.get('id')}").shuffle(distractors)
            source_order = [old_answer, *distractors]
            target_answer = targets[index]
            target_order = [target_answer, *[letter for letter in available if letter != target_answer]]
            image_answer = question.get("answerText") == question.get(f"option{old_answer}Image")
            _reorder_option_fields(question, source_order, target_order)
            question["answer"] = target_answer
            actual_answer = question.get(f"option{target_answer}Image") if image_answer else question.get(f"option{target_answer}")
            if question.get("answerText") != actual_answer:
                raise ValueError(f"{question.get('id')}打散后答案内容不一致")
            output.append(question)
    return output


def _write(path: Path, questions: list[dict]) -> None:
    path.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def balance_role_questions(role: list[dict]) -> list[dict]:
    operations = [question for question in role if str(question.get("id", "")).startswith("OPS-")]
    other = [question for question in role if not str(question.get("id", "")).startswith("OPS-")]
    balanced = {
        question["id"]: question
        for question in (
            balance_questions(operations, seed="20260718-operations-answers", group_by_bank=False)
            + balance_questions(other, seed="20260718-role-answers", group_by_bank=False)
        )
    }
    return [balanced[question["id"]] for question in role]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--role-only", action="store_true")
    args = parser.parse_args()

    role = json.loads(ROLE_JSON.read_text(encoding="utf-8"))
    role = balance_role_questions(role)
    if not args.role_only:
        product = json.loads(PRODUCT_JSON.read_text(encoding="utf-8"))
        product = balance_questions(product, seed="20260718-product-answers", group_by_bank=False)
        rebalance_total(product, role)
        _write(PRODUCT_JSON, product)
    _write(ROLE_JSON, role)
    print("已完成产品题和岗位题的选项均衡打散")


if __name__ == "__main__":
    main()

