from __future__ import annotations

import importlib.util
import json
import posixpath
import re
import zipfile
import xml.etree.ElementTree as ET
from copy import deepcopy
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "import_wangdiantong_quiz.py"
spec = importlib.util.spec_from_file_location("import_wangdiantong_quiz", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

audit_spec = importlib.util.spec_from_file_location(
    "audit_rule_sources", ROOT / "scripts" / "audit_rule_sources.py"
)
audit_module = importlib.util.module_from_spec(audit_spec)
audit_spec.loader.exec_module(audit_module)

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def _xlsx_column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference).group(0)
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - ord("A") + 1
    return value - 1


def _xlsx_relationship_target(base_part: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(base_part), target))


def _xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.findall(f".//{{{MAIN_NS}}}t"))
        for item in root.findall(f"{{{MAIN_NS}}}si")
    ]


def _xlsx_cell_value(cell: ET.Element, shared_strings: list[str]):
    cell_type = cell.get("t")
    value_node = cell.find(f"{{{MAIN_NS}}}v")
    raw = "" if value_node is None or value_node.text is None else value_node.text
    if cell_type == "s":
        return shared_strings[int(raw)]
    if cell_type == "b":
        return raw == "1"
    if cell_type == "inlineStr":
        return "".join(
            node.text or "" for node in cell.findall(f".//{{{MAIN_NS}}}t")
        )
    if raw == "":
        return ""
    try:
        return float(raw) if any(marker in raw for marker in (".", "e", "E")) else int(raw)
    except ValueError:
        return raw


def inspect_xlsx_with_stdlib(path: Path) -> dict:
    with zipfile.ZipFile(path) as archive:
        workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet_nodes = workbook_root.findall(f".//{{{MAIN_NS}}}sheet")
        assert len(sheet_nodes) == 1
        sheet_node = sheet_nodes[0]
        relationship_id = sheet_node.get(f"{{{DOC_REL_NS}}}id")

        workbook_rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relation = next(
            node
            for node in workbook_rels.findall(f"{{{PKG_REL_NS}}}Relationship")
            if node.get("Id") == relationship_id
        )
        sheet_part = _xlsx_relationship_target("xl/workbook.xml", relation.get("Target"))
        sheet_root = ET.fromstring(archive.read(sheet_part))
        shared_strings = _xlsx_shared_strings(archive)

        parsed_rows: list[dict[int, object]] = []
        max_column = 0
        for row_node in sheet_root.findall(f".//{{{MAIN_NS}}}sheetData/{{{MAIN_NS}}}row"):
            indexed_values = {}
            for cell in row_node.findall(f"{{{MAIN_NS}}}c"):
                index = _xlsx_column_index(cell.get("r"))
                indexed_values[index] = _xlsx_cell_value(cell, shared_strings)
                max_column = max(max_column, index + 1)
            parsed_rows.append(indexed_values)
        rows = [
            [row.get(index, "") for index in range(max_column)]
            for row in parsed_rows
        ]

        sheet_view = sheet_root.find(f".//{{{MAIN_NS}}}sheetView")
        pane = sheet_view.find(f"{{{MAIN_NS}}}pane")
        table_part = sheet_root.find(f".//{{{MAIN_NS}}}tablePart")
        table_relationship_id = table_part.get(f"{{{DOC_REL_NS}}}id")
        sheet_filename = posixpath.basename(sheet_part)
        sheet_rels_part = posixpath.join(
            posixpath.dirname(sheet_part), "_rels", f"{sheet_filename}.rels"
        )
        sheet_rels = ET.fromstring(archive.read(sheet_rels_part))
        table_relation = next(
            node
            for node in sheet_rels.findall(f"{{{PKG_REL_NS}}}Relationship")
            if node.get("Id") == table_relationship_id
        )
        table_part_path = _xlsx_relationship_target(sheet_part, table_relation.get("Target"))
        table_root = ET.fromstring(archive.read(table_part_path))
        table_filter = table_root.find(f"{{{MAIN_NS}}}autoFilter")
        table_style = table_root.find(f"{{{MAIN_NS}}}tableStyleInfo")
        return {
            "sheetName": sheet_node.get("name"),
            "rows": rows,
            "showGridLines": sheet_view.get("showGridLines"),
            "pane": pane.attrib if pane is not None else {},
            "tableRef": table_root.get("ref"),
            "autoFilterRef": table_filter.get("ref") if table_filter is not None else None,
            "tableStyle": table_style.get("name") if table_style is not None else None,
        }


def authored_questions() -> list[dict]:
    return module.flatten_cards(module.load_cards())


def imported_questions() -> list[dict]:
    return module.balance_answer_positions(authored_questions())


def load_role_output() -> list[dict]:
    return json.loads(module.ROLE_JSON.read_text(encoding="utf-8"))


def test_source_has_60_cards_and_expected_fully_authored_questions_per_card():
    cards = module.load_cards()
    assert len(cards) == 60
    assert len({card.get("id") or card.get("knowledgeId") for card in cards}) == 60
    assert all(isinstance(card.get("questions"), list) for card in cards)
    assert next(card for card in cards if card["id"] == "WDT-K018")["questions"][-1]["id"] == "WDT-018-C"
    assert all(
        len(card["questions"]) == (3 if card["id"] == "WDT-K018" else 2)
        for card in cards
    )
    assert len(authored_questions()) == 121


def test_import_contract_forces_role_specific_banks_and_traceable_internal_source():
    questions = imported_questions()
    assert set(question["role"] for question in questions) <= set(module.ROLE_BANK_MAP)
    assert "全员" not in {question["role"] for question in questions}
    assert all(
        question["bank"] == module.ROLE_BANK_MAP[question["role"]]
        for question in questions
    )
    assert all(question["id"].startswith("WDT-") for question in questions)
    assert all(question["sourceId"] == "INTERNAL-WDT-YUQUE-SOP-2026" for question in questions)
    assert all(question["sourceTitle"] == "旺店通操作手册与金尊内部操作口径" for question in questions)
    assert all(question["sourceType"] == "internal_sop" for question in questions)
    assert all(question["answerBasis"] == "internal_sop" for question in questions)
    for question in questions:
        eligible = (
            question["verificationStatus"] == "verified"
            and question["humanReviewStatus"] == "approved"
            and question["sourceConflict"] is False
            and question["semanticDuplicate"] is False
        )
        assert question["effectiveForFormalExam"] is eligible


def test_modules_follow_the_confirmed_job_ownership_boundaries():
    expected_role_by_module = {
        "库存管理": "客服",
        "售后管理": "客服",
        "售后自动退款": "客服",
        "换货流程": "客服",
        "补寄流程": "客服",
        "智能退货入库": "客服",
        "订单审核": "审单",
        "订单拆分": "审单",
        "无效货品": "审单",
        "经营报表": "运营",
        "店铺对接": "运营",
        "采购入库": "采购",
        "账号管理": "管理",
        "权限管理": "管理",
    }
    questions = imported_questions()
    assert {question["module"] for question in questions} == set(expected_role_by_module)
    assert all(
        question["role"] == expected_role_by_module[question["module"]]
        for question in questions
    )


def test_user_confirmed_box_spec_question_and_answer_are_locked_verbatim():
    question = next(item for item in imported_questions() if item["id"] == "WDT-012-A")
    assert question["role"] == "审单"
    assert question["bank"] == "旺店通-审单"
    assert question["question"] == "怎么批量按照箱规拆单？"
    assert question["answerText"] == "在订单审核页面选择需要拆分的订单，点击按箱规拆分"
    assert question[f"option{question['answer']}"] == question["answerText"]
    assert question["verificationStatus"] == "verified"
    assert question["effectiveForFormalExam"] is True


def test_user_confirmed_inventory_batch_question_is_in_customer_service_bank():
    question = next(item for item in imported_questions() if item["id"] == "WDT-018-C")
    assert question["role"] == "客服"
    assert question["bank"] == "旺店通-客服"
    assert question["module"] == "库存管理"
    assert question["question"] == "在哪里查看商品的生产开始日期和批次信息？"
    assert question["answerText"] == "进入【仓储】>【库存查询】>【库存明细】"
    assert question["entryPath"] == ["仓储", "库存查询", "库存明细"]
    assert question["answer"] == "C"
    assert question[f"option{question['answer']}"] == question["answerText"]
    assert question["sourceUrl"] == "internal://jinzun/wdt/inventory-detail/2026-08-12"
    assert question["reviewedAt"] == "2026-08-12"
    assert question["effectiveForFormalExam"] is True


def test_requested_store_platforms_are_covered_by_the_training_batch():
    questions = imported_questions()
    platforms = {question["platform"] for question in questions}
    assert {
        "天猫/淘宝",
        "拼多多",
        "京东",
        "视频号",
        "抖音电商",
        "唯品会",
        "阿里巴巴",
    } <= platforms
    assert any(
        question["module"] == "店铺对接"
        and question["platform"] == "阿里巴巴"
        and question["role"] == "运营"
        for question in questions
    )


def test_menu_paths_and_mixed_sources_are_explicit_and_traceable():
    cards = {card["id"]: card for card in module.load_cards()}
    questions = {question["id"]: question for question in imported_questions()}

    for card_id in ("WDT-K018", "WDT-K019", "WDT-K020", "WDT-K021", "WDT-K022"):
        assert cards[card_id]["entryPath"][0] == "仓储"

    expected_references = {
        "WDT-K012": {
            "internal://jinzun/wdt/box-spec-split/2026-08-11",
            "https://zsxj.yuque.com/da3ftb/vgswhb/cg5ak6",
        },
        "WDT-K032": {
            "https://zsxj.yuque.com/da3ftb/vgswhb/lfgmgszg7muigf79",
            "https://zsxj.yuque.com/da3ftb/vgswhb/loknewprcqw3hhcg",
        },
        "WDT-K060": {
            "https://zsxj.yuque.com/da3ftb/vgswhb/orpevw",
            "https://zsxj.yuque.com/da3ftb/vgswhb/udks3t",
        },
    }
    for card_id, expected_urls in expected_references.items():
        references = cards[card_id]["sourceReferences"]
        assert all(isinstance(reference, dict) for reference in references)
        assert all(reference.get("section") for reference in references)
        assert {reference["url"] for reference in references} == expected_urls

    assert questions["WDT-006-B"]["sourceUrl"].endswith("/gnl6y7fuigc2v0nh")
    assert questions["WDT-012-B"]["sourceUrl"].endswith("/cg5ak6")
    assert {
        reference["url"] for reference in questions["WDT-060-A"]["sourceReferences"]
    } == expected_references["WDT-K060"]


def test_refund_and_resend_questions_stay_in_the_verified_process_stage():
    cards = {card["id"]: card for card in module.load_cards()}
    questions = {question["id"]: question for question in imported_questions()}

    assert cards["WDT-K052"]["entryPath"] == [
        "配置",
        "绑定店铺",
        "申请返款",
        "返款申请",
        "右上角申请",
    ]
    assert "授权费返款" in questions["WDT-052-A"]["question"]
    assert "授权费返款" in questions["WDT-052-B"]["question"]
    assert "按资料规定的标准控制措施" in questions["WDT-036-B"]["question"]


def test_pending_source_facts_are_never_promoted_into_formal_exam():
    card = deepcopy(module.load_cards()[0])
    question = deepcopy(card["questions"][0])
    question["verificationStatus"] = "pending"
    question["effectiveForFormalExam"] = True
    question["humanReviewStatus"] = "approved"
    result = module.canonical_question(card, question, 0)
    assert result["verificationStatus"] == "pending"
    assert result["humanReviewStatus"] == "pending"
    assert result["effectiveForFormalExam"] is False


def test_all_staff_and_unknown_roles_are_rejected_from_wdt_batch():
    card = deepcopy(module.load_cards()[0])
    for forbidden_role in ("全员", "仓储", "财务"):
        card["role"] = forbidden_role
        question = deepcopy(card["questions"][0])
        question.pop("role", None)
        try:
            module.canonical_question(card, question, 0)
        except ValueError as error:
            assert "禁止使用全员或其他岗位" in str(error)
        else:
            raise AssertionError(f"未拦截非旺店通岗位：{forbidden_role}")


def test_every_distractor_is_authored_and_explained():
    for question in imported_questions():
        options = [question[f"option{letter}"] for letter in "ABCD"]
        assert len(options) == len(set(options)) == 4
        assert question["answerText"] == question[f"option{question['answer']}"]
        wrong_letters = {letter for letter in "ABCD" if letter != question["answer"]}
        assert set(question["distractorRationales"]) == wrong_letters
        assert all(str(reason).strip() for reason in question["distractorRationales"].values())
        assert not any(
            forbidden in option
            for forbidden in module.FORBIDDEN_EASY_DISTRACTORS
            for option in options
        )


def test_answers_are_exactly_balanced_and_do_not_leak_by_uniform_length():
    questions = imported_questions()
    assert Counter(question["answer"] for question in questions) == Counter(
        {"A": 30, "B": 30, "C": 31, "D": 30}
    )
    rates = module.correct_extreme_rates(questions)
    assert rates["uniqueLongestCorrectRate"] <= 0.40
    assert rates["uniqueShortestCorrectRate"] <= 0.40
    assert module.option_length_ratio_violations(questions) == []


def test_risk_priority_is_separate_from_runtime_redline_classification():
    questions = imported_questions()
    assert {question["riskPriority"] for question in questions} == {"高", "中", "低"}
    assert {question["riskLevel"] for question in questions} == {"redline", "practice"}
    actual_redlines = {
        question["id"] for question in questions if question["riskLevel"] == "redline"
    }
    assert actual_redlines == module.REDLINE_QUESTION_IDS
    assert len(actual_redlines) == 12
    assert all(
        question["mandatory"] is (question["riskLevel"] == "redline")
        for question in questions
    )


def test_question_stems_and_complete_option_sets_are_unique():
    questions = imported_questions()
    stems = [module.normalize_text(question["question"]) for question in questions]
    signatures = [module.option_signature(question) for question in questions]
    assert len(stems) == len(set(stems)) == 121
    assert len(signatures) == len(set(signatures)) == 121


def test_wdt_formal_questions_have_no_semantic_duplicate_groups():
    assert audit_module.semantic_duplicate_groups(imported_questions()) == []


def test_learning_cards_have_direct_paths_steps_checks_and_mistakes():
    for question in imported_questions():
        assert question["knowledgeId"]
        assert question["module"]
        assert question["knowledgePoint"]
        for field in ("entryPath", "steps", "successChecks", "commonMistakes"):
            assert isinstance(question[field], list), (question["id"], field)
            assert question[field], (question["id"], field)
            assert all(str(item).strip() for item in question[field])
        for field in ("prerequisites", "exceptions"):
            assert isinstance(question[field], list), (question["id"], field)


def test_validation_gate_accepts_the_authored_batch():
    quality = module.validate_questions(imported_questions())
    assert quality["knowledgeCardCount"] == 60
    assert quality["optionSetCount"] == 121
    assert quality["answerDistribution"] == {"A": 30, "B": 30, "C": 31, "D": 30}


def test_merge_is_idempotent_and_only_replaces_wdt_prefix():
    imported = imported_questions()
    baseline = [
        {"id": "R-0001", "question": "保留题1"},
        {"id": "OPS-TB-001", "question": "保留题2"},
        {"id": "WDT-OLD-001", "question": "待替换题"},
    ]
    first = module.merge_questions(baseline, imported)
    second = module.merge_questions(first, imported)
    assert first == second
    assert first[:2] == baseline[:2]
    assert all(question.get("id") != "WDT-OLD-001" for question in first)
    assert sum(question["id"].startswith("WDT-") for question in first) == 121


def test_generated_json_matches_source_and_preserves_archived_non_wdt_questions():
    expected = imported_questions()
    output = load_role_output()
    actual = [question for question in output if question["id"].startswith("WDT-")]
    assert actual == expected
    assert len(actual) == 121

    archived = json.loads(module.ARCHIVE_JSON.read_text(encoding="utf-8"))
    output_non_wdt = [question for question in output if not question["id"].startswith("WDT-")]
    archived_non_wdt = [question for question in archived if not question["id"].startswith("WDT-")]
    assert output_non_wdt == archived_non_wdt


def test_xlsx_is_a_complete_field_mirror_of_generated_json():
    output = load_role_output()
    expected_headers = module.complete_headers(output)
    inspection = inspect_xlsx_with_stdlib(module.ROLE_XLSX)
    assert inspection["sheetName"] == "题库"
    headers = inspection["rows"][0]
    assert headers == expected_headers
    actual_rows = [tuple(row) for row in inspection["rows"][1:]]
    expected_rows = [
        tuple(module.xlsx_cell_value(question.get(field)) for field in headers)
        for question in output
    ]
    assert actual_rows == expected_rows
    assert inspection["showGridLines"] == "0"
    assert inspection["pane"] == {
        "ySplit": "1",
        "topLeftCell": "A2",
        "activePane": "bottomLeft",
        "state": "frozen",
    }
    assert inspection["tableRef"] == inspection["autoFilterRef"]
    assert inspection["tableRef"].startswith("A1:")
    assert inspection["tableRef"].endswith(str(len(output) + 1))
    assert inspection["tableStyle"].startswith("TableStyleMedium")


def test_python_importer_delegates_xlsx_authoring_to_artifact_tool():
    importer_source = SCRIPT.read_text(encoding="utf-8")
    sync_script = ROOT / "scripts" / "sync_role_quiz_xlsx.mjs"
    assert sync_script.exists()
    assert "@oai/artifact-tool" in sync_script.read_text(encoding="utf-8")
    assert "def write_xlsx" not in importer_source
    assert "from openpyxl import Workbook" not in importer_source
    assert "sync_role_quiz_xlsx.mjs" in importer_source
    assert 'xlsx_synchronized = not args.json_only' in importer_source
    assert 'tempfile.TemporaryDirectory(prefix=".wdt-import-"' in importer_source
    assert "os.replace(staged_xlsx, ROLE_XLSX)" in importer_source


def test_import_report_proves_the_quality_gates_passed():
    report = json.loads(module.REPORT_JSON.read_text(encoding="utf-8"))
    assert report["validation"] == "passed"
    assert report["knowledgeCards"] == 60
    assert report["importedQuestions"] == 121
    assert report["answerDistribution"] == {"A": 30, "B": 30, "C": 31, "D": 30}
    assert report["uniqueOptionSets"] == 121
    assert report["formalExamQuestions"] + report["pendingQuestions"] == 121
    assert report["uniqueLongestCorrectRate"] <= 0.40
    assert report["uniqueShortestCorrectRate"] <= 0.40
    assert report["maximumOptionLengthRatio"] <= 1.8
    assert sum(report["bankDistribution"].values()) == 121
    assert sum(report["roleDistribution"].values()) == 121
    assert set(report["roleDistribution"]) == set(module.ROLE_BANK_MAP)
    assert set(report["bankDistribution"]) == set(module.ROLE_BANK_MAP.values())
    assert all(
        report["bankDistribution"].get(bank, 0)
        == report["roleDistribution"].get(role, 0)
        for role, bank in module.ROLE_BANK_MAP.items()
    )
