from __future__ import annotations
import json, os, re, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(os.environ.get('JINZUN_SOURCE_XLSX', str(ROOT.parents[2]/'26年金尊产品信息表（月饼+饼干）20260709更新.xlsx')))
PRODUCT=ROOT/'outputs/product_quiz/金尊产品知识库题库.json'
VERSION='20260713-product-sync'
sys.path.insert(0,str(ROOT/'scripts'))
import generate_product_quiz as generator

def main():
    errors=[]
    if not SOURCE.is_file(): errors.append(f'缺少权威Excel：{SOURCE}')
    if errors: print('\n'.join(errors)); raise SystemExit(1)
    data=generator.read_book(); active=set()
    for sheet in ('26年月饼礼盒','26年散饼','26年糕点饼干'):
        for row in data.get(sheet,[]):
            c=generator.code(generator.get(row,'货号')); n=generator.get(row,'产品名称')
            if c and n: active.add(c)
    qs=json.loads(PRODUCT.read_text(encoding='utf-8'))
    ids=[str(q.get('id','')) for q in qs]
    if len(ids)!=len(set(ids)): errors.append('产品题库ID重复')
    for q in qs:
        if q.get('version')!=VERSION: errors.append(f"{q.get('id')}版本不一致")
        if '=DISPIMG(' in json.dumps(q,ensure_ascii=False): errors.append(f"{q.get('id')}仍包含DISPIMG公式")
        if q.get('answer') not in 'ABCD': errors.append(f"{q.get('id')}答案字母无效")
        else:
            if q.get('knowledgePoint')=='看货号选图片': actual=q.get('option'+q['answer']+'Image','')
            else: actual=q.get('option'+q['answer'],'')
            if actual!=q.get('answerText',''): errors.append(f"{q.get('id')}正确答案与answerText不一致")
        if q.get('code') and q.get('bank') in ('月饼题库','日常年货题库') and q.get('code') not in active: errors.append(f"{q.get('id')}使用源表外货号")
    product_codes={str(q.get('code')) for q in qs if q.get('bank') in ('月饼题库','日常年货题库') and q.get('knowledgePoint')=='产品名称'}
    image_codes={str(q.get('code')) for q in qs if q.get('bank') in ('月饼题库','日常年货题库') and q.get('knowledgePoint')=='看图片选货号'}
    moon={str(q.get('code')) for q in qs if q.get('bank')=='月饼题库'}
    moon_image={str(q.get('code')) for q in qs if q.get('bank')=='月饼题库' and q.get('knowledgePoint')=='看货号选图片'}
    if product_codes!=active: errors.append(f'产品货号集合不一致：题库{len(product_codes)}源表{len(active)}')
    if product_codes!=image_codes: errors.append('产品货号没有完整图片识别题')
    if moon!=moon_image: errors.append('月饼货号没有完整货号选图片题')
    text=PRODUCT.read_text(encoding='utf-8')
    for forbidden in (chr(0x76ee)+chr(0x997c),'150g'+chr(0x514b),'2576'+chr(0x7c92)*2+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+chr(0x5c0f)+chr(0x76d2)+chr(0x88c5)+'258g','2576'+chr(0x7c92)*2+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+'258g'):
        if forbidden in text: errors.append(f'存在禁用旧文字：{forbidden}')
    if '2608杏仁饼258g' not in text: errors.append('2576正式名称未更新')
    result={'ok':not errors,'source':str(SOURCE),'activeProducts':len(active),'productQuestions':len(qs),'productCodes':len(product_codes),'mooncakeCodes':len(moon),'errors':errors}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if errors: raise SystemExit(1)
if __name__=='__main__': main()

