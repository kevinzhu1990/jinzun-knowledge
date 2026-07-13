from __future__ import annotations

import hashlib
import itertools
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SR = ROOT / "sources" / "platform_rules"
Q = ROOT / "outputs" / "role_quiz" / "岗位学习考核题库.json"
DUPLICATES = ROOT / "outputs" / "role_quiz" / "semantic_duplicate_groups.json"
OUT = ROOT / "outputs" / "role_quiz" / "岗位规则题库审计报告.json"
ALLOWED = ("npc.gov.cn", "gov.cn", "samr.gov.cn", "nhc.gov.cn", "cac.gov.cn", "taobao.com", "tmall.com", "alicdn.com", "pinduoduo.com", "yangkeduo.com")
TEMPLATE_PHRASES = (
    "场景编号",
    "在处理“",
    "发现具体情况为",
    "涉及客户、商品或订单信息",
    "先删除聊天记录并让同事口头处理",
    "先照旧做完，出问题再补记录",
)
SYNONYMS = (("买家", "消费者", "客户"), ("商品", "产品"), ("商家", "店铺"))
NOISE = ("在处理某场景时", "发现具体情况为", "涉及客户商品或订单信息", "此时最合规的第一步是什么")

ALLOWED_SOURCE_TOPIC_MAP = {
    "PIPL-2021": ("客户信息", "手机号", "收货地址", "身份信息", "聊天记录", "订单隐私", "数据最小必要", "信息权限"),
    "ADLAW-2021": ("价格", "折扣", "销量", "库存", "原价", "广告", "宣传", "绝对化", "荣誉", "商品页面"),
    "FOODLAW-2015": ("食品标签", "配料", "净含量", "食品安全", "疾病", "特殊人群", "过敏原", "保质期"),
    "ECOMLAW-2018": ("商品信息", "真实", "诚信经营", "消费者权益", "电子商务", "履约"),
    "IAD-2023": ("网页", "直播", "短视频", "广告", "推销", "宣传"),
    "TAOBAO-PUBLIC-AGREEMENT": ("淘宝", "天猫", "评价", "真实交易", "差评", "返现"),
    "PDD-PUBLIC-AGREEMENT": ("拼多多", "商品信息", "平台", "真实", "交易"),
}


def normalize_question(text: str) -> str:
    value = str(text or "")
    value = re.sub(r"\([^)]*(?:场景编号|题号|ID)[^)]*\)", "", value, flags=re.I)
    value = re.sub(r"[（(][^）)]*(?:场景编号|题号|ID)[^）)]*[）)]", "", value, flags=re.I)
    value = re.sub(r"场景编号\s*[A-Za-z0-9-]+", "", value)
    for phrase in NOISE:
        value = value.replace(phrase, "")
    for group in SYNONYMS:
        for term in group[1:]:
            value = value.replace(term, group[0])
    value = re.sub(r"[\W_]+", "", value, flags=re.UNICODE)
    return value.lower()


def _trigrams(value: str) -> set[str]:
    return {value[i : i + 3] for i in range(max(0, len(value) - 2))}


def _similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    left, right = _trigrams(a), _trigrams(b)
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def _option_signature(question: dict) -> tuple[str, ...]:
    return tuple(sorted(normalize_question(question.get(f"option{x}", "")) for x in "ABCD"))


def semantic_duplicate_groups(questions: list[dict]) -> list[dict]:
    groups: list[dict] = []
    seen: set[str] = set()
    for left, right in itertools.combinations(questions, 2):
        left_norm = normalize_question(left.get("question", ""))
        right_norm = normalize_question(right.get("question", ""))
        score = _similarity(left_norm, right_norm)
        same_options = _option_signature(left) == _option_signature(right)
        same_context = (left.get("role"), left.get("module"), left.get("sourceClause")) == (right.get("role"), right.get("module"), right.get("sourceClause"))
        if left_norm == right_norm or score >= 0.82 or same_options or (same_context and normalize_question(left.get("answerText", "")) == normalize_question(right.get("answerText", ""))):
            key = f"{left.get('id')}::{right.get('id')}"
            if key in seen:
                continue
            seen.add(key)
            groups.append({
                "groupId": f"DUP-{len(groups) + 1:04d}",
                "items": [
                    {"id": left.get("id"), "question": left.get("question", ""), "normalizedQuestion": left_norm},
                    {"id": right.get("id"), "question": right.get("question", ""), "normalizedQuestion": right_norm},
                ],
                "similarity": round(score, 4),
                "sourceClause": left.get("sourceClause") or right.get("sourceClause") or "",
                "suggestedKeep": left.get("id"),
                "suggestedRemove": right.get("id"),
            })
    return groups


def template_garbage_reasons(question: dict) -> list[str]:
    text = str(question.get("question", ""))
    reasons = []
    if "场景编号" in text:
        reasons.append("scenario_number")
    if "在处理“" in text or "发现具体情况为" in text or "涉及客户、商品或订单信息" in text:
        reasons.append("fixed_stem_template")
    if any(question.get(f"option{x}") in TEMPLATE_PHRASES for x in "ABCD"):
        reasons.append("fixed_distractor")
    return reasons


def repeated_template_options(questions: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for question in questions:
        for letter in "ABCD":
            value = question.get(f"option{letter}", "")
            if value in TEMPLATE_PHRASES:
                counts[value] = counts.get(value, 0) + 1
    return counts


def validate_source_topic(question: dict, sources: dict[str, dict]) -> list[str]:
    errors = []
    source_id = question.get("sourceId")
    source = sources.get(source_id)
    if not source:
        return [f"{question.get('id')} unknown source"]
    module = str(question.get("module", ""))
    knowledge_point = str(question.get("knowledgePoint", ""))
    topic_text = " ".join(str(question.get(field, "")) for field in ("module", "knowledgePoint", "question", "answerText", "explanation"))
    allowed_terms = ALLOWED_SOURCE_TOPIC_MAP.get(source_id, ())
    scenes = source.get("applicableScenes") or []
    module_matches_source = any(scene in module or module in scene for scene in scenes)
    module_matches_topic = any(term in module or term in knowledge_point for term in allowed_terms)
    if not (module_matches_source or module_matches_topic):
        errors.append(f"{question.get('id')} source topic mismatch")
    if question.get("platform") not in (None, "", "通用", source.get("platform"), "跨平台法律"):
        errors.append(f"{question.get('id')} platform mismatch")
    if source.get("sourceKind") == "user_agreement" and any(term in topic_text for term in ("处罚金额", "赔付金额", "扣分", "赔付比例", "处罚规则")):
        errors.append(f"{question.get('id')} user agreement cannot support merchant penalty detail")
    return errors


def formal_exam_questions(questions: list[dict]) -> list[dict]:
    return [
        q for q in questions
        if q.get("verificationStatus") == "verified"
        and q.get("effectiveForFormalExam") is True
        and q.get("sourceConflict") is False
        and q.get("semanticDuplicate") is False
        and q.get("humanReviewStatus") == "approved"
    ]


def load_sources() -> tuple[dict, dict[str, dict]]:
    index = json.loads((SR / "index.json").read_text(encoding="utf8"))
    sources = {}
    for item in index["sources"]:
        path = SR / item["file"]
        source = json.loads(path.read_text(encoding="utf8"))
        digest = hashlib.sha256(json.dumps(source["clauses"], ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
        if source.get("sourceSha256") != digest:
            raise SystemExit(f"source hash invalid: {source.get('sourceId')}")
        if source.get("status") != "current":
            raise SystemExit(f"source not current: {source.get('sourceId')}")
        host = urlparse(source.get("officialUrl", "")).hostname or ""
        if not any(host == domain or host.endswith("." + domain) for domain in ALLOWED):
            raise SystemExit(f"source domain not allowed: {source.get('sourceId')}")
        sources[source["sourceId"]] = source
    return index, sources


def main() -> None:
    index, sources = load_sources()
    questions = json.loads(Q.read_text(encoding="utf8"))
    role_questions = [q for q in questions if q.get("role")]
    errors = []
    generated = [q for q in role_questions if str(q.get("id", "")).startswith("RULE-")]
    if generated:
        errors.append(f"正式题库仍含RULE自动题：{len(generated)}")
    for question in role_questions:
        garbage = template_garbage_reasons(question)
        if garbage:
            errors.append(f"{question.get('id')} template garbage: {','.join(garbage)}")
        if question.get("sourceId"):
            errors.extend(validate_source_topic(question, sources))
        if question.get("effectiveForFormalExam") is True:
            if question.get("verificationStatus") != "verified" or question.get("humanReviewStatus") != "approved" or question.get("sourceConflict") is not False:
                errors.append(f"{question.get('id')} is not eligible for formal exam")
    duplicates = semantic_duplicate_groups(role_questions)
    DUPLICATES.write_text(json.dumps(duplicates, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    repeated = repeated_template_options(role_questions)
    for value, count in repeated.items():
        if count > 3:
            errors.append(f"固定错误选项重复超过3次：{value}={count}")
    if errors:
        print("\n".join(errors[:100]))
        raise SystemExit(1)
    report = json.loads(OUT.read_text(encoding="utf8")) if OUT.exists() else {}
    report.update({
        "semanticDuplicateGroups": len(duplicates),
        "semanticDuplicateQuestionCount": sum(len(group["items"]) for group in duplicates),
        "fixedDistractorRepeatCounts": repeated,
        "formalExamQuestions": len(formal_exam_questions(role_questions)),
        "unverifiedRules": index.get("pendingVerification", []),
    })
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"ok": True, "newRuleQuestions": len(generated), "sources": len(sources), "pending": len(index.get("pendingVerification", [])), "semanticDuplicateGroups": len(duplicates), "formalExamQuestions": len(formal_exam_questions(role_questions))}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

