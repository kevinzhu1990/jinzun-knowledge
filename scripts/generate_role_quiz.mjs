import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/liangyanmei/Documents/公司知识库网站/outputs/role_quiz";
const outputPath = path.join(outputDir, "岗位学习考核题库.xlsx");
const jsonOutputPath = path.join(outputDir, "岗位学习考核题库.json");

const sourceNotes = [
  ["飞书使用", "飞书帮助中心", "https://www.feishu.cn/hc/zh-CN/"],
  ["天猫运营", "淘宝/天猫商家学习与规则中心", "https://rulechannel.taobao.com/"],
  ["抖音运营", "抖音电商学习中心", "https://school.jinritemai.com/"],
  ["视频号运营", "视频号小店/微信公众平台规则与帮助", "https://channels.weixin.qq.com/"],
  ["拼多多运营", "拼多多商家后台/规则中心", "https://mms.pinduoduo.com/"],
  ["京东运营", "京东商家学习中心/规则中心", "https://mtt.jd.com/"],
  ["客服", "各平台商家后台、售后规则、客服质检要求", "以对应平台后台最新规则为准"],
  ["美工", "电商视觉规范、广告法合规、平台素材规范", "以对应平台后台最新规则为准"],
];

const questions = [];
const letters = ["A", "B", "C", "D"];

const addQuestion = ({
  bank,
  role,
  module,
  type = "单选题",
  difficulty = "基础",
  knowledgePoint,
  question,
  options,
  answer,
  explanation,
  source = "内部培训题",
  note = "",
}) => {
  const answerIndex = typeof answer === "number" ? answer : options.indexOf(answer);
  questions.push({
    id: `R-${String(questions.length + 1).padStart(4, "0")}`,
    bank,
    role,
    module,
    type,
    difficulty,
    knowledgePoint,
    question,
    optionA: options[0] ?? "",
    optionB: options[1] ?? "",
    optionC: options[2] ?? "",
    optionD: options[3] ?? "",
    answer: letters[answerIndex] ?? "",
    answerText: options[answerIndex] ?? "",
    explanation,
    source,
    note,
  });
};

const addJudge = (payload, correct, explanation) =>
  addQuestion({
    ...payload,
    type: "判断题",
    options: ["正确", "错误"],
    answer: correct ? 0 : 1,
    explanation,
  });

[
  ["飞书消息里需要让对方明确看到并处理，最合适的做法是？", ["只发一句“在吗”", "清楚说明事项、截止时间并 @ 对方", "连续发送多条无上下文消息", "只发表情"], 1, "飞书沟通要减少来回确认，关键信息、责任人和时间点要一次说清。"],
  ["新员工查找公司历史资料，优先应该使用哪个动作？", ["随便问一个同事", "在知识库/云文档中搜索关键词", "重新创建一份文件", "只看聊天截图"], 1, "知识沉淀类资料优先在知识库或云文档中搜索，减少重复劳动。"],
  ["在飞书云文档协作时，发现内容有疑问，较合适的处理是？", ["直接删掉原文", "用评论提出问题并 @ 负责人", "截图发到无关群", "私自改结论"], 1, "评论能保留上下文，也方便负责人追踪处理。"],
  ["会议前最应该在日程里补充什么？", ["只写“开会”", "会议目标、议题、参会人和相关资料链接", "不写任何信息", "只设置提醒"], 1, "清楚的日程信息能让参会人提前准备。"],
  ["飞书多维表格适合用于哪类工作？", ["存放结构化数据并多人协作", "只发闲聊消息", "替代所有设计软件", "存储个人密码"], 0, "多维表格适合任务、库存、题库、项目等结构化协作数据。"],
  ["共享公司文件时，权限设置最安全的原则是？", ["默认全员可编辑", "按需要开放查看或编辑权限", "公开到互联网", "把文件复制很多份"], 1, "权限应遵循最小可用原则，避免误改和泄露。"],
  ["群聊里收到任务后，正确的确认方式是？", ["已读不回", "明确回复收到、理解的交付物和截止时间", "转发给别人不说明", "只点个赞"], 1, "任务确认要让对方知道你理解了范围和时间。"],
  ["飞书任务清单最适合记录什么？", ["需要跟进、有责任人和截止时间的事项", "临时情绪", "无意义闲聊", "所有私人账号密码"], 0, "待办任务需要责任人、时间和状态，便于跟进。"],
  ["搜索飞书聊天记录时，哪个方法更有效？", ["只输入“那个”", "输入产品名、货号、客户名等关键词", "从第一页慢慢翻", "让别人重新发"], 1, "精准关键词能更快定位历史信息。"],
  ["跨部门沟通遇到结论变化时，最好怎么做？", ["只口头说一下", "在原文档或任务中更新结论并通知相关人", "删除旧消息", "不告诉其他人"], 1, "变更要回到源头记录，避免多个版本并存。"],
  ["使用飞书审批时，提交前应该检查什么？", ["审批流是否正确、附件和金额/事项是否完整", "只看标题", "随便选审批人", "不需要检查"], 0, "审批信息错误会影响效率和合规。"],
  ["飞书文档标题命名建议是？", ["新建文档1", "日期+主题+版本/用途", "随便一个字", "只写表情"], 1, "统一命名便于搜索、归档和版本管理。"],
  ["下面哪种行为不利于飞书协作？", ["用文档沉淀结论", "群里只发碎片信息但不整理", "给任务设置负责人", "会议后同步纪要"], 1, "碎片信息不整理，会让后续查找和执行变困难。"],
  ["飞书会议纪要应重点包含什么？", ["参会人、结论、待办、负责人、截止时间", "所有闲聊内容", "只有会议标题", "只放一张截图"], 0, "纪要服务于执行，核心是结论和待办。"],
  ["当你不确定某个文件能否外发时，应先怎么做？", ["直接发给客户", "确认文件权限和保密要求", "发到朋友圈", "复制到公开网盘"], 1, "公司资料外发要先确认权限和范围。"],
].forEach(([question, options, answer, explanation], index) => {
  addQuestion({
    bank: "飞书使用题库",
    role: "全员",
    module: "飞书使用",
    difficulty: index > 9 ? "进阶" : "基础",
    knowledgePoint: ["消息沟通", "文档协作", "日程会议", "权限安全", "任务跟进"][index % 5],
    question,
    options,
    answer,
    explanation,
    source: "飞书帮助中心/内部协作规范",
  });
});

const opsCommon = [
  ["商品上架前最先核对的是？", ["标题、主图、规格、库存、价格、详情是否一致", "只看主图好不好看", "只改活动价", "不需要核对"], 0, "上架前要先保证基础信息准确，避免售前售后问题。", "商品发布"],
  ["做活动报名前，运营必须先评估什么？", ["库存、毛利、发货能力和售后风险", "只看流量大不大", "只看竞品图", "不需要评估"], 0, "活动可能带来销量，也会放大库存、利润和履约问题。", "活动运营"],
  ["商品标题优化的核心目标是？", ["堆满重复词", "让用户和平台都能准确理解商品", "写得越夸张越好", "只写品牌名"], 1, "标题要准确覆盖核心卖点和搜索词，避免夸大。", "搜索优化"],
  ["日常看店铺数据，最基础的一组指标是？", ["访客、点击率、转化率、客单价、退款率", "天气、心情、截图数量", "只看销售额", "只看粉丝数"], 0, "基础经营数据能定位流量、承接、成交和售后问题。", "数据分析"],
  ["发现转化率突然下降，第一步应该做什么？", ["马上大幅降价", "先排查流量来源、价格、库存、评价、页面和竞品变化", "删除商品", "停止客服回复"], 1, "先定位原因，再决定动作。", "异常诊断"],
  ["客服反馈某产品被反复问同一个问题，运营应该怎么处理？", ["不管", "优化详情页、FAQ和客服话术", "让客服少回复", "下架所有商品"], 1, "高频问题说明前端信息不够清楚。", "客服协同"],
  ["平台规则类问题，最可靠的依据是？", ["群里听说", "平台后台规则中心和最新公告", "以前的习惯", "竞争对手做法"], 1, "规则会更新，平台官方后台和公告是最终依据。", "规则合规"],
  ["新品测试阶段最适合关注什么？", ["点击、收藏加购、转化、评价反馈", "只看包装颜色", "只看老板喜好", "完全不看数据"], 0, "新品要用数据判断素材、价格和卖点是否成立。", "新品运营"],
  ["库存较少但活动流量较大时，应该怎么做？", ["不提示继续卖", "控制活动节奏并同步库存/发货预案", "随便超卖", "关闭客服"], 1, "库存与履约能力要匹配流量。", "库存管理"],
  ["评价维护的正确做法是？", ["诱导虚假好评", "分析真实差评原因并改进产品/服务", "删除所有反馈", "不看评价"], 1, "评价是用户信任资产，不能靠违规方式处理。", "评价管理"],
  ["直播/短视频带货前，商品卡信息应重点保证什么？", ["价格、权益、规格、库存和承诺一致", "只要主播记得", "越模糊越好", "不用准备"], 0, "内容承诺和商品信息不一致会造成投诉。", "内容电商"],
  ["设置优惠券时，最容易出错的是？", ["券门槛、叠加关系、有效期、适用品", "券颜色", "发券人昵称", "图片尺寸"], 0, "优惠设置错误会直接影响利润和客户体验。", "促销工具"],
  ["平台店铺诊断中，点击率低通常先看什么？", ["主图、标题、价格、展示位置", "仓库灯光", "打印机", "客服头像"], 0, "点击率更多受前端展示素材和价格影响。", "流量承接"],
  ["平台售后率升高，运营应联合哪个岗位排查？", ["客服、仓库、产品、设计", "只找财务", "只找行政", "不用排查"], 0, "售后问题往往涉及商品、页面承诺、发货和沟通。", "售后协同"],
  ["竞品分析不应只看销量，还应看什么？", ["价格、规格、卖点、评价、活动、内容表达", "店铺名字长度", "客服性别", "页面背景色是否红"], 0, "竞品分析要拆解用户选择理由。", "竞品分析"],
  ["当平台要求整改商品信息时，应优先做什么？", ["忽略", "按要求核对并保留整改记录", "删掉所有商品", "改成更夸张"], 1, "及时整改能降低违规和下架风险。", "规则合规"],
  ["运营排期表至少应包含什么？", ["活动节点、负责人、商品、素材、价格、库存、截止时间", "只写月份", "只写一句加油", "不用记录"], 0, "排期表是跨岗位协作的基础。", "项目管理"],
  ["复盘一场活动最重要的输出是？", ["下一次要继续/停止/优化什么", "只说辛苦了", "只放销售额截图", "不需要复盘"], 0, "复盘要形成下一步动作。", "活动复盘"],
];

const platformProfiles = [
  ["运营-天猫", "运营", "天猫", "天猫更重视商品基础、搜索承接、活动节奏和服务体验，规则以天猫/淘宝商家后台为准。"],
  ["运营-抖音", "运营", "抖音", "抖音更重视内容种草、直播短视频承接、商品卡和达人/店铺协同，规则以抖音电商后台为准。"],
  ["运营-视频号", "运营", "视频号", "视频号更重视私域承接、内容信任、直播节奏和微信生态转化，规则以视频号后台为准。"],
  ["运营-拼多多", "运营", "拼多多", "拼多多更重视价格力、活动资源、履约和售后指标，规则以拼多多商家后台为准。"],
  ["运营-京东", "运营", "京东", "京东更重视商品信息、履约时效、服务体验、搜索和活动资源，规则以京东商家后台为准。"],
];

for (const [bank, role, module, platformNote] of platformProfiles) {
  opsCommon.forEach(([question, options, answer, explanation, point], index) => {
    addQuestion({
      bank,
      role,
      module,
      type: index % 5 === 0 ? "场景题" : "单选题",
      difficulty: index > 11 ? "进阶" : "基础",
      knowledgePoint: point,
      question: `${module}店铺中，${question}`,
      options,
      answer,
      explanation: `${explanation}${platformNote}`,
      source: `${module}平台商家学习/规则中心`,
      note: "平台规则类答案需以后续后台最新公告为准。",
    });
  });
}

[
  ["客户问“1122箱规是多少”，客服应先做什么？", ["根据产品知识库核对后回答", "随便猜一个", "让客户自己找", "答非所问"], 0, "客服涉及产品参数时必须以产品知识库为准。", "产品问答"],
  ["客户询问保质期，正确做法是？", ["按对应货号准确回答并提醒以包装标识为准", "统一说一年", "不回答", "只发价格"], 0, "食品类信息要准确，必要时提示以实物包装为准。", "产品问答"],
  ["遇到情绪激动的客户，第一步是？", ["先安抚并确认问题", "马上反驳", "不回复", "复制无关话术"], 0, "先降温、再定位问题，能降低投诉风险。", "服务沟通"],
  ["客服承诺发货时间时应依据什么？", ["仓库实际能力和平台承诺", "自己感觉", "越快越好随便说", "客户想听什么说什么"], 0, "承诺必须可履约。", "履约承诺"],
  ["客户要改地址，客服应先确认什么？", ["订单是否已发货、平台是否支持修改、客户新地址", "客户生日", "商品颜色", "活动海报"], 0, "地址变更受订单状态和平台规则影响。", "订单处理"],
  ["客户反馈少件，客服正确流程是？", ["核对订单、仓库记录、物流重量并按规则处理", "直接拒绝", "让客户再买", "不看订单"], 0, "少件问题要先核查证据链。", "售后处理"],
  ["客户问能否开发票，客服应怎么做？", ["按店铺发票规则说明开票流程和所需信息", "直接说不能", "让客户找平台", "只回复表情"], 0, "发票问题要按店铺和平台规则处理。", "交易服务"],
  ["客服发现详情页写法容易误解，应反馈给谁？", ["运营/美工并说明客户高频问题", "不管", "只在心里记着", "让客户忍耐"], 0, "客服是前线信息来源，应推动页面优化。", "跨岗协作"],
  ["客户要求超出平台规则的补偿，客服应？", ["先表达理解，再按规则说明可提供方案", "直接答应所有要求", "辱骂客户", "拉黑"], 0, "补偿要有人情味，但不能越权违规。", "售后处理"],
  ["客服回复速度和质量之间，应如何平衡？", ["快速响应，同时保证答案准确", "只追求快", "只追求慢慢写", "不回复"], 0, "客服既要及时，也要准确。", "服务效率"],
  ["下面哪种话术更专业？", ["亲，您这个不行", "您好，我先帮您核对订单状态，再给您可处理方案", "别催", "不知道"], 1, "专业话术要明确下一步动作。", "服务沟通"],
  ["客户要退换货，客服应先确认？", ["订单平台、商品状态、原因、是否符合售后规则", "客户星座", "客服心情", "商品广告语"], 0, "售后判断要基于平台规则和商品状态。", "退换货"],
  ["客户咨询团购，客服应重点收集？", ["数量、收货时间、地区、产品需求、联系方式", "客户喜欢什么颜色", "客户年龄", "无关信息"], 0, "团购需要收集完整需求再转给销售/运营。", "团购咨询"],
  ["客服发现产品知识库与页面信息不一致，应？", ["立即记录并反馈负责人核对", "按自己记忆回复", "谁问都说不知道", "删除聊天"], 0, "信息不一致要及时校准，避免扩大错误。", "信息校验"],
  ["客服交接班最重要的是？", ["未处理订单、特殊客户、承诺事项和风险点", "只说下班了", "只发一句辛苦", "无需交接"], 0, "交接不清会造成承诺断档。", "交接管理"],
  ["客户询问月饼内配，客服应优先按什么回答？", ["对应货号的内配信息", "所有月饼都一样", "随便发一张图", "只报价格"], 0, "月饼内配差异大，必须按货号核对。", "产品问答"],
  ["客户催物流，客服应？", ["查询物流节点，说明当前状态和可跟进动作", "只说快了", "不查就回复", "责怪客户"], 0, "物流问题要基于节点信息处理。", "物流问题"],
  ["客服质检通常最关注什么？", ["响应、准确、态度、合规、解决率", "字数越多越好", "表情越多越好", "是否讲段子"], 0, "质检关注服务过程和结果。", "质检标准"],
  ["遇到不确定答案时，客服应？", ["先核实再回复，必要时说明稍后确认", "直接编", "沉默", "转移话题"], 0, "不确定时不能编答案。", "服务合规"],
  ["客户投诉图片与实物不符，客服应同步哪些岗位？", ["运营、美工、仓库/品控", "只同步财务", "不用同步", "只同步保安"], 0, "图文、实物和履约都可能有关。", "跨岗协作"],
].forEach(([question, options, answer, explanation, point], index) => {
  addQuestion({
    bank: "客服题库",
    role: "客服",
    module: "售前售后",
    type: index % 4 === 0 ? "场景题" : "单选题",
    difficulty: index > 13 ? "进阶" : "基础",
    knowledgePoint: point,
    question,
    options,
    answer,
    explanation,
    source: "客服内部服务规范/各平台售后规则",
  });
});

[
  ["电商主图最重要的作用是？", ["让用户快速看懂商品和核心卖点", "放尽可能多的小字", "只追求复杂特效", "不展示商品"], 0, "主图首先服务点击和理解。", "主图设计"],
  ["详情页制作前，美工最应先确认什么？", ["产品卖点、规格、内配、禁用词、平台尺寸", "自己喜欢的颜色", "电脑壁纸", "字体越多越好"], 0, "详情页素材必须建立在准确信息上。", "详情页"],
  ["食品类页面中，涉及功效表达应注意什么？", ["避免夸大、医疗化或无法证明的承诺", "随便写养生疗效", "越绝对越好", "不用审核"], 0, "食品宣传要注意广告法和平台规范。", "合规审查"],
  ["不同平台复用图片时，最容易忽略什么？", ["尺寸、裁切、安全区和平台规则差异", "文件名", "屏幕亮度", "鼠标样式"], 0, "平台素材规格不同，直接复用可能被裁切或违规。", "平台适配"],
  ["产品图和知识库参数不一致时，美工应？", ["暂停发布并反馈核对", "按旧图继续做", "自己编参数", "删掉参数"], 0, "图文参数是客服和售后的依据，必须准确。", "信息校验"],
  ["促销海报中，价格和优惠信息应如何处理？", ["与运营确认活动时间、到手价、限制条件", "只写最低价不解释", "随便写", "不写活动时间"], 0, "优惠表达不清会造成客诉。", "活动视觉"],
  ["移动端详情页设计更应注意什么？", ["首屏信息清楚、字号可读、重点靠前", "只适配电脑", "文字越小越高级", "图片越长越好"], 0, "大多数用户在手机端浏览，移动可读性很关键。", "移动端设计"],
  ["商品卖点图中，最好的表达方式是？", ["一个画面突出一个核心卖点", "所有卖点挤在一张图", "只放背景", "只放花纹"], 0, "单图单重点更容易理解。", "信息层级"],
  ["导出图片前，应检查什么？", ["尺寸、清晰度、文字是否错别字、文件格式", "只看颜色", "只看文件夹", "不检查"], 0, "发布前检查能减少返工和客诉。", "交付检查"],
  ["设计稿命名建议是？", ["项目_平台_尺寸_版本_日期", "未命名1", "随便", "只写最终最终最终"], 0, "规范命名便于协作和追溯。", "文件管理"],
  ["美工收到“做高级一点”的需求，应该？", ["追问目标、平台、商品、参考、尺寸和交付时间", "直接开始乱做", "只换金色", "不沟通"], 0, "抽象需求要先变成可执行信息。", "需求沟通"],
  ["产品白底图通常要求什么？", ["主体清晰、边缘干净、无多余文字装饰", "背景越花越好", "加大量贴纸", "模糊也可以"], 0, "白底图服务商品识别和平台规范。", "商品图"],
  ["页面视觉层级的核心是？", ["让用户按预期顺序看到重点", "所有字一样大", "全部高饱和", "没有留白"], 0, "层级能帮助用户快速理解信息。", "视觉层级"],
  ["使用字体和素材时应注意？", ["版权授权和商用范围", "网上随便下载", "不管授权", "只要好看"], 0, "商用素材需注意版权风险。", "版权规范"],
  ["客户评价中反复说“看不懂规格”，美工应优化哪里？", ["规格说明图和对比图", "只换背景色", "删除规格", "加更多装饰"], 0, "看不懂规格说明信息表达不清。", "详情优化"],
  ["月饼产品图片题进入网站后，美工可额外支持什么？", ["统一缩略图比例和清晰度", "压到看不清", "随便裁掉货号", "隐藏产品图"], 0, "图片题依赖清晰识别，缩略图要统一。", "图片资产"],
  ["活动页首屏最应呈现什么？", ["商品/活动主题、核心权益、行动入口", "大量无关介绍", "空白", "仅公司地址"], 0, "首屏决定用户是否继续浏览。", "活动视觉"],
  ["详情页长图切片时应注意？", ["重要文字不被切断，加载大小合理", "任意位置切", "越大越好", "不看手机效果"], 0, "切片影响加载和阅读体验。", "详情页"],
  ["设计交付给运营前，最好同步什么？", ["成品图、源文件位置、适用平台、注意事项", "只发一张截图", "不说明版本", "只口头说"], 0, "交付信息完整能减少误用。", "交付协作"],
  ["下面哪项属于美工合规风险？", ["使用绝对化用语如“全网第一”", "展示真实商品", "按尺寸导出", "核对规格"], 0, "绝对化和无法证明表达容易触发合规风险。", "合规审查"],
].forEach(([question, options, answer, explanation, point], index) => {
  addQuestion({
    bank: "美工题库",
    role: "美工",
    module: "电商视觉",
    type: index % 4 === 0 ? "场景题" : "单选题",
    difficulty: index > 12 ? "进阶" : "基础",
    knowledgePoint: point,
    question,
    options,
    answer,
    explanation,
    source: "电商视觉规范/平台素材规范/内部设计流程",
  });
});

addJudge(
  {
    bank: "客服题库",
    role: "客服",
    module: "服务合规",
    difficulty: "基础",
    knowledgePoint: "服务合规",
    question: "客服遇到不确定的产品参数，可以先凭印象回答，之后再更正。",
    source: "客服内部服务规范",
  },
  false,
  "产品参数必须先核对再回复，避免误导客户。"
);

addJudge(
  {
    bank: "美工题库",
    role: "美工",
    module: "电商视觉",
    difficulty: "基础",
    knowledgePoint: "信息校验",
    question: "美工制作产品详情页时，应优先保证图文信息与知识库一致。",
    source: "内部设计流程",
  },
  true,
  "图文信息一致能减少客服解释和售后争议。"
);

const workbook = Workbook.create();
const headers = [
  "题目ID",
  "题库",
  "岗位",
  "平台/模块",
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
  "学习资料/来源",
  "备注",
];

const toMatrix = (items) => [
  headers,
  ...items.map((q) => [
    q.id,
    q.bank,
    q.role,
    q.module,
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
    q.source,
    q.note,
  ]),
];

const styleSheet = (sheet, rowCount) => {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  const used = sheet.getRangeByIndexes(0, 0, rowCount, headers.length);
  used.format.font.name = "PingFang SC";
  used.format.font.size = 10;
  used.format.wrapText = true;
  used.format.verticalAlignment = "Top";
  const header = sheet.getRangeByIndexes(0, 0, 1, headers.length);
  header.format.fill.color = "#0E1B2A";
  header.format.font.color = "#FFFFFF";
  header.format.font.bold = true;
  header.format.horizontalAlignment = "Center";
  header.format.rowHeightPx = 34;
  sheet.getRange("A:A").format.columnWidthPx = 92;
  sheet.getRange("B:D").format.columnWidthPx = 120;
  sheet.getRange("E:G").format.columnWidthPx = 92;
  sheet.getRange("H:H").format.columnWidthPx = 260;
  sheet.getRange("I:L").format.columnWidthPx = 185;
  sheet.getRange("M:M").format.columnWidthPx = 72;
  sheet.getRange("N:O").format.columnWidthPx = 250;
  sheet.getRange("P:Q").format.columnWidthPx = 180;
  sheet.tables.add(`A1:Q${rowCount}`, true, `Table_${sheet.index}`);
};

const writeSheet = (sheet, items) => {
  const matrix = toMatrix(items);
  sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).values = matrix;
  styleSheet(sheet, matrix.length);
};

writeSheet(workbook.worksheets.add("题库总表"), questions);

for (const sheetName of [
  "飞书使用题库",
  "运营-天猫",
  "运营-抖音",
  "运营-视频号",
  "运营-拼多多",
  "运营-京东",
  "客服题库",
  "美工题库",
]) {
  writeSheet(
    workbook.worksheets.add(sheetName),
    questions.filter((q) => q.bank === sheetName)
  );
}

const sourceSheet = workbook.worksheets.add("学习资料来源");
const sourceRows = [["模块", "资料名称", "链接/说明"], ...sourceNotes];
sourceSheet.getRangeByIndexes(0, 0, sourceRows.length, 3).values = sourceRows;
sourceSheet.showGridLines = false;
sourceSheet.getRange("A1:C1").format.fill.color = "#0E1B2A";
sourceSheet.getRange("A1:C1").format.font.color = "#FFFFFF";
sourceSheet.getRange("A1:C1").format.font.bold = true;
sourceSheet.getRange("A:C").format.font.name = "PingFang SC";
sourceSheet.getRange("A:C").format.wrapText = true;
sourceSheet.getRange("A:A").format.columnWidthPx = 120;
sourceSheet.getRange("B:B").format.columnWidthPx = 260;
sourceSheet.getRange("C:C").format.columnWidthPx = 520;
sourceSheet.tables.add(`A1:C${sourceRows.length}`, true, `Table_${sourceSheet.index}`);

const summarySheet = workbook.worksheets.add("使用说明");
const byBank = [...new Map(questions.map((q) => [q.bank, 0])).keys()].map((bank) => [
  bank,
  questions.filter((q) => q.bank === bank).length,
]);
const summaryRows = [
  ["岗位学习考核题库", ""],
  ["题库总量", questions.length],
  ["题型", "单选题、判断题、场景题"],
  ["分模块题量", byBank.map(([bank, count]) => `${bank}：${count}题`).join("；")],
  ["适用方式", "可按岗位/平台选择题库，也可导入网站后随机抽题。"],
  ["规则提醒", "平台规则、处罚标准、活动门槛会更新，正式培训时以平台后台/规则中心最新公告为准。"],
];
summarySheet.getRangeByIndexes(0, 0, summaryRows.length, 2).values = summaryRows;
summarySheet.showGridLines = false;
summarySheet.getRange("A1:B1").merge();
summarySheet.getRange("A1").format.fill.color = "#0E1B2A";
summarySheet.getRange("A1").format.font.color = "#FFFFFF";
summarySheet.getRange("A1").format.font.bold = true;
summarySheet.getRange("A1").format.font.size = 16;
summarySheet.getRange("A:B").format.font.name = "PingFang SC";
summarySheet.getRange("A:B").format.wrapText = true;
summarySheet.getRange("A:A").format.columnWidthPx = 130;
summarySheet.getRange("B:B").format.columnWidthPx = 720;
summarySheet.getRange(`A2:A${summaryRows.length}`).format.font.bold = true;

await fs.mkdir(outputDir, { recursive: true });

const inspect = await workbook.inspect({
  kind: "table",
  range: "题库总表!A1:Q8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 17,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 20 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "题库总表", range: "A1:Q12", scale: 1, format: "png" });
await fs.writeFile(path.join(outputDir, "岗位题库预览.png"), new Uint8Array(await preview.arrayBuffer()));
await fs.writeFile(jsonOutputPath, JSON.stringify(questions, null, 2), "utf8");
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({
  outputPath,
  jsonOutputPath,
  questionCount: questions.length,
  counts: Object.fromEntries(byBank),
}, null, 2));
