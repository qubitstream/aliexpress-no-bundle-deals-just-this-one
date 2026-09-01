// ==UserScript==
// @name         Skip AliExpress Bundle Deals: Just This One!
// @namespace    https://github.com/qubitstream/aliexpress-no-bundle-deals-just-this-one
// @version      1.0.5
// @license      MIT
// @homepageURL  https://github.com/qubitstream/aliexpress-no-bundle-deals-just-this-one
// @supportURL   https://github.com/qubitstream/aliexpress-no-bundle-deals-just-this-one/issues
// @description  Skip those bundles and buy just the product you want on AliExpress.
// @match        https://*.aliexpress.com/*
// @match        https://aliexpress.com/*
// @match        https://*.aliexpress.us/*
// @match        https://aliexpress.us/*
// @match        https://*.aliexpress.ru/*
// @match        https://aliexpress.ru/*
// @grant        GM_openInTab
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const ALIEXPRESS_ORIGIN_RE = /^(https?:)?\/\/[^/]*aliexpress\.(?:com|us|ru)/;
  const PRODUCT_ID_RE = /[?&]productIds=(\d+)/;
  const PRODUCT_URL_ORIGIN = 'https://www.aliexpress.com';
  const PROCESSED_ATTR = 'data-jtou-processed';

  // Inject styles once
  document.head.appendChild(Object.assign(document.createElement('style'), {
    textContent: `
      .jtou-link {
        color:#dd22cc !important;
        cursor:pointer;
        display:block;
        font-size:1.08rem !important;
        font-weight:bold;
        line-height:1.2;
        margin-top:4px;
        max-width:100%;
        overflow:hidden;
        text-decoration:none !important;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .jtou-bundle-row .jtou-link {
        display:inline-block;
        flex:1;
        font-size:14px !important;
        line-height:18px;
        margin-left:6px;
        margin-top:0;
        min-width:0;
      }
      .jtou-link:hover { color:#007700 !important; text-decoration:underline !important; }
      .jtou-link>span { color:inherit !important; font:inherit !important; }
    `
  }));

  // Click handler factory
  function openProduct(url) {
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active: true, insert: true });
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  // Build the "Just this one!" link control.
  function makeLink(url) {
    const a = document.createElement('a');
    a.href = url;
    a.className = 'jtou-link';
    a.innerHTML = '<span>✳️ Just this one!</span>';
    a.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      openProduct(url);
    });
    a.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.stopPropagation();
      e.preventDefault();
      openProduct(url);
    });
    return a;
  }

  function getProductUrlFromBundleUrl(url) {
    const origin = url.match(ALIEXPRESS_ORIGIN_RE)?.[0];
    const productId = url.match(PRODUCT_ID_RE)?.[1];

    if (!origin || !productId) return null;

    return makeProductUrl(productId, origin);
  }

  function makeProductUrl(productId, origin = PRODUCT_URL_ORIGIN) {
    return `${origin}/item/${productId}.html`;
  }

  function markProcessed(el) {
    el.setAttribute(PROCESSED_ATTR, 'true');
  }

  function isProcessed(el) {
    return el.getAttribute(PROCESSED_ATTR) === 'true';
  }

  // Query shorthand
  const $ = (s, root = document) => root.querySelectorAll(s);

  // 1. Search results – BundleDeals links
  function processSearchResults() {
    for (const anchor of $('a[href*="BundleDeals"][href*="productIds="]')) {
      const productUrl = getProductUrlFromBundleUrl(anchor.href);
      if (!productUrl) continue;

      const card = anchor.closest('.card-out-wrapper') || anchor.parentElement;
      if (!card || card.querySelector('.jtou-link')) continue;

      const bundleRow = anchor.querySelector('.comet-icon')?.parentElement;
      if (bundleRow) {
        bundleRow.classList.add('jtou-bundle-row');
        bundleRow.appendChild(makeLink(productUrl));
      } else {
        anchor.after(makeLink(productUrl));
      }
    }
  }

  // 2. Wishlist items
  function processWishlist() {
    if (!location.pathname.includes('/p/wish-manage/')) return;

    for (const card of $("[class|='productCardV2--productCard']")) {
      if (card.querySelector('.jtou-link')) continue;

      const dataId = card.querySelector("[class|='operator--operator']")?.getAttribute('data-id');
      const productId = dataId?.match(/^operator_(\d+)/)?.[1];
      if (!productId) continue;

      const target =
        card.querySelector("[class|='cartIcon--shoppingCartPC']") ||
        card.querySelector("[class|='productCardV2--bottom']");

      if (target) {
        target.after(makeLink(makeProductUrl(productId)));
      } else {
        card.appendChild(makeLink(makeProductUrl(productId)));
      }
    }
  }

  // 3. Bundle Deals page (/BundleDeals2)
  function processBundleDealsPage() {
    if (!location.pathname.includes('/BundleDeals2')) return;

    for (const container of $('.AIC-ATM-container')) {
      if (isProcessed(container)) continue;
      const parentId = container.parentNode?.id;
      if (!parentId?.includes('info_container.')) continue;
      if (container.parentElement.querySelector('.jtou-link')) continue;

      const productId = parentId.split('info_container.')[1];
      if (!productId) continue;

      markProcessed(container);
      container.parentElement.appendChild(makeLink(makeProductUrl(productId)));
    }
  }

  // Scan once, then watch for DOM changes via MutationObserver
  function scan() {
    processSearchResults();
    processWishlist();
    processBundleDealsPage();
  }

  scan();

  let pending = null;

  function flushScan() {
    pending = null;
    scan();
  }

  function scheduleScan() {
    if (!pending) pending = requestAnimationFrame(flushScan);
  }

  new MutationObserver(mutations => {
    if (mutations.some(m => m.addedNodes.length)) scheduleScan();
  }).observe(document.body, { childList: true, subtree: true });
})();
