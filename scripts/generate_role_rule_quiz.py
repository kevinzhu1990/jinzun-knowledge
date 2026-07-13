from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROLE_DIR = ROOT / "outputs" / "role_quiz"
ROLE_JSON = ROLE_DIR / "岗位学习考核题库.json"
ARCHIVE_DIR = ROLE_DIR / "archive"
ARCHIVE_JSON = ARCHIVE_DIR / "岗位学习考核题库-role-rules3.json"
REJECTED_JSON = ROLE_DIR / "rejected_rule_questions_20260713.json"
REVIEW_JSON = ROLE_DIR / "existing_question_review_20260713.json"
REPORT_JSON = ROLE_DIR / "role_quiz_cleanup_report_20260713.json"
REPORT_MD = ROLE_DIR / "role_quiz_cleanup_report_20260713.md"
SPEC_DIR = ROOT / "sources" / "platform_rules" / "question_specs"
SOURCE_ROOT = ROOT / "sources" / "platform_rules"
TODAY = "2026-07-13"


SPEC_FILES = [
    "taobao_tmall_customer_service.json",
    "pinduoduo_customer_service.json",
    "jd_customer_service.json",
    "douyin_customer_service.json",
    "operations.json",
    "warehouse.json",
    "design.json",
    "live_stream.json",
    "procurement_quality.json",
    "finance_order_review.json",
]


SPEC_SEEDS = {
    "operations.json": [
        {
            "specId": "LAW-OPS-PRICE-001",
            "role": "运营",
            "platform": "通用",
            "module": "价格与库存",
            "riskLevel": "redline",
            "riskCategory": "虚假价格、虚假库存",
            "mandatory": True,
            "sourceId": "ADLAW-2021",
            "sourceClause": "AD-3-4",
            "verificationStatus": "verified",
            "effectiveForFormalExam": False,
            "humanReviewStatus": "pending",
            "sourceConflict": False,
            "scenario": {
                "actor": "运营",
                "orderStatus": "活动海报待发布",
                "facts": [
                    "海报写着原价99元、限时39.9元",
                    "无法提供近期99元实际成交依据",
                    "仓库实际库存还有800盒，但海报写着仅剩20盒",
                ],
            },
            "question": "运营准备发布活动海报，海报写着“原价99元，限时39.9元，仅剩最后20盒”。但运营无法提供近期99元实际成交依据，仓库实际库存还有800盒。正确处理是什么？",
            "correctAction": "暂停发布，核实原价依据和真实库存后重新制作",
            "distractors": [
                "库存数字只是营销文案，可以继续发布",
                "只删掉原价，保留虚假库存",
                "先发布，投诉后再修改",
            ],
            "explanation": "价格、库存等宣传内容应有真实依据。无法核实前应暂停发布，核对资料后再上线；本题不使用平台处罚金额或赔付数字。",
        }
    ],
}


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def question_reason(question: dict) -> list[str]:
    text = str(question.get("question", ""))
    reasons = ["template_generated", "arbitrary_redline_assignment"]
    if "场景编号" in text:
        reasons.append("semantic_duplicate")
    if "在处理“" in text or "发现具体情况为" in text or "涉及客户、商品或订单信息" in text:
        reasons.append("no_concrete_scenario")
    options = [question.get(f"option{x}", "") for x in "ABCD"]
    if options.count("先删除聊天记录并让同事口头处理") or options.count("先照旧做完，出问题再补记录"):
        reasons.append("low_quality_distractors")
    reasons.append("source_topic_mismatch")
    return list(dict.fromkeys(reasons))


def legacy_review(question: dict) -> dict:
    source = str(question.get("source", ""))
    text = str(question.get("question", ""))
    if not source or "平台" in source or "内部" in source:
        category = "pending_source_verification"
        reason = "未提供可核验的具体官方条款或内部材料原文"
    elif any(token in text for token in ("赔付", "退款", "发票", "发货", "承诺")):
        category = "rewrite"
        reason = "涉及履约或售后承诺，需要用当前业务规则和具体事实重写"
    elif any(token in text for token in ("平台", "活动", "转化", "指标")):
        category = "pending_source_verification"
        reason = "平台字段或指标没有对应的当前官方条款"
    else:
        category = "keep"
        reason = "作为内部学习题保留，但正式考试前仍需人工审核"
    return {
        "id": question.get("id", ""),
        "category": category,
        "reason": reason,
        "source": question.get("source", ""),
        "question": question.get("question", ""),
        "humanReviewStatus": "pending",
    }


def ensure_specs() -> list[dict]:
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    for name in SPEC_FILES:
        path = SPEC_DIR / name
        if not path.exists():
            write_json(path, {"specVersion": "20260713", "questions": SPEC_SEEDS.get(name, [])})
    specs = []
    for name in SPEC_FILES:
        payload = read_json(SPEC_DIR / name, {"questions": []})
        for spec in payload.get("questions", []):
            specs.append(spec)
    return specs


def make_spec_question(spec: dict) -> dict:
    options = [spec["correctAction"], *spec["distractors"]]
    digest = hashlib.sha256(spec["specId"].encode("utf-8")).hexdigest()
    order = sorted(range(4), key=lambda index: digest[index * 2 : index * 2 + 2])
    values = [options[index] for index in order]
    answer = "ABCD"[values.index(spec["correctAction"])]
    return {
        "id": spec["specId"],
        "bank": f"{spec['role']}规则题库",
        "role": spec["role"],
        "module": spec["module"],
        "platform": spec["platform"],
        "type": "具体场景题",
        "difficulty": "红线" if spec["riskLevel"] == "redline" else "实操",
        "riskLevel": spec["riskLevel"],
        "riskCategory": spec.get("riskCategory", ""),
        "mandatory": bool(spec.get("mandatory", False)),
        "question": spec["question"],
        "optionA": values[0],
        "optionB": values[1],
        "optionC": values[2],
        "optionD": values[3],
        "answer": answer,
        "answerText": spec["correctAction"],
        "explanation": spec["explanation"],
        "sourceId": spec["sourceId"],
        "sourceClause": spec["sourceClause"],
        "verificationStatus": spec.get("verificationStatus", "pending"),
        "effectiveForFormalExam": bool(spec.get("effectiveForFormalExam", False)),
        "humanReviewStatus": spec.get("humanReviewStatus", "pending"),
        "sourceConflict": bool(spec.get("sourceConflict", False)),
        "sourceRetrievedAt": TODAY,
        "specId": spec["specId"],
        "scenario": spec["scenario"],
    }


def main() -> None:
    ROLE_DIR.mkdir(parents=True, exist_ok=True)
    original = read_json(ROLE_JSON, [])
    if not ARCHIVE_JSON.exists():
        write_json(ARCHIVE_JSON, original)
    generated = [q for q in original if str(q.get("id", "")).startswith("RULE-")]
    if not generated and ARCHIVE_JSON.exists():
        archived = read_json(ARCHIVE_JSON, [])
        generated = [q for q in archived if str(q.get("id", "")).startswith("RULE-")]
    legacy = [q for q in original if not str(q.get("id", "")).startswith("RULE-")]
    rejected = [
        {**question, "rejectionReason": question_reason(question), "rejectedAt": TODAY}
        for question in generated
    ]
    write_json(REJECTED_JSON, rejected)

    reviewed_legacy = []
    for question in legacy:
        reviewed_legacy.append(
            {
                **question,
                "verificationStatus": question.get("verificationStatus", "pending"),
                "effectiveForFormalExam": False,
                "humanReviewStatus": question.get("humanReviewStatus", "pending"),
                "sourceConflict": bool(question.get("sourceConflict", False)),
            }
        )
    write_json(ROLE_JSON, reviewed_legacy)
    write_json(REVIEW_JSON, [legacy_review(q) for q in legacy])

    specs = ensure_specs()
    # Specs are validated and previewed separately. Pending or unapproved specs are
    # intentionally not merged into the formal question bank.
    spec_questions = [make_spec_question(spec) for spec in specs]
    write_json(ROLE_DIR / "question_specs_preview_20260713.json", spec_questions)

    review_counts = {}
    for item in read_json(REVIEW_JSON, []):
        review_counts[item["category"]] = review_counts.get(item["category"], 0) + 1
    report = {
        "generatedAt": TODAY,
        "cleanupVersion": "20260713-role-rules4",
        "beforeTotal": len(legacy) + len(generated),
        "afterTotal": len(reviewed_legacy),
        "removedTemplateQuestions": len(rejected),
        "semanticDuplicateQuestionCount": sum("semantic_duplicate" in q["rejectionReason"] for q in rejected),
        "sourceTopicMismatchCount": sum("source_topic_mismatch" in q["rejectionReason"] for q in rejected),
        "fixedDistractorRepeatCounts": {
            "先删除聊天记录并让同事口头处理": sum(q.get(f"option{x}") == "先删除聊天记录并让同事口头处理" for q in generated for x in "ABCD"),
            "先照旧做完，出问题再补记录": sum(q.get(f"option{x}") == "先照旧做完，出问题再补记录" for q in generated for x in "ABCD"),
        },
        "legacyReviewCounts": review_counts,
        "byRoleRetained": {},
        "verifiedByPlatform": {},
        "pendingQuestions": len(reviewed_legacy) + len(spec_questions),
        "redlineQuestions": sum(q.get("riskLevel") == "redline" for q in reviewed_legacy),
        "practiceQuestions": sum(q.get("riskLevel") == "practice" for q in reviewed_legacy),
        "formalExamQuestions": 0,
        "specCount": len(spec_questions),
        "unverifiedRules": read_json(SOURCE_ROOT / "index.json", {}).get("pendingVerification", []),
        "status": "cleaned_pending_human_review",
    }
    for q in reviewed_legacy:
        role = q.get("role") or "未标注"
        report["byRoleRetained"][role] = report["byRoleRetained"].get(role, 0) + 1
        if q.get("verificationStatus") == "verified":
            platform = q.get("platform") or "未标注"
            report["verifiedByPlatform"][platform] = report["verifiedByPlatform"].get(platform, 0) + 1
    write_json(REPORT_JSON, report)
    REPORT_MD.write_text("# 岗位规则题库清理报告\n\n" + json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

