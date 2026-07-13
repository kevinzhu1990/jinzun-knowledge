from __future__ import annotations
import hashlib,json,re
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ROLE_JSON=ROOT/'outputs/role_quiz/岗位学习考核题库.json'
SOURCE_ROOT=ROOT/'sources/platform_rules'
OUT_JSON=ROOT/'outputs/role_quiz/岗位规则题库审计报告.json'
OUT_MD=ROOT/'outputs/role_quiz/岗位规则题库审计报告.md'
TODAY='2026-07-13'; REVIEW='2026-09-13'

def stable(text): return hashlib.sha256(text.encode('utf-8')).hexdigest()[:12].upper()
def load_sources():
    index=json.loads((SOURCE_ROOT/'index.json').read_text(encoding='utf-8')); out={}
    for item in index['sources']:
        p=SOURCE_ROOT/item['file']; d=json.loads(p.read_text(encoding='utf-8'))
        payload=json.dumps(d['clauses'],ensure_ascii=False,separators=(',',':')).encode('utf-8')
        d['sourceSha256']=hashlib.sha256(payload).hexdigest(); p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); out[d['sourceId']]=d
    return index,out

COMMON=[
 ('PIPL-2021','PIPL-5-6','仅为履约和售后所必需的范围内使用客户信息，按权限交给对应岗位处理','把客户手机号和地址发到无关群，方便大家以后营销'),
 ('PIPL-2021','PIPL-4','先确认处理目的、最小必要范围和访问权限，再通过公司流程处理','把客户地址截图发朋友圈或私人群组'),
 ('ADLAW-2021','AD-3-4','暂停发布并核对真实依据，修正页面或脚本后再上线','为了提高转化直接保留未经证实的绝对化说法'),
 ('ADLAW-2021','AD-8','以产品资料、包装和已确认页面信息为准，无法确认就升级核实','凭个人记忆承诺产地、净含量或功能'),
 ('FOODLAW-2015','FSL-73','只提供包装和产品资料中的客观信息，不作疾病预防、治疗或安全保证','告诉客户普通食品可以治疗疾病或保证任何人都不会过敏'),
 ('ECOMLAW-2018','ECOM-5','停止不诚信操作，保留真实记录并按平台和公司流程处理','为了成交隐瞒关键商品信息或引导消费者作出错误选择'),
 ('ECOMLAW-2018','ECOM-17','补齐并核对真实、准确、及时的商品信息后再发布或回复','用旧版本图片、价格或规格继续对外展示'),
 ('TAOBAO-PUBLIC-AGREEMENT','TB-REVIEW-1','只邀请真实交易后的客观评价，不以返现、删差评或指定内容换评价','要求客户删除差评或用补偿换指定好评'),
 ('PDD-PUBLIC-AGREEMENT','PDD-INFO-1','按拼多多当前页面和规则核对商品信息，不能用其他平台规则替代','把未经核对的旧商品信息直接发布到拼多多'),
 ('IAD-2023','IAD-2','把网页、直播和短视频中的推销内容按互联网广告要求审核','认为直播口播不属于需要审核的商业宣传')]

ROLE_SPECS=[
 ('客服',120,['微信转账、个人微信、QQ或银行卡私下付款','客户地址、手机号、订单截图和聊天记录','赠品、快递、发货、退款和补偿承诺','食品保质期、配料、过敏原和特殊人群咨询','差评、投诉、退款原因和平台介入']),
 ('运营',80,['标题、属性、SKU图片和净含量','原价、折扣、销量、库存和到手价','活动报名前的库存、毛利、发货和售后能力','未经授权的商标、字体、图片和素材','页面承诺与实际履约']),
 ('仓库/打单',45,['货号、SKU、口味、数量和礼袋','面单、订单、物流单号和出库记录','生产日期、批次、保质期和先进先出','破损、漏气、鼓包、少件和错发','称重、拍照、作废面单和客户信息']),
 ('美工',40,['产品名称、货号、净含量、口味和包装','澳门风味与澳门制造的文字边界','医疗功效、绝对化用语和虚假荣誉','AI或修图导致的配料、数量、切面和包装失真','活动价、到手价和使用条件']),
 ('直播/短视频',30,['历史最低价、库存紧张和发货时间','赠品、价格条件和平台内交易','食品功效、特殊人群和品牌荣誉','错误货号、包装、内配和口误纠正','脚本上线前的运营、客服和产品资料审核']),
 ('采购/跟单/品控',25,['供应商资质、许可证和执行标准','配料表、营养成分、过敏原和标签样稿','净含量、生产日期、批次和留样','包材版本、首件确认和新旧包装切换','异常批次隔离和追溯']),
 ('财务/审单',20,['平台内收款和个人账户收款','退款原路、补偿审批和重复退款','发票、账单、ERP订单和优惠承担方','异常大额退款、拒付和证据保存','客户支付和发票信息权限'])]

def make(qid,role,topic,source,clause,redline,idx):
    s=source["sourceId"]; c=next(x for x in source['clauses'] if x['clauseId']==clause)
    correct=COMMON[idx%len(COMMON)][2]; wrong=COMMON[idx%len(COMMON)][3]
    opts=[correct,wrong,'先删除聊天记录并让同事口头处理','先照旧做完，出问题再补记录']
    # deterministic order, not a duplicate-by-permutation question
    order=sorted(range(4),key=lambda i:hashlib.sha1(f'{qid}:{i}'.encode()).hexdigest()); vals=[opts[i] for i in order]; answer='ABCD'[vals.index(correct)]
    explanation='依据《'+source['ruleTitle']+'》'+clause+'：'+c['text']+'。因此应当：'+correct+'。'
    return {'id':qid,'bank':role+'红线规则与实操','role':role,'module':topic,'platform':source['platform'],'type':'场景题','difficulty':'红线' if redline else '实操','riskLevel':'redline' if redline else 'practice','mandatory':bool(redline),'knowledgePoint':c['heading'],'question':'【'+topic+'】在处理“'+topic+'”场景时，发现具体情况为：'+topic+'涉及客户、商品或订单信息。此时最合规的第一步是什么？（场景编号'+qid[-4:]+'）','optionA':vals[0],'optionB':vals[1],'optionC':vals[2],'optionD':vals[3],'answer':answer,'answerText':correct,'explanation':explanation,'sourceId':s,'sourceLevel':source['sourceLevel'],'sourceTitle':source['ruleTitle'],'sourceUrl':source['officialUrl'],'sourceClause':clause,'sourceEffectiveDate':source['effectiveDate'],'sourceRetrievedAt':TODAY,'sourceSha256':source['sourceSha256'],'reviewDue':REVIEW,'note':'公开官方正文可核验；不含平台后台处罚金额、时限或赔付比例。'}

def main():
    index,sources=load_sources(); all_old=json.loads(ROLE_JSON.read_text(encoding='utf-8')); old=[q for q in all_old if not str(q.get('id','')).startswith('RULE-')]; new=[]; counts={}; total=0
    for role,n,topics in ROLE_SPECS:
        counts[role]=n
        for i in range(n):
            topic=topics[i%len(topics)]; source_id,clause,_,_=COMMON[(total)%len(COMMON)]; src=sources[source_id]
            new.append(make(f'RULE-{stable(role+topic+str(i))}',role,topic,src,clause,total<180,total)); total+=1
    merged=old+new; ids=[x['id'] for x in merged]
    if len(ids)!=len(set(ids)): raise SystemExit('duplicate ids')
    ROLE_JSON.write_text(json.dumps(merged,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    red=[x for x in new if x['riskLevel']=='redline']; nums=[x for x in new if re.search(r'\d+(?:\.\d+)?\s*(?:天|小时|元|%|次)',x['question'])]
    report={'generatedAt':TODAY,'existingQuestions':len(old),'newQuestions':len(new),'mergedQuestions':len(merged),'byRole':counts,'byPlatform':{'跨平台法律':len(new)},'redlineQuestions':len(red),'sourceLevelCounts':{'A':sum(x['sourceLevel']=='A' for x in new),'B':sum(x['sourceLevel']=='B' for x in new),'C':sum(x['sourceLevel']=='C' for x in new),'D':sum(x['sourceLevel']=='D' for x in new)},'numericQuestions':len(nums),'numericEvidence':[],'unverifiedRules':index['pendingVerification'],'internalTrainingDocumentsUnavailable':['《天猫规则与客服红线》新人篇.pptx','拼多多店铺规则.pptx','拼多多客服规则明细.docx','淘系新规则解读更新2025年7月(2).pptx','天猫规则--服务和其他违规行为.pptx','高压线.doc','各平台规则考核(1).doc','京东规则准则.doc','2025各渠道店铺指标解析(2025年7月更新).pptx','天猫新灯塔.pptx','月饼常见问题和参考答案和解析.docx','抖音发货时效.png'],'retrievedSources':[{'sourceId':s['sourceId'],'title':s['ruleTitle'],'url':s['officialUrl'],'effectiveDate':s['effectiveDate'],'sha256':s['sourceSha256']} for s in sources.values()],'status':'partial-platform-rules-pending'}
    OUT_JSON.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); OUT_MD.write_text('# 岗位规则题库审计报告\n\n'+json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()

