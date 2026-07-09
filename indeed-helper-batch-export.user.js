// ==UserScript==
// @name         Indeed Helper Batch Export
// @namespace    http://tampermonkey.net/
// @version      1.8.3
// @description  Indeed求人ページから求人情報を単発/一括でTSV出力。通常操作を簡素化し、詳細機能を折りたたみメニューへ整理
// @match        https://jp.indeed.com/*
// @grant        GM_setClipboard
// @updateURL    https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-helper-batch-export.user.js
// @downloadURL  https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-helper-batch-export.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = 'tm-indeed-helper-panel';
  const STYLE_ID = 'tm-indeed-helper-style';
  const BATCH_STATE_KEY = 'tmIndeedBatchState_v1';
  const SEARCH_CRAWL_STATE_KEY = 'tmIndeedSearchCrawlState_v1';
  const PANEL_COLLAPSED_KEY = 'tmIndeedHelperPanelCollapsed_v1';

  const HEADERS = [
    '取得URL',
    'ページタイトル',
    '検索結果元リンク',
    '検索結果リンク種別',
    '検索結果スポンサー判定',
    '検索結果スポンサー根拠',
    '詳細ページスポンサー判定',
    '詳細ページスポンサー企業キー',
    '詳細ページクリック追跡URL',
    'requestPath',
    '求人キー',
    '求人タイトル',
    '標準化された職種名',
    '参照番号',
    '言語',
    '会社名',
    'ソース企業名',
    'ソース企業キー',
    '会社ページURL',
    '会社口コミURL',
    '企業キー',
    '企業tier',
    '企業相対ページURL',
    '企業口コミ件数',
    '企業総合評価件数',
    '企業総合評価値',
    '勤務地表示',
    '勤務地短縮',
    '住所',
    '郵便番号',
    '地方区分',
    '都道府県',
    '市区町村',
    '行政区',
    '町名等',
    '国コード',
    '地方コード',
    '都道府県コード',
    '市区町村コード',
    '行政区コード',
    '丁目番地',
    '緯度',
    '経度',
    '雇用形態',
    'シフト勤務体系',
    '勤務制度',
    '給与テキスト',
    '給与最小',
    '給与最大',
    '給与通貨',
    '給与種別',
    '給与ソース',
    '報酬内部キー',
    'Indeed掲載日時',
    '公開日時',
    '募集期限',
    '掲載経過表示',
    '募集終了フラグ',
    '直接URL',
    'フィードキー',
    'フィード種別',
    'フィードisDradis',
    '応募スコープ',
    'IndeedApplyキー',
    'IndeedApply pingbackUrl',
    'IndeedApply continueUrl',
    'IndeedApply advnum',
    'IndeedApplyボタン種別',
    '写真数',
    '写真URL一覧',
    '写真altText一覧',
    '職種一覧',
    '職種キー一覧',
    '最有力職種キー',
    '企業提供職種',
    '属性一覧',
    '企業提供属性',
    '福利厚生属性',
    '社会保険属性',
    '急募フラグ',
    '大量採用フラグ',
    '再掲載フラグ',
    '最新掲載フラグ',
    '配置案件フラグ',
    'organicApplyStarts',
    '積極採用中',
    '返信率の高い企業',
    '過去30日間に Indeed を通じて75%以上の応募に返信',
    'responseRate',
    'averageResponseInDays',
    '本文全文',
    '仕事内容',
    '求めている人材',
    '勤務時間詳細',
    '勤務形態',
    '休日休暇',
    '勤務地所在地',
    '交通アクセス',
    '給与詳細',
    '給与例',
    '試用期間',
    '待遇福利厚生',
    '社会保険',
    '選考プロセス',
    '企業名詳細',
    '本社所在地',
    '業種',
    '代表者名',
    '代表電話番号'
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
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    const d = new Date(num);
    if (Number.isNaN(d.getTime())) return '';
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

  function stripHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    return normalizeText(doc.body ? (doc.body.textContent || '') : '');
  }

  function joinLabels(arr, key = 'label') {
    if (!Array.isArray(arr)) return '';
    return arr
      .map(x => (x && x[key] != null ? String(x[key]) : ''))
      .filter(Boolean)
      .join(' | ');
  }

  function joinValues(arr) {
    if (!Array.isArray(arr)) return '';
    return arr
      .map(x => (x == null ? '' : String(x)))
      .filter(Boolean)
      .join(' | ');
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
    const roots = [];

    if (isObject(window._initialData)) roots.push(window._initialData);
    if (isObject(window.__NEXT_DATA__)) roots.push(window.__NEXT_DATA__);

    const scripts = Array.from(document.scripts || []);
    for (const s of scripts) {
      const txt = s.textContent || '';
      if (!txt) continue;

      if (txt.includes('window._initialData')) {
        const objText = extractAssignedObjectText(txt, ['window._initialData', '_initialData']);
        const parsed = safeJsonParse(objText);
        if (parsed) roots.push(parsed);
      }

      if (txt.includes('window.__NEXT_DATA__') || txt.includes('__NEXT_DATA__')) {
        const objText = extractAssignedObjectText(txt, ['window.__NEXT_DATA__', '__NEXT_DATA__']);
        const parsed = safeJsonParse(objText);
        if (parsed) roots.push(parsed);
      }
    }

    return roots;
  }

  function findBundleFromRoot(root) {
    const body =
      deepFind(root, n =>
        isObject(n) &&
        (
          n.hostQueryExecutionResult ||
          n.jobInfoWrapperModel ||
          n.salaryInfoModel ||
          n.jobMetadataFooterModel
        )
      ) || null;

    const job =
      (body && body.hostQueryExecutionResult?.data?.jobData?.results?.[0]?.job) ||
      deepFind(root, n =>
        isObject(n) &&
        typeof n.key === 'string' &&
        typeof n.title === 'string' &&
        (
          n.sourceEmployerName ||
          n.location ||
          n.url ||
          n.description ||
          n.jobTypes ||
          n.attributes
        )
      ) || null;

    if (!job) return null;

    const jobInfoModel =
      (body && body.jobInfoWrapperModel?.jobInfoModel) ||
      deepFind(root, n =>
        isObject(n) &&
        (
          n.jobInfoHeaderModel ||
          n.sectionedJobInfoModel ||
          n.sanitizedJobDescription
        )
      ) || null;

    const headerModel =
      (jobInfoModel && jobInfoModel.jobInfoHeaderModel) ||
      (body && body.jobInfoWrapperModel?.jobInfoModel?.jobInfoHeaderModel) ||
      deepFind(root, n =>
        isObject(n) &&
        (
          n.companyOverviewLink ||
          n.companyReviewLink ||
          n.formattedLocation ||
          n.companyName ||
          n.employerResponsiveCardModel ||
          n.jobFlairLabelModel
        )
      ) || null;

    const sectionedModel =
      (body && body.jobInfoWrapperModel?.sectionedJobInfoModel) ||
      deepFind(root, n =>
        isObject(n) && Array.isArray(n.semanticSegmentModels)
      ) || null;

    const salaryInfo =
      (body && body.salaryInfoModel) ||
      deepFind(root, n =>
        isObject(n) &&
        ('salaryText' in n) &&
        (
          'salaryType' in n ||
          'salarySource' in n ||
          'salaryMin' in n ||
          'salaryMax' in n
        )
      ) || null;

    const footerModel =
      (body && body.jobMetadataFooterModel) ||
      deepFind(root, n =>
        isObject(n) &&
        (
          ('age' in n) ||
          ('relativeDate' in n)
        )
      ) || null;

    const employerResponsiveCardModel =
      (body && body.employerResponsiveCardModel) ||
      (headerModel && headerModel.employerResponsiveCardModel) ||
      deepFind(root, n =>
        isObject(n) &&
        (
          ('responseRate' in n) ||
          ('averageResponseInDays' in n)
        ) &&
        (
          'headline' in n ||
          'description' in n
        )
      ) || null;

    const jobFlairLabelModel =
      (headerModel && headerModel.jobFlairLabelModel) ||
      deepFind(root, n =>
        isObject(n) &&
        ('eligible' in n) &&
        ('headline' in n) &&
        ('description' in n)
      ) || null;

    return {
      root,
      body,
      job,
      jobInfoModel,
      headerModel,
      sectionedModel,
      salaryInfo,
      footerModel,
      employerResponsiveCardModel,
      jobFlairLabelModel
    };
  }

  function getBundle() {
    const roots = getCandidateRoots();
    for (const root of roots) {
      const bundle = findBundleFromRoot(root);
      if (bundle) return bundle;
    }
    return null;
  }

  function buildSegmentMap(bundle) {
    const map = {};
    const sectioned = bundle?.sectionedModel;
    const job = bundle?.job;

    const segs1 = Array.isArray(sectioned?.semanticSegmentModels) ? sectioned.semanticSegmentModels : [];
    const segs2 = Array.isArray(job?.description?.semanticSegments) ? job.description.semanticSegments : [];

    for (const seg of segs1) {
      const headerKey = cleanHeaderKey(seg.header || '');
      const labelKey = seg.semanticLabel ? `label:${seg.semanticLabel}` : '';
      const value = stripHtml(seg.sanitizedContent || seg.content || '');
      if (headerKey && !map[headerKey]) map[headerKey] = value;
      if (labelKey && !map[labelKey]) map[labelKey] = value;
    }

    for (const seg of segs2) {
      const headerKey = cleanHeaderKey(seg.header || '');
      const labelKey = seg.label ? `seg:${seg.label}` : '';
      const value = stripHtml(seg.content || seg.sanitizedContent || '');
      if (headerKey && !map[headerKey]) map[headerKey] = value;
      if (labelKey && !map[labelKey]) map[labelKey] = value;
    }

    return map;
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

    return false;
  }

  function isSearchResultsPage() {
    if (isIndeedSearchResultsUrl(location.href)) return true;

    if (
      document.querySelector('a[href*="/viewjob?"], a[href*="/rc/clk"], a[href*="/pagead/"]') &&
      isIndeedSearchResultsUrl(location.href)
    ) {
      return true;
    }

    return false;
  }

  function buildRecord() {
    const record = buildEmptyRecord();

    record['取得URL'] = location.href;
    record['ページタイトル'] = document.title || '';

    const bundle = getBundle();

    if (!bundle) {
      record['求人タイトル'] = getDomText(['h1', '[data-testid="viewJobTitle"]']);
      record['会社名'] = getDomText(['[data-testid="inlineHeader-companyName"]', 'main a']);
      record['勤務地表示'] = getDomText(['[data-testid="job-location"]', 'main']);
      record['給与テキスト'] = getDomText(['#salaryInfoAndJobType', '[data-testid="attribute_snippet_testid"]']);
      record['本文全文'] = getDomText(['main']);
      return { record, source: 'dom-fallback' };
    }

    const root = bundle.root || {};
    const job = bundle.job || {};
    const body = bundle.body || {};
    const headerModel = bundle.headerModel || {};
    const salaryInfo = bundle.salaryInfo || {};
    const footerModel = bundle.footerModel || {};
    const employerResponsiveCardModel = bundle.employerResponsiveCardModel || {};
    const jobFlairLabelModel = bundle.jobFlairLabelModel || {};
    const employer = job?.employer || {};
    const employerRating = employer?.ugcStats?.ratings?.overallRating || {};
    const indeedApplyButtonContainer =
      body?.indeedApplyButtonContainer ||
      root?.indeedApplyButtonContainer ||
      {};
    const indeedApplyButtonAttributes = indeedApplyButtonContainer?.indeedApplyButtonAttributes || {};
    const indeedApplyButtonModel = indeedApplyButtonContainer?.indeedApplyButtonModel || {};
    const employerResponsiveHeadline = normalizeText(employerResponsiveCardModel?.headline || '');
    const employerResponsiveDescription = normalizeText(employerResponsiveCardModel?.description || '');
    const jobFlairHeadline = normalizeText(jobFlairLabelModel?.headline || '');
    const segMap = buildSegmentMap(bundle);

    const photoUrls = Array.isArray(job.photos)
      ? job.photos.map(p => p?.w800 || p?.w400 || p?.w1600 || p?.url || '').filter(Boolean)
      : [];

    const photoAltTexts = Array.isArray(job.photos)
      ? job.photos.map(p => p?.altText || '').filter(Boolean)
      : [];

    const companyOverviewLink = headerModel.companyOverviewLink || '';
    const companyReviewLink = headerModel.companyReviewLink || '';

    const fullText = normalizeText(job?.description?.text || stripHtml(job?.description?.html || ''));

    record['詳細ページスポンサー判定'] = boolText(root?.sponsored ?? body?.sponsored);
    record['詳細ページスポンサー企業キー'] = job?.sponsoredEmployerKey || '';
    record['詳細ページクリック追跡URL'] = job?.tracking?.jobClick?.url || '';
    record['requestPath'] = root?.requestPath || body?.requestPath || '';

    record['求人キー'] = job?.key || body?.jobKey || '';
    record['求人タイトル'] = job?.title || body?.jobTitle || getDomText(['h1']);
    record['標準化された職種名'] = job?.normalizedTitle || '';
    record['参照番号'] = job?.refNum || '';
    record['言語'] = job?.language || body?.language || '';

    record['会社名'] = job?.sourceEmployerName || headerModel?.companyName || '';
    record['ソース企業名'] = job?.source?.name || '';
    record['ソース企業キー'] = job?.source?.key || '';

    record['会社ページURL'] = companyOverviewLink;
    record['会社口コミURL'] = companyReviewLink;

    record['企業キー'] = employer?.key || '';
    record['企業tier'] = employer?.tier || '';
    record['企業相対ページURL'] = employer?.relativeCompanyPageUrl || '';
    record['企業口コミ件数'] = employer?.ugcStats?.globalReviewCount ?? '';
    record['企業総合評価件数'] = employerRating?.count ?? '';
    record['企業総合評価値'] = employerRating?.value ?? '';

    record['勤務地表示'] = job?.location?.formatted?.long || headerModel?.formattedLocation || '';
    record['勤務地短縮'] = job?.location?.formatted?.short || '';
    record['住所'] = job?.location?.fullAddress || '';
    record['郵便番号'] = job?.location?.postalCode || '';
    record['地方区分'] = job?.location?.admin1Name || '';
    record['都道府県'] = job?.location?.admin2Name || '';
    record['市区町村'] = job?.location?.admin3Name || '';
    record['行政区'] = job?.location?.admin4Name || '';
    record['町名等'] = job?.location?.city || '';

    record['国コード'] = job?.location?.countryCode || '';
    record['地方コード'] = job?.location?.admin1Code || '';
    record['都道府県コード'] = job?.location?.admin2Code || '';
    record['市区町村コード'] = job?.location?.admin3Code || '';
    record['行政区コード'] = job?.location?.admin4Code || '';
    record['丁目番地'] = job?.location?.streetAddress || '';

    record['緯度'] = job?.location?.latitude ?? '';
    record['経度'] = job?.location?.longitude ?? '';

    record['雇用形態'] = joinLabels(job?.jobTypes) || normalizeText(bundle?.sectionedModel?.formattedJobTypes?.content || '');
    record['シフト勤務体系'] = joinLabels(job?.shiftAndSchedule);
    record['勤務制度'] = joinLabels(job?.workingSystem) || pickSegment(segMap, ['勤務形態', 'label:working-system']);

    record['給与テキスト'] = salaryInfo?.salaryText || '';
    record['給与最小'] = salaryInfo?.salaryMin ?? '';
    record['給与最大'] = salaryInfo?.salaryMax ?? '';
    record['給与通貨'] = salaryInfo?.salaryCurrency || '';
    record['給与種別'] = salaryInfo?.salaryType || '';
    record['給与ソース'] = salaryInfo?.salarySource || '';
    record['報酬内部キー'] = job?.compensation?.key || '';

    record['Indeed掲載日時'] = formatDateTime(job?.dateOnIndeed);
    record['公開日時'] = formatDateTime(job?.datePublished);
    record['募集期限'] = formatDateTime(job?.expirationDate);
    record['掲載経過表示'] = footerModel?.age || footerModel?.relativeDate || '';
    record['募集終了フラグ'] = boolText(job?.expired);

    record['直接URL'] = job?.url || '';

    record['フィードキー'] = job?.feed?.key || '';
    record['フィード種別'] = job?.feed?.feedSourceType || '';
    record['フィードisDradis'] = boolText(job?.feed?.isDradis);

    record['応募スコープ'] = joinValues(job?.indeedApply?.scopes);
    record['IndeedApplyキー'] = job?.indeedApply?.key || '';
    record['IndeedApply pingbackUrl'] = indeedApplyButtonAttributes?.pingbackUrl || '';
    record['IndeedApply continueUrl'] = indeedApplyButtonAttributes?.continueUrl || '';
    record['IndeedApply advnum'] = indeedApplyButtonAttributes?.advnum || '';
    record['IndeedApplyボタン種別'] = indeedApplyButtonModel?.buttonType || '';

    record['写真数'] = photoUrls.length ? String(photoUrls.length) : '';
    record['写真URL一覧'] = joinValues(photoUrls);
    record['写真altText一覧'] = joinValues(photoAltTexts);

    record['職種一覧'] = joinLabels(job?.occupations);
    record['職種キー一覧'] = joinLabels(job?.occupations, 'key');
    record['最有力職種キー'] = joinLabels(job?.occupationMostLikelySuids, 'key');
    record['企業提供職種'] = joinLabels(job?.employerProvidedOccupations);

    record['属性一覧'] = joinLabels(job?.attributes);
    record['企業提供属性'] = joinLabels(job?.employerProvidedAttributes);
    record['福利厚生属性'] = joinLabels(job?.benefits);
    record['社会保険属性'] = joinLabels(job?.socialInsurance);

    record['急募フラグ'] = boolText(job?.hiringDemand?.isUrgentHire);
    record['大量採用フラグ'] = boolText(job?.hiringDemand?.isHighVolumeHiring);
    record['再掲載フラグ'] = boolText(job?.isRepost);
    record['最新掲載フラグ'] = boolText(job?.isLatestPost);
    record['配置案件フラグ'] = boolText(job?.isPlacement);

    record['organicApplyStarts'] = job?.jobStats?.organicApplyStarts ?? '';

    record['積極採用中'] = jobFlairLabelModel
      ? boolText(
          jobFlairLabelModel?.eligible === true ||
          jobFlairHeadline === '積極採用中'
        )
      : '';

    record['返信率の高い企業'] = employerResponsiveCardModel
      ? boolText(
          employerResponsiveHeadline === '返信率の高い企業' ||
          employerResponsiveCardModel?.responseRate != null ||
          employerResponsiveCardModel?.averageResponseInDays != null
        )
      : '';

    record['過去30日間に Indeed を通じて75%以上の応募に返信'] = employerResponsiveCardModel
      ? boolText(
          employerResponsiveDescription.includes('過去30日間に Indeed を通じて75%以上の応募に返信')
        )
      : '';

    record['responseRate'] = employerResponsiveCardModel?.responseRate ?? '';
    record['averageResponseInDays'] = employerResponsiveCardModel?.averageResponseInDays ?? '';

    record['本文全文'] = fullText;

    record['仕事内容'] = pickSegment(segMap, ['仕事内容', 'label:job-description', 'seg:JOB_DESCRIPTION']);
    record['求めている人材'] = pickSegment(segMap, ['求めている人材', '応募資格', 'label:qualification', 'seg:QUALIFICATION']);
    record['勤務時間詳細'] = pickSegment(segMap, ['勤務時間詳細', '勤務時間', 'label:work-hours', 'seg:WORK_HOURS']);
    record['勤務形態'] = pickSegment(segMap, ['勤務形態', 'label:working-system']);
    record['休日休暇'] = pickSegment(segMap, ['休日休暇', 'label:holidays', 'seg:HOLIDAYS']);
    record['勤務地所在地'] = pickSegment(segMap, ['勤務地所在地', 'label:full-address']);
    record['交通アクセス'] = pickSegment(segMap, ['交通・アクセス', 'アクセス（勤務地）', '最寄り駅', 'label:commute-info', 'seg:COMMUTE_INFO']);
    record['給与詳細'] = pickSegment(segMap, ['給与詳細', '給与', 'label:pay', 'seg:PAY']);
    record['給与例'] = pickSegment(segMap, ['給与例', 'label:salary-example', 'seg:SALARY_EXAMPLE']);
    record['試用期間'] = pickSegment(segMap, ['試用期間', 'label:probation-conditions']);
    record['待遇福利厚生'] = pickSegment(segMap, ['待遇・福利厚生', '福利厚生', '加入保険', 'label:benefits', 'seg:BENEFITS']);
    record['社会保険'] = pickSegment(segMap, ['社会保険', 'label:social-insurance']);
    record['選考プロセス'] = pickSegment(segMap, ['選考プロセス', '応募の流れ', 'label:apply-info', 'seg:APPLY_INFO']);
    record['企業名詳細'] = pickSegment(segMap, ['企業名', 'label:company-name']);
    record['本社所在地'] = pickSegment(segMap, ['本社所在地', 'label:company-location']);
    record['業種'] = pickSegment(segMap, ['業種', 'label:company-industry']);
    record['代表者名'] = pickSegment(segMap, ['代表者名', 'label:company-president']);
    record['代表電話番号'] = pickSegment(segMap, ['代表電話番号', 'label:contact-tel']);

    return { record, source: 'json' };
  }

  function isGoodRecord(record, source, elapsedMs = 0) {
    if (isChallengePage()) return false;

    const title = record?.['ページタイトル'] || '';
    const jobTitle = record?.['求人タイトル'] || '';
    const jobKey = record?.['求人キー'] || '';

    if (/just a moment/i.test(title)) return false;

    if (source === 'json') {
      return Boolean(jobTitle || jobKey);
    }

    if (source === 'dom-fallback') {
      if (elapsedMs < 7000) return false;
      return Boolean(jobTitle);
    }

    return false;
  }

  function buildTsv(includeHeader) {
    const { record } = buildRecord();
    const row = HEADERS.map(h => normalizeText(record[h]));
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

  function detectSearchSponsorMeta(anchorEl, cardEl, href) {
    const hrefText = String(href || '');
    const cardText = normalizeText(cardEl?.textContent || anchorEl?.textContent || '');

    if (/\/pagead\//i.test(hrefText)) {
      return {
        '検索結果スポンサー判定': 'true',
        '検索結果スポンサー根拠': 'search-link-path:/pagead/'
      };
    }

    if (/\/rc\/clk/i.test(hrefText)) {
      return {
        '検索結果スポンサー判定': 'false',
        '検索結果スポンサー根拠': 'search-link-path:/rc/clk'
      };
    }

    if (/スポンサー|sponsored/i.test(cardText)) {
      return {
        '検索結果スポンサー判定': 'true',
        '検索結果スポンサー根拠': 'search-card-text:sponsored'
      };
    }

    return {
      '検索結果スポンサー判定': '',
      '検索結果スポンサー根拠': 'search-link-path:unknown'
    };
  }

  function deriveSearchMetaFromUrl(rawUrl) {
    const norm = normalizeUrl(rawUrl);
    if (!norm) return {};

    const linkType = getSearchLinkType(norm);
    const base = {
      '検索結果元リンク': norm,
      '検索結果リンク種別': linkType,
      '検索結果スポンサー判定': '',
      '検索結果スポンサー根拠': ''
    };

    if (linkType === 'pagead') {
      base['検索結果スポンサー判定'] = 'true';
      base['検索結果スポンサー根拠'] = 'input-url-path:/pagead/';
    } else if (linkType === 'rc/clk') {
      base['検索結果スポンサー判定'] = 'false';
      base['検索結果スポンサー根拠'] = 'input-url-path:/rc/clk';
    }

    return base;
  }

  function mergeSearchMeta(base, extra) {
    const out = Object.assign({}, base || {});
    const src = extra || {};

    for (const key of ['検索結果元リンク', '検索結果リンク種別', '検索結果スポンサー判定', '検索結果スポンサー根拠']) {
      if (src[key] !== undefined && src[key] !== null && String(src[key]) !== '') {
        out[key] = String(src[key]);
      } else if (out[key] === undefined) {
        out[key] = '';
      }
    }

    return out;
  }

  function emptyBatchState() {
    return {
      active: false,
      createdAt: '',
      updatedAt: '',
      items: []
    };
  }

  function loadBatchState() {
    try {
      const raw = localStorage.getItem(BATCH_STATE_KEY);
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
    localStorage.setItem(BATCH_STATE_KEY, JSON.stringify(state));
  }

  function clearBatchState() {
    localStorage.removeItem(BATCH_STATE_KEY);
  }

  function emptySearchCrawlState() {
    return {
      active: false,
      mode: 'collect-only',
      createdAt: '',
      updatedAt: '',
      seedUrls: [],
      collectedItems: [],
      visitedPages: [],
      pageCount: 0
    };
  }

  function loadSearchCrawlState() {
    try {
      const raw = localStorage.getItem(SEARCH_CRAWL_STATE_KEY);
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
    localStorage.setItem(SEARCH_CRAWL_STATE_KEY, JSON.stringify(state));
  }

  function clearSearchCrawlState() {
    localStorage.removeItem(SEARCH_CRAWL_STATE_KEY);
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
      `件数: 全${c.total} / 完了${c.done} / 失敗${c.error} / 未処理${c.pending}`;

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
    for (const key of ['検索結果元リンク', '検索結果リンク種別', '検索結果スポンサー判定', '検索結果スポンサー根拠']) {
      if (HEADERS.includes(key)) {
        out[key] = merged[key] || '';
      }
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

  function markCurrentAsError(message) {
    const state = loadBatchState();
    const idx = findCurrentPendingIndex(state);
    if (idx < 0) return false;

    state.items[idx].status = 'error';
    state.items[idx].source = '';
    state.items[idx].error = String(message || 'error');
    state.items[idx].processedAt = nowText();
    state.items[idx].record = null;
    saveBatchState(state);
    return true;
  }

  function buildBatchTsv(includeHeader = true) {
    const state = loadBatchState();
    const rows = state.items
      .filter(item => item.status === 'done' && item.record)
      .map(item => HEADERS.map(h => normalizeText(item.record[h])));

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
      const newState = {
        active: true,
        createdAt: nowText(),
        updatedAt: nowText(),
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

    const seedItems = (crawlState.seedUrls || []).map(url => makeItemFromUrl(url, {})).filter(Boolean);
    const collectedItems = mergeItemArrays(crawlState.collectedItems || [], []);
    const items = mergeItemArrays(seedItems, collectedItems);

    const shouldStartBatch = forceBatchStart !== null
      ? Boolean(forceBatchStart)
      : crawlState.mode === 'collect-and-start';

    const newBatchState = {
      active: shouldStartBatch,
      createdAt: nowText(),
      updatedAt: nowText(),
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
      setBatchStatus('コピー対象の成功データがありません', true);
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
      setBatchStatus('ダウンロード対象の成功データがありません', true);
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
    return anchorEl?.closest('[data-jk], .job_seen_beacon, .tapItem, li, [role="listitem"]') || null;
  }

  function collectSearchResultEntries() {
    const map = new Map();

    function addCandidate(anchorEl, href, jk = '') {
      const rawHref = normalizeUrl(href);
      if (!rawHref) return;
      if (!/^https:\/\/jp\.indeed\.com\//i.test(rawHref)) return;

      const jobKey = String(jk || getAnchorJobKey(anchorEl) || getJobKeyFromUrl(rawHref) || '').trim();
      const canonicalUrl = canonicalViewJobUrl(jobKey, rawHref);
      if (!canonicalUrl) return;

      const cardEl = getSearchResultCard(anchorEl);
      const searchMeta = mergeSearchMeta(
        {
          '検索結果元リンク': rawHref,
          '検索結果リンク種別': getSearchLinkType(rawHref),
          '検索結果スポンサー判定': '',
          '検索結果スポンサー根拠': ''
        },
        detectSearchSponsorMeta(anchorEl, cardEl, rawHref)
      );

      const item = makeItemFromUrl(canonicalUrl, searchMeta);
      if (!item) return;

      if (!map.has(item.urlKey)) {
        map.set(item.urlKey, item);
      } else {
        const prev = map.get(item.urlKey);
        prev.searchMeta = mergeSearchMeta(prev.searchMeta, item.searchMeta);
        map.set(item.urlKey, prev);
      }
    }

    document.querySelectorAll('[data-jk]').forEach(el => {
      const jk = (el.getAttribute('data-jk') || '').trim();
      if (!jk) return;
      const a = el.matches('a[href]') ? el : el.querySelector('a[href]');
      addCandidate(a, a ? a.href : '', jk);
    });

    document.querySelectorAll('a[href*="/viewjob?"], a[href*="/rc/clk"], a[href*="/pagead/"]').forEach(a => {
      addCandidate(a, a.href, '');
    });

    document.querySelectorAll('h2 a[href], [data-testid="jobTitle"] a[href], a[data-jk][href]').forEach(a => {
      const jk = (a.getAttribute('data-jk') || '').trim();
      addCandidate(a, a.href, jk);
    });

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
    const prevState = loadSearchCrawlState();

    const state = {
      active: true,
      mode: mode,
      createdAt: nowText(),
      updatedAt: nowText(),
      seedUrls: uniqueNormalizedUrls(seedUrls),
      collectedItems: prevState.collectedItems || [],
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

    while (Date.now() - start < timeoutMs) {
      const result = buildRecord();
      const elapsed = Date.now() - start;

      if (isGoodRecord(result.record, result.source, elapsed)) {
        return result;
      }

      await sleep(intervalMs);
    }

    throw new Error('求人データ取得タイムアウト');
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
      markCurrentAsError(err.message || String(err));
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
      const searchMeta = deriveSearchMetaFromUrl(canonicalUrl);
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
        createdAt: nowText(),
        updatedAt: nowText(),
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

      if (source === 'json') {
        setStatus(`データ検出OK(JSON): ${title}`);
      } else {
        setStatus(`データ検出OK(DOM簡易): ${title}`);
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
  console.log('Indeed Helper Batch Export: loaded');
})();

