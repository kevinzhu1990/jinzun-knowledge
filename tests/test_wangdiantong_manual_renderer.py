from __future__ import annotations

import importlib.util
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "render_wangdiantong_manual.py"
spec = importlib.util.spec_from_file_location("render_wangdiantong_manual", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def _card(card_id: str, role: str, module_name: str, status: str) -> dict:
    return {
        "id": card_id,
        "role": role,
        "module": module_name,
        "title": f"{module_name}操作",
        "knowledgePoint": f"{module_name}知识点",
        "goal": "完成当前流程并确认状态已流转。",
        "platform": "通用",
        "entryPath": ["一级菜单", "二级页面"],
        "prerequisites": ["账号已有对应权限"],
        "steps": ["核对单据", "执行操作"],
        "successChecks": ["状态更新成功"],
        "exceptions": ["状态未更新时查看操作日志"],
        "commonMistakes": ["只点击按钮但没有确认结果"],
        "sourceTitle": "测试资料",
        "sourceUrl": "https://example.com/manual",
        "sourceSection": module_name,
        "sourceClause": "测试操作依据。",
        "verificationStatus": status,
    }


def sample_payload() -> dict:
    return {
        "metadata": {
            "version": "test.1",
            "cardCount": 5,
            "sourceRetrievedAt": "2026-08-11",
            "sourceBoundary": ["测试边界。"],
        },
        "cards": [
            # Module ownership overrides early-draft roles exactly as required.
            _card("TEST-K001", "仓储", "库存管理", "verified"),
            _card("TEST-K002", "全员", "订单审核", "pending"),
            _card("TEST-K003", "客服", "运营报表", "verified"),
            _card("TEST-K004", "采购", "采购入库", "verified_internal"),
            _card("TEST-K005", "管理", "账号权限", "verified"),
        ],
    }


def test_renderer_has_required_framework_role_groups_and_card_fields():
    payload = sample_payload()
    markdown = module.render_manual(payload)

    for heading in module.REQUIRED_HEADINGS:
        assert heading in markdown
    for role in module.ROLE_ORDER:
        assert f". {role}岗位（" in markdown
    for label in (
        "学习目标",
        "操作入口",
        "操作前置",
        "操作步骤",
        "完成标志",
        "异常处理",
        "常见误区",
        "来源与依据",
    ):
        assert label in markdown

    assert module.resolve_role(payload["cards"][0]) == "客服"
    assert module.resolve_role(payload["cards"][1]) == "审单"
    assert module.resolve_role(payload["cards"][2]) == "运营"


def test_pending_card_is_explicit_and_never_presented_as_verified():
    markdown = module.render_manual(sample_payload())
    pending_section = markdown.split("#### TEST-K002｜", 1)[1].split("#### ", 1)[0]
    assert "PENDING" in pending_section
    assert "不可作为已验证流程或正式考核依据" in pending_section
    assert "✅ 已验证" not in pending_section
    assert "✅ 已核验" not in pending_section


def test_check_detects_current_missing_and_stale_output(tmp_path: Path):
    payload = sample_payload()
    output = tmp_path / "manual.md"

    current, message = module.check_output(payload, output)
    assert current is False
    assert "不存在" in message

    assert module.write_output(payload, output) is True
    assert module.write_output(payload, output) is False
    current, message = module.check_output(payload, output)
    assert current is True
    assert "一致" in message

    changed = deepcopy(payload)
    changed["cards"][0]["goal"] = "更新后的学习目标。"
    current, message = module.check_output(changed, output)
    assert current is False
    assert "过期" in message


def test_renderer_lists_string_and_structured_source_references():
    payload = sample_payload()
    payload["cards"][0]["sourceReferences"] = [
        "https://example.com/primary",
        {"url": "https://example.com/secondary", "section": "补充章节"},
    ]
    markdown = module.render_manual(payload)
    card_section = markdown.split("#### TEST-K001｜", 1)[1].split("#### ", 1)[0]

    assert "https://example.com/primary" in card_section
    assert "https://example.com/secondary" in card_section
    assert "补充章节" in card_section
