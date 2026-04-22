// ==UserScript==
// @name         Skip AliExpress Bundle Deals: Just This One!
// @namespace    https://github.com/qubitstream/aliexpress-no-bundle-deals-just-this-one
// @version      1.0.0
// @description  Skip those bundles and buy just the product you want on AliExpress.
// @match        https://*.aliexpress.com/*
// @match        https://aliexpress.com/*
// @match        https://*.aliexpress.us/*
// @match        https://aliexpress.us/*
// @match        https://*.aliexpress.ru/*
// @match        https://aliexpress.ru/*
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const PRODUCT_ID_RE = /(.*aliexpress\.(?:com|us|ru)).*productIds=(\d+)/;

  // Inject styles once
  document.head.appendChild(Object.assign(document.createElement('style'), {
    textContent: `
      .card-out-wrapper:hover .jto-link span,
      :hover>**>* .jto-link { color: #007700; border-radius:4px; }
      .jto-link { order:5; margin-top:4px; display:inline-block; }
      .jto-link>span { color:#dd22cc; font-weight:bold; font-size:1.08rem !important; }
      .jto-link:hover { text-decoration:underline; }
    `
  }));

  // Click handler factory
  function openProduct(url) {
    GM_openInTab(url, { active: true, insert: true });
  }

  // Build the "Just this one!" link
  function makeLink(url) {
    const a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.className = 'jto-link';
    a.innerHTML = '<span>✳️ Just this one!</span>';
    a.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      openProduct(url);
    });
    return a;
  }

  // Query shorthand
  const $ = (s, root = document) => root.querySelectorAll(s);
  const marked = el => el.classList.contains('jto-link');

  // 1. Search results – BundleDeals links
  function processSearchResults() {
    for (const anchor of $('[href*="BundleDeals"]')) {
      const icon = anchor.querySelector('.comet-icon');
      const target = icon ? icon.parentNode : anchor.children[anchor.children.length - 1];
      if (!target || marked(target)) continue;

      const m = anchor.href.match(PRODUCT_ID_RE);
      if (!m) continue;

      target.classList.add('jto-link');
      target.after(makeLink(`${m[1]}/item/${m[2]}.html`));
    }
  }

  // 2. Wishlist items
  function processWishlist() {
    for (const entry of $("[class|='editItemWrap'] div[class|='nnEntry']")) {
      if (marked(entry) || entry.parentNode?.classList.contains('jto-link')) continue;

      const card = entry.closest("[class|='productCardV2--productCard']");
      const dataId = card?.querySelector("[class|='operator--operator']")?.getAttribute('data-id');
      if (!dataId) continue;

      const productId = dataId.substring(9);
      if (!productId) continue;

      entry.classList.add('jto-link');
      entry.after(makeLink(`https://www.aliexpress.com/item/${productId}.html`));
    }
  }

  // 3. Bundle Deals page (/BundleDeals2)
  function processBundleDealsPage() {
    if (!location.pathname.includes('/BundleDeals2')) return;

    for (const container of $('.AIC-ATM-container')) {
      if (marked(container)) continue;
      const parentId = container.parentNode?.id;
      if (!parentId?.includes('info_container.')) continue;
      if (container.parentElement.querySelector('.jto-link')) continue;

      const productId = parentId.split('info_container.')[1];
      if (!productId) continue;

      container.classList.add('jto-link');
      container.parentElement.appendChild(makeLink(`https://www.aliexpress.com/item/${productId}.html`));
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
  new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.addedNodes.length) {
        if (!pending) pending = requestAnimationFrame(() => { scan(); pending = null; });
        return;
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
