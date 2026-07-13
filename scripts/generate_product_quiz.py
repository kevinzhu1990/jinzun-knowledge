from __future__ import annotations
import hashlib,json,os,re,zipfile,xml.etree.ElementTree as ET
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(os.environ['JINZUN_SOURCE_XLSX'])
VERSION='20260713-product-sync'
SOURCE_LABEL=SOURCE.stem
OUT=ROOT/'outputs/product_quiz'
PRODUCT_JSON=OUT/'金尊产品知识库题库.json'
PRODUCT_XLSX=OUT/'金尊产品知识库题库.xlsx'
AUDIT=ROOT/'outputs/quiz_logic_audit.json'
DIFF_JSON=OUT/'product_sync_diff_20260713.json'
DIFF_MD=OUT/'product_sync_diff_20260713.md'
NS={'a':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def clean(v):
    s='' if v is None else str(v); s=re.sub(r'\r?\n+','；',s); s=re.sub(r'\s+',' ',s).strip()
    s=s.replace(chr(0x76ee)+chr(0x997c),chr(0x6708)+chr(0x997c)); s=re.sub(r'(\d+)g'+chr(0x514b),r'\1g',s)
    s=s.replace('2576'+chr(0x7c92)*2+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+chr(0x5c0f)+chr(0x76d2)+chr(0x88c5)+'258g','2576：2608'+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+'258g')
    s=s.replace('2576'+chr(0x7c92)*2+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+'258g','2576：2608'+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+'258g')
    s=re.sub('2576'+chr(0x7c92)*2+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+r'(?:小盒装)?258(?:g)?(?:\*?\d+|[一二三四五六]盒)?','2576：2608'+chr(0x674f)+chr(0x4ec1)+chr(0x997c)+'258g',s)
    return '' if s.lower() in {'none','nan'} else s.strip('； ')
def k(v): return re.sub(r'[\s：:；;（）()/\\_\-]+','',clean(v)).lower()
def code(v):
    s=clean(v); s=s[:-2] if re.fullmatch(r'\d+\.0',s) else s
    return s.zfill(4) if s.isdigit() and len(s)<4 else s
def strings(z):
    if 'xl/sharedStrings.xml' not in z.namelist(): return []
    r=ET.fromstring(z.read('xl/sharedStrings.xml'))
    return [''.join(x.text or '' for x in i.iter() if x.tag.endswith('}t')) for i in r]
def cval(c,ss):
    if c.attrib.get('t')=='inlineStr': return clean(''.join(x.text or '' for x in c.iter() if x.tag.endswith('}t')))
    v=c.find('a:v',NS)
    if v is None:return ''
    return clean(ss[int(v.text)]) if c.attrib.get('t')=='s' else clean(v.text)
def col(ref):
    n=0
    for x in re.sub(r'\d','',ref): n=n*26+ord(x.upper())-64
    return n
def read_book():
    with zipfile.ZipFile(SOURCE) as z:
        ss=strings(z); b=ET.fromstring(z.read('xl/workbook.xml')); rel=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rm={x.attrib['Id']:x.attrib['Target'] for x in rel}; result={}
        for sh in b.find('a:sheets',NS):
            name=sh.attrib['name']; rid=sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            root=ET.fromstring(z.read('xl/'+rm[rid].lstrip('/'))); rows=[]
            for row in root.findall('.//a:sheetData/a:row',NS): rows.append({col(c.attrib.get('r','A1')):cval(c,ss) for c in row})
            heads={i:clean(v) for i,v in (rows[0].items() if rows else [])}
            result[name]=[{heads[i]:clean(v) for i,v in r.items() if heads.get(i)} for r in rows[1:] if any(r.values())]
    return result
def get(row,*names):
    d={k(x):clean(v) for x,v in row.items()}
    for n in names:
        if d.get(k(n)): return d[k(n)]
    for n in names:
        for a,v in d.items():
            if k(n) in a or a in k(n):
                if v:return v
    return ''
def line(name,contents):
    t=name+contents
    if any(x in t for x in ('曲奇','饼干')):return '曲奇/饼干类'
    if any(x in t for x in ('蛋卷','凤凰卷')):return '蛋卷类'
    if any(x in t for x in ('礼盒','组合','四宝','金玉满堂','年年富贵')):return '糕点礼盒类'
    return '糕点类'
def sid(*x):return 'P-'+hashlib.sha1('|'.join(x).encode()).hexdigest()[:12].upper()
def opts(correct,pool,seed):
    vals=sorted({clean(x) for x in pool if clean(x) and clean(x)!=clean(correct)},key=lambda x:hashlib.sha1((seed+x).encode()).hexdigest())[:3]
    vals=([clean(correct)]+vals); vals += [f'暂无其他有效资料{i}' for i in range(1,5)]; vals=vals[:4]; order=sorted(range(4),key=lambda i:hashlib.sha1(f'{seed}:{i}'.encode()).hexdigest()); vals=[vals[i] for i in order]
    return vals,'ABCD'[vals.index(clean(correct))]
def q(bank,cat,pl,cd,name,kp,text,correct,pool,note=''):
    os_,ans=opts(correct,pool,cd+kp)
    return {'id':sid(bank,cd,kp,text),'bank':bank,'category':cat,'productLine':pl,'code':cd,'productName':name,'type':'单选题','difficulty':'基础','knowledgePoint':kp,'question':text,'optionA':os_[0],'optionB':os_[1],'optionC':os_[2],'optionD':os_[3],'answer':ans,'answerText':correct,'explanation':f'{text.rstrip("？")}：{correct}。','questionImage':'','optionAImage':'','optionBImage':'','optionCImage':'','optionDImage':'','source':SOURCE_LABEL,'note':note,'version':VERSION}
def product(row,bank,sheet):
    cd=code(get(row,'货号')); name=get(row,'产品名称')
    if not cd or not name:return None
    if cd=='2576':name='2608杏仁饼258g'
    moon=bank=='月饼题库'; size=get(row,'产品尺寸长宽高CM','产品尺寸；长宽高cm','产品尺寸长宽高cm')
    if sheet=='26年散饼' and not size:
        ds=[get(row,'长'),get(row,'宽'),get(row,'高')]; size='*'.join(ds) if all(ds) else ''
    outer=get(row,'外箱长宽高；cm','外箱长宽高cm'); size='；'.join(x for x in (f'产品尺寸{size}cm' if size else '',f'外箱{outer}cm' if outer else '') if x)
    contents=get(row,'内配','内配明细','内配/口味')
    return {'code':cd,'name':name,'bank':bank,'cat':'月饼产品' if moon else '日常年货产品','line':('月饼-铁罐' if '铁罐' in get(row,'盒型') else '月饼-礼盒') if moon else line(name,contents),'carton':get(row,'箱规'),'contents':contents,'net':get(row,'净重g','净重'),'shelf':get(row,'保质期'),'size':size,'barcode':get(row,'条码','商品条码'),'unit':get(row,'单位'),'sheet':sheet}
def write_xlsx(path,qs):
    hs=list(qs[0]) if qs else ['id']
    def esc(v):return str(v).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('\n',' ')
    def xlcol(n):
        out=''
        while n:
            n,r=divmod(n-1,26); out=chr(65+r)+out
        return out
    rows=[hs]+[[x.get(h,'') for h in hs] for x in qs]; body=''
    for r,row in enumerate(rows,1):
        body+=f'<row r="{r}">'+''.join(f'<c r="{xlcol(c)}{r}" t="inlineStr"><is><t>{esc(v)}</t></is></c>' for c,v in enumerate(row,1))+'</row>'
    sheet=f'<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{body}</sheetData></worksheet>'
    ct='<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    rel='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    wb='<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="题库" sheetId="1" r:id="rId1"/></sheets></workbook>'
    wr='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:z.writestr('[Content_Types].xml',ct);z.writestr('_rels/.rels',rel);z.writestr('xl/workbook.xml',wb);z.writestr('xl/_rels/workbook.xml.rels',wr);z.writestr('xl/worksheets/sheet1.xml',sheet)
def main():
    old=json.loads(PRODUCT_JSON.read_text(encoding='utf-8')) if PRODUCT_JSON.exists() else []; data=read_book(); items=[]
    for sh,bk in [('26年月饼礼盒','月饼题库'),('26年散饼','月饼题库'),('26年糕点饼干','日常年货题库')]:
        for r in data.get(sh,[]):
            x=product(r,bk,sh)
            if x:items.append(x)
    by={}; [by.setdefault(x['code'],x) for x in items]; items=list(by.values()); qs=[]
    fields=[('产品名称','name','{c} 对应的产品名称是什么？'),('产品线','line','{c} 属于哪条产品线？'),('箱规','carton','{c} 的箱规是多少？'),('内配/口味','contents','{c} 的内配/口味是什么？'),('克重/净重','net','{c} 的克重/净重是多少？'),('保质期','shelf','{c} 的保质期是多少？'),('尺寸/外箱','size','{c} 的尺寸/外箱是多少？'),('条码','barcode','{c} 的商品条码是什么？'),('单位','unit','{c} 的销售单位是什么？')]
    for x in items:
        same=[y for y in items if y['bank']==x['bank']]
        for kp,f,p in fields:
            if x[f]:qs.append(q(x['bank'],x['cat'],x['line'],x['code'],x['name'],kp,p.format(c=x['code']),x[f],[y[f] for y in same],x['sheet']))
        seg='mooncake' if x['bank']=='月饼题库' else 'daily'; img=ROOT/'assets/product-images'/seg/f"{x['code']}.jpg"
        if img.is_file():
            z=q(x['bank'],x['cat'],x['line'],x['code'],x['name'],'看图片选货号','这张图片对应的货号是什么？',x['code'],[y['code'] for y in same],x['sheet']);z['questionImage']=img.relative_to(ROOT).as_posix();qs.append(z)
            if x['bank']=='月饼题库':
                z=q(x['bank'],x['cat'],x['line'],x['code'],x['name'],'看货号选图片',f"{x['code']} 对应的产品图片是哪一张？",img.relative_to(ROOT).as_posix(),[f"assets/product-images/mooncake/{y['code']}.jpg" for y in same if (ROOT/'assets/product-images/mooncake'/f"{y['code']}.jpg").is_file()],x['sheet'])
                for letter in 'ABCD':
                    z[f'option{letter}Image']=z[f'option{letter}']; z[f'option{letter}']='图片'+letter
                z['answerText']=z[f"option{z['answer']}Image"]; qs.append(z)
    brand_rows=data.get('品牌介绍',[])
    brand_values=[get(r,'统一共性卖点') for r in brand_rows if get(r,'统一共性卖点')]
    for r in brand_rows:
        module=get(r,'模块'); value=get(r,'统一共性卖点')
        if module and value:
            qs.append(q('品牌题库','品牌资料','品牌介绍',module,'金尊品牌','品牌口径',f'品牌资料“{module}”的统一口径是什么？',value,brand_values,'品牌介绍'))
    merchant_rows=data.get('商家编码',[])
    merchant_codes=[get(r,'商家编码') for r in merchant_rows if get(r,'商家编码')]
    for r in merchant_rows:
        combo=get(r,'组合装名称'); merchant=get(r,'商家编码')
        if combo and merchant:
            qs.append(q('商家编码题库','电商资料','商家编码',merchant,combo,'商家编码',f'“{combo}”对应的商家编码是什么？',merchant,merchant_codes,'商家编码'))
    before={str(x.get('code')) for x in old if x.get('bank') in ('月饼题库','日常年货题库') and x.get('knowledgePoint')=='产品名称' and x.get('code')}; after=set(by); missing=[x['code'] for x in items if not (ROOT/'assets/product-images'/('mooncake' if x['bank']=='月饼题库' else 'daily')/f"{x['code']}.jpg").is_file()]
    baseline_questions=int(os.environ.get('JINZUN_BASELINE_QUESTIONS',len(old)))
    report={'source':str(SOURCE),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'generatedAt':datetime.now(timezone.utc).isoformat(),'version':VERSION,'sheets':{k:len(v) for k,v in data.items()},'beforeProducts':len(before),'afterProducts':len(after),'beforeQuestions':baseline_questions,'afterQuestions':len(qs),'deletedOldQuestions':max(0,baseline_questions-len(qs)),'newProducts':sorted(after-before),'deletedProducts':sorted(before-after),'missingSourceFields':sorted({f for x in items for f in ('carton','contents','net','shelf','size') if not x[f]}),'imageWarnings':missing,'corrections':{'2576':'2608杏仁饼258g','2605':'按最新Excel生成','2621':'按最新Excel生成'}}
    PRODUCT_JSON.write_text(json.dumps(qs,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');write_xlsx(PRODUCT_XLSX,qs);AUDIT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');DIFF_JSON.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');DIFF_MD.write_text('# Product Sync Diff 20260713\n\n'+json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'activeProducts':len(after),'questions':len(qs),'imageWarnings':missing},ensure_ascii=False))
if __name__=='__main__':main()

