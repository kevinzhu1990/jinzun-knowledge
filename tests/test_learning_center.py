from pathlib import Path
import json
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def source_between(source, start, end):
    return source[source.index(start):source.index(end)]


def test_learning_page_uses_memory_center_layout():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    app = (ROOT / "app.js").read_text(encoding="utf-8")

    assert 'id="learnModeTabs"' in html
    assert 'id="learnSummary"' in html
    assert "学习中心" in html
    for label in ("学习首页", "产品知识", "商家编码", "岗位规则", "平台运营", "品牌知识"):
        assert label in app
    for renderer in (
        "renderLearningOverview",
        "renderProductLearning",
        "renderMerchantLearning",
        "renderRuleLearning",
    ):
        assert f"function {renderer}" in app


def test_learning_page_does_not_render_raw_question_answers():
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    learn_dispatch = source_between(app, "function renderLearnList()", "const PRODUCT_BANKS")
    assert "question.question" not in learn_dispatch
    assert "question.answer" not in learn_dispatch

    learning_renderers = source_between(app, "function productKnowledgeValue", "function scheduleAutoNext")
    assert "答案：" not in learning_renderers
    assert "answer-line" not in learning_renderers


def test_learning_center_supports_memory_actions_and_review_queue():
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    assert 'data-learning-status="learned"' in app
    assert 'data-learning-status="review"' in app
    assert "记住了" in app
    assert "需要复习" in app
    assert "storage.learningProgress" in app
    assert 'state.learnMode === "flash"' in app
    assert 'state.learnMode === "compare"' in app
    assert 'state.learnMode === "review"' in app
    assert 'button.dataset.bankTarget || learnCategoryBanks(category)[0]' in app
    assert 'data-overview-mode="review"' in app


def test_grouped_wangdiantong_review_progress_resolves_to_its_role_bank():
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    overview = source_between(app, "function renderLearningOverview()", "function renderProductLearning")

    assert 'id.startsWith("rule|knowledge|")' in overview
    assert 'id.slice("rule|knowledge|".length)' in overview
    assert 'String(question.knowledgeId || "") === knowledgeId' in overview
    assert overview.index('id.startsWith("rule|knowledge|")') < overview.index('id.startsWith("rule|")')


def test_merchant_code_learning_includes_three_core_rules():
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    assert "年份N-JZ-货号</strong>" in app
    assert "JZ-货号*数量</strong>" in app
    assert "JZ-货号*数量+其他货号</strong>" in app
    assert "const singles = questions.filter" in app
    assert "multiples: questions.filter" in app
    assert "combos: questions.filter" in app
    assert "singleCode: singles[0]?.answerText || code" in app
    assert "merchantExampleGroup(\"多盒编码\", item.multiples)" in app
    assert "merchantExampleGroup(\"组合编码\", item.combos)" in app
    assert "matchedQuestionIds.has(question.id)" in app


def test_wangdiantong_learning_cards_render_operational_fields():
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    renderer = source_between(app, "function learningScenario", "function scheduleAutoNext")

    assert "question.knowledgeId" in renderer
    assert "knowledgeTitle" in renderer
    assert "learningScenario" in renderer
    assert "standardAction" in renderer
    assert "commonMistakes" in renderer
    for field in ("entryPath", "prerequisites", "steps", "successChecks", "exceptions"):
        assert field in renderer
    for label in ("入口路径", "前置条件", "操作步骤", "完成标志", "异常处理", "常见误区"):
        assert label in renderer
    assert 'state.learnMode === "flash"' in renderer
    assert "data-reveal-card" in renderer


def test_rule_learning_entities_merge_shared_knowledge_id_without_changing_legacy_cards():
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    entity_source = source_between(app, "function learningScenario", "function renderRuleLearningBlock")
    questions = [
        {
            "id": "WDT-001-A",
            "knowledgeId": "WDT-001",
            "bank": "旺店通操作题库",
            "module": "订单审核",
            "knowledgePoint": "按箱规拆单",
            "knowledgeTitle": "批量按箱规拆单",
            "learningScenario": "同一批订单需要按整箱数量拆分",
            "standardAction": "在订单审核页面选择需要拆分的订单，点击按箱规拆分",
            "commonMistakes": ["先审核后再拆单", "从订单查询页发起拆分"],
            "entryPath": ["订单", "订单审核"],
            "prerequisites": ["订单处于待审核"],
            "steps": ["勾选订单", "点击按箱规拆分"],
            "successChecks": ["拆分后订单数量符合箱规"],
            "exceptions": ["箱规未维护时先补全货品资料"],
            "sourceReferences": [
                {"url": "internal://jinzun/wdt/box-spec", "section": "金尊内部箱规口径"},
                {"url": "https://example.com/multi-package", "section": "多包裹操作"},
            ],
            "question": "旧场景？",
            "answerText": "旧动作",
            "answer": "B",
            "optionA": "错误A",
            "optionB": "正确B",
            "optionC": "错误C",
            "optionD": "错误D",
            "explanation": "避免仓库二次拆包。",
        },
        {
            "id": "WDT-001-B",
            "knowledgeId": "WDT-001",
            "bank": "旺店通操作题库",
            "module": "订单审核",
            "question": "另一道题？",
            "answerText": "另一答案",
            "answer": "A",
            "optionA": "正确A",
            "optionB": "错误B",
            "optionC": "错误C",
            "optionD": "错误D",
            "explanation": "同一知识点的另一种问法。",
        },
        {
            "id": "LEGACY-001",
            "bank": "岗位规则题库",
            "module": "交接",
            "question": "交接时先做什么？",
            "answerText": "核对交接清单",
            "answer": "A",
            "optionA": "核对交接清单",
            "optionB": "直接离岗",
            "optionC": "跳过记录",
            "optionD": "删除历史",
            "explanation": "确保信息完整。",
        },
    ]
    script = f"""
const state = {{ filtered: {json.dumps(questions, ensure_ascii=False)} }};
{entity_source}
process.stdout.write(JSON.stringify(ruleLearningEntities()));
"""
    completed = subprocess.run(["node", "-e", script], check=True, capture_output=True, text=True, encoding="utf-8")
    entities = json.loads(completed.stdout)

    assert len(entities) == 2
    wangdiantong, legacy = entities
    assert wangdiantong["id"] == "rule|knowledge|WDT-001"
    assert wangdiantong["questionCount"] == 2
    assert wangdiantong["title"] == "批量按箱规拆单"
    assert wangdiantong["action"] == "在订单审核页面选择需要拆分的订单，点击按箱规拆分"
    assert wangdiantong["entryPath"] == ["订单", "订单审核"]
    assert wangdiantong["mistakes"] == ["先审核后再拆单", "从订单查询页发起拆分"]
    assert wangdiantong["sources"] == [
        {"url": "internal://jinzun/wdt/box-spec", "section": "金尊内部箱规口径"},
        {"url": "https://example.com/multi-package", "section": "多包裹操作"},
    ]
    assert legacy["id"] == "rule|LEGACY-001"
    assert legacy["questionCount"] == 1
    assert legacy["scenario"] == "交接时先做什么"
    assert legacy["action"] == "核对交接清单"


def test_wangdiantong_learning_cards_render_multiple_sources():
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    renderer = source_between(app, "function learningScenario", "function scheduleAutoNext")

    assert "function normalizeRuleSourceReferences" in renderer
    assert "question.sourceReferences" in renderer
    assert "function renderRuleSourceReferences" in renderer
    assert "资料来源" in renderer
