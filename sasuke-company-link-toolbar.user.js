// ==UserScript==
// @name         Sasuke Company Link Toolbar Plus
// @namespace    http://tampermonkey.net/
// @version      1.6.0
// @description  サスケ企業詳細ページに各種業務ツールを追加。R360 Quickへの企業名・業界連携、ChatGPT・Geminiへのプロンプト自動入力にも対応
// @match        https://my.saaske.com/lead/cgi/*
// @match        https://chatgpt.com/*
// @match        https://tsicb.github.io/recruiting-competitiveness/*
// @match        https://tsicb.github.io/R360-Quick/*
// @match        https://gemini.google.com/*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/sasuke-company-link-toolbar.user.js
// @downloadURL  https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/sasuke-company-link-toolbar.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const COMPANY_SELECTOR = '#tg-dt_company';
  const ADDRESS_SELECTOR = '#tg-dt_add1';
  const COMPANY_URL_SELECTOR = '#a-dt_hp';
  const ATS_URL_SELECTOR = '#a-dt_data12';
  const EMPLOYEE_COUNT_SELECTOR = '#tg-dt_group_sb17';
  const COMPANY_ID_SELECTOR = '#tg-dt_data15';
  const PHONE_SELECTOR = '#tg-dt_tel';
  const INDUSTRY_SELECTOR = '#tg-dt_group_sb7';

  const TOOLBAR_ID = 'tm-sasuke-link-toolbar';
  const CLOUD_LINK_ID = 'tm-sasuke-cloud-link';
  const PERFORMANCE_ANALYSIS_BUTTON_ID = 'tm-sasuke-performance-analysis-button';
  const R360_QUICK_BUTTON_ID = 'tm-sasuke-r360-quick-button';
  const INDEED_LINK_ID = 'tm-sasuke-indeed-link';
  const JOB_MEDIA_BUTTON_ID = 'tm-sasuke-job-media-button';
  const JOB_MEDIA_MENU_ID = 'tm-sasuke-job-media-menu';
  const TEL_GUIDE_LINK_ID = 'tm-sasuke-tel-guide-link';
  const GPT_BUTTON_ID = 'tm-sasuke-gpt-button';
  const GPT_MENU_ID = 'tm-sasuke-gpt-menu';
  const TOAST_ID = 'tm-sasuke-toast';
  const STYLE_ID = 'tm-sasuke-links-style';

  const INDEED_BASE = 'https://jp.indeed.com/jobs';
  const KYUJINBOX_BASE = 'https://xn--pckua2a7gp15o89zb.com/adv/';
  const STANBY_BASE = 'https://jp.stanby.com/search';
  const CHATGPT_URL = 'https://chatgpt.com/';
  const GEMINI_URL = 'https://gemini.google.com/app';
  const CLOUD_STATION_URL = 'https://cloud-station1049.firebaseapp.com/';
  const TEL_APP_GUIDE_URL = 'https://tsicb.github.io/tel-app-guide/';
  const RECRUITING_COMPETITIVENESS_URL = 'https://tsicb.github.io/recruiting-competitiveness/';
  const PERFORMANCE_ANALYSIS_URL = 'https://tsicb.github.io/ti-idd-perf/';
  const R360_QUICK_URL = 'https://tsicb.github.io/R360-Quick/';
  const PERFORMANCE_DATA_FOLDER_PATH = 'K:\\天市事業\\public\\1049\\共有情報\\tenichiプラス\\indeedマージレポート\\output_dataset';

  // 添付いただいた Cloud Station 32px アイコンを埋め込み。外部画像ファイル不要で動きます。
  const CLOUD_STATION_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAeBSURBVEhLbVdtjFxVGX6e99w7M3fu7MzSpgu4iCSkMaBIolTAaAUtQmP1B3EXakR/CIE/GoKa+EWcStEQEn+o/Cgk+gPkYxsxQEgkIlFAUtfSlgiigIKhoZSFdj9m5+Pee97XH+femYU4ycnM3px73vN8vM85S2z4zM0tuP3753319669z8yK68xEjRrpYjOfM0OOWgxkAOrlMwBADNCZeRNZ7w9Xp/3LR/ffND8AACyYwzzH64YXAMwtmNs/T//Z7z24Od+0/QbP+pcUttU5l8IJVBQQADSYACABAkaWzxUmAKnIzApGPBoxf6K2duKOp67feghdE3Sp46Jzc+b276ffsefVy0etzfuQTH2gKADVDGYeRgBOwzcxKSphA5PnBpCgEIhjSBLDRoMi8mt7F3efugdmAsLY7Zp0u9TP3XpsZ6/VftisGWm+npszR5Im4LiQAAYAwgliAYw2YYGEEQYxU5pC6OJTpuhOLv1y8eqZb8wtmCPMeNme108fppv+nsf1TZYPPZw4iL0LWUA3GSahkBFAifC9qI0AqWaCImp34mj5jS8vXjV7n4C0vOG+b2m6yfJhAScuaBUorNBUGkIM5iqEQU8joQHhBs0BCmAiBM3lRW6Fi34y97OFhDt/dKB9Mj33ZYuTLdAhIMJQKOx0grDUkBNKg3HCBm0D5UYDBdByLgko4V3adPXlN3dJv7Hlg6zVZ6AjQMhgBpvQyLAYxKvSCqMvFFaA5lnOCxuz0kgKlmtQwijXNNScFc5tl0bNnxnVYqhQK1dWGpoQQg8DvNUaEk21olqnHUXTrUiSlvOEeZpxA6UQBrqFYa0xE6FFo1jPEqk1InMMDqwMUBqC9FDSZKrlxA/e0LUTd9ra2nd0beWnmq0djBoNujiiAhYcXEkyQWiltpSwgVHUdEKajc3yLoeaqYh3SYP1wdLev329M3vwus3XnzN46p7tz+255dBXO9uSwbEvwGEJ9QiAFUazSprKxaGYjUHljhCUHplQWlJMqGulTkbv3Pr0tTM3X/yr49++8De915+f+sSxJy/48VsX3rdyb6T6eM2fvCKiFZxqRxbVaAJfbd6kkqqkWQDAIB6AVpPGBvIqjcSxv/zSgetO++HH71rq+i0zt2eMzsglRiHS0un27pXklMUDV88eavRP/CC20QvOFydcq+2MKBFXCMO3MUSu1NxGSkNbqFCl4aBFdteOfQc7RT25OVsZevWZJ9Vg3kYnVzPX6Zz3sQeO3/CXa95/+8FdjQ9vff73p0e947dJo04Tp8G1VYCUwwEycK1xL40bnqARsHrnOYfoo9JMaVaAQmcSopHO4ry/roWr37btd0tHLnpkZfG1j3z6mwevPO27brSyz7VSUcBX7h23IQDpuVZJ77upgACivZZ38TJhBJUh7hQUAEIqvGgUt0f16fPX4+Y2/76Z2y9YOHpNK1q9WbP1Ao4S+rXS1wJS5zzAUtdSeAgsCK87Hr/2Q4dtuHJckikxaGaEGk2VpgTUkHnN+7mN1gc+R+ZifP7JnVvfNvU9RjGNFtaq5CtZrgqVCA0QOD8cmNbTr3zq5y9vqfv13SKDXKY7NTanBEkqbLbEmk1hMuXQTGI008TVUSscH97x8H9mEEcts9wgCLFa9i8cIN6ViVFSGjQlVQu1RqPdP3XLA5d97Yw/19968Zx41NtXG7x9IMlWjjTy5cPNbPVIki0fTocrR9Kiv8ilt7717Bdn712W1l40m5FBNWRyMFClKS+6uz/va8kDRX/NU+jG/UTCqCppKhytPxdBb1qcn34ivPb/P3N3LLRePfvSW4ZJemNR5IpwGgMh/AvX7kTsLf+W2+9Zu2pUa92f9dc8XCgaJhpUDICpS1pCMeTD3rEaiyWIN4gAUIACE6CIQG/x2dKZTrP+ilGsip4qWgs31YmwvvogL7nz37sG7bMeGWV9hUDCaVGeLCTUGQBVUoBGJBbVws1BAEOQREO2Q/0Q5nMPR0caVKRcx2BihXSmo9qJN+6WUdx4JSsGSgn2DpFV6uvK3hKKOhP1uSLrqY16qsNV1VFPddhTG62qjtYUmhscwyWg2vg4BsPdqSD/IfX/vvSKWPYvNBpqNK3OQdAAlL+r8ADESDGBQCgQiAmEIgKhVPepSa+HTZMeoEgxWkMjX/2D/Kl7aRH70S9c3YnRfLUrFZZn4yS84co+ZphjwtD4G81XIguhH/RUokCnJbXB+h8PfeacZwVdkyte++dd1nv76ajTiY2avfc8rHJzfOZSJ1qNC24Y1XwxGLVArRZJ1h8mlt9YWssIApff/eJp7yRnPKbtqfPy3qoZ4OGMJBheru5AE/RBs7JwiQrhwDYTNSXp0ilHHWaN7OT8kW1nPgQzEZCG7h4+ds25xzYvP3OJ6534tcSi7pR2xFbbIUmFSSpImoJmKkwSkWZT2EwEzaawmQrTMKSZijSbglbq2NkURa0p54r1v7ZPvnnJkW1nPjS3YA6klhkBoNsVdLsKAJ+8/+j5g1Z6pbdim5f6LBxQbKANgaNSt4p6AFBoDXSqK0a84HTw6NzFs492Ad34/8z/APhz/TYfEFbCAAAAAElFTkSuQmCC';

  const PENDING_PROMPT_KEY = 'tm_sasuke_pending_prompt';
  const PENDING_PROMPT_TS_KEY = 'tm_sasuke_pending_prompt_ts';
  const CHATGPT_AUTOFILL_PARAM = 'tm_sasuke_autofill';

  const PENDING_COMPETITIVENESS_KEY = 'tm_sasuke_pending_competitiveness';
  const PENDING_COMPETITIVENESS_TS_KEY = 'tm_sasuke_pending_competitiveness_ts';
  const COMPETITIVENESS_AUTOFILL_PARAM = 'tm_sasuke_competitiveness_autofill';

  const R360_PENDING_PROMPT_KEY = 'tm_r360_pending_prompt';
  const R360_PENDING_PROMPT_TS_KEY = 'tm_r360_pending_prompt_ts';
  const R360_PENDING_TARGET_KEY = 'tm_r360_pending_target';
  const R360_AUTOFILL_PARAM = 'tm_r360_autofill';

  const PROMPT_EXPIRE_MS = 3 * 60 * 1000;

  const PROMPT_TEMPLATES = {
    light: [
      '以下の企業について、採用提案の初期調査として簡潔に整理してください。',
      '',
      '企業名：{{companyName}}',
      '{{locationLine}}{{websiteLine}}{{atsUrlLine}}',
      '知りたい内容',
      '1. 会社概要',
      '2. 主な事業内容',
      '3. 主な募集職種',
      '4. 求職者にPRできそうな強み',
      '5. 最近のニュースや話題',
      '6. 不明点',
      '',
      '箇条書きで簡潔にまとめてください。'
    ].join('\n'),

    standard: [
      '以下の企業について、採用・求人提案に活用できるように調べて整理してください。',
      '',
      '企業名：{{companyName}}',
      '{{locationLine}}{{websiteLine}}{{atsUrlLine}}',
      '調べてほしい内容',
      '1. 会社概要',
      '2. 主な事業内容・サービス',
      '3. 採用ページや求人情報から見える主な募集職種',
      '4. 求職者にPRできそうな企業の強み',
      '5. 仕事内容の魅力として言い換えられそうなポイント',
      '6. 安定性・成長性の訴求材料',
      '7. 最近のニュースや話題',
      '8. 採用課題として想定される点',
      '9. 営業時に使えそうな提案切り口',
      '10. 情報が見つからない点、不明点',
      '',
      '出力ルール',
      '- 事実と推測を分ける',
      '- 箇条書きで簡潔にまとめる',
      '- 採用や求人原稿に使えそうな表現は、そのまま使える形で書く',
      '- 情報源が弱いものは断定しない'
    ].join('\n'),

    deep: [
      '以下の企業について、採用・営業提案に向けた深掘り調査をしてください。',
      '',
      '企業名：{{companyName}}',
      '{{locationLine}}{{websiteLine}}{{atsUrlLine}}',
      '調べてほしい内容',
      '1. 会社概要',
      '2. 主な事業内容・サービス',
      '3. 主な募集職種と採用ページの傾向',
      '4. 求職者向けに訴求できる強み',
      '5. 仕事内容の魅力化ポイント',
      '6. 競合と比べた差別化要素',
      '7. 安定性・成長性の材料',
      '8. 最近のニュース、IR、事業トピック',
      '9. 口コミや評判から見える傾向',
      '10. 想定される採用課題',
      '11. 営業時の提案切り口',
      '12. 次回接触時に確認すべき質問',
      '',
      '出力ルール',
      '- 事実と推測を分ける',
      '- 推測は理由も添える',
      '- 箇条書き中心で整理する',
      '- 求人訴求に転換できる表現は別枠でまとめる'
    ].join(String.fromCharCode(10)),

    diagnosisReport: [
      'あなたは、上場企業〜中堅企業向けに採用コンサルティングを行うプロの企業診断士兼採用戦略コンサルタントです。',
      '',
      '単なる求人分析ではなく、',
      '「経営視点」「採用実務視点」「競合比較」「現場運営視点」',
      'まで踏み込んだ高度な分析をしてください。',
      '',
      '特に以下を重視してください。',
      '',
      '▼レポートの形式とデザインについて',
      '・分析結果を診断レポートの形式で画像2枚で作成をお願いします。',
      '・テイストはプロの鑑定書のような形式でお願いします。',
      '・高解像度維持 ',
      '・文字が潰れないこと',
      '・診断日等の日付の記載は不要',
      '',
      '▼内容・情報・構成について',
      '・推測ではなく、公開情報・求人情報・市場データベースに基づく事実ベース',
      '・企業の現場課題まで踏み込む',
      '・良い点だけではなく、採用上の弱点・リスクも明示',
      '・抽象論ではなく、現場で使えるレベルまで具体化',
      '・競合との違いを明確化',
      '・経営層が見ても納得できるレベルで構造化',
      '・「なぜそう言えるのか」の根拠を明記',
      '・採用成功だけでなく、定着・教育・採用コストまで考慮',
      '・求職者視点だけでなく、企業運営視点で分析',
      '',
      '【対象企業】',
      '企業名：{{companyName}}',
      '企業HP：{{companyWebsite}}',
      '採用HP：{{recruitWebsite}}',
      '本社所在地：{{headOffice}}',
      '従業員数：{{employeeCount}}',
      '',
      '【分析してほしい内容】',
      '',
      '# ① 市場環境・競合分析',
      '',
      '▼市場環境',
      '・業界動向',
      '・人材市場動向',
      '・最低賃金や人口動態などの外部環境',
      '・今後想定される採用難易度上昇要因',
      '',
      '▼競合分析',
      '・主要競合企業',
      '・競合ごとの採用強み',
      '・競合が打ち出している訴求',
      '・競合が言っていない訴求',
      '・応募が競合へ流れる理由',
      '',
      '▼エリア採用分析',
      '・採用しやすいエリア',
      '・採用しづらいエリア',
      '・その理由',
      '・店舗特性ごとの採用難易度',
      '（駅前・郊外・深夜帯・ロードサイド等）',
      '',
      '▼採用市場データ',
      '・平均時給',
      '・想定年収',
      '・競合数',
      '・有効求人倍率',
      '・人材獲得競争状況',
      '',
      '# ② 求人・採用力分析',
      '',
      '▼求人票分析',
      '競合と比較して、',
      '・魅力度',
      '・情報具体性',
      '・モバイル最適化',
      '・若年層訴求',
      '・働きやすさ訴求',
      '・キャリア訴求',
      'を100点満点で比較。',
      '',
      'また、',
      '「なぜその点数なのか」',
      'も説明してください。',
      '',
      '▼求職者分析',
      '・ターゲット層の検索ワード',
      '・求職者が重視しているポイント',
      '・競合との差分',
      '・穴場キーワード',
      '',
      '▼第一印象分析',
      '外部から見た際の、',
      '・ブランドイメージ',
      '・社風印象',
      '・働き方イメージ',
      '・求職者が不安に感じる点',
      'を客観的に分析。',
      '',
      '# ③ 自社ポジショニング分析',
      '',
      '▼採用3C分析',
      'Customer / Competitor / Company',
      'で整理。',
      '',
      '▼魅力マトリクス',
      '競合比較で、',
      '・給与',
      '・安定性',
      '・成長性',
      '・働きやすさ',
      '・地域密着',
      '・福利厚生',
      '・キャリア速度',
      'を比較。',
      '',
      '▼活躍人材分析',
      'どんな人が定着・活躍しやすいか。',
      '逆に離職しやすい人物傾向も分析。',
      '',
      '▼離職リスク分析',
      '・離職理由',
      '・現場負荷',
      '・教育負荷',
      '・店長依存',
      '・シフト問題',
      'などを分析。',
      '',
      '▼口コミ分析',
      '・良い評価と悪い評価をそれぞれ分析',
      '・ソース元はindeedや各種口コミサイト',
      '',
      '# ④ 改善提案',
      '',
      '▼独自USP',
      '競合が言っていない、',
      'かつこの企業が持つ独自価値を言語化。',
      '',
      '▼求人改善案',
      '改善前→改善後',
      'で具体例を提示。',
      '',
      '▼ペルソナ別訴求',
      '・若手',
      '・主婦',
      '・経験者',
      '・地元志向',
      'など。',
      '',
      '▼採用改善優先順位',
      '優先度A/B/Cで整理。',
      '',
      '▼経営視点での提言',
      '・今後の採用戦略',
      '・人材定着戦略',
      '・店舗運営リスク',
      '・中長期課題',
      'まで踏み込む。',
      '',
      '【出力ルール】',
      '・見出し付きで整理',
      '・図解風に構造化',
      '・プロの経営診断書レベル',
      '・事実ベース',
      '・良い点と悪い点を両方書く',
      '・具体的に',
      '・最後に総評を書く',
      '・ソース元を記載'
    ].join(String.fromCharCode(10))
  };

  const PROMPT_LABELS = {
    light: '軽い調査',
    standard: '標準調査',
    deep: '深掘り調査',
    diagnosisReport: '診断レポート'
  };

  const TOOL_MENU_LABELS = {
    recruitingCompetitiveness: '採用競争力・競合分析ツール'
  };

  let renderTimer = null;
  let lastHref = location.href;
  let toastTimer = null;

  function isTargetPage() {
    const url = new URL(location.href);
    const validPaths = ['/lead/cgi/index.cgi', '/lead/cgi/'];

    return (
      url.hostname === 'my.saaske.com' &&
      validPaths.includes(url.pathname) &&
      url.searchParams.get('task') === 'data' &&
      url.searchParams.get('action') === 'detail'
    );
  }

  function isChatGptPage() {
    return location.hostname === 'chatgpt.com';
  }

  function isRecruitingCompetitivenessPage() {
    return (
      location.hostname === 'tsicb.github.io' &&
      location.pathname.replace(/\/+$/, '') === '/recruiting-competitiveness'
    );
  }

  function isR360QuickPage() {
    return (
      location.hostname === 'tsicb.github.io' &&
      location.pathname.replace(/\/+$/, '') === '/R360-Quick'
    );
  }

  function isGeminiPage() {
    return location.hostname === 'gemini.google.com';
  }

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function getText(selector) {
    const el = document.querySelector(selector);
    return el ? normalizeText(el.textContent) : '';
  }

  function getHref(selector) {
    const el = document.querySelector(selector);
    return el && el.href ? el.href.trim() : '';
  }

  function normalizeUnicode(text) {
    try {
      return String(text || '').normalize('NFKC');
    } catch (e) {
      return String(text || '');
    }
  }

  function normalizeFieldLabel(text) {
    return normalizeUnicode(text)
      .split(' ').join('')
      .split('　').join('')
      .split('：').join('')
      .split(':').join('')
      .split('・').join('')
      .trim();
  }

  function isLikelyVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  }

  function labelMatches(text, labelCandidates) {
    const normalized = normalizeFieldLabel(text);
    if (!normalized) return false;

    return labelCandidates.some(label => {
      const normalizedLabel = normalizeFieldLabel(label);
      return normalized === normalizedLabel || normalized.includes(normalizedLabel);
    });
  }

  function getValueByLabel(labelCandidates) {
    const rows = Array.from(document.querySelectorAll('tr'));
    for (const row of rows) {
      if (!isLikelyVisible(row)) continue;
      const cells = Array.from(row.children).filter(isLikelyVisible);
      if (cells.length < 2) continue;

      for (let i = 0; i < cells.length - 1; i++) {
        if (labelMatches(cells[i].textContent, labelCandidates)) {
          const value = normalizeText(cells[i + 1].textContent);
          if (value) return value;
        }
      }
    }

    const dts = Array.from(document.querySelectorAll('dt'));
    for (const dt of dts) {
      if (!isLikelyVisible(dt)) continue;
      if (!labelMatches(dt.textContent, labelCandidates)) continue;

      const dd = dt.nextElementSibling;
      const value = dd ? normalizeText(dd.textContent) : '';
      if (value) return value;
    }

    const labels = Array.from(document.querySelectorAll('label, th, .label, .item-name, .title'));
    for (const labelEl of labels) {
      if (!isLikelyVisible(labelEl)) continue;
      if (!labelMatches(labelEl.textContent, labelCandidates)) continue;

      let sibling = labelEl.nextElementSibling;
      while (sibling) {
        const text = normalizeText(sibling.textContent);
        if (text) return text;
        sibling = sibling.nextElementSibling;
      }

      const parent = labelEl.parentElement;
      if (parent) {
        const parentChildren = Array.from(parent.children).filter(isLikelyVisible);
        const index = parentChildren.indexOf(labelEl);
        if (index >= 0 && parentChildren[index + 1]) {
          const parentValue = normalizeText(parentChildren[index + 1].textContent);
          if (parentValue) return parentValue;
        }
      }
    }

    return '';
  }

  function extractEmployeeCount() {
    const directEl = document.querySelector(EMPLOYEE_COUNT_SELECTOR);

    // サスケ側に専用項目が存在する場合は、その値だけを正とする。
    // 空欄の場合に汎用ラベル探索へ進むと、別項目の値を誤取得する可能性があるため、空欄のまま返す。
    if (directEl) return normalizeText(directEl.textContent);

    // 万一、画面仕様変更などで専用IDが存在しない場合のみ保険として探索する。
    return getValueByLabel(['法人従業員数', '法人従業員数稼働人数']);
  }

  function normalizeHyphen(text) {
    return text.replace(/[‐-–—−ー－―]/g, '-');
  }

  function stripPostalCode(text) {
    return text.replace(/〒?\s*\d{3}-?\d{4}\s*/g, '');
  }

  function stripParenInfo(text) {
    return text
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '');
  }

  function stripBuildingInfo(text) {
    let s = text;
    s = s.replace(/\s+(?:[^\s]*?(?:ビル|マンション|ハイツ|コーポ|タワー|レジデンス|センター|荘|館|棟|号室|室|階|F|f|階建)[^\s]*)$/u, '');
    s = s.replace(/[,\u3001，]\s*.*$/u, '');
    s = s.replace(/\s*\/\s*.*$/u, '');
    return s.trim();
  }

  function trimTrailingLotNumber(text) {
    let s = text;

    s = s.replace(/(\d+丁目)\s*\d+(?:-\d+)*$/u, '$1');
    s = s.replace(/(\d+丁目)\s*\d+番地?\d*(?:号)?$/u, '$1');
    s = s.replace(/(\d+丁目)\s*\d+番\d*(?:号)?$/u, '$1');

    s = s.replace(/([^\d-]+)\d+(?:-\d+){1,}$/u, '$1');
    s = s.replace(/([^\d-]+)\d+番地\d*(?:号)?$/u, '$1');
    s = s.replace(/([^\d-]+)\d+番\d*(?:号)?$/u, '$1');
    s = s.replace(/([^\d-]+)\d+号$/u, '$1');
    s = s.replace(/([^\d-]+)\d+$/u, '$1');

    return s.trim();
  }

  function normalizeAddressForIndeed(address) {
    let s = normalizeText(address);
    if (!s) return '';

    s = normalizeUnicode(s);
    s = normalizeHyphen(s);
    s = stripPostalCode(s);
    s = stripParenInfo(s);
    s = s.replace(/[　]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = stripBuildingInfo(s);
    s = s.replace(/\s*-\s*/g, '-');
    s = s.replace(/\s+/g, ' ').trim();
    s = trimTrailingLotNumber(s);
    s = s.replace(/[-\s]+$/g, '').trim();

    return s;
  }

  function removeSpaces(text) {
    return String(text || '').replace(/[\s　]+/g, '');
  }

  function extractMunicipality(address) {
    let s = normalizeText(address);
    if (!s) return '';

    s = normalizeUnicode(s);
    s = normalizeHyphen(s);
    s = stripPostalCode(s);
    s = stripParenInfo(s);
    s = s.replace(/[　]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = removeSpaces(s);

    // 都道府県を取得
    const prefMatch = s.match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/u);
    const pref = prefMatch ? prefMatch[1] : '';
    const rest = pref ? s.slice(pref.length) : s;

    if (!rest) return pref;

    // 政令指定都市など: 横浜市港北区 / 大阪市北区 / 京都市中京区
    let m = rest.match(/^(.+?市.+?区)/u);
    if (m) return pref + m[1];

    // 通常の市: 豊田市 / 八王子市
    m = rest.match(/^(.+?市)/u);
    if (m) return pref + m[1];

    // 東京23区など: 新宿区 / 千代田区
    m = rest.match(/^(.+?区)/u);
    if (m) return pref + m[1];

    // 郡 + 町村: 比企郡小川町 / 西多摩郡瑞穂町
    m = rest.match(/^(.+?郡.+?[町村])/u);
    if (m) return pref + m[1];

    // 町村
    m = rest.match(/^(.+?[町村])/u);
    if (m) return pref + m[1];

    return pref || s;
  }

  function buildRecruitingArea(address) {
    const municipality = extractMunicipality(address);
    return municipality ? `${municipality}周辺` : '';
  }

  function buildIndeedUrl(company, location) {
    const url = new URL(INDEED_BASE);
    url.searchParams.set('q', `company:${company}`);
    if (location) url.searchParams.set('l', location);
    return url.toString();
  }

  function normalizeLocationForKyujinBox(location) {
    // 求人ボックスでは住所中の小書き「ヶ」が地域名として認識されにくいため、
    // 求人ボックスへ渡す場合だけ通常サイズの「ケ」へ変換する。
    return String(location || '').replace(/ヶ/g, 'ケ');
  }

  function buildKyujinBoxUrl(company, location) {
    const url = new URL(KYUJINBOX_BASE);
    url.searchParams.set('keyword', `company:"${company}"`);
    const normalizedLocation = normalizeLocationForKyujinBox(location);
    if (normalizedLocation) url.searchParams.set('area', normalizedLocation);
    return url.toString();
  }

  function buildStanbyUrl(company, location) {
    const url = new URL(STANBY_BASE);
    url.searchParams.set('q', company);
    if (location) url.searchParams.set('l', location);
    return url.toString();
  }

  function buildJobMediaUrls(data) {
    return [
      { key: 'indeed', label: 'Indeed', url: buildIndeedUrl(data.company, data.location) },
      { key: 'kyujinbox', label: '求人ボックス', url: buildKyujinBoxUrl(data.company, data.location) },
      { key: 'stanby', label: 'スタンバイ', url: buildStanbyUrl(data.company, data.location) }
    ];
  }

  function buildPerformanceAnalysisUrl(companyId) {
    const url = new URL(PERFORMANCE_ANALYSIS_URL);
    url.searchParams.set('source', 'sasuke');
    if (companyId) url.searchParams.set('companyId', companyId);
    return url.toString();
  }

  function buildR360QuickUrl(data) {
    const url = new URL(R360_QUICK_URL);
    url.searchParams.set('source', 'sasuke');
    if (data.company) url.searchParams.set('company', data.company);
    if (data.industry) url.searchParams.set('industry', data.industry);
    return url.toString();
  }

  function collectData() {
    const company = getText(COMPANY_SELECTOR);
    const rawAddress = getText(ADDRESS_SELECTOR);
    const location = normalizeAddressForIndeed(rawAddress);
    const website = getHref(COMPANY_URL_SELECTOR);
    const atsUrl = getHref(ATS_URL_SELECTOR);
    const employeeCount = extractEmployeeCount();
    const companyId = getText(COMPANY_ID_SELECTOR);
    const industry = getText(INDUSTRY_SELECTOR);

    return {
      company,
      rawAddress,
      location,
      website,
      atsUrl,
      employeeCount,
      companyId,
      industry
    };
  }

  function buildPrompt(kind, data) {
    const template = PROMPT_TEMPLATES[kind] || PROMPT_TEMPLATES.standard;
    const locationLine = data.location ? `所在地：${data.location}\n` : '';
    const websiteLine = data.website ? `企業URL：${data.website}\n` : '';
    const atsUrlLine = data.atsUrl ? `採用URL：${data.atsUrl}\n` : '';

    return template
      .replace(/\{\{companyName\}\}/g, data.company || '')
      .replace(/\{\{locationLine\}\}/g, locationLine)
      .replace(/\{\{websiteLine\}\}/g, websiteLine)
      .split('{{atsUrlLine}}').join(atsUrlLine)
      .split('{{companyWebsite}}').join(data.website || '')
      .split('{{recruitWebsite}}').join(data.atsUrl || '')
      .split('{{headOffice}}').join(data.rawAddress || data.location || '')
      .split('{{employeeCount}}').join(data.employeeCount || '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TOOLBAR_ID} {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 6px;
        vertical-align: middle;
        position: relative;
      }

      .tm-sasuke-link-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border: 1px solid #c6d0da;
        border-radius: 5px;
        background: #ffffff;
        box-sizing: border-box;
        vertical-align: middle;
        text-decoration: none !important;
        cursor: pointer;
        box-shadow: 0 1px 1px rgba(0,0,0,0.05);
        transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.05s ease;
      }

      .tm-sasuke-link-btn:hover {
        background: #f2f7ff;
        border-color: #8fb0d8;
        box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      }

      .tm-sasuke-link-btn:active {
        transform: translateY(1px);
      }

      .tm-sasuke-link-btn svg,
      .tm-sasuke-link-btn img {
        width: 15px;
        height: 15px;
        display: block;
      }

      #${CLOUD_LINK_ID} {
        padding: 0;
        overflow: hidden;
      }

      #${CLOUD_LINK_ID} img {
        width: 19px;
        height: 19px;
      }

      .tm-sasuke-field-icon-link {
        float: right;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin: -1px 0 -1px 4px;
        padding: 0;
        border: 1px solid #b9c8d8;
        border-radius: 4px;
        background: #ffffff;
        box-sizing: border-box;
        text-decoration: none !important;
        cursor: pointer;
        box-shadow: 0 1px 1px rgba(0,0,0,0.05);
        transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.05s ease;
      }

      .tm-sasuke-field-icon-link:hover {
        background: #f2f7ff;
        border-color: #7ea6d6;
      }

      .tm-sasuke-field-icon-link:active {
        transform: translateY(1px);
      }

      .tm-sasuke-field-icon-link:focus-visible {
        outline: 2px solid #7aa7ff;
        outline-offset: 1px;
      }

      .tm-sasuke-field-icon-link svg {
        width: 14px;
        height: 14px;
        display: block;
      }

      #${GPT_BUTTON_ID} {
        width: 22px;
        height: 22px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        overflow: visible;
      }

      #${GPT_BUTTON_ID}:hover {
        background: transparent;
        border-color: transparent;
        box-shadow: none;
        transform: scale(1.08);
      }

      #${GPT_BUTTON_ID}:active {
        transform: scale(0.96);
      }

      #${GPT_BUTTON_ID}:focus-visible {
        outline: 2px solid #c084fc;
        outline-offset: 2px;
        border-radius: 4px;
      }

      #${GPT_BUTTON_ID} svg {
        width: 20px;
        height: 20px;
        display: block;
        filter: drop-shadow(0 1px 2px rgba(124, 58, 237, 0.22));
      }

      #${GPT_MENU_ID},
      #${JOB_MEDIA_MENU_ID} {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        min-width: 190px;
        padding: 6px;
        border: 1px solid #cfd8e3;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        z-index: 999999;
      }

      #${GPT_MENU_ID} {
        left: 28px;
        right: auto;
      }

      #${JOB_MEDIA_MENU_ID} {
        left: auto;
        right: 0;
      }

      #${GPT_MENU_ID}[hidden],
      #${JOB_MEDIA_MENU_ID}[hidden] {
        display: none !important;
      }

      .tm-sasuke-gpt-menu-separator {
        height: 1px;
        margin: 5px 4px;
        background: #e4eaf1;
      }

      .tm-sasuke-gpt-menu-item {
        display: block;
        width: 100%;
        margin: 0;
        padding: 8px 10px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #24313b;
        text-align: left;
        font-size: 12px;
        line-height: 1.4;
        cursor: pointer;
      }

      .tm-sasuke-gpt-menu-item:hover {
        background: #f3f7fc;
      }

      .tm-sasuke-gpt-menu-title {
        padding: 4px 8px 8px;
        color: #5a6b79;
        font-size: 11px;
        line-height: 1.3;
      }

      .tm-sasuke-gpt-menu-item strong {
        display: block;
        font-size: 12px;
        color: #22313c;
      }

      .tm-sasuke-gpt-menu-item span {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        color: #6b7c8b;
      }

      #${TOAST_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 999999;
        padding: 8px 12px;
        border: 1px solid #c6d0da;
        border-radius: 8px;
        background: rgba(255,255,255,0.98);
        color: #2c3a45;
        font-size: 12px;
        line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        opacity: 0;
        transform: translateY(8px);
        pointer-events: none;
        transition: opacity 0.18s ease, transform 0.18s ease;
      }

      #${TOAST_ID}.show {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
  }

  function createCloudStationIcon() {
    const img = document.createElement('img');
    img.src = CLOUD_STATION_ICON_DATA_URL;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    return img;
  }

  function createPerformanceAnalysisIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    const bar1 = document.createElementNS(svgNS, 'rect');
    bar1.setAttribute('x', '3');
    bar1.setAttribute('y', '15');
    bar1.setAttribute('width', '3.2');
    bar1.setAttribute('height', '6');
    bar1.setAttribute('rx', '0.8');
    bar1.setAttribute('fill', '#93c5fd');

    const bar2 = document.createElementNS(svgNS, 'rect');
    bar2.setAttribute('x', '8.2');
    bar2.setAttribute('y', '12');
    bar2.setAttribute('width', '3.2');
    bar2.setAttribute('height', '9');
    bar2.setAttribute('rx', '0.8');
    bar2.setAttribute('fill', '#60a5fa');

    const bar3 = document.createElementNS(svgNS, 'rect');
    bar3.setAttribute('x', '13.4');
    bar3.setAttribute('y', '9');
    bar3.setAttribute('width', '3.2');
    bar3.setAttribute('height', '12');
    bar3.setAttribute('rx', '0.8');
    bar3.setAttribute('fill', '#2563eb');

    const trend = document.createElementNS(svgNS, 'path');
    trend.setAttribute('d', 'M3.8 11.2L8.5 6.8L12.1 9.5L20 3.6');
    trend.setAttribute('fill', 'none');
    trend.setAttribute('stroke', '#1d4ed8');
    trend.setAttribute('stroke-width', '2');
    trend.setAttribute('stroke-linecap', 'round');
    trend.setAttribute('stroke-linejoin', 'round');

    const arrow = document.createElementNS(svgNS, 'path');
    arrow.setAttribute('d', 'M16.7 3.6H20V6.9');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', '#1d4ed8');
    arrow.setAttribute('stroke-width', '2');
    arrow.setAttribute('stroke-linecap', 'round');
    arrow.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(bar1);
    svg.appendChild(bar2);
    svg.appendChild(bar3);
    svg.appendChild(trend);
    svg.appendChild(arrow);
    return svg;
  }

  function createR360QuickIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    const ring = document.createElementNS(svgNS, 'path');
    ring.setAttribute('d', 'M18.7 7.2A8 8 0 1 0 19.8 14');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#1b4f8a');
    ring.setAttribute('stroke-width', '2.1');
    ring.setAttribute('stroke-linecap', 'round');

    const arrow = document.createElementNS(svgNS, 'path');
    arrow.setAttribute('d', 'M16.1 4.8L19.2 7.2L16.5 10');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', '#2563eb');
    arrow.setAttribute('stroke-width', '2.1');
    arrow.setAttribute('stroke-linecap', 'round');
    arrow.setAttribute('stroke-linejoin', 'round');

    const bar1 = document.createElementNS(svgNS, 'rect');
    bar1.setAttribute('x', '6.4');
    bar1.setAttribute('y', '13.8');
    bar1.setAttribute('width', '2.4');
    bar1.setAttribute('height', '4.1');
    bar1.setAttribute('rx', '0.6');
    bar1.setAttribute('fill', '#93c5fd');

    const bar2 = document.createElementNS(svgNS, 'rect');
    bar2.setAttribute('x', '10.4');
    bar2.setAttribute('y', '10.8');
    bar2.setAttribute('width', '2.4');
    bar2.setAttribute('height', '7.1');
    bar2.setAttribute('rx', '0.6');
    bar2.setAttribute('fill', '#60a5fa');

    const bar3 = document.createElementNS(svgNS, 'rect');
    bar3.setAttribute('x', '14.4');
    bar3.setAttribute('y', '8.2');
    bar3.setAttribute('width', '2.4');
    bar3.setAttribute('height', '9.7');
    bar3.setAttribute('rx', '0.6');
    bar3.setAttribute('fill', '#7c3aed');

    svg.appendChild(ring);
    svg.appendChild(arrow);
    svg.appendChild(bar1);
    svg.appendChild(bar2);
    svg.appendChild(bar3);
    return svg;
  }

  function createPhoneIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    const body = document.createElementNS(svgNS, 'path');
    body.setAttribute('d', 'M6.7 3.6C7.2 3.1 8.1 3.1 8.7 3.7L10.4 5.4C11 6 11.1 6.9 10.6 7.6L9.8 8.8C10.6 10.6 12 12 13.8 12.8L15 12C15.7 11.5 16.6 11.6 17.2 12.2L18.9 13.9C19.5 14.5 19.5 15.4 18.9 16L17.8 17.1C16.9 18 15.6 18.3 14.4 17.9C10.4 16.5 7.5 13.6 6.1 9.6C5.7 8.4 6 7.1 6.9 6.2L6.7 3.6Z');
    body.setAttribute('fill', '#2563eb');

    const ring1 = document.createElementNS(svgNS, 'path');
    ring1.setAttribute('d', 'M15.3 4.2C17.4 4.7 19.1 6.4 19.6 8.5');
    ring1.setAttribute('fill', 'none');
    ring1.setAttribute('stroke', '#60a5fa');
    ring1.setAttribute('stroke-width', '1.8');
    ring1.setAttribute('stroke-linecap', 'round');

    const ring2 = document.createElementNS(svgNS, 'path');
    ring2.setAttribute('d', 'M15.1 7.1C15.8 7.4 16.4 8 16.7 8.7');
    ring2.setAttribute('fill', 'none');
    ring2.setAttribute('stroke', '#93c5fd');
    ring2.setAttribute('stroke-width', '1.8');
    ring2.setAttribute('stroke-linecap', 'round');

    svg.appendChild(body);
    svg.appendChild(ring1);
    svg.appendChild(ring2);
    return svg;
  }

  function createIndeedLikeIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('aria-hidden', 'true');

    const blue = '#0a3ea8';

    const arc = document.createElementNS(svgNS, 'path');
    arc.setAttribute('d', 'M10 30 C14 14, 25 8, 39 8 C48 8, 55 11, 60 17');
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', blue);
    arc.setAttribute('stroke-width', '5');
    arc.setAttribute('stroke-linecap', 'round');

    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', '33');
    dot.setAttribute('cy', '24');
    dot.setAttribute('r', '7');
    dot.setAttribute('fill', blue);

    const stem = document.createElementNS(svgNS, 'rect');
    stem.setAttribute('x', '28.5');
    stem.setAttribute('y', '33');
    stem.setAttribute('width', '9');
    stem.setAttribute('height', '20');
    stem.setAttribute('rx', '4.5');
    stem.setAttribute('fill', blue);

    svg.appendChild(arc);
    svg.appendChild(dot);
    svg.appendChild(stem);

    return svg;
  }

  function createJobMediaSearchIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    const stroke = '#1769aa';

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '10.5');
    circle.setAttribute('cy', '10.5');
    circle.setAttribute('r', '5.5');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', stroke);
    circle.setAttribute('stroke-width', '2.2');

    const handle = document.createElementNS(svgNS, 'path');
    handle.setAttribute('d', 'M14.7 14.7L20 20');
    handle.setAttribute('fill', 'none');
    handle.setAttribute('stroke', stroke);
    handle.setAttribute('stroke-width', '2.4');
    handle.setAttribute('stroke-linecap', 'round');

    const dot1 = document.createElementNS(svgNS, 'circle');
    dot1.setAttribute('cx', '8.5');
    dot1.setAttribute('cy', '10.5');
    dot1.setAttribute('r', '1.1');
    dot1.setAttribute('fill', stroke);

    const dot2 = document.createElementNS(svgNS, 'circle');
    dot2.setAttribute('cx', '12.5');
    dot2.setAttribute('cy', '10.5');
    dot2.setAttribute('r', '1.1');
    dot2.setAttribute('fill', stroke);

    svg.appendChild(circle);
    svg.appendChild(handle);
    svg.appendChild(dot1);
    svg.appendChild(dot2);

    return svg;
  }

  function createAiSparkleIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    const defs = document.createElementNS(svgNS, 'defs');
    const grad = document.createElementNS(svgNS, 'linearGradient');
    grad.setAttribute('id', 'tm-ai-grad');
    grad.setAttribute('x1', '4');
    grad.setAttribute('y1', '4');
    grad.setAttribute('x2', '20');
    grad.setAttribute('y2', '20');

    const stop1 = document.createElementNS(svgNS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#7c3aed');

    const stop2 = document.createElementNS(svgNS, 'stop');
    stop2.setAttribute('offset', '55%');
    stop2.setAttribute('stop-color', '#a855f7');

    const stop3 = document.createElementNS(svgNS, 'stop');
    stop3.setAttribute('offset', '100%');
    stop3.setAttribute('stop-color', '#ec4899');

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    grad.appendChild(stop3);
    defs.appendChild(grad);
    svg.appendChild(defs);

    const bigSparkle = document.createElementNS(svgNS, 'path');
    bigSparkle.setAttribute(
      'd',
      'M12 2.3L13.9 8.1L19.7 10L13.9 11.9L12 17.7L10.1 11.9L4.3 10L10.1 8.1L12 2.3Z'
    );
    bigSparkle.setAttribute('fill', 'url(#tm-ai-grad)');

    const smallSparkle = document.createElementNS(svgNS, 'path');
    smallSparkle.setAttribute(
      'd',
      'M18.5 4.7L19.2 6.6L21.1 7.3L19.2 8L18.5 9.9L17.8 8L15.9 7.3L17.8 6.6L18.5 4.7Z'
    );
    smallSparkle.setAttribute('fill', '#f0abfc');

    svg.appendChild(bigSparkle);
    svg.appendChild(smallSparkle);

    return svg;
  }

  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }
    return toast;
  }

  function showToast(message) {
    const toast = ensureToast();
    toast.textContent = message;
    toast.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 1800);
  }

  async function copyToClipboard(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      return true;
    }

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  function removeToolbarIfExists() {
    const old = document.getElementById(TOOLBAR_ID);
    if (old) old.remove();

    const telGuide = document.getElementById(TEL_GUIDE_LINK_ID);
    if (telGuide) telGuide.remove();
  }

  function closeGptMenu() {
    const menu = document.getElementById(GPT_MENU_ID);
    if (menu) menu.hidden = true;
  }

  function closeJobMediaMenu() {
    const menu = document.getElementById(JOB_MEDIA_MENU_ID);
    if (menu) menu.hidden = true;
  }

  function toggleGptMenu() {
    const menu = document.getElementById(GPT_MENU_ID);
    if (!menu) return;
    const willOpen = menu.hidden;
    closeJobMediaMenu();
    menu.hidden = !willOpen;
  }

  function toggleJobMediaMenu() {
    const menu = document.getElementById(JOB_MEDIA_MENU_ID);
    if (!menu) return;
    const willOpen = menu.hidden;
    closeGptMenu();
    menu.hidden = !willOpen;
  }

  async function savePendingPrompt(prompt) {
    try {
      await GM_setValue(PENDING_PROMPT_KEY, prompt);
      await GM_setValue(PENDING_PROMPT_TS_KEY, Date.now());
      return true;
    } catch (e) {
      return false;
    }
  }

  async function clearPendingPrompt() {
    try {
      await GM_deleteValue(PENDING_PROMPT_KEY);
      await GM_deleteValue(PENDING_PROMPT_TS_KEY);
    } catch (e) {
      // noop
    }
  }

  async function savePendingCompetitivenessData(payload) {
    try {
      await GM_setValue(PENDING_COMPETITIVENESS_KEY, JSON.stringify(payload));
      await GM_setValue(PENDING_COMPETITIVENESS_TS_KEY, Date.now());
      return true;
    } catch (e) {
      return false;
    }
  }

  async function clearPendingCompetitivenessData() {
    try {
      await GM_deleteValue(PENDING_COMPETITIVENESS_KEY);
      await GM_deleteValue(PENDING_COMPETITIVENESS_TS_KEY);
    } catch (e) {
      // noop
    }
  }

  async function saveR360PendingPrompt(prompt, target) {
    try {
      await GM_setValue(R360_PENDING_PROMPT_KEY, prompt);
      await GM_setValue(R360_PENDING_PROMPT_TS_KEY, Date.now());
      await GM_setValue(R360_PENDING_TARGET_KEY, target);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function clearR360PendingPrompt() {
    try {
      await GM_deleteValue(R360_PENDING_PROMPT_KEY);
      await GM_deleteValue(R360_PENDING_PROMPT_TS_KEY);
      await GM_deleteValue(R360_PENDING_TARGET_KEY);
    } catch (e) {
      // noop
    }
  }

  async function handlePromptSelection(kind) {
    const latestData = collectData();
    if (!latestData.company) {
      showToast('企業名が取得できませんでした');
      closeGptMenu();
      return;
    }

    const prompt = buildPrompt(kind, latestData);
    const copied = await copyToClipboard(prompt);
    await savePendingPrompt(prompt);

    const url = new URL(CHATGPT_URL);
    url.searchParams.set(CHATGPT_AUTOFILL_PARAM, '1');

    window.open(url.toString(), '_blank', 'noopener,noreferrer');

    showToast(
      copied
        ? `「${PROMPT_LABELS[kind]}」をコピーしました`
        : 'ChatGPTを開きました'
    );
    closeGptMenu();
  }

  async function handleRecruitingCompetitivenessSelection() {
    const latestData = collectData();
    if (!latestData.company) {
      showToast('企業名が取得できませんでした');
      closeGptMenu();
      return;
    }

    const area = buildRecruitingArea(latestData.rawAddress || latestData.location);
    await savePendingCompetitivenessData({
      company: latestData.company,
      area,
      savedAt: Date.now()
    });

    const url = new URL(RECRUITING_COMPETITIVENESS_URL);
    url.searchParams.set(COMPETITIVENESS_AUTOFILL_PARAM, '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');

    showToast('採用競争力ツールを開きました');
    closeGptMenu();
  }

  function handlePerformanceAnalysisSelection() {
    const latestData = collectData();
    const url = buildPerformanceAnalysisUrl(latestData.companyId);
    const copyPromise = copyToClipboard(PERFORMANCE_DATA_FOLDER_PATH);

    // ポップアップブロックを避けるため、ユーザーのクリック処理中にタブを開く。
    window.open(url, '_blank', 'noopener,noreferrer');
    closeGptMenu();
    closeJobMediaMenu();

    Promise.resolve(copyPromise).then((copied) => {
      if (!copied) {
        showToast('運用実績分析を開きました（フォルダパスはコピーできませんでした）');
        return;
      }

      showToast(
        latestData.companyId
          ? '運用実績分析を開き、データフォルダのパスをコピーしました'
          : '企業IDが空欄のため通常分析で開き、データフォルダのパスをコピーしました'
      );
    });
  }

  function handleR360QuickSelection() {
    const latestData = collectData();
    if (!latestData.company) {
      showToast('企業名が取得できませんでした');
      return;
    }

    const url = buildR360QuickUrl(latestData);
    window.open(url, '_blank', 'noopener,noreferrer');
    closeGptMenu();
    closeJobMediaMenu();

    showToast(
      latestData.industry
        ? 'R360 Quickを企業名・業界付きで開きました'
        : 'R360 Quickを企業名付きで開きました（★業界は空欄です）'
    );
  }

  function ensureToolbar(companyEl) {
    let toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) {
      toolbar = document.createElement('span');
      toolbar.id = TOOLBAR_ID;
      companyEl.insertAdjacentElement('afterend', toolbar);
    }
    return toolbar;
  }

  function ensureCloudStationButton(toolbar) {
    let link = document.getElementById(CLOUD_LINK_ID);
    if (!link) {
      link = document.createElement('a');
      link.id = CLOUD_LINK_ID;
      link.className = 'tm-sasuke-link-btn';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.href = CLOUD_STATION_URL;
      link.title = 'Cloud Stationを開く';
      link.setAttribute('aria-label', link.title);
      link.appendChild(createCloudStationIcon());
      toolbar.appendChild(link);
    }
    return link;
  }

  function ensurePerformanceAnalysisButton(toolbar) {
    let button = document.getElementById(PERFORMANCE_ANALYSIS_BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = PERFORMANCE_ANALYSIS_BUTTON_ID;
      button.className = 'tm-sasuke-link-btn';
      button.type = 'button';
      button.title = 'この企業の運用実績分析を開く';
      button.setAttribute('aria-label', button.title);
      button.appendChild(createPerformanceAnalysisIcon());

      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        handlePerformanceAnalysisSelection();
      });

      toolbar.appendChild(button);
    }
    return button;
  }

  function ensureR360QuickButton(toolbar) {
    let button = document.getElementById(R360_QUICK_BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = R360_QUICK_BUTTON_ID;
      button.className = 'tm-sasuke-link-btn';
      button.type = 'button';
      button.title = 'R360 Quickを企業名・業界付きで開く';
      button.setAttribute('aria-label', button.title);
      button.appendChild(createR360QuickIcon());

      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        handleR360QuickSelection();
      });

      toolbar.appendChild(button);
    }
    return button;
  }

  function ensureTelGuideButtonInPhoneLabel() {
    const phoneEl = document.querySelector(PHONE_SELECTOR);
    const phoneRow = phoneEl ? phoneEl.closest('tr') : null;
    const phoneLabelCell = phoneRow ? phoneRow.querySelector('th') : null;
    if (!phoneLabelCell) return null;

    let link = document.getElementById(TEL_GUIDE_LINK_ID);
    if (!link) {
      link = document.createElement('a');
      link.id = TEL_GUIDE_LINK_ID;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.href = TEL_APP_GUIDE_URL;
      link.title = 'テレアポガイドを開く';
      link.setAttribute('aria-label', link.title);
      link.appendChild(createPhoneIcon());
    }

    link.className = 'tm-sasuke-field-icon-link';

    // 旧版で企業名横ツールバーに設置されていた場合も、ここで電話番号の項目名セルへ移動する。
    if (link.parentElement !== phoneLabelCell) {
      phoneLabelCell.appendChild(link);
    }

    return link;
  }

  function ensureJobMediaButton(toolbar) {
    let button = document.getElementById(JOB_MEDIA_BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = JOB_MEDIA_BUTTON_ID;
      button.className = 'tm-sasuke-link-btn';
      button.type = 'button';
      button.title = '求人媒体検索メニューを開く';
      button.setAttribute('aria-label', button.title);

      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleJobMediaMenu();
      });

      toolbar.appendChild(button);
    }

    // メニューの対象は3媒体だが、入口は従来どおり認識しやすいIndeed風アイコンとする。
    if (button.dataset.iconVersion !== 'indeed-like-v1') {
      button.replaceChildren(createIndeedLikeIcon());
      button.dataset.iconVersion = 'indeed-like-v1';
    }

    return button;
  }

  function ensureGptButton(toolbar) {
    let button = document.getElementById(GPT_BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = GPT_BUTTON_ID;
      button.className = 'tm-sasuke-link-btn';
      button.type = 'button';
      button.title = 'AI調査メニューを開く';
      button.setAttribute('aria-label', button.title);
      button.appendChild(createAiSparkleIcon());

      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleGptMenu();
      });

      toolbar.appendChild(button);
    }
    return button;
  }

  function createToolMenuItem(kind, description) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'tm-sasuke-gpt-menu-item';

    const strong = document.createElement('strong');
    strong.textContent = TOOL_MENU_LABELS[kind] || kind;

    const span = document.createElement('span');
    span.textContent = description;

    item.appendChild(strong);
    item.appendChild(span);

    item.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (kind === 'recruitingCompetitiveness') {
        handleRecruitingCompetitivenessSelection();
      }
    });

    return item;
  }

  function createMenuItem(kind, description) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'tm-sasuke-gpt-menu-item';

    const strong = document.createElement('strong');
    strong.textContent = PROMPT_LABELS[kind];

    const span = document.createElement('span');
    span.textContent = description;

    item.appendChild(strong);
    item.appendChild(span);

    item.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      handlePromptSelection(kind);
    });

    return item;
  }

  function openJobMediaUrl(url, label) {
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast(`${label}を開きました`);
    closeJobMediaMenu();
  }

  function openAllJobMediaUrls(urls) {
    urls.forEach((item) => {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    });
    showToast('3媒体を開きました');
    closeJobMediaMenu();
  }

  function createJobMediaMenuItem(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tm-sasuke-gpt-menu-item';

    const strong = document.createElement('strong');
    strong.textContent = item.label;

    const span = document.createElement('span');
    span.textContent = item.description || '';

    button.appendChild(strong);
    if (span.textContent) button.appendChild(span);

    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      const data = collectData();
      if (!data.company) {
        showToast('企業名が取得できませんでした');
        closeJobMediaMenu();
        return;
      }

      const urls = buildJobMediaUrls(data);
      if (item.key === 'all') {
        openAllJobMediaUrls(urls);
        return;
      }

      const selected = urls.find((urlItem) => urlItem.key === item.key);
      if (!selected) {
        showToast('リンクを生成できませんでした');
        closeJobMediaMenu();
        return;
      }

      openJobMediaUrl(selected.url, selected.label);
    });

    return button;
  }

  function ensureJobMediaMenu(toolbar) {
    let menu = document.getElementById(JOB_MEDIA_MENU_ID);
    if (!menu) {
      menu = document.createElement('div');
      menu.id = JOB_MEDIA_MENU_ID;
      menu.hidden = true;

      const title = document.createElement('div');
      title.className = 'tm-sasuke-gpt-menu-title';
      title.textContent = '求人媒体で検索';

      const separator = document.createElement('div');
      separator.className = 'tm-sasuke-gpt-menu-separator';

      menu.appendChild(title);
      menu.appendChild(createJobMediaMenuItem({ key: 'all', label: 'すべて開く（3媒体）', description: 'Indeed・求人ボックス・スタンバイ' }));
      menu.appendChild(separator);
      menu.appendChild(createJobMediaMenuItem({ key: 'indeed', label: 'Indeed', description: '企業名と所在地で検索' }));
      menu.appendChild(createJobMediaMenuItem({ key: 'kyujinbox', label: '求人ボックス', description: '企業名と所在地で検索' }));
      menu.appendChild(createJobMediaMenuItem({ key: 'stanby', label: 'スタンバイ', description: '企業名と所在地で検索' }));

      toolbar.appendChild(menu);
    }
    return menu;
  }

  function ensureGptMenu(toolbar) {
    let menu = document.getElementById(GPT_MENU_ID);
    if (!menu) {
      menu = document.createElement('div');
      menu.id = GPT_MENU_ID;
      menu.hidden = true;

      const title = document.createElement('div');
      title.className = 'tm-sasuke-gpt-menu-title';
      title.textContent = 'コピーして開くプロンプトを選択';

      menu.appendChild(title);
      menu.appendChild(createToolMenuItem('recruitingCompetitiveness', '企業名と採用エリアを入れて開く'));
      menu.appendChild(createMenuItem('light', 'まず会社の全体像を素早く把握'));
      menu.appendChild(createMenuItem('deep', '営業・提案向けに深めに整理'));
      menu.appendChild(createMenuItem('diagnosisReport', '画像2枚の採用戦略診断レポート'));

      toolbar.appendChild(menu);
    }
    return menu;
  }

  function renderLinks() {
    if (!isTargetPage()) {
      removeToolbarIfExists();
      return;
    }

    const companyEl = document.querySelector(COMPANY_SELECTOR);
    if (!companyEl) return;

    const data = collectData();
    if (!data.company) return;

    const toolbar = ensureToolbar(companyEl);

    ensureCloudStationButton(toolbar);
    ensurePerformanceAnalysisButton(toolbar);
    ensureR360QuickButton(toolbar);
    ensureGptButton(toolbar);
    ensureGptMenu(toolbar);
    ensureJobMediaButton(toolbar);
    ensureJobMediaMenu(toolbar);
    ensureTelGuideButtonInPhoneLabel();

    const oldIndeedBtn = document.getElementById(INDEED_LINK_ID);
    if (oldIndeedBtn) oldIndeedBtn.remove();
  }

  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      ensureStyle();
      renderLinks();
    }, 120);
  }

  function observeDom() {
    const observer = new MutationObserver(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
      }
      scheduleRender();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function watchUrlChange() {
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        scheduleRender();
      }
    }, 500);
  }

  function bindGlobalEvents() {
    document.addEventListener('click', function (event) {
      const toolbar = document.getElementById(TOOLBAR_ID);
      if (!toolbar) return;
      if (!toolbar.contains(event.target)) {
        closeGptMenu();
        closeJobMediaMenu();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeGptMenu();
        closeJobMediaMenu();
      }
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function dispatchNativeInput(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setTextareaValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');

    if (desc && typeof desc.set === 'function') {
      desc.set.call(el, value);
    } else {
      el.value = value;
    }

    dispatchNativeInput(el);
  }

  function setContentEditableValue(el, value) {
    el.focus();
    el.textContent = value;
    dispatchNativeInput(el);
  }

  function findComposer() {
    return (
      document.querySelector('#prompt-textarea') ||
      document.querySelector('textarea') ||
      document.querySelector('div[contenteditable="true"]')
    );
  }

  async function waitForComposer(timeoutMs = 15000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const el = findComposer();
      if (el) return el;
      await sleep(300);
    }

    return null;
  }

  function cleanupAutofillQueryParam() {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has(CHATGPT_AUTOFILL_PARAM)) return;
      url.searchParams.delete(CHATGPT_AUTOFILL_PARAM);
      history.replaceState(null, '', url.toString());
    } catch (e) {
      // noop
    }
  }

  async function autofillChatGptPromptIfNeeded() {
    if (!isChatGptPage()) return;

    const url = new URL(location.href);
    if (url.searchParams.get(CHATGPT_AUTOFILL_PARAM) !== '1') return;

    let prompt = '';
    let ts = 0;

    try {
      prompt = await GM_getValue(PENDING_PROMPT_KEY, '');
      ts = await GM_getValue(PENDING_PROMPT_TS_KEY, 0);
    } catch (e) {
      cleanupAutofillQueryParam();
      return;
    }

    if (!prompt) {
      cleanupAutofillQueryParam();
      return;
    }

    if (!ts || Date.now() - ts > PROMPT_EXPIRE_MS) {
      await clearPendingPrompt();
      cleanupAutofillQueryParam();
      return;
    }

    const composer = await waitForComposer();
    if (!composer) {
      cleanupAutofillQueryParam();
      return;
    }

    try {
      if (composer.matches('textarea')) {
        setTextareaValue(composer, prompt);
      } else if (composer.getAttribute('contenteditable') === 'true') {
        setContentEditableValue(composer, prompt);
      } else {
        setTextareaValue(composer, prompt);
      }

      composer.focus();
      await clearPendingPrompt();
    } catch (e) {
      // 自動入力に失敗しても clipboard 運用は残す
    }

    cleanupAutofillQueryParam();
  }

  async function getR360ExportPrompt() {
    try {
      const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
      if (pageWindow && typeof pageWindow.buildExportPrompt === 'function') {
        const prompt = pageWindow.buildExportPrompt();
        if (prompt) return String(prompt);
      }
    } catch (e) {
      // fallback below
    }

    const promptButton = document.querySelector('button[onclick*="openPrmModal"]');
    if (promptButton) promptButton.click();

    const start = Date.now();
    while (Date.now() - start < 5000) {
      const textarea = document.querySelector('#prm-textarea');
      if (textarea && textarea.value) {
        const overlay = document.querySelector('#prm-overlay');
        if (overlay) overlay.style.display = 'none';
        return textarea.value;
      }
      await sleep(100);
    }

    return '';
  }

  async function handleR360AiLaunch(target) {
    const prompt = await getR360ExportPrompt();
    if (!prompt) {
      showToast('プロンプトを生成できませんでした');
      return;
    }

    const copied = await copyToClipboard(prompt);
    await saveR360PendingPrompt(prompt, target);

    const baseUrl = target === 'gemini' ? GEMINI_URL : CHATGPT_URL;
    const url = new URL(baseUrl);
    url.searchParams.set(R360_AUTOFILL_PARAM, '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');

    const label = target === 'gemini' ? 'Gemini' : 'ChatGPT';
    showToast(copied ? `${label}を開き、プロンプトをコピーしました` : `${label}を開きました`);
  }

  function createR360AiButton(target, label, background) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `tm-r360-${target}-button`;
    button.className = 'btn-sm btn-primary';
    button.textContent = label;
    button.style.background = background;
    button.style.whiteSpace = 'nowrap';
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      handleR360AiLaunch(target);
    });
    return button;
  }

  function ensureR360AiButtons() {
    const promptButton = document.querySelector('button[onclick*="openPrmModal"]');
    if (!promptButton || !promptButton.parentElement) return false;

    let chatButton = document.getElementById('tm-r360-chatgpt-button');
    if (!chatButton) {
      chatButton = createR360AiButton(
        'chatgpt',
        '✦ ChatGPTで実行',
        'linear-gradient(135deg,#0f766e,#10a37f)'
      );
      promptButton.insertAdjacentElement('afterend', chatButton);
    }

    let geminiButton = document.getElementById('tm-r360-gemini-button');
    if (!geminiButton) {
      geminiButton = createR360AiButton(
        'gemini',
        '✦ Geminiで実行',
        'linear-gradient(135deg,#2563eb,#7c3aed)'
      );
      chatButton.insertAdjacentElement('afterend', geminiButton);
    }

    return true;
  }

  function cleanupR360AutofillQueryParam() {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has(R360_AUTOFILL_PARAM)) return;
      url.searchParams.delete(R360_AUTOFILL_PARAM);
      history.replaceState(null, '', url.toString());
    } catch (e) {
      // noop
    }
  }

  async function readR360PendingPrompt(expectedTarget) {
    let prompt = '';
    let ts = 0;
    let target = '';

    try {
      prompt = await GM_getValue(R360_PENDING_PROMPT_KEY, '');
      ts = await GM_getValue(R360_PENDING_PROMPT_TS_KEY, 0);
      target = await GM_getValue(R360_PENDING_TARGET_KEY, '');
    } catch (e) {
      return '';
    }

    if (!prompt || !ts || Date.now() - ts > PROMPT_EXPIRE_MS || target !== expectedTarget) {
      if (ts && Date.now() - ts > PROMPT_EXPIRE_MS) await clearR360PendingPrompt();
      return '';
    }

    return prompt;
  }

  function findGeminiComposer() {
    const selectors = [
      'rich-textarea div[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div.ql-editor[contenteditable="true"]',
      'textarea'
    ];

    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      const visible = elements.find((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      if (visible) return visible;
    }
    return null;
  }

  async function waitForGeminiComposer(timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = findGeminiComposer();
      if (el) return el;
      await sleep(300);
    }
    return null;
  }

  function setRichContentEditableValue(el, value) {
    el.focus();

    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('insertText', false, value);
    } catch (e) {
      el.textContent = value;
    }

    if (!normalizeText(el.textContent)) el.textContent = value;
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: value
    }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function autofillR360ChatGptPromptIfNeeded() {
    if (!isChatGptPage()) return false;

    const url = new URL(location.href);
    const hasParam = url.searchParams.get(R360_AUTOFILL_PARAM) === '1';
    const prompt = await readR360PendingPrompt('chatgpt');
    if (!prompt) {
      if (hasParam) cleanupR360AutofillQueryParam();
      return false;
    }

    const composer = await waitForComposer(20000);
    if (!composer) {
      cleanupR360AutofillQueryParam();
      return false;
    }

    try {
      if (composer.matches('textarea')) {
        setTextareaValue(composer, prompt);
      } else {
        setContentEditableValue(composer, prompt);
      }
      composer.focus();
      await clearR360PendingPrompt();
    } catch (e) {
      // clipboard fallback remains available
    }

    cleanupR360AutofillQueryParam();
    return true;
  }

  async function autofillR360GeminiPromptIfNeeded() {
    if (!isGeminiPage()) return false;

    const prompt = await readR360PendingPrompt('gemini');
    if (!prompt) {
      cleanupR360AutofillQueryParam();
      return false;
    }

    const composer = await waitForGeminiComposer();
    if (!composer) {
      cleanupR360AutofillQueryParam();
      return false;
    }

    try {
      if (composer.matches('textarea')) {
        setTextareaValue(composer, prompt);
      } else {
        setRichContentEditableValue(composer, prompt);
      }
      composer.focus();
      await clearR360PendingPrompt();
    } catch (e) {
      // clipboard fallback remains available
    }

    cleanupR360AutofillQueryParam();
    return true;
  }

  function setInputValueBySelector(selector, value) {
    const el = document.querySelector(selector);
    if (!el) return false;

    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');

    if (desc && typeof desc.set === 'function') {
      desc.set.call(el, value || '');
    } else {
      el.value = value || '';
    }

    dispatchNativeInput(el);
    return true;
  }

  async function waitForInput(selector, timeoutMs = 15000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(300);
    }

    return null;
  }

  function cleanupCompetitivenessAutofillQueryParam() {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has(COMPETITIVENESS_AUTOFILL_PARAM)) return;
      url.searchParams.delete(COMPETITIVENESS_AUTOFILL_PARAM);
      history.replaceState(null, '', url.toString());
    } catch (e) {
      // noop
    }
  }

  async function autofillRecruitingCompetitivenessIfNeeded() {
    if (!isRecruitingCompetitivenessPage()) return;

    const url = new URL(location.href);
    if (url.searchParams.get(COMPETITIVENESS_AUTOFILL_PARAM) !== '1') return;

    let payloadText = '';
    let ts = 0;

    try {
      payloadText = await GM_getValue(PENDING_COMPETITIVENESS_KEY, '');
      ts = await GM_getValue(PENDING_COMPETITIVENESS_TS_KEY, 0);
    } catch (e) {
      cleanupCompetitivenessAutofillQueryParam();
      return;
    }

    if (!payloadText || !ts || Date.now() - ts > PROMPT_EXPIRE_MS) {
      await clearPendingCompetitivenessData();
      cleanupCompetitivenessAutofillQueryParam();
      return;
    }

    let payload = {};
    try {
      payload = JSON.parse(payloadText);
    } catch (e) {
      await clearPendingCompetitivenessData();
      cleanupCompetitivenessAutofillQueryParam();
      return;
    }

    await waitForInput('#in-company');

    setInputValueBySelector('#in-company', payload.company || '');
    setInputValueBySelector('#in-area', payload.area || '');

    await clearPendingCompetitivenessData();
    cleanupCompetitivenessAutofillQueryParam();
  }

  function initSasukePage() {
    ensureStyle();
    renderLinks();
    observeDom();
    watchUrlChange();
    bindGlobalEvents();
  }

  function initR360QuickPage() {
    ensureStyle();
    ensureR360AiButtons();

    const observer = new MutationObserver(() => {
      ensureR360AiButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    if (isChatGptPage()) {
      const handledR360 = await autofillR360ChatGptPromptIfNeeded();
      if (!handledR360) await autofillChatGptPromptIfNeeded();
      return;
    }

    if (isGeminiPage()) {
      await autofillR360GeminiPromptIfNeeded();
      return;
    }

    if (isRecruitingCompetitivenessPage()) {
      await autofillRecruitingCompetitivenessIfNeeded();
      return;
    }

    if (isR360QuickPage()) {
      initR360QuickPage();
      return;
    }

    initSasukePage();
  }

  init();
})();

