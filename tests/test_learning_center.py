from pathlib import Path


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


def test_merchant_code_learning_includes_three_core_rules():
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    assert "JZ-货号</strong>" in app
    assert "JZ-货号*数量</strong>" in app
    assert "JZ-货号*数量+其他货号</strong>" in app
