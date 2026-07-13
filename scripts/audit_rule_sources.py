from __future__ import annotations
import hashlib,json,re
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]; SR=ROOT/'sources/platform_rules'; Q=ROOT/'outputs/role_quiz/岗位学习考核题库.json'; OUT=ROOT/'outputs/role_quiz/岗位规则题库审计报告.json'
ALLOWED=('npc.gov.cn','gov.cn','samr.gov.cn','nhc.gov.cn','cac.gov.cn','taobao.com','tmall.com','alicdn.com','pinduoduo.com','yangkeduo.com')
def main():
    idx=json.loads((SR/'index.json').read_text(encoding='utf8')); sources={}
    for item in idx['sources']:
        d=json.loads((SR/item['file']).read_text(encoding='utf8')); sources[d['sourceId']]=d
        digest=hashlib.sha256(json.dumps(d['clauses'],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
        if not d.get('sourceSha256') or d['sourceSha256']!=digest: raise SystemExit(f"source hash invalid: {d['sourceId']}")
        if d.get('status')!='current': raise SystemExit(f"source not current: {d['sourceId']}")
        host=urlparse(d.get('officialUrl','')).hostname or ''
        if not any(host==domain or host.endswith('.'+domain) for domain in ALLOWED): raise SystemExit(f"source domain not allowed: {d['sourceId']}")
    qs=json.loads(Q.read_text(encoding='utf8')); new=[q for q in qs if str(q.get('id','')).startswith('RULE-')]; errors=[]; stems=set()
    for q in new:
        for f in ('sourceId','sourceLevel','sourceTitle','sourceUrl','sourceClause','sourceSha256','sourceEffectiveDate','reviewDue','answerBasis','verificationStatus','effectiveForFormalExam'):
            if not q.get(f): errors.append(f"{q.get('id')} missing {f}")
        if q.get('sourceId') not in sources: errors.append(f"{q.get('id')} unknown source")
        if q.get('mandatory') and q.get('riskLevel')!='redline': errors.append(f"{q.get('id')} mandatory risk mismatch")
        if q.get('sourceLevel')=='D': errors.append(f"{q.get('id')} uses D source")
        if q.get('verificationStatus') in ('superseded','forbidden','pending') or q.get('sourceConflict') or q.get('effectiveForFormalExam') is not True: errors.append(f"{q.get('id')} is not eligible for formal exam")
        if q.get('answer') not in 'ABCD' or q.get('answerText')!=q.get('option'+q.get('answer','')): errors.append(f"{q.get('id')} answer mismatch")
        opts=[q.get('option'+x) for x in 'ABCD'];
        if len(set(opts))!=4: errors.append(f"{q.get('id')} duplicate options")
        answer_text=q.get('answerText','')
        if any(x in answer_text for x in ('适合所有人','木糖醇不是糖','绝对不会坏','50年月饼老店','澳门生产','澳门制造','赔付25%','最高500元')): errors.append(f"{q.get('id')} contains forbidden answer wording")
        stem=q.get('question','').strip()
        if stem in stems: errors.append(f"{q.get('id')} duplicate stem")
        stems.add(stem)
    if errors: print('\n'.join(errors[:50])); raise SystemExit(1)
    print(json.dumps({'ok':True,'newRuleQuestions':len(new),'sources':len(sources),'pending':len(idx['pendingVerification'])},ensure_ascii=False,indent=2))
if __name__=='__main__':main()

