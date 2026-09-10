// ==UserScript==
// @name         Indeed Helper Batch Export
// @namespace    http://tampermonkey.net/
// @version      2.4.1
// @description  現行Indeedの検索結果・求人詳細を取得し、営業向け・分析・フルTSVと項目定義TSVを出力
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
  const BATCH_STATE_KEY = 'tmIndeedBatchState_v6';
  const SEARCH_CRAWL_STATE_KEY = 'tmIndeedSearchCrawlState_v6';
  const PANEL_COLLAPSED_KEY = 'tmIndeedHelperPanelCollapsed_v1';
  const PROFILE_LABEL_KEY = 'tmIndeedHelperProfileLabel_v1';
  const SCHEMA_VERSION = 'indeed-current-2026-09-v6';
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
    '検索結果スポンサー明示',
    '検索結果スポンサー根拠',
    '検索結果新着表示',
    '検索結果HiringEvent',
    '検索時求人タイトル',
    '検索時会社名',
    '検索時勤務地',
    '検索時給与',
    '検索時求人メタ表示',
    '検索時タグ',
    '検索時スニペット',
    '検索時会社評価',
    '検索時返信率の高い企業表示',
    '検索カード属性JSON',
    '詳細HTML sponsored(raw)',
    'requestPath',
    '求人キー',
    '求人タイトル',
    'Indeed標準職種名',
    '言語',
    '国',
    '雇用形態表示',
    '雇用形態コード',
    'リモート求人',
    '詳細HiringEvent',
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
    'JSON-LD有効期限',
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
    'PR・アピール情報',
    '応募方法',
    '選考プロセス',
    'その他',
    '企業名詳細',
    '本社所在地',
    '業種',
    '代表者名',
    '代表電話番号',
    'semanticSegments JSON',
    '本文セクション分解ソース',
    '本文見出し抽出一覧',
    '本文見出し未対応一覧',
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

  // フルTSVは機械処理しやすい1行ヘッダーを維持し、元key・意味・注意事項は別の項目定義TSVで参照する。
  const FIELD_DEFINITION_HEADERS = [
    'No',
    'フルTSV列名',
    '元HTML・JSON key / DOM',
    'データソース',
    '型',
    '意味・用途',
    '注意事項',
    '解釈確度'
  ];

  const FIELD_DEFINITION_MAP = Object.freeze({
  "取得セッションID": {
    "rawKey": "（スクリプト派生）sessionId",
    "source": "Indeed Helper",
    "type": "文字列",
    "meaning": "同じ取得操作に属する求人をまとめるためのセッションID",
    "note": "Indeed本体の値ではない",
    "confidence": "高"
  },
  "クロール開始日時": {
    "rawKey": "（スクリプト派生）crawlStartedAt",
    "source": "Indeed Helper",
    "type": "日時",
    "meaning": "検索結果クロールを開始したローカル日時",
    "note": "Indeed本体の掲載時刻ではない",
    "confidence": "高"
  },
  "詳細取得日時": {
    "rawKey": "（スクリプト派生）nowText()",
    "source": "Indeed Helper",
    "type": "日時",
    "meaning": "各求人詳細を取得・解析したローカル日時",
    "note": "ページ生成時刻とは限らない",
    "confidence": "高"
  },
  "取得プロファイル": {
    "rawKey": "localStorage/GM: tmIndeedHelperProfileLabel_v1",
    "source": "Indeed Helper",
    "type": "文字列",
    "meaning": "比較実験用に利用者が任意設定する取得ラベル",
    "note": "個人情報を入れない運用を推奨",
    "confidence": "高"
  },
  "ログイン状態": {
    "rawKey": "loggedIn / isLoggedIn / saveJobButtonContainerModel.isLoggedIn",
    "source": "検索/詳細 _initialData",
    "type": "真偽値",
    "meaning": "取得時にIndeedへログインしていたか",
    "note": "検索ページと詳細ページで参照keyが異なる",
    "confidence": "高"
  },
  "取得URL": {
    "rawKey": "location.href（追跡パラメータ除去）",
    "source": "ブラウザURL",
    "type": "URL",
    "meaning": "実際に詳細取得に使用したURL",
    "note": "スクリプトでサニタイズ",
    "confidence": "高"
  },
  "canonical URL": {
    "rawKey": "link[rel=canonical] または jobKeyから生成",
    "source": "詳細HTML/派生",
    "type": "URL",
    "meaning": "求人の正規URL",
    "note": "jobKeyが取れる場合はviewjob?jk=...へ正規化",
    "confidence": "高"
  },
  "ページタイトル": {
    "rawKey": "document.title",
    "source": "詳細DOM",
    "type": "文字列",
    "meaning": "取得時のHTML title",
    "note": "表示用情報",
    "confidence": "高"
  },
  "検索URL": {
    "rawKey": "location.href（検索追跡パラメータ除去）",
    "source": "検索ページURL",
    "type": "URL",
    "meaning": "求人が観測された検索結果ページURL",
    "note": "検索結果由来でない求人は空欄",
    "confidence": "高"
  },
  "検索キーワード": {
    "rawKey": "URL q / parsedQ",
    "source": "検索URL/_initialData",
    "type": "文字列",
    "meaning": "検索時のwhatキーワード",
    "note": "検索結果分析の基準語",
    "confidence": "高"
  },
  "検索勤務地": {
    "rawKey": "URL l / parsedL",
    "source": "検索URL/_initialData",
    "type": "文字列",
    "meaning": "検索時のwhere勤務地",
    "note": "",
    "confidence": "高"
  },
  "検索半径": {
    "rawKey": "URL radius",
    "source": "検索URL",
    "type": "文字列",
    "meaning": "検索時の検索半径パラメータ",
    "note": "未指定は空欄",
    "confidence": "高"
  },
  "検索start値": {
    "rawKey": "URL start",
    "source": "検索URL",
    "type": "整数",
    "meaning": "検索結果ページのstartパラメータ",
    "note": "ページ番号そのものとは別",
    "confidence": "高"
  },
  "検索ページ番号": {
    "rawKey": "pageNum / pageNumber / startから派生",
    "source": "検索 _initialData/派生",
    "type": "整数",
    "meaning": "検索結果のページ番号",
    "note": "pageNum等が無い場合はstartから推定",
    "confidence": "高"
  },
  "検索総件数": {
    "rawKey": "totalJobCount / resultsInfoModel.totalNumResults / uniqueJobsCount",
    "source": "検索 _initialData",
    "type": "整数",
    "meaning": "その検索ページ取得時点でIndeedが返した総件数",
    "note": "ページ間で変動する場合がある",
    "confidence": "高"
  },
  "関連検索候補": {
    "rawKey": "relatedQueries[].query",
    "source": "検索 _initialData",
    "type": "配列(::)",
    "meaning": "検索結果ページ側で提示される関連検索候補",
    "note": "求人詳細のIndeed関連検索what/whereとは別",
    "confidence": "高"
  },
  "検索条件JSON": {
    "rawKey": "URLSearchParams（追跡系除外）",
    "source": "検索URL/派生",
    "type": "JSON",
    "meaning": "検索条件を再現するためのURLパラメータJSON",
    "note": "技術検証用",
    "confidence": "高"
  },
  "次ページURL": {
    "rawKey": "検索結果の次ページリンクhref",
    "source": "検索DOM",
    "type": "URL",
    "meaning": "取得時に観測した次ページURL",
    "note": "存在しない場合は空欄",
    "confidence": "高"
  },
  "ページ内表示順": {
    "rawKey": "検索カードDOM順",
    "source": "検索DOM/派生",
    "type": "整数",
    "meaning": "その検索ページ内で観測した求人カードの順番",
    "note": "Indeed内部rankとは断定しない",
    "confidence": "高"
  },
  "検索結果元リンク": {
    "rawKey": "a[data-jk] 等のhref",
    "source": "検索DOM",
    "type": "URL",
    "meaning": "検索カードから詳細へ遷移する元リンク",
    "note": "追跡リンクを含む場合がある",
    "confidence": "高"
  },
  "検索結果リンク種別": {
    "rawKey": "hrefパスから派生",
    "source": "検索DOM/派生",
    "type": "文字列",
    "meaning": "pagead/rc/clk/viewjob等のリンク種別",
    "note": "スポンサー判定とは別",
    "confidence": "高"
  },
  "検索結果スポンサー明示": {
    "rawKey": "カード内の「スポンサー/Sponsored」表示",
    "source": "検索DOM",
    "type": "真偽値",
    "meaning": "検索カード上でスポンサー表記が明示されたか",
    "note": "pageadリンクだけではTRUEにしない",
    "confidence": "高"
  },
  "検索結果スポンサー根拠": {
    "rawKey": "スポンサー明示テキスト等",
    "source": "検索DOM/派生",
    "type": "文字列",
    "meaning": "スポンサー明示判定に使った観測根拠",
    "note": "",
    "confidence": "高"
  },
  "検索結果新着表示": {
    "rawKey": "[data-testid=new-job-tag] / .jobTitle-newJob",
    "source": "検索DOM",
    "type": "真偽値",
    "meaning": "検索カードに新着表示があったか",
    "note": "",
    "confidence": "高"
  },
  "検索結果HiringEvent": {
    "rawKey": "a[data-hiring-event]",
    "source": "検索DOM",
    "type": "真偽値",
    "meaning": "検索カードがIndeed Hiring Event求人として示されるか",
    "note": "採用イベント機能との紐づきと推定",
    "confidence": "中"
  },
  "検索時求人タイトル": {
    "rawKey": ".jcs-JobTitle / a[data-jk]",
    "source": "検索DOM",
    "type": "文字列",
    "meaning": "検索カード上に表示された求人タイトル",
    "note": "詳細タイトルとの比較用",
    "confidence": "高"
  },
  "検索時会社名": {
    "rawKey": "[data-testid=company-name]",
    "source": "検索DOM",
    "type": "文字列",
    "meaning": "検索カード上の会社名",
    "note": "",
    "confidence": "高"
  },
  "検索時勤務地": {
    "rawKey": "[data-testid=text-location]",
    "source": "検索DOM",
    "type": "文字列",
    "meaning": "検索カード上の勤務地表示",
    "note": "",
    "confidence": "高"
  },
  "検索時給与": {
    "rawKey": ".salary-snippet-container",
    "source": "検索DOM",
    "type": "文字列",
    "meaning": "検索カード上の給与表示",
    "note": "",
    "confidence": "高"
  },
  "検索時求人メタ表示": {
    "rawKey": "ul.metadataContainer 内の給与以外の先頭表示",
    "source": "検索DOM",
    "type": "文字列",
    "meaning": "検索カードのメタ情報領域で先頭に見えていた表示",
    "note": "「正社員 +3」等。雇用形態専用ではない",
    "confidence": "高"
  },
  "検索時タグ": {
    "rawKey": ".jobsearch-JobCard-tag",
    "source": "検索DOM",
    "type": "配列(::)",
    "meaning": "検索カード上で表示されたタグ",
    "note": "詳細のIndeed表示タグとは別表示経路",
    "confidence": "高"
  },
  "検索時スニペット": {
    "rawKey": "[data-testid=belowJobSnippet] / .job-snippet",
    "source": "検索DOM",
    "type": "文字列",
    "meaning": "検索カード上の本文スニペット",
    "note": "現HTMLでは空欄になる求人も多い",
    "confidence": "高"
  },
  "検索時会社評価": {
    "rawKey": "[data-testid=holistic-rating]",
    "source": "検索DOM",
    "type": "数値/文字列",
    "meaning": "検索カード上の会社評価表示",
    "note": "",
    "confidence": "高"
  },
  "検索時返信率の高い企業表示": {
    "rawKey": "[data-testid=responsiveEmployer]",
    "source": "検索DOM",
    "type": "文字列",
    "meaning": "検索カード上の「返信率の高い企業」等の表示",
    "note": "数値responseRateとは別",
    "confidence": "高"
  },
  "検索カード属性JSON": {
    "rawKey": "data-ci/data-empn/data-hiring-event/IndeedApply等",
    "source": "検索DOM/派生",
    "type": "JSON",
    "meaning": "検索カードで観測した補助属性のraw保持",
    "note": "開発・検証用",
    "confidence": "高"
  },
  "詳細HTML sponsored(raw)": {
    "rawKey": "sponsored",
    "source": "詳細 _initialData",
    "type": "真偽値",
    "meaning": "詳細HTML側のsponsored raw値",
    "note": "検索結果スポンサー明示とは別。意味を過剰解釈しない",
    "confidence": "高"
  },
  "requestPath": {
    "rawKey": "requestPath",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "Indeed内部の詳細リクエストパス",
    "note": "追跡パラメータを除去して保持",
    "confidence": "高"
  },
  "求人キー": {
    "rawKey": "jobKey / jk",
    "source": "詳細 _initialData/URL",
    "type": "文字列",
    "meaning": "Indeed求人を識別するjobKey",
    "note": "主要結合キー",
    "confidence": "高"
  },
  "求人タイトル": {
    "rawKey": "jobInfoHeaderModel.jobTitle 等",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "求人詳細ページのタイトル",
    "note": "",
    "confidence": "高"
  },
  "Indeed標準職種名": {
    "rawKey": "jobInfoHeaderModel.jobNormTitle",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "詳細モデルに露出しているIndeed側の標準職種名フィールド",
    "note": "現行HTMLでは空欄が多い。旧normalizedtitleと同一とは限らない",
    "confidence": "中"
  },
  "言語": {
    "rawKey": "jobLanguage / language",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "求人言語",
    "note": "",
    "confidence": "高"
  },
  "国": {
    "rawKey": "jobCountry / country",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "求人の国情報",
    "note": "",
    "confidence": "高"
  },
  "雇用形態表示": {
    "rawKey": "jobMetadataHeaderModel.jobType / formattedJobTypes.content",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "詳細ページ側の雇用形態表示",
    "note": "JSON-LD employmentTypeとは別経路",
    "confidence": "高"
  },
  "雇用形態コード": {
    "rawKey": "employmentType",
    "source": "JSON-LD JobPosting",
    "type": "配列/文字列",
    "meaning": "JSON-LD上の雇用形態コード/値",
    "note": "",
    "confidence": "高"
  },
  "リモート求人": {
    "rawKey": "jobInfoHeaderModel.remoteLocation / remoteLocation",
    "source": "詳細 _initialData",
    "type": "真偽値",
    "meaning": "Indeed詳細モデル上のリモート求人フラグ",
    "note": "",
    "confidence": "高"
  },
  "詳細HiringEvent": {
    "rawKey": "isHiringEvent",
    "source": "詳細 _initialData",
    "type": "真偽値",
    "meaning": "詳細モデル上のIndeed Hiring Eventフラグ",
    "note": "採用イベント機能との紐づきと推定",
    "confidence": "中"
  },
  "インターン求人": {
    "rawKey": "japanInternshipJob",
    "source": "詳細 _initialData",
    "type": "真偽値",
    "meaning": "日本向けインターン求人フラグ",
    "note": "",
    "confidence": "高"
  },
  "会社名": {
    "rawKey": "jobInfoHeaderModel.companyName / semantic company-name",
    "source": "詳細 _initialData/semantic",
    "type": "文字列",
    "meaning": "求人の会社名",
    "note": "",
    "confidence": "高"
  },
  "求人本文内企業名": {
    "rawKey": "semantic label:company-name / 本文見出し",
    "source": "semantic/本文分解",
    "type": "文字列",
    "meaning": "求人本文側で抽出された企業名",
    "note": "ヘッダー会社名と異なる場合の比較用",
    "confidence": "高"
  },
  "親会社名": {
    "rawKey": "jobInfoHeaderModel.parentCompanyName",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "Indeedモデル上の親会社名",
    "note": "",
    "confidence": "高"
  },
  "会社ページURL": {
    "rawKey": "jobInfoHeaderModel.companyOverviewLink",
    "source": "詳細 _initialData",
    "type": "URL",
    "meaning": "Indeed会社ページURL",
    "note": "追跡パラメータを除去",
    "confidence": "高"
  },
  "会社口コミURL": {
    "rawKey": "companyReviewLink / companyReviewModel.*CompanyLink",
    "source": "詳細 _initialData",
    "type": "URL",
    "meaning": "Indeed会社口コミページURL",
    "note": "追跡パラメータを除去",
    "confidence": "高"
  },
  "企業評価": {
    "rawKey": "companyReviewModel.rating 等",
    "source": "詳細 _initialData",
    "type": "数値",
    "meaning": "Indeed上の企業評価値",
    "note": "",
    "confidence": "高"
  },
  "企業口コミ件数": {
    "rawKey": "companyReviewModel.count 等",
    "source": "詳細 _initialData",
    "type": "整数",
    "meaning": "Indeed上の企業口コミ件数",
    "note": "",
    "confidence": "高"
  },
  "返信率企業headline": {
    "rawKey": "responsiveEmployerModel.headline",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "返信率関連の見出し",
    "note": "",
    "confidence": "高"
  },
  "返信率企業description": {
    "rawKey": "responsiveEmployerModel.description",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "返信率関連の説明文",
    "note": "",
    "confidence": "高"
  },
  "responseRate": {
    "rawKey": "responsiveEmployerModel.responseRate",
    "source": "詳細 _initialData",
    "type": "数値",
    "meaning": "返信率モデルの数値",
    "note": "現HTMLでは空欄の場合が多い",
    "confidence": "高"
  },
  "averageResponseInDays": {
    "rawKey": "responsiveEmployerModel.averageResponseInDays",
    "source": "詳細 _initialData",
    "type": "数値",
    "meaning": "平均返信日数",
    "note": "現HTMLでは空欄の場合が多い",
    "confidence": "高"
  },
  "勤務地表示": {
    "rawKey": "jobInfoHeaderModel.formattedLocation / jobLocation",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "詳細ページ上の勤務地表示",
    "note": "",
    "confidence": "高"
  },
  "勤務地完全住所": {
    "rawKey": "semantic full-address / jobLocation.address.streetAddress",
    "source": "semantic/JSON-LD",
    "type": "文字列",
    "meaning": "取得できる範囲で最も詳細な住所",
    "note": "semanticを優先",
    "confidence": "高"
  },
  "郵便番号": {
    "rawKey": "jobLocation.address.postalCode",
    "source": "JSON-LD JobPosting",
    "type": "文字列",
    "meaning": "勤務地郵便番号",
    "note": "",
    "confidence": "高"
  },
  "都道府県": {
    "rawKey": "jobLocation.address.addressRegion",
    "source": "JSON-LD JobPosting",
    "type": "文字列",
    "meaning": "勤務地都道府県",
    "note": "",
    "confidence": "高"
  },
  "市区町村相当": {
    "rawKey": "jobLocation.address.addressLocality",
    "source": "JSON-LD JobPosting/派生",
    "type": "文字列",
    "meaning": "市区町村相当の住所要素",
    "note": "東京都で「東京江東区」等になる値は補正",
    "confidence": "高"
  },
  "streetAddress": {
    "rawKey": "jobLocation.address.streetAddress",
    "source": "JSON-LD JobPosting",
    "type": "文字列",
    "meaning": "JSON-LDのstreetAddress raw値",
    "note": "semanticの完全住所より粗い場合がある",
    "confidence": "高"
  },
  "国コード": {
    "rawKey": "jobLocation.address.addressCountry / jobCountry",
    "source": "JSON-LD/_initialData",
    "type": "文字列",
    "meaning": "勤務地の国コード",
    "note": "",
    "confidence": "高"
  },
  "緯度": {
    "rawKey": "jobLocation.geo.latitude 等",
    "source": "JSON-LD JobPosting",
    "type": "数値",
    "meaning": "勤務地緯度",
    "note": "",
    "confidence": "高"
  },
  "経度": {
    "rawKey": "jobLocation.geo.longitude 等",
    "source": "JSON-LD JobPosting",
    "type": "数値",
    "meaning": "勤務地経度",
    "note": "",
    "confidence": "高"
  },
  "勤務地備考": {
    "rawKey": "semantic label:work-location / 本文見出し",
    "source": "semantic/本文分解",
    "type": "文字列",
    "meaning": "勤務地に関する補足",
    "note": "",
    "confidence": "高"
  },
  "交通アクセス": {
    "rawKey": "semantic label:commute-info / 本文見出し",
    "source": "semantic/本文分解",
    "type": "文字列",
    "meaning": "交通アクセス情報",
    "note": "",
    "confidence": "高"
  },
  "給与テキスト": {
    "rawKey": "salaryInfoModel.salaryText",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "詳細ページ側の給与表示テキスト",
    "note": "",
    "confidence": "高"
  },
  "給与最小": {
    "rawKey": "salaryInfoModel.salaryMin / baseSalary.value.minValue",
    "source": "_initialData/JSON-LD",
    "type": "数値",
    "meaning": "給与レンジの最小値",
    "note": "-1等の負のsentinelは空欄化",
    "confidence": "高"
  },
  "給与最大": {
    "rawKey": "salaryInfoModel.salaryMax / baseSalary.value.maxValue",
    "source": "_initialData/JSON-LD",
    "type": "数値",
    "meaning": "給与レンジの最大値",
    "note": "「以上」型で上限不明の場合は空欄",
    "confidence": "高"
  },
  "給与通貨": {
    "rawKey": "salaryInfoModel.salaryCurrency / baseSalary.currency",
    "source": "_initialData/JSON-LD",
    "type": "文字列",
    "meaning": "給与通貨",
    "note": "",
    "confidence": "高"
  },
  "給与種別": {
    "rawKey": "salaryInfoModel.salaryType / baseSalary.value.unitText",
    "source": "_initialData/JSON-LD",
    "type": "文字列",
    "meaning": "時給・月給・年収等の給与単位",
    "note": "",
    "confidence": "高"
  },
  "給与ソース": {
    "rawKey": "salaryInfoModel.salarySource",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "給与値のIndeed内部ソース表現",
    "note": "意味はraw保持を優先",
    "confidence": "中"
  },
  "給与詳細": {
    "rawKey": "semantic label:pay / 本文見出し",
    "source": "semantic/本文分解",
    "type": "文字列",
    "meaning": "求人本文の給与詳細セクション",
    "note": "",
    "confidence": "高"
  },
  "給与例": {
    "rawKey": "semantic label:salary-example / 本文見出し",
    "source": "semantic/本文分解",
    "type": "文字列",
    "meaning": "月収例・年収例など",
    "note": "",
    "confidence": "高"
  },
  "掲載日時": {
    "rawKey": "datePosted / datePublished",
    "source": "JSON-LD/_initialData",
    "type": "日時",
    "meaning": "Indeed側で観測できる掲載日時",
    "note": "再掲載や内部更新の意味までは断定しない",
    "confidence": "高"
  },
  "掲載経過表示": {
    "rawKey": "jobMetadataFooterModel.age / relativeDate",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "「2日前」等の掲載経過表示",
    "note": "",
    "confidence": "高"
  },
  "JSON-LD有効期限": {
    "rawKey": "validThrough",
    "source": "JSON-LD JobPosting",
    "type": "日時",
    "meaning": "JobPosting構造化データの有効期限",
    "note": "実際の募集締切とは扱わない。取得時点に連動して動くケースを確認",
    "confidence": "高"
  },
  "募集終了判定": {
    "rawKey": "expiredJobMetadataModel / showExpiredHeader",
    "source": "詳細 _initialData/派生",
    "type": "真偽値",
    "meaning": "Indeed詳細ページで募集終了状態が示されているか",
    "note": "",
    "confidence": "高"
  },
  "Indeed掲載ソース": {
    "rawKey": "jobMetadataFooterModel.source",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "Indeed詳細下部等で示される掲載元/ソース",
    "note": "ATS・求人媒体比較に有用",
    "confidence": "高"
  },
  "originalJobLink": {
    "rawKey": "jobMetadataFooterModel.originalJobLink / originalJobLinkModel",
    "source": "詳細 _initialData",
    "type": "URL",
    "meaning": "元求人・掲載元へのリンク",
    "note": "HTMLに露出しない求人では空欄",
    "confidence": "高"
  },
  "IndeedApply有無": {
    "rawKey": "indeedApplyButtonContainer.*",
    "source": "詳細 _initialData/派生",
    "type": "真偽値",
    "meaning": "Indeed上の応募ボタン情報が存在するか",
    "note": "",
    "confidence": "高"
  },
  "directApply": {
    "rawKey": "directApply",
    "source": "JSON-LD JobPosting",
    "type": "真偽値",
    "meaning": "JSON-LD上のdirectApplyフラグ",
    "note": "",
    "confidence": "高"
  },
  "Applyボタン種別": {
    "rawKey": "indeedApplyButtonModel.buttonType",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "応募ボタン種別",
    "note": "",
    "confidence": "高"
  },
  "Apply表示テキスト": {
    "rawKey": "indeedApplyButtonModel.contentHtml",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "応募ボタンに表示される文言",
    "note": "HTMLタグ除去後",
    "confidence": "高"
  },
  "求人写真数": {
    "rawKey": "japanJobPhotosModel.urls.length",
    "source": "詳細 _initialData/派生",
    "type": "整数",
    "meaning": "求人写真URLの件数",
    "note": "",
    "confidence": "高"
  },
  "求人写真URL一覧": {
    "rawKey": "japanJobPhotosModel.urls[]",
    "source": "詳細 _initialData",
    "type": "配列(::)",
    "meaning": "求人写真URL一覧",
    "note": "",
    "confidence": "高"
  },
  "求人写真alt一覧": {
    "rawKey": "japanJobPhotosModel.altTexts[]",
    "source": "詳細 _initialData",
    "type": "配列(::)",
    "meaning": "求人写真altテキスト一覧",
    "note": "",
    "confidence": "高"
  },
  "企業ロゴURL": {
    "rawKey": "companyImages.logoUrl",
    "source": "詳細 _initialData",
    "type": "URL",
    "meaning": "企業ロゴ画像URL",
    "note": "",
    "confidence": "高"
  },
  "企業ヘッダー画像URL": {
    "rawKey": "companyImages.headerImageUrl",
    "source": "詳細 _initialData",
    "type": "URL",
    "meaning": "企業ヘッダー画像URL",
    "note": "",
    "confidence": "高"
  },
  "Indeed表示タグ": {
    "rawKey": "jobInfoModel.jobTagModel.tags[]",
    "source": "詳細 _initialData",
    "type": "配列(::)",
    "meaning": "詳細ページ上のIndeed表示タグ",
    "note": "occupation/attributeとは別",
    "confidence": "高"
  },
  "jobOccupations ID一覧": {
    "rawKey": "jobOccupations[]",
    "source": "詳細 _initialData",
    "type": "配列(::)",
    "meaning": "求人に紐づく内部occupation ID一覧",
    "note": "ラベルとの対応が常に露出するとは限らない",
    "confidence": "中"
  },
  "Indeed職種分類名一覧": {
    "rawKey": "oneGraphMatchComparison.occupationComparisons[].occupation.label",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "Indeed occupation taxonomy上の職種分類名",
    "note": "投稿側指定またはIndeed側付与の可能性がある",
    "confidence": "高"
  },
  "Indeed職種分類ID一覧": {
    "rawKey": "oneGraphMatchComparison.occupationComparisons[].occupation.suid",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "職種分類のSUID一覧",
    "note": "分類名と同順",
    "confidence": "高"
  },
  "occupationComparison JSON": {
    "rawKey": "oneGraphMatchComparison.occupationComparisons[]",
    "source": "OneGraph埋込データ",
    "type": "JSON",
    "meaning": "occupation比較情報のraw保持",
    "note": "matchType/jsProvenance等を含む",
    "confidence": "高"
  },
  "Indeed抽出属性名一覧": {
    "rawKey": "oneGraphMatchComparison.attributeComparisons[].attribute.label",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "Indeed求人属性/求人タグ相当の名称一覧",
    "note": "投稿側設定とIndeed自動抽出の両方があり得る。名称は互換性のため維持",
    "confidence": "高"
  },
  "Indeed抽出属性ID一覧": {
    "rawKey": "oneGraphMatchComparison.attributeComparisons[].attribute.suid",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "Indeed求人属性のSUID一覧",
    "note": "投稿側設定と自動抽出の両方があり得る",
    "confidence": "高"
  },
  "属性タイプID一覧": {
    "rawKey": "attributeComparisons[].attribute.profileAttributeTypeSuid",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "属性が属するプロフィール属性タイプSUID",
    "note": "",
    "confidence": "高"
  },
  "jobProvenance一覧": {
    "rawKey": "attributeComparisons[].jobProvenance",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "求人側属性の由来を示すraw値一覧",
    "note": "EXTRACTED等。厳密な全enum意味はraw保持",
    "confidence": "高"
  },
  "jobRequirementStrength一覧": {
    "rawKey": "attributeComparisons[].jobRequirementStrength",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "求人要件としての強度を示すraw値一覧",
    "note": "NONE等。厳密な全enum意味はraw保持",
    "confidence": "高"
  },
  "attributeComparison JSON": {
    "rawKey": "oneGraphMatchComparison.attributeComparisons[]",
    "source": "OneGraph埋込データ",
    "type": "JSON",
    "meaning": "attribute比較情報のraw保持",
    "note": "開発・検証用",
    "confidence": "高"
  },
  "jobFlair headline": {
    "rawKey": "jobFlairModel.headline 等",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "IndeedのjobFlair表示用見出し",
    "note": "意味は表示実験・機能に依存する可能性",
    "confidence": "中"
  },
  "jobFlair description": {
    "rawKey": "jobFlairModel.description 等",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "IndeedのjobFlair表示用説明",
    "note": "",
    "confidence": "高"
  },
  "jobFlair eligible": {
    "rawKey": "jobFlairModel.eligible 等",
    "source": "詳細 _initialData",
    "type": "真偽値",
    "meaning": "jobFlair対象可否フラグ",
    "note": "",
    "confidence": "高"
  },
  "Indeed関連検索what": {
    "rawKey": "related search links/query model の what",
    "source": "詳細 _initialData",
    "type": "配列(::)",
    "meaning": "詳細下部の関連検索what候補",
    "note": "同一jobKey照合で職種候補が旧normalizedtitleとほぼ完全一致。企業名候補等も混在する",
    "confidence": "高"
  },
  "Indeed関連検索where": {
    "rawKey": "related search links/query model の where",
    "source": "詳細 _initialData",
    "type": "配列(::)",
    "meaning": "詳細下部の関連検索where候補",
    "note": "同一求人では検索元キーワードによらず安定する傾向を観測",
    "confidence": "高"
  },
  "本文全文": {
    "rawKey": "jobInfoModel.sanitizedJobDescription / #jobDescriptionText",
    "source": "詳細 _initialData/DOM",
    "type": "文字列",
    "meaning": "求人本文全文",
    "note": "semanticが無くても本文自体は取得可能",
    "confidence": "高"
  },
  "仕事内容": {
    "rawKey": "semanticSegmentModels / 本文見出し「仕事内容」",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "仕事内容セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "求めている人材": {
    "rawKey": "semanticSegmentModels / 本文見出し「応募資格」等",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "応募資格・求める人材セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "勤務時間詳細": {
    "rawKey": "semanticSegmentModels / 本文見出し「勤務時間」等",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "勤務時間セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "勤務形態": {
    "rawKey": "semanticSegmentModels / 本文見出し「勤務形態」",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "勤務形態セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "休日休暇": {
    "rawKey": "semanticSegmentModels / 本文見出し「休日・休暇」等",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "休日・休暇セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "勤務地所在地": {
    "rawKey": "semantic full-address / 本文見出し「勤務地」",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "勤務地所在地セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "試用期間": {
    "rawKey": "semanticSegmentModels / 本文見出し「試用期間」",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "試用期間セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "待遇福利厚生": {
    "rawKey": "semanticSegmentModels / 本文見出し「待遇・福利厚生」等",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "待遇・福利厚生セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "社会保険": {
    "rawKey": "semanticSegmentModels / 本文見出し「社会保険」",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "社会保険セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "職場環境": {
    "rawKey": "semanticSegmentModels / 本文見出し「職場環境」",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "職場環境セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "PR・アピール情報": {
    "rawKey": "semanticLabel=employer-message / 本文見出し",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "PR・アピール情報",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "応募方法": {
    "rawKey": "semanticSegmentModels / 本文見出し「応募方法」",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "応募方法セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "選考プロセス": {
    "rawKey": "semanticSegmentModels / 本文見出し「選考手順」等",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "応募後・選考プロセス",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "その他": {
    "rawKey": "semanticSegmentModels / 本文見出し「その他」",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "その他セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "企業名詳細": {
    "rawKey": "semantic label:company-name / 本文見出し",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "本文内企業名セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "本社所在地": {
    "rawKey": "semantic label:company-location / 本文見出し",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "本社所在地セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "業種": {
    "rawKey": "semantic label:company-industry / 本文見出し",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "業種セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "代表者名": {
    "rawKey": "semantic label:company-president / 本文見出し",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "代表者名セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "代表電話番号": {
    "rawKey": "semantic label:contact-tel / 本文見出し",
    "source": "semantic/本文見出しフォールバック",
    "type": "文字列",
    "meaning": "代表電話番号セクション",
    "note": "semanticSegmentModelsを優先し、無い場合のみ明示見出し辞書で分解",
    "confidence": "高"
  },
  "semanticSegments JSON": {
    "rawKey": "semanticSegmentModels[]",
    "source": "詳細 _initialData",
    "type": "JSON",
    "meaning": "semantic segmentsのraw保持",
    "note": "開発・検証用",
    "confidence": "高"
  },
  "本文セクション分解ソース": {
    "rawKey": "（派生）semantic / explicit-heading / none",
    "source": "Indeed Helper",
    "type": "文字列",
    "meaning": "本文の項目分解に何を使ったか",
    "note": "semantic優先",
    "confidence": "高"
  },
  "本文見出し抽出一覧": {
    "rawKey": "sanitizedJobDescription内の明示見出し",
    "source": "本文解析/派生",
    "type": "配列(::)",
    "meaning": "本文見出しフォールバックで検出した見出し一覧",
    "note": "媒体差分の監視用",
    "confidence": "高"
  },
  "本文見出し未対応一覧": {
    "rawKey": "検出見出し - SECTION_MAP対応済み",
    "source": "本文解析/派生",
    "type": "配列(::)",
    "meaning": "辞書に未登録だった本文見出し一覧",
    "note": "新媒体対応の追加候補を発見する診断列",
    "confidence": "高"
  },
  "recentQueryString": {
    "rawKey": "recentQueryString",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "詳細ページモデルに残る直近検索文字列",
    "note": "ユーザー検索文脈。求人固有属性ではない",
    "confidence": "高"
  },
  "詳細到達検索what": {
    "rawKey": "recentApplySearch.what 等",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "詳細到達時の検索what文脈",
    "note": "ユーザー行動系",
    "confidence": "高"
  },
  "詳細到達検索where": {
    "rawKey": "recentApplySearch.where 等",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "詳細到達時の検索where文脈",
    "note": "ユーザー行動系",
    "confidence": "高"
  },
  "currentJobState": {
    "rawKey": "saveJobButtonContainerModel.currentJobState",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "保存求人等の現在状態",
    "note": "ログインユーザー依存",
    "confidence": "高"
  },
  "resume trafficLight": {
    "rawKey": "resumeEvaluationResult.trafficLightSignal",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "履歴書評価系のtrafficLight raw値",
    "note": "ユーザー依存。意味を断定しない",
    "confidence": "中"
  },
  "encouragement trafficLight": {
    "rawKey": "oneGraphMatchComparison.encouragementToApply.trafficLight",
    "source": "OneGraph埋込データ",
    "type": "文字列",
    "meaning": "応募促進判定のtrafficLight raw値",
    "note": "ユーザー依存の可能性が高い",
    "confidence": "中"
  },
  "encouragement score": {
    "rawKey": "oneGraphMatchComparison.encouragementToApply.score",
    "source": "OneGraph埋込データ",
    "type": "数値",
    "meaning": "応募促進判定のscore raw値",
    "note": "アルゴリズム意味は非公開",
    "confidence": "中"
  },
  "encouragement strategy": {
    "rawKey": "oneGraphMatchComparison.encouragementToApply.strategy",
    "source": "OneGraph埋込データ",
    "type": "文字列",
    "meaning": "応募促進判定のstrategy raw値",
    "note": "アルゴリズム意味は非公開",
    "confidence": "中"
  },
  "matchingSalary": {
    "rawKey": "salaryInfoModel.matchingSalary",
    "source": "詳細 _initialData",
    "type": "真偽値",
    "meaning": "給与がユーザー条件とマッチするかを示す可能性のあるフラグ",
    "note": "ユーザー依存",
    "confidence": "中"
  },
  "minimumPayPreferencePresent": {
    "rawKey": "salaryInfoModel.minimumPayPreferencePresent",
    "source": "詳細 _initialData",
    "type": "真偽値",
    "meaning": "ユーザー最低希望給与設定の有無",
    "note": "ユーザー依存",
    "confidence": "高"
  },
  "userMinimumPayAmount": {
    "rawKey": "salaryInfoModel.userMinimumPayAmount",
    "source": "詳細 _initialData",
    "type": "数値",
    "meaning": "ユーザー最低希望給与額",
    "note": "ユーザー依存。営業用では非出力",
    "confidence": "高"
  },
  "userMinimumPaySalaryType": {
    "rawKey": "salaryInfoModel.userMinimumPaySalaryType",
    "source": "詳細 _initialData",
    "type": "文字列",
    "meaning": "ユーザー最低希望給与の給与種別",
    "note": "ユーザー依存",
    "confidence": "高"
  },
  "attribute matchType一覧": {
    "rawKey": "attributeComparisons[].matchType",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "attribute比較のmatchType raw値",
    "note": "JOB_ONLY等。厳密な意味はraw保持",
    "confidence": "中"
  },
  "attribute jsProvenance一覧": {
    "rawKey": "attributeComparisons[].jsProvenance",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "attribute比較のjsProvenance raw値",
    "note": "厳密な意味はraw保持",
    "confidence": "中"
  },
  "occupation matchType一覧": {
    "rawKey": "occupationComparisons[].matchType",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "occupation比較のmatchType raw値",
    "note": "JOB_ONLY等。厳密な意味はraw保持",
    "confidence": "中"
  },
  "occupation jsProvenance一覧": {
    "rawKey": "occupationComparisons[].jsProvenance",
    "source": "OneGraph埋込データ",
    "type": "配列(::)",
    "meaning": "occupation比較のjsProvenance raw値",
    "note": "厳密な意味はraw保持",
    "confidence": "中"
  },
  "userContext JSON": {
    "rawKey": "ユーザー文脈関連フィールドから派生",
    "source": "詳細 _initialData/派生",
    "type": "JSON",
    "meaning": "検索・給与希望・マッチング等のユーザー文脈をまとめたraw JSON",
    "note": "営業用では非出力。個人識別情報は意図的に含めない",
    "confidence": "高"
  },
  "取得ステータス": {
    "rawKey": "（派生）major fields取得数",
    "source": "Indeed Helper",
    "type": "列挙",
    "meaning": "OK/PARTIAL/ERROR",
    "note": "スクリプト独自判定",
    "confidence": "高"
  },
  "取得エラー理由": {
    "rawKey": "（派生）解析/取得エラー",
    "source": "Indeed Helper",
    "type": "文字列",
    "meaning": "ERROR/PARTIALの理由",
    "note": "",
    "confidence": "高"
  },
  "詳細取得ソース": {
    "rawKey": "（派生）current-_initialData / error 等",
    "source": "Indeed Helper",
    "type": "文字列",
    "meaning": "どの解析経路で詳細データを取得したか",
    "note": "",
    "confidence": "高"
  },
  "_initialData有無": {
    "rawKey": "window._initialData / candidate roots",
    "source": "詳細HTML/派生",
    "type": "真偽値",
    "meaning": "解析可能な_initialData系rootが存在したか",
    "note": "",
    "confidence": "高"
  },
  "jobInfoWrapperModel有無": {
    "rawKey": "jobInfoWrapperModel",
    "source": "詳細 _initialData/派生",
    "type": "真偽値",
    "meaning": "jobInfoWrapperModelが存在したか",
    "note": "",
    "confidence": "高"
  },
  "salaryInfoModel有無": {
    "rawKey": "salaryInfoModel",
    "source": "詳細 _initialData/派生",
    "type": "真偽値",
    "meaning": "salaryInfoModelが存在したか",
    "note": "",
    "confidence": "高"
  },
  "semanticSegmentModels有無": {
    "rawKey": "semanticSegmentModels",
    "source": "詳細 _initialData/派生",
    "type": "真偽値",
    "meaning": "semanticSegmentModelsが存在したか",
    "note": "",
    "confidence": "高"
  },
  "JSON-LD JobPosting有無": {
    "rawKey": "script[type=application/ld+json] JobPosting",
    "source": "詳細HTML/派生",
    "type": "真偽値",
    "meaning": "JSON-LD JobPostingを取得できたか",
    "note": "",
    "confidence": "高"
  },
  "oneGraphMatchComparison有無": {
    "rawKey": "oneGraphMatchComparison",
    "source": "詳細 _initialData/派生",
    "type": "真偽値",
    "meaning": "OneGraph比較データが存在したか",
    "note": "",
    "confidence": "高"
  },
  "主要項目取得数": {
    "rawKey": "（派生）majorFields",
    "source": "Indeed Helper",
    "type": "整数",
    "meaning": "主要項目の取得数",
    "note": "取得ステータス判定に使用",
    "confidence": "高"
  },
  "全項目取得数": {
    "rawKey": "（派生）HEADERS非空セル数",
    "source": "Indeed Helper",
    "type": "整数",
    "meaning": "診断列を除く取得済み項目数",
    "note": "",
    "confidence": "高"
  },
  "取得スキーマVersion": {
    "rawKey": "SCHEMA_VERSION",
    "source": "Indeed Helper",
    "type": "文字列",
    "meaning": "このレコードを生成したスキーマバージョン",
    "note": "",
    "confidence": "高"
  }
});


  // 営業ユーザー向け。技術診断・JSON・ユーザー行動系を除き、競合原稿調査に必要な求人情報へ絞る。
  const SALES_RESEARCH_HEADERS = [
    '詳細取得日時',
    '検索キーワード',
    '検索勤務地',
    '検索半径',
    '検索内通し順位（観測）',
    '検索ページ番号',
    'ページ内表示順',
    '取得URL',
    '求人タイトル',
    'normalizedtitle相当',
    'Indeed職種分類名一覧',
    'Indeed抽出属性名一覧',
    'Indeed表示タグ',
    'Indeed関連検索what（raw）',
    '関連検索what補助候補',
    '会社名',
    '求人本文内企業名',
    '勤務地表示',
    '雇用形態表示',
    '給与テキスト',
    '掲載日時',
    '掲載経過表示',
    '検索結果新着表示',
    '検索時返信率の高い企業表示',
    'Indeed掲載ソース',
    'originalJobLink',
    '求人写真数',
    'TOP画像URL',
    '求人写真URL一覧',
    '企業ロゴURL',
    '仕事内容',
    '求めている人材',
    '勤務時間詳細',
    '勤務形態',
    '休日休暇',
    '給与詳細',
    '試用期間',
    '待遇福利厚生',
    '職場環境',
    'PR・アピール情報',
    '応募方法',
    '選考プロセス',
    'その他',
    '検索語一致タイプ',
    'タイトル検索語一致',
    'normalizedtitle相当検索語一致',
    'Indeed職種分類検索語一致',
    '仕事内容検索語一致',
    'リモート求人',
    'インターン求人',
    '検索結果リンク種別',
    '勤務地備考',
    '交通アクセス',
    '郵便番号',
    '都道府県',
    '市区町村相当',
    '緯度',
    '経度',
    '給与種別',
    '給与最小',
    '給与最大',
    '本社所在地',
    '業種',
    '代表者名',
    '代表電話番号',
    '会社ページURL',
    '会社口コミURL'
  ];

  // フルTSVとは別に、検索語と表示求人の関係を確認しやすい分析ビューを出力する。
  // マスターの取得項目は減らさず、ここでは必要列＋派生列だけを投影する。
  const SEARCH_DISPLAY_ANALYSIS_HEADERS = [
    '取得セッションID',
    '検索キーワード',
    '検索勤務地',
    '検索ページ番号',
    'ページ内表示順',
    '検索内通し順位（観測）',
    '求人キー',
    '求人タイトル',
    '会社名',
    '勤務地表示',
    '雇用形態表示',
    '給与テキスト',
    '掲載日時',
    '掲載経過表示',
    '検索結果新着表示',
    '検索結果スポンサー明示',
    '検索時返信率の高い企業表示',
    '検索時タグ',
    'Indeed職種分類名一覧',
    'Indeed抽出属性名一覧',
    'Indeed表示タグ',
    'Indeed関連検索what',
    '仕事内容',
    '求めている人材',
    'PR・アピール情報',
    '検索語一致タイプ',
    'タイトル検索語一致',
    '仕事内容検索語一致',
    '求めている人材検索語一致',
    'PR検索語一致',
    '本文全文検索語一致',
    'Indeed職種分類検索語一致',
    'Indeed抽出属性検索語一致',
    'Indeed表示タグ検索語一致',
    'Indeed関連検索what検索語一致',
    '検索時タグ検索語一致',
    '全文検索語出現回数',
    '全体トークン一致率'
  ];

  const SEARCH_MATCH_ANALYSIS_HEADERS = [
    '検索キーワード',
    '検索勤務地',
    '検索内通し順位（観測）',
    '検索ページ番号',
    'ページ内表示順',
    '求人キー',
    '求人タイトル',
    '会社名',
    '検索語一致タイプ',
    'タイトル検索語一致',
    '本文全文検索語一致',
    'Indeed職種分類検索語一致',
    'Indeed抽出属性検索語一致',
    'Indeed表示タグ検索語一致',
    'Indeed関連検索what検索語一致',
    '検索時タグ検索語一致',
    '全文検索語出現回数',
    '全体トークン一致率',
    'Indeed職種分類名一覧',
    'Indeed抽出属性名一覧'
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

  // semanticSegmentModels がない媒体・ATS系求人向け。
  // 本文に明示された見出しだけを標準列へ対応させ、文意からの推測分割は行わない。
  const BODY_SECTION_ALIASES = {
    '仕事内容': [
      '仕事内容', '職務内容', '業務内容', 'お仕事内容', '仕事内容詳細', '職務内容詳細'
    ],
    '求めている人材': [
      '求めている人材', '求める人材', '応募資格', '応募条件', '応募要件', '資格', '必要資格',
      '対象となる方', '経験・資格', '資格・経験'
    ],
    '勤務時間詳細': [
      '勤務時間詳細', '勤務時間', '就業時間', '勤務時間・曜日', '勤務日時'
    ],
    '勤務形態': [
      '勤務形態', '勤務体系', '勤務形態・シフト'
    ],
    '休日休暇': [
      '休日休暇', '休日・休暇', '休暇・休日', '休日', '休暇'
    ],
    '勤務地所在地': [
      '勤務地所在地', '勤務地', '勤務場所', '就業場所'
    ],
    '勤務地備考': [
      '勤務地備考', '勤務地補足'
    ],
    '交通アクセス': [
      '交通・アクセス', '交通アクセス', 'アクセス', '交通手段'
    ],
    '給与詳細': [
      '給与詳細', '給与', '給与・報酬', '給与・待遇', '賃金', '報酬'
    ],
    '給与例': [
      '給与例', '月収例', '年収例', '収入例'
    ],
    '試用期間': [
      '試用期間', '試用・研修期間', '試用期間・研修期間'
    ],
    '待遇福利厚生': [
      '待遇・福利厚生', '待遇福利厚生', '福利厚生', '待遇', '待遇・諸手当'
    ],
    '社会保険': [
      '社会保険', '加入保険'
    ],
    '職場環境': [
      '職場環境', '職場について', '職場情報'
    ],
    'PR・アピール情報': [
      'アピールポイント', 'PR', 'PRポイント', 'この仕事の魅力', 'おすすめポイント', 'インフォメーション'
    ],
    '応募方法': [
      '応募方法', '応募について', '応募'
    ],
    '選考プロセス': [
      '選考プロセス', '選考手順', '選考の流れ', '応募から採用まで', 'ご応募からの流れ',
      '応募後の流れ', '面接地'
    ],
    'その他': [
      'その他'
    ],
    '企業名詳細': [
      '企業名', '会社名', '勤務先名', '社名'
    ],
    '本社所在地': [
      '本社所在地', '会社所在地'
    ],
    '業種': [
      '業種'
    ],
    '代表者名': [
      '代表者名', '代表者'
    ],
    '代表電話番号': [
      '代表電話番号', 'お問い合わせ電話番号', '電話番号'
    ]
  };

  function normalizeBodyHeading(value) {
    return textify(value)
      .normalize('NFKC')
      .replace(/^\s*[\[［【〔＜<]\s*/, '')
      .replace(/\s*[\]］】〕＞>]\s*$/, '')
      .replace(/[：:]\s*$/, '')
      .replace(/[\s　]+/g, '')
      .trim();
  }

  const BODY_SECTION_ALIAS_LOOKUP = (() => {
    const map = new Map();
    for (const [canonical, aliases] of Object.entries(BODY_SECTION_ALIASES)) {
      for (const alias of aliases) {
        const key = normalizeBodyHeading(alias);
        if (key && !map.has(key)) map.set(key, canonical);
      }
    }
    return map;
  })();

  const BODY_SECTION_HEADING_PATTERNS = [
    { pattern: /選ばれる理由/, canonical: 'PR・アピール情報' }
  ];

  function lookupBodySectionCanonical(heading) {
    const key = normalizeBodyHeading(heading || '');
    if (!key) return '';
    const exact = BODY_SECTION_ALIAS_LOOKUP.get(key);
    if (exact) return exact;
    for (const rule of BODY_SECTION_HEADING_PATTERNS) {
      if (rule.pattern.test(key)) return rule.canonical;
    }
    return '';
  }

  function getFallbackBodyHtml(jobInfoModel, ld) {
    if (jobInfoModel?.sanitizedJobDescription) {
      return { html: String(jobInfoModel.sanitizedJobDescription), source: 'sanitizedJobDescription見出し' };
    }
    if (ld?.description) {
      return { html: String(ld.description), source: 'JSON-LD description見出し' };
    }
    const dom = document.querySelector('#jobDescriptionText');
    if (dom?.innerHTML) {
      return { html: dom.innerHTML, source: 'DOM#jobDescriptionText見出し' };
    }
    return { html: '', source: '' };
  }

  function bodyHtmlToMarkedText(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    const body = doc.body;
    if (!body) return '';

    const markerPrefix = '__TM_IH_HEADING__';
    const markerSuffix = '__TM_IH_END_HEADING__';

    body.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
      const heading = normalizeText(el.textContent || '');
      const marker = heading ? `\n${markerPrefix}${heading}${markerSuffix}\n` : '\n';
      el.replaceWith(doc.createTextNode(marker));
    });
    body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    body.querySelectorAll('p,div,li,tr,section').forEach(el => {
      if (el.nextSibling) el.appendChild(doc.createTextNode('\n'));
    });

    return normalizeMultiline(body.textContent || '');
  }

  function parseExplicitHeadingLine(line) {
    const raw = String(line || '').trim();
    if (!raw) return null;

    const marker = raw.match(/^__TM_IH_HEADING__(.*?)__TM_IH_END_HEADING__\s*(.*)$/);
    if (marker) {
      const heading = normalizeText(marker[1] || '');
      return { heading, remainder: normalizeMultiline(marker[2] || ''), explicit: true };
    }

    // [見出し] / ［見出し］ は媒体側の大区分として使われやすいため、
    // 未対応見出しでも前セクションを終える境界として扱う。
    const square = raw.match(/^\s*[\[［]\s*([^\]］]{1,60}?)\s*[\]］]\s*(?:[：:]\s*)?(.*)$/);
    if (square) {
      return {
        heading: normalizeText(square[1] || ''),
        remainder: normalizeMultiline(square[2] || ''),
        explicit: true,
        boundaryIfUnmapped: true
      };
    }

    // 【...】/＜...＞/〔...〕 は、会社名・小見出し・装飾にも頻繁に使われる。
    // 辞書に登録済みの見出しだけをセクション境界として扱い、未知のものは本文として残す。
    const decorated = raw.match(/^\s*(?:【\s*([^】]{1,60}?)\s*】|＜\s*([^＞]{1,60}?)\s*＞|<\s*([^>]{1,60}?)\s*>|〔\s*([^〕]{1,60}?)\s*〕)\s*(?:[：:]\s*)?(.*)$/);
    if (decorated) {
      const heading = normalizeText(decorated[1] || decorated[2] || decorated[3] || decorated[4] || '');
      if (lookupBodySectionCanonical(heading)) {
        return {
          heading,
          remainder: normalizeMultiline(decorated[5] || ''),
          explicit: true,
          boundaryIfUnmapped: false
        };
      }
    }

    // 「給与: ～」のような形式は、辞書に存在する見出しだけを認識する。
    const colon = raw.match(/^([^：:]{1,40})\s*[：:]\s*(.*)$/);
    if (colon && lookupBodySectionCanonical(colon[1] || '')) {
      return {
        heading: normalizeText(colon[1] || ''),
        remainder: normalizeMultiline(colon[2] || ''),
        explicit: true
      };
    }

    return null;
  }

  function extractExplicitBodySections(html) {
    const markedText = bodyHtmlToMarkedText(html);
    const partsByCanonical = new Map();
    const rawHeaders = [];
    const unmappedHeaders = [];
    let current = null;

    function finishCurrent() {
      if (!current?.canonical) {
        current = null;
        return;
      }
      const content = normalizeMultiline(current.lines.join('\n'));
      if (content) {
        if (!partsByCanonical.has(current.canonical)) partsByCanonical.set(current.canonical, []);
        partsByCanonical.get(current.canonical).push({ header: current.header, content });
      }
      current = null;
    }

    for (const rawLine of markedText.split('\n')) {
      const line = String(rawLine || '').trim();
      if (!line) {
        if (current?.canonical && current.lines.length && current.lines[current.lines.length - 1] !== '') {
          current.lines.push('');
        }
        continue;
      }

      const headingInfo = parseExplicitHeadingLine(line);
      if (headingInfo) {
        finishCurrent();
        const rawHeader = normalizeText(headingInfo.heading || '');
        if (rawHeader) rawHeaders.push(rawHeader);
        const canonical = lookupBodySectionCanonical(rawHeader);
        if (!canonical) {
          if (rawHeader) unmappedHeaders.push(rawHeader);
          current = null;
          continue;
        }
        current = { canonical, header: rawHeader, lines: [] };
        if (headingInfo.remainder) current.lines.push(headingInfo.remainder);
        continue;
      }

      if (current?.canonical) current.lines.push(line);
    }
    finishCurrent();

    const sections = {};
    for (const [canonical, parts] of partsByCanonical.entries()) {
      if (parts.length === 1) {
        sections[canonical] = parts[0].content;
      } else {
        sections[canonical] = parts
          .map(part => part.header ? `【${part.header}】\n${part.content}` : part.content)
          .join('\n\n');
      }
    }

    return {
      sections,
      rawHeaders: uniqueStrings(rawHeaders),
      unmappedHeaders: uniqueStrings(unmappedHeaders)
    };
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
      'employer-message','apply-method','apply-info','other','company-name','company-location','company-industry','company-president','contact-tel'
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

  function collectSemanticLabelText(bundle, semanticLabel) {
    const parts = [];
    for (const seg of getSemanticSegments(bundle)) {
      if ((seg?.semanticLabel || '') !== semanticLabel) continue;
      const header = normalizeText(seg?.header || '');
      const content = stripHtml(seg?.sanitizedContent || seg?.content || '');
      if (!content) continue;
      parts.push(header ? `【${header}】\n${content}` : content);
    }
    return parts.join('\n\n');
  }

  function normalizeSalaryBound(value) {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (Number.isFinite(n) && n < 0) return '';
    return value;
  }

  function normalizeJapaneseLocality(locality, region) {
    let loc = normalizeText(locality || '');
    const reg = normalizeText(region || '');
    if (!loc || !reg) return loc;

    const prefixes = [reg];
    const core = reg === '北海道' ? '北海道' : reg.replace(/[都府県]$/, '');
    if (core && core !== reg) prefixes.push(core);

    for (const prefix of prefixes.sort((a, b) => b.length - a.length)) {
      if (!prefix || !loc.startsWith(prefix) || loc.length <= prefix.length) continue;
      const rest = loc.slice(prefix.length).trim();
      // 京都市 / 大阪市のように都道府県名と市名が同じケースは削り過ぎない。
      if (rest.length >= 2 && /.+[市区町村郡]/.test(rest)) {
        loc = rest;
        break;
      }
    }
    return loc;
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
    const semanticSegments = getSemanticSegments(bundle);
    const fallbackBody = semanticSegments.length ? { html: '', source: '' } : getFallbackBodyHtml(jobInfoModel, ld);
    const explicitBody = semanticSegments.length || !fallbackBody.html
      ? { sections: {}, rawHeaders: [], unmappedHeaders: [] }
      : extractExplicitBodySections(fallbackBody.html);
    const bodySection = key => explicitBody.sections[key] || '';
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
    const fallbackLocationSection = bodySection('勤務地所在地');
    const semanticCompanyName = pickSegment(segMap, ['企業名', 'label:company-name']) || bodySection('企業名詳細');

    record['ログイン状態'] = boolText(body.loggedIn ?? root.loggedIn ?? body.saveJobButtonContainerModel?.isLoggedIn);
    record['canonical URL'] = getCanonicalUrl(bundle.jobKey);
    record['詳細HTML sponsored(raw)'] = boolText(body.sponsored ?? root.sponsored);
    record['requestPath'] = sanitizeRequestPath(body.requestPath || root.requestPath || '', bundle.jobKey);
    record['求人キー'] = bundle.jobKey || '';
    record['求人タイトル'] = bundle.jobTitle || '';
    record['Indeed標準職種名'] = header.jobNormTitle || '';
    record['言語'] = body.jobLanguage || body.language || root.jobLanguage || root.language || '';
    record['国'] = body.jobCountry || body.country || root.jobCountry || root.country || '';
    record['雇用形態表示'] = body?.jobInfoWrapperModel?.jobInfoModel?.jobMetadataHeaderModel?.jobType || sectioned?.formattedJobTypes?.content || '';
    record['雇用形態コード'] = Array.isArray(ld?.employmentType) ? joinValues(ld.employmentType) : (ld?.employmentType || '');
    record['リモート求人'] = boolText(header.remoteLocation ?? body.remoteLocation);
    record['詳細HiringEvent'] = boolText(body.isHiringEvent);
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
    record['市区町村相当'] = normalizeJapaneseLocality(address.addressLocality || '', address.addressRegion || '');
    record['streetAddress'] = address.streetAddress || '';
    record['国コード'] = address.addressCountry || body.jobCountry || '';
    record['緯度'] = geo.latitude ?? address.latitude ?? ldLocation.latitude ?? '';
    record['経度'] = geo.longitude ?? address.longitude ?? ldLocation.longitude ?? '';
    record['勤務地備考'] = pickSegment(segMap, ['勤務地備考', 'label:work-location']) || bodySection('勤務地備考');
    record['交通アクセス'] = pickSegment(segMap, ['交通・アクセス', 'label:commute-info']) || bodySection('交通アクセス');

    record['給与テキスト'] = salary.salaryText || '';
    record['給与最小'] = normalizeSalaryBound(salary.salaryMin ?? ldSalaryValue.minValue ?? ldSalaryValue.value ?? '');
    record['給与最大'] = normalizeSalaryBound(salary.salaryMax ?? ldSalaryValue.maxValue ?? ldSalaryValue.value ?? '');
    record['給与通貨'] = salary.salaryCurrency || ldSalary.currency || '';
    record['給与種別'] = salary.salaryType || ldSalaryValue.unitText || '';
    record['給与ソース'] = salary.salarySource || '';
    record['給与詳細'] = pickSegment(segMap, ['給与詳細', 'label:pay']) || bodySection('給与詳細');
    record['給与例'] = pickSegment(segMap, ['給与例', 'label:salary-example']) || bodySection('給与例');

    record['掲載日時'] = formatDateTime(ld?.datePosted || body.datePublished || root.datePublished);
    record['掲載経過表示'] = footer.age || footer.relativeDate || '';
    record['JSON-LD有効期限'] = formatDateTime(ld?.validThrough);
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

    const fullBodySource = getFallbackBodyHtml(jobInfoModel, ld);
    record['本文全文'] = stripHtml(fullBodySource.html || '');
    record['仕事内容'] = pickSegment(segMap, ['仕事内容', 'label:job-description']) || bodySection('仕事内容');
    record['求めている人材'] = pickSegment(segMap, ['求めている人材', '応募資格', 'label:qualification']) || bodySection('求めている人材');
    record['勤務時間詳細'] = pickSegment(segMap, ['勤務時間詳細', '勤務時間', 'label:work-hours']) || bodySection('勤務時間詳細');
    record['勤務形態'] = pickSegment(segMap, ['勤務形態', 'label:working-system']) || bodySection('勤務形態');
    record['休日休暇'] = pickSegment(segMap, ['休日休暇', 'label:holidays']) || bodySection('休日休暇');
    record['勤務地所在地'] = semanticFullAddress || fallbackLocationSection;
    record['試用期間'] = pickSegment(segMap, ['試用期間', 'label:probation-conditions']) || bodySection('試用期間');
    record['待遇福利厚生'] = pickSegment(segMap, ['待遇・福利厚生', '福利厚生', 'label:benefits']) || bodySection('待遇福利厚生');
    record['社会保険'] = pickSegment(segMap, ['社会保険', 'label:social-insurance']) || bodySection('社会保険');
    record['職場環境'] = pickSegment(segMap, ['職場環境', 'label:work-environment']) || bodySection('職場環境');
    record['PR・アピール情報'] = collectSemanticLabelText(bundle, 'employer-message') || bodySection('PR・アピール情報');
    record['応募方法'] = pickSegment(segMap, ['応募方法', 'label:apply-method']) || bodySection('応募方法');
    record['選考プロセス'] = pickSegment(segMap, ['選考プロセス', 'label:apply-info']) || bodySection('選考プロセス');
    record['その他'] = pickSegment(segMap, ['その他', 'label:other']) || bodySection('その他');
    record['企業名詳細'] = semanticCompanyName;
    record['本社所在地'] = pickSegment(segMap, ['本社所在地', 'label:company-location']) || bodySection('本社所在地');
    record['業種'] = pickSegment(segMap, ['業種', 'label:company-industry']) || bodySection('業種');
    record['代表者名'] = pickSegment(segMap, ['代表者名', 'label:company-president']) || bodySection('代表者名');
    record['代表電話番号'] = pickSegment(segMap, ['代表電話番号', 'お問い合わせ電話番号', 'label:contact-tel']) || bodySection('代表電話番号');
    record['semanticSegments JSON'] = semanticSegmentsJson(bundle);
    record['本文セクション分解ソース'] = semanticSegments.length
      ? 'semanticSegmentModels'
      : (Object.keys(explicitBody.sections).length ? fallbackBody.source : '');
    record['本文見出し抽出一覧'] = semanticSegments.length
      ? joinValues(semanticSegments.map(seg => normalizeText(seg?.header || '')).filter(Boolean))
      : joinValues(explicitBody.rawHeaders);
    record['本文見出し未対応一覧'] = semanticSegments.length ? '' : joinValues(explicitBody.unmappedHeaders);

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
    record['semanticSegmentModels有無'] = boolText(semanticSegments.length > 0);
    record['oneGraphMatchComparison有無'] = boolText(Boolean(bundle.oneGraphMatchComparison));

    const majorFields = ['求人キー','求人タイトル','会社名','勤務地表示','雇用形態表示','本文全文'];
    const majorCount = majorFields.filter(k => String(record[k] ?? '').trim() !== '').length;
    record['主要項目取得数'] = String(majorCount);

    const diagnosticKeys = new Set([
      '取得ステータス','取得エラー理由','詳細取得ソース','_initialData有無','jobInfoWrapperModel有無','salaryInfoModel有無',
      'semanticSegmentModels有無','JSON-LD JobPosting有無','oneGraphMatchComparison有無','本文セクション分解ソース','本文見出し抽出一覧',
      '本文見出し未対応一覧','主要項目取得数','全項目取得数','取得スキーマVersion'
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
    // 現行Indeedでは /pagead/ や sponTapItem がスポンサー専用とは限らないため、
    // URL/クラスだけではスポンサー判定しない。画面上の明示表示だけを true とする。
    const explicitReasons = [];

    const candidateEls = [
      cardEl?.querySelector('[data-testid*="sponsor" i]'),
      cardEl?.querySelector('[aria-label*="スポンサー"], [aria-label*="sponsored" i]'),
      cardEl?.querySelector('[class*="sponsor" i]')
    ].filter(Boolean);

    for (const el of candidateEls) {
      const text = normalizeText(`${el.getAttribute?.('aria-label') || ''} ${el.textContent || ''}`);
      if (/スポンサー|sponsored/i.test(text)) {
        explicitReasons.push('visible-label:sponsored');
        break;
      }
    }

    if (!explicitReasons.length) {
      const textNodes = Array.from(cardEl?.querySelectorAll('span, div') || []);
      const found = textNodes.some(el => {
        const text = normalizeText(el.textContent || '');
        return /^(スポンサー|Sponsored)$/i.test(text);
      });
      if (found) explicitReasons.push('visible-text:sponsored');
    }

    return {
      '検索結果スポンサー明示': explicitReasons.length ? 'true' : '',
      '検索結果スポンサー根拠': explicitReasons.join(ARRAY_SEP)
    };
  }

  function deriveSearchMetaFromUrl(rawUrl) {
    const norm = normalizeUrl(rawUrl);
    if (!norm) return {};
    const linkType = getSearchLinkType(norm);
    const base = {
      '検索結果元リンク': sanitizeSearchResultUrl(norm),
      '検索結果リンク種別': linkType,
      '検索結果スポンサー明示': '',
      '検索結果スポンサー根拠': ''
    };
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
      pageCount: 0,
      maxPages: 0
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
      searchMeta: mergeSearchMeta(
        /\/(?:pagead|rc\/clk)/i.test(new URL(norm).pathname) ? deriveSearchMetaFromUrl(norm) : {},
        searchMeta || {}
      )
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

  function normalizeForSearchMatch(value) {
    let text = String(value ?? '');
    try { text = text.normalize('NFKC'); } catch (e) {}
    return text.toLowerCase().replace(/[\u3000\s]+/g, ' ').trim();
  }

  function compactForSearchMatch(value) {
    return normalizeForSearchMatch(value).replace(/\s+/g, '');
  }

  function containsSearchQuery(text, query) {
    const q = normalizeForSearchMatch(query).replace(/^["'「『]+|["'」』]+$/g, '').trim();
    if (!q) return false;
    const hay = normalizeForSearchMatch(text);
    if (hay.includes(q)) return true;

    // 空白区切りの検索語でも、日本語本文内の連続表現を拾えるよう補助する。
    const compactQ = compactForSearchMatch(q);
    const compactHay = compactForSearchMatch(hay);
    return compactQ.length >= 2 && compactHay.includes(compactQ);
  }

  function countSearchQueryOccurrences(text, query) {
    const q = compactForSearchMatch(query).replace(/^["'「『]+|["'」』]+$/g, '');
    const hay = compactForSearchMatch(text);
    if (!q || !hay) return 0;
    let count = 0;
    let pos = 0;
    while (true) {
      const idx = hay.indexOf(q, pos);
      if (idx < 0) break;
      count += 1;
      pos = idx + Math.max(1, q.length);
    }
    return count;
  }

  function tokenizeSearchQuery(query) {
    const normalized = normalizeForSearchMatch(query)
      .replace(/["'「」『』（）()【】\[\],，、/／|｜]+/g, ' ')
      .trim();
    if (!normalized) return [];
    return uniqueStrings(
      normalized
        .split(/\s+/)
        .map(x => x.trim())
        .filter(Boolean)
        .filter(x => !/^(?:and|or|not)$/i.test(x))
    );
  }

  function searchContextKey(record) {
    let conditions = {};
    try {
      conditions = JSON.parse(String(record?.['検索条件JSON'] || '{}')) || {};
    } catch (e) {}
    if (isObject(conditions)) {
      delete conditions.start;
      delete conditions.vjk;
      delete conditions.from;
      delete conditions.tk;
      delete conditions.mobtk;
      delete conditions.vjs;
    }
    return safeJsonStringify({
      q: record?.['検索キーワード'] || '',
      l: record?.['検索勤務地'] || '',
      radius: record?.['検索半径'] || '',
      conditions
    });
  }

  function getSearchDerivedRows() {
    const state = loadBatchState();
    const rankByContext = new Map();
    const rows = [];

    for (const item of state.items || []) {
      if (!item?.record || !['done', 'error'].includes(item.status)) continue;
      const record = item.record;
      const query = String(record['検索キーワード'] || '').trim();
      const searchUrl = String(record['検索URL'] || '').trim();
      if (!query && !searchUrl) continue; // 単体取得・手動URL取得は検索分析から除外

      const contextKey = searchContextKey(record);
      const observedRank = (rankByContext.get(contextKey) || 0) + 1;
      rankByContext.set(contextKey, observedRank);

      const fields = {
        title: record['求人タイトル'] || record['検索時求人タイトル'] || '',
        jobDescription: record['仕事内容'] || '',
        qualification: record['求めている人材'] || '',
        pr: record['PR・アピール情報'] || '',
        body: record['本文全文'] || '',
        occupations: record['Indeed職種分類名一覧'] || '',
        attributes: record['Indeed抽出属性名一覧'] || '',
        indeedTags: record['Indeed表示タグ'] || '',
        relatedWhat: record['Indeed関連検索what'] || '',
        searchTags: record['検索時タグ'] || ''
      };

      const matches = {
        title: containsSearchQuery(fields.title, query),
        jobDescription: containsSearchQuery(fields.jobDescription, query),
        qualification: containsSearchQuery(fields.qualification, query),
        pr: containsSearchQuery(fields.pr, query),
        body: containsSearchQuery(fields.body, query),
        occupations: containsSearchQuery(fields.occupations, query),
        attributes: containsSearchQuery(fields.attributes, query),
        indeedTags: containsSearchQuery(fields.indeedTags, query),
        relatedWhat: containsSearchQuery(fields.relatedWhat, query),
        searchTags: containsSearchQuery(fields.searchTags, query)
      };

      let matchType = 'F_一致検出なし';
      if (matches.title) matchType = 'A_タイトル一致';
      else if (matches.body || matches.jobDescription || matches.qualification || matches.pr) matchType = 'B_原稿本文一致';
      else if (matches.occupations) matchType = 'C_Indeed職種分類一致';
      else if (matches.attributes || matches.indeedTags) matchType = 'D_Indeed属性・タグ一致';
      else if (matches.relatedWhat || matches.searchTags) matchType = 'E_関連検索・検索カード一致';

      const tokens = tokenizeSearchQuery(query);
      const combined = [
        fields.title,
        fields.body,
        fields.occupations,
        fields.attributes,
        fields.indeedTags,
        fields.relatedWhat,
        fields.searchTags
      ].join('\n');
      const matchedTokenCount = tokens.filter(token => containsSearchQuery(combined, token)).length;
      const tokenRatio = tokens.length ? matchedTokenCount / tokens.length : 0;

      rows.push(Object.assign({}, record, {
        '検索内通し順位（観測）': String(observedRank),
        '検索語一致タイプ': matchType,
        'タイトル検索語一致': boolText(matches.title),
        '仕事内容検索語一致': boolText(matches.jobDescription),
        '求めている人材検索語一致': boolText(matches.qualification),
        'PR検索語一致': boolText(matches.pr),
        '本文全文検索語一致': boolText(matches.body),
        'Indeed職種分類検索語一致': boolText(matches.occupations),
        'Indeed抽出属性検索語一致': boolText(matches.attributes),
        'Indeed表示タグ検索語一致': boolText(matches.indeedTags),
        'Indeed関連検索what検索語一致': boolText(matches.relatedWhat),
        '検索時タグ検索語一致': boolText(matches.searchTags),
        '全文検索語出現回数': String(countSearchQueryOccurrences(fields.body, query)),
        '全体トークン一致率': tokens.length ? tokenRatio.toFixed(3) : ''
      }));
    }

    return rows;
  }

  function buildProjectedTsv(headers, rows, includeHeader = true) {
    if (!rows?.length) return '';
    const lines = rows.map(row => headers.map(h => toTsvCell(row[h])).join('\t'));
    return includeHeader ? `${headers.join('\t')}\n${lines.join('\n')}` : lines.join('\n');
  }

  function splitRelatedWhat(raw) {
    const values = String(raw || '').split(ARRAY_SEP).map(x => x.trim()).filter(Boolean);
    return {
      normalizedTitleProxy: values[0] || '',
      relatedCandidates: values.slice(1).join(ARRAY_SEP)
    };
  }

  function firstPhotoUrl(raw) {
    return String(raw || '').split(ARRAY_SEP).map(x => x.trim()).filter(Boolean)[0] || '';
  }

  function getSalesResearchRows() {
    const derived = getSearchDerivedRows();
    const derivedByKey = new Map();
    derived.forEach(row => {
      const key = String(row['求人キー'] || row['canonical URL'] || row['取得URL'] || '');
      if (key) derivedByKey.set(key, row);
    });

    const state = loadBatchState();
    const rows = [];
    for (const item of state.items || []) {
      if (!item?.record || !['done', 'error'].includes(item.status)) continue;
      const base = item.record;
      const key = String(base['求人キー'] || base['canonical URL'] || base['取得URL'] || '');
      const row = derivedByKey.get(key) || base;
      const related = splitRelatedWhat(row['Indeed関連検索what']);
      const query = row['検索キーワード'] || '';
      rows.push(Object.assign({}, row, {
        'normalizedtitle相当': related.normalizedTitleProxy,
        'Indeed関連検索what（raw）': row['Indeed関連検索what'] || '',
        '関連検索what補助候補': related.relatedCandidates,
        'TOP画像URL': firstPhotoUrl(row['求人写真URL一覧']),
        'normalizedtitle相当検索語一致': query ? boolText(containsSearchQuery(related.normalizedTitleProxy, query)) : '',
        '検索語一致タイプ': row['検索語一致タイプ'] || '',
        'タイトル検索語一致': row['タイトル検索語一致'] || '',
        'Indeed職種分類検索語一致': row['Indeed職種分類検索語一致'] || '',
        '仕事内容検索語一致': row['仕事内容検索語一致'] || ''
      }));
    }
    return rows;
  }

  function buildSalesResearchTsv(includeHeader = true) {
    return buildProjectedTsv(SALES_RESEARCH_HEADERS, getSalesResearchRows(), includeHeader);
  }

  function buildSearchDisplayAnalysisTsv(includeHeader = true) {
    return buildProjectedTsv(SEARCH_DISPLAY_ANALYSIS_HEADERS, getSearchDerivedRows(), includeHeader);
  }

  function buildSearchMatchAnalysisTsv(includeHeader = true) {
    return buildProjectedTsv(SEARCH_MATCH_ANALYSIS_HEADERS, getSearchDerivedRows(), includeHeader);
  }

  function buildFieldDefinitionTsv(includeHeader = true) {
    const rows = HEADERS.map((header, index) => {
      const def = FIELD_DEFINITION_MAP[header] || {};
      return [
        String(index + 1),
        header,
        def.rawKey || '',
        def.source || '',
        def.type || '',
        def.meaning || '',
        def.note || '',
        def.confidence || ''
      ];
    });
    const lines = rows.map(row => row.map(toTsvCell).join('\t'));
    return includeHeader
      ? `${FIELD_DEFINITION_HEADERS.join('\t')}\n${lines.join('\n')}`
      : lines.join('\n');
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
      preferExistingProgress = true,
      freshSession = false
    } = options || {};

    if (freshSession) clearSearchCrawlState();

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

    if (freshSession) {
      setBatchStatus('手動URL一覧が空です。前回結果は変更していません', true);
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
      setSearchStatus(`検索結果収集を停止しました。${items.length}件をキュー化しました`);
      return;
    }

    if (shouldStartBatch) {
      setSearchStatus(`検索結果収集完了。${items.length}件をキュー化し、そのまま開始します`);
      setBatchStatus('全ページ収集が終わったので一括処理へ進みます');
      goToNextPending();
    } else {
      setSearchStatus(`検索結果収集完了。${items.length}件をキュー化しました`);
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

  async function copySalesResearch() {
    const tsv = buildSalesResearchTsv(true);
    if (!tsv) {
      setBatchStatus('検索結果由来の取得データがありません', true);
      return;
    }
    const ok = await copyText(tsv);
    if (ok) {
      setBatchStatus(`求人調査データをコピーしました（${SALES_RESEARCH_HEADERS.length}列）`);
    } else {
      console.log(tsv);
      setBatchStatus('求人調査データのコピーに失敗。コンソールへ出力しました', true);
    }
  }

  async function copySearchDisplayAnalysis() {
    const tsv = buildSearchDisplayAnalysisTsv(true);
    if (!tsv) {
      setBatchStatus('検索結果由来の取得データがありません', true);
      return;
    }
    const ok = await copyText(tsv);
    if (ok) {
      setBatchStatus(`検索表示分析TSVをコピーしました（${SEARCH_DISPLAY_ANALYSIS_HEADERS.length}列）`);
    } else {
      console.log(tsv);
      setBatchStatus('検索表示分析TSVのコピーに失敗。コンソールへ出力しました', true);
    }
  }

  async function copySearchMatchAnalysis() {
    const tsv = buildSearchMatchAnalysisTsv(true);
    if (!tsv) {
      setBatchStatus('検索結果由来の取得データがありません', true);
      return;
    }
    const ok = await copyText(tsv);
    if (ok) {
      setBatchStatus(`検索語マッチ分析TSVをコピーしました（${SEARCH_MATCH_ANALYSIS_HEADERS.length}列）`);
    } else {
      console.log(tsv);
      setBatchStatus('検索語マッチ分析TSVのコピーに失敗。コンソールへ出力しました', true);
    }
  }

  async function copyFieldDefinitions() {
    const tsv = buildFieldDefinitionTsv(true);
    const ok = await copyText(tsv);
    if (ok) {
      setBatchStatus(`項目定義TSVをコピーしました（${HEADERS.length}項目）`);
    } else {
      console.log(tsv);
      setBatchStatus('項目定義TSVのコピーに失敗。コンソールへ出力しました', true);
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
      '検索時求人メタ表示': employmentCandidates[0] || '',
      '検索時タグ': joinValues(tags),
      '検索時スニペット': snippet,
      '検索時会社評価': rating,
      '検索時返信率の高い企業表示': responsiveEmployer,
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
    if (!ta) return { added: 0, totalFound: 0, entries: [] };

    const entries = collectSearchResultEntries();
    if (!entries.length) return { added: 0, totalFound: 0, entries: [] };

    const beforeItems = parseUrlLines(ta.value);
    const beforeKeys = new Set(beforeItems.map(x => x.urlKey));

    ta.value = mergeUrlLines(ta.value, entries.map(x => x.inputUrl));
    ta.dataset.userEdited = '1';

    upsertCollectedSearchEntries(entries);

    const afterItems = parseUrlLines(ta.value);
    const added = afterItems.filter(x => !beforeKeys.has(x.urlKey)).length;

    return { added, totalFound: entries.length, entries };
  }

  function addEntriesToExistingBatch(entries) {
    const sourceEntries = Array.isArray(entries) ? entries : [];
    if (!sourceEntries.length) return { added: 0, pending: 0 };

    const state = loadBatchState();
    const startedAt = state.crawlStartedAt || state.createdAt || nowText();
    const sessionId = state.sessionId || makeSessionId();
    const profileLabel = state.profileLabel || getProfileLabel();
    const existingKeys = new Set((state.items || []).map(item => item.urlKey).filter(Boolean));
    let added = 0;

    if (!Array.isArray(state.items)) state.items = [];

    for (const src of sourceEntries) {
      const item = makeItemFromUrl(src?.inputUrl || src?.url || '', mergeSearchMeta({
        '取得セッションID': sessionId,
        'クロール開始日時': startedAt,
        '取得プロファイル': profileLabel
      }, src?.searchMeta || {}));
      if (!item || existingKeys.has(item.urlKey)) continue;
      state.items.push(item);
      existingKeys.add(item.urlKey);
      added += 1;
    }

    state.sessionId = sessionId;
    state.crawlStartedAt = startedAt;
    state.createdAt = state.createdAt || startedAt;
    state.profileLabel = profileLabel;
    state.active = state.items.some(item => item.status === 'pending');
    saveBatchState(state);

    return { added, pending: getBatchCounts(state).pending };
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

    const { added, totalFound, entries } = appendSearchResultUrlsToTextarea();
    if (!totalFound) {
      setSearchStatus('このページで求人リンクを検出できませんでした', true);
      return;
    }

    const batchAdd = addEntriesToExistingBatch(entries);
    refreshBatchInfo();
    refreshSearchInfo();

    if (!batchAdd.added) {
      setSearchStatus(`このページから ${totalFound}件検出しましたが、すべて取得済みです`);
      setBatchStatus('追加取得する新しい求人はありません');
      return;
    }

    setSearchStatus(`このページから ${totalFound}件検出 / URL一覧へ${added}件追加 / 未取得${batchAdd.added}件を追加取得します`);
    setBatchStatus(`追加取得を開始します（新規${batchAdd.added}件）`);
    goToNextPending();
  }

  function startCurrentSearchPageFresh() {
    if (!isSearchResultsPage()) {
      setSearchStatus('検索結果ページで実行してください', true);
      return;
    }
    const entries = collectSearchResultEntries();
    if (!entries.length) {
      setSearchStatus('このページから求人リンクを取得できませんでした', true);
      return;
    }
    clearBatchState();
    clearSearchCrawlState();
    const ta = document.querySelector(`#${PANEL_ID} textarea`);
    if (ta) { ta.value = ''; ta.dataset.userEdited = ''; }
    const startedAt = nowText();
    const sessionId = makeSessionId();
    const profileLabel = getProfileLabel();
    const items = entries.map(item => ({
      ...item,
      status: 'pending',
      source: '',
      error: '',
      processedAt: '',
      record: null,
      searchMeta: mergeSearchMeta({
        '取得セッションID': sessionId,
        'クロール開始日時': startedAt,
        '取得プロファイル': profileLabel
      }, item.searchMeta || {})
    }));
    saveBatchState({
      active: true,
      createdAt: startedAt,
      updatedAt: startedAt,
      sessionId,
      crawlStartedAt: startedAt,
      profileLabel,
      items
    });
    refreshBatchInfo();
    refreshSearchInfo();
    setSearchStatus(`このページの${items.length}件を新規取得します`);
    setBatchStatus('前回結果をクリアし、このページの求人取得を開始します');
    goToNextPending();
  }

  function startSelectedSearchRange() {
    const select = document.querySelector(`#${PANEL_ID} .tm-range-select`);
    const range = select ? select.value : '3';
    if (range === 'current') {
      startCurrentSearchPageFresh();
      return;
    }
    const maxPages = range === 'all' ? 0 : Math.max(1, Number(range) || 3);
    startFullSearchCrawl('collect-and-start', { fresh: true, maxPages });
  }

  function startFullSearchCrawl(mode, options = {}) {
    if (!isSearchResultsPage()) {
      setSearchStatus('検索結果ページで実行してください', true);
      return;
    }

    const { fresh = false, maxPages = 0 } = options || {};
    const ta = document.querySelector(`#${PANEL_ID} textarea`);

    if (fresh) {
      clearBatchState();
      clearSearchCrawlState();
      if (ta) {
        ta.value = '';
        ta.dataset.userEdited = '';
      }
      refreshBatchInfo();
      refreshSearchInfo();
      setBatchStatus('前回の取得結果をクリアし、新規取得を開始します');
    }

    const seedUrls = fresh ? [] : parseUrlLines(ta ? ta.value : '').map(x => x.inputUrl);
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
      pageCount: 0,
      maxPages: Math.max(0, Number(maxPages) || 0)
    };

    saveSearchCrawlState(state);
    refreshSearchInfo();
    refreshBatchInfo();
    setSearchStatus(mode === 'collect-and-start'
      ? (fresh ? `新規取得として${maxPages ? `${maxPages}ページまで` : '全ページ'}収集を開始します。前回結果はクリア済みです` : '検索結果収集を開始します。収集後に一括取得も始めます')
      : '検索結果の収集を開始します');

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
      setSearchStatus('認証/ブロック画面のため検索結果収集を停止しました', true);
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
      const reachedPageLimit = Number(refreshedState.maxPages || 0) > 0 && refreshedState.pageCount >= Number(refreshedState.maxPages || 0);

      if (!reachedPageLimit && nextUrl && !refreshedState.visitedPages.includes(normalizeUrl(nextUrl))) {
        setSearchStatus(`検索結果 ${refreshedState.pageCount}ページ目まで収集。次ページへ移動します`);
        await sleep(900);
        location.href = nextUrl;
        return;
      }

      finalizeSearchCrawl({ partial: false });
    } catch (err) {
      console.error(err);
      setSearchStatus(`検索結果収集でエラー: ${err.message || err}`, true);
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
      setBatchStatus('取得完了。必要に応じて「求人調査データをコピー」を押してください');
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
        top: 72px;
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
        top: 140px;
        right: 0;
        width: 190px;
        padding: 9px 10px;
        overflow: hidden;
        border-radius: 12px 0 0 12px;
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
      #${PANEL_ID} .tm-range-select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 9px 10px;
        font-size: 12px;
        background: #fff;
        margin-bottom: 8px;
      }
      #${PANEL_ID}.tm-page-search .tm-detail-only { display: none; }
      #${PANEL_ID}.tm-page-detail .tm-search-only { display: none; }
      #${PANEL_ID}.tm-page-other .tm-search-only,
      #${PANEL_ID}.tm-page-other .tm-detail-only { display: none; }

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
        <div class="tm-sub">求人調査データを取得し、Excel / スプレッドシートへ貼り付けできます。</div>
        <div class="tm-status tm-indeed-helper-status">初期化中</div>

        <div class="tm-group tm-main-actions tm-search-only">
          <div class="tm-label">検索結果を取得</div>
          <select class="tm-range-select">
            <option value="current">このページだけ</option>
            <option value="3" selected>3ページまで</option>
            <option value="all">全ページ</option>
          </select>
          <div class="tm-buttons">
            <button class="btn-range-start tm-primary">取得開始</button>
          </div>
          <div class="tm-sub">新規取得として前回結果を自動クリアします。軽い競合調査は「このページ」、傾向確認は「3ページ」、全件分析は「全ページ」が目安です。</div>
        </div>

        <div class="tm-group tm-main-actions tm-detail-only">
          <div class="tm-label">表示中の求人</div>
          <div class="tm-buttons">
            <button class="btn-single-save tm-primary">この求人を取得</button>
          </div>
        </div>

        <div class="tm-group">
          <div class="tm-label">コピー</div>
          <div class="tm-buttons">
            <button class="btn-sales-copy tm-primary">求人調査データをコピー</button>
          </div>
          <div class="tm-sub">営業向けの主要求人項目だけをコピーします（Excel / スプレッドシート貼り付け用）。</div>
        </div>

        <div class="tm-buttons-2" style="margin-top:8px;">
          <button class="btn-toggle-run tm-muted">取得を再開</button>
          <button class="btn-batch-clear tm-danger">取得情報クリア</button>
        </div>

        <div class="tm-info tm-indeed-helper-batch-info"></div>
        <div class="tm-batch-status tm-indeed-helper-batch-status">待機中</div>
        <div class="tm-search-status tm-indeed-helper-search-status">待機中</div>

        <details class="tm-details">
          <summary>その他の機能</summary>

          <div class="tm-group">
            <div class="tm-label">その他の出力</div>
            <div class="tm-buttons-2">
              <button class="btn-search-analysis-copy">検索表示分析TSVをコピー</button>
              <button class="btn-search-match-copy">検索語マッチTSVをコピー</button>
            </div>
            <div class="tm-buttons" style="margin-top:8px;">
              <button class="btn-batch-copy tm-muted">フルデータTSVをコピー</button>
            </div>
            <div class="tm-buttons" style="margin-top:8px;">
              <button class="btn-field-def-copy tm-muted">項目定義TSVをコピー</button>
            </div>
            <div class="tm-sub">フルTSV各列の元key・取得元・意味・注意事項・解釈確度を一覧化します。</div>
          </div>

          <div class="tm-group tm-detail-only">
            <div class="tm-label">表示中の求人・開発用</div>
            <div class="tm-buttons-2">
              <button class="btn-copy-header">見出し付きで即コピー</button>
              <button class="btn-copy-row">1行だけ即コピー</button>
            </div>
            <div class="tm-buttons" style="margin-top:8px;">
              <button class="btn-copy-json tm-muted">JSONコピー（開発用）</button>
            </div>
          </div>

          <div class="tm-group tm-search-only">
            <div class="tm-label">検索結果の追加操作</div>
            <div class="tm-buttons-2">
              <button class="btn-collect-results">現ページURLを追加</button>
              <button class="btn-collect-start">現ページを追加取得</button>
            </div>
            <div class="tm-buttons" style="margin-top:8px;">
              <button class="btn-collect-all tm-muted">全ページURL収集のみ</button>
            </div>
            <div class="tm-info tm-indeed-helper-search-info"></div>
          </div>

          <div class="tm-group">
            <div class="tm-label">取得プロファイル（任意）</div>
            <input class="tm-profile-input" type="text" placeholder="例: browser_A / driver_history / logged_out" />
            <div class="tm-sub">比較実験用ラベルです。個人情報は入力しないでください。</div>
          </div>

          <div class="tm-group">
            <div class="tm-label">手動URL一覧（1行1件）</div>
            <textarea placeholder="https://jp.indeed.com/viewjob?jk=...\nhttps://jp.indeed.com/viewjob?jk=..."></textarea>
            <div class="tm-buttons" style="margin-top:8px;">
              <button class="btn-batch-start">手動URL一覧から新規取得</button>
            </div>
          </div>

          <div class="tm-group">
            <div class="tm-label">ファイル・トラブル対応</div>
            <div class="tm-buttons-2">
              <button class="btn-batch-download">フルTSVファイルDL</button>
              <button class="btn-error-copy">失敗URLコピー</button>
            </div>
          </div>
        </details>
      </div>
    `;

    document.body.appendChild(panel);

    panel.querySelector('.btn-panel-collapse').addEventListener('click', () => togglePanelCollapsed());
    applyPanelCollapsedState(loadPanelCollapsed());
    updatePanelPageContext();

    panel.querySelector('.btn-single-save')?.addEventListener('click', () => saveCurrentJobAsSingleResult());
    panel.querySelector('.btn-range-start')?.addEventListener('click', () => startSelectedSearchRange());
    panel.querySelector('.btn-sales-copy').addEventListener('click', () => copySalesResearch());
    panel.querySelector('.btn-batch-copy').addEventListener('click', () => copyBatchResults());
    panel.querySelector('.btn-toggle-run').addEventListener('click', () => toggleRunPause());
    panel.querySelector('.btn-batch-clear').addEventListener('click', () => clearBatchResults());

    panel.querySelector('.btn-copy-header').addEventListener('click', () => handleCopy(true));
    panel.querySelector('.btn-copy-row').addEventListener('click', () => handleCopy(false));
    panel.querySelector('.btn-copy-json').addEventListener('click', () => handleJsonCopy());

    panel.querySelector('.btn-collect-results').addEventListener('click', () => collectResultsOnly());
    panel.querySelector('.btn-collect-start').addEventListener('click', () => collectResultsAndStart());
    panel.querySelector('.btn-collect-all').addEventListener('click', () => startFullSearchCrawl('collect-only'));

    panel.querySelector('.btn-batch-start').addEventListener('click', () => startOrResumeBatch({ forceFromTextarea: true, preferExistingProgress: false, freshSession: true }));
    panel.querySelector('.btn-search-analysis-copy').addEventListener('click', () => copySearchDisplayAnalysis());
    panel.querySelector('.btn-search-match-copy').addEventListener('click', () => copySearchMatchAnalysis());
    panel.querySelector('.btn-field-def-copy').addEventListener('click', () => copyFieldDefinitions());
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

  function updatePanelPageContext() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const searchPage = isSearchResultsPage() && !location.pathname.includes('/viewjob');
    const detailPage = !searchPage && Boolean(getJobKeyFromUrl(location.href));
    panel.classList.toggle('tm-page-search', searchPage);
    panel.classList.toggle('tm-page-detail', detailPage);
    panel.classList.toggle('tm-page-other', !searchPage && !detailPage);
  }

  function refreshStatus() {
    try {
      updatePanelPageContext();
      if (isChallengePage()) {
        setStatus('認証/ブロック画面の可能性があります', true);
        return;
      }

      if (isSearchResultsPage() && !location.pathname.includes('/viewjob')) {
        const entries = collectSearchResultEntries();
        const nextUrl = findNextSearchPageUrl();
        const sponsoredExplicit = entries.filter(x => x.searchMeta?.['検索結果スポンサー明示'] === 'true').length;
        const sponsorUnknown = entries.length - sponsoredExplicit;
        setStatus(`検索結果ページ: 求人リンク ${entries.length}件 / スポンサー明示 ${sponsoredExplicit} / 未判定 ${sponsorUnknown} / 次ページ ${nextUrl ? 'あり' : 'なし'}`);
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
  console.log('Indeed Helper Batch Export v2.3.0: loaded');
})();

