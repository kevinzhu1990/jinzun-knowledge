import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "/Users/liangyanmei/Downloads/金尊产品知识库_Excel版---d9395a19-d2c1-488b-99a9-030f909c05ab.xlsx";
const dailyImageInputDir = "/Users/liangyanmei/Desktop/2026年糕点年货内配图/1440-1440";
const mooncakeImageInputDir = "/Users/liangyanmei/Desktop/2025年内配图";
const dailyImageAssetDir = "/Users/liangyanmei/Documents/公司知识库网站/assets/product-images/daily";
const mooncakeImageAssetDir = "/Users/liangyanmei/Documents/公司知识库网站/assets/product-images/mooncake";
const outputDir = path.resolve("outputs/product_quiz");
const outputPath = path.join(outputDir, "金尊产品知识库题库.xlsx");
const jsonOutputPath = path.join(outputDir, "金尊产品知识库题库.json");
const retiredCodes = new Set([
  "1532",
  "1535",
  "1538",
  "1541",
  "1544",
  "1609",
  "1615",
  "1619",
  "1620",
  "2007",
  "2100",
  "2233",
  "2312",
  "2313",
  "2315",
  "2346",
  "2371",
  "2372",
  "2391",
  "2392",
  "2402",
  "2459",
  "2463",
  "2467",
  "2468",
  "2472",
  "2476",
  "2477",
  "2478",
  "2480",
  "2481",
  "2482",
  "2483",
  "2491",
  "2502",
  "2503",
  "2511",
  "2515",
  "2539",
  "2540",
  "2575",
  "1539",
  "1548",
  "1607",
  "1916",
  "2123",
  "2196",
  "2197",
  "2198",
  "2232",
  "2232A",
  "2393",
  "2450",
  "2451",
  "2479",
  "1701彩盒",
  "2097",
  "1183",
  "1656",
  "1690",
  "1701",
  "2071",
  "2077",
  "2091",
  "2098",
  "2201",
  "2202",
  "2217",
  "2220",
  "2221",
  "2331",
  "2345",
  "2421",
  "2429",
  "2431",
  "2532",
  "2551"
]);
const isRetiredCode = (code) => [...retiredCodes].some((retiredCode) => String(code).startsWith(retiredCode));

const sourceBlob = await FileBlob.load(inputPath);
const sourceWorkbook = await SpreadsheetFile.importXlsx(sourceBlob);
const sourceSheet = sourceWorkbook.worksheets.getItem("产品总表");
const rows = sourceSheet.getUsedRange().values;
const headers = rows[0].map((h) => String(h ?? "").trim());

const get = (row, name) => {
  const index = headers.indexOf(name);
  if (index < 0) return "";
  const value = row[index];
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text === "NaN" || text === "nan" ? "" : text;
};

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\r?\n+/g, "；")
    .replace(/\s+/g, " ")
    .replace(/；\s*；/g, "；")
    .trim();

const canonicalShelfLife = (value) => {
  const text = normalizeText(value);
  const digits = text.match(/\d+/)?.[0];
  if (!digits) return text;
  const number = Number(digits);
  const days = text.includes("天") ? number : text.includes("月") ? number * 30 : number;
  const map = new Map([
    [30, "30天"],
    [45, "45天"],
    [90, "90天/3个月"],
    [180, "180天/6个月"],
    [270, "270天/9个月"],
    [300, "300天/10个月"],
    [360, "360天/12个月"],
  ]);
  return map.get(days) ?? text;
};

const sourceRows = rows
  .slice(1)
  .map((row) => ({
    code: normalizeText(get(row, "货号")),
    name: normalizeText(get(row, "产品名称")),
    category: normalizeText(get(row, "一级分类")),
    productLine: normalizeText(get(row, "产品线")),
    series: normalizeText(get(row, "系列")),
    netWeight: normalizeText(get(row, "净重")),
    specification: normalizeText(get(row, "规格")),
    cartonSpec: normalizeText(get(row, "箱规")),
    contents: normalizeText(get(row, "内配/口味")),
    shelfLife: canonicalShelfLife(get(row, "保质期")),
    productSize: normalizeText(get(row, "产品尺寸")),
    unitWeight: normalizeText(get(row, "单品重量kg")),
    outerBoxSize: normalizeText(get(row, "外箱尺寸")),
    boxWeight: normalizeText(get(row, "整箱重量kg")),
    sizeOrBox: normalizeText(get(row, "尺寸/外箱")),
    platform: normalizeText(get(row, "平台")),
    origin: normalizeText(get(row, "产地")),
    maker: normalizeText(get(row, "厂家")),
    unit: normalizeText(get(row, "单位")),
    sellingPoint: normalizeText(get(row, "核心卖点")),
  }))
  .filter((row) => row.code && row.name && row.category && !isRetiredCode(row.code));

const unique = (values) => [...new Set(values.filter(Boolean))];
const byCategory = (field, category) => unique(sourceRows.filter((row) => row.category === category).map((row) => row[field]));
const allValues = (field) => unique(sourceRows.map((row) => row[field]));
const dailyRowsByCode = new Map(sourceRows.filter((row) => row.category === "日常年货产品").map((row) => [row.code, row]));
const mooncakeRowsByCode = new Map(sourceRows.filter((row) => row.category === "月饼产品").map((row) => [row.code, row]));

const productLineOverrides = new Map([
  ["1918", "曲奇/饼干类"],
  ["2223", "月饼-礼盒"],
  ["2587", "糕点礼盒类"],
  ["2576", "糕点类"],
  ["2577", "糕点类"],
  ["2578", "糕点类"],
]);
for (const row of sourceRows) {
  const override = productLineOverrides.get(row.code);
  if (override) row.productLine = override;
}

const pickDistractors = (answer, pool, fallbackPool, count = 3) => {
  const cleanAnswer = normalizeText(answer);
  const merged = unique([...pool, ...fallbackPool])
    .map(normalizeText)
    .filter((value) => value && value !== cleanAnswer);
  const chosen = [];
  for (const value of merged) {
    if (chosen.length >= count) break;
    chosen.push(value);
  }
  return chosen;
};

const shuffle = (items, seedText) => {
  const arr = [...items];
  let seed = 0;
  for (const char of seedText) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const letters = ["A", "B", "C", "D"];

const makeQuestion = ({ row, field, knowledgePoint, stem, answer, pool, difficulty = "基础" }) => {
  const distractors = pickDistractors(answer, pool, allValues(field));
  if (!answer || distractors.length < 3) return null;
  const options = shuffle([answer, ...distractors.slice(0, 3)], `${row.code}-${knowledgePoint}-${answer}`);
  const correctLetter = letters[options.findIndex((option) => option === answer)];
  return {
    id: `P-${String(questions.length + 1).padStart(4, "0")}`,
    bank: row.category === "包装/耗材" ? "纸箱耗材题库" : row.category === "日常年货产品" ? "日常年货题库" : "月饼题库",
    category: row.category,
    productLine: row.productLine,
    code: row.code,
    productName: row.name,
    type: "单选题",
    difficulty,
    knowledgePoint,
    question: stem,
    optionA: options[0],
    optionB: options[1],
    optionC: options[2],
    optionD: options[3],
    answer: correctLetter,
    answerText: answer,
    explanation: `${row.code}（${row.name}）的${knowledgePoint}是：${answer}。`,
    questionImage: "",
    optionAImage: "",
    optionBImage: "",
    optionCImage: "",
    optionDImage: "",
  };
};

const questions = [];
for (const row of sourceRows) {
  const categoryPool = byCategory("category", row.category);
  const cartonPool = byCategory("cartonSpec", row.category);
  const contentsPool = byCategory("contents", row.category);
  const weightPool = byCategory("netWeight", row.category);
  const namePool = byCategory("name", row.category);
  const productLinePool = byCategory("productLine", row.category);
  const sizePool = byCategory("sizeOrBox", row.category);
  const shelfLifePool = byCategory("shelfLife", row.category);
  const unitPool = byCategory("unit", row.category);

  const candidates = [
    makeQuestion({
      row,
      field: "category",
      knowledgePoint: "产品类型",
      stem: `${row.code} 是什么类型的产品？`,
      answer: row.category,
      pool: categoryPool,
    }),
    makeQuestion({
      row,
      field: "productLine",
      knowledgePoint: "产品线",
      stem: `${row.code} 属于哪条产品线？`,
      answer: row.productLine,
      pool: productLinePool,
    }),
    makeQuestion({
      row,
      field: "cartonSpec",
      knowledgePoint: "箱规",
      stem: `${row.code} 的箱规是多少？`,
      answer: row.cartonSpec,
      pool: cartonPool,
    }),
    makeQuestion({
      row,
      field: "name",
      knowledgePoint: "产品名称",
      stem: `${row.code} 对应的产品名称是什么？`,
      answer: row.name,
      pool: namePool,
    }),
  ];

  if (row.category === "包装/耗材") {
    candidates.push(
      makeQuestion({
        row,
        field: "sizeOrBox",
        knowledgePoint: "尺寸/外箱",
        stem: `${row.code} 的尺寸/外箱是多少？`,
        answer: row.sizeOrBox,
        pool: sizePool,
      }),
      makeQuestion({
        row,
        field: "unit",
        knowledgePoint: "单位",
        stem: `${row.code} 的单位是什么？`,
        answer: row.unit,
        pool: unitPool,
      })
    );
  } else {
    candidates.push(
      makeQuestion({
        row,
        field: "contents",
        knowledgePoint: "内配/口味",
        stem: `${row.code} 的内配/口味是什么？`,
        answer: row.contents,
        pool: contentsPool,
        difficulty: "重点",
      }),
      makeQuestion({
        row,
        field: "netWeight",
        knowledgePoint: "克重/净重",
        stem: `${row.code} 的克重/净重是多少？`,
        answer: row.netWeight,
        pool: weightPool,
      }),
      makeQuestion({
        row,
        field: "shelfLife",
        knowledgePoint: "保质期",
        stem: `${row.code} 的保质期是多少？`,
        answer: row.shelfLife,
        pool: shelfLifePool,
      })
    );
  }

  questions.push(...candidates.filter(Boolean));
}

const loadImageRows = async ({ inputDir, assetDir, rowsByCode, assetSegment }) => {
  await fs.rm(assetDir, { recursive: true, force: true });
  await fs.mkdir(assetDir, { recursive: true });
  const files = (await fs.readdir(inputDir))
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .map((file) => {
      const code = file.match(/^\d+/)?.[0] ?? "";
      return { file, code };
    })
    .filter((item) => item.code && rowsByCode.has(item.code))
    .sort((a, b) => a.code.localeCompare(b.code, "zh-Hans-CN", { numeric: true }));

  for (const item of files) {
    await fs.copyFile(path.join(inputDir, item.file), path.join(assetDir, `${item.code}.jpg`));
  }

  return files.map((item) => ({
    ...rowsByCode.get(item.code),
    image: `assets/product-images/${assetSegment}/${item.code}.jpg`,
  }));
};

const dailyImageRows = await loadImageRows({
  inputDir: dailyImageInputDir,
  assetDir: dailyImageAssetDir,
  rowsByCode: dailyRowsByCode,
  assetSegment: "daily",
});

const mooncakeImageRows = await loadImageRows({
  inputDir: mooncakeImageInputDir,
  assetDir: mooncakeImageAssetDir,
  rowsByCode: mooncakeRowsByCode,
  assetSegment: "mooncake",
});

const pickRowDistractors = (imageRows, answerCode, seedText) => {
  const shuffled = shuffle(imageRows.filter((item) => item.code !== answerCode), seedText);
  return shuffled.slice(0, 3);
};

const makeImageToCodeQuestion = (row, imageRows) => {
  const distractors = pickRowDistractors(imageRows, row.code, `${row.code}-image-code`);
  if (distractors.length < 3) return null;
  const options = shuffle([row, ...distractors], `${row.code}-看图片选货号`);
  const letters = ["A", "B", "C", "D"];
  const correctLetter = letters[options.findIndex((option) => option.code === row.code)];
  return {
    id: "",
    bank: row.category === "月饼产品" ? "月饼题库" : "日常年货题库",
    category: row.category,
    productLine: row.productLine,
    code: row.code,
    productName: row.name,
    type: "图片识别题",
    difficulty: "重点",
    knowledgePoint: "看图片选货号",
    question: "看图片，选出正确的产品货号。",
    optionA: `${options[0].code}｜${options[0].name}`,
    optionB: `${options[1].code}｜${options[1].name}`,
    optionC: `${options[2].code}｜${options[2].name}`,
    optionD: `${options[3].code}｜${options[3].name}`,
    answer: correctLetter,
    answerText: row.code,
    explanation: `图片对应的产品是 ${row.code}（${row.name}）。`,
    questionImage: row.image,
    optionAImage: "",
    optionBImage: "",
    optionCImage: "",
    optionDImage: "",
  };
};

const makeCodeToImageQuestion = (row, imageRows) => {
  const distractors = pickRowDistractors(imageRows, row.code, `${row.code}-code-image`);
  if (distractors.length < 3) return null;
  const options = shuffle([row, ...distractors], `${row.code}-看货号选图片`);
  const letters = ["A", "B", "C", "D"];
  const correctLetter = letters[options.findIndex((option) => option.code === row.code)];
  return {
    id: "",
    bank: row.category === "月饼产品" ? "月饼题库" : "日常年货题库",
    category: row.category,
    productLine: row.productLine,
    code: row.code,
    productName: row.name,
    type: "图片选择题",
    difficulty: "重点",
    knowledgePoint: "看货号选图片",
    question: `${row.code} 对应哪一张产品图片？`,
    optionA: "图片A",
    optionB: "图片B",
    optionC: "图片C",
    optionD: "图片D",
    answer: correctLetter,
    answerText: row.image,
    explanation: `${row.code} 对应的产品图片是 ${row.image}，产品名称：${row.name}。`,
    questionImage: "",
    optionAImage: options[0].image,
    optionBImage: options[1].image,
    optionCImage: options[2].image,
    optionDImage: options[3].image,
  };
};

const dailyVisualQuestions = dailyImageRows
  .flatMap((row) => [makeImageToCodeQuestion(row, dailyImageRows), makeCodeToImageQuestion(row, dailyImageRows)])
  .filter(Boolean);
const mooncakeVisualQuestions = mooncakeImageRows
  .flatMap((row) => [makeImageToCodeQuestion(row, mooncakeImageRows), makeCodeToImageQuestion(row, mooncakeImageRows)])
  .filter(Boolean);
const visualQuestions = [...dailyVisualQuestions, ...mooncakeVisualQuestions];
questions.push(...visualQuestions);

questions.forEach((question, index) => {
  question.id = `P-${String(index + 1).padStart(4, "0")}`;
});


const addScenarioQuestions = () => {
  const productNames = unique(sourceRows.map((row) => row.name));
  const productLines = unique(sourceRows.map((row) => row.productLine || row.category));
  let scenarioIndex = 1;
  for (const row of sourceRows.slice(0, 260)) {
    const serviceOptions = shuffle([row.name, ...pickDistractors(row.name, productNames, productNames)], `${row.code}-客服推荐`).slice(0, 4);
    questions.push({
      id: `S-${String(scenarioIndex++).padStart(4, "0")}`,
      bank: "业务场景题库",
      category: row.category,
      productLine: row.productLine,
      code: row.code,
      productName: row.name,
      type: "单选题",
      difficulty: "场景",
      knowledgePoint: "客服推荐",
      question: `客户想找“${row.productLine || row.category}”相关产品，客服优先推荐哪一款最准确？`,
      optionA: serviceOptions[0], optionB: serviceOptions[1], optionC: serviceOptions[2], optionD: serviceOptions[3],
      answer: letters[serviceOptions.findIndex((option) => option === row.name)],
      answerText: row.name,
      explanation: `题干需求指向 ${row.productLine || row.category}，应优先匹配产品 ${row.code} ${row.name}，避免推荐到不相关品类。`,
      questionImage: "", optionAImage: "", optionBImage: "", optionCImage: "", optionDImage: "",
      source: "金尊产品知识库/业务场景补充",
      note: "",
    });
    const lineAnswer = row.productLine || row.category;
    const lineOptions = shuffle([lineAnswer, ...pickDistractors(lineAnswer, productLines, productLines)], `${row.code}-运营活动`).slice(0, 4);
    questions.push({
      id: `S-${String(scenarioIndex++).padStart(4, "0")}`,
      bank: "业务场景题库",
      category: row.category,
      productLine: row.productLine,
      code: row.code,
      productName: row.name,
      type: "单选题",
      difficulty: "场景",
      knowledgePoint: "运营活动",
      question: `运营做活动素材时，${row.code} 这款商品应归到哪个产品线，方便活动分组？`,
      optionA: lineOptions[0], optionB: lineOptions[1], optionC: lineOptions[2], optionD: lineOptions[3],
      answer: letters[lineOptions.findIndex((option) => option === lineAnswer)],
      answerText: lineAnswer,
      explanation: `${row.code}（${row.name}）属于 ${lineAnswer}，活动分组、关键词和页面素材应保持一致。`,
      questionImage: "", optionAImage: "", optionBImage: "", optionCImage: "", optionDImage: "",
      source: "金尊产品知识库/业务场景补充",
      note: "",
    });
  }
};

addScenarioQuestions();

const workbook = Workbook.create();
const defaultSheet = workbook.worksheets.add("题库总表");

const outputHeaders = [
  "题目ID",
  "题库",
  "一级分类",
  "产品线",
  "货号",
  "产品名称",
  "题型",
  "难度",
  "知识点",
  "题目",
  "A",
  "B",
  "C",
  "D",
  "正确答案",
  "答案内容",
  "解析",
  "题目图片",
  "A图片",
  "B图片",
  "C图片",
  "D图片",
];

const toMatrix = (items) => [
  outputHeaders,
  ...items.map((q) => [
    q.id,
    q.bank,
    q.category,
    q.productLine,
    q.code,
    q.productName,
    q.type,
    q.difficulty,
    q.knowledgePoint,
    q.question,
    q.optionA,
    q.optionB,
    q.optionC,
    q.optionD,
    q.answer,
    q.answerText,
    q.explanation,
    q.questionImage ?? "",
    q.optionAImage ?? "",
    q.optionBImage ?? "",
    q.optionCImage ?? "",
    q.optionDImage ?? "",
  ]),
];

const styleSheet = (sheet, rowCount, colCount) => {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  const used = sheet.getRangeByIndexes(0, 0, rowCount, colCount);
  used.format.font.name = "PingFang SC";
  used.format.font.size = 10;
  used.format.wrapText = true;
  used.format.verticalAlignment = "Top";
  const header = sheet.getRangeByIndexes(0, 0, 1, colCount);
  header.format.fill.color = "#102033";
  header.format.font.color = "#FFFFFF";
  header.format.font.bold = true;
  header.format.horizontalAlignment = "Center";
  header.format.rowHeightPx = 34;
  sheet.getRange("A:A").format.columnWidthPx = 92;
  sheet.getRange("B:B").format.columnWidthPx = 110;
  sheet.getRange("C:C").format.columnWidthPx = 105;
  sheet.getRange("D:D").format.columnWidthPx = 120;
  sheet.getRange("E:E").format.columnWidthPx = 90;
  sheet.getRange("F:F").format.columnWidthPx = 210;
  sheet.getRange("G:I").format.columnWidthPx = 82;
  sheet.getRange("J:J").format.columnWidthPx = 230;
  sheet.getRange("K:N").format.columnWidthPx = 190;
  sheet.getRange("O:O").format.columnWidthPx = 72;
  sheet.getRange("P:Q").format.columnWidthPx = 240;
  sheet.getRange("R:V").format.columnWidthPx = 210;
  sheet.tables.add(`A1:V${rowCount}`, true, `Table_${sheet.index}`);
};

const writeSheet = (sheet, items) => {
  const matrix = toMatrix(items);
  sheet.getRangeByIndexes(0, 0, matrix.length, outputHeaders.length).values = matrix;
  styleSheet(sheet, matrix.length, outputHeaders.length);
};

writeSheet(defaultSheet, questions);

for (const [sheetName, filter] of [
  ["月饼题库", (q) => q.bank === "月饼题库"],
  ["日常年货题库", (q) => q.bank === "日常年货题库"],
  ["纸箱耗材题库", (q) => q.bank === "纸箱耗材题库"],
  ["日常年货图片题", (q) => q.bank === "日常年货题库" && (q.type === "图片识别题" || q.type === "图片选择题")],
  ["月饼图片题", (q) => q.bank === "月饼题库" && (q.type === "图片识别题" || q.type === "图片选择题")],
]) {
  const sheet = workbook.worksheets.add(sheetName);
  writeSheet(sheet, questions.filter(filter));
}

const summarySheet = workbook.worksheets.add("使用说明");
summarySheet.showGridLines = false;
const summaryRows = [
  ["金尊产品知识库题库", ""],
  ["来源文件", inputPath],
  ["生成范围", "产品总表：月饼产品、日常年货产品、包装/耗材"],
  ["题目数量", questions.length],
  ["题型", "单选题、图片识别题、图片选择题"],
  ["题目规则", "按货号自动生成产品类型、产品线、箱规、产品名称、内配/口味、克重/净重、保质期、尺寸/外箱、单位等题目；日常年货和月饼图片按文件名货号生成看图片选货号、看货号选图片题。"],
  ["图片题数量", visualQuestions.length],
  ["日常年货图片题", `${dailyVisualQuestions.length} 题，匹配图片 ${dailyImageRows.length} 张；素材目录：${dailyImageAssetDir}`],
  ["月饼图片题", `${mooncakeVisualQuestions.length} 题，匹配图片 ${mooncakeImageRows.length} 张；素材目录：${mooncakeImageAssetDir}`],
  ["已排除淘汰货号", [...retiredCodes].join("、")],
  ["网站导入建议", "优先导入题库总表；也可以按月饼题库、日常年货题库、纸箱耗材题库分模块导入。"],
  ["核对提醒", "个别原始表格为空的字段已自动跳过，没有强行生成题目。"],
];
summarySheet.getRangeByIndexes(0, 0, summaryRows.length, 2).values = summaryRows;
summarySheet.getRange("A1:B1").merge();
summarySheet.getRange("A1").format.fill.color = "#102033";
summarySheet.getRange("A1").format.font.color = "#FFFFFF";
summarySheet.getRange("A1").format.font.bold = true;
summarySheet.getRange("A1").format.font.size = 16;
summarySheet.getRange("A:B").format.font.name = "PingFang SC";
summarySheet.getRange("A:B").format.wrapText = true;
summarySheet.getRange("A:A").format.columnWidthPx = 130;
summarySheet.getRange("B:B").format.columnWidthPx = 720;
summarySheet.getRange(`A2:A${summaryRows.length}`).format.font.bold = true;
summarySheet.getRange(`A2:B${summaryRows.length}`).format.verticalAlignment = "Top";

await fs.mkdir(outputDir, { recursive: true });

const inspect = await workbook.inspect({
  kind: "table",
  range: "题库总表!A1:V8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 22,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 20 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "题库总表", range: "A1:V12", scale: 1, format: "png" });
await fs.writeFile(path.join(outputDir, "题库总表预览.png"), new Uint8Array(await preview.arrayBuffer()));

await fs.writeFile(jsonOutputPath, JSON.stringify(questions, null, 2), "utf8");
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({
  outputPath,
  jsonOutputPath,
  sourceRows: sourceRows.length,
  questionCount: questions.length,
  visualQuestionCount: visualQuestions.length,
  matchedImageCount: dailyImageRows.length + mooncakeImageRows.length,
  dailyVisualQuestionCount: dailyVisualQuestions.length,
  dailyMatchedImageCount: dailyImageRows.length,
  mooncakeVisualQuestionCount: mooncakeVisualQuestions.length,
  mooncakeMatchedImageCount: mooncakeImageRows.length,
  counts: {
    mooncake: questions.filter((q) => q.bank === "月饼题库").length,
    daily: questions.filter((q) => q.bank === "日常年货题库").length,
    packaging: questions.filter((q) => q.bank === "纸箱耗材题库").length,
  },
}, null, 2));
