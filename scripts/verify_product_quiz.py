from __future__ import annotations
import hashlib, json, os, re, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(os.environ.get('JINZUN_SOURCE_XLSX', str(ROOT.parent/'26年金尊产品信息表（月饼+饼干）20260709更新.xlsx')))
PRODUCT=ROOT/'outputs/product_quiz/金尊产品知识库题库.json'
SNAPSHOT=ROOT/'sources/product_info/product_source_snapshot_20260709.json'
SYNC_REPORT=ROOT/'outputs/product_quiz/product_sync_diff_20260713.json'
VERSION='20260714-product-sync'
sys.path.insert(0,str(ROOT/'scripts'))
import generate_product_quiz as generator

def load_authoritative_products():
    sync_report=json.loads(SYNC_REPORT.read_text(encoding='utf-8'))
    expected_hash=str(sync_report.get('sourceSha256',''))
    sheets=('26年月饼礼盒','26年散饼','26年糕点饼干')
    if SOURCE.is_file():
        actual_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
        if actual_hash!=expected_hash:
            raise ValueError(f'权威Excel哈希与同步记录不一致：{actual_hash}')
        generator.SOURCE=SOURCE
        data=generator.read_book(); products=[]
        for sheet in sheets:
            for row in data.get(sheet,[]):
                code=generator.code(generator.get(row,'货号')); name=generator.get(row,'产品名称')
                if code and name:
                    products.append({'code':code,'name':name,'shelfLife':generator.get(row,'保质期'),'sheet':sheet})
        return products,SOURCE

    if not SNAPSHOT.is_file():
        raise FileNotFoundError(f'缺少权威Excel且缺少可追溯快照：{SOURCE}；{SNAPSHOT}')
    snapshot=json.loads(SNAPSHOT.read_text(encoding='utf-8'))
    if snapshot.get('snapshotVersion')!='20260709-product-source-v1':
        raise ValueError('产品权威快照版本不正确')
    if snapshot.get('sourceSha256')!=expected_hash:
        raise ValueError('产品权威快照与原始Excel同步哈希不一致')
    products=snapshot.get('products')
    if not isinstance(products,list) or len(products)!=73:
        raise ValueError('产品权威快照必须包含73个在售产品')
    codes=[str(product.get('code') or '') for product in products]
    if len(codes)!=len(set(codes)) or any(not code for code in codes):
        raise ValueError('产品权威快照货号为空或重复')
    if any(not str(product.get('name') or '') or not str(product.get('shelfLife') or '') for product in products):
        raise ValueError('产品权威快照缺少产品名称或保质期')
    actual_sheets={sheet:sum(product.get('sheet')==sheet for product in products) for sheet in sheets}
    if snapshot.get('sheets')!=actual_sheets:
        raise ValueError('产品权威快照工作表计数与产品明细不一致')
    return products,SNAPSHOT

def main():
    errors=[]
    try:
        products,authority_source=load_authoritative_products()
    except (FileNotFoundError,ValueError,json.JSONDecodeError) as error:
        errors.append(str(error))
        print('\n'.join(errors)); raise SystemExit(1)
    active={str(product['code']) for product in products}
    source_shelf={str(product['code']):str(product['shelfLife']) for product in products}
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
        if q.get('knowledgePoint')=='保质期' and q.get('code') in source_shelf and q.get('answerText')!=source_shelf[q.get('code')]:
            errors.append(f"{q.get('id')}保质期与源表不一致：题库{q.get('answerText')}源表{source_shelf[q.get('code')]}")
        if q.get('bank')=='商家编码题库':
            name_references=generator.merchant_name_references(q.get('productName',''))
            if not name_references<=active:errors.append(f"{q.get('id')} 组合名称包含停售货号：{sorted(name_references-active)}")
            for field in ('answerText','optionA','optionB','optionC','optionD'):
                references=generator.merchant_code_references(q.get(field,''))
                if not references:errors.append(f"{q.get('id')} {field}没有可识别的在售货号")
                elif not references<=active:errors.append(f"{q.get('id')} {field}包含停售货号：{sorted(references-active)}")
    product_codes={str(q.get('code')) for q in qs if q.get('bank') in ('月饼题库','日常年货题库') and q.get('knowledgePoint')=='产品名称'}
    image_codes={str(q.get('code')) for q in qs if q.get('bank') in ('月饼题库','日常年货题库') and q.get('knowledgePoint')=='看图片选货号'}
    moon={str(q.get('code')) for q in qs if q.get('bank')=='月饼题库'}
    moon_image={str(q.get('code')) for q in qs if q.get('bank')=='月饼题库' and q.get('knowledgePoint')=='看货号选图片'}
    if product_codes!=active: errors.append(f'产品货号集合不一致：题库{len(product_codes)}源表{len(active)}')
    if product_codes!=image_codes: errors.append('产品货号没有完整图片识别题')
    if moon!=moon_image: errors.append('月饼货号没有完整货号选图片题')
    text=PRODUCT.read_text(encoding='utf-8')
    if '2576' in text: errors.append('产品题库仍包含已停用货号2576')
    for forbidden in (chr(0x76ee)+chr(0x997c),'150g'+chr(0x514b),'2576'+chr(0x7c92)*2+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+chr(0x5c0f)+chr(0x76d2)+chr(0x88c5)+'258g','2576'+chr(0x7c92)*2+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+'258g'):
        if forbidden in text: errors.append(f'存在禁用旧文字：{forbidden}')
    if '"code": "2608"' not in text or '杏仁饼258g' not in text: errors.append('2608杏仁饼资料未正确生成')
    merchant_questions=sum(q.get('bank')=='商家编码题库' for q in qs)
    result={'ok':not errors,'source':str(authority_source),'rawExcelAvailable':SOURCE.is_file(),'activeProducts':len(active),'productQuestions':len(qs),'merchantQuestions':merchant_questions,'productCodes':len(product_codes),'mooncakeCodes':len(moon),'errors':errors}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if errors: raise SystemExit(1)
if __name__=='__main__': main()
