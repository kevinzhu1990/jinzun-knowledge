from __future__ import annotations
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; Q=ROOT/'outputs/role_quiz/岗位学习考核题库.json'; INDEX=ROOT/'sources/platform_rules/index.json'
def main():
    qs=json.loads(Q.read_text(encoding='utf8')); idx=json.loads(INDEX.read_text(encoding='utf8')); rules=[q for q in qs if str(q.get('id','')).startswith('RULE-')]; errors=[]
    if len(rules)<360: errors.append(f'新增岗位规则题不足360：{len(rules)}')
    if sum(q.get('role')=='客服' for q in rules)<120: errors.append('客服题不足120')
    if sum(q.get('role')=='运营' for q in rules)<80: errors.append('运营题不足80')
    if sum(q.get('role')=='仓库/打单' for q in rules)<45: errors.append('仓库题不足45')
    if sum(q.get('role')=='美工' for q in rules)<40: errors.append('美工题不足40')
    if sum(q.get('role')=='直播/短视频' for q in rules)<30: errors.append('直播题不足30')
    if sum(q.get('role')=='采购/跟单/品控' for q in rules)<25: errors.append('采购品控题不足25')
    if sum(q.get('role')=='财务/审单' for q in rules)<20: errors.append('财务题不足20')
    if sum(q.get('riskLevel')=='redline' for q in rules)<180: errors.append('红线题不足180')
    for q in rules:
        if q.get('sourceLevel') not in ('A','B','C'): errors.append(f"{q.get('id')} source level invalid")
        if q.get('riskLevel')=='redline' and q.get('mandatory') is not True: errors.append(f"{q.get('id')} mandatory/risk invalid")
        if '以平台最新规则为准' in q.get('question','') and not q.get('sourceId'): errors.append(f"{q.get('id')} vague source")
    if errors: print('\n'.join(errors)); raise SystemExit(1)
    print(json.dumps({'ok':True,'existingQuestions':len(qs)-len(rules),'newQuestions':len(rules),'redlineQuestions':sum(q.get('riskLevel')=='redline' for q in rules),'pendingVerification':len(idx['pendingVerification'])},ensure_ascii=False,indent=2))
if __name__=='__main__':main()

