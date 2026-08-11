from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = (
    ROOT
    / "sources"
    / "internal_training"
    / "2026-08-11"
    / "旺店通使用知识卡.json"
)
OUTPUT_FILE = ROOT / "docs" / "training" / "旺店通员工操作手册.md"
RENDERER_VERSION = "20260811.1"

ROLE_ORDER = ("客服", "审单", "运营", "采购", "管理")

# These ownership rules encode the role boundary confirmed for this training:
# inventory and after-sales belong to customer service, order review/splitting
# belongs to the reviewer, and reporting belongs to operations.  The remaining
# patterns keep store integration, purchasing and permission cards in the five
# supported role tracks even when an early source draft still says 仓储/全员.
ROLE_MODULE_RULES = (
    ("客服", ("库存", "售后", "退换货", "退货", "换货", "补寄")),
    ("审单", ("订单审核", "订单拆分", "审单", "拆单", "无效货品")),
    ("运营", ("报表", "店铺对接", "店铺绑定", "店铺授权")),
    ("采购", ("采购", "1688")),
    ("管理", ("账号", "账户", "权限")),
)

MODULE_PRIORITY = (
    "库存",
    "售后",
    "退换货",
    "订单审核",
    "订单拆分",
    "无效货品",
    "店铺",
    "报表",
    "采购",
    "1688",
    "账号",
    "账户",
    "权限",
)

REQUIRED_HEADINGS = (
    "## 1. 适用范围/版本边界",
    "## 2. 系统结构（人/货/场/流量/转化）",
    "## 3. 点击→转化→复购反馈回路",
    "## 4. 关键杠杆点（1–3个）",
    "## 5. 风险点",
    "## 6. 岗位学习地图",
)


def read_payload(path: Path = SOURCE_FILE) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"找不到旺店通知识卡：{path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        payload = {"metadata": {}, "cards": payload}
    if not isinstance(payload, dict) or not isinstance(payload.get("cards"), list):
        raise ValueError("知识卡顶层必须是数组，或包含 metadata 与 cards 数组的对象")
    validate_payload(payload)
    return payload


def validate_payload(payload: dict[str, Any]) -> None:
    cards = payload.get("cards", [])
    if not cards:
        raise ValueError("知识卡 cards 不能为空")

    ids: list[str] = []
    for index, card in enumerate(cards, start=1):
        if not isinstance(card, dict):
            raise ValueError(f"第{index}张知识卡必须是对象")
        card_id = str(card.get("id") or card.get("knowledgeId") or "").strip()
        if not card_id:
            raise ValueError(f"第{index}张知识卡缺少 id/knowledgeId")
        ids.append(card_id)
        resolve_role(card)  # Fail early if a card cannot enter a supported role track.

    duplicates = sorted(card_id for card_id, count in Counter(ids).items() if count > 1)
    if duplicates:
        raise ValueError(f"知识卡ID重复：{', '.join(duplicates)}")


def _text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\r", " ").replace("\n", " ").split())


def _md_inline(value: Any) -> str:
    return (
        _text(value)
        .replace("\\", "\\\\")
        .replace("|", "\\|")
        .replace("[", "\\[")
        .replace("]", "\\]")
    )


def _items(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [_text(item) for item in value if _text(item)]
    text = _text(value)
    return [text] if text else []


def resolve_role(card: dict[str, Any]) -> str:
    module = _text(card.get("module"))
    title = _text(card.get("title"))
    knowledge = _text(card.get("knowledgePoint"))
    haystack = " ".join((module, title, knowledge))

    for role, patterns in ROLE_MODULE_RULES:
        if any(pattern in haystack for pattern in patterns):
            return role

    role = _text(card.get("role"))
    if role in ROLE_ORDER:
        return role

    card_id = _text(card.get("id") or card.get("knowledgeId")) or "未知卡片"
    raise ValueError(
        f"{card_id} 无法归入客服/审单/运营/采购/管理；"
        f"当前 role={role or '空'}、module={module or '空'}"
    )


def _module_sort_key(module: str) -> tuple[int, str]:
    for index, pattern in enumerate(MODULE_PRIORITY):
        if pattern in module:
            return index, module
    return len(MODULE_PRIORITY), module


def _source_digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _status_kind(card: dict[str, Any]) -> str:
    raw = _text(card.get("verificationStatus")).lower()
    if raw == "verified":
        return "verified"
    if raw in {"verified_internal", "internal_verified"}:
        return "verified_internal"
    return "pending"


def _status_label(card: dict[str, Any]) -> str:
    kind = _status_kind(card)
    if kind == "verified":
        return "✅ 已验证（资料步骤已核对）"
    if kind == "verified_internal":
        return "✅ 已核验（内部操作口径；以金尊现行SOP为准）"
    return "⚠️ PENDING（待核验，不可作为已验证流程或正式考核依据）"


def _render_list(lines: list[str], label: str, values: Any, *, ordered: bool = False) -> None:
    items = _items(values)
    lines.extend((f"**{label}**", ""))
    if not items:
        lines.extend(("- 暂未提供；上线前需由对应岗位补充并复核。", ""))
        return
    for index, item in enumerate(items, start=1):
        marker = f"{index}." if ordered else "-"
        lines.append(f"{marker} {_md_inline(item)}")
    lines.append("")


def _source_references(card: dict[str, Any]) -> list[dict[str, str]]:
    references: list[dict[str, str]] = []
    raw_references = card.get("sourceReferences")
    if not isinstance(raw_references, list):
        raw_references = []
    for raw in raw_references:
        if isinstance(raw, str):
            url = raw.strip()
            section = ""
        elif isinstance(raw, dict):
            url = _text(raw.get("url") or raw.get("sourceUrl"))
            section = _text(raw.get("section") or raw.get("sourceSection"))
        else:
            continue
        if url and all(item["url"] != url for item in references):
            references.append({"url": url, "section": section})

    primary_url = _text(card.get("sourceUrl"))
    if primary_url and all(item["url"] != primary_url for item in references):
        references.insert(
            0,
            {"url": primary_url, "section": _text(card.get("sourceSection"))},
        )
    return references


def _render_card(card: dict[str, Any]) -> str:
    card_id = _text(card.get("id") or card.get("knowledgeId"))
    title = _text(card.get("title") or card.get("knowledgeTitle") or card.get("knowledgePoint"))
    platform = _text(card.get("platform")) or "通用"
    lines = [
        f"#### {card_id}｜{_md_inline(title or '未命名知识卡')}",
        "",
        f"> 状态：{_status_label(card)}",
        "",
        f"- 适用平台：{_md_inline(platform)}",
        f"- 学习目标：{_md_inline(card.get('goal') or '暂未提供；上线前需由对应岗位补充并复核。')}",
        "",
    ]

    entry_path = _items(card.get("entryPath"))
    lines.extend(("**操作入口**", ""))
    if entry_path:
        lines.extend((f"- {' → '.join(_md_inline(item) for item in entry_path)}", ""))
    else:
        lines.extend(("- 暂未提供；上线前需由对应岗位补充并复核。", ""))

    _render_list(lines, "操作前置", card.get("prerequisites"))
    _render_list(lines, "操作步骤", card.get("steps"), ordered=True)
    _render_list(lines, "完成标志", card.get("successChecks"))
    _render_list(lines, "异常处理", card.get("exceptions"))
    _render_list(lines, "常见误区", card.get("commonMistakes"))

    source_title = _text(card.get("sourceTitle")) or "来源资料"
    source_section = _text(card.get("sourceSection")) or "未标注章节"
    source_clause = _text(card.get("sourceClause")) or "未摘录依据；需补充后再核验"
    references = _source_references(card)
    rendered_sources: list[str] = []
    for index, reference in enumerate(references, start=1):
        label = reference["section"] or (
            source_title if len(references) == 1 else f"{source_title}（来源 {index}）"
        )
        rendered_sources.append(
            f"- 来源 {index}：[{_md_inline(label)}]({reference['url'].replace(' ', '%20')})"
        )
    if not rendered_sources:
        rendered_sources.append(f"- 来源：{_md_inline(source_title)}（未提供链接）")
    lines.extend(
        (
            "**来源与依据**",
            "",
        )
    )
    lines.extend(rendered_sources)
    lines.extend(
        (
            f"- 主章节：{_md_inline(source_section)}",
            f"- 操作依据：{_md_inline(source_clause)}",
            "",
        )
    )
    return "\n".join(lines)


def _metadata_boundaries(metadata: dict[str, Any]) -> list[str]:
    boundaries = _items(metadata.get("sourceBoundary"))
    if boundaries:
        return boundaries
    return [
        "本手册仅覆盖知识卡中已收录的旺店通流程，不替代平台最新帮助中心或公司审批制度。",
        "按钮名称、授权周期、平台规则和退款策略可能调整；实操前以当前后台和岗位负责人复核为准。",
        "PENDING 内容只用于暴露待核验缺口，不进入正式操作结论或正式考核。",
    ]


def _render_role_map(grouped: dict[str, dict[str, list[dict[str, Any]]]]) -> str:
    target_modules = {
        "客服": "库存查询；售后退货、换货、补寄与异常闭环",
        "审单": "订单审核；拆单；缺货、无效货品与异常订单处理",
        "运营": "运营报表；店铺对接与平台经营反馈",
        "采购": "采购单；采购入库；1688采购协同",
        "管理": "新账号；最小权限；高风险配置与授权治理",
    }
    success = {
        "客服": "查得到库存、办得完售后、留得下处理记录",
        "审单": "订单状态正确、库存/快递无遗漏、异常不放行",
        "运营": "看得懂报表并把问题反馈到货品、库存和转化动作",
        "采购": "单据已审核、数量金额可核、入库状态闭环",
        "管理": "账号可追责、权限最小化、关键配置有人复核",
    }
    lines = [
        "| 岗位 | 本手册主责模块 | 学习完成标准 | 当前知识卡 |",
        "| --- | --- | --- | ---: |",
    ]
    for role in ROLE_ORDER:
        count = sum(len(cards) for cards in grouped.get(role, {}).values())
        lines.append(
            f"| {role} | {target_modules[role]} | {success[role]} | {count} |"
        )
    return "\n".join(lines)


def render_manual(payload: dict[str, Any]) -> str:
    validate_payload(payload)
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    cards: list[dict[str, Any]] = payload["cards"]
    grouped: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for card in cards:
        grouped[resolve_role(card)][_text(card.get("module")) or "未分类模块"].append(card)

    status_counts = Counter(_status_kind(card) for card in cards)
    declared_count = metadata.get("cardCount")
    coverage = str(len(cards))
    if isinstance(declared_count, int) and declared_count > 0:
        coverage = f"{len(cards)}/{declared_count}"

    lines = [
        "# 旺店通员工操作手册",
        "",
        f"> 由《旺店通使用知识卡》确定性生成｜渲染版本 {RENDERER_VERSION}｜源卡覆盖 {coverage}",
        "",
        "## 1. 适用范围/版本边界",
        "",
        "- 适用对象：客服、审单、运营、采购、管理五类岗位的新员工学习、上岗前演练与日常查错。",
        f"- 知识版本：{_md_inline(metadata.get('version') or '未标注')}；资料读取日：{_md_inline(metadata.get('sourceRetrievedAt') or '未标注')}。",
        f"- 状态汇总：资料已验证 {status_counts['verified']} 张；内部口径已核验 {status_counts['verified_internal']} 张；PENDING {status_counts['pending']} 张。",
    ]
    if isinstance(declared_count, int) and declared_count != len(cards):
        lines.append(
            f"- ⚠️ 阶段版提示：元数据声明 {declared_count} 张，当前实际 {len(cards)} 张；缺卡补齐前不得视为完整培训手册。"
        )
    for boundary in _metadata_boundaries(metadata):
        lines.append(f"- {_md_inline(boundary)}")

    lines.extend(
        (
            "",
            "## 2. 系统结构（人/货/场/流量/转化）",
            "",
            "- **人**：管理岗建账号并按最小权限授权；客服、审单、运营、采购各自只处理职责内流程，关键异常升级复核。",
            "- **货**：平台货品先匹配系统货品，库存、库位、采购入库与退货入库共同决定可售数量和履约能力。",
            "- **场**：淘宝/天猫、拼多多、京东、视频号、抖音、唯品会、阿里巴巴等店铺，经正确的平台类型和授权链路接入旺店通。",
            "- **流量**：平台点击形成订单后，订单抓取、审核、库存占用和发货决定流量能否沉淀为有效成交。",
            "- **转化**：审单准确率、缺货率、发货时效、售后解决率和利润报表共同反映成交质量，并指导下一轮货品与运营动作。",
            "",
            "## 3. 点击→转化→复购反馈回路",
            "",
            "平台点击/下单 → 审单岗核对并处理拆单与异常 → 库存占用/采购补货保障履约 → 仓内发货 → 客服完成退换货与顾虑化解 → 运营查看销售、发货、采购报表 → 调整货品、库存、渠道与服务 → 提升下一轮转化和复购。",
            "",
            "闭环要求：每个岗位既要完成当前按钮动作，也要确认状态已流转、异常有记录、下游岗位能继续处理；只“点过按钮”不等于完成。",
            "",
            "## 4. 关键杠杆点（1–3个）",
            "",
            "1. **高｜审单与库存准确**：先解决货品匹配、库存占用、快递和异常拦截，再放行订单，直接降低错发、缺货和退款。",
            "2. **高｜售后闭环速度**：退货入库、换货/补寄单和平台退款策略状态一致，减少顾客等待与二次投诉，保护复购。",
            "3. **中｜报表反哺经营**：把销售利润、发货和采购数据按店铺/货品/供应商复盘，优先处理影响成交和毛利的1–3个问题。",
            "",
            "## 5. 风险点",
            "",
            "- **高**：强制审单、自动退款、店铺平台类型和高权限账号配置错误，可能造成错发、误退、绑店失败或越权操作。",
            "- **高**：无效货品未匹配、库存同步任务未启用或退货状态未闭环，会让订单无法流转或库存失真。",
            "- **中**：采购单未审核、入库数量/价格/良残属性未复核，会污染库存和成本数据。",
            "- **中**：把日报数据当实时数据、只看销售额不看退款和成本，会导致错误经营判断。",
            "- **管控规则**：所有 PENDING 卡必须先由对应岗位在当前旺店通及平台后台复核，再转为已验证并进入正式考核。",
            "",
            "## 6. 岗位学习地图",
            "",
            _render_role_map(grouped),
            "",
            "岗位边界：库存查询与售后归客服；订单审核与拆单归审单；报表查看与经营反馈归运营。涉及跨岗状态时，由发起岗位记录结果并明确交接对象。",
            "",
        )
    )

    section_number = 7
    for role in ROLE_ORDER:
        modules = grouped.get(role, {})
        role_count = sum(len(module_cards) for module_cards in modules.values())
        lines.extend((f"## {section_number}. {role}岗位（{role_count}张）", ""))
        section_number += 1
        if not modules:
            lines.extend(("> 本批暂无该岗位知识卡；源卡补齐前不可据此判定岗位已覆盖。", ""))
            continue
        for module in sorted(modules, key=_module_sort_key):
            module_cards = sorted(
                modules[module],
                key=lambda card: (
                    _text(card.get("platform")),
                    _text(card.get("id") or card.get("knowledgeId")),
                ),
            )
            lines.extend((f"### {module}（{len(module_cards)}张）", ""))
            for card in module_cards:
                lines.append(_render_card(card).rstrip())
                lines.append("")

    lines.extend(
        (
            "---",
            "",
            "使用建议：先按岗位顺序完成知识卡学习，再进入对应岗位题库；答错后回到同ID知识卡复盘操作入口、完成标志与常见误区。",
            "",
            f"<!-- generated-by: scripts/render_wangdiantong_manual.py; renderer-version: {RENDERER_VERSION}; source-sha256: {_source_digest(payload)} -->",
            "",
        )
    )
    result = "\n".join(lines)
    validate_rendered_manual(result, cards)
    return result


def validate_rendered_manual(markdown: str, cards: Iterable[dict[str, Any]]) -> None:
    missing_headings = [heading for heading in REQUIRED_HEADINGS if heading not in markdown]
    if missing_headings:
        raise ValueError(f"手册缺少必需章节：{', '.join(missing_headings)}")
    for role in ROLE_ORDER:
        if f". {role}岗位（" not in markdown:
            raise ValueError(f"手册缺少{role}岗位分组")
    for card in cards:
        card_id = _text(card.get("id") or card.get("knowledgeId"))
        if markdown.count(f"#### {card_id}｜") != 1:
            raise ValueError(f"知识卡 {card_id} 未且仅未渲染一次")


def check_output(payload: dict[str, Any], output_path: Path = OUTPUT_FILE) -> tuple[bool, str]:
    expected = render_manual(payload)
    if not output_path.exists():
        return False, f"手册不存在：{output_path}"
    actual = output_path.read_text(encoding="utf-8")
    if actual != expected:
        expected_hash = hashlib.sha256(expected.encode("utf-8")).hexdigest()[:12]
        actual_hash = hashlib.sha256(actual.encode("utf-8")).hexdigest()[:12]
        return (
            False,
            "手册已过期或被手工改写："
            f"expected={expected_hash} actual={actual_hash}；请重新运行渲染器",
        )
    return True, f"手册与知识卡一致：{output_path}"


def write_output(payload: dict[str, Any], output_path: Path = OUTPUT_FILE) -> bool:
    rendered = render_manual(payload)
    if output_path.exists() and output_path.read_text(encoding="utf-8") == rendered:
        return False
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(rendered, encoding="utf-8")
    return True


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="将旺店通知识卡按岗位和模块确定性渲染为Markdown员工手册。"
    )
    parser.add_argument("--source", type=Path, default=SOURCE_FILE, help="知识卡JSON路径")
    parser.add_argument("--output", type=Path, default=OUTPUT_FILE, help="Markdown输出路径")
    parser.add_argument(
        "--check",
        action="store_true",
        help="只检查现有手册是否与知识卡完全一致，不写文件",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        payload = read_payload(args.source)
        if args.check:
            current, message = check_output(payload, args.output)
            print(message)
            return 0 if current else 1
        changed = write_output(payload, args.output)
        verb = "已生成" if changed else "无需更新"
        print(f"{verb}：{args.output}（{len(payload['cards'])}张知识卡）")
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"手册渲染失败：{error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
