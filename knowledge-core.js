(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KnowledgeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const points = {'产品名称':'name','产品线':'line','箱规':'carton','内配/口味':'contents','克重/净重':'net','保质期':'shelf','条码':'barcode'};
  const matchesCode = (text, code) => new RegExp(`(?<!\\d)${code}(?!\\d)`).test(String(text || ''));
  function validateProduct(input) {
    if (!/^\d{4}$/.test(String(input.code || ''))) throw new Error('货号必须是4位数字');
    if (!String(input.name || '').trim()) throw new Error('产品名称不能为空');
    if (input.barcode && !/^\d{8,14}$/.test(input.barcode)) throw new Error('条码必须为8至14位数字');
    if (!['active','retired'].includes(input.status)) throw new Error('产品状态无效');
    return input;
  }
  function resolveProduct(products, keyword) {
    return products.find(p => p.code === keyword || p.barcode === keyword || (p.aliases || []).includes(keyword));
  }
  function projectQuestions(questions, products) {
    const byCode = new Map(products.map(p=>[p.code,p]));
    const retired = products.filter(p=>p.status === 'retired');
    const retiredValue = value => retired.some(p=>matchesCode(value,p.code) || (p.barcode && String(value).includes(p.barcode)));
    const replacements = new Map();
    for (const q of questions) {
      const p = byCode.get(String(q.code));
      if (!p || p.status === 'retired') continue;
      if (q.productName && q.productName !== p.name) replacements.set(q.productName,p.name);
      if (q.knowledgePoint === '条码' && p.barcode && q.answerText !== p.barcode) replacements.set(q.answerText,p.barcode);
    }
    const replaceText = value => {
      if (typeof value !== 'string') return value;
      for (const [before,after] of replacements) if (before) value=value.split(before).join(after);
      return value;
    };
    const retained = questions.filter(q=>![q.code,q.productName,q.question,q.answerText,q.explanation].some(retiredValue)).map(q=> {
      const result=Object.fromEntries(Object.entries(q).map(([key,value])=>[key,replaceText(value)]));
      const p=byCode.get(String(q.code));
      if (!p || p.status !== 'active') return result;
      result.productName=p.name;
      result.productLine=p.line || q.productLine;
      const value=p[points[q.knowledgePoint]];
      if (value && value !== result.answerText) {
        const existing=[...'ABCD'].find(l=>result[`option${l}`]===value);
        if (existing) result.answer=existing;
        else result[`option${result.answer}`]=value;
        result.answerText=value;
        result.explanation=`${String(result.question || result.knowledgePoint).replace(/[？?]$/,'')}：${value}。`;
      }
      return result;
    });
    for (const q of retained) for (const letter of 'ABCD') {
      if (![q[`option${letter}`],q[`option${letter}Image`]].some(retiredValue)) continue;
      const used=new Set([...'ABCD'].map(l=>q[`option${l}Image`]||q[`option${l}`]));
      let donor;
      for (const candidate of retained.filter(c=>c.bank===q.bank && c.knowledgePoint===q.knowledgePoint)) {
        for (const l of 'ABCD') {
          const value=candidate[`option${l}Image`]||candidate[`option${l}`];
          if (value && !used.has(value) && !retiredValue(value)) { donor={candidate,l}; break; }
        }
        if (donor) break;
      }
      if (!donor) throw new Error(`停售产品选项无法自动替换：${q.id}`);
      for (const key of Object.keys(q)) if (key.startsWith(`option${letter}`)) delete q[key];
      for (const [key,value] of Object.entries(donor.candidate)) if (key.startsWith(`option${donor.l}`)) q[key.replace(`option${donor.l}`,`option${letter}`)]=value;
    }
    return retained;
  }
  function mergeProgress(left, right, now=Date.now()) {
    const merged=Object.create(null);
    for (const source of [left,right]) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
      for (const [key,value] of Object.entries(source)) {
        if (!value || !['learned','review','verified'].includes(value.status) || key.length>160 || ['__proto__','constructor','prototype'].includes(key)) continue;
        const stamp=Date.parse(value.updatedAt);
        if (!Number.isFinite(stamp) || stamp>now+60000) continue;
        const safe={status:value.status,updatedAt:new Date(stamp).toISOString()};
        if (typeof value.revision==='string') safe.revision=value.revision.slice(0,100);
        if (Array.isArray(value.passedPoints)) safe.passedPoints=[...new Set(value.passedPoints.filter(v=>typeof v==='string'&&v.length<50))].slice(0,8);
        const previous=merged[key];
        if (!previous || stamp>Date.parse(previous.updatedAt) || (stamp===Date.parse(previous.updatedAt) && JSON.stringify(safe)>JSON.stringify(previous))) merged[key]=safe;
      }
    }
    return Object.fromEntries(Object.entries(merged).sort((a,b)=>Date.parse(b[1].updatedAt)-Date.parse(a[1].updatedAt)||a[0].localeCompare(b[0])).slice(0,300));
  }
  function revision(product) {
    let hash=2166136261;
    for (const c of JSON.stringify(['name','line','net','carton','contents','shelf','barcode','status'].map(k=>product[k]||''))) hash=Math.imul(hash^c.charCodeAt(0),16777619);
    return (hash>>>0).toString(16);
  }
  const versionsMatch=(a,b)=>Boolean(a&&b&&a.buildVersion===b.buildVersion&&a.productHash===b.productHash);
  return {validateProduct,resolveProduct,projectQuestions,mergeProgress,revision,versionsMatch};
});
