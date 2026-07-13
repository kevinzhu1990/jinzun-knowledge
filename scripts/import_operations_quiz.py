from __future__ import annotations

import json
import random
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROLE_DIR = ROOT / "outputs" / "role_quiz"
ROLE_JSON = ROLE_DIR / "岗位学习考核题库.json"
BACKUP_JSON = ROLE_DIR / "archive" / "岗位学习考核题库-before-operations-quiz.json"
REMOVED_JSON = ROLE_DIR / "运营题库重复题移除清单_20260713.json"
REPORT_JSON = ROLE_DIR / "运营题库导入报告_20260713.json"
REPORT_MD = ROLE_DIR / "运营题库导入报告_20260713.md"
REPO_SEED = ROOT / "sources" / "internal_training" / "2026-07-13" / "各平台运营题库130题_seed.json"
DOWNLOAD_SEED = Path(r"D:\Downloads\各平台运营题库130题_seed.json")

PREFIX_BANK = {
    "PDD": "运营-拼多多",
    "TB": "运营-天猫/淘宝",
    "DY": "运营-抖音电商",
    "JD": "运营-京东",
    "WX": "运营-视频号",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def seed_path() -> Path:
    if REPO_SEED.exists():
        return REPO_SEED
    if DOWNLOAD_SEED.exists():
        REPO_SEED.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(DOWNLOAD_SEED, REPO_SEED)
        return REPO_SEED
    raise FileNotFoundError("找不到各平台运营题库130题_seed.json")


def load_seed() -> list[dict]:
    questions = read_json(seed_path())
    if not isinstance(questions, list) or len(questions) != 130:
        raise ValueError(f"seed必须包含130道题，当前为{len(questions) if isinstance(questions, list) else '非数组'}")
    return questions


def platform_for_id(question_id: str) -> str:
    parts = str(question_id).split("-")
    if len(parts) < 3 or parts[1] not in PREFIX_BANK:
        raise ValueError(f"无法从题目ID识别平台：{question_id}")
    return parts[1]


def correct_bank(question: dict) -> str:
    return PREFIX_BANK[platform_for_id(question["id"])]


def platform_counts(questions: list[dict]) -> dict[str, int]:
    counts = Counter()
    for question in questions:
        prefix = platform_for_id(question["id"])
        counts[{"PDD": "拼多多", "TB": "天猫/淘宝", "DY": "抖音电商", "JD": "京东", "WX": "视频号"}[prefix]] += 1
    return dict(counts)


def normalize_stem(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[\W_]+", "", text, flags=re.UNICODE)
    return text


def dedupe_questions(questions: list[dict]) -> tuple[list[dict], list[dict]]:
    kept = []
    removed = []
    seen_stems: dict[str, dict] = {}
    for question in questions:
        stem = normalize_stem(question.get("question"))
        if not stem:
            raise ValueError(f"题目缺少题干：{question.get('id')}")
        if stem in seen_stems:
            removed.append({
                "removedId": question.get("id"),
                "keptId": seen_stems[stem].get("id"),
                "question": question.get("question"),
                "rejectionReason": "semantic_duplicate",
            })
            continue
        seen_stems[stem] = question
        kept.append(question)
    return kept, removed


def validate_question(question: dict) -> None:
    required = ("id", "bank", "role", "module", "platform", "question", "answer", "answerText", "optionA", "optionB", "optionC", "optionD")
    missing = [field for field in required if field not in question]
    if missing:
        raise ValueError(f"{question.get('id')}缺少字段：{','.join(missing)}")
    options = [question[f"option{x}"] for x in "ABCD"]
    if len(set(options)) != 4:
        raise ValueError(f"{question['id']}四个选项重复")
    if question["answer"] not in "ABCD" or question["answerText"] != question[f"option{question['answer']}"]:
        raise ValueError(f"{question['id']}答案与选项不一致")
    if any(token in question["question"] for token in ("场景编号", "发现具体情况为", "涉及客户、商品或订单信息")):
        raise ValueError(f"{question['id']}包含模板化题干")
    if any(token in json.dumps(question, ensure_ascii=False) for token in ("先删除聊天记录并让同事口头处理", "先照旧做完，出问题再补记录")):
        raise ValueError(f"{question['id']}包含固定垃圾选项")
    if question.get("riskLevel") == "redline" and question.get("mandatory") is not True:
        raise ValueError(f"{question['id']}红线题未设置mandatory=true")


def enrich_question(question: dict) -> dict:
    enriched = dict(question)
    enriched["bank"] = correct_bank(question)
    enriched["role"] = "运营"
    enriched["sourceType"] = "internal_sop" if question.get("answerBasis") == "internal_sop" else "national_law"
    enriched["importBatch"] = "20260713-operations-quiz1"
    enriched["humanReviewStatus"] = question.get("humanReviewStatus", "approved")
    enriched["effectiveForFormalExam"] = question.get("effectiveForFormalExam") is True
    enriched["sourceConflict"] = bool(question.get("sourceConflict", False))
    enriched["semanticDuplicate"] = False
    return enriched


def randomize_options(questions: list[dict]) -> list[dict]:
    """Place correct answers in a balanced, deterministic random order."""
    target_letters = list("A" * 33 + "B" * 33 + "C" * 32 + "D" * 32)
    random.Random("20260713-operations-quiz1").shuffle(target_letters)
    randomized = []
    for index, original in enumerate(questions):
        question = dict(original)
        correct_text = question["answerText"]
        distractors = [question[f"option{letter}"] for letter in "ABCD" if letter != question["answer"]]
        random.Random(f"20260713-operations-quiz1:{question['id']}").shuffle(distractors)
        answer = target_letters[index]
        values = iter(distractors)
        for letter in "ABCD":
            question[f"option{letter}"] = correct_text if letter == answer else next(values)
        question["answer"] = answer
        question["answerText"] = correct_text
        randomized.append(question)
    return randomized


def main() -> None:
    seed = load_seed()
    for question in seed:
        validate_question(question)
    if len({q["id"] for q in seed}) != len(seed):
        raise ValueError("seed存在重复ID")
    unique, removed_duplicates = dedupe_questions(seed)
    imported = randomize_options([enrich_question(question) for question in unique])
    for question in imported:
        validate_question(question)

    if not BACKUP_JSON.exists():
        BACKUP_JSON.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROLE_JSON, BACKUP_JSON)
    baseline = read_json(BACKUP_JSON)
    retained = [question for question in baseline if question.get("role") != "运营" and not str(question.get("id", "")).startswith("RULE-")]
    old_operations = [question for question in baseline if question.get("role") == "运营"]
    write_json(REMOVED_JSON, [
        {"id": question.get("id"), "question": question.get("question"), "rejectionReason": "replaced_by_curated_operations_quiz"}
        for question in old_operations
    ] + removed_duplicates)
    write_json(ROLE_JSON, retained + imported)

    report = {
        "version": "20260713-operations-quiz1",
        "source": str(seed_path()),
        "beforeQuestionCount": len(baseline),
        "removedTemplateOperations": sum("RULE-" in str(q.get("id", "")) or "场景编号" in str(q.get("question", "")) for q in old_operations),
        "removedLegacyOperations": len(old_operations),
        "removedSemanticDuplicateQuestions": len(removed_duplicates),
        "rawSeedQuestions": len(seed),
        "newQuestions": len(imported),
        "newQuestionsByPlatform": platform_counts(imported),
        "redlineQuestions": sum(q.get("riskLevel") == "redline" for q in imported),
        "answerDistribution": dict(Counter(q.get("answer") for q in imported)),
        "finalOperationsQuestions": len(imported),
        "finalRoleQuestionCount": len(retained) + len(imported),
        "finalQuestionCount": len(read_json(ROLE_JSON)),
        "validation": "passed",
        "note": "视频号题库按OPS-WX前缀修正；重复题干保留首次出现题目，其余写入移除清单。",
    }
    write_json(REPORT_JSON, report)
    REPORT_MD.write_text("# 运营题库导入报告\n\n" + json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

