// ==UserScript==
// @name         Saasuke Phone Link UI
// @namespace    https://github.com/tsicb/tampermonkey-scripts
// @version      1.1.1
// @description  サスケ内の国内電話番号を選択可能なリンク表示にし、対応履歴の電話番号・Web URLも見やすくリンク化。10/11桁・0[1-9]始まりで誤検出を抑制し、クリック時だけ非公開 PhoneBridge Core へ発信要求を渡します。
// @match        https://my.saaske.com/lead/cgi/*
// @updateURL    https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/sasuke-phone-link-ui.user.js
// @downloadURL  https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/sasuke-phone-link-ui.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // =========================================================
  // PhoneBridge Core との固定インターフェース
  // =========================================================
  const BRIDGE_PROTOCOL_VERSION = 1;
  const BRIDGE_CALL_EVENT = 'sasuke:phonebridge-call';
  const BRIDGE_STATUS_EVENT = 'sasuke:phonebridge-status';

  // =========================================================
  // サスケ画面
  // =========================================================
  const TABLE_SELECTOR = '#tbl-dt_label1';
  const CALL_RECORD_SELECTOR = '#call_record';
  const CALL_MESSAGE_SELECTOR = '#call_record .call_list.log_call .cl_msg';
  const PHONE_LINK_CLASS = 'tm-sasuke-phone-send';
  const WEB_LINK_CLASS = 'tm-sasuke-history-web-link';
  const STYLE_ID = 'tm-sasuke-phone-link-ui-style';
  const TOAST_ID = 'tm-sasuke-phone-link-ui-toast';
  const PHONE_REGEX = /(?:\+81[-‐-‒–—―ー−\s]?)?0\d{1,4}(?:[-‐-‒–—―ー−\s]?\d{1,4}){1,2}/g;
  const WEB_URL_REGEX = /https?:\/\/[^\s<>"']+/giu;
  const EDIT_CLEANUP_DELAY_MS = 60;
  const DRAG_THRESHOLD_PX = 4;
  const CORE_ACK_TIMEOUT_MS = 1200;

  let renderTimer = null;
  let editCleanupTimer = null;
  let toastTimer = null;
  let lastHref = location.href;
  const pendingRequests = new Map();
  const callMessageOriginalHtml = new WeakMap();

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

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }


  // PHONE_REGEXは表記ゆれを広めに拾う候補抽出用。
  // 実際にリンク化する前に、国内電話番号として最低限安全な2条件だけで絞る。
  // 1) 区切り文字を除いた数字が10桁または11桁
  // 2) 0の次が1〜9（00... を除外）
  // 国際表記は現時点では対象外。
  function isLikelyDomesticPhoneCandidate(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 10 && digits.length !== 11) return false;
    return /^0[1-9]/.test(digits);
  }

  function hasLikelyPhoneCandidate(value) {
    const text = String(value || '');
    if (!text) return false;

    const regex = new RegExp(PHONE_REGEX.source, PHONE_REGEX.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (isLikelyDomesticPhoneCandidate(match[0])) return true;
    }
    return false;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${PHONE_LINK_CLASS} {
        display: inline;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: #0b57d0;
        font: inherit;
        text-decoration: underline;
        cursor: pointer;
        line-height: inherit;
        user-select: text;
        -webkit-user-select: text;
        -webkit-user-drag: none;
        touch-action: manipulation;
      }

      .${PHONE_LINK_CLASS}:hover {
        color: #083a8c;
      }

      .${PHONE_LINK_CLASS}:focus-visible {
        outline: 2px solid #7aa7ff;
        outline-offset: 1px;
        border-radius: 2px;
      }

      .${WEB_LINK_CLASS} {
        color: #0b57d0;
        text-decoration: underline;
        cursor: pointer;
        text-underline-offset: 1px;
      }

      .${WEB_LINK_CLASS}:hover {
        color: #083a8c;
      }

      .${WEB_LINK_CLASS}:focus-visible {
        outline: 2px solid #7aa7ff;
        outline-offset: 1px;
        border-radius: 2px;
      }

      #${TOAST_ID} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 999999;
        max-width: 360px;
        padding: 10px 12px;
        border: 1px solid #c6d0da;
        border-radius: 8px;
        background: rgba(255,255,255,0.98);
        color: #23313c;
        font-size: 12px;
        line-height: 1.4;
        box-shadow: 0 4px 14px rgba(0,0,0,0.12);
        opacity: 0;
        transform: translateY(8px);
        pointer-events: none;
        transition: opacity 0.18s ease, transform 0.18s ease;
      }

      #${TOAST_ID}.show {
        opacity: 1;
        transform: translateY(0);
      }

      #${TOAST_ID}.error {
        border-color: #efb3b3;
        color: #8a1f1f;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      (document.body || document.documentElement).appendChild(toast);
    }
    return toast;
  }

  function showToast(message, isError = false, duration = 1800) {
    const toast = ensureToast();
    toast.textContent = message;
    toast.classList.toggle('error', !!isError);
    toast.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show', 'error');
    }, duration);
  }

  function createRequestId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `pb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function parseEventDetail(detail) {
    if (typeof detail === 'string') {
      try {
        return JSON.parse(detail);
      } catch {
        return null;
      }
    }
    return detail && typeof detail === 'object' ? detail : null;
  }

  function dispatchBridgeCall(phone, sourceLabel, sourceText) {
    const requestId = createRequestId();
    const message = {
      version: BRIDGE_PROTOCOL_VERSION,
      requestId,
      phone,
      sourceLabel: sourceLabel || '',
      sourceText: sourceText || ''
    };

    const timeoutId = setTimeout(() => {
      if (!pendingRequests.has(requestId)) return;
      pendingRequests.delete(requestId);
      showToast(
        'PhoneBridge Coreから応答がありません。非公開Coreが有効か確認してください。',
        true,
        3200
      );
    }, CORE_ACK_TIMEOUT_MS);

    pendingRequests.set(requestId, {
      timeoutId,
      accepted: false,
      phone
    });

    // Firefox等の拡張サンドボックス間でも扱いやすいよう detail はJSON文字列に固定。
    document.dispatchEvent(
      new CustomEvent(BRIDGE_CALL_EVENT, {
        detail: JSON.stringify(message)
      })
    );
  }

  function handleBridgeStatus(event) {
    const status = parseEventDetail(event.detail);
    if (!status || status.version !== BRIDGE_PROTOCOL_VERSION || !status.requestId) return;

    const pending = pendingRequests.get(status.requestId);
    if (!pending) return;

    if (status.status === 'accepted') {
      pending.accepted = true;
      clearTimeout(pending.timeoutId);
      return;
    }

    clearTimeout(pending.timeoutId);
    pendingRequests.delete(status.requestId);

    if (status.status === 'success') {
      showToast(status.message || `iPhoneへ送信: ${pending.phone}`);
      return;
    }

    if (status.status === 'error') {
      showToast(status.message || 'PhoneBridgeへの送信に失敗しました', true, 3000);
    }
  }

  document.addEventListener(BRIDGE_STATUS_EVENT, handleBridgeStatus, false);

  function selectionTouchesElement(el) {
    const selection = window.getSelection && window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return false;

    for (let i = 0; i < selection.rangeCount; i += 1) {
      const range = selection.getRangeAt(i);
      try {
        if (range.intersectsNode(el)) return true;
      } catch {
        // noop
      }
    }
    return false;
  }

  function activatePhoneLink(el) {
    const phone = el.dataset.originalPhone || normalizeText(el.textContent);
    if (!phone) return;

    dispatchBridgeCall(
      phone,
      el.dataset.sourceLabel || '',
      el.dataset.sourceText || ''
    );
  }

  function createPhoneLink(phone, sourceLabel, sourceText) {
    // button/aではなくspanにすることで文字選択を自然に行えるようにする。
    const el = document.createElement('span');
    el.className = PHONE_LINK_CLASS;
    el.textContent = phone;
    el.title = `クリックでiPhoneへ送信 / ドラッグで電話番号を選択: ${phone}`;
    el.setAttribute('role', 'link');
    el.setAttribute('tabindex', '0');
    el.draggable = false;

    el.dataset.originalPhone = phone;
    el.dataset.sourceLabel = sourceLabel || '';
    el.dataset.sourceText = sourceText || '';

    let pointerDown = null;
    let dragged = false;

    el.addEventListener('dragstart', (event) => {
      event.preventDefault();
    });

    el.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      pointerDown = { x: event.clientX, y: event.clientY };
      dragged = false;
      // preventDefaultしない。ブラウザ標準の文字選択を残す。
    });

    el.addEventListener('pointermove', (event) => {
      if (!pointerDown) return;
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) dragged = true;
    });

    el.addEventListener('pointerup', () => {
      pointerDown = null;
    });

    el.addEventListener('pointercancel', () => {
      pointerDown = null;
      dragged = false;
    });

    el.addEventListener('click', (event) => {
      if (dragged || selectionTouchesElement(el)) {
        // 文字選択のためのドラッグ後にclickが発火しても送信しない。
        dragged = false;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      activatePhoneLink(el);
    });

    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (selectionTouchesElement(el)) return;
      event.preventDefault();
      event.stopPropagation();
      activatePhoneLink(el);
    });

    return el;
  }

  function decodeHtmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value;
  }

  function containsPhoneLinkMarkup(value) {
    const s = String(value || '');
    if (!s) return false;

    return (
      s.includes(PHONE_LINK_CLASS) ||
      /<span\b[^>]*tm-sasuke-phone-send/iu.test(s) ||
      /&lt;span\b[^&]*tm-sasuke-phone-send/iu.test(s)
    );
  }

  function extractPhonesFromText(value) {
    const text = String(value || '');
    const regex = new RegExp(PHONE_REGEX.source, PHONE_REGEX.flags);
    const phones = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (!isLikelyDomesticPhoneCandidate(match[0])) continue;
      const phone = normalizeText(match[0]);
      if (phone && !phones.includes(phone)) phones.push(phone);
    }
    return phones;
  }

  function htmlToPlainText(value) {
    const tmp = document.createElement('div');
    tmp.innerHTML = String(value || '');
    return normalizeText(tmp.textContent || '');
  }

  function cleanPhoneLinkMarkupValue(value) {
    const original = String(value || '');
    if (!containsPhoneLinkMarkup(original)) return original;

    const decoded = decodeHtmlEntities(original);
    for (const candidate of [decoded, original]) {
      const phones = extractPhonesFromText(candidate);
      if (phones.length) return phones.join(' ');
    }

    for (const candidate of [decoded, original]) {
      const plain = htmlToPlainText(candidate);
      if (plain) return plain;
    }

    return original;
  }

  function dispatchEditInputEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function cleanEditableField(el) {
    if (!el) return false;

    const tag = (el.tagName || '').toLowerCase();
    const isInputLike = tag === 'textarea' || tag === 'input';
    const isContentEditable = el.getAttribute && el.getAttribute('contenteditable') === 'true';

    if (isInputLike) {
      const type = String(el.type || '').toLowerCase();
      if (['hidden', 'password', 'checkbox', 'radio', 'file'].includes(type)) return false;

      const cleaned = cleanPhoneLinkMarkupValue(el.value);
      if (cleaned !== el.value) {
        el.value = cleaned;
        dispatchEditInputEvents(el);
        return true;
      }
      return false;
    }

    if (isContentEditable) {
      const cleaned = cleanPhoneLinkMarkupValue(el.innerHTML || el.textContent || '');
      const currentText = normalizeText(el.textContent || '');
      if (cleaned && cleaned !== currentText) {
        el.textContent = cleaned;
        dispatchEditInputEvents(el);
        return true;
      }
    }

    return false;
  }

  function cleanLiteralMarkupTextNodes(root) {
    const walker = document.createTreeWalker(
      root || document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const value = node.nodeValue || '';
          if (!containsPhoneLinkMarkup(value)) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || parent.closest('script, style')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);

    let changed = false;
    nodes.forEach((node) => {
      const cleaned = cleanPhoneLinkMarkupValue(node.nodeValue || '');
      if (cleaned !== node.nodeValue) {
        node.nodeValue = cleaned;
        changed = true;
      }
    });
    return changed;
  }

  function cleanEditFields(root = document) {
    if (!isTargetPage()) return false;

    let changed = false;
    const fields = root.querySelectorAll
      ? root.querySelectorAll('input, textarea, [contenteditable="true"]')
      : [];

    fields.forEach((el) => {
      if (cleanEditableField(el)) changed = true;
    });

    const textRoot = root.body ? root.body : root;
    if (cleanLiteralMarkupTextNodes(textRoot)) changed = true;

    if (changed) showToast('編集欄の電話番号HTMLを元の番号に戻しました');
    return changed;
  }

  function scheduleEditCleanup() {
    if (editCleanupTimer) clearTimeout(editCleanupTimer);
    editCleanupTimer = setTimeout(() => cleanEditFields(document), EDIT_CLEANUP_DELAY_MS);
  }

  function unwrapPhoneLinks(root) {
    const scope = root || document;
    const links = scope.querySelectorAll
      ? Array.from(scope.querySelectorAll(`.${PHONE_LINK_CLASS}`))
      : [];

    if (!links.length) return false;

    links.forEach((el) => {
      const phone = el.dataset.originalPhone || normalizeText(el.textContent);
      el.replaceWith(document.createTextNode(phone));
    });
    return true;
  }

  function getCallLogScope(target) {
    if (!target || !target.closest) return null;
    return target.closest('.call_list.log_call');
  }

  function rememberCallMessageOriginal(message) {
    if (!message || callMessageOriginalHtml.has(message)) return;
    callMessageOriginalHtml.set(message, message.innerHTML);
  }

  function restoreCallMessageOriginal(message) {
    if (!message || !callMessageOriginalHtml.has(message)) return false;
    const originalHtml = callMessageOriginalHtml.get(message);
    if (message.innerHTML === originalHtml) return false;
    message.innerHTML = originalHtml;
    return true;
  }

  function restoreCallLogOriginal(callLog) {
    if (!callLog || !callLog.querySelectorAll) return false;
    let changed = false;
    callLog.querySelectorAll('.cl_msg').forEach((message) => {
      if (restoreCallMessageOriginal(message)) changed = true;
    });
    return changed;
  }

  function createWebLink(label, url) {
    const anchor = document.createElement('a');
    anchor.className = WEB_LINK_CLASS;
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = label;
    anchor.title = `新しいタブで開く: ${url}`;
    return anchor;
  }

  function cleanWebLinkLabel(value) {
    return String(value || '')
      .replace(/[\s\u3000]+$/g, '')
      .replace(/[：:＝=⇒→▶►＞>\-–—]+$/g, '')
      .replace(/[\s\u3000]+$/g, '')
      .trim();
  }

  function trimUrlTrailingPunctuation(rawUrl) {
    return String(rawUrl || '').replace(/[。．、，,;；!?！？]+$/gu, '');
  }

  function splitDirectChildrenIntoLines(container) {
    const lines = [[]];

    Array.from(container.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
        lines.push([]);
        return;
      }
      lines[lines.length - 1].push(node.cloneNode(true));
    });

    return lines.map((nodes) => {
      const holder = document.createElement('div');
      nodes.forEach((node) => holder.appendChild(node.cloneNode(true)));
      return {
        nodes,
        text: holder.textContent || '',
        replacement: null,
        omitted: false
      };
    });
  }

  function lineHasExistingWebUrl(line) {
    return /https?:\/\//iu.test(String(line && line.text || ''));
  }

  function buildFragmentFromNodes(nodes) {
    const frag = document.createDocumentFragment();
    nodes.forEach((node) => frag.appendChild(node.cloneNode(true)));
    return frag;
  }

  function transformHistoryWebLinks(message) {
    if (!message || message.querySelector(`a.${WEB_LINK_CLASS}`)) return false;

    const lines = splitDirectChildrenIntoLines(message);
    let changed = false;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const text = String(line.text || '');
      const regex = new RegExp(WEB_URL_REGEX.source, WEB_URL_REGEX.flags);
      const match = regex.exec(text);
      if (!match) continue;

      const rawMatch = match[0];
      const url = trimUrlTrailingPunctuation(rawMatch);
      if (!url) continue;

      const beforeRaw = text.slice(0, match.index);
      const afterRaw = text.slice(match.index + rawMatch.length);
      const sameLineLabel = cleanWebLinkLabel(beforeRaw);
      const suffix = afterRaw.trim();

      if (sameLineLabel) {
        const frag = document.createDocumentFragment();
        frag.appendChild(createWebLink(sameLineLabel, url));
        if (suffix) frag.appendChild(document.createTextNode(` ${suffix}`));
        line.replacement = frag;
        changed = true;
        continue;
      }

      const lineWithoutUrl = `${beforeRaw}${afterRaw}`.trim();
      const isUrlOnlyLine = !lineWithoutUrl;
      const previous = i > 0 ? lines[i - 1] : null;
      const previousText = previous ? String(previous.text || '').trim() : '';

      if (
        isUrlOnlyLine &&
        previous &&
        !previous.omitted &&
        previousText &&
        !lineHasExistingWebUrl(previous)
      ) {
        const anchor = createWebLink(previousText, url);
        anchor.replaceChildren(buildFragmentFromNodes(previous.nodes));
        const frag = document.createDocumentFragment();
        frag.appendChild(anchor);
        previous.replacement = frag;
        line.omitted = true;
        changed = true;
        continue;
      }

      // ラベル候補が無い場合だけURL自体を通常リンクとして残す。
      const frag = document.createDocumentFragment();
      frag.appendChild(createWebLink(url, url));
      if (suffix) frag.appendChild(document.createTextNode(` ${suffix}`));
      line.replacement = frag;
      changed = true;
    }

    if (!changed) return false;

    const output = document.createDocumentFragment();
    const visibleLines = lines.filter((line) => !line.omitted);

    visibleLines.forEach((line, index) => {
      if (line.replacement) {
        output.appendChild(line.replacement);
      } else {
        output.appendChild(buildFragmentFromNodes(line.nodes));
      }
      if (index < visibleLines.length - 1) output.appendChild(document.createElement('br'));
    });

    message.replaceChildren(output);
    return true;
  }

  function enhancePhonesInContainer(container, sourceLabel, sourceText) {
    if (!container) return false;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const value = node.nodeValue || '';
          if (!value.trim()) return NodeFilter.FILTER_REJECT;

          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest(`.${PHONE_LINK_CLASS}`)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('a, button, input, textarea, script, style')) return NodeFilter.FILTER_REJECT;

          return hasLikelyPhoneCandidate(value)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);

    let changed = false;
    nodes.forEach((node) => {
      if (replacePhoneTextNode(node, sourceLabel, sourceText)) changed = true;
    });
    return changed;
  }

  function enhanceCallRecordMessage(message) {
    if (!message) return;

    const callLog = message.closest('.call_list.log_call');
    if (callLog && callLog.dataset.tmPhoneLinkEditingPrep === '1') return;

    const originalText = normalizeText(message.textContent || '');
    const hasPhone = hasLikelyPhoneCandidate(originalText);
    const hasUrl = /https?:\/\//iu.test(originalText);
    if (!hasPhone && !hasUrl) return;

    rememberCallMessageOriginal(message);
    transformHistoryWebLinks(message);
    enhancePhonesInContainer(message, '対応履歴', originalText);
  }

  function getActionText(el) {
    if (!el) return '';
    const parts = [
      el.textContent,
      el.value,
      el.title,
      el.alt,
      el.getAttribute && el.getAttribute('aria-label'),
      el.getAttribute && el.getAttribute('name'),
      el.getAttribute && el.getAttribute('id'),
      el.getAttribute && el.getAttribute('class'),
      el.getAttribute && el.getAttribute('src')
    ];
    return normalizeText(parts.filter(Boolean).join(' '));
  }

  function closestActionElement(target) {
    if (!target || !target.closest) return null;
    return target.closest('a, button, input, img, span, i, svg, path');
  }

  function isEditTrigger(target) {
    const text = getActionText(closestActionElement(target)).toLowerCase();
    return !!text && /(編集|修正|edit|pencil|pen|鉛筆)/iu.test(text);
  }

  function isSaveOrCancelTrigger(target) {
    const text = getActionText(closestActionElement(target)).toLowerCase();
    return !!text && /(登録|保存|更新|確定|save|submit|update|取消|キャンセル|cancel)/iu.test(text);
  }

  function prepareForPossibleEdit(target) {
    if (!isTargetPage() || !isEditTrigger(target)) return;

    const callLog = getCallLogScope(target);
    if (callLog) {
      // 対応履歴の閲覧用リンクは、サスケ本体が編集フォームを生成する前に元HTMLへ戻す。
      callLog.dataset.tmPhoneLinkEditingPrep = '1';
      restoreCallLogOriginal(callLog);
      unwrapPhoneLinks(callLog);
      cleanEditFields(callLog);
      setTimeout(() => cleanEditFields(callLog), 0);
      setTimeout(() => cleanEditFields(callLog), 120);
      setTimeout(() => {
        if (!callLog.isConnected) return;
        delete callLog.dataset.tmPhoneLinkEditingPrep;
        scheduleRender();
      }, 700);
      return;
    }

    const row = target.closest && target.closest('tr');
    const scope = row || document.querySelector(TABLE_SELECTOR) || document;

    if (unwrapPhoneLinks(scope)) {
      cleanEditFields(scope);
      setTimeout(() => cleanEditFields(scope), 0);
      setTimeout(() => cleanEditFields(scope), 120);
    }
  }

  function prepareBeforeSaveOrCancel(target) {
    if (!isTargetPage() || !isSaveOrCancelTrigger(target)) return;
    const callLog = getCallLogScope(target);
    const row = target.closest && target.closest('tr');
    cleanEditFields(callLog || row || document);
  }

  function bindEditSafetyEvents() {
    document.addEventListener('mousedown', (event) => {
      prepareForPossibleEdit(event.target);
      prepareBeforeSaveOrCancel(event.target);
    }, true);

    document.addEventListener('click', (event) => {
      prepareForPossibleEdit(event.target);
      prepareBeforeSaveOrCancel(event.target);
    }, true);

    document.addEventListener('focusin', scheduleEditCleanup, true);
  }

  function isEditingCell(td) {
    if (!td) return false;

    if (td.querySelector('input:not([type="hidden"]), textarea, select, [contenteditable="true"]')) {
      return true;
    }

    if (containsPhoneLinkMarkup(td.textContent || '')) return true;

    const controls = Array.from(td.querySelectorAll('button, input[type="button"], input[type="submit"]'));
    return controls.some((el) => /(登録|保存|更新|確定|取消|キャンセル|cancel|save|submit|update)/iu.test(getActionText(el)));
  }

  function replacePhoneTextNode(node, sourceLabel, sourceText) {
    const text = node.nodeValue;
    if (!text) return false;

    const regex = new RegExp(PHONE_REGEX.source, PHONE_REGEX.flags);
    let match;
    let lastIndex = 0;
    let found = false;
    const frag = document.createDocumentFragment();

    while ((match = regex.exec(text)) !== null) {
      const matchedPhone = match[0];
      if (!isLikelyDomesticPhoneCandidate(matchedPhone)) continue;

      found = true;
      const start = match.index;
      const end = start + matchedPhone.length;

      if (start > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      frag.appendChild(createPhoneLink(matchedPhone, sourceLabel, sourceText));
      lastIndex = end;
    }

    if (!found) return false;
    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode.replaceChild(frag, node);
    return true;
  }

  function enhanceRowPhones(tr) {
    const th = tr.querySelector('th');
    const td = tr.querySelector('td');
    if (!td || isEditingCell(td)) return;

    const sourceLabel = normalizeText(th ? th.textContent : '');
    const sourceText = normalizeText(td.textContent);

    // URLやメール欄は対象外。
    if (/(E-?mail|メール|URL)/iu.test(sourceLabel)) return;

    const walker = document.createTreeWalker(
      td,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const value = node.nodeValue || '';
          if (!value.trim()) return NodeFilter.FILTER_REJECT;

          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest(`.${PHONE_LINK_CLASS}`)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('a, button, input, textarea, script, style')) return NodeFilter.FILTER_REJECT;

          return hasLikelyPhoneCandidate(value)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    nodes.forEach((node) => replacePhoneTextNode(node, sourceLabel, sourceText));
  }

  function renderPhoneLinks() {
    if (!isTargetPage()) return;

    const table = document.querySelector(TABLE_SELECTOR);
    if (table) table.querySelectorAll('tbody tr').forEach(enhanceRowPhones);

    // 対応履歴本文も対象にする。URL整形 → 電話番号リンク化の順で処理する。
    document.querySelectorAll(CALL_MESSAGE_SELECTOR).forEach(enhanceCallRecordMessage);
  }

  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      ensureStyle();
      renderPhoneLinks();
    }, 120);
  }

  function observeDom() {
    const observer = new MutationObserver(() => {
      if (location.href !== lastHref) lastHref = location.href;
      scheduleEditCleanup();
      scheduleRender();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function watchUrlChange() {
    setInterval(() => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      scheduleRender();
    }, 500);
  }

  function init() {
    ensureStyle();
    bindEditSafetyEvents();
    cleanEditFields(document);
    renderPhoneLinks();
    observeDom();
    watchUrlChange();
  }

  init();
})();
