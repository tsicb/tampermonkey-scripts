// ==UserScript==
// @name         Indeed Helper Batch Export
// @namespace    http://tampermonkey.net/
// @version      2.0.1
// @description  現行Indeedの検索結果・求人詳細・Indeed解釈・ユーザー文脈を単発/一括でTSV出力
// @match        https://jp.indeed.com/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @updateURL    https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-helper-batch-export.user.js
// @downloadURL  https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-helper-batch-export.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = 'tm-indeed-helper-panel';
  const STYLE_ID = 'tm-indeed-helper-style';
  const BATCH_STATE_KEY = 'tmIndeedBatchState_v2';
  const SEARCH_CRAWL_STATE_KEY = 'tmIndeedSearchCrawlState_v2';
  const PANEL_COLLAPSED_KEY = 'tmIndeedHelperPanelCollapsed_v1';
  const PROFILE_LABEL_KEY = 'tmIndeedHelperProfileLabel_v1';
  const SCHEMA_VERSION = 'indeed-current-2026-09-v2';
  const ARRAY_SEP = '::';
  let candidateRootsCache = { url: '', roots: [], checkedAt: 0 };
  let ldJobPostingCache = { url: '', value: null, checkedAt: 0 };

  const HEADERS = [
    '取得セッションID',
    'クロール開始日時',
    '詳細取得日時',
    '取得プロファイル',
    'ログイン状態',
    '取得URL',
    'canonical URL',
    'ページタイトル',
    '検索URL',
    '検索キーワード',
    '検索勤務地',
    '検索半径',
    '検索start値',
    '検索ページ番号',
    '検索総件数',
    '関連検索候補',
    '検索条件JSON',
    '次ページURL',
    'ページ内表示順',
    '検索結果元リンク',
    '検索結果リンク種別',
    '検索結果スポンサー判定',
    '検索結果スポンサー根拠',
    '検索結果新着表示',
    '検索結果HiringEvent',
    '検索時求人タイトル',
    '検索時会社名',
    '検索時勤務地',
    '検索時給与',
    '検索時雇用形態',
    '検索時タグ',
    '検索時スニペット',
    '検索時会社評価',
    '検索カード属性JSON',
    '詳細ページスポンサー判定',
    'requestPath',
    '求人キー',
    '求人タイトル',
    'Indeed標準職種名',
    '言語',
    '国',
    '雇用形態表示',
    '雇用形態コード',
    'リモート求人',
    'HiringEvent',
    'インターン求人',
    '会社名',
    '求人本文内企業名',
    '親会社名',
    '会社ページURL',
    '会社口コミURL',
    '企業評価',
    '企業口コミ件数',
    '返信率企業headline',
    '返信率企業description',
    'responseRate',
    'averageResponseInDays',
    '勤務地表示',
    '勤務地完全住所',
    '郵便番号',
    '都道府県',
    '市区町村相当',
    'streetAddress',
    '国コード',
    '緯度',
    '経度',
    '勤務地備考',
    '交通アクセス',
    '給与テキスト',
    '給与最小',
    '給与最大',
    '給与通貨',
    '給与種別',
    '給与ソース',
    '給与詳細',
    '給与例',
    '掲載日時',
    '掲載経過表示',
    '募集期限',
    '募集終了判定',
    'Indeed掲載ソース',
    'originalJobLink',
    'IndeedApply有無',
    'directApply',
    'Applyボタン種別',
    'Apply表示テキスト',
    '求人写真数',
    '求人写真URL一覧',
    '求人写真alt一覧',
    '企業ロゴURL',
    '企業ヘッダー画像URL',
    'Indeed表示タグ',
    'jobOccupations ID一覧',
    'Indeed職種分類名一覧',
    'Indeed職種分類ID一覧',
    'occupationComparison JSON',
    'Indeed抽出属性名一覧',
    'Indeed抽出属性ID一覧',
    '属性タイプID一覧',
    'jobProvenance一覧',
    'jobRequirementStrength一覧',
    'attributeComparison JSON',
    'jobFlair headline',
    'jobFlair description',
    'jobFlair eligible',
    'Indeed関連検索what',
    'Indeed関連検索where',
    '本文全文',
    '仕事内容',
    '求めている人材',
    '勤務時間詳細',
    '勤務形態',
    '休日休暇',
    '勤務地所在地',
    '試用期間',
    '待遇福利厚生',
    '社会保険',
    '職場環境',
    '応募方法',
    '選考プロセス',
    'その他',
    '企業名詳細',
    '本社所在地',
    '業種',
    '代表者名',
    '代表電話番号',
    'semanticSegments JSON',
    'recentQueryString',
    '詳細到達検索what',
    '詳細到達検索where',
    'currentJobState',
    'resume trafficLight',
    'encouragement trafficLight',
    'encouragement score',
    'encouragement strategy',
    'matchingSalary',
    'minimumPayPreferencePresent',
    'userMinimumPayAmount',
    'userMinimumPaySalaryType',
    'attribute matchType一覧',
    'attribute jsProvenance一覧',
    'occupation matchType一覧',
    'occupation jsProvenance一覧',
    'userContext JSON',
    '取得ステータス',
    '取得エラー理由',
    '詳細取得ソース',
    '_initialData有無',
    'jobInfoWrapperModel有無',
    'salaryInfoModel有無',
    'semanticSegmentModels有無',
    'JSON-LD JobPosting有無',
    'oneGraphMatchComparison有無',
    '主要項目取得数',
    '全項目取得数',
    '取得スキーマVersion'
  ];

  function isObject(v) {
    return v !== null && typeof v === 'object';
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function nowText() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  function formatDateTime(value) {
    if (value === null || value === undefined || value === '') return '';

    let d = null;
    if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
      let num = Number(value);
      if (!Number.isFinite(num)) return '';
      if (num > 0 && num < 100000000000) num *= 1000;
      d = new Date(num);
    } else {
      d = new Date(String(value));
    }

    if (!d || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  function textify(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/\u00A0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  function normalizeText(value) {
    return textify(value)
      .replace(/\t/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .replace(/\n/g, ' / ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function normalizeMultiline(value) {
    return textify(value)
      .replace(/\t/g, ' ')
      .replace(/[ \f\v]+\n/g, '\n')
      .replace(/\n[ \f\v]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
  }

  function toTsvCell(value) {
    if (value === null || value === undefined) return '';
    let text = typeof value === 'string' ? value : String(value);
    return textify(text)
      .replace(/\t/g, ' ')
      .replace(/\n+/g, '<BR>')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
  }

  function safeJsonStringify(value) {
    if (value === null || value === undefined) return '';
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '';
    }
  }

  function uniqueStrings(values) {
    const out = [];
    const seen = new Set();
    for (const v of values || []) {
      const s = normalizeText(v);
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }

  function makeSessionId() {
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getProfileLabel() {
    try {
      return localStorage.getItem(PROFILE_LABEL_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setProfileLabel(value) {
    try {
      localStorage.setItem(PROFILE_LABEL_KEY, normalizeText(value));
    } catch (e) {}
  }

  function stripHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    const body = doc.body;
    if (!body) return '';
    body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    body.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,tr').forEach(el => {
      if (el.nextSibling) el.appendChild(doc.createTextNode('\n'));
    });
    return normalizeMultiline(body.textContent || '');
  }

  function joinLabels(arr, key = 'label') {
    if (!Array.isArray(arr)) return '';
    return uniqueStrings(arr.map(x => (x && x[key] != null ? String(x[key]) : ''))).join(ARRAY_SEP);
  }

  function joinValues(arr) {
    if (!Array.isArray(arr)) return '';
    return uniqueStrings(arr.map(x => (x == null ? '' : String(x)))).join(ARRAY_SEP);
  }

  function boolText(v) {
    if (v === true) return 'true';
    if (v === false) return 'false';
    return '';
  }

  function cleanHeaderKey(s) {
    return normalizeText(s).replace(/\s+/g, '');
  }

  function deepFind(root, predicate, maxVisits = 50000) {
    if (!isObject(root)) return null;
    const seen = new WeakSet();
    const stack = [root];
    let visits = 0;

    while (stack.length && visits < maxVisits) {
      const node = stack.pop();
      visits++;

      if (!isObject(node)) continue;
      if (seen.has(node)) continue;
      seen.add(node);

      try {
        if (predicate(node)) return node;
      } catch (e) {}

      if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) {
          const v = node[i];
          if (isObject(v)) stack.push(v);
        }
      } else {
        const keys = Object.keys(node);
        for (let i = keys.length - 1; i >= 0; i--) {
          const v = node[keys[i]];
          if (isObject(v)) stack.push(v);
        }
      }
    }
    return null;
  }

  function extractAssignedObjectText(scriptText, variableNames) {
    if (!scriptText) return null;

    for (const variableName of variableNames) {
      const idx = scriptText.indexOf(variableName);
      if (idx === -1) continue;

      const eqIdx = scriptText.indexOf('=', idx);
      if (eqIdx === -1) continue;

      let start = -1;
      for (let i = eqIdx + 1; i < scriptText.length; i++) {
        const ch = scriptText[i];
        if (ch === '{' || ch === '[') {
          start = i;
          break;
        }
      }
      if (start === -1) continue;

      const openChar = scriptText[start];
      const closeChar = openChar === '{' ? '}' : ']';

      let depth = 0;
      let inString = false;
      let quote = '';
      let escaped = false;

      for (let i = start; i < scriptText.length; i++) {
        const ch = scriptText[i];

        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === quote) {
            inString = false;
            quote = '';
          }
          continue;
        }

        if (ch === '"' || ch === "'") {
          inString = true;
          quote = ch;
          continue;
        }

        if (ch === openChar) depth++;
        if (ch === closeChar) depth--;

        if (depth === 0) {
          return scriptText.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  function safeJsonParse(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function getCandidateRoots() {
    const cacheUrl = location.href;
    if (
      candidateRootsCache.url === cacheUrl &&
      (candidateRootsCache.roots.length || Date.now() - candidateRootsCache.checkedAt < 3000)
    ) {
      return candidateRootsCache.roots;
    }

    const roots = [];
    if (isObject(window._initialData)) {
      roots.push(window._initialData);
      candidateRootsCache = { url: cacheUrl, roots, checkedAt: Date.now() };
      return roots;
    }

    const scripts = Array.from(document.scripts || []);
    for (const script of scripts) {
      const txt = script.textContent || '';
      if (!txt.includes('window._initialData')) continue;
      const objText = extractAssignedObjectText(txt, ['window._initialData', '_initialData']);
      const parsed = safeJsonParse(objText);
      if (parsed) roots.push(parsed);
      if (roots.length) break;
    }

    candidateRootsCache = { url: cacheUrl, roots, checkedAt: Date.now() };
    return roots;
  }

  function findCurrentDetailBody(root) {
    if (!isObject(root)) return null;

    const candidates = [
      root,
      root?.autoOpenTwoPaneViewjobResponse?.body,
      root?.viewjobResponse?.body,
      root?.viewJobResponse?.body
    ].filter(isObject);

    for (const candidate of candidates) {
      if (candidate?.jobInfoWrapperModel?.jobInfoModel) return candidate;
    }

    return deepFind(root, n =>
      isObject(n) &&
      isObject(n.jobInfoWrapperModel) &&
      isObject(n.jobInfoWrapperModel.jobInfoModel) &&
      (
        typeof n.jobKey === 'string' ||
        typeof n.jobTitle === 'string' ||
        isObject(n.salaryInfoModel) ||
        isObject(n.jobMetadataFooterModel)
      )
    );
  }

  function findCurrentBundleFromRoot(root) {
    const body = findCurrentDetailBody(root);
    if (!body) return null;

    const wrapper = body.jobInfoWrapperModel || {};
    const jobInfoModel = wrapper.jobInfoModel || {};
    const headerModel = jobInfoModel.jobInfoHeaderModel || {};
    const sectionedModel = wrapper.sectionedJobInfoModel || null;
    const salaryInfo = body.salaryInfoModel || {};
    const footerModel = body.jobMetadataFooterModel || {};
    const oneGraphMatchComparison = body.oneGraphMatchComparison || null;
    const employerResponsiveCardModel =
      headerModel.employerResponsiveCardModel ||
      body.employerResponsiveCardModel ||
      null;
    const jobFlairLabelModel = headerModel.jobFlairLabelModel || null;

    const jobKey =
      body.jobKey ||
      body.reportContentModel?.jobKey ||
      body.salaryGuideModel?.jobKey ||
      body.indeedApplyButtonContainer?.indeedApplyButtonAttributes?.jk ||
      getJobKeyFromUrl(location.href);
    const jobTitle = headerModel.jobTitle || body.jobTitle || sectionedModel?.jobTitle || '';

    if (!jobKey && !jobTitle) return null;

    return {
      root,
      body,
      wrapper,
      jobInfoModel,
      headerModel,
      sectionedModel,
      salaryInfo,
      footerModel,
      oneGraphMatchComparison,
      employerResponsiveCardModel,
      jobFlairLabelModel,
      jobKey,
      jobTitle
    };
  }

  function getBundle() {
    const roots = getCandidateRoots();
    const urlJk = getJobKeyFromUrl(location.href);
    let fallback = null;

    for (const root of roots) {
      const bundle = findCurrentBundleFromRoot(root);
      if (!bundle) continue;
      if (!fallback) fallback = bundle;
      if (!urlJk || bundle.jobKey === urlJk) return bundle;
    }

    return fallback;
  }

  function getLdJobPosting() {
    const cacheUrl = location.href;
    if (
      ldJobPostingCache.url === cacheUrl &&
      (ldJobPostingCache.value || Date.now() - ldJobPostingCache.checkedAt < 3000)
    ) {
      return ldJobPostingCache.value;
    }

    let found = null;
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    outer: for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent || '');
        const candidates = Array.isArray(parsed) ? parsed : [parsed];
        for (const candidate of candidates) {
          if (candidate?.['@type'] === 'JobPosting') {
            found = candidate;
            break outer;
          }
          if (Array.isArray(candidate?.['@graph'])) {
            const job = candidate['@graph'].find(x => x?.['@type'] === 'JobPosting');
            if (job) {
              found = job;
              break outer;
            }
          }
        }
      } catch (e) {}
    }

    ldJobPostingCache = { url: cacheUrl, value: found, checkedAt: Date.now() };
    return found;
  }

  function getSemanticSegments(bundle) {
    const segs = bundle?.sectionedModel?.semanticSegmentModels;
    return Array.isArray(segs) ? segs : [];
  }

  function buildSegmentMap(bundle) {
    const map = {};
    for (const seg of getSemanticSegments(bundle)) {
      const headerKey = cleanHeaderKey(seg?.header || '');
      const labelKey = seg?.semanticLabel ? `label:${seg.semanticLabel}` : '';
      const value = stripHtml(seg?.sanitizedContent || seg?.content || '');
      if (headerKey && !map[headerKey]) map[headerKey] = value;
      if (labelKey && !map[labelKey]) map[labelKey] = value;
    }
    return map;
  }

  function getCanonicalUrl(jobKey = '') {
    const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
    if (canonical && /\/viewjob/i.test(canonical)) return normalizeUrl(canonical);
    return canonicalViewJobUrl(jobKey || getJobKeyFromUrl(location.href), location.href) || normalizeUrl(location.href);
  }

  function sanitizeAcquisitionUrl(rawUrl) {
    const norm = normalizeUrl(rawUrl);
    if (!norm) return '';
    const jk = getJobKeyFromUrl(norm);
    if (jk) return canonicalViewJobUrl(jk, norm) || norm;
    try {
      const u = new URL(norm);
      return `${u.origin}${u.pathname}`;
    } catch (e) {
      return norm;
    }
  }

  function sanitizeRequestPath(rawPath, fallbackJobKey = '') {
    const raw = String(rawPath || '').trim();
    const jk = getJobKeyFromUrl(raw) || fallbackJobKey || '';
    if (jk) {
      let includeJson = false;
      try {
        const u = new URL(raw || `/viewjob?jk=${encodeURIComponent(jk)}`, location.origin);
        includeJson = u.searchParams.get('json') === '1';
      } catch (e) {}
      return `/viewjob?jk=${encodeURIComponent(jk)}${includeJson ? '&json=1' : ''}`;
    }
    if (!raw) return '';
    try {
      const u = new URL(raw, location.origin);
      return u.pathname || '';
    } catch (e) {
      return raw.split('?')[0] || '';
    }
  }

  function sanitizeIndeedContentUrl(rawUrl) {
    const norm = normalizeUrl(rawUrl);
    if (!norm) return '';
    try {
      const u = new URL(norm);
      if (u.hostname === 'jp.indeed.com' || u.hostname.endsWith('.indeed.com')) {
        return `${u.origin}${u.pathname}`;
      }
      return norm;
    } catch (e) {
      return norm;
    }
  }

  function getUrlLike(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.url || value.href || value.link || value.originalJobLink || '';
  }

  function getRelatedLinkValues(body, key) {
    if (!Array.isArray(body?.relatedLinks)) return '';
    return joinValues(body.relatedLinks.map(x => x?.[key] || ''));
  }

  function getSearchRecentQuery(body) {
    const raw = body?.indeedApplyButtonContainer?.indeedApplyButtonAttributes?.recentsearchquery || '';
    if (!raw) return { what: '', where: '' };
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        what: normalizeText(parsed?.what || ''),
        where: normalizeText(parsed?.where || '')
      };
    } catch (e) {
      return { what: '', where: '' };
    }
  }

  function comparisonData(bundle) {
    const one = bundle?.oneGraphMatchComparison || {};
    const attrs = Array.isArray(one.attributeComparisons) ? one.attributeComparisons : [];
    const occs = Array.isArray(one.occupationComparisons) ? one.occupationComparisons : [];
    return { one, attrs, occs };
  }

  function semanticSegmentsJson(bundle) {
    const knownLabels = new Set([
      'job-description','qualification','work-hours','working-system','holidays','full-address','work-location',
      'commute-info','pay','salary-example','probation-conditions','benefits','social-insurance','work-environment',
      'apply-method','apply-info','other','company-name','company-location','company-industry','company-president','contact-tel'
    ]);
    const labels = [];
    const unknown = [];

    for (const seg of getSemanticSegments(bundle)) {
      const semanticLabel = seg?.semanticLabel || '';
      const header = normalizeText(seg?.header || '');
      labels.push({ semanticLabel, header });
      if (!knownLabels.has(semanticLabel)) {
        unknown.push({
          semanticLabel,
          header,
          content: stripHtml(seg?.sanitizedContent || seg?.content || '')
        });
      }
    }

    return safeJsonStringify({ labels, unknown });
  }

  function pickSegment(map, keys) {
    for (const key of keys) {
      if (map[key]) return map[key];
    }
    return '';
  }

  function getDomText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim()) {
        return normalizeText(el.textContent);
      }
    }
    return '';
  }

  function buildEmptyRecord() {
    const record = {};
    for (const h of HEADERS) record[h] = '';
    return record;
  }

  function isChallengePage() {
    const title = (document.title || '').toLowerCase();
    const bodyText = (document.body?.innerText || '').slice(0, 2000).toLowerCase();

    return (
      title.includes('just a moment') ||
      title.includes('attention required') ||
      bodyText.includes('just a moment') ||
      bodyText.includes('verify you are human') ||
      bodyText.includes('unusual traffic') ||
      bodyText.includes('captcha')
    );
  }

  function getUrlPathInfo(url) {
    try {
      const u = new URL(String(url).trim(), location.origin);
      const rawPath = u.pathname || '';
      let decodedPath = rawPath;
      try {
        decodedPath = decodeURIComponent(rawPath);
      } catch (e) {}
      return {
        rawPath,
        decodedPath
      };
    } catch (e) {
      return {
        rawPath: '',
        decodedPath: ''
      };
    }
  }

  function isIndeedSearchPath(path) {
    const p = String(path || '').replace(/\/+$/, '') || '/';
    return p === '/jobs' || p === '/求人';
  }

  function isIndeedSearchResultsUrl(url) {
    const { rawPath, decodedPath } = getUrlPathInfo(url);

    if (isIndeedSearchPath(decodedPath)) return true;
    if (isIndeedSearchPath(rawPath)) return true;
    if (/\/%E6%B1%82%E4%BA%BA\/?$/i.test(rawPath)) return true;
    if (/\/q-.*求人\.html\/?$/i.test(decodedPath)) return true;
    if (/\/q-.*%E6%B1%82%E4%BA%BA\.html\/?$/i.test(rawPath)) return true;

    return false;
  }

  function isSearchResultsPage() {
    if (isIndeedSearchResultsUrl(location.href)) return true;

    const hasJobCards = Boolean(document.querySelector('a[data-jk][href], a[href*="/viewjob?"], a[href*="/rc/clk"], a[href*="/pagead/"]'));
    if (!hasJobCards) return false;

    const root = getSearchInitialData();
    return Boolean(root.totalJobCount != null || root.uniqueJobsCount != null || Array.isArray(root.relatedQueries));
  }

  function buildRecord() {
    const record = buildEmptyRecord();
    const bundle = getBundle();
    const ld = getLdJobPosting();

    record['詳細取得日時'] = nowText();
    record['取得プロファイル'] = getProfileLabel();
    record['取得URL'] = sanitizeAcquisitionUrl(location.href);
    record['ページタイトル'] = document.title || '';
    record['_initialData有無'] = boolText(getCandidateRoots().length > 0);
    record['JSON-LD JobPosting有無'] = boolText(Boolean(ld));
    record['取得スキーマVersion'] = SCHEMA_VERSION;

    if (!bundle) {
      record['取得ステータス'] = 'ERROR';
      record['取得エラー理由'] = 'current _initialData detail model not found';
      record['詳細取得ソース'] = 'none';
      return { record, source: 'error' };
    }

    const root = bundle.root || {};
    const body = bundle.body || {};
    const jobInfoModel = bundle.jobInfoModel || {};
    const header = bundle.headerModel || {};
    const sectioned = bundle.sectionedModel || {};
    const salary = bundle.salaryInfo || {};
    const footer = bundle.footerModel || {};
    const responsive = bundle.employerResponsiveCardModel || {};
    const flair = bundle.jobFlairLabelModel || {};
    const segMap = buildSegmentMap(bundle);
    const { one, attrs, occs } = comparisonData(bundle);
    const recentApplySearch = getSearchRecentQuery(body);
    const ratings = header.ratingsModel || {};
    const companyImages = header.companyImagesModel || {};
    const jobPhotos = body.japanJobPhotosModel || {};
    const applyContainer = body.indeedApplyButtonContainer || {};
    const applyAttrs = applyContainer.indeedApplyButtonAttributes || {};
    const applyModel = applyContainer.indeedApplyButtonModel || {};
    const ldLocation = Array.isArray(ld?.jobLocation) ? (ld.jobLocation[0] || {}) : (ld?.jobLocation || {});
    const address = ldLocation?.address || {};
    const geo = ldLocation?.geo || address?.geo || {};
    const ldSalary = ld?.baseSalary || {};
    const ldSalaryValue = ldSalary?.value || {};
    const semanticFullAddress = pickSegment(segMap, ['勤務地所在地', 'label:full-address']);
    const semanticCompanyName = pickSegment(segMap, ['企業名', 'label:company-name']);

    record['ログイン状態'] = boolText(body.loggedIn ?? root.loggedIn ?? body.saveJobButtonContainerModel?.isLoggedIn);
    record['canonical URL'] = getCanonicalUrl(bundle.jobKey);
    record['詳細ページスポンサー判定'] = boolText(body.sponsored ?? root.sponsored);
    record['requestPath'] = sanitizeRequestPath(body.requestPath || root.requestPath || '', bundle.jobKey);
    record['求人キー'] = bundle.jobKey || '';
    record['求人タイトル'] = bundle.jobTitle || '';
    record['Indeed標準職種名'] = header.jobNormTitle || '';
    record['言語'] = body.jobLanguage || body.language || root.jobLanguage || root.language || '';
    record['国'] = body.jobCountry || body.country || root.jobCountry || root.country || '';
    record['雇用形態表示'] = body?.jobInfoWrapperModel?.jobInfoModel?.jobMetadataHeaderModel?.jobType || sectioned?.formattedJobTypes?.content || '';
    record['雇用形態コード'] = Array.isArray(ld?.employmentType) ? joinValues(ld.employmentType) : (ld?.employmentType || '');
    record['リモート求人'] = boolText(header.remoteLocation ?? body.remoteLocation);
    record['HiringEvent'] = boolText(body.isHiringEvent);
    record['インターン求人'] = boolText(body.japanInternshipJob);

    record['会社名'] = header.companyName || semanticCompanyName || '';
    record['求人本文内企業名'] = semanticCompanyName;
    record['親会社名'] = header.parentCompanyName || '';
    record['会社ページURL'] = sanitizeIndeedContentUrl(header.companyOverviewLink || '');
    record['会社口コミURL'] = sanitizeIndeedContentUrl(header.companyReviewLink || header.companyReviewModel?.desktopCompanyLink || header.companyReviewModel?.mobileCompanyLink || '');
    record['企業評価'] = ratings.rating ?? '';
    record['企業口コミ件数'] = ratings.count ?? '';
    record['返信率企業headline'] = responsive.headline || '';
    record['返信率企業description'] = responsive.description || '';
    record['responseRate'] = responsive.responseRate ?? '';
    record['averageResponseInDays'] = responsive.averageResponseInDays ?? '';

    record['勤務地表示'] = header.formattedLocation || body.jobLocation || '';
    record['勤務地完全住所'] = semanticFullAddress || address.streetAddress || '';
    record['郵便番号'] = address.postalCode || '';
    record['都道府県'] = address.addressRegion || '';
    record['市区町村相当'] = address.addressLocality || '';
    record['streetAddress'] = address.streetAddress || '';
    record['国コード'] = address.addressCountry || body.jobCountry || '';
    record['緯度'] = geo.latitude ?? address.latitude ?? ldLocation.latitude ?? '';
    record['経度'] = geo.longitude ?? address.longitude ?? ldLocation.longitude ?? '';
    record['勤務地備考'] = pickSegment(segMap, ['勤務地備考', 'label:work-location']);
    record['交通アクセス'] = pickSegment(segMap, ['交通・アクセス', 'label:commute-info']);

    record['給与テキスト'] = salary.salaryText || '';
    record['給与最小'] = salary.salaryMin ?? ldSalaryValue.minValue ?? ldSalaryValue.value ?? '';
    record['給与最大'] = salary.salaryMax ?? ldSalaryValue.maxValue ?? ldSalaryValue.value ?? '';
    record['給与通貨'] = salary.salaryCurrency || ldSalary.currency || '';
    record['給与種別'] = salary.salaryType || ldSalaryValue.unitText || '';
    record['給与ソース'] = salary.salarySource || '';
    record['給与詳細'] = pickSegment(segMap, ['給与詳細', 'label:pay']);
    record['給与例'] = pickSegment(segMap, ['給与例', 'label:salary-example']);

    record['掲載日時'] = formatDateTime(ld?.datePosted || body.datePublished || root.datePublished);
    record['掲載経過表示'] = footer.age || footer.relativeDate || '';
    record['募集期限'] = formatDateTime(ld?.validThrough);
    record['募集終了判定'] = boolText(Boolean(jobInfoModel.expiredJobMetadataModel || jobInfoModel.showExpiredHeader || body.showExpiredHeader));
    record['Indeed掲載ソース'] = footer.source || '';
    record['originalJobLink'] = getUrlLike(footer.originalJobLink || body.originalJobLinkModel || body.originalJobLink);
    record['IndeedApply有無'] = boolText(Boolean(applyAttrs.jk || applyContainer.indeedApplyAttributes || applyModel.contentHtml));
    record['directApply'] = boolText(ld?.directApply);
    record['Applyボタン種別'] = applyModel.buttonType || '';
    record['Apply表示テキスト'] = stripHtml(applyModel.contentHtml || '');

    const photoUrls = Array.isArray(jobPhotos.urls) ? jobPhotos.urls : [];
    const photoAlts = Array.isArray(jobPhotos.altTexts) ? jobPhotos.altTexts : [];
    record['求人写真数'] = String(photoUrls.length || 0);
    record['求人写真URL一覧'] = joinValues(photoUrls);
    record['求人写真alt一覧'] = joinValues(photoAlts);
    record['企業ロゴURL'] = companyImages.logoUrl || '';
    record['企業ヘッダー画像URL'] = companyImages.headerImageUrl || '';

    const jobTags = jobInfoModel.jobTagModel?.tags || sectioned.jobTagModel?.tags || [];
    record['Indeed表示タグ'] = joinValues(jobTags);

    record['jobOccupations ID一覧'] = joinValues(body.jobOccupations || []);
    record['Indeed職種分類名一覧'] = joinValues(occs.map(x => x?.occupation?.label || ''));
    record['Indeed職種分類ID一覧'] = joinValues(occs.map(x => x?.occupation?.suid || ''));
    record['occupationComparison JSON'] = safeJsonStringify(occs.map(x => ({
      label: x?.occupation?.label || '',
      suid: x?.occupation?.suid || '',
      matchType: x?.matchType || '',
      jsProvenance: x?.jsProvenance || ''
    })));

    record['Indeed抽出属性名一覧'] = joinValues(attrs.map(x => x?.attribute?.label || ''));
    record['Indeed抽出属性ID一覧'] = joinValues(attrs.map(x => x?.attribute?.suid || ''));
    record['属性タイプID一覧'] = joinValues(attrs.map(x => x?.attribute?.profileAttributeTypeSuid || ''));
    record['jobProvenance一覧'] = joinValues(attrs.map(x => x?.jobProvenance || ''));
    record['jobRequirementStrength一覧'] = joinValues(attrs.map(x => x?.jobRequirementStrength || ''));
    record['attributeComparison JSON'] = safeJsonStringify(attrs.map(x => ({
      label: x?.attribute?.label || '',
      suid: x?.attribute?.suid || '',
      profileAttributeTypeSuid: x?.attribute?.profileAttributeTypeSuid || '',
      interestedParty: x?.attribute?.interestedParty || '',
      jobProvenance: x?.jobProvenance || '',
      jobRequirementStrength: x?.jobRequirementStrength || '',
      matchType: x?.matchType || '',
      jsProvenance: x?.jsProvenance || ''
    })));

    record['jobFlair headline'] = flair.headline || '';
    record['jobFlair description'] = flair.description || '';
    record['jobFlair eligible'] = boolText(flair.eligible);
    record['Indeed関連検索what'] = getRelatedLinkValues(body, 'what');
    record['Indeed関連検索where'] = getRelatedLinkValues(body, 'where');

    record['本文全文'] = stripHtml(jobInfoModel.sanitizedJobDescription || ld?.description || '');
    record['仕事内容'] = pickSegment(segMap, ['仕事内容', 'label:job-description']);
    record['求めている人材'] = pickSegment(segMap, ['求めている人材', '応募資格', 'label:qualification']);
    record['勤務時間詳細'] = pickSegment(segMap, ['勤務時間詳細', '勤務時間', 'label:work-hours']);
    record['勤務形態'] = pickSegment(segMap, ['勤務形態', 'label:working-system']);
    record['休日休暇'] = pickSegment(segMap, ['休日休暇', 'label:holidays']);
    record['勤務地所在地'] = semanticFullAddress;
    record['試用期間'] = pickSegment(segMap, ['試用期間', 'label:probation-conditions']);
    record['待遇福利厚生'] = pickSegment(segMap, ['待遇・福利厚生', '福利厚生', 'label:benefits']);
    record['社会保険'] = pickSegment(segMap, ['社会保険', 'label:social-insurance']);
    record['職場環境'] = pickSegment(segMap, ['職場環境', 'label:work-environment']);
    record['応募方法'] = pickSegment(segMap, ['応募方法', 'label:apply-method']);
    record['選考プロセス'] = pickSegment(segMap, ['選考プロセス', 'label:apply-info']);
    record['その他'] = pickSegment(segMap, ['その他', 'label:other']);
    record['企業名詳細'] = semanticCompanyName;
    record['本社所在地'] = pickSegment(segMap, ['本社所在地', 'label:company-location']);
    record['業種'] = pickSegment(segMap, ['業種', 'label:company-industry']);
    record['代表者名'] = pickSegment(segMap, ['代表者名', 'label:company-president']);
    record['代表電話番号'] = pickSegment(segMap, ['代表電話番号', 'お問い合わせ電話番号', 'label:contact-tel']);
    record['semanticSegments JSON'] = semanticSegmentsJson(bundle);

    record['recentQueryString'] = body.recentQueryString || '';
    record['詳細到達検索what'] = recentApplySearch.what;
    record['詳細到達検索where'] = recentApplySearch.where;
    record['currentJobState'] = body.saveJobButtonContainerModel?.currentJobState || '';
    record['resume trafficLight'] = body.resumeEvaluationResult?.trafficLightSignal || jobInfoModel.resumeEvaluationResult?.trafficLightSignal || '';
    record['encouragement trafficLight'] = one.encouragementToApply?.trafficLight || '';
    record['encouragement score'] = one.encouragementToApply?.score ?? '';
    record['encouragement strategy'] = one.encouragementToApply?.strategy || '';
    record['matchingSalary'] = boolText(salary.matchingSalary);
    record['minimumPayPreferencePresent'] = boolText(salary.minimumPayPreferencePresent);
    record['userMinimumPayAmount'] = salary.userMinimumPayAmount ?? '';
    record['userMinimumPaySalaryType'] = salary.userMinimumPaySalaryType || '';
    record['attribute matchType一覧'] = joinValues(attrs.map(x => x?.matchType || ''));
    record['attribute jsProvenance一覧'] = joinValues(attrs.map(x => x?.jsProvenance || ''));
    record['occupation matchType一覧'] = joinValues(occs.map(x => x?.matchType || ''));
    record['occupation jsProvenance一覧'] = joinValues(occs.map(x => x?.jsProvenance || ''));
    record['userContext JSON'] = safeJsonStringify({
      recentQueryString: record['recentQueryString'],
      recentSearchQuery: recentApplySearch,
      currentJobState: record['currentJobState'],
      resumeTrafficLight: record['resume trafficLight'],
      encouragementToApply: one.encouragementToApply || null,
      matchingSalary: salary.matchingSalary ?? null,
      minimumPayPreferencePresent: salary.minimumPayPreferencePresent ?? null,
      userMinimumPayAmount: salary.userMinimumPayAmount ?? null,
      userMinimumPaySalaryType: salary.userMinimumPaySalaryType ?? null,
      attributeMatch: attrs.map(x => ({ label: x?.attribute?.label || '', matchType: x?.matchType || '', jsProvenance: x?.jsProvenance || '' })),
      occupationMatch: occs.map(x => ({ label: x?.occupation?.label || '', matchType: x?.matchType || '', jsProvenance: x?.jsProvenance || '' }))
    });

    record['詳細取得ソース'] = bundle.body === root ? 'current-_initialData' : 'current-_initialData-nested';
    record['jobInfoWrapperModel有無'] = boolText(Boolean(body.jobInfoWrapperModel));
    record['salaryInfoModel有無'] = boolText(Boolean(body.salaryInfoModel));
    record['semanticSegmentModels有無'] = boolText(getSemanticSegments(bundle).length > 0);
    record['oneGraphMatchComparison有無'] = boolText(Boolean(bundle.oneGraphMatchComparison));

    const majorFields = ['求人キー','求人タイトル','会社名','勤務地表示','雇用形態表示','本文全文'];
    const majorCount = majorFields.filter(k => String(record[k] ?? '').trim() !== '').length;
    record['主要項目取得数'] = String(majorCount);

    const diagnosticKeys = new Set([
      '取得ステータス','取得エラー理由','詳細取得ソース','_initialData有無','jobInfoWrapperModel有無','salaryInfoModel有無',
      'semanticSegmentModels有無','JSON-LD JobPosting有無','oneGraphMatchComparison有無','主要項目取得数','全項目取得数','取得スキーマVersion'
    ]);
    record['全項目取得数'] = String(HEADERS.filter(k => !diagnosticKeys.has(k) && String(record[k] ?? '').trim() !== '').length);

    if (majorCount >= 5) {
      record['取得ステータス'] = 'OK';
      record['取得エラー理由'] = '';
    } else if (majorCount >= 2) {
      record['取得ステータス'] = 'PARTIAL';
      record['取得エラー理由'] = `major fields ${majorCount}/${majorFields.length}`;
    } else {
      record['取得ステータス'] = 'ERROR';
      record['取得エラー理由'] = `major fields ${majorCount}/${majorFields.length}`;
    }

    return { record, source: record['取得ステータス'] === 'ERROR' ? 'error' : 'current-json' };
  }

  function isGoodRecord(record, source, elapsedMs = 0) {
    if (isChallengePage()) return false;
    if (!record || source !== 'current-json') return false;
    if (!record['求人キー'] || !record['求人タイトル']) return false;
    if (record['取得ステータス'] === 'OK') return true;
    if (record['取得ステータス'] === 'PARTIAL' && elapsedMs >= 5000) return true;
    return false;
  }

  function buildTsv(includeHeader) {
    const { record } = buildRecord();
    const row = HEADERS.map(h => toTsvCell(record[h]));
    if (includeHeader) {
      return `${HEADERS.join('\t')}\n${row.join('\t')}`;
    }
    return row.join('\t');
  }

  function buildJson() {
    const { record, source } = buildRecord();
    return JSON.stringify({ source, record }, null, 2);
  }

  async function copyText(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return true;
      }
    } catch (e) {}

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {}

    return false;
  }

  function setStatus(message, isError = false) {
    const el = document.querySelector(`#${PANEL_ID} .tm-indeed-helper-status`);
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#b91c1c' : '#065f46';
  }

  function setSearchStatus(message, isError = false) {
    const el = document.querySelector(`#${PANEL_ID} .tm-indeed-helper-search-status`);
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#b91c1c' : '#1d4ed8';
  }

  function setBatchStatus(message, isError = false) {
    const el = document.querySelector(`#${PANEL_ID} .tm-indeed-helper-batch-status`);
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#b91c1c' : '#1d4ed8';
  }

  function getSearchLinkType(url) {
    const href = String(url || '');
    if (/\/pagead\//i.test(href)) return 'pagead';
    if (/\/rc\/clk/i.test(href)) return 'rc/clk';
    if (/\/viewjob/i.test(href)) return 'viewjob';
    return 'other';
  }

  function sanitizeSearchResultUrl(url) {
    const norm = normalizeUrl(url);
    if (!norm) return '';
    try {
      const u = new URL(norm);
      if (/\/pagead\/|\/rc\/clk/i.test(u.pathname)) {
        return `${u.origin}${u.pathname}`;
      }
      if (/\/viewjob/i.test(u.pathname)) {
        const jk = u.searchParams.get('jk') || u.searchParams.get('vjk') || '';
        return canonicalViewJobUrl(jk, norm) || `${u.origin}${u.pathname}`;
      }
      return `${u.origin}${u.pathname}${u.search}`;
    } catch (e) {
      return norm;
    }
  }

  function detectSearchSponsorMeta(anchorEl, cardEl, href) {
    const hrefText = String(href || '');
    const classes = String(cardEl?.className || '');
    const cardText = normalizeText(cardEl?.textContent || anchorEl?.textContent || '');
    const reasons = [];

    if (/\/pagead\//i.test(hrefText)) reasons.push('link:/pagead/');
    if (/\bsponTapItem\b/i.test(classes)) reasons.push('class:sponTapItem');
    if (/\bmaybeSponsoredJob\b/i.test(classes)) reasons.push('class:maybeSponsoredJob');
    if (/スポンサー|sponsored/i.test(cardText)) reasons.push('text:sponsored');

    if (reasons.some(x => x === 'link:/pagead/' || x === 'class:sponTapItem')) {
      return {
        '検索結果スポンサー判定': 'true',
        '検索結果スポンサー根拠': reasons.join(ARRAY_SEP)
      };
    }

    if (/\/rc\/clk/i.test(hrefText)) {
      return {
        '検索結果スポンサー判定': 'false',
        '検索結果スポンサー根拠': 'link:/rc/clk'
      };
    }

    return {
      '検索結果スポンサー判定': '',
      '検索結果スポンサー根拠': reasons.join(ARRAY_SEP)
    };
  }

  function deriveSearchMetaFromUrl(rawUrl) {
    const norm = normalizeUrl(rawUrl);
    if (!norm) return {};
    const linkType = getSearchLinkType(norm);
    const base = {
      '検索結果元リンク': sanitizeSearchResultUrl(norm),
      '検索結果リンク種別': linkType,
      '検索結果スポンサー判定': '',
      '検索結果スポンサー根拠': ''
    };
    if (linkType === 'pagead') {
      base['検索結果スポンサー判定'] = 'true';
      base['検索結果スポンサー根拠'] = 'input-url:/pagead/';
    } else if (linkType === 'rc/clk') {
      base['検索結果スポンサー判定'] = 'false';
      base['検索結果スポンサー根拠'] = 'input-url:/rc/clk';
    }
    return base;
  }

  function mergeSearchMeta(base, extra) {
    const out = Object.assign({}, base || {});
    const src = extra || {};
    for (const [key, value] of Object.entries(src)) {
      if (value !== undefined && value !== null && String(value) !== '') out[key] = value;
      else if (!(key in out)) out[key] = '';
    }
    return out;
  }

  function getSearchInitialData() {
    if (isObject(window._initialData)) return window._initialData;
    const roots = getCandidateRoots();
    return roots[0] || {};
  }

  function sanitizeSearchPageUrl(rawUrl) {
    const norm = normalizeUrl(rawUrl);
    if (!norm) return '';
    try {
      const u = new URL(norm);
      for (const key of ['vjk','from','tk','mobtk','vjs']) u.searchParams.delete(key);
      return u.href;
    } catch (e) {
      return norm;
    }
  }

  function buildSearchPageMeta(crawlState = null) {
    const root = getSearchInitialData();
    const u = new URL(location.href);
    const startValue = Number(u.searchParams.get('start') || 0);
    const pageNumber = Number(root.pageNum || root.pageNumber || 0) || Math.floor(Math.max(0, startValue) / 10) + 1;
    const related = Array.isArray(root.relatedQueries) ? root.relatedQueries.map(x => x?.query || '') : [];
    const params = {};
    u.searchParams.forEach((value, key) => {
      if (['vjk','from','tk','mobtk','vjs'].includes(key)) return;
      params[key] = value;
    });

    const state = crawlState || loadSearchCrawlState();
    return {
      '取得セッションID': state.sessionId || '',
      'クロール開始日時': state.crawlStartedAt || state.createdAt || '',
      '取得プロファイル': state.profileLabel || getProfileLabel(),
      'ログイン状態': boolText(root.loggedIn ?? root.isLoggedIn),
      '検索URL': sanitizeSearchPageUrl(location.href),
      '検索キーワード': u.searchParams.get('q') || root.parsedQ || '',
      '検索勤務地': u.searchParams.get('l') || root.parsedL || '',
      '検索半径': u.searchParams.get('radius') || '',
      '検索start値': String(Number.isFinite(startValue) ? startValue : 0),
      '検索ページ番号': String(pageNumber),
      '検索総件数': String(root.totalJobCount ?? root.resultsInfoModel?.totalNumResults ?? root.uniqueJobsCount ?? ''),
      '関連検索候補': joinValues(related),
      '検索条件JSON': safeJsonStringify(params)
    };
  }

  function readPersistentText(key) {
    try {
      if (typeof GM_getValue === 'function') {
        const value = GM_getValue(key, '');
        return typeof value === 'string' ? value : (value ? JSON.stringify(value) : '');
      }
    } catch (e) {}
    try {
      return localStorage.getItem(key) || '';
    } catch (e) {
      return '';
    }
  }

  function writePersistentText(key, text) {
    const value = String(text ?? '');
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(key, value);
        return;
      }
    } catch (e) {}
    localStorage.setItem(key, value);
  }

  function removePersistentValue(key) {
    try {
      if (typeof GM_deleteValue === 'function') {
        GM_deleteValue(key);
        return;
      }
    } catch (e) {}
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function emptyBatchState() {
    return {
      active: false,
      createdAt: '',
      updatedAt: '',
      sessionId: '',
      crawlStartedAt: '',
      profileLabel: '',
      items: []
    };
  }

  function loadBatchState() {
    try {
      const raw = readPersistentText(BATCH_STATE_KEY);
      if (!raw) return emptyBatchState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return emptyBatchState();
      parsed.items = parsed.items.map(item => ({
        inputUrl: item?.inputUrl || '',
        urlKey: item?.urlKey || '',
        jobKey: item?.jobKey || '',
        status: item?.status || 'pending',
        source: item?.source || '',
        error: item?.error || '',
        processedAt: item?.processedAt || '',
        record: item?.record || null,
        searchMeta: mergeSearchMeta({}, item?.searchMeta || {})
      }));
      return parsed;
    } catch (e) {
      return emptyBatchState();
    }
  }

  function saveBatchState(state) {
    state.updatedAt = nowText();
    writePersistentText(BATCH_STATE_KEY, JSON.stringify(state));
  }

  function clearBatchState() {
    removePersistentValue(BATCH_STATE_KEY);
  }

  function emptySearchCrawlState() {
    return {
      active: false,
      mode: 'collect-only',
      createdAt: '',
      updatedAt: '',
      sessionId: '',
      crawlStartedAt: '',
      profileLabel: '',
      seedUrls: [],
      collectedItems: [],
      visitedPages: [],
      pageCount: 0
    };
  }

  function loadSearchCrawlState() {
    try {
      const raw = readPersistentText(SEARCH_CRAWL_STATE_KEY);
      if (!raw) return emptySearchCrawlState();
      const parsed = JSON.parse(raw);
      if (!parsed) return emptySearchCrawlState();
      parsed.seedUrls = Array.isArray(parsed.seedUrls) ? parsed.seedUrls : [];
      parsed.collectedItems = Array.isArray(parsed.collectedItems) ? parsed.collectedItems.map(item => ({
        inputUrl: item?.inputUrl || '',
        urlKey: item?.urlKey || '',
        jobKey: item?.jobKey || '',
        searchMeta: mergeSearchMeta({}, item?.searchMeta || {})
      })) : [];
      parsed.visitedPages = Array.isArray(parsed.visitedPages) ? parsed.visitedPages : [];
      return parsed;
    } catch (e) {
      return emptySearchCrawlState();
    }
  }

  function saveSearchCrawlState(state) {
    state.updatedAt = nowText();
    writePersistentText(SEARCH_CRAWL_STATE_KEY, JSON.stringify(state));
  }

  function clearSearchCrawlState() {
    removePersistentValue(SEARCH_CRAWL_STATE_KEY);
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(String(url).trim(), location.origin);
      u.hash = '';
      return u.href;
    } catch (e) {
      return '';
    }
  }

  function getJobKeyFromUrl(url) {
    try {
      const u = new URL(String(url).trim(), location.origin);
      const jk = u.searchParams.get('jk') || u.searchParams.get('vjk');
      return jk ? String(jk).trim() : '';
    } catch (e) {
      return '';
    }
  }

  function canonicalViewJobUrl(jk, fallbackHref = '') {
    if (jk) {
      return `https://jp.indeed.com/viewjob?jk=${encodeURIComponent(jk)}`;
    }
    const norm = normalizeUrl(fallbackHref);
    if (!norm) return '';
    try {
      const u = new URL(norm);
      if (u.pathname.includes('/viewjob')) return u.href;
      return '';
    } catch (e) {
      return '';
    }
  }

  function sameTarget(urlA, urlB) {
    const aJk = getJobKeyFromUrl(urlA);
    const bJk = getJobKeyFromUrl(urlB);
    if (aJk && bJk) return aJk === bJk;
    return normalizeUrl(urlA) === normalizeUrl(urlB);
  }

  function entryKeyFromUrl(url) {
    return getJobKeyFromUrl(url) || normalizeUrl(url);
  }

  function uniqueNormalizedUrls(urls) {
    const map = new Map();
    for (const u of urls || []) {
      const norm = normalizeUrl(u);
      if (!norm) continue;
      const key = entryKeyFromUrl(norm);
      if (!map.has(key)) map.set(key, norm);
    }
    return Array.from(map.values());
  }

  function makeItemFromUrl(url, searchMeta) {
    const norm = normalizeUrl(url);
    if (!norm) return null;
    const key = entryKeyFromUrl(norm);
    return {
      inputUrl: norm,
      urlKey: key,
      jobKey: getJobKeyFromUrl(norm),
      status: 'pending',
      source: '',
      error: '',
      processedAt: '',
      record: null,
      searchMeta: mergeSearchMeta(deriveSearchMetaFromUrl(norm), searchMeta || {})
    };
  }

  function mergeItemArrays(itemsA, itemsB) {
    const map = new Map();

    for (const src of [...(itemsA || []), ...(itemsB || [])]) {
      if (!src) continue;
      const item = makeItemFromUrl(src.inputUrl || src.url || '', src.searchMeta || {});
      if (!item) continue;

      if (!map.has(item.urlKey)) {
        map.set(item.urlKey, item);
      } else {
        const prev = map.get(item.urlKey);
        prev.searchMeta = mergeSearchMeta(prev.searchMeta, item.searchMeta);
        map.set(item.urlKey, prev);
      }
    }

    return Array.from(map.values());
  }

  function parseUrlLines(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    const out = [];
    const seen = new Set();

    for (const line of lines) {
      const item = makeItemFromUrl(line, {});
      if (!item) continue;
      if (!/^https:\/\/jp\.indeed\.com\//i.test(item.inputUrl)) continue;
      if (seen.has(item.urlKey)) continue;
      seen.add(item.urlKey);
      out.push(item);
    }

    return out;
  }

  function buildItemsFromTextareaAndCollected(textareaText, collectedItems) {
    const textItems = parseUrlLines(textareaText);
    return mergeItemArrays(textItems, (collectedItems || []).filter(ci => textItems.some(ti => ti.urlKey === ci.urlKey)));
  }

  function getNextPendingItem(state) {
    return state.items.find(x => x.status === 'pending') || null;
  }

  function getBatchCounts(state) {
    const total = state.items.length;
    const done = state.items.filter(x => x.status === 'done').length;
    const error = state.items.filter(x => x.status === 'error').length;
    const pending = state.items.filter(x => x.status === 'pending').length;
    return { total, done, error, pending };
  }

  function getSearchStateVisibleUrls(state) {
    const urls = [
      ...(state?.seedUrls || []),
      ...((state?.collectedItems || []).map(x => x.inputUrl))
    ];
    return uniqueNormalizedUrls(urls);
  }

  function refreshBatchInfo() {
    const state = loadBatchState();
    const crawlState = loadSearchCrawlState();
    const infoEl = document.querySelector(`#${PANEL_ID} .tm-indeed-helper-batch-info`);
    const ta = document.querySelector(`#${PANEL_ID} textarea`);
    if (!infoEl) return;

    const c = getBatchCounts(state);
    infoEl.innerHTML =
      `状態: ${state.active ? '稼働中' : '停止中'}<br>` +
      `件数: 全${c.total} / 完了${c.done} / 失敗${c.error} / 未処理${c.pending}<br>` +
      `スキーマ: ${SCHEMA_VERSION}`;

    if (ta && !ta.dataset.userEdited) {
      if ((crawlState.collectedItems || []).length || (crawlState.seedUrls || []).length) {
        ta.value = getSearchStateVisibleUrls(crawlState).join('\n');
      } else {
        ta.value = state.items.map(x => x.inputUrl).join('\n');
      }
    }
  }

  function refreshSearchInfo() {
    const state = loadSearchCrawlState();
    const infoEl = document.querySelector(`#${PANEL_ID} .tm-indeed-helper-search-info`);
    if (!infoEl) return;

    const nextUrl = isSearchResultsPage() ? findNextSearchPageUrl() : '';
    const collectedCount = getSearchStateVisibleUrls(state).length;

    infoEl.innerHTML =
      `巡回状態: ${state.active ? '収集中' : '停止中'}<br>` +
      `巡回ページ数: ${state.pageCount || 0}<br>` +
      `URL件数: ${collectedCount}<br>` +
      `次ページ検出: ${nextUrl ? 'あり' : 'なし'}`;
  }

  function findCurrentPendingIndex(state) {
    const current = location.href;
    return state.items.findIndex(item => item.status === 'pending' && sameTarget(item.inputUrl, current));
  }

  function applySearchMetaToRecord(record, searchMeta) {
    const out = Object.assign({}, record || {});
    const merged = mergeSearchMeta({}, searchMeta || {});
    for (const [key, value] of Object.entries(merged)) {
      if (HEADERS.includes(key) && String(value ?? '') !== '') out[key] = value;
    }
    return out;
  }

  function markCurrentAsDone(record, source) {
    const state = loadBatchState();
    const idx = findCurrentPendingIndex(state);
    if (idx < 0) return false;

    state.items[idx].status = 'done';
    state.items[idx].source = source;
    state.items[idx].error = '';
    state.items[idx].processedAt = nowText();
    state.items[idx].record = applySearchMetaToRecord(record, state.items[idx].searchMeta || {});
    saveBatchState(state);
    return true;
  }

  function markCurrentAsError(message, diagnosticRecord = null, source = 'error') {
    const state = loadBatchState();
    const idx = findCurrentPendingIndex(state);
    if (idx < 0) return false;

    const errorText = String(message || 'error');
    let record = diagnosticRecord ? Object.assign({}, diagnosticRecord) : null;
    if (record) {
      record['取得ステータス'] = 'ERROR';
      record['取得エラー理由'] = errorText;
      record['詳細取得ソース'] = record['詳細取得ソース'] || source;
      record = applySearchMetaToRecord(record, state.items[idx].searchMeta || {});
    }

    state.items[idx].status = 'error';
    state.items[idx].source = source;
    state.items[idx].error = errorText;
    state.items[idx].processedAt = nowText();
    state.items[idx].record = record;
    saveBatchState(state);
    return true;
  }

  function buildBatchTsv(includeHeader = true) {
    const state = loadBatchState();
    const rows = state.items
      .filter(item => item.record && (item.status === 'done' || item.status === 'error'))
      .map(item => HEADERS.map(h => toTsvCell(item.record[h])));

    if (!rows.length) return '';

    const lines = rows.map(r => r.join('\t'));
    return includeHeader ? `${HEADERS.join('\t')}\n${lines.join('\n')}` : lines.join('\n');
  }

  function buildErrorUrlText() {
    const state = loadBatchState();
    return state.items
      .filter(item => item.status === 'error')
      .map(item => `${item.inputUrl}\t${item.error}`)
      .join('\n');
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function filenameNow(prefix, ext) {
    const d = new Date();
    const stamp =
      `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_` +
      `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    return `${prefix}_${stamp}.${ext}`;
  }

  async function handleCopy(includeHeader) {
    try {
      const tsv = buildTsv(includeHeader);
      const ok = await copyText(tsv);
      if (ok) {
        setStatus(includeHeader ? '見出し+1行をコピーしました' : '1行をコピーしました');
      } else {
        console.log(tsv);
        setStatus('コピー失敗。コンソールに出力しました', true);
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || String(err), true);
    }
  }

  async function handleJsonCopy() {
    try {
      const json = buildJson();
      const ok = await copyText(json);
      if (ok) {
        setStatus('JSONをコピーしました');
      } else {
        console.log(json);
        setStatus('JSONコピー失敗。コンソールに出力しました', true);
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || String(err), true);
    }
  }

  function goToNextPending() {
    const state = loadBatchState();
    const next = getNextPendingItem(state);

    if (!next) {
      state.active = false;
      saveBatchState(state);
      refreshBatchInfo();
      setBatchStatus('一括処理が完了しました');
      return;
    }

    if (sameTarget(location.href, next.inputUrl)) {
      refreshBatchInfo();
      setBatchStatus('このページを処理します');
      return;
    }

    setBatchStatus(`次のURLへ移動中: ${next.inputUrl}`);
    location.href = next.inputUrl;
  }

  function startOrResumeBatch(options = {}) {
    const ta = document.querySelector(`#${PANEL_ID} textarea`);
    if (!ta) return;

    const {
      forceFromTextarea = false,
      preferExistingProgress = true
    } = options || {};

    const state = loadBatchState();
    const counts = getBatchCounts(state);

    // 「取得を再開」時は、テキストエリアのURLからキューを作り直さず、
    // localStorageに残っている進捗（done / error / pending）を優先する。
    // これにより、一時停止後の再開で取得済みURLを0から取り直すことを防ぐ。
    if (!forceFromTextarea && preferExistingProgress && counts.pending > 0) {
      state.active = true;
      saveBatchState(state);
      refreshBatchInfo();
      setBatchStatus(`一括処理を再開します（未処理${counts.pending}件）`);
      goToNextPending();
      return;
    }

    const crawlState = loadSearchCrawlState();
    const itemsFromText = buildItemsFromTextareaAndCollected(ta.value, crawlState.collectedItems || []);

    if (itemsFromText.length > 0) {
      const startedAt = nowText();
      const sessionId = makeSessionId();
      const profileLabel = getProfileLabel();
      itemsFromText.forEach(item => {
        item.searchMeta = mergeSearchMeta({
          '取得セッションID': sessionId,
          'クロール開始日時': startedAt,
          '取得プロファイル': profileLabel
        }, item.searchMeta || {});
      });
      const newState = {
        active: true,
        createdAt: startedAt,
        updatedAt: startedAt,
        sessionId,
        crawlStartedAt: startedAt,
        profileLabel,
        items: itemsFromText
      };
      saveBatchState(newState);
      refreshBatchInfo();
      setBatchStatus('URL一覧から一括処理を開始します');
      goToNextPending();
      return;
    }

    if (state.items.length > 0) {
      state.active = true;
      saveBatchState(state);
      refreshBatchInfo();
      setBatchStatus('一括処理を再開します');
      goToNextPending();
      return;
    }

    setBatchStatus('URL一覧が空です', true);
  }

  function finalizeSearchCrawl(options = {}) {
    const { partial = false, forceBatchStart = null } = options;
    const crawlState = loadSearchCrawlState();

    const seedContext = {
      '取得セッションID': crawlState.sessionId || '',
      'クロール開始日時': crawlState.crawlStartedAt || crawlState.createdAt || '',
      '取得プロファイル': crawlState.profileLabel || getProfileLabel()
    };
    const seedItems = (crawlState.seedUrls || []).map(url => makeItemFromUrl(url, seedContext)).filter(Boolean);
    const collectedItems = mergeItemArrays(crawlState.collectedItems || [], []);
    const items = mergeItemArrays(seedItems, collectedItems);

    const shouldStartBatch = forceBatchStart !== null
      ? Boolean(forceBatchStart)
      : crawlState.mode === 'collect-and-start';

    const newBatchState = {
      active: shouldStartBatch,
      createdAt: crawlState.createdAt || nowText(),
      updatedAt: nowText(),
      sessionId: crawlState.sessionId || '',
      crawlStartedAt: crawlState.crawlStartedAt || crawlState.createdAt || '',
      profileLabel: crawlState.profileLabel || '',
      items
    };
    saveBatchState(newBatchState);

    crawlState.active = false;
    saveSearchCrawlState(crawlState);
    refreshBatchInfo();
    refreshSearchInfo();

    if (partial) {
      setSearchStatus(`全ページ収集を停止しました。${items.length}件をキュー化しました`);
      return;
    }

    if (shouldStartBatch) {
      setSearchStatus(`全ページ収集完了。${items.length}件をキュー化し、そのまま開始します`);
      setBatchStatus('全ページ収集が終わったので一括処理へ進みます');
      goToNextPending();
    } else {
      setSearchStatus(`全ページ収集完了。${items.length}件をキュー化しました`);
    }
  }

  function stopAll() {
    let didSomething = false;

    const crawlState = loadSearchCrawlState();
    if (crawlState.active) {
      finalizeSearchCrawl({ partial: true, forceBatchStart: false });
      didSomething = true;
    }

    const batchState = loadBatchState();
    if (batchState.active) {
      batchState.active = false;
      saveBatchState(batchState);
      refreshBatchInfo();
      setBatchStatus('一括処理を停止しました');
      didSomething = true;
    }

    if (!didSomething) {
      setBatchStatus('停止対象はありません');
      setSearchStatus('停止対象はありません');
    }
  }

  async function copyBatchResults() {
    const tsv = buildBatchTsv(true);
    if (!tsv) {
      setBatchStatus('コピー対象の取得データがありません', true);
      return;
    }
    const ok = await copyText(tsv);
    if (ok) {
      setBatchStatus('一括結果をコピーしました');
    } else {
      console.log(tsv);
      setBatchStatus('一括結果コピー失敗。コンソールへ出力しました', true);
    }
  }

  function downloadBatchResults() {
    const tsv = buildBatchTsv(true);
    if (!tsv) {
      setBatchStatus('ダウンロード対象の取得データがありません', true);
      return;
    }
    downloadTextFile(filenameNow('indeed_batch', 'tsv'), tsv);
    setBatchStatus('一括結果をダウンロードしました');
  }

  async function copyErrorUrls() {
    const text = buildErrorUrlText();
    if (!text) {
      setBatchStatus('失敗URLはありません');
      return;
    }
    const ok = await copyText(text);
    if (ok) {
      setBatchStatus('失敗URL一覧をコピーしました');
    } else {
      console.log(text);
      setBatchStatus('失敗URL一覧コピー失敗。コンソールへ出力しました', true);
    }
  }

  function clearBatchResults() {
    clearBatchState();
    clearSearchCrawlState();
    refreshBatchInfo();
    refreshSearchInfo();
    const ta = document.querySelector(`#${PANEL_ID} textarea`);
    if (ta) {
      ta.value = '';
      ta.dataset.userEdited = '';
    }
    setBatchStatus('結果をクリアしました');
    setSearchStatus('結果をクリアしました');
  }

  function mergeUrlLines(existingText, newUrls) {
    const map = new Map();

    const existing = String(existingText || '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const u of existing) {
      const norm = normalizeUrl(u);
      if (!norm) continue;
      const key = entryKeyFromUrl(norm);
      if (!map.has(key)) map.set(key, norm);
    }

    for (const u of newUrls) {
      const norm = normalizeUrl(u);
      if (!norm) continue;
      const key = entryKeyFromUrl(norm);
      if (!map.has(key)) map.set(key, norm);
    }

    return Array.from(map.values()).join('\n');
  }

  function getAnchorJobKey(anchorEl) {
    return (
      anchorEl?.getAttribute('data-jk') ||
      anchorEl?.dataset?.jk ||
      anchorEl?.closest('[data-jk]')?.getAttribute('data-jk') ||
      getJobKeyFromUrl(anchorEl?.href || '') ||
      ''
    ).trim();
  }

  function getSearchResultCard(anchorEl) {
    return anchorEl?.closest('.cardOutline.tapItem, .tapItem.result, li, .job_seen_beacon, [role="listitem"]') || null;
  }

  function isHiddenSearchCard(cardEl, anchorEl) {
    if (!cardEl) return false;
    if (cardEl.closest('[aria-hidden="true"], [hidden]')) return true;
    if (anchorEl?.getAttribute('aria-hidden') === 'true') return true;
    return false;
  }

  function cardText(cardEl, selector) {
    const el = cardEl?.querySelector(selector);
    return el ? normalizeText(el.textContent || '') : '';
  }

  function extractSearchCardFields(anchorEl, cardEl, position) {
    const tags = Array.from(cardEl?.querySelectorAll('.jobsearch-JobCard-tag') || []).map(x => normalizeText(x.textContent || ''));
    const metadata = Array.from(cardEl?.querySelectorAll('ul.metadataContainer li, .metadataContainer [data-testid*="attribute_snippet"]') || []);
    const salaryEl = cardEl?.querySelector('.salary-snippet-container, [data-testid*="salary-snippet-container"]');
    const salaryText = normalizeText(salaryEl?.textContent || '');
    const employmentCandidates = metadata
      .map(x => normalizeText(x.textContent || ''))
      .filter(Boolean)
      .filter(x => x !== salaryText);
    const rating = cardText(cardEl, '[data-testid="holistic-rating"]');
    const snippet = cardText(cardEl, '[data-testid="belowJobSnippet"], .job-snippet, [class*="job-snippet"]').slice(0, 1500);
    const indeedApply = Boolean(cardEl?.querySelector('[data-testid="indeedApply"]'));
    const responsiveEmployer = cardText(cardEl, '[data-testid="responsiveEmployer"]');

    return {
      'ページ内表示順': String(position),
      '検索結果新着表示': boolText(Boolean(cardEl?.querySelector('[data-testid="new-job-tag"], .jobTitle-newJob'))),
      '検索結果HiringEvent': boolText(anchorEl?.dataset?.hiringEvent === 'true'),
      '検索時求人タイトル': normalizeText(anchorEl?.querySelector('[title]')?.getAttribute('title') || anchorEl?.textContent || ''),
      '検索時会社名': cardText(cardEl, '[data-testid="company-name"]'),
      '検索時勤務地': cardText(cardEl, '[data-testid="text-location"]'),
      '検索時給与': salaryText,
      '検索時雇用形態': employmentCandidates[0] || '',
      '検索時タグ': joinValues(tags),
      '検索時スニペット': snippet,
      '検索時会社評価': rating,
      '検索カード属性JSON': safeJsonStringify({
        dataCi: anchorEl?.dataset?.ci || '',
        dataEmpn: anchorEl?.dataset?.empn || '',
        hiringEvent: anchorEl?.dataset?.hiringEvent || '',
        indeedApply,
        responsiveEmployer
      })
    };
  }

  function collectSearchResultEntries() {
    const map = new Map();
    const pageMeta = buildSearchPageMeta();
    const nextUrl = findNextSearchPageUrl();
    let position = 0;

    function addCandidate(anchorEl, href, jk = '', countPosition = true) {
      if (!anchorEl) return;
      const cardEl = getSearchResultCard(anchorEl);
      if (isHiddenSearchCard(cardEl, anchorEl)) return;

      const rawHref = normalizeUrl(href);
      if (!rawHref || !/^https:\/\/jp\.indeed\.com\//i.test(rawHref)) return;

      const jobKey = String(jk || getAnchorJobKey(anchorEl) || getJobKeyFromUrl(rawHref) || '').trim();
      if (!jobKey) return;
      const canonicalUrl = canonicalViewJobUrl(jobKey, rawHref);
      if (!canonicalUrl) return;

      const key = entryKeyFromUrl(canonicalUrl);
      if (map.has(key)) return;

      if (countPosition) position += 1;
      const sponsorMeta = detectSearchSponsorMeta(anchorEl, cardEl, rawHref);
      const searchMeta = mergeSearchMeta(pageMeta, {
        '検索結果元リンク': sanitizeSearchResultUrl(rawHref),
        '検索結果リンク種別': getSearchLinkType(rawHref),
        ...sponsorMeta,
        ...extractSearchCardFields(anchorEl, cardEl, position || map.size + 1),
        '次ページURL': sanitizeSearchPageUrl(nextUrl)
      });

      const item = makeItemFromUrl(canonicalUrl, searchMeta);
      if (item) map.set(item.urlKey, item);
    }

    const primaryAnchors = Array.from(document.querySelectorAll('a[data-jk][href], [data-jk] a[href*="/viewjob"], [data-jk] a[href*="/pagead/"], [data-jk] a[href*="/rc/clk"], h2 a[href*="/viewjob"], h3 a[href*="/viewjob"], h2 a[href*="/pagead/"], h3 a[href*="/pagead/"]'));
    for (const a of primaryAnchors) {
      addCandidate(a, a.href, a.getAttribute('data-jk') || '', true);
    }

    if (!map.size) {
      document.querySelectorAll('a[href*="/viewjob?"], a[href*="/rc/clk"], a[href*="/pagead/"]').forEach(a => {
        addCandidate(a, a.href, '', true);
      });
    }

    return Array.from(map.values());
  }

  function collectSearchResultUrls() {
    return collectSearchResultEntries().map(x => x.inputUrl);
  }

  function upsertCollectedSearchEntries(entries) {
    const state = loadSearchCrawlState();
    state.collectedItems = mergeItemArrays(state.collectedItems || [], entries || []).map(item => ({
      inputUrl: item.inputUrl,
      urlKey: item.urlKey,
      jobKey: item.jobKey,
      searchMeta: item.searchMeta || {}
    }));
    if (!state.createdAt) state.createdAt = nowText();
    saveSearchCrawlState(state);
    return state;
  }

  function findNextSearchPageUrl() {
    const candidates = [];

    const directSelectors = [
      'a[data-testid="pagination-page-next"]',
      'a[aria-label="次へ"]',
      'a[aria-label*="次へ"]',
      'a[aria-label="Next"]',
      'a[aria-label="Next Page"]',
      'a[rel="next"]'
    ];

    for (const sel of directSelectors) {
      const el = document.querySelector(sel);
      if (el && el.href) candidates.push(el.href);
    }

    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href || '';
      if (!href) return;
      if (!isIndeedSearchResultsUrl(href)) return;

      const text = normalizeText(a.textContent || '');
      const label = normalizeText(a.getAttribute('aria-label') || '');
      const testId = normalizeText(a.getAttribute('data-testid') || '');

      const looksNext =
        /次へ|次のページ|Next/i.test(text) ||
        /次へ|次のページ|Next/i.test(label) ||
        /pagination-page-next/i.test(testId);

      if (looksNext) candidates.push(href);
    });

    const current = normalizeUrl(location.href);

    for (const href of candidates) {
      const norm = normalizeUrl(href);
      if (!norm) continue;
      if (norm === current) continue;
      return norm;
    }

    return '';
  }

  function appendSearchResultUrlsToTextarea() {
    const ta = document.querySelector(`#${PANEL_ID} textarea`);
    if (!ta) return { added: 0, totalFound: 0 };

    const entries = collectSearchResultEntries();
    if (!entries.length) return { added: 0, totalFound: 0 };

    const beforeItems = parseUrlLines(ta.value);
    const beforeKeys = new Set(beforeItems.map(x => x.urlKey));

    ta.value = mergeUrlLines(ta.value, entries.map(x => x.inputUrl));
    ta.dataset.userEdited = '1';

    upsertCollectedSearchEntries(entries);

    const afterItems = parseUrlLines(ta.value);
    const added = afterItems.filter(x => !beforeKeys.has(x.urlKey)).length;

    return { added, totalFound: entries.length };
  }

  function collectResultsOnly() {
    if (!isSearchResultsPage()) {
      setSearchStatus('検索結果ページで実行してください', true);
      return;
    }

    const { added, totalFound } = appendSearchResultUrlsToTextarea();
    if (!totalFound) {
      setSearchStatus('このページで求人リンクを検出できませんでした', true);
      return;
    }

    setSearchStatus(`このページから ${totalFound}件検出 / ${added}件をキュー追加しました`);
    refreshBatchInfo();
    refreshSearchInfo();
  }

  function collectResultsAndStart() {
    if (!isSearchResultsPage()) {
      setSearchStatus('検索結果ページで実行してください', true);
      return;
    }

    const { added, totalFound } = appendSearchResultUrlsToTextarea();
    if (!totalFound) {
      setSearchStatus('このページで求人リンクを検出できませんでした', true);
      return;
    }

    setSearchStatus(`このページから ${totalFound}件検出 / ${added}件追加。これから開始します`);
    startOrResumeBatch({ forceFromTextarea: true });
  }

  function startFullSearchCrawl(mode) {
    if (!isSearchResultsPage()) {
      setSearchStatus('検索結果ページで実行してください', true);
      return;
    }

    const ta = document.querySelector(`#${PANEL_ID} textarea`);
    const seedUrls = parseUrlLines(ta ? ta.value : '').map(x => x.inputUrl);
    const startedAt = nowText();
    const state = {
      active: true,
      mode: mode,
      createdAt: startedAt,
      updatedAt: startedAt,
      sessionId: makeSessionId(),
      crawlStartedAt: startedAt,
      profileLabel: getProfileLabel(),
      seedUrls: uniqueNormalizedUrls(seedUrls),
      collectedItems: [],
      visitedPages: [],
      pageCount: 0
    };

    saveSearchCrawlState(state);
    refreshSearchInfo();
    refreshBatchInfo();
    setSearchStatus(mode === 'collect-and-start'
      ? '全ページ収集を開始します。収集後に一括取得も始めます'
      : '全ページ収集を開始します');

    autoRunSearchCrawlIfNeeded();
  }

  async function waitForStableRecord(timeoutMs = 30000, intervalMs = 1000) {
    const start = Date.now();
    let lastResult = null;

    while (Date.now() - start < timeoutMs) {
      lastResult = buildRecord();
      const elapsed = Date.now() - start;

      if (isGoodRecord(lastResult.record, lastResult.source, elapsed)) {
        return lastResult;
      }

      await sleep(intervalMs);
    }

    const error = new Error('求人データ取得タイムアウト');
    error.lastResult = lastResult;
    throw error;
  }

  async function autoRunBatchIfNeeded() {
    if (window.__tmIndeedBatchRunning) return;

    const state = loadBatchState();
    if (!state.active) return;

    const idx = findCurrentPendingIndex(state);
    if (idx < 0) return;

    window.__tmIndeedBatchRunning = true;

    try {
      const counts = getBatchCounts(state);
      setBatchStatus(`自動取得中... 完了${counts.done} / 全${counts.total}`);

      const { record, source } = await waitForStableRecord(30000, 1000);

      const ok = markCurrentAsDone(record, source);
      if (!ok) {
        throw new Error('現在URLの保存に失敗しました');
      }

      refreshBatchInfo();
      setBatchStatus(`取得完了: ${record['求人タイトル'] || record['ページタイトル'] || location.href}`);

      await sleep(1000);
      goToNextPending();
    } catch (err) {
      console.error(err);
      const diagnosticRecord = err?.lastResult?.record || (() => {
        try { return buildRecord().record; } catch (e) { return null; }
      })();
      markCurrentAsError(err.message || String(err), diagnosticRecord, err?.lastResult?.source || 'error');
      refreshBatchInfo();
      setBatchStatus(`取得失敗: ${err.message || err}`, true);

      await sleep(1200);
      goToNextPending();
    } finally {
      window.__tmIndeedBatchRunning = false;
    }
  }

  async function autoRunSearchCrawlIfNeeded() {
    if (window.__tmIndeedSearchCrawlRunning) return;

    const state = loadSearchCrawlState();
    if (!state.active) return;
    if (!isSearchResultsPage()) return;
    if (isChallengePage()) {
      setSearchStatus('認証/ブロック画面のため全ページ収集を停止しました', true);
      finalizeSearchCrawl({ partial: true, forceBatchStart: false });
      return;
    }

    window.__tmIndeedSearchCrawlRunning = true;

    try {
      await sleep(1200);

      const currentPage = normalizeUrl(location.href);
      const latestState = loadSearchCrawlState();
      if (!latestState.active) return;

      if (!latestState.visitedPages.includes(currentPage)) {
        const entries = collectSearchResultEntries();
        latestState.collectedItems = mergeItemArrays(latestState.collectedItems || [], entries).map(item => ({
          inputUrl: item.inputUrl,
          urlKey: item.urlKey,
          jobKey: item.jobKey,
          searchMeta: item.searchMeta || {}
        }));
        latestState.visitedPages.push(currentPage);
        latestState.pageCount = latestState.visitedPages.length;
        saveSearchCrawlState(latestState);
      }

      refreshSearchInfo();
      refreshBatchInfo();

      const nextUrl = findNextSearchPageUrl();
      const refreshedState = loadSearchCrawlState();

      if (nextUrl && !refreshedState.visitedPages.includes(normalizeUrl(nextUrl))) {
        setSearchStatus(`検索結果 ${refreshedState.pageCount}ページ目まで収集。次ページへ移動します`);
        await sleep(900);
        location.href = nextUrl;
        return;
      }

      finalizeSearchCrawl({ partial: false });
    } catch (err) {
      console.error(err);
      setSearchStatus(`全ページ収集でエラー: ${err.message || err}`, true);
      finalizeSearchCrawl({ partial: true, forceBatchStart: false });
    } finally {
      window.__tmIndeedSearchCrawlRunning = false;
    }
  }

  async function saveCurrentJobAsSingleResult() {
    if (isSearchResultsPage() && !location.pathname.includes('/viewjob')) {
      setStatus('求人詳細ページで実行してください', true);
      setBatchStatus('検索結果ページでは「検索結果すべての求人を取得」を使ってください', true);
      return;
    }

    try {
      setStatus('表示中の求人データを取得中...');
      setBatchStatus('表示中の求人を取得しています');

      const { record, source } = await waitForStableRecord(15000, 500);
      const jobKey = record['求人キー'] || getJobKeyFromUrl(location.href) || '';
      const canonicalUrl = canonicalViewJobUrl(jobKey, location.href) || normalizeUrl(location.href);
      const startedAt = nowText();
      const sessionId = makeSessionId();
      const searchMeta = {
        '取得セッションID': sessionId,
        'クロール開始日時': startedAt,
        '取得プロファイル': getProfileLabel()
      };
      const savedRecord = applySearchMetaToRecord(record, searchMeta);

      const item = {
        inputUrl: canonicalUrl,
        urlKey: jobKey || entryKeyFromUrl(canonicalUrl),
        jobKey,
        status: 'done',
        source,
        error: '',
        processedAt: nowText(),
        record: savedRecord,
        searchMeta
      };

      const newState = {
        active: false,
        createdAt: startedAt,
        updatedAt: nowText(),
        sessionId,
        crawlStartedAt: startedAt,
        profileLabel: getProfileLabel(),
        items: [item]
      };

      saveBatchState(newState);
      clearSearchCrawlState();
      refreshBatchInfo();
      refreshSearchInfo();
      refreshRunButtonLabel();

      setStatus(`表示中の求人を取得しました: ${record['求人タイトル'] || record['ページタイトル'] || canonicalUrl}`);
      setBatchStatus('取得完了。必要に応じて「取得データをTSVコピー」を押してください');
    } catch (err) {
      console.error(err);
      setStatus(`表示中の求人取得に失敗: ${err.message || err}`, true);
      setBatchStatus(`表示中の求人取得に失敗: ${err.message || err}`, true);
    }
  }

  function hasActiveWork() {
    const batchState = loadBatchState();
    const crawlState = loadSearchCrawlState();
    return Boolean(batchState.active || crawlState.active);
  }

  function toggleRunPause() {
    if (hasActiveWork()) {
      stopAll();
      refreshRunButtonLabel();
      return;
    }

    const state = loadBatchState();
    const hasPending = state.items.some(item => item.status === 'pending');
    const ta = document.querySelector(`#${PANEL_ID} textarea`);
    const hasManualUrls = Boolean(ta && ta.value.trim());

    if (hasPending || hasManualUrls) {
      startOrResumeBatch();
      refreshRunButtonLabel();
      return;
    }

    setBatchStatus('再開できる未処理URLがありません', true);
  }

  function loadPanelCollapsed() {
    try {
      return localStorage.getItem(PANEL_COLLAPSED_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  function savePanelCollapsed(collapsed) {
    try {
      localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed ? 'true' : 'false');
    } catch (e) {}
  }

  function getCollapsedSummaryText() {
    const batchState = loadBatchState();
    const crawlState = loadSearchCrawlState();
    const counts = getBatchCounts(batchState);

    if (crawlState.active) {
      const collectedCount = getSearchStateVisibleUrls(crawlState).length;
      return `収集中: ${crawlState.pageCount || 0}ページ / URL${collectedCount}件`;
    }

    if (batchState.active) {
      return `取得中: 完了${counts.done} / 全${counts.total}`;
    }

    if (counts.pending > 0) {
      return `停止中: 未処理${counts.pending}件`;
    }

    if (counts.done > 0 || counts.error > 0) {
      return `完了${counts.done}件 / 失敗${counts.error}件`;
    }

    return '待機中';
  }

  function refreshPanelCollapsedSummary() {
    const el = document.querySelector(`#${PANEL_ID} .tm-collapsed-summary`);
    if (!el) return;
    el.textContent = getCollapsedSummaryText();
  }

  function applyPanelCollapsedState(collapsed) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    panel.classList.toggle('tm-collapsed', Boolean(collapsed));

    const btn = panel.querySelector('.btn-panel-collapse');
    if (btn) {
      btn.textContent = collapsed ? '＋' : '−';
      btn.title = collapsed ? 'Indeed Helperを表示' : 'Indeed Helperを折り畳み';
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    refreshPanelCollapsedSummary();
  }

  function togglePanelCollapsed() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const nextCollapsed = !panel.classList.contains('tm-collapsed');
    savePanelCollapsed(nextCollapsed);
    applyPanelCollapsedState(nextCollapsed);
  }

  function refreshRunButtonLabel() {
    const btn = document.querySelector(`#${PANEL_ID} .btn-toggle-run`);
    if (!btn) return;

    const state = loadBatchState();
    const ta = document.querySelector(`#${PANEL_ID} textarea`);
    const hasPending = state.items.some(item => item.status === 'pending');
    const hasManualUrls = Boolean(ta && ta.value.trim());

    if (hasActiveWork()) {
      btn.textContent = '取得を一時停止';
      btn.classList.add('tm-warning');
      btn.classList.remove('tm-muted');
    } else if (hasPending || hasManualUrls) {
      btn.textContent = '取得を再開';
      btn.classList.add('tm-muted');
      btn.classList.remove('tm-warning');
    } else {
      btn.textContent = '一時停止／再開';
      btn.classList.add('tm-muted');
      btn.classList.remove('tm-warning');
    }

    refreshPanelCollapsedSummary();
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647;
        width: 360px;
        max-height: calc(100vh - 32px);
        overflow: auto;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 14px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        padding: 12px;
        font-family: Arial, sans-serif;
        color: #111827;
      }
      #${PANEL_ID}.tm-collapsed {
        width: 210px;
        padding: 10px;
        overflow: hidden;
      }
      #${PANEL_ID} .tm-panel-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #${PANEL_ID} .tm-title {
        flex: 1;
        font-size: 15px;
        font-weight: 800;
        margin-bottom: 0;
        white-space: nowrap;
      }
      #${PANEL_ID} .btn-panel-collapse {
        width: 30px;
        min-width: 30px;
        height: 28px;
        padding: 0;
        border-radius: 8px;
        background: #e5e7eb;
        color: #111827;
        font-size: 16px;
        font-weight: 900;
        line-height: 1;
      }
      #${PANEL_ID} .tm-collapsed-summary {
        display: none;
        margin-top: 6px;
        font-size: 11px;
        font-weight: 700;
        color: #374151;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${PANEL_ID}.tm-collapsed .tm-panel-body {
        display: none;
      }
      #${PANEL_ID}.tm-collapsed .tm-collapsed-summary {
        display: block;
      }
      #${PANEL_ID} .tm-group {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
      }
      #${PANEL_ID} .tm-main-actions {
        border-top: none;
        padding-top: 4px;
      }
      #${PANEL_ID} .tm-buttons {
        display: grid;
        gap: 8px;
      }
      #${PANEL_ID} .tm-buttons-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      #${PANEL_ID} button {
        border: none;
        border-radius: 9px;
        padding: 10px 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
        background: #2563eb;
        color: #fff;
        line-height: 1.3;
      }
      #${PANEL_ID} button:hover {
        opacity: 0.92;
      }
      #${PANEL_ID} button.tm-primary {
        background: #1d4ed8;
      }
      #${PANEL_ID} button.tm-muted {
        background: #4b5563;
      }
      #${PANEL_ID} button.tm-warning {
        background: #d97706;
      }
      #${PANEL_ID} button.tm-danger {
        background: #b91c1c;
      }
      #${PANEL_ID} textarea {
        width: 100%;
        box-sizing: border-box;
        min-height: 110px;
        resize: vertical;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 8px;
        font-size: 12px;
        line-height: 1.4;
      }
      #${PANEL_ID} .tm-profile-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 8px;
        font-size: 12px;
        line-height: 1.4;
        background: #fff;
      }
      #${PANEL_ID} .tm-sub {
        margin-top: 7px;
        font-size: 11px;
        color: #6b7280;
        line-height: 1.45;
      }
      #${PANEL_ID} .tm-status,
      #${PANEL_ID} .tm-batch-status,
      #${PANEL_ID} .tm-search-status {
        margin-top: 8px;
        font-size: 12px;
        font-weight: 700;
        word-break: break-word;
      }
      #${PANEL_ID} .tm-info {
        margin-top: 8px;
        font-size: 11px;
        line-height: 1.5;
        color: #374151;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 8px;
      }
      #${PANEL_ID} .tm-label {
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 6px;
      }
      #${PANEL_ID} .tm-details {
        margin-top: 10px;
        border-top: 1px solid #e5e7eb;
        padding-top: 10px;
      }
      #${PANEL_ID} .tm-details summary {
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
        color: #1d4ed8;
        user-select: none;
      }
      #${PANEL_ID} .tm-details .tm-group:first-of-type {
        margin-top: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    addStyles();

    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    panel.innerHTML = `
      <div class="tm-panel-head">
        <div class="tm-title">Indeed Helper</div>
        <button class="btn-panel-collapse" type="button" title="Indeed Helperを折り畳み" aria-label="Indeed Helperを折り畳み" aria-expanded="true">−</button>
      </div>
      <div class="tm-collapsed-summary">待機中</div>

      <div class="tm-panel-body">
        <div class="tm-sub">求人情報を取得し、スプレッドシート貼付け用TSVとしてコピーできます。</div>
        <div class="tm-status tm-indeed-helper-status">初期化中</div>

        <div class="tm-group tm-main-actions">
        <div class="tm-label">通常操作</div>
        <div class="tm-buttons">
          <button class="btn-single-save tm-primary">表示中の求人を取得</button>
          <button class="btn-collect-all-start tm-primary">検索結果すべての求人を取得</button>
          <button class="btn-batch-copy">取得データをTSVコピー</button>
        </div>

        <div class="tm-buttons-2" style="margin-top:8px;">
          <button class="btn-toggle-run tm-muted">取得を再開</button>
          <button class="btn-batch-clear tm-danger">取得情報クリア</button>
        </div>
      </div>

      <div class="tm-info tm-indeed-helper-batch-info"></div>
      <div class="tm-batch-status tm-indeed-helper-batch-status">待機中</div>
      <div class="tm-search-status tm-indeed-helper-search-status">待機中</div>

      <details class="tm-details">
        <summary>詳細メニュー</summary>

        <div class="tm-group">
          <div class="tm-label">表示中の求人</div>
          <div class="tm-buttons-2">
            <button class="btn-copy-header">見出し付きで即コピー</button>
            <button class="btn-copy-row">1行だけ即コピー</button>
          </div>
          <div class="tm-buttons" style="margin-top:8px;">
            <button class="btn-copy-json tm-muted">JSONコピー（開発用）</button>
          </div>
        </div>

        <div class="tm-group">
          <div class="tm-label">検索結果ページの詳細操作</div>
          <div class="tm-buttons-2">
            <button class="btn-collect-results">現ページだけURL追加</button>
            <button class="btn-collect-start">現ページを追加して取得開始</button>
          </div>
          <div class="tm-buttons" style="margin-top:8px;">
            <button class="btn-collect-all tm-muted">全ページURL収集のみ</button>
          </div>
          <div class="tm-info tm-indeed-helper-search-info"></div>
          <div class="tm-sub">URLだけ集めたい場合や、検索結果1ページだけを扱いたい場合に使います。</div>
        </div>

        <div class="tm-group">
          <div class="tm-label">取得プロファイル（任意）</div>
          <input class="tm-profile-input" type="text" placeholder="例: browser_A / driver_history / logged_out" />
          <div class="tm-sub">検索履歴・ログイン状態の比較用ラベルです。メールアドレス等の個人情報は入れず、任意の実験名だけを設定してください。</div>
        </div>

        <div class="tm-group">
          <div class="tm-label">手動URL一覧（1行1件）</div>
          <textarea placeholder="https://jp.indeed.com/viewjob?jk=...\nhttps://jp.indeed.com/viewjob?jk=..."></textarea>
          <div class="tm-buttons" style="margin-top:8px;">
            <button class="btn-batch-start">手動URL一覧から取得開始/再開</button>
          </div>
        </div>

        <div class="tm-group">
          <div class="tm-label">出力・トラブル対応</div>
          <div class="tm-buttons-2">
            <button class="btn-batch-download">TSVファイルDL</button>
            <button class="btn-error-copy">失敗URLコピー</button>
          </div>
          <div class="tm-sub">通常は「取得データをTSVコピー」だけでスプレッドシートに貼り付けできます。</div>
        </div>
      </details>
      </div>
    `;

    document.body.appendChild(panel);

    panel.querySelector('.btn-panel-collapse').addEventListener('click', () => togglePanelCollapsed());
    applyPanelCollapsedState(loadPanelCollapsed());

    panel.querySelector('.btn-single-save').addEventListener('click', () => saveCurrentJobAsSingleResult());
    panel.querySelector('.btn-collect-all-start').addEventListener('click', () => startFullSearchCrawl('collect-and-start'));
    panel.querySelector('.btn-batch-copy').addEventListener('click', () => copyBatchResults());
    panel.querySelector('.btn-toggle-run').addEventListener('click', () => toggleRunPause());
    panel.querySelector('.btn-batch-clear').addEventListener('click', () => clearBatchResults());

    panel.querySelector('.btn-copy-header').addEventListener('click', () => handleCopy(true));
    panel.querySelector('.btn-copy-row').addEventListener('click', () => handleCopy(false));
    panel.querySelector('.btn-copy-json').addEventListener('click', () => handleJsonCopy());

    panel.querySelector('.btn-collect-results').addEventListener('click', () => collectResultsOnly());
    panel.querySelector('.btn-collect-start').addEventListener('click', () => collectResultsAndStart());
    panel.querySelector('.btn-collect-all').addEventListener('click', () => startFullSearchCrawl('collect-only'));

    panel.querySelector('.btn-batch-start').addEventListener('click', () => startOrResumeBatch({ forceFromTextarea: true }));
    panel.querySelector('.btn-batch-download').addEventListener('click', () => downloadBatchResults());
    panel.querySelector('.btn-error-copy').addEventListener('click', () => copyErrorUrls());

    const profileInput = panel.querySelector('.tm-profile-input');
    if (profileInput) {
      profileInput.value = getProfileLabel();
      profileInput.addEventListener('change', () => setProfileLabel(profileInput.value));
      profileInput.addEventListener('blur', () => setProfileLabel(profileInput.value));
    }

    const ta = panel.querySelector('textarea');
    ta.addEventListener('input', () => {
      ta.dataset.userEdited = '1';
    });

    refreshRunButtonLabel();
  }

  function refreshStatus() {
    try {
      if (isChallengePage()) {
        setStatus('認証/ブロック画面の可能性があります', true);
        return;
      }

      if (isSearchResultsPage() && !location.pathname.includes('/viewjob')) {
        const entries = collectSearchResultEntries();
        const nextUrl = findNextSearchPageUrl();
        const sponsored = entries.filter(x => x.searchMeta?.['検索結果スポンサー判定'] === 'true').length;
        const organic = entries.filter(x => x.searchMeta?.['検索結果スポンサー判定'] === 'false').length;
        setStatus(`検索結果ページ: 求人リンク ${entries.length}件 / スポンサー ${sponsored} / オーガニック ${organic} / 次ページ ${nextUrl ? 'あり' : 'なし'}`);
        return;
      }

      const { record, source } = buildRecord();
      const title = record['求人タイトル'] || '(タイトル未取得)';
      if (source === 'current-json') {
        setStatus(`${record['取得ステータス']} / 現行JSON: ${title}`);
      } else {
        setStatus(`求人詳細モデル未検出: ${record['取得エラー理由'] || title}`, true);
      }
    } catch (err) {
      setStatus(`求人データ待機中: ${err.message || err}`, true);
    }
  }

  function boot() {
    if (!document.body) return;
    createPanel();
    refreshStatus();
    refreshBatchInfo();
    refreshSearchInfo();
    refreshRunButtonLabel();
    refreshPanelCollapsedSummary();
    autoRunSearchCrawlIfNeeded();
    autoRunBatchIfNeeded();
  }

  let lastUrl = location.href;

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(boot, 800);
      setTimeout(boot, 1800);
    }
    boot();
  }, 1500);

  window.addEventListener('load', () => {
    setTimeout(boot, 500);
    setTimeout(boot, 1500);
    setTimeout(boot, 3000);
  });

  boot();
  console.log('Indeed Helper Batch Export v2.0.0: loaded');
})();

