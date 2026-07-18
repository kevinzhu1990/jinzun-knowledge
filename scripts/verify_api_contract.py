from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = (ROOT / "api" / "cloud.js").read_text(encoding="utf-8")
APP = (ROOT / "app.js").read_text(encoding="utf-8")

required_api = (
    "handleExamStart", "handleExamSubmit", "exam-start", "exam-submit",
    "handlePracticeSubmit", "practice-submit", "LARK_PRACTICE_TABLE_ID",
    "练习成绩记录", "练习提交编号", "practiceTableReady",
    "examSubmitLocks", "考试会话ID", "考试提交编号", "wrong_details",
    "requireActiveUser", "Authorization", "admin-add", "admin-delete",
    "admin-password", "session", "是否管理员",
    "selectMooncakeExamQuestions", "MOONCAKE_IMAGE_POINTS", "MOONCAKE_FLAVOR_POINTS",
)
required_app = (
    "cloudRequest", 'cloudRequest("exam-start"', 'cloudRequest("exam-submit"',
    'syncLater("practice-submit"', "exportPracticeRecordsBtn", "adminPracticeList",
    'syncLater("mistakes"', "PRACTICE_AUTO_NEXT_DELAY_MS",
    "FORMAL_AUTO_NEXT_DELAY_MS", "retryExamSubmitBtn",
    'localStorage.getItem("jz_auth_token")',
    "CLOUD_TIMEOUT_MS = 60000", "Authorization",
    'const requestToken = accountAction ? ""',
    "normalizeCloudError", "clearAuthenticationSession",
    "登录状态已失效，请重新登录",
    "selectMooncakeQuizQuestions", "MOONCAKE_IMAGE_POINTS", "MOONCAKE_FLAVOR_POINTS",
)
forbidden = ("navigator.sendBeacon", 'mode: "no-cors"', 'fallback: true', 'syncLater("exam"', '"/api/exam"')
errors = [f"缺少API契约：{x}" for x in required_api if x not in API]
errors += [f"缺少前端契约：{x}" for x in required_app if x not in APP]
errors += [f"仍存在禁止项：{x}" for x in forbidden if x in APP]
if "EMPLOYEE_REGISTER_CODE.length >= 16" in API:
    errors.append("注册口令仍有旧长度限制")
if errors:
    print("\n".join(errors))
    raise SystemExit(1)
print("API contract verification passed")
