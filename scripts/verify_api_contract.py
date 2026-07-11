from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
API = (ROOT / "api" / "cloud.js").read_text(encoding="utf-8")
APP = (ROOT / "app.js").read_text(encoding="utf-8")


def require(text: str, needle: str, errors: list[str]) -> None:
    if needle not in text:
        errors.append(f"缺少契约标记：{needle}")


def main() -> None:
    errors: list[str] = []
    forbidden = {
        "async function handleLogin": API,
        "navigator.sendBeacon": APP,
        'mode: "no-cors"': APP,
    }
    for needle, text in forbidden.items():
        if needle in text:
            errors.append(f"仍存在已禁止逻辑：{needle}")

    for needle in [
        "async function handleExamStart",
        "async function handleExamSubmit",
        "async function requireActiveUser",
        "会话版本",
        "AUTH_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000",
        "enforceRateLimit(req, action)",
        "考试提交编号",
        "wrong_details",
    ]:
        require(API, needle, errors)

    for needle in ['cloudRequest("exam-start"', 'cloudRequest("exam-submit"', 'syncLater("mistakes"']:
        require(APP, needle, errors)
    require((ROOT / "scripts" / "verify_site_data.py").read_text(encoding="utf-8"), "app_version =", errors)

    stats = API[API.index("async function handleStats"):API.index("module.exports")]
    for forbidden_field in ["密码哈希", "登录失败次数", "锁定截止时间", "客户端标识", "是否管理员"]:
        if forbidden_field in stats:
            errors.append(f"统计响应仍可能返回认证字段：{forbidden_field}")

    for field in ["考试名称", "考核类型", "总题数", "答对数", "答错数", "分数", "是否通过", "用时秒数", "提交时间"]:
        require(API, f"'{field}'", errors)
    for field in ["记录时间", "错选", "正确答案", "解析", "题库", "知识点"]:
        require(API, f"'{field}'", errors)

    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("API contract verification passed")


if __name__ == "__main__":
    main()
