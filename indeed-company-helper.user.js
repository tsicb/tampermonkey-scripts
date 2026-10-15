// ==UserScript==
// @name         Indeed Company Helper - Reviews & Q&A
// @name:ja      Indeed企業情報Helper（クチコミ・質問箱）
// @namespace    https://github.com/tsicb/tampermonkey-scripts
// @version      1.1.1
// @description  Collect public Indeed company reviews, company ratings, and question/answer entries into TSV; supports pause/resume and completeness checks.
// @description:ja Indeed企業ページの公開クチコミ・質問回答をTSV収集（全件照合、一時停止・再開対応）
// @match        https://jp.indeed.com/cmp/*
// @updateURL    https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-company-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-company-helper.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';
  const VER = '1.1.1';
  const PREFIX = 'indeedCompanyHelper_v1_';
  const ROOT_ID = 'ich-root-v1';
  const BASE = 'https://jp.indeed.com';
  const DELAY_MS = 1200;
  const MAX_REQUESTS = 1500; // 無限巡回対策。429の回避を目的とした設定値ではない
  const HISTORY_KEY = PREFIX + 'activity_v1';
  const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  const HISTORY_MAX_EVENTS = 3000;
  const IMPORT_MAX_FILES = 80;
  const IMPORT_MAX_FILE_BYTES = 8 * 1024 * 1024;
  const IMPORT_MAX_TOTAL_BYTES = 48 * 1024 * 1024;

  const S = (x) => (x === null || x === undefined ? '' : String(x));
  const val = (obj, ...keys) => keys.reduce((acc, key) => acc && acc[key], obj);
  const boolField = (v) => typeof v === 'boolean' ? String(v) : '';
  const ratingField = (v) => Number(v) > 0 ? Number(v) : '';
  const now = () => new Date().toISOString();
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const enc = (v) => encodeURIComponent(S(v));

  function safeUrl(href, companyPath) {
    if (!href || typeof href !== 'string') return '';
    try {
      const u = new URL(href, BASE + companyPath + '/');
      if (u.origin !== BASE || !u.pathname.startsWith(companyPath + '/')) return '';
      if (/(?:\/login|\/signin|\/account)(?:\/|$)/i.test(u.pathname)) return '';
      u.hash = '';
      return u.href;
    } catch { return ''; }
  }
  function getCompanyPath(url) {
    const m = new URL(url).pathname.match(/^\/cmp\/([^/]+)(?:\/|$)/i);
    if (!m) return '';
    return '/cmp/' + m[1];
  }
  function companyBase(url) {
    const p = getCompanyPath(url);
    return p ? BASE + p : '';
  }
  function normalizedUrl(url) {
    try { const u = new URL(url); u.hash = ''; return u.href; } catch { return S(url); }
  }
  function companyFromData(j) {
    return S(val(j, 'companyPageHeader', 'companyHeader', 'name') ||
      val(j, 'qnaHeaderViewModel', 'companyName') ||
      val(j, 'headerViewModel', 'qnaQuestionViewModel', 'companyName') ||
      val(j, 'reviewsList', 'companyName') ||
      val(j, 'paginatedAnswersViewModel', 'companyName'));
  }
  function companyIdFromData(j, path) {
    return S(j.encodedFccId || val(j, 'reviewsList', 'encodedFccId') ||
      val(j, 'companyPageFooter', 'encodedFccId') ||
      val(j, 'companyPageHeader', 'followButton', 'encodedFccId') || path.split('/').pop());
  }
  function parseDocument(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const node = doc.getElementById('comp-initialData');
    if (!node) throw new Error('comp-initialData がありません。認証・制限ページまたはHTML構造変更の可能性があります。');
    let data;
    try { data = JSON.parse(node.textContent); }
    catch { throw new Error('comp-initialData のJSON解析に失敗しました。'); }
    if (!data || typeof data !== 'object') throw new Error('企業情報JSONが不正です。');
    return { data, doc };
  }
  function normalizeImportedHtml(text) {
    const source=S(text).replace(/^\uFEFF/, '');
    // Chat / Markdown copied HTML may escape punctuation (e.g. \<html, https\://).
    // Apply only if the opening HTML tag is backslash-escaped.
    return /^\s*\\<(?:!doctype|html)/i.test(source)
      ? source.replace(/\\([!#$%&()*+,./:;<=>?@\[\]^_`{|}~-])/g, '$1')
      : source;
  }
  function detailPageIndex(p) {
    const raw=val(p,'pagination','currentPage');
    if(raw===undefined || raw===null || raw==='')return 1;
    const number=Number(raw);
    if(!Number.isSafeInteger(number) || number<1 || number>100000)
      throw new Error('回答ページ番号が不正です。');
    return number;
  }
  function answerCompleteness(q) {
    const known=Number.isSafeInteger(Number(q.totalAnswerCount)) && Number(q.totalAnswerCount)>=0 &&
      (q.answerTotalKnown !== false);
    const count=Object.keys(q.answers||{}).length;
    if (!known) return '総数未確認';
    if (count > Number(q.totalAnswerCount)) return '要確認';
    return count === Number(q.totalAnswerCount) ? '完全' : '一部未取得';
  }
  function parseImportHtml(source, filename, currentPath) {
    const {data,doc}=parseDocument(normalizeImportedHtml(source));
    const p=data.paginatedAnswersViewModel;
    if (!p || !Array.isArray(p.answers)) throw new Error('質問詳細の回答JSONがありません。');
    const link=doc.querySelector('link[rel="canonical"]');
    const canonical=S(link?.getAttribute('href')||'');
    const questionUrl=safeUrl(canonical || p.questionUrl, currentPath);
    // A canonical URL alone is insufficient unless it identifies exactly this company/question.
    const companyPath=getCompanyPath(canonical || S(p.questionUrl));
    if (!companyPath || companyPath!==currentPath || !questionUrl ||
        !new URL(questionUrl).pathname.startsWith(currentPath+'/faq/')) {
      throw new Error('この企業の質問詳細ページではありません。');
    }
    const result=answersExtract(data,currentPath);
    const quid=new URL(questionUrl).searchParams.get('quid');
    if (quid && quid!==result.questionId) throw new Error('質問IDがURLとJSONで一致しません。');
    if (!result.questionId) throw new Error('質問IDを確認できません。');
    const page=detailPageIndex(p);
    const known=Number.isSafeInteger(Number(data.headerViewModel?.qnaQuestionViewModel?.totalAnswerCount ?? p.totalAnswerCount)) &&
      Number(data.headerViewModel?.qnaQuestionViewModel?.totalAnswerCount ?? p.totalAnswerCount)>=0;
    return {...result, page, sourceUrl:questionUrl, filename:S(filename),
      answerTotalKnown:known, companyId:companyIdFromData(data,currentPath),
      companyName:companyFromData(data)};
  }
  function importPlan(state, path, parsedPages) {
    const groups=new Map();
    const problems=[];
    const stats={files:parsedPages.length,questions:0,answers:0,newAnswers:0,duplicates:0,conflicts:0,pages:0};
    for(const p of parsedPages) {
      if (!p || !p.questionId) throw new Error('取込対象の質問IDが不正です。');
      if (!safeUrl(p.sourceUrl,path) || getCompanyPath(p.sourceUrl)!==path)
        throw new Error('別企業のHTMLを取り込むことはできません。');
      const savedId=S(state?.companyId), importId=S(p.companyId), pathId=path.split('/').pop();
      if(savedId && savedId!==pathId && importId && importId!==pathId && savedId!==importId)
        throw new Error('同じ企業URLですが企業IDが一致しません。');
      if (!Number.isSafeInteger(p.page)||p.page<1) throw new Error('ページ番号が不正です。');
      if (!groups.has(p.questionId)) groups.set(p.questionId, {question:p, pages:{},answers:{}});
      const group=groups.get(p.questionId);
      if(group.question.questionText && p.questionText && group.question.questionText!==p.questionText)
        throw new Error('同一質問IDの質問文に不整合があります。');
      if(group.pages[p.page]) {
        const previous=group.pages[p.page];
        const first=Object.keys(previous.answers).sort().join('|');
        const next=Object.keys(p.answers).sort().join('|');
        if(first!==next) {problems.push(`${p.filename}: 同じ質問・ページに異なる回答があります`);stats.conflicts++;}
      } else { group.pages[p.page]=p;stats.pages++; }
      group.question.totalAnswerCount=Math.max(Number(group.question.totalAnswerCount||0),Number(p.totalAnswerCount||0));
      group.question.answerTotalKnown=group.question.answerTotalKnown||p.answerTotalKnown;
      for(const [id,a] of Object.entries(p.answers)) {
        if(!id || id!==a.answerId) throw new Error('回答IDの構造が不正です。');
        const existing=group.answers[id] || state?.questions?.[p.questionId]?.answers?.[id];
        if(existing) {
          stats.duplicates++;
          if (S(existing.answerText)!==S(a.answerText)) {
            stats.conflicts++; problems.push(`${p.filename}: 回答 ${id} の本文が保存済みデータと異なります（既存優先）`);
          }
        } else {
          stats.newAnswers++;
        }
        if(!group.answers[id])group.answers[id]={...a,answerSource:'保存HTML',answerPage:p.page,
          answerSourceUrl:p.sourceUrl,answerImportedAt:now()};
      }
    }
    stats.questions=groups.size;
    stats.answers=Array.from(groups.values()).reduce((n,g)=>n+Object.keys(g.answers).length,0);
    return {groups,stats,problems};
  }
  function applyImportPlan(previous, path, plan) {
    // Build a copy; never mutate stored state until all validation/merging succeeds.
    const state=previous ? JSON.parse(JSON.stringify(previous)) : newState(path,{target:'faq',scope:'all',answers:'full'});
    if(!previous) {state.status='done';state.stage='done';state.offlineOnly=true;}
    normalizeState(state);
    const stamp=now();
    let added=0;
    for(const [qid,group] of plan.groups) {
      const p=group.question;
      let q=state.questions[qid];
      if(!q) {
        q={questionId:qid,questionText:p.questionText,questionDate:p.questionDate,
          questionDisplayDate:p.questionDisplayDate,questionUrl:p.sourceUrl,
          companyName:p.companyName,totalAnswerCount:p.totalAnswerCount,answers:{},
          detailFetched:false,detailStatus:'HTML取込',page:0,sourceUrl:p.sourceUrl,fetchedAt:stamp,
          answerTotalKnown:p.answerTotalKnown,detailPages:{}};
        state.questions[qid]=q;
      }
      if(q.questionText && p.questionText && q.questionText!==p.questionText)
        throw new Error('質問ID '+qid+' の質問文が保存済みデータと一致しません。');
      if(!q.questionText)q.questionText=p.questionText;
      if(!q.questionDate)q.questionDate=p.questionDate;
      if(!q.questionDisplayDate)q.questionDisplayDate=p.questionDisplayDate;
      if(!q.questionUrl)q.questionUrl=p.sourceUrl;
      if(!q.companyName)q.companyName=p.companyName;
      q.answerTotalKnown=q.answerTotalKnown===false ? p.answerTotalKnown : q.answerTotalKnown!==false;
      q.totalAnswerCount=Math.max(Number(q.totalAnswerCount)||0,Number(p.totalAnswerCount)||0);
      q.detailPages ||= {};
      for(const [num,page] of Object.entries(group.pages)) {
        const old=q.detailPages[num];
        if(old && old.source==='質問詳細' && num==='1') {
          // The original online detail fetch may already have recorded the first page.
          q.detailPages[num]={...old,alsoImported:true};
        } else {
          q.detailPages[num]={source:'保存HTML',sourceUrl:page.sourceUrl,
            filename:page.filename,answerCount:Object.keys(page.answers).length,importedAt:stamp};
        }
      }
      for(const [id,a] of Object.entries(group.answers)) {
        if(!q.answers[id]) {q.answers[id]={...a,answerImportedAt:stamp};added++;}
      }
      q.detailStatus=answerCompleteness(q)==='完全'?'HTML取込・回答完全':'HTML取込・回答一部未取得';
    }
    const first=Array.from(plan.groups.values())[0]?.question;
    if(!state.companyName)state.companyName=first?.companyName||'';
    if(!previous && first?.companyId)state.companyId=first.companyId;
    state.importedHtmlPages=Object.values(state.questions).reduce((n,q)=>n+
      Object.values(q.detailPages||{}).filter(p=>p.source==='保存HTML'||p.alsoImported).length,0);
    state.lastImportAt=stamp;
    return {state,added};
  }

  function reviewsExtract(j, path, sourceUrl, page) {
    const model = j.reviewsList;
    if (!model || !Array.isArray(model.items)) throw new Error('reviewsList.items が見つかりません。');
    const ret = [];
    for (const r of model.items) {
      const id = S(r.encryptedReviewId || r.reviewUid);
      if (!id) continue;
      ret.push({
        reviewId: id, reviewUid: S(r.reviewUid), companyId: companyIdFromData(j, path),
        companyName: companyFromData(j),
        reviewUrl: safeUrl(r.sharingLink || r.reviewUrl, path),
        submissionDate: S(r.submissionDate), title: S(val(r, 'title', 'text')),
        jobTitle: S(r.jobTitle), normJobTitle: S(r.normJobTitle), location: S(r.location),
        currentEmployee: boolField(r.currentEmployee), overallRating: ratingField(r.overallRating),
        workLifeBalanceRating: ratingField(val(r, 'workAndLifeBalanceRating', 'rating')),
        compensationBenefitsRating: ratingField(val(r, 'compensationAndBenefitsRating', 'rating')),
        jobSecurityAdvancementRating: ratingField(val(r, 'jobSecurityAndAdvancementRating', 'rating')),
        managementRating: ratingField(val(r, 'managementRating', 'rating')),
        cultureRating: ratingField(val(r, 'cultureAndValuesRating', 'rating')),
        text: S(val(r, 'text', 'text')), pros: S(val(r, 'pros', 'text')),
        cons: S(val(r, 'cons', 'text')), helpful: r.helpful ?? '', unhelpful: r.unhelpful ?? '',
        page, sourceUrl, fetchedAt: now()
      });
    }
    const stats = val(j, 'sidebarWidgets', 'companyPageStats') || {};
    const counts = val(j, 'sidebarWidgets', 'reviewHistogram', 'counts') || [];
    const cat = stats.reviewCategories || {};
    const foundTotal = val(j, 'reviewsFilters', 'reviewsCount', 'foundReviewCount');
    const listedTotal = val(j, 'reviewsFilters', 'reviewsCount', 'totalReviewCount');
    const globalTotal = val(stats, 'overallCompanyRating', 'totalReviewCount') ??
      val(j, 'companyPageHeader', 'companyHeader', 'reviewCount') ?? listedTotal;
    return {
      rows: ret,
      summary: {
        rating: val(stats, 'overallCompanyRating', 'rating') ??
          val(j, 'companyPageHeader', 'companyHeader', 'rating') ?? '',
        reviewCount: globalTotal ?? '', listReviewCount: foundTotal ?? globalTotal ?? '',
        star5: counts[4] ?? '', star4: counts[3] ?? '', star3: counts[2] ?? '',
        star2: counts[1] ?? '', star1: counts[0] ?? '',
        workLifeBalance: cat.workLifeBalance ?? '', compensationBenefits: cat.compensationBenefits ?? '',
        jobSecurityAdvancement: cat.jobSecurityAdvancement ?? '',
        management: cat.management ?? '', culture: cat.culture ?? ''
      }
    };
  }
  function questionsExtract(j, path, sourceUrl, page) {
    const p = j.qnaPaginatedQuestionsViewModel;
    if (!p || !Array.isArray(p.questions)) throw new Error('qnaPaginatedQuestionsViewModel.questions が見つかりません。');
    return {
      questions: p.questions.filter(q => q.questionUid).map(q => {
        const base = S(q.baseUrl || path);
        const url = safeUrl(q.questionUrl?.startsWith('faq/') ? `${base}/${q.questionUrl}` : q.questionUrl, path);
        const answer = q.topAnswer ? answerExtract(q.topAnswer) : null;
        return { questionId: S(q.questionUid), companyName: S(q.companyName || companyFromData(j)),
          questionText: S(val(q,'questionText','text')), questionDate: S(q.creationDate),
          questionDisplayDate: S(q.formattedCreationDateTime), questionUrl: url,
          totalAnswerCount: Number(q.totalAnswerCount) || 0,
          answers: answer && answer.answerId ? { [answer.answerId]: answer } : {},
          detailFetched: false, detailStatus: Number(q.totalAnswerCount || 0) <= (answer && answer.answerId ? 1 : 0)
            ? '詳細取得不要' : '未取得', page, sourceUrl, fetchedAt: now() };
      }),
      nextUrl: safeUrl(val(p, 'pagination','paginationNextLink','href'), path),
      expectedCount: Number(val(j, 'qnaHeaderViewModel','totalQuestionCount') ??
        val(j,'qnaHeaderViewModel','companyQuestionCount')) || 0
    };
  }
  function answerExtract(a) {
    return {
      answerId: S(a.answerUid), answerText: S(val(a,'answerText','text')),
      answerDate: S(a.creationDate), answerDisplayDate: S(a.formattedCreationDateTime),
      jobTitle: S(a.jobTitle), location: S(a.location),
      currentlyEmployed: boolField(a.currentlyEmployed), official: boolField(a.official),
      upvotes: val(a,'qnaVote','yesCount') ?? '', downvotes: val(a,'qnaVote','noCount') ?? ''
    };
  }
  function answersExtract(j, path) {
    const p = j.paginatedAnswersViewModel;
    const q = val(j, 'headerViewModel', 'qnaQuestionViewModel');
    if (!p || !Array.isArray(p.answers) || !q) throw new Error('質問詳細の回答配列が見つかりません。');
    const qid = S(q.questionUid || p.questionUid);
    if (!qid) throw new Error('質問詳細の質問IDがありません。');
    const answers = {};
    for (const item of p.answers) { const a = answerExtract(item); if (a.answerId) answers[a.answerId] = a; }
    return { questionId: qid, companyName: S(q.companyName || p.companyName),
      questionText: S(val(q,'questionText','text')), questionDate: S(q.creationDate),
      questionDisplayDate: S(q.formattedCreationDateTime), questionUrl: safeUrl(p.questionUrl,path),
      totalAnswerCount: Number(q.totalAnswerCount ?? p.totalAnswerCount) || 0, answers,
      page:detailPageIndex(p) };
  }
  function nextReviewUrl(j, doc, path, currentUrl) {
    const structured = [
      val(j,'reviewsList','pagination','paginationNextLink','href'),
      val(j,'reviewsList','pagination','nextPageUrl'),
      val(j,'reviewsList','pagination','nextUrl'),
      val(j,'reviewsList','nextPageUrl'), val(j,'reviewsList','nextPageLink')
    ];
    const reviewPrefix = path + '/reviews';
    const valid = (href) => {
      const u = safeUrl(href, path);
      if (!u || normalizedUrl(u) === normalizedUrl(currentUrl)) return '';
      try { return new URL(u).pathname === reviewPrefix ? u : ''; } catch { return ''; }
    };
    for (const item of structured) {
      const url = valid(typeof item === 'string' ? item : item?.href);
      if (url) return url;
    }
    // フィルタ・関連リンクを次ページと誤認しないよう、ページ送り領域に限定
    const roots = Array.from(doc.querySelectorAll(
      '[data-testid*="pagination" i], nav[aria-label*="ページ"], nav[aria-label*="pagination" i], [role="navigation"][aria-label*="pagination" i]'));
    for (const root of roots) {
      const links = root.matches('a[href]') ? [root] : Array.from(root.querySelectorAll('a[href]'));
      for (const a of links) {
        const name = [a.getAttribute('aria-label'),a.getAttribute('data-testid'),a.textContent,a.getAttribute('rel')].join(' ');
        if (!/(?:次へ|次のページ|next|pagination-next)/i.test(name)) continue;
        const url = valid(a.getAttribute('href'));
        if (url) return url;
      }
    }
    const relNext = doc.querySelector('link[rel="next"], a[rel="next"]');
    return relNext ? valid(relNext.getAttribute('href')) : '';
  }
  function newState(path, options) {
    return { version: 1, companyPath: path, companyId: path.split('/').pop(), companyName: '',
      startedAt: now(), updatedAt: now(), options: { ...options }, status:'running', stage:'reviews',
      reviews: {}, questions: {}, reviewSummary: {}, expectedFaqCount: 0,
      reviewPages: 0, faqPages: 0, visitedReviews: {}, visitedFaq: {}, visitedDetails:{},
      reviewNext: BASE + path + '/reviews', faqNext: BASE + path + '/faq',
      reviewDone: false, faqDone: false, detailDone: false, requestCount: 0,
      requestCounts: {reviews:0,faq:0,details:0,legacy:0}, rateLimit:null,
      warnings: [], error: '', lastUrl: '', lastSuccessAt: '' };
  }
  function counts(state) {
    const qs = Object.values(state.questions || {});
    return { reviews:Object.keys(state.reviews || {}).length, questions:qs.length,
      answers:qs.reduce((n,q) => n + Object.keys(q.answers || {}).length, 0),
      expectedAnswers:qs.reduce((n,q) => n + Number(q.totalAnswerCount || 0), 0),
      incompleteQuestions:qs.filter(q => Object.keys(q.answers || {}).length !== Number(q.totalAnswerCount || 0)).length };
  }
  // v1.0.0の企業別保存値は残したまま移行する。過去の内訳は推測せず「旧版・未分類」。
  function normalizeState(state) {
    if (!state) return false;
    let changed = false;
    if (!state.requestCounts) {
      state.requestCounts = {reviews:0,faq:0,details:0,legacy:Number(state.requestCount)||0};
      changed = true;
    }
    if (!Object.prototype.hasOwnProperty.call(state,'rateLimit')) {
      state.rateLimit = null;
      changed = true;
    }
    for(const q of Object.values(state.questions||{})) {
      if (!q.detailPages) {
        q.detailPages=q.detailFetched ? {'1':{source:'質問詳細',sourceUrl:q.questionUrl||'',
          answerCount:Object.keys(q.answers||{}).length}} : {};
        changed=true;
      }
    }
    return changed;
  }
  function summaryStatus(state, key) {
    if (!state) return '未取得';
    const isReviews = ['both','reviews'].includes(state.options.target);
    const isFaq = ['both','faq'].includes(state.options.target);
    if (key === 'reviews' && !isReviews) return '未取得';
    if ((key === 'faq' || key === 'answers') && !isFaq) return '未取得';
    const c = counts(state);
    if (key === 'reviews') {
      if (!state.reviewDone) return state.status==='running'?'取得中':'一部未取得';
      if (state.options.scope==='one') return '範囲限定';
      const n = Number(state.reviewSummary.listReviewCount || state.reviewSummary.reviewCount || 0);
      return n && c.reviews !== n ? '一部未取得' : '完全取得';
    }
    if (key === 'faq') {
      if (!state.faqDone) return state.offlineOnly?'質問一覧未確認':state.status==='running'?'取得中':'一部未取得';
      if (state.options.scope==='one') return '範囲限定';
      return state.expectedFaqCount && c.questions!==state.expectedFaqCount ? '一部未取得':'完全取得';
    }
    if (key === 'answers') {
      if (state.offlineOnly) return '取込済み質問のみ';
      if (state.options.answers==='list' && c.incompleteQuestions) return '代表回答のみ／一部未取得';
      if (!state.detailDone && state.options.answers!=='list')
        return state.status==='running'?'取得中':'一部未取得';
      if (state.options.scope==='one') return '範囲限定';
      return c.incompleteQuestions ? '一部未取得' : '完全取得';
    }
    return '未取得';
  }

  function activityEvents() {
    try {
      const saved = GM_getValue(HISTORY_KEY,'[]');
      const events = typeof saved === 'string' ? JSON.parse(saved) : saved;
      const cutoff = Date.now() - HISTORY_RETENTION_MS;
      return Array.isArray(events) ? events.filter(e=>e && Number.isFinite(e.time) && e.time>=cutoff) : [];
    } catch { return []; }
  }
  function logActivity(state, kind, httpStatus) {
    try {
      const events=activityEvents();
      events.push({time:Date.now(),company:state.companyPath,kind,status:httpStatus});
      GM_setValue(HISTORY_KEY,JSON.stringify(events.slice(-HISTORY_MAX_EVENTS)));
    } catch { /* 保存制限があっても収集結果そのものは失わない */ }
  }
  function activitySummary() {
    const e=activityEvents(), t=Date.now();
    const hour=e.filter(x=>x.time>=t-60*60*1000);
    const day=e.filter(x=>x.time>=t-24*60*60*1000);
    return {hour:hour.length,day:day.length,companiesHour:new Set(hour.map(x=>x.company)).size,
      companiesDay:new Set(day.map(x=>x.company)).size,
      last429:[...e].reverse().find(x=>x.status===429) || null};
  }
  function retryAfterInfo(raw,base=Date.now()) {
    const value = S(raw).trim();
    if (!value) return {raw:'',retryAt:null};
    let t=null;
    if (/^\d+$/.test(value)) {
      const seconds=Number(value);
      if (Number.isSafeInteger(seconds)) t=base+seconds*1000;
    } else {
      const parsed=Date.parse(value);
      if (Number.isFinite(parsed)) t=parsed;
    }
    return {raw:value,retryAt:Number.isFinite(t)?t:null};
  }
  function formatLocalTime(ms) {
    return ms && Number.isFinite(ms) ? new Date(ms).toLocaleString('ja-JP') : '不明';
  }
  const COMMON = [['fetchedAt','取得日時'],['companyId','企業ID'],['companyName','企業名']];
  const SUMMARY_HEADERS = [...COMMON, ['companyUrl','企業ページURL'],
    ['reviewCount','クチコミ総数'],['listReviewCount','取得対象クチコミ件数'],['rating','総合評価'],
    ['star5','星5件数'],['star4','星4件数'],['star3','星3件数'],['star2','星2件数'],['star1','星1件数'],
    ['workLifeBalance','勤務時間と残業'],['compensationBenefits','給与と福利厚生'],
    ['jobSecurityAdvancement','定着率と昇進'],['management','上司との関係'],['culture','社風'],
    ['expectedFaqCount','質問総数'],['collectedReviews','取得クチコミ数'],
    ['collectedQuestions','取得質問数'],['collectedAnswers','取得回答数'],
    ['expectedAnswers','確認済み質問の回答総数'],['reviewStatus','クチコミ取得状態'],
    ['faqStatus','質問取得状態'],['answerStatus','回答取得状態'],
    ['requestTotal','送信リクエスト総数'],['requestReviews','クチコミ一覧リクエスト'],
    ['requestFaq','質問一覧リクエスト'],['requestDetails','質問詳細リクエスト'],
    ['requestLegacy','旧版未分類リクエスト'],['warnings','注意事項']];
  const REVIEW_HEADERS = [...COMMON, ['reviewId','クチコミID'],['reviewUid','クチコミUID'],
    ['reviewUrl','クチコミURL'],['submissionDate','投稿日'],['title','タイトル'],
    ['jobTitle','職種名'],['normJobTitle','正規化職種名'],['location','勤務地'],
    ['currentEmployee','現職フラグ'],['overallRating','総合評価'],
    ['workLifeBalanceRating','勤務時間評価'],['compensationBenefitsRating','給与福利厚生評価'],
    ['jobSecurityAdvancementRating','定着率昇進評価'],['managementRating','上司評価'],
    ['cultureRating','社風評価'],['text','クチコミ本文全文'],['pros','良かった点'],
    ['cons','改善してほしい点'],['helpful','参考になった数'],['unhelpful','参考にならなかった数'],
    ['page','取得ページ番号'],['sourceUrl','取得元URL']];
  const QNA_HEADERS = [...COMMON, ['questionId','質問ID'],['questionText','質問文'],
    ['questionDate','質問日時UTC'],['questionDisplayDate','質問表示日付'],
    ['questionUrl','質問URL'],['totalAnswerCount','公開回答総数'],
    ['collectedAnswerCount','取得済み回答数'],['answerId','回答ID'],['answerText','回答本文全文'],
    ['answerDate','回答日時UTC'],['answerDisplayDate','回答表示日付'],
    ['jobTitle','回答者の職種'],['location','回答者の勤務地'],
    ['currentlyEmployed','回答者現職フラグ'],['official','企業公式回答フラグ'],
    ['upvotes','参考になった数'],['downvotes','参考にならなかった数'],
    ['answerSource','回答取得元'],['detailStatus','質問詳細取得状態'],
    ['completeness','回答完全性'],['page','質問一覧ページ番号'],['sourceUrl','取得元URL'],
    ['answerPage','回答詳細ページ番号'],['answerSourceUrl','回答取得元URL'],
    ['answerImportedAt','回答HTML取込日時'],['importedPageCount','保存HTML取込ページ数']];
  function outputRows(state, kind) {
    if (!state) return {headers:kind==='summary'?SUMMARY_HEADERS:kind==='reviews'?REVIEW_HEADERS:QNA_HEADERS,rows:[]};
    const c = counts(state);
    const base = { fetchedAt:state.startedAt, companyId:state.companyId,
      companyName:state.companyName || decodeURIComponent(state.companyPath.split('/').pop()) };
    if (kind === 'summary') {
      return {headers:SUMMARY_HEADERS, rows:[{...base,companyUrl:BASE+state.companyPath,
        ...state.reviewSummary, expectedFaqCount: ['both','faq'].includes(state.options.target) ? (state.expectedFaqCount || '') : '',
        collectedReviews:c.reviews, collectedQuestions:c.questions, collectedAnswers:c.answers,
        expectedAnswers: ['both','faq'].includes(state.options.target) ? c.expectedAnswers : '',
        reviewStatus:summaryStatus(state,'reviews'),faqStatus:summaryStatus(state,'faq'),
        answerStatus:summaryStatus(state,'answers'),requestTotal:state.requestCount||0,
        requestReviews:state.requestCounts?.reviews||0,requestFaq:state.requestCounts?.faq||0,
        requestDetails:state.requestCounts?.details||0,requestLegacy:state.requestCounts?.legacy||0,
        warnings:state.warnings.join(' / ') || state.error }]};
    }
    if (kind === 'reviews') return {headers:REVIEW_HEADERS, rows:Object.values(state.reviews)
      .sort((a,b) => (a.page-b.page) || a.reviewId.localeCompare(b.reviewId))
      .map(r=>({...base,...r}))};
    const rows=[];
    for(const q of Object.values(state.questions).sort((a,b) => (a.page-b.page) || a.questionId.localeCompare(b.questionId))) {
      const n = Object.keys(q.answers || {}).length;
      const complete = answerCompleteness(q);
      const question = {...base, fetchedAt:q.fetchedAt,
        questionId:q.questionId,questionText:q.questionText,questionDate:q.questionDate,
        questionDisplayDate:q.questionDisplayDate,questionUrl:q.questionUrl,
        totalAnswerCount:q.totalAnswerCount,collectedAnswerCount:n,
        detailStatus:q.detailStatus,completeness:complete,page:q.page,sourceUrl:q.sourceUrl,
        importedPageCount:Object.values(q.detailPages||{}).filter(p=>p.source==='保存HTML'||p.alsoImported).length};
      const answers = Object.values(q.answers || {});
      if (!answers.length) rows.push({...question,answerSource:'回答なし／未取得'});
      else for (const a of answers) rows.push({...question,...a,
        answerSource:a.answerSource || (q.detailFetched?'旧版（詳細・一覧混在）':'質問一覧'),
        answerPage:a.answerPage||'',answerSourceUrl:a.answerSourceUrl||'',answerImportedAt:a.answerImportedAt||''});
    }
    return {headers:QNA_HEADERS,rows};
  }
  function tsvCell(x) {
    if (x === null || x === undefined) return '';
    let s = S(x).replace(/\r\n?/g,'\n').replace(/\n/g,'<BR>').replace(/\t/g,' ').replace(/\u0000/g,'');
    if (/^[=+@]/.test(s) || (/^-(?!\d+(?:\.\d+)?$)/.test(s))) s = "'" + s;
    return s;
  }
  function toTSV(state, kind) {
    const {headers,rows} = outputRows(state,kind);
    return [headers.map(x=>x[1]).join('\t'), ...rows.map(r=>headers.map(h=>tsvCell(r[h[0]])).join('\t'))].join('\r\n');
  }
  // サマリーのコピーだけを縦2列で出力する。TSV保存と他の出力は従来形式のまま。
  function toVerticalSummaryTSV(state) {
    const {headers,rows} = outputRows(state,'summary');
    const values = rows[0] || {};
    return ['項目\t値', ...headers.map(([key,label])=>tsvCell(label)+'\t'+tsvCell(values[key]))].join('\r\n');
  }
  function addWarning(state, message) {
    if (!state.warnings.includes(message)) state.warnings.push(message);
  }
  function mergeQuestion(state, q) {
    const old = state.questions[q.questionId];
    if (!old) {state.questions[q.questionId]=q;return;}
    state.questions[q.questionId] = {...old, ...q, answers:{...(old.answers||{}),...(q.answers||{})},
      detailFetched:old.detailFetched || q.detailFetched,
      detailStatus:old.detailFetched ? old.detailStatus : q.detailStatus };
  }
  async function requestHtml(url, state) {
    if (state.requestCount >= MAX_REQUESTS) throw new Error(`安全上限${MAX_REQUESTS}リクエストに達したため停止しました。`);
    const u = safeUrl(url,state.companyPath);
    if (!u) throw new Error('別企業または無効なURLへの移動を拒否しました。');
    const kind = ['reviews','faq','details'].includes(state.stage) ? state.stage : 'legacy';
    state.lastUrl=u;state.requestCount++;
    state.requestCounts ||= {reviews:0,faq:0,details:0,legacy:0};
    state.requestCounts[kind] = (state.requestCounts[kind]||0)+1;
    let response;
    try {
      response = await fetch(u,{credentials:'same-origin',redirect:'follow',headers:{Accept:'text/html,application/xhtml+xml'}});
    } catch (e) {
      logActivity(state,kind,'network-error');
      throw e;
    }
    logActivity(state,kind,response.status);
    if (response.status===429) {
      const info=retryAfterInfo(response.headers.get('Retry-After'));
      const err=new Error(`HTTP 429（アクセス制限）：${u}`);
      err.httpStatus=429;err.retryAfter=info.raw;err.retryAt=info.retryAt;
      throw err;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}：${u}`);
    if (!response.url || !safeUrl(response.url,state.companyPath)) throw new Error('企業ページ以外へリダイレクトされました。');
    const ct = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(ct)) throw new Error('HTML以外の応答でした。');
    const html = await response.text();
    if (!html.includes('comp-initialData')) throw new Error('企業JSONがない応答でした。認証・アクセス制限の可能性があります。');
    return parseDocument(html);
  }

  // 自動巡回は常に1リクエストずつ。HTTPエラー時の迂回・再試行はしない。
  async function runCollection(state, save, render, isPaused) {
    const doReviews = ['both','reviews'].includes(state.options.target);
    const doFaq = ['both','faq'].includes(state.options.target);
    try {
      if (doReviews && !state.reviewDone) {
        state.stage='reviews';save(state);render();
        while (state.reviewNext && !isPaused()) {
          const url = normalizedUrl(state.reviewNext);
          if (state.visitedReviews[url]) {addWarning(state,'クチコミページ送りがループしたため停止'); state.reviewNext='';break;}
          const {data,doc} = await requestHtml(url,state);
          if (!data.reviewsList) throw new Error('クチコミページ以外が返されました。');
          const part = reviewsExtract(data,state.companyPath,url,state.reviewPages+1);
          state.companyName = state.companyName || companyFromData(data);
          state.companyId = companyIdFromData(data,state.companyPath);
          if (state.reviewPages===0) state.reviewSummary=part.summary;
          for(const r of part.rows) state.reviews[r.reviewId]=r;
          state.visitedReviews[url]=true;state.reviewPages++;
          const next = nextReviewUrl(data,doc,state.companyPath,url);
          state.reviewNext = state.options.scope==='one' ? '' : next;
          state.lastSuccessAt=now(); save(state);render();
          if (state.reviewNext && !isPaused()) await pause(DELAY_MS);
        }
        if (!isPaused()) {
          state.reviewDone=true;
          const n=Number(state.reviewSummary.listReviewCount || state.reviewSummary.reviewCount || 0);
          if (state.options.scope==='all' && n && counts(state).reviews !== n) addWarning(state,`クチコミ取得件数が一致しません（${counts(state).reviews}/${n}件）。ページ送り非対応の可能性があります。`);
          save(state);render();
        }
      }
      if (doFaq && !state.faqDone && !isPaused()) {
        state.stage='faq';save(state);render();
        if(state.requestCount>0) await pause(DELAY_MS);
        while(state.faqNext && !isPaused()) {
          const url=normalizedUrl(state.faqNext);
          if(state.visitedFaq[url]){addWarning(state,'質問一覧ページ送りがループしたため停止');state.faqNext='';break;}
          const {data} = await requestHtml(url,state);
          if (!data.qnaPaginatedQuestionsViewModel) throw new Error('質問一覧ページ以外が返されました。');
          const part=questionsExtract(data,state.companyPath,url,state.faqPages+1);
          state.companyName=state.companyName || companyFromData(data);
          state.companyId=companyIdFromData(data,state.companyPath);
          state.expectedFaqCount = state.expectedFaqCount || part.expectedCount;
          for(const q of part.questions) mergeQuestion(state,q);
          state.visitedFaq[url]=true;state.faqPages++;
          state.faqNext=state.options.scope==='one' ? '' : part.nextUrl;
          state.lastSuccessAt=now();save(state);render();
          if(state.faqNext && !isPaused()) await pause(DELAY_MS);
        }
        if(!isPaused()){
          state.faqDone=true;
          if (state.options.scope==='all' && state.expectedFaqCount && counts(state).questions!==state.expectedFaqCount)
            addWarning(state,`質問取得件数が一致しません（${counts(state).questions}/${state.expectedFaqCount}件）。`);
          save(state);render();
        }
      }
      if(doFaq && state.faqDone && !state.detailDone && !isPaused()) {
        state.stage='details';save(state);render();
        if(state.options.answers==='full') {
          const qs=Object.values(state.questions).filter(q=>q.totalAnswerCount>Object.keys(q.answers||{}).length);
          for(const q of qs){
            if(isPaused())break;
            if(state.visitedDetails[q.questionId])continue;
            if(!q.questionUrl){q.detailStatus='URLなし';addWarning(state,`質問詳細URLなし：${q.questionId}`);state.visitedDetails[q.questionId]=true;save(state);continue;}
            await pause(DELAY_MS);
            const {data}=await requestHtml(q.questionUrl,state);
            const result=answersExtract(data,state.companyPath);
            if(result.questionId!==q.questionId) throw new Error(`詳細ページの質問IDが一致しません：${q.questionId}`);
            const detailAnswers=Object.fromEntries(Object.entries(result.answers).map(([id,a])=>
              [id,{...a,answerSource:'質問詳細',answerPage:result.page,
                answerSourceUrl:q.questionUrl,answerImportedAt:''}]));
            q.answers={...(q.answers||{}),...detailAnswers};
            q.detailFetched=true;q.detailStatus='取得済み';
            q.detailPages ||= {};
            q.detailPages[result.page]={source:'質問詳細',sourceUrl:q.questionUrl,
              answerCount:Object.keys(result.answers).length,fetchedAt:now()};
            q.totalAnswerCount=Math.max(q.totalAnswerCount,result.totalAnswerCount);
            state.visitedDetails[q.questionId]=true;
            state.lastSuccessAt=now();save(state);render();
            if(Object.keys(q.answers).length<q.totalAnswerCount)
              addWarning(state,`詳細ページの回答数不足：${q.questionId}（${Object.keys(q.answers).length}/${q.totalAnswerCount}件）`);
          }
        }
        if(!isPaused()) {
          if(state.options.answers==='list') {
            for(const q of Object.values(state.questions))
              if(q.totalAnswerCount>Object.keys(q.answers || {}).length) q.detailStatus='代表回答のみ';
          }
          state.detailDone=true;save(state);render();
        }
      }
      if(!isPaused()){
        state.status='done';state.stage='done';state.updatedAt=now();save(state);render();
      }
    } catch(e) {
      state.status = e?.httpStatus===429 ? 'rate_limited' : 'error';
      state.error = S(e?.message || e);
      if (e?.httpStatus===429) {
        state.rateLimit={detectedAt:now(),retryAfter:S(e.retryAfter),retryAt:e.retryAt||null,
          requestUrl:state.lastUrl};
      }
      addWarning(state,`収集停止：${state.error}`);save(state);render();
    }
  }

  // HTMLのローカルサンプルを使う回帰テストの入口。実ユーザー環境では有効にならない。
  if (typeof globalThis !== 'undefined' && globalThis.__ICH_TEST_MODE__ === true) {
    globalThis.__ICH_TEST_API__ = {reviewsExtract,questionsExtract,answersExtract,nextReviewUrl,
      newState,counts,summaryStatus,outputRows,toTSV,mergeQuestion,safeUrl,runCollection,
      normalizeState,activityEvents,activitySummary,retryAfterInfo,requestHtml,
      normalizeImportedHtml,detailPageIndex,answerCompleteness,parseImportHtml,
      importPlan,applyImportPlan};
    return;
  }

  const path = getCompanyPath(location.href);
  if (!path || !/^\/cmp\/[^/]+\/(?:reviews(?:\/.*)?|faq(?:\/.*)?)\/?$/i.test(location.pathname)) return;
  if(document.getElementById(ROOT_ID))return;
  const key = PREFIX + path;
  const optionsKey = PREFIX + 'options';
  const uiKey = PREFIX + 'uiOpen';
  const DEFAULTS={target:'both',scope:'all',answers:'full'};
  function read(keyName, fallback) {
    try { const x=GM_getValue(keyName,null); return x===null ? fallback : JSON.parse(x); }
    catch { return fallback; }
  }
  function write(keyName,value) {GM_setValue(keyName,JSON.stringify(value));}
  let options={...DEFAULTS,...read(optionsKey,{})};
  let state=read(key,null);
  if (state && normalizeState(state)) write(key,state);
  let uiOpen=read(uiKey,true);
  let interrupted=false, busy=false, importBusy=false, pendingImport=null;
  if(state?.status==='running') {state.status='paused'; addWarning(state,'前回の取得はページ移動・終了により中断されました。再開できます。');write(key,state);}

  const mount=document.createElement('div');mount.id=ROOT_ID;
  // CSP、Reactの再描画による干渉を避けるため Shadow DOM 内でUIを作成
  const root=mount.attachShadow({mode:'open'});
  root.innerHTML=`<style>
    :host{all:initial;font-family:Arial,'Noto Sans JP',sans-serif;color:#222;font-size:13px;}
    *{box-sizing:border-box}
    #tab{position:fixed;right:0;top:44%;z-index:2147483645;writing-mode:vertical-rl;background:#304eb3;color:#fff;padding:14px 8px;border:none;border-radius:9px 0 0 9px;box-shadow:0 2px 12px #0003;cursor:pointer;font-size:12px;font-weight:bold}
    #panel{position:fixed;right:0;top:62px;bottom:18px;width:min(386px,calc(100vw - 15px));overflow-y:auto;z-index:2147483646;background:#fff;box-shadow:0 4px 28px #0004;border:1px solid #ddd;border-radius:12px 0 0 12px;padding:16px;line-height:1.5;color:#222}
    #panel[hidden],#tab[hidden]{display:none!important}
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.title{font-size:16px;font-weight:700}.sub{font-size:11px;color:#555;overflow-wrap:anywhere;margin-top:5px}
    .close{background:#f3f4f6;color:#555;border:none;padding:5px 9px;font-size:17px;border-radius:7px;cursor:pointer}
    section{padding-top:11px;margin-top:10px;border-top:1px solid #e4e4e7} .label{font-weight:700;font-size:12px;margin-bottom:7px}
    .radios{display:flex;flex-wrap:wrap;gap:7px 12px}.radios label{display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px}
    input[type=radio]{accent-color:#3258c8;margin:0}button{font-family:inherit} .buttons{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
    .btn{border:1px solid #aaa;border-radius:8px;background:#fff;color:#222;cursor:pointer;font-size:12px;font-weight:600;padding:8px 10px;flex:1;min-width:80px}
    .primary{background:#3258c8;border-color:#3258c8;color:#fff}.btn:hover:not(:disabled){filter:brightness(.96)}
    button:disabled{opacity:.43;cursor:not-allowed} .stats{background:#f4f6fb;border-radius:8px;padding:10px;font-size:12px;white-space:pre-line;overflow-wrap:anywhere}
    .hint{font-size:11px;color:#555;margin-top:6px}.warn{font-size:11px;color:#9d3f00;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:8px}
    #toast{font-size:11px;color:#20572b;min-height:16px;margin-top:6px} .strong{font-weight:700} .check{padding:3px 0;color:#39465a}
    .outrow{display:flex;gap:6px;margin-bottom:6px}.outrow>.btn{min-width:0}.outrow>.btn:first-child{flex:2}
    #import-files{display:block;width:100%;font-size:11px;margin:9px 0 4px;max-width:100%}
    details>summary{list-style:auto}#import-report{overflow-wrap:anywhere}
  </style>
  <button id="tab" type="button" aria-label="Indeed企業情報Helperを開く">企業情報Helper</button>
  <aside id="panel" role="complementary" aria-label="Indeed企業情報Helper">
    <div class="head"><div><div class="title">Indeed Company Helper <small style="font-size:10px;color:#777">v${VER}</small></div><div id="company" class="sub"></div></div>
    <button id="close" type="button" class="close" aria-label="閉じる">×</button></div>
    <section><div class="label">取得対象</div><div class="radios">
      <label><input type="radio" name="target" value="both"> 両方</label>
      <label><input type="radio" name="target" value="reviews"> クチコミ</label>
      <label><input type="radio" name="target" value="faq"> 質問箱</label></div></section>
    <section><div class="label">取得範囲</div><div class="radios">
      <label><input type="radio" name="scope" value="all"> 全ページ</label>
      <label><input type="radio" name="scope" value="one"> 各一覧の先頭1ページ</label></div>
      <div class="hint">1ページ指定の場合も、選択した取得対象の先頭ページを読み込みます。</div></section>
    <section id="answers-area"><div class="label">質問箱の回答</div><div class="radios">
      <label><input type="radio" name="answers" value="full"> 質問詳細の先頭ページまで取得</label>
      <label><input type="radio" name="answers" value="list"> 一覧の代表回答のみ</label></div></section>
    <section><div class="label">取得状況</div><div class="stats" id="stats"></div>
      <div class="stats" id="history" style="margin-top:8px"></div>
      <div class="buttons"><button type="button" class="btn primary" id="start">新規取得</button><button type="button" class="btn" id="pause">一時停止</button><button type="button" class="btn" id="resume">再開</button></div>
      <div id="warnings" class="warn"></div></section>
    <section>
      <details id="html-import"><summary class="label" style="cursor:pointer">保存HTMLの追加取込（オフライン）</summary>
        <div class="hint">質問詳細ページを保存したHTMLを複数選択できます。サイトへの追加通信は行いません。</div>
        <input type="file" id="import-files" accept=".html,.htm,.txt,.md,text/html,text/plain" multiple aria-label="質問詳細の保存HTMLを選択">
        <div class="buttons"><button type="button" class="btn" id="preview-import">選択ファイルを解析</button>
          <button type="button" class="btn primary" id="commit-import" disabled>取込を確定</button></div>
        <div id="import-report" class="stats" style="margin-top:8px;display:none" role="status"></div>
        <div class="hint">別企業・質問IDの不一致・解析失敗がある場合は取り込みません。既存回答は上書きしません。</div>
      </details>
    </section>
    <section><div class="label">TSV出力</div>
      <div class="outrow"><button class="btn" data-copy="summary">企業サマリーを縦型コピー</button><button class="btn" data-save="summary">保存</button></div>
      <div class="outrow"><button class="btn" data-copy="reviews">クチコミ明細をコピー</button><button class="btn" data-save="reviews">保存</button></div>
      <div class="outrow"><button class="btn" data-copy="faq">質問・回答明細をコピー</button><button class="btn" data-save="faq">保存</button></div>
      <div class="hint">タブ・改行を除去してTSV出力します。元の文章改行は &lt;BR&gt; に変換します。</div>
      <div class="buttons"><button class="btn" id="clear" type="button">この企業の取得データをクリア</button></div>
      <div id="toast" role="status" aria-live="polite"></div>
    </section>
  </aside>`;
  document.body.appendChild(mount);
  const $=(selector)=>root.querySelector(selector);
  const $$=(selector)=>Array.from(root.querySelectorAll(selector));
  const getUIOptions=()=>({
    target:$('input[name=target]:checked')?.value || options.target,
    scope:$('input[name=scope]:checked')?.value || options.scope,
    answers:$('input[name=answers]:checked')?.value || options.answers
  });
  function save(s){ s.updatedAt=now();state=s;write(key,s); pendingImport=null; }
  function toast(msg){$('#toast').textContent=msg;}
  function render(){
    $('#tab').hidden=uiOpen;$('#panel').hidden=!uiOpen;
    $('#company').textContent=state?.companyName || decodeURIComponent(path.split('/').pop());
    const isRunning=busy && state?.status==='running';
    const effective=isRunning ? state.options : options;
    for(const input of $$('input[type=radio]')) {
      input.checked=input.value===effective[input.name];input.disabled=isRunning;
    }
    $('#answers-area').style.display=effective.target==='reviews'?'none':'';
    const c=state?counts(state):{reviews:0,questions:0,answers:0,expectedAnswers:0};
    const phase=({reviews:'クチコミ収集',faq:'質問一覧収集',details:'質問詳細収集',done:'終了'})[state?.stage]||'未開始';
    let status=({running:'取得中',paused:'一時停止',done:'取得終了',error:'取得エラー',rate_limited:'HTTP 429で停止'})[state?.status]||'未取得';
    if(state?.status==='done' && state.warnings.length) status='取得終了（要確認）';
    const runOpts = state?.options || effective;
    const limitText=runOpts.scope==='one'?'各一覧先頭1ページ':'全ページ';
    const rc=state?.requestCounts||{};
    $('#stats').textContent=`状態：${status} ／ ${phase}\n実行範囲：${limitText}\nクチコミ：${c.reviews}件（${state?.reviewPages||0}ページ） 【${summaryStatus(state,'reviews')}】\n質問：${c.questions}件（${state?.faqPages||0}ページ） 【${summaryStatus(state,'faq')}】\n回答：${c.answers}件 / 表示回答総数${c.expectedAnswers}件 【${summaryStatus(state,'answers')}】\n送信リクエスト：${state?.requestCount||0}回（クチコミ${rc.reviews||0}・質問一覧${rc.faq||0}・質問詳細${rc.details||0}・旧版未分類${rc.legacy||0}）`;
    const history=activitySummary();
    const last429=history.last429 ? `\n直近429：${formatLocalTime(history.last429.time)}（${decodeURIComponent(history.last429.company).slice(0,50)}）` : '';
    let limitInfo='';
    if (state?.status==='rate_limited') {
      const rl=state.rateLimit||{};
      limitInfo=`\nサーバー指定Retry-After：${rl.retryAfter||'なし'}\n再開指定日時：${rl.retryAt?formatLocalTime(rl.retryAt):'不明（自動再試行しません）'}`;
    }
    $('#history').textContent=`このブラウザの収集通信履歴（v1.0.1以降）\n直近1時間：${history.hour}回／${history.companiesHour}社\n直近24時間：${history.day}回／${history.companiesDay}社${last429}${limitInfo}`;
    $('#warnings').textContent=(state?.error ? 'エラー：'+state.error+'\n':'') + (state?.warnings||[]).slice(-4).join('\n');
    $('#start').disabled=isRunning||importBusy;
    $('#preview-import').disabled=isRunning||importBusy;
    $('#commit-import').disabled=isRunning||importBusy||!pendingImport;
    $('#pause').disabled=!isRunning;
    const waitingUntil=state?.status==='rate_limited' && state.rateLimit?.retryAt && Date.now()<state.rateLimit.retryAt;
    $('#resume').disabled=busy || !state || !['paused','error','rate_limited'].includes(state.status) || Boolean(waitingUntil);
    $('#resume').textContent=state?.status==='rate_limited'?'再開（制限確認）':'再開';
    $('#clear').disabled=isRunning||importBusy;
    $$('[data-copy],[data-save]').forEach(el => el.disabled=!state);
  }
  function setOpen(open){uiOpen=open;write(uiKey,open);render();}
  $('#tab').addEventListener('click',()=>setOpen(true));
  $('#close').addEventListener('click',()=>setOpen(false));
  $$('input[type=radio]').forEach(el=>el.addEventListener('change',()=>{
    if(busy||importBusy)return;clearImportPreview();options=getUIOptions();write(optionsKey,options);render();
  }));
  async function execute(s){
    if(busy||importBusy)return;
    busy=true;interrupted=false;
    s.status='running';s.error='';save(s);render();
    await runCollection(s,save,render,()=>interrupted);
    if(interrupted && s.status==='running') {s.status='paused';save(s);}
    busy=false;render();
  }
  $('#start').addEventListener('click',()=>{
    if(busy||importBusy)return;
    if(state && !window.confirm('この企業の保存済み収集データを破棄し、取得し直しますか？'))return;
    options=getUIOptions();write(optionsKey,options);
    execute(newState(path,options));
  });
  $('#pause').addEventListener('click',()=>{
    if(!busy)return;
    interrupted=true;toast('停止を要求しました。実行中の通信が終わった時点で一時停止します。');
  });
  $('#resume').addEventListener('click',()=>{
    if(busy || importBusy || !state)return;
    if(state.status==='rate_limited') {
      if (state.rateLimit?.retryAt && Date.now()<state.rateLimit.retryAt) {
        toast('Retry-Afterによりサーバー指定の待機中です。');return;
      }
      if (!window.confirm('前回HTTP 429でアクセス制限を受けました。サーバーの利用条件とアクセス許可を確認しましたか？解除を保証できません。取得済みデータを保持して未取得地点から手動で再開しますか？')) return;
      state.error='';
      state.warnings=state.warnings.filter(w=>!w.startsWith('収集停止：'));
    }
    if(state.status==='error') {
      // エラーが発生したページは未訪問のまま残されている。復帰可能な場合のみ再実行。
      state.error='';
      state.warnings=state.warnings.filter(w=>!w.startsWith('収集停止：'));
    }
    execute(state);
  });
  $('#clear').addEventListener('click',()=>{
    if(busy||importBusy)return;
    if(!window.confirm('この企業の取得データをクリアしますか？（設定は維持します）'))return;
    state=null;GM_deleteValue(key);toast('この企業の取得データをクリアしました。');render();
  });
  async function copy(kind) {
    if(!state)return;
    const value=kind==='summary'?toVerticalSummaryTSV(state):toTSV(state,kind);
    try {
      if(typeof GM_setClipboard === 'function')GM_setClipboard(value,'text');
      else await navigator.clipboard.writeText(value);
      toast(`${kind==='summary'?'企業サマリー（縦型）':kind==='reviews'?'クチコミ明細':'質問・回答明細'}をコピーしました。`);
    } catch(e) {toast('コピー失敗：'+S(e?.message||e));}
  }
  function download(kind){
    if(!state)return;
    const value=toTSV(state,kind);
    const blob=new Blob(['\ufeff'+value],{type:'text/tab-separated-values;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`indeed-company-${kind}-${S(state.companyId).replace(/[^\w-]/g,'_')}-${new Date().toISOString().slice(0,10)}.tsv`;
    root.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    toast('TSV保存を開始しました。');
  }
  function clearImportPreview(message='') {
    pendingImport=null;
    $('#commit-import').disabled=true;
    $('#import-report').style.display=message?'block':'none';
    $('#import-report').textContent=message;
  }
  $('#import-files').addEventListener('change',()=>clearImportPreview());
  $('#preview-import').addEventListener('click',async()=>{
    if(busy||importBusy)return;
    const files=Array.from($('#import-files').files||[]);
    if(!files.length){clearImportPreview('HTMLファイルを選択してください。');return;}
    if(files.length>IMPORT_MAX_FILES){clearImportPreview(`最大${IMPORT_MAX_FILES}ファイルまでです。`);return;}
    if(files.some(f=>f.size>IMPORT_MAX_FILE_BYTES)||files.reduce((n,f)=>n+f.size,0)>IMPORT_MAX_TOTAL_BYTES){
      clearImportPreview('ファイル容量の上限を超えました（1件8MB・合計48MB）。');return;
    }
    importBusy=true;clearImportPreview();render();
    const extracted=[],failures=[];
    try {
      for(const f of files) {
        try {
          if(!/\.(?:html?|txt|md)$/i.test(f.name))throw new Error('対応形式はHTML・TXT・MDです。');
          const parsed=parseImportHtml(await f.text(),f.name,path);
          if(state?.questions?.[parsed.questionId]?.questionText && parsed.questionText &&
             state.questions[parsed.questionId].questionText!==parsed.questionText)
             throw new Error('質問IDが既存の質問文と一致しません。');
          extracted.push(parsed);
        } catch(e) {failures.push(`${f.name}: ${S(e?.message||e)}`);}
      }
      if(failures.length) {
        clearImportPreview(`${files.length}ファイル中${failures.length}件が解析できません。保存内容は変更していません。\n${failures.slice(0,12).join('\n')}`);
      } else {
        const plan=importPlan(state,path,extracted);
        // Dry-run once to catch collisions before enabling commit.
        applyImportPlan(state,path,plan);
        const stateKey=read(key,null)?.updatedAt||'';
        pendingImport={plan,stateKey,files:files.map(f=>f.name)};
        const st=plan.stats;
        const mismatch=plan.problems.length?`\n注意：${plan.problems.slice(0,8).join(' / ')}`:'';
        $('#import-report').style.display='block';
        $('#import-report').textContent=`解析完了：${st.files}ファイル\n質問：${st.questions}件／回答ページ：${st.pages}ページ\nHTML内のユニーク回答：${st.answers}件\n新規追加見込み：${st.newAnswers}件／重複：${st.duplicates}件\n内容不一致：${st.conflicts}件（既存優先）${mismatch}\n「取込を確定」で保存します。`;
      }
    } catch(e) {clearImportPreview('解析失敗：'+S(e?.message||e));}
    finally {importBusy=false;render();}
  });
  $('#commit-import').addEventListener('click',()=>{
    if(busy||importBusy||!pendingImport)return;
    const staged=pendingImport;
    if((read(key,null)?.updatedAt||'')!==staged.stateKey){
      clearImportPreview('保存内容が別の操作で変更されました。解析し直してください。');return;
    }
    try {
      const result=applyImportPlan(state,path,staged.plan);
      // Persist once. If storage fails, keep original UI state and preview.
      const candidate=result.state;
      candidate.updatedAt=now();
      write(key,candidate);
      state=candidate;
      clearImportPreview(`取込完了：回答${result.added}件を追加。サイトへの通信は行っていません。`);
      render();
      toast(`保存HTMLの取込完了（追加回答${result.added}件）`);
    } catch(e) {clearImportPreview('取込失敗・元データ維持：'+S(e?.message||e));render();}
  });
  $$('[data-copy]').forEach(el=>el.addEventListener('click',()=>copy(el.dataset.copy)));
  $$('[data-save]').forEach(el=>el.addEventListener('click',()=>download(el.dataset.save)));
  render();
})();