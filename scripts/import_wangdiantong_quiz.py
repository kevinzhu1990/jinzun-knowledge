from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DATE = "2026-08-11"
IMPORT_VERSION = "20260811-wangdiantong-quiz1"
EXPECTED_CARD_COUNT = 60
QUESTIONS_PER_CARD = 2
EXPECTED_QUESTION_COUNT = EXPECTED_CARD_COUNT * QUESTIONS_PER_CARD
QUESTION_PREFIX = "WDT-"
SOURCE_ID = "INTERNAL-WDT-YUQUE-SOP-2026"
SOURCE_TITLE = "旺店通操作手册与金尊内部操作口径"
REDLINE_QUESTION_IDS = {
    "WDT-005-A",
    "WDT-006-B",
    "WDT-013-A",
    "WDT-018-B",
    "WDT-021-A",
    "WDT-025-A",
    "WDT-027-A",
    "WDT-032-B",
    "WDT-036-B",
    "WDT-042-B",
    "WDT-048-B",
    "WDT-055-A",
}
ROLE_BANK_MAP = {
    "客服": "旺店通-客服",
    "审单": "旺店通-审单",
    "运营": "旺店通-运营",
    "采购": "旺店通-采购",
    "管理": "旺店通-管理",
}

SOURCE_FILE = (
    ROOT
    / "sources"
    / "internal_training"
    / SOURCE_DATE
    / "旺店通使用知识卡.json"
)
ROLE_DIR = ROOT / "outputs" / "role_quiz"
ROLE_JSON = ROLE_DIR / "岗位学习考核题库.json"
ROLE_XLSX = ROLE_DIR / "岗位学习考核题库.xlsx"
ARCHIVE_DIR = ROLE_DIR / "archive"
ARCHIVE_JSON = ARCHIVE_DIR / "岗位学习考核题库-before-wangdiantong-20260811.json"
ARCHIVE_XLSX = ARCHIVE_DIR / "岗位学习考核题库-before-wangdiantong-20260811.xlsx"
REPORT_JSON = ROLE_DIR / "旺店通题库导入报告_20260811.json"
REPORT_MD = ROLE_DIR / "旺店通题库导入报告_20260811.md"

BASE_FIELDS = (
    "id",
    "bank",
    "role",
    "module",
    "platform",
    "type",
    "difficulty",
    "riskPriority",
    "riskLevel",
    "mandatory",
    "knowledgeId",
    "knowledgePoint",
    "knowledgeTitle",
    "question",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "answer",
    "answerText",
    "explanation",
    "distractorRationales",
    "goal",
    "entryPath",
    "prerequisites",
    "steps",
    "successChecks",
    "exceptions",
    "commonMistakes",
    "source",
    "sourceUrl",
    "sourceReferences",
    "sourceSection",
    "sourceClause",
    "sourceId",
    "sourceTitle",
    "sourceType",
    "sourceLevel",
    "answerBasis",
    "verificationStatus",
    "effectiveForFormalExam",
    "humanReviewStatus",
    "sourceConflict",
    "semanticDuplicate",
    "reviewedAt",
    "reviewNote",
    "importBatch",
    "note",
)

REQUIRED_AUTHORED_FIELDS = (
    "id",
    "question",
    "answer",
    "answerText",
    "explanation",
)

FORBIDDEN_EASY_DISTRACTORS = (
    "以上都正确",
    "以上都是",
    "以上都不正确",
    "以上都不是",
    "不知道",
    "不清楚",
    "随便选择",
    "随便操作",
    "不做任何处理",
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _write_text_if_changed(path: Path, text: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def write_json(path: Path, value: Any) -> bool:
    return _write_text_if_changed(
        path,
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
    )


def normalize_text(value: Any) -> str:
    return re.sub(r"[\W_]+", "", str(value or "").lower(), flags=re.UNICODE)


def visible_length(value: Any) -> int:
    return len(re.sub(r"\s+", "", str(value or "")))


def load_cards(path: Path = SOURCE_FILE) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"知识卡文件尚未就绪：{path}\n"
            "约定：顶层为 {metadata, cards} 或卡片数组；60张卡，每卡 questions 恰好2题。"
        )
    payload = read_json(path)
    cards = payload.get("cards") if isinstance(payload, dict) else payload
    if not isinstance(cards, list):
        raise ValueError("知识卡顶层必须是数组，或包含 cards 数组的对象")
    if len(cards) != EXPECTED_CARD_COUNT:
        raise ValueError(
            f"知识卡必须包含{EXPECTED_CARD_COUNT}张，当前为{len(cards)}张"
        )
    return cards


def _inherit(question: dict, card: dict, field: str, default: Any = None) -> Any:
    if field in question and question[field] not in (None, ""):
        return question[field]
    if field in card and card[field] not in (None, ""):
        return card[field]
    return default


def _extract_options(question: dict) -> tuple[dict[str, str], str, str]:
    """Return authored options, original correct letter and correct text.

    The canonical authoring format is optionA..optionD + answer. For source
    portability, a four-item ``options`` list/dict plus ``correctIndex`` is also
    accepted. The importer never invents distractors.
    """

    letters = "ABCD"
    flat_present = all(str(question.get(f"option{letter}", "")).strip() for letter in letters)
    options: dict[str, str] = {}
    marked_correct: list[str] = []

    if flat_present:
        options = {
            letter: str(question[f"option{letter}"]).strip() for letter in letters
        }
    else:
        raw_options = question.get("options")
        if isinstance(raw_options, dict):
            for letter in letters:
                value = raw_options.get(letter, raw_options.get(f"option{letter}"))
                if isinstance(value, dict):
                    if value.get("isCorrect") is True:
                        marked_correct.append(letter)
                    value = value.get("text", value.get("label", ""))
                options[letter] = str(value or "").strip()
        elif isinstance(raw_options, list) and len(raw_options) == 4:
            for letter, raw in zip(letters, raw_options):
                value = raw
                if isinstance(raw, dict):
                    if raw.get("isCorrect") is True:
                        marked_correct.append(letter)
                    value = raw.get("text", raw.get("label", raw.get("value", "")))
                options[letter] = str(value or "").strip()
        else:
            raise ValueError(
                f"{question.get('id')} 必须作者化提供 optionA-D 或四项 options；导入器不会自动生成干扰项"
            )

    if any(not options.get(letter) for letter in letters):
        raise ValueError(f"{question.get('id')} 存在空选项")

    raw_answer = question.get("answer")
    if isinstance(raw_answer, str) and raw_answer.upper() in letters:
        answer = raw_answer.upper()
    elif isinstance(question.get("correctIndex"), int):
        index = int(question["correctIndex"])
        if not 0 <= index <= 3:
            raise ValueError(f"{question.get('id')} correctIndex必须在0到3之间")
        answer = letters[index]
    elif isinstance(raw_answer, int):
        index = int(raw_answer)
        if 1 <= index <= 4:
            index -= 1
        if not 0 <= index <= 3:
            raise ValueError(f"{question.get('id')} 数字答案必须是0-3或1-4")
        answer = letters[index]
    elif len(marked_correct) == 1:
        answer = marked_correct[0]
    else:
        answer_text = str(question.get("answerText", "")).strip()
        matches = [letter for letter in letters if options[letter] == answer_text]
        if len(matches) != 1:
            raise ValueError(f"{question.get('id')} 无法唯一识别正确选项")
        answer = matches[0]

    answer_text = str(question.get("answerText") or options[answer]).strip()
    if answer_text != options[answer]:
        raise ValueError(f"{question.get('id')} answerText与正确选项不一致")
    return options, answer, answer_text


def _extract_distractor_rationales(
    question: dict, options: dict[str, str], answer: str
) -> dict[str, str]:
    raw = question.get(
        "distractorRationales",
        question.get("distractorReasons", question.get("wrongBecause")),
    )
    wrong_letters = [letter for letter in "ABCD" if letter != answer]
    result: dict[str, str] = {}

    if isinstance(raw, list):
        if len(raw) != 3:
            raise ValueError(
                f"{question.get('id')} distractorRationales数组必须有3条"
            )
        result = {
            letter: str(reason).strip()
            for letter, reason in zip(wrong_letters, raw)
        }
    elif isinstance(raw, dict):
        for letter in wrong_letters:
            candidates = (
                letter,
                f"option{letter}",
                options[letter],
            )
            reason = next(
                (raw[key] for key in candidates if key in raw and raw[key] not in (None, "")),
                "",
            )
            result[letter] = str(reason).strip()
    else:
        raise ValueError(
            f"{question.get('id')} 必须逐项作者化提供3条 distractorRationales"
        )

    if set(result) != set(wrong_letters) or any(not reason for reason in result.values()):
        raise ValueError(
            f"{question.get('id')} 必须为每个错误选项提供非空错误原因"
        )
    return result


def canonical_question(card: dict, raw_question: dict, question_index: int) -> dict:
    if not isinstance(raw_question, dict):
        raise ValueError(f"{card.get('id')} 第{question_index + 1}题必须是对象")

    options, answer, answer_text = _extract_options(raw_question)
    rationales = _extract_distractor_rationales(raw_question, options, answer)
    question_id = str(raw_question.get("id") or "").strip()
    card_id = str(card.get("id") or card.get("knowledgeId") or "").strip()
    roles = _inherit(raw_question, card, "applicableRoles", card.get("roles", []))
    role = _inherit(raw_question, card, "role")
    if not role:
        if isinstance(roles, list) and len(roles) == 1:
            role = roles[0]
    role = str(role or "").strip()
    if role not in ROLE_BANK_MAP:
        allowed = "、".join(ROLE_BANK_MAP)
        raise ValueError(
            f"{question_id or card_id} role必须是以下单一岗位之一：{allowed}；"
            "旺店通批次禁止使用全员或其他岗位"
        )

    source_url = _inherit(raw_question, card, "sourceUrl", "")
    source_clause = _inherit(raw_question, card, "sourceClause", "")
    if not source_clause:
        source_clause = f"{card_id or 'WDT-KNOWLEDGE'}.Q{question_index + 1}"

    verification_status = str(
        _inherit(raw_question, card, "verificationStatus", "verified")
    ).strip()
    human_review_status = str(
        _inherit(raw_question, card, "humanReviewStatus", "approved")
    ).strip()
    source_conflict = bool(
        _inherit(raw_question, card, "sourceConflict", False)
    )
    semantic_duplicate = bool(
        _inherit(raw_question, card, "semanticDuplicate", False)
    )
    effective_for_formal = bool(
        _inherit(raw_question, card, "effectiveForFormalExam", True)
    )
    if verification_status != "verified":
        human_review_status = "pending"
    if (
        verification_status != "verified"
        or human_review_status != "approved"
        or source_conflict
        or semantic_duplicate
    ):
        effective_for_formal = False

    risk_priority = str(
        _inherit(
            raw_question,
            card,
            "riskPriority",
            _inherit(raw_question, card, "riskLevel", "中"),
        )
    ).strip()
    if risk_priority not in {"高", "中", "低"}:
        raise ValueError(f"{question_id} 风险优先级必须是高/中/低，实际为：{risk_priority}")
    runtime_risk_level = (
        "redline" if question_id in REDLINE_QUESTION_IDS else "practice"
    )

    result = {
        **card,
        **raw_question,
        "id": question_id,
        "bank": ROLE_BANK_MAP[role],
        "role": role,
        "module": str(_inherit(raw_question, card, "module", "")).strip(),
        "platform": str(_inherit(raw_question, card, "platform", "通用")).strip(),
        "type": "单选题",
        "difficulty": str(
            _inherit(raw_question, card, "difficulty", "基础")
        ).strip(),
        "riskPriority": risk_priority,
        "riskLevel": runtime_risk_level,
        "mandatory": runtime_risk_level == "redline",
        "knowledgeId": str(
            _inherit(raw_question, card, "knowledgeId", card_id)
        ).strip(),
        "knowledgePoint": str(
            _inherit(
                raw_question,
                card,
                "knowledgePoint",
                card.get("knowledgeTitle", ""),
            )
        ).strip(),
        "knowledgeTitle": str(
            _inherit(
                raw_question,
                card,
                "knowledgeTitle",
                card.get("knowledgePoint", ""),
            )
        ).strip(),
        "question": str(raw_question.get("question") or "").strip(),
        "optionA": options["A"],
        "optionB": options["B"],
        "optionC": options["C"],
        "optionD": options["D"],
        "answer": answer,
        "answerText": answer_text,
        "explanation": str(raw_question.get("explanation") or "").strip(),
        "distractorRationales": rationales,
        "goal": _inherit(raw_question, card, "goal", ""),
        "entryPath": _inherit(raw_question, card, "entryPath", []),
        "prerequisites": _inherit(raw_question, card, "prerequisites", []),
        "steps": _inherit(raw_question, card, "steps", []),
        "successChecks": _inherit(raw_question, card, "successChecks", []),
        "exceptions": _inherit(raw_question, card, "exceptions", []),
        "commonMistakes": _inherit(raw_question, card, "commonMistakes", []),
        "source": _inherit(
            raw_question,
            card,
            "source",
            SOURCE_TITLE,
        ),
        "sourceUrl": source_url,
        "sourceSection": _inherit(raw_question, card, "sourceSection", ""),
        "sourceClause": source_clause,
        "sourceId": SOURCE_ID,
        "sourceTitle": SOURCE_TITLE,
        "sourceType": "internal_sop",
        "sourceLevel": "C",
        "answerBasis": "internal_sop",
        "verificationStatus": verification_status,
        "effectiveForFormalExam": effective_for_formal,
        "humanReviewStatus": human_review_status,
        "sourceConflict": source_conflict,
        "semanticDuplicate": semantic_duplicate,
        "reviewedAt": SOURCE_DATE,
        "reviewNote": _inherit(
            raw_question,
            card,
            "reviewNote",
            "已按旺店通语雀操作手册和金尊内部操作口径核对题干、步骤、答案与干扰项。",
        ),
        "importBatch": IMPORT_VERSION,
    }

    # Source-only authoring conveniences must not become redundant runtime fields.
    for key in ("questions", "options", "correctIndex", "idSuffix", "roles"):
        result.pop(key, None)
    if isinstance(roles, list) and roles:
        result["applicableRoles"] = roles
    return result


def flatten_cards(cards: list[dict]) -> list[dict]:
    flattened: list[dict] = []
    card_ids: list[str] = []
    for card_index, card in enumerate(cards):
        if not isinstance(card, dict):
            raise ValueError(f"第{card_index + 1}张知识卡必须是对象")
        card_id = str(card.get("id") or card.get("knowledgeId") or "").strip()
        if not card_id:
            raise ValueError(f"第{card_index + 1}张知识卡缺少id/knowledgeId")
        card_ids.append(card_id)
        questions = card.get("questions")
        if not isinstance(questions, list) or len(questions) != QUESTIONS_PER_CARD:
            count = len(questions) if isinstance(questions, list) else "非数组"
            raise ValueError(
                f"{card_id} 必须包含{QUESTIONS_PER_CARD}道完全作者化questions，当前为{count}"
            )
        flattened.extend(
            canonical_question(card, question, index)
            for index, question in enumerate(questions)
        )
    if len(set(card_ids)) != len(card_ids):
        raise ValueError("知识卡存在重复id/knowledgeId")
    if len(flattened) != EXPECTED_QUESTION_COUNT:
        raise ValueError(
            f"知识卡展开后必须为{EXPECTED_QUESTION_COUNT}题，当前为{len(flattened)}题"
        )
    return flattened


def _remap_rationales(
    question: dict,
    old_options: dict[str, str],
    old_answer: str,
    new_options: dict[str, str],
    new_answer: str,
) -> dict[str, str]:
    raw = question["distractorRationales"]
    rationale_by_text = {
        old_options[letter]: raw[letter]
        for letter in "ABCD"
        if letter != old_answer
    }
    return {
        letter: rationale_by_text[new_options[letter]]
        for letter in "ABCD"
        if letter != new_answer
    }


def balance_answer_positions(questions: list[dict]) -> list[dict]:
    if len(questions) != EXPECTED_QUESTION_COUNT:
        raise ValueError(
            f"答案均衡需要{EXPECTED_QUESTION_COUNT}题，当前为{len(questions)}题"
        )
    target_letters = list("A" * 30 + "B" * 30 + "C" * 30 + "D" * 30)
    random.Random(IMPORT_VERSION).shuffle(target_letters)
    result: list[dict] = []

    for target, original in zip(target_letters, questions):
        question = dict(original)
        old_answer = question["answer"]
        old_options = {
            letter: question[f"option{letter}"] for letter in "ABCD"
        }
        correct_text = question["answerText"]
        distractors = [
            old_options[letter] for letter in "ABCD" if letter != old_answer
        ]
        random.Random(f"{IMPORT_VERSION}:{question['id']}").shuffle(distractors)
        distractor_iter = iter(distractors)
        new_options = {
            letter: correct_text if letter == target else next(distractor_iter)
            for letter in "ABCD"
        }
        question.update(
            {f"option{letter}": text for letter, text in new_options.items()}
        )
        question["answer"] = target
        question["answerText"] = correct_text
        question["distractorRationales"] = _remap_rationales(
            question,
            old_options,
            old_answer,
            new_options,
            target,
        )
        result.append(question)
    return result


def option_signature(question: dict) -> tuple[str, ...]:
    return tuple(
        sorted(normalize_text(question[f"option{letter}"]) for letter in "ABCD")
    )


def correct_extreme_rates(questions: list[dict]) -> dict[str, float | int]:
    unique_longest = 0
    unique_shortest = 0
    for question in questions:
        lengths = {
            letter: visible_length(question[f"option{letter}"])
            for letter in "ABCD"
        }
        answer_length = lengths[question["answer"]]
        if list(lengths.values()).count(max(lengths.values())) == 1 and answer_length == max(lengths.values()):
            unique_longest += 1
        if list(lengths.values()).count(min(lengths.values())) == 1 and answer_length == min(lengths.values()):
            unique_shortest += 1
    total = len(questions) or 1
    return {
        "uniqueLongestCorrect": unique_longest,
        "uniqueShortestCorrect": unique_shortest,
        "uniqueLongestCorrectRate": round(unique_longest / total, 4),
        "uniqueShortestCorrectRate": round(unique_shortest / total, 4),
    }


def option_length_ratio_violations(
    questions: list[dict], threshold: float = 1.8
) -> list[dict[str, Any]]:
    violations: list[dict[str, Any]] = []
    for question in questions:
        lengths = [
            visible_length(question[f"option{letter}"]) for letter in "ABCD"
        ]
        shortest = min(lengths)
        longest = max(lengths)
        ratio = float("inf") if shortest == 0 else longest / shortest
        if ratio > threshold:
            violations.append(
                {
                    "id": question.get("id"),
                    "shortest": shortest,
                    "longest": longest,
                    "ratio": round(ratio, 3),
                }
            )
    return violations


def _validate_learning_list(question: dict, field: str, *, required: bool) -> None:
    value = question.get(field)
    if isinstance(value, str):
        value = [value] if value.strip() else []
    if not isinstance(value, list) or any(not str(item).strip() for item in value):
        raise ValueError(f"{question.get('id')} {field}必须是非空字符串数组")
    if required and not value:
        raise ValueError(f"{question.get('id')} 缺少学习字段{field}")


def validate_questions(questions: list[dict]) -> dict[str, Any]:
    if len(questions) != EXPECTED_QUESTION_COUNT:
        raise ValueError(
            f"旺店通题库必须为{EXPECTED_QUESTION_COUNT}题，当前为{len(questions)}题"
        )
    ids = [str(question.get("id", "")) for question in questions]
    if len(set(ids)) != len(ids):
        raise ValueError("旺店通题库存在重复ID")
    if any(not question_id.startswith(QUESTION_PREFIX) for question_id in ids):
        raise ValueError("旺店通题目ID必须统一以WDT-开头")

    normalized_stems: set[str] = set()
    option_signatures: set[tuple[str, ...]] = set()
    knowledge_counts = Counter()
    for question in questions:
        missing = [
            field
            for field in REQUIRED_AUTHORED_FIELDS
            if question.get(field) in (None, "")
        ]
        if missing:
            raise ValueError(
                f"{question.get('id')} 缺少作者化字段：{','.join(missing)}"
            )
        role = question.get("role")
        if role not in ROLE_BANK_MAP:
            raise ValueError(f"{question['id']} 禁止使用全员或非旺店通岗位：{role}")
        expected_bank = ROLE_BANK_MAP[role]
        if question.get("bank") != expected_bank:
            raise ValueError(
                f"{question['id']} 岗位{role}必须进入{expected_bank}，当前为{question.get('bank')}"
            )
        if not question.get("module") or not question.get("knowledgePoint"):
            raise ValueError(f"{question['id']} 缺少module/knowledgePoint")
        if question.get("sourceId") != SOURCE_ID:
            raise ValueError(f"{question['id']} sourceId不正确")
        if question.get("sourceTitle") != SOURCE_TITLE:
            raise ValueError(f"{question['id']} sourceTitle不正确")
        if question.get("sourceType") != "internal_sop" or question.get("answerBasis") != "internal_sop":
            raise ValueError(f"{question['id']} 内部SOP来源元数据不完整")
        source_references = question.get("sourceReferences", [])
        if source_references:
            if not isinstance(source_references, list) or any(
                not isinstance(reference, dict)
                or not str(reference.get("url") or "").strip()
                or not str(reference.get("section") or "").strip()
                for reference in source_references
            ):
                raise ValueError(
                    f"{question['id']} sourceReferences必须是包含url和section的对象数组"
                )
        formal_eligible = (
            question.get("verificationStatus") == "verified"
            and question.get("humanReviewStatus") == "approved"
            and question.get("sourceConflict") is False
            and question.get("semanticDuplicate") is False
        )
        if question.get("effectiveForFormalExam") is not formal_eligible:
            raise ValueError(f"{question['id']} 正式考核门禁状态与核验元数据不一致")
        if question.get("verificationStatus") != "verified" and question.get("humanReviewStatus") != "pending":
            raise ValueError(f"{question['id']} 未核验题必须标记humanReviewStatus=pending")
        if question.get("riskPriority") not in {"高", "中", "低"}:
            raise ValueError(f"{question['id']} 风险优先级必须是高/中/低")
        if question.get("riskLevel") not in {"redline", "practice"}:
            raise ValueError(f"{question['id']} riskLevel必须是redline/practice")
        if question.get("riskLevel") == "redline" and question.get("mandatory") is not True:
            raise ValueError(f"{question['id']} 红线题必须mandatory=true")
        if question.get("riskLevel") == "practice" and question.get("mandatory") is not False:
            raise ValueError(f"{question['id']} 实操题必须mandatory=false")

        options = [question[f"option{letter}"] for letter in "ABCD"]
        if len(set(options)) != 4 or any(not str(option).strip() for option in options):
            raise ValueError(f"{question['id']} 四个选项必须非空且互不重复")
        answer = question.get("answer")
        if answer not in "ABCD" or question[f"option{answer}"] != question.get("answerText"):
            raise ValueError(f"{question['id']} 答案与选项不一致")
        if any(
            forbidden in option
            for forbidden in FORBIDDEN_EASY_DISTRACTORS
            for option in options
        ):
            raise ValueError(f"{question['id']} 包含一眼可排除的敷衍选项")

        rationales = question.get("distractorRationales")
        expected_wrong = {letter for letter in "ABCD" if letter != answer}
        if not isinstance(rationales, dict) or set(rationales) != expected_wrong:
            raise ValueError(f"{question['id']} 错误选项原因必须与当前选项字母一一对应")
        if any(not str(reason).strip() for reason in rationales.values()):
            raise ValueError(f"{question['id']} 存在空的错误选项原因")

        stem = normalize_text(question["question"])
        if not stem or stem in normalized_stems:
            raise ValueError(f"{question['id']} 题干为空或重复")
        normalized_stems.add(stem)

        signature = option_signature(question)
        if signature in option_signatures:
            raise ValueError(f"{question['id']} 复用了另一题的整组四选项")
        option_signatures.add(signature)

        for field in ("entryPath", "steps", "successChecks", "commonMistakes"):
            _validate_learning_list(question, field, required=True)
        for field in ("prerequisites", "exceptions"):
            _validate_learning_list(question, field, required=False)
        knowledge_id = str(question.get("knowledgeId") or "")
        if not knowledge_id:
            raise ValueError(f"{question['id']} 缺少knowledgeId")
        knowledge_counts[knowledge_id] += 1

    bad_knowledge_counts = {
        knowledge_id: count
        for knowledge_id, count in knowledge_counts.items()
        if count != QUESTIONS_PER_CARD
    }
    if len(knowledge_counts) != EXPECTED_CARD_COUNT or bad_knowledge_counts:
        raise ValueError(
            f"知识卡与题目映射异常：{len(knowledge_counts)}个knowledgeId，异常={bad_knowledge_counts}"
        )

    answer_counts = Counter(question["answer"] for question in questions)
    expected_distribution = {letter: 30 for letter in "ABCD"}
    if dict(answer_counts) != expected_distribution:
        raise ValueError(f"答案字母分布必须为A/B/C/D各30题，当前为{dict(answer_counts)}")

    extremes = correct_extreme_rates(questions)
    if extremes["uniqueLongestCorrectRate"] > 0.40:
        raise ValueError(
            "正确项成为唯一最长选项的比例过高："
            f"{extremes['uniqueLongestCorrectRate']:.1%}，请改写干扰项消除长度提示"
        )
    if extremes["uniqueShortestCorrectRate"] > 0.40:
        raise ValueError(
            "正确项成为唯一最短选项的比例过高："
            f"{extremes['uniqueShortestCorrectRate']:.1%}，请改写干扰项消除长度提示"
        )
    length_violations = option_length_ratio_violations(questions)
    if length_violations:
        details = ", ".join(
            f"{item['id']}={item['ratio']}"
            for item in length_violations
        )
        raise ValueError(
            "以下题目的最长/最短选项可见长度比超过1.8，请统一语气和长度量级："
            + details
        )
    return {
        "answerDistribution": dict(answer_counts),
        "optionSetCount": len(option_signatures),
        "knowledgeCardCount": len(knowledge_counts),
        "optionLengthRatioMax": round(
            max(
                max(visible_length(question[f"option{letter}"]) for letter in "ABCD")
                / min(visible_length(question[f"option{letter}"]) for letter in "ABCD")
                for question in questions
            ),
            3,
        ),
        **extremes,
    }


def merge_questions(existing: list[dict], imported: list[dict]) -> list[dict]:
    retained = [
        question
        for question in existing
        if not str(question.get("id", "")).startswith(QUESTION_PREFIX)
    ]
    return retained + imported


def complete_headers(questions: Iterable[dict]) -> list[str]:
    seen = set()
    headers: list[str] = []
    for field in BASE_FIELDS:
        if any(field in question for question in questions):
            headers.append(field)
            seen.add(field)
    for question in questions:
        for field in question:
            if field not in seen:
                headers.append(field)
                seen.add(field)
    return headers


def xlsx_cell_value(value: Any) -> Any:
    if isinstance(value, (dict, list, tuple)):
        return _json_text(value)
    if value is None:
        return ""
    return value


def xlsx_sync_command(
    node_executable: str = "node",
    *,
    input_path: Path = ROLE_JSON,
    output_path: Path = ROLE_XLSX,
) -> list[str]:
    return [
        node_executable,
        str(ROOT / "scripts" / "sync_role_quiz_xlsx.mjs"),
        "--input",
        str(input_path),
        "--output",
        str(output_path),
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="导入旺店通知识卡并生成岗位题库 JSON；Excel 由 artifact-tool 同步器生成。"
    )
    parser.add_argument(
        "--json-only",
        action="store_true",
        help="仅更新 JSON/报告，不同步 XLSX；只用于没有 Codex artifact-tool 的诊断环境。",
    )
    parser.add_argument("--sync-xlsx", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument(
        "--node",
        default="node",
        help="同步 XLSX 使用的 Node 可执行文件，默认 node。",
    )
    return parser.parse_args()


def _distribution(questions: list[dict], field: str) -> dict[str, int]:
    counts = Counter(str(question.get(field) or "未填写") for question in questions)
    return dict(sorted(counts.items(), key=lambda item: item[0]))


def _source_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_report(
    *,
    existing: list[dict],
    imported: list[dict],
    final: list[dict],
    quality: dict[str, Any],
) -> dict[str, Any]:
    previous_wdt = [
        question
        for question in existing
        if str(question.get("id", "")).startswith(QUESTION_PREFIX)
    ]
    role_counts = {
        role: sum(question.get("role") == role for question in imported)
        for role in ROLE_BANK_MAP
    }
    bank_counts = {
        bank: role_counts[role]
        for role, bank in ROLE_BANK_MAP.items()
    }
    return {
        "version": IMPORT_VERSION,
        "source": str(SOURCE_FILE.relative_to(ROOT)).replace("\\", "/"),
        "sourceSha256": _source_sha256(SOURCE_FILE),
        "sourceId": SOURCE_ID,
        "beforeQuestionCount": len(existing),
        "replacedWangdiantongQuestions": len(previous_wdt),
        "retainedNonWangdiantongQuestions": len(existing) - len(previous_wdt),
        "knowledgeCards": EXPECTED_CARD_COUNT,
        "importedQuestions": len(imported),
        "finalQuestionCount": len(final),
        "answerDistribution": quality["answerDistribution"],
        "bankDistribution": bank_counts,
        "moduleDistribution": _distribution(imported, "module"),
        "roleDistribution": role_counts,
        "roleBankDistribution": {
            f"{role}→{bank}": role_counts[role]
            for role, bank in ROLE_BANK_MAP.items()
        },
        "platformDistribution": _distribution(imported, "platform"),
        "difficultyDistribution": _distribution(imported, "difficulty"),
        "riskDistribution": _distribution(imported, "riskLevel"),
        "riskPriorityDistribution": _distribution(imported, "riskPriority"),
        "verificationDistribution": _distribution(imported, "verificationStatus"),
        "uniqueOptionSets": quality["optionSetCount"],
        "maximumOptionLengthRatio": quality["optionLengthRatioMax"],
        "uniqueLongestCorrect": quality["uniqueLongestCorrect"],
        "uniqueLongestCorrectRate": quality["uniqueLongestCorrectRate"],
        "uniqueShortestCorrect": quality["uniqueShortestCorrect"],
        "uniqueShortestCorrectRate": quality["uniqueShortestCorrectRate"],
        "formalExamQuestions": sum(
            question.get("effectiveForFormalExam") is True
            and question.get("verificationStatus") == "verified"
            and question.get("humanReviewStatus") == "approved"
            and question.get("sourceConflict") is False
            and question.get("semanticDuplicate") is False
            for question in imported
        ),
        "pendingQuestions": sum(
            question.get("verificationStatus") != "verified"
            or question.get("humanReviewStatus") != "approved"
            or question.get("sourceConflict") is not False
            or question.get("semanticDuplicate") is not False
            for question in imported
        ),
        "archiveJson": str(ARCHIVE_JSON.relative_to(ROOT)).replace("\\", "/"),
        "archiveXlsx": str(ARCHIVE_XLSX.relative_to(ROOT)).replace("\\", "/"),
        "validation": "passed",
        "note": "仅替换WDT-前缀题目；按客服、审单、运营、采购、管理拆分题库；全部干扰项和错误原因均来自知识卡作者稿，导入器不自动生成低质量选项。",
    }


def report_markdown(report: dict[str, Any]) -> str:
    return (
        "# 旺店通题库导入报告\n\n"
        f"- 版本：`{report['version']}`\n"
        f"- 知识卡：{report['knowledgeCards']} 张\n"
        f"- 导入题目：{report['importedQuestions']} 道\n"
        f"- 岗位题库分布：{_json_text(report['bankDistribution'])}\n"
        f"- 答案分布：{_json_text(report['answerDistribution'])}\n"
        f"- 唯一四选项组合：{report['uniqueOptionSets']} 组\n"
        f"- 正确项唯一最长：{report['uniqueLongestCorrect']} 道（{report['uniqueLongestCorrectRate']:.1%}）\n"
        f"- 正确项唯一最短：{report['uniqueShortestCorrect']} 道（{report['uniqueShortestCorrectRate']:.1%}）\n"
        f"- 单题最大选项长度比：{report['maximumOptionLengthRatio']}（门槛 ≤ 1.8）\n"
        f"- 正式考核可用：{report['formalExamQuestions']} 道\n"
        f"- 待核验/不可进入正式考核：{report['pendingQuestions']} 道\n"
        f"- 最终岗位题库：{report['finalQuestionCount']} 道\n\n"
        "## 模块分布\n\n"
        "```json\n"
        + json.dumps(report["moduleDistribution"], ensure_ascii=False, indent=2)
        + "\n```\n\n"
        "## 岗位与题库分布\n\n"
        "```json\n"
        + json.dumps(report["roleBankDistribution"], ensure_ascii=False, indent=2)
        + "\n```\n\n"
        "## 平台分布\n\n"
        "```json\n"
        + json.dumps(report["platformDistribution"], ensure_ascii=False, indent=2)
        + "\n```\n\n"
        "## 导入约束\n\n"
        "- 每张知识卡必须有 2 道完全作者化单选题。\n"
        "- 客服、审单、运营、采购、管理分别进入对应的旺店通岗位题库，禁止全员或其他岗位。\n"
        "- 只替换 `WDT-` 前缀题目，其他岗位题保持原样。\n"
        "- A/B/C/D 各 30 道，不允许复用整组四选项。\n"
        "- 每个错误选项必须提供独立错误原因。\n"
        "- 正确项唯一最长/最短比例各不超过 40%，单题最长/最短选项长度比不超过 1.8。\n"
    )


def archive_current_outputs() -> None:
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    if ROLE_JSON.exists() and not ARCHIVE_JSON.exists():
        shutil.copyfile(ROLE_JSON, ARCHIVE_JSON)
    if ROLE_XLSX.exists() and not ARCHIVE_XLSX.exists():
        shutil.copyfile(ROLE_XLSX, ARCHIVE_XLSX)


def main() -> None:
    args = parse_args()
    cards = load_cards()
    authored = flatten_cards(cards)
    imported = balance_answer_positions(authored)
    quality = validate_questions(imported)

    existing = read_json(ROLE_JSON)
    if not isinstance(existing, list):
        raise ValueError("岗位学习考核题库.json 顶层必须是数组")
    final = merge_questions(existing, imported)
    retained_before = [
        question
        for question in existing
        if not str(question.get("id", "")).startswith(QUESTION_PREFIX)
    ]
    retained_after = [
        question
        for question in final
        if not str(question.get("id", "")).startswith(QUESTION_PREFIX)
    ]
    if retained_before != retained_after:
        raise RuntimeError("导入器意外修改了非WDT题目")

    report = build_report(
        existing=existing,
        imported=imported,
        final=final,
        quality=quality,
    )
    ROLE_DIR.mkdir(parents=True, exist_ok=True)
    final_json_text = json.dumps(final, ensure_ascii=False, indent=2) + "\n"
    json_changed = (
        not ROLE_JSON.exists()
        or ROLE_JSON.read_text(encoding="utf-8") != final_json_text
    )
    xlsx_synchronized = not args.json_only
    sync_command: list[str] | None = None

    # Stage JSON and XLSX together. A failed artifact-tool run must never leave
    # a new JSON file paired with an old workbook.
    with tempfile.TemporaryDirectory(prefix=".wdt-import-", dir=ROLE_DIR) as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        staged_json = temp_dir / ROLE_JSON.name
        staged_xlsx = temp_dir / ROLE_XLSX.name
        staged_json.write_text(final_json_text, encoding="utf-8")

        if xlsx_synchronized:
            sync_command = xlsx_sync_command(
                args.node,
                input_path=staged_json,
                output_path=staged_xlsx,
            )
            subprocess.run(sync_command, cwd=ROOT, check=True)
            if not staged_xlsx.exists() or staged_xlsx.stat().st_size == 0:
                raise RuntimeError("artifact-tool 未生成有效的岗位题库 XLSX")

        archive_current_outputs()
        backup_json = temp_dir / "before.json"
        backup_xlsx = temp_dir / "before.xlsx"
        if ROLE_JSON.exists():
            shutil.copyfile(ROLE_JSON, backup_json)
        if ROLE_XLSX.exists():
            shutil.copyfile(ROLE_XLSX, backup_xlsx)
        try:
            if xlsx_synchronized:
                os.replace(staged_xlsx, ROLE_XLSX)
            os.replace(staged_json, ROLE_JSON)
        except Exception:
            if backup_xlsx.exists():
                os.replace(backup_xlsx, ROLE_XLSX)
            if backup_json.exists():
                os.replace(backup_json, ROLE_JSON)
            raise

    write_json(REPORT_JSON, report)
    _write_text_if_changed(REPORT_MD, report_markdown(report))
    print(
        json.dumps(
            {
                "ok": True,
                "cards": len(cards),
                "questions": len(imported),
                "answerDistribution": quality["answerDistribution"],
                "jsonChanged": json_changed,
                "xlsxSynchronized": xlsx_synchronized,
                "xlsxSyncCommand": sync_command,
                "report": str(REPORT_JSON),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
