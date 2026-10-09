// ==UserScript==
// @name         Indeed Company Helper - Reviews & Q&A
// @name:ja      Indeed企業情報Helper（クチコミ・質問箱）
// @namespace    https://github.com/tsicb/tampermonkey-scripts
// @version      1.0.0
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
  const VER = '1.0.0';
  const PREFIX = 'indeedCompanyHelper_v1_';
  const ROOT_ID = 'ich-root-v1';
  const BASE = 'https://jp.indeed.com';
  const DELAY_MS = 1200;
  const MAX_REQUESTS = 1500; // 防御的な無限巡回対策。達した場合は「一部未取得」扱い

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
      totalAnswerCount: Number(q.totalAnswerCount ?? p.totalAnswerCount) || 0, answers };
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
      warnings: [], error: '', lastUrl: '', lastSuccessAt: '' };
  }
  function counts(state) {
    const qs = Object.values(state.questions || {});
    return { reviews:Object.keys(state.reviews || {}).length, questions:qs.length,
      answers:qs.reduce((n,q) => n + Object.keys(q.answers || {}).length, 0),
      expectedAnswers:qs.reduce((n,q) => n + Number(q.totalAnswerCount || 0), 0),
      incompleteQuestions:qs.filter(q => Object.keys(q.answers || {}).length !== Number(q.totalAnswerCount || 0)).length };
  }
  function summaryStatus(state, key) {
    if (!state) return '未取得';
    if (key === 'reviews' && !['both','reviews'].includes(state.options.target)) return '未取得';
    if (key === 'faq' && !['both','faq'].includes(state.options.target)) return '未取得';
    const c = counts(state);
    if (state.status === 'running' || state.status === 'paused') return state.status === 'running' ? '取得中' : '一時停止';
    if (state.status === 'error') return '取得エラー';
    if (state.options.scope === 'one') return '範囲限定';
    if (key === 'reviews') {
      const n = Number(state.reviewSummary.listReviewCount || state.reviewSummary.reviewCount || 0);
      return !state.reviewDone || (n && c.reviews !== n) ? '一部未取得' : '完全取得';
    }
    if (!state.faqDone || !state.detailDone ||
        (state.expectedFaqCount && c.questions !== state.expectedFaqCount) ||
        (state.options.answers === 'full' && c.incompleteQuestions)) return '一部未取得';
    return state.options.answers === 'list' ? '代表回答のみ' : '完全取得';
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
    ['faqStatus','質問箱取得状態'],['warnings','注意事項']];
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
    ['completeness','回答完全性'],['page','質問一覧ページ番号'],['sourceUrl','取得元URL']];
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
        warnings:state.warnings.join(' / ') || state.error }]};
    }
    if (kind === 'reviews') return {headers:REVIEW_HEADERS, rows:Object.values(state.reviews)
      .sort((a,b) => (a.page-b.page) || a.reviewId.localeCompare(b.reviewId))
      .map(r=>({...base,...r}))};
    const rows=[];
    for(const q of Object.values(state.questions).sort((a,b) => (a.page-b.page) || a.questionId.localeCompare(b.questionId))) {
      const n = Object.keys(q.answers || {}).length;
      const complete = n === q.totalAnswerCount;
      const question = {...base, fetchedAt:q.fetchedAt,
        questionId:q.questionId,questionText:q.questionText,questionDate:q.questionDate,
        questionDisplayDate:q.questionDisplayDate,questionUrl:q.questionUrl,
        totalAnswerCount:q.totalAnswerCount,collectedAnswerCount:n,
        detailStatus:q.detailStatus,completeness:complete?'完全':'一部未取得',page:q.page,sourceUrl:q.sourceUrl};
      const answers = Object.values(q.answers || {});
      if (!answers.length) rows.push({...question,answerSource:'回答なし／未取得'});
      else for (const a of answers) rows.push({...question,...a,
        answerSource: q.detailFetched ? '質問詳細' : '質問一覧'});
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
    state.lastUrl=u;state.requestCount++;
    const response = await fetch(u,{credentials:'same-origin',redirect:'follow',headers:{Accept:'text/html,application/xhtml+xml'}});
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
            q.answers={...(q.answers||{}),...result.answers};
            q.detailFetched=true;q.detailStatus='取得済み';
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
      state.status = 'error'; state.error = S(e?.message || e);
      addWarning(state,`収集停止：${state.error}`);save(state);render();
    }
  }

  // HTMLのローカルサンプルを使う回帰テストの入口。実ユーザー環境では有効にならない。
  if (typeof globalThis !== 'undefined' && globalThis.__ICH_TEST_MODE__ === true) {
    globalThis.__ICH_TEST_API__ = {reviewsExtract,questionsExtract,answersExtract,nextReviewUrl,
      newState,counts,summaryStatus,outputRows,toTSV,mergeQuestion,safeUrl,runCollection};
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
  let uiOpen=read(uiKey,true);
  let interrupted=false, busy=false;
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
      <label><input type="radio" name="answers" value="full"> 全回答（不足分は詳細取得）</label>
      <label><input type="radio" name="answers" value="list"> 一覧の代表回答のみ</label></div></section>
    <section><div class="label">取得状況</div><div class="stats" id="stats"></div>
      <div class="buttons"><button type="button" class="btn primary" id="start">新規取得</button><button type="button" class="btn" id="pause">一時停止</button><button type="button" class="btn" id="resume">再開</button></div>
      <div id="warnings" class="warn"></div></section>
    <section><div class="label">TSV出力</div>
      <div class="outrow"><button class="btn" data-copy="summary">企業サマリーをコピー</button><button class="btn" data-save="summary">保存</button></div>
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
  function save(s){ s.updatedAt=now();state=s;write(key,s); }
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
    let status=({running:'取得中',paused:'一時停止',done:'取得終了',error:'取得エラー'})[state?.status]||'未取得';
    if(state?.status==='done' && state.warnings.length) status='取得終了（要確認）';
    const runOpts = state?.options || effective;
    const limitText=runOpts.scope==='one'?'各一覧先頭1ページ':'全ページ';
    $('#stats').textContent=`状態：${status} ／ ${phase}\n実行範囲：${limitText}\nクチコミ：${c.reviews}件（${state?.reviewPages||0}ページ） 【${summaryStatus(state,'reviews')}】\n質問：${c.questions}件（${state?.faqPages||0}ページ） 【${summaryStatus(state,'faq')}】\n回答：${c.answers}件 / 確認済み総数${c.expectedAnswers}件\n送信リクエスト：${state?.requestCount||0}回`;
    $('#warnings').textContent=(state?.error ? 'エラー：'+state.error+'\n':'') + (state?.warnings||[]).slice(-4).join('\n');
    $('#start').disabled=isRunning;
    $('#pause').disabled=!isRunning;
    $('#resume').disabled=busy || !state || !['paused','error'].includes(state.status);
    $('#clear').disabled=isRunning;
    $$('[data-copy],[data-save]').forEach(el => el.disabled=!state);
  }
  function setOpen(open){uiOpen=open;write(uiKey,open);render();}
  $('#tab').addEventListener('click',()=>setOpen(true));
  $('#close').addEventListener('click',()=>setOpen(false));
  $$('input[type=radio]').forEach(el=>el.addEventListener('change',()=>{
    if(busy)return;options=getUIOptions();write(optionsKey,options);render();
  }));
  async function execute(s){
    if(busy)return;
    busy=true;interrupted=false;
    s.status='running';s.error='';save(s);render();
    await runCollection(s,save,render,()=>interrupted);
    if(interrupted && s.status==='running') {s.status='paused';save(s);}
    busy=false;render();
  }
  $('#start').addEventListener('click',()=>{
    if(busy)return;
    if(state && !window.confirm('この企業の保存済み収集データを破棄し、取得し直しますか？'))return;
    options=getUIOptions();write(optionsKey,options);
    execute(newState(path,options));
  });
  $('#pause').addEventListener('click',()=>{
    if(!busy)return;
    interrupted=true;toast('停止を要求しました。実行中の通信が終わった時点で一時停止します。');
  });
  $('#resume').addEventListener('click',()=>{
    if(busy || !state)return;
    if(state.status==='error') {
      // エラーが発生したページは未訪問のまま残されている。復帰可能な場合のみ再実行。
      state.error='';
      state.warnings=state.warnings.filter(w=>!w.startsWith('収集停止：'));
    }
    execute(state);
  });
  $('#clear').addEventListener('click',()=>{
    if(busy)return;
    if(!window.confirm('この企業の取得データをクリアしますか？（設定は維持します）'))return;
    state=null;GM_deleteValue(key);toast('この企業の取得データをクリアしました。');render();
  });
  async function copy(kind) {
    if(!state)return;
    const value=toTSV(state,kind);
    try {
      if(typeof GM_setClipboard === 'function')GM_setClipboard(value,'text');
      else await navigator.clipboard.writeText(value);
      toast(`${kind==='summary'?'企業サマリー':kind==='reviews'?'クチコミ明細':'質問・回答明細'}をコピーしました。`);
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
  $$('[data-copy]').forEach(el=>el.addEventListener('click',()=>copy(el.dataset.copy)));
  $$('[data-save]').forEach(el=>el.addEventListener('click',()=>download(el.dataset.save)));
  render();
})();