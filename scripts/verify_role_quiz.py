from __future__ import annotations

import json
from pathlib import Path

from audit_rule_sources import formal_exam_questions, semantic_duplicate_groups, template_garbage_reasons

ROOT = Path(__file__).resolve().parents[1]
Q = ROOT / "outputs" / "role_quiz" / "岗位学习考核题库.json"
REJECTED = ROOT / "outputs" / "role_quiz" / "rejected_rule_questions_20260713.json"
REVIEW = ROOT / "outputs" / "role_quiz" / "existing_question_review_20260713.json"
OPERATIONS_REPORT = ROOT / "outputs" / "role_quiz" / "运营题库导入报告_20260713.json"


def main() -> None:
    questions = json.loads(Q.read_text(encoding="utf8"))
    errors = []
    generated = [q for q in questions if str(q.get("id", "")).startswith("RULE-")]
    if generated:
        errors.append(f"正式题库不允许包含RULE自动题：{len(generated)}")
    operations = [q for q in questions if str(q.get("id", "")).startswith("OPS-")]
    expected_banks = {"运营-拼多多": 30, "运营-天猫/淘宝": 30, "运营-抖音电商": 30, "运营-京东": 20, "运营-视频号": 20}
    actual_banks = {}
    for question in operations:
        actual_banks[question.get("bank")] = actual_banks.get(question.get("bank"), 0) + 1
    if len(operations) != 130:
        errors.append(f"运营题应为130道，当前为：{len(operations)}")
    if actual_banks != expected_banks:
        errors.append(f"运营平台题量不正确：{actual_banks}")
    if not OPERATIONS_REPORT.exists():
        errors.append("缺少运营题库导入报告")
    for question in questions:
        garbage = template_garbage_reasons(question)
        if garbage:
            errors.append(f"{question.get('id')} contains template garbage: {','.join(garbage)}")
        if question.get("effectiveForFormalExam") is True:
            if question.get("verificationStatus") != "verified" or question.get("humanReviewStatus") != "approved" or question.get("sourceConflict") is not False:
                errors.append(f"{question.get('id')} bypasses human review gate")
    duplicates = semantic_duplicate_groups(questions)
    formal_candidates = [q for q in questions if q.get("effectiveForFormalExam") is True]
    formal_duplicates = semantic_duplicate_groups(formal_candidates)
    if formal_duplicates:
        errors.append(f"正式岗位题库存在语义重复组：{len(formal_duplicates)}")
    if not REJECTED.exists():
        errors.append("缺少RULE题拒绝清单")
    else:
        rejected = json.loads(REJECTED.read_text(encoding="utf8"))
        if len(rejected) != 445:
            errors.append(f"拒绝清单应包含445题，当前为：{len(rejected)}")
        if any(not q.get("rejectionReason") for q in rejected):
            errors.append("拒绝清单存在未填写原因的题目")
    if not REVIEW.exists():
        errors.append("缺少原156题审计报告")
    report = {
        "ok": not errors,
        "totalQuestions": len(questions),
        "legacyQuestions": len(questions) - len(operations),
        "operationsQuestions": len(operations),
        "rejectedRuleQuestions": len(json.loads(REJECTED.read_text(encoding="utf8"))) if REJECTED.exists() else 0,
        "semanticDuplicateGroups": len(duplicates),
        "formalSemanticDuplicateGroups": len(formal_duplicates),
        "formalExamQuestions": len(formal_exam_questions(questions)),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

