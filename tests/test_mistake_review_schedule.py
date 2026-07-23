from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "app.js").read_text(encoding="utf-8")
CSS = (ROOT / "styles.css").read_text(encoding="utf-8")


def test_mistake_review_uses_forgetting_curve_intervals():
    assert "const MISTAKE_REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14]" in APP
    assert "function advanceMistakeReview" in APP
    assert "nextReviewAt: scheduledReviewDate" in APP
    assert "reviewStage: nextStage" in APP


def test_only_due_mistakes_are_retrained():
    assert "storage.mistakes.filter((question) => isMistakeDue(question))" in APP
    assert "重练今日错题" in APP
    assert "今日复习已完成" in APP
    assert "今日待复习" in APP
    assert "已排程" in APP


def test_wrong_answers_reset_schedule_and_legacy_data_is_due():
    assert "reviewStage: 0, nextReviewAt: savedAt" in APP
    assert "nextReviewAt: oldQuestion.nextReviewAt || savedAt" in APP
    assert "saveMistake(question, letter)" in APP


def test_dashboard_hero_uses_darker_accessible_text():
    assert "#heroSlogan" in CSS and "color: #17283d" in CSS
    assert ".hero p" in CSS and "color: #40546a" in CSS
