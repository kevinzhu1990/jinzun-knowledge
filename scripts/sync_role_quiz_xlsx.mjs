#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { deflateRawSync, inflateRawSync } from "node:zlib";

const DEFAULT_INPUT = "outputs/role_quiz/岗位学习考核题库.json";
const DEFAULT_OUTPUT = "outputs/role_quiz/岗位学习考核题库.xlsx";

async function loadArtifactTool() {
  try {
    return await import("@oai/artifact-tool");
  } catch (packageError) {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const configured = process.env.CODEX_ARTIFACT_TOOL_PATH || "";
    const candidates = [
      configured,
      path.resolve(
        path.dirname(process.execPath),
        "..",
        "node_modules",
        "@oai",
        "artifact-tool",
        "dist",
        "artifact_tool.mjs",
      ),
      home
        ? path.join(
            home,
            ".cache",
            "codex-runtimes",
            "codex-primary-runtime",
            "dependencies",
            "node",
            "node_modules",
            "@oai",
            "artifact-tool",
            "dist",
            "artifact_tool.mjs",
          )
        : "",
    ].filter(Boolean);

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return await import(pathToFileURL(candidate).href);
      } catch {
        // Try the next Codex runtime location.
      }
    }
    throw new Error(
      "找不到 @oai/artifact-tool。请在 Codex 工作区运行，或将 CODEX_ARTIFACT_TOOL_PATH 指向 artifact_tool.mjs。",
      { cause: packageError },
    );
  }
}

const BASE_FIELDS = [
  "id",
  "bank",
  "role",
  "module",
  "platform",
  "type",
  "difficulty",
  "riskPriority",
  "riskLevel",
  "mandatory",
  "knowledgeId",
  "knowledgePoint",
  "knowledgeTitle",
  "question",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "answer",
  "answerText",
  "explanation",
  "distractorRationales",
  "goal",
  "entryPath",
  "prerequisites",
  "steps",
  "successChecks",
  "exceptions",
  "commonMistakes",
  "source",
  "sourceUrl",
  "sourceReferences",
  "sourceSection",
  "sourceClause",
  "sourceId",
  "sourceTitle",
  "sourceType",
  "sourceLevel",
  "answerBasis",
  "verificationStatus",
  "effectiveForFormalExam",
  "humanReviewStatus",
  "sourceConflict",
  "semanticDuplicate",
  "reviewedAt",
  "reviewNote",
  "importBatch",
  "note",
];

function usage() {
  return [
    "Usage: node scripts/sync_role_quiz_xlsx.mjs [options]",
    "",
    `  --input <json>       Source JSON (default: ${DEFAULT_INPUT})`,
    `  --output <xlsx>      Target workbook (default: ${DEFAULT_OUTPUT})`,
    "  --id-prefix <text>   Export only IDs beginning with this prefix",
    "  --preview <png>      Also render the top-left review range to PNG",
    "  --help               Show this help",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    idPrefix: "",
    preview: "",
  };
  const aliases = new Map([
    ["--input", "input"],
    ["--output", "output"],
    ["--id-prefix", "idPrefix"],
    ["--preview", "preview"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    const key = aliases.get(arg);
    if (!key) {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function cellValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(canonicalize(value));
  }
  return value;
}

function completeHeaders(records) {
  const present = new Set(records.flatMap((record) => Object.keys(record)));
  const headers = BASE_FIELDS.filter((field) => present.has(field));
  const seen = new Set(headers);
  for (const record of records) {
    for (const field of Object.keys(record)) {
      if (!seen.has(field)) {
        headers.push(field);
        seen.add(field);
      }
    }
  }
  return headers;
}

function columnName(index) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function columnWidth(field) {
  if (field === "question") return 48;
  if (["explanation", "distractorRationales"].includes(field)) return 50;
  if (["steps", "successChecks", "exceptions", "commonMistakes"].includes(field)) return 44;
  if (["optionA", "optionB", "optionC", "optionD"].includes(field)) return 36;
  if (["answerText", "goal", "entryPath", "prerequisites", "reviewNote", "note"].includes(field)) return 38;
  if (field === "sourceUrl") return 42;
  if (["knowledgePoint", "knowledgeTitle", "source", "sourceTitle"].includes(field)) return 26;
  if (["sourceSection", "sourceClause"].includes(field)) return 28;
  if (["id", "knowledgeId", "sourceId", "importBatch"].includes(field)) return 20;
  if (["bank", "module"].includes(field)) return 18;
  if (["platform", "verificationStatus", "humanReviewStatus"].includes(field)) return 15;
  if (["effectiveForFormalExam", "semanticDuplicate", "sourceConflict"].includes(field)) return 17;
  return Math.max(10, Math.min(16, field.length + 3));
}

function safeTableName(idPrefix) {
  return idPrefix ? "FilteredRoleQuizTable" : "RoleQuizTable";
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function readZipEntries(buffer) {
  let eocdOffset = -1;
  const earliest = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Unable to locate XLSX central directory");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid XLSX central directory entry at ${offset}`);
    }
    const versionMade = buffer.readUInt16LE(offset + 4);
    const versionNeeded = buffer.readUInt16LE(offset + 6);
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const modTime = buffer.readUInt16LE(offset + 12);
    const modDate = buffer.readUInt16LE(offset + 14);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const internalAttributes = buffer.readUInt16LE(offset + 36);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const nameBuffer = buffer.subarray(offset + 46, offset + 46 + nameLength);
    const name = nameBuffer.toString("utf8");

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Invalid XLSX local entry for ${name}`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    if (![0, 8].includes(method)) {
      throw new Error(`Unsupported XLSX ZIP compression method ${method} for ${name}`);
    }
    entries.push({
      name,
      data,
      method,
      flags: flags & ~0x08,
      versionMade,
      versionNeeded,
      modTime,
      modDate,
      internalAttributes,
      externalAttributes,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function writeZipEntries(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const method = entry.method === 0 ? 0 : 8;
    const compressed = method === 0 ? entry.data : deflateRawSync(entry.data, { level: 6 });
    const checksum = crc32(entry.data);
    const flags = entry.flags | (/[\u0080-\uffff]/u.test(entry.name) ? 0x0800 : 0);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(entry.versionNeeded || 20, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(entry.modTime, 10);
    localHeader.writeUInt16LE(entry.modDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(entry.versionMade || 20, 4);
    centralHeader.writeUInt16LE(entry.versionNeeded || 20, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(entry.modTime, 12);
    centralHeader.writeUInt16LE(entry.modDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(entry.internalAttributes, 36);
    centralHeader.writeUInt32LE(entry.externalAttributes, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

async function ensureFrozenHeaderRow(xlsxPath) {
  const entries = readZipEntries(await fs.readFile(xlsxPath));
  const sheetEntry = entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml");
  if (!sheetEntry) throw new Error("Generated XLSX is missing xl/worksheets/sheet1.xml");

  let xml = sheetEntry.data.toString("utf8");
  const pane = '<x:pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen" />';
  const selection = '<x:selection pane="bottomLeft" activeCell="A2" sqref="A2" />';
  if (/<x:sheetView\b[^>]*\/>/u.test(xml)) {
    xml = xml.replace(/<x:sheetView\b([^>]*)\/>/u, `<x:sheetView$1>${pane}${selection}</x:sheetView>`);
  } else if (/<x:sheetView\b[^>]*>[\s\S]*?<\/x:sheetView>/u.test(xml)) {
    xml = xml.replace(
      /<x:sheetView\b([^>]*)>[\s\S]*?<\/x:sheetView>/u,
      `<x:sheetView$1>${pane}${selection}</x:sheetView>`,
    );
  } else {
    throw new Error("Generated XLSX is missing a worksheet sheetView");
  }
  sheetEntry.data = Buffer.from(xml, "utf8");
  await fs.writeFile(xlsxPath, writeZipEntries(entries));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { SpreadsheetFile, Workbook } = await loadArtifactTool();
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const previewPath = args.preview ? path.resolve(args.preview) : "";

  const parsed = JSON.parse(await fs.readFile(inputPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Source JSON must contain an array: ${inputPath}`);
  }
  const records = args.idPrefix
    ? parsed.filter((record) => String(record?.id ?? "").startsWith(args.idPrefix))
    : parsed;
  if (records.length === 0) {
    throw new Error(`No questions matched --id-prefix ${JSON.stringify(args.idPrefix)}`);
  }

  const headers = completeHeaders(records);
  const rows = records.map((record) => headers.map((field) => cellValue(record[field])));
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("题库");
  sheet.showGridLines = false;

  const lastColumn = columnName(headers.length - 1);
  const lastRow = rows.length + 1;
  const usedRange = sheet.getRange(`A1:${lastColumn}${lastRow}`);
  usedRange.values = [headers, ...rows];
  usedRange.format = {
    font: { name: "Microsoft YaHei", size: 10, color: "#1F2937" },
    verticalAlignment: "top",
    wrapText: true,
  };

  const headerRange = sheet.getRange(`A1:${lastColumn}1`);
  headerRange.format = {
    fill: "#17365D",
    font: { name: "Microsoft YaHei", size: 10, bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#102A43" },
  };
  headerRange.format.rowHeight = 32;

  if (lastRow > 1) {
    const bodyRange = sheet.getRange(`A2:${lastColumn}${lastRow}`);
    bodyRange.format = {
      font: { name: "Microsoft YaHei", size: 10, color: "#1F2937" },
      verticalAlignment: "top",
      wrapText: true,
      borders: {
        insideHorizontal: { style: "thin", color: "#E2E8F0" },
      },
    };
    bodyRange.format.rowHeight = 46;
  }

  headers.forEach((field, index) => {
    const letter = columnName(index);
    sheet.getRange(`${letter}1:${letter}${lastRow}`).format.columnWidth = columnWidth(field);
  });

  sheet.freezePanes.freezeRows(1);
  const table = sheet.tables.add(`A1:${lastColumn}${lastRow}`, true, safeTableName(args.idPrefix));
  table.style = "TableStyleMedium2";
  table.showHeaders = true;
  table.showFilterButton = true;
  table.showBandedColumns = false;

  const inspectEndColumn = columnName(Math.min(headers.length - 1, 19));
  const inspectEndRow = Math.min(lastRow, 8);
  const contentCheck = await workbook.inspect({
    kind: "table",
    range: `题库!A1:${inspectEndColumn}${inspectEndRow}`,
    include: "values,formulas",
    tableMaxRows: inspectEndRow,
    tableMaxCols: Math.min(headers.length, 20),
    maxChars: 6000,
  });
  const formulaErrors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 300 },
    summary: "role quiz formula error scan",
    maxChars: 3000,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  // artifact-tool 2.8.6 currently omits the pane record during XLSX export.
  // Keep all workbook authoring in artifact-tool, then repair only that missing
  // worksheet-view record so Excel actually freezes row 1 at A2.
  await ensureFrozenHeaderRow(outputPath);

  if (previewPath) {
    const renderEndColumn = columnName(Math.min(headers.length - 1, 19));
    const renderEndRow = Math.min(lastRow, 12);
    const preview = await workbook.render({
      sheetName: "题库",
      range: `A1:${renderEndColumn}${renderEndRow}`,
      scale: 1.25,
      format: "png",
    });
    await fs.mkdir(path.dirname(previewPath), { recursive: true });
    await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        input: inputPath,
        output: outputPath,
        idPrefix: args.idPrefix || null,
        questions: records.length,
        fields: headers.length,
        sheet: "题库",
        table: safeTableName(args.idPrefix),
        preview: previewPath || null,
        contentInspect: contentCheck.ndjson,
        formulaErrorScan: formulaErrors.ndjson,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}
