import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


quality = load_module("audit_rule_sources", ROOT / "scripts" / "audit_rule_sources.py")


def question(**overrides):
    base = {
        "id": "T-1",
        "role": "运营",
        "platform": "通用",
        "module": "商品价格",
        "riskLevel": "practice",
        "question": "运营准备发布活动海报，原价99元、限时39.9元，但无法提供近期99元成交依据，仓库实际库存还有800盒。正确处理是什么？",
        "optionA": "暂停发布，核实原价依据和真实库存后重新制作",
        "optionB": "库存数字只是营销文案，可以继续发布",
        "optionC": "只删掉原价，保留虚假库存",
        "optionD": "先发布，投诉后再修改",
        "answer": "A",
        "answerText": "暂停发布，核实原价依据和真实库存后重新制作",
        "sourceId": "ADLAW-2021",
        "sourceClause": "AD-3-4",
        "verificationStatus": "verified",
        "effectiveForFormalExam": True,
        "sourceConflict": False,
        "humanReviewStatus": "approved",
    }
    base.update(overrides)
    return base


def test_template_question_is_rejected():
    bad = question(question="【商品价格】在处理“商品价格”场景时，发现具体情况为：商品价格涉及客户、商品或订单信息。此时最合规的第一步是什么？（场景编号0001）")
    assert quality.template_garbage_reasons(bad)


def test_duplicate_after_removing_scenario_number_is_detected():
    a = question(id="A", question="客户地址被发到无关群，客服第一步怎么处理？（场景编号0001）")
    b = question(id="B", question="客户地址被发到无关群，客服第一步怎么处理？（场景编号0002）")
    groups = quality.semantic_duplicate_groups([a, b])
    assert groups and {item["id"] for item in groups[0]["items"]} == {"A", "B"}


def test_option_permutation_is_detected():
    a = question(id="A")
    b = question(id="B", optionA=a["optionB"], optionB=a["optionA"], answer="B", answerText=a["answerText"])
    groups = quality.semantic_duplicate_groups([a, b])
    assert groups


def test_price_question_cannot_use_privacy_source():
    bad = question(sourceId="PIPL-2021", sourceClause="PIPL-4")
    errors = quality.validate_source_topic(bad, {"PIPL-2021": {"applicableScenes": ["客户信息"], "platform": "通用"}})
    assert errors


def test_warehouse_question_cannot_use_advertising_source():
    bad = question(role="仓库/打单", module="出库称重", sourceId="ADLAW-2021", sourceClause="AD-3-4")
    errors = quality.validate_source_topic(bad, {"ADLAW-2021": {"applicableScenes": ["商品页面"], "platform": "通用"}})
    assert errors


def test_pending_source_is_excluded_from_formal_exam():
    pending = question(id="P", verificationStatus="pending", effectiveForFormalExam=False, humanReviewStatus="pending")
    assert quality.formal_exam_questions([pending]) == []


def test_public_user_agreement_cannot_claim_merchant_penalty_rule():
    bad = question(sourceId="PDD-PUBLIC-AGREEMENT", sourceClause="PDD-INFO-1", module="赔付金额", question="拼多多商家应按平台处罚规则赔付25%。")
    errors = quality.validate_source_topic(bad, {"PDD-PUBLIC-AGREEMENT": {"applicableScenes": ["商品信息"], "platform": "拼多多", "sourceKind": "user_agreement"}})
    assert errors


def test_generator_no_longer_uses_count_based_redline_assignment():
    text = (ROOT / "scripts" / "generate_role_rule_quiz.py").read_text(encoding="utf-8")
    assert "total<180" not in text
    assert "ROLE_SPECS" not in text


def test_fixed_distractor_repetition_is_rejected():
    questions = [question(id=f"Q-{i}", optionC="先删除聊天记录并让同事口头处理") for i in range(4)]
    assert quality.repeated_template_options(questions)["先删除聊天记录并让同事口头处理"] == 4


def test_concrete_source_matched_question_passes():
    good = question()
    errors = quality.validate_source_topic(good, {"ADLAW-2021": {"applicableScenes": ["商品价格"], "platform": "通用"}})
    assert errors == []

