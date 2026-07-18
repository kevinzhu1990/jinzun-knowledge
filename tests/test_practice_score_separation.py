from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
API = (ROOT / "api" / "cloud.js").read_text(encoding="utf-8")
APP = (ROOT / "app.js").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


def function_block(source: str, start: str, end: str) -> str:
    return source.split(start, 1)[1].split(end, 1)[0]


def test_formal_and_practice_use_separate_feishu_tables():
    formal = function_block(API, "async function handleExamSubmitOnce", "async function handlePracticeSubmit")
    practice = function_block(API, "async function handlePracticeSubmitOnce", "async function handleStats")
    assert "examTableReady()" in formal
    assert "practiceTableReady()" not in formal
    assert "'考核类型': '正式考试'" in formal
    assert "practiceTableReady()" in practice
    assert "examTableReady()" not in practice
    assert "'练习提交编号': submissionId" in practice
    assert "'练习成绩记录'" in API
    assert "LARK_PRACTICE_TABLE_ID" in API


def test_practice_submission_is_authenticated_deduplicated_and_retryable():
    assert "if (action === 'practice-submit')" in API
    assert "requireActiveUser(req, payload)" in API
    assert "practiceSubmitLocks" in API
    assert "searchRecordsReliable(tableId, '练习提交编号', submissionId)" in API
    assert 'syncLater("practice-submit"' in APP
    assert "['mistakes', 'practice-submit']" in APP
    assert "练习成绩已同步到飞书练习表" in APP
    assert "action === 'internal-practice-setup'" in API
    assert "if (!authorized(req))" in API
    start_quiz = function_block(APP, "async function startQuiz", "function goToNextQuestion")
    next_question = function_block(APP, "function goToNextQuestion", "function productKnowledgeValue")
    assert 'state.submissionId = crypto.randomUUID()' in start_quiz
    assert 'state.submissionId = crypto.randomUUID()' not in next_question


def test_admin_dashboard_shows_employee_practice_activity_and_account_actions():
    for marker in (
        "有练习员工", "练习总次数", "练习题数", "练习均分", "最近练习", "最近登录",
        "最近练习记录", "修改密码", "删除员工", "exportPracticeRecords",
    ):
        assert marker in APP or marker in INDEX
    for element_id in ("adminEmployeeList", "adminPracticeList", "exportPracticeRecordsBtn"):
        assert f'id="{element_id}"' in INDEX
    assert "return { ok: true, employees, exams, practices, mistakes" in API
