// Shared site chrome (header, footer, bag drawer), cart storage and helpers.
(function () {
  const CART_KEY = 'shop.cart';
  const CODE_KEY = 'shop.discountCode';

  const svg = (body, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
  const icons = {
    logo: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="15" stroke="currentColor" stroke-width="1.4"/><path d="M9 10l7 13 7-13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    bag: svg('<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    check: svg('<path d="M5 12l4 4 10-10"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 'width="14" height="14"'),
    truck: svg('<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>'),
    shield: svg('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>'),
    box: svg('<path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/>'),
    chat: svg('<path d="M4 5h16v11H8l-4 4V5z"/>'),
    return: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Something went wrong. Please try again.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // localStorage can be unavailable (private mode, blocked storage), so every access is guarded.
  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage unavailable: the bag lasts for this page only */
      }
    },
  };

  const cart = {
    items() {
      const items = storage.get(CART_KEY, []);
      return Array.isArray(items) ? items.filter((i) => i && i.slug && i.qty > 0) : [];
    },
    save(items) {
      storage.set(CART_KEY, items);
      updateCartCount();
      document.dispatchEvent(new CustomEvent('cart:change'));
    },
    count() {
      return cart.items().reduce((n, i) => n + i.qty, 0);
    },
    add(slug, qty, max) {
      const items = cart.items();
      const existing = items.find((i) => i.slug === slug);
      const limit = max || 99;
      if (existing) existing.qty = Math.min(existing.qty + qty, limit);
      else items.push({ slug, qty: Math.min(qty, limit) });
      cart.save(items);
    },
    setQty(slug, qty) {
      cart.save(cart.items().map((i) => (i.slug === slug ? { ...i, qty } : i)).filter((i) => i.qty > 0));
    },
    remove(slug) {
      cart.save(cart.items().filter((i) => i.slug !== slug));
    },
    clear() {
      cart.save([]);
    },
    code() {
      return storage.get(CODE_KEY, '');
    },
    setCode(code) {
      storage.set(CODE_KEY, code || null);
    },
  };

  let storeInfo = null;
  const storePromise = api('/api/store').then((s) => {
    storeInfo = s;
    return s;
  });

  let productsPromise = null;
  function allProducts(refresh) {
    if (!productsPromise || refresh) productsPromise = api('/api/products');
    return productsPromise;
  }

  function money(pence) {
    const symbol = storeInfo ? storeInfo.currencySymbol : '£';
    return `${symbol}${(pence / 100).toFixed(2)}`;
  }

  // Whole-pound amounts without pence, for marketing copy: £30 rather than £30.00.
  function moneyShort(pence) {
    return pence % 100 === 0 ? money(pence).replace(/\.00$/, '') : money(pence);
  }

  function productCard(p) {
    const href = `/products/${encodeURIComponent(p.slug)}`;
    return `
      <article class="card">
        <a class="card-media" href="${href}" tabindex="-1" aria-hidden="true">
          <img src="${escapeHtml(p.image)}" alt="" loading="lazy" width="700" height="700">
          ${p.badge && p.inStock ? `<span class="badge">${escapeHtml(p.badge)}</span>` : ''}
          ${p.inStock ? '' : '<span class="badge out">Sold out</span>'}
        </a>
        <div class="card-body">
          <p class="eyebrow">${escapeHtml(p.concern || p.categoryName)}</p>
          <h3 class="card-title"><a href="${href}">${escapeHtml(p.name)}</a></h3>
          <p class="card-meta">${escapeHtml([p.form, p.size].filter(Boolean).join(' · '))}</p>
          <div class="card-foot">
            <span class="price">${money(p.price)}</span>
            ${p.inStock
              ? `<button class="btn btn-sm" type="button" data-quick-add="${escapeHtml(p.slug)}" data-max="${p.maxQty}" aria-label="Add ${escapeHtml(p.name)} to bag">Add to bag</button>`
              : '<button class="btn btn-sm btn-ghost" type="button" disabled>Sold out</button>'}
          </div>
        </div>
      </article>`;
  }

  let toastTimer;
  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function updateCartCount() {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = cart.count();
    });
  }

  // ---------- header & footer ----------

  const NAV = [
    ['/products', 'Shop all'],
    ['/#how-it-works', 'How it works'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ];

  function renderHeader(s) {
    const here = location.pathname + location.search;
    const current = (href) => (here === href || (href === '/products' && here === '/products') ? ' aria-current="page"' : '');
    const links = NAV.map(([href, label]) => `<a href="${href}"${current(href)}>${label}</a>`).join('');
    return `
      ${s.demoMode ? '<div class="demo-banner">Demo mode: payments aren\'t set up yet, so checkout won\'t charge anything.</div>' : ''}
      ${s.notices && s.notices.length ? `<div class="topbar"><ul>${s.notices.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>` : ''}
      <header class="site-header">
        <div class="container header-inner">
          <div style="display:flex;align-items:center;gap:4px">
            <button class="icon-btn menu-btn" type="button" data-menu-toggle aria-label="Menu" aria-expanded="false">${icons.menu}</button>
            <a class="logo" href="/" aria-label="${escapeHtml(s.name)} home">${icons.logo}<span>${escapeHtml(s.name.split(' ')[0])}</span></a>
          </div>
          <nav class="nav" aria-label="Main">${links}</nav>
          <div class="header-actions">
            <button class="icon-btn" type="button" data-search-toggle aria-label="Search" aria-expanded="false">${icons.search}</button>
            <button class="bag-btn" type="button" data-open-bag aria-label="Open bag"><span class="label">Bag</span><span class="bag-count" data-cart-count>0</span></button>
          </div>
        </div>
        <div class="container mobile-nav" data-mobile-nav>${links}</div>
        <div class="search-panel" data-search-panel>
          <div class="container">
            <form class="search-form" action="/products" role="search">
              <label class="visually-hidden" for="site-search">Search products</label>
              <input class="input" id="site-search" type="search" name="q" placeholder="Search treatments, e.g. tretinoin" autocomplete="off">
              <button class="btn" type="submit">Search</button>
            </form>
          </div>
        </div>
      </header>`;
  }

  function renderFooter(s) {
    const cats = s.categories
      .map((c) => `<li><a href="/products?category=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a></li>`)
      .join('');
    return `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <a class="logo" href="/">${icons.logo}<span>${escapeHtml(s.name.split(' ')[0])}</span></a>
              <p>${escapeHtml(s.tagline)}</p>
            </div>
            <div><h3>Shop</h3><ul><li><a href="/products">Shop all</a></li>${cats}</ul></div>
            <div><h3>Help</h3><ul>
              <li><a href="/contact">Contact us</a></li>
              <li><a href="/policies/shipping">Delivery</a></li>
              <li><a href="/policies/returns">Returns &amp; refunds</a></li>
              <li><a href="/about">About us</a></li>
            </ul></div>
            <div><h3>Legal</h3><ul>
              <li><a href="/policies/terms">Terms &amp; conditions</a></li>
              <li><a href="/policies/privacy">Privacy policy</a></li>
              <li><a href="/policies/legal">Legal notice</a></li>
            </ul></div>
          </div>
          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} ${escapeHtml(s.name)}. All rights reserved.</span>
            <span>Secure payments by Stripe · UK delivery</span>
          </div>
        </div>
      </footer>`;
  }

  // ---------- bag drawer ----------

  function ensureDrawer() {
    if (document.querySelector('.drawer')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="drawer-overlay" data-close-bag></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-hidden="true">
        <div class="drawer-head">
          <h2 id="drawer-title">Your bag</h2>
          <button class="icon-btn" type="button" data-close-bag aria-label="Close bag">${icons.close}</button>
        </div>
        <div class="drawer-body" data-drawer-body></div>
        <div class="drawer-foot" data-drawer-foot></div>
      </aside>`);
  }

  async function renderDrawer() {
    const body = document.querySelector('[data-drawer-body]');
    const foot = document.querySelector('[data-drawer-foot]');
    if (!body) return;
    let products;
    try {
      products = await allProducts();
    } catch {
      body.innerHTML = '<p class="notice error">Couldn\'t load your bag. Please refresh the page.</p>';
      foot.innerHTML = '';
      return;
    }
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const items = cart.items().filter((i) => bySlug.has(i.slug));
    if (!items.length) {
      body.innerHTML = `<div class="drawer-empty">${icons.bag}<p>Your bag is empty.</p><a class="btn btn-ghost" href="/products">Browse treatments</a></div>`;
      foot.innerHTML = '';
      return;
    }
    const subtotal = items.reduce((sum, i) => sum + bySlug.get(i.slug).price * i.qty, 0);
    body.innerHTML = items
      .map((i) => {
        const p = bySlug.get(i.slug);
        const href = `/products/${encodeURIComponent(p.slug)}`;
        return `
          <div class="line">
            <a href="${href}"><img src="${escapeHtml(p.image)}" alt="" width="76" height="76"></a>
            <div>
              <h3><a href="${href}">${escapeHtml(p.name)}</a></h3>
              <p class="meta">${escapeHtml([p.form, p.size].filter(Boolean).join(' · '))}</p>
              <div class="controls">
                <div class="qty small">
                  <button type="button" data-bag-step="-1" data-slug="${escapeHtml(p.slug)}" aria-label="Decrease quantity">−</button>
                  <input type="number" value="${i.qty}" readonly aria-label="Quantity">
                  <button type="button" data-bag-step="1" data-slug="${escapeHtml(p.slug)}" aria-label="Increase quantity" ${i.qty >= p.maxQty ? 'disabled' : ''}>+</button>
                </div>
                <button class="link-btn" type="button" data-bag-remove="${escapeHtml(p.slug)}">Remove</button>
              </div>
            </div>
            <span class="line-price">${money(p.price * i.qty)}</span>
          </div>`;
      })
      .join('');

    const s = await storePromise;
    const freeOver = s.shipping.freeOver;
    const remaining = freeOver ? Math.max(0, freeOver - subtotal) : 0;
    foot.innerHTML = `
      ${freeOver ? `
        <p class="ship-progress">${remaining > 0 ? `You're <strong>${money(remaining)}</strong> away from free delivery` : '<strong>You\'ve unlocked free UK delivery</strong>'}</p>
        <div class="progress" aria-hidden="true"><span style="width:${Math.min(100, (subtotal / freeOver) * 100)}%"></span></div>` : ''}
      <div class="row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
      <p class="small">Delivery calculated at checkout.</p>
      <div data-drawer-error></div>
      <button class="btn btn-block" type="button" data-checkout>Checkout</button>
      <p class="small center" style="margin:12px 0 0"><a href="/cart">View full bag${s.hasDiscounts ? ' or add a discount code' : ''}</a></p>
      <p class="small secure">${icons.lock} Secure checkout by Stripe</p>`;
  }

  function openBag() {
    ensureDrawer();
    renderDrawer();
    document.documentElement.classList.add('drawer-open');
    document.body.classList.add('no-scroll');
    document.querySelector('.drawer').setAttribute('aria-hidden', 'false');
    setTimeout(() => document.querySelector('.drawer [data-close-bag]').focus(), 50);
  }

  function closeBag() {
    document.documentElement.classList.remove('drawer-open');
    document.body.classList.remove('no-scroll');
    const drawer = document.querySelector('.drawer');
    if (drawer) drawer.setAttribute('aria-hidden', 'true');
  }

  async function checkout(button, errorBox) {
    button.disabled = true;
    const label = button.textContent;
    button.textContent = 'Opening secure checkout…';
    try {
      const { url } = await api('/api/checkout', { method: 'POST', body: { items: cart.items(), code: cart.code() } });
      location.href = url;
    } catch (err) {
      if (errorBox) errorBox.innerHTML = `<p class="notice error">${escapeHtml(err.message)}</p>`;
      button.disabled = false;
      button.textContent = label;
      allProducts(true);
    }
  }

  // ---------- wiring ----------

  storePromise
    .then((s) => {
      document.title = document.title === 'Home' ? `${s.name} | Clinical skincare` : `${document.title} | ${s.name}`;
      const header = document.getElementById('site-header');
      const footer = document.getElementById('site-footer');
      if (header) header.innerHTML = renderHeader(s);
      if (footer) footer.innerHTML = renderFooter(s);
      updateCartCount();
    })
    .catch(() => {
      const main = document.querySelector('main');
      if (main) main.insertAdjacentHTML('afterbegin', '<div class="container"><p class="notice error" style="margin-top:24px">We couldn\'t load the shop. Please refresh the page.</p></div>');
    });

  document.addEventListener('click', async (e) => {
    const t = e.target;
    const quick = t.closest('[data-quick-add]');
    if (quick) {
      e.preventDefault();
      cart.add(quick.dataset.quickAdd, 1, Number(quick.dataset.max) || 99);
      openBag();
      return;
    }
    if (t.closest('[data-open-bag]')) return openBag();
    if (t.closest('[data-close-bag]')) return closeBag();
    const step = t.closest('[data-bag-step]');
    if (step) {
      const item = cart.items().find((i) => i.slug === step.dataset.slug);
      if (item) cart.setQty(item.slug, item.qty + Number(step.dataset.bagStep));
      return renderDrawer();
    }
    const remove = t.closest('[data-bag-remove]');
    if (remove) {
      cart.remove(remove.dataset.bagRemove);
      return renderDrawer();
    }
    const go = t.closest('[data-checkout]');
    if (go) return checkout(go, document.querySelector('[data-drawer-error]'));
    const menu = t.closest('[data-menu-toggle]');
    if (menu) {
      const open = document.querySelector('[data-mobile-nav]').classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
      return;
    }
    const search = t.closest('[data-search-toggle]');
    if (search) {
      const panel = document.querySelector('[data-search-panel]');
      const open = panel.classList.toggle('open');
      search.setAttribute('aria-expanded', String(open));
      if (open) panel.querySelector('input').focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBag();
  });

  // Keep the bag in sync across tabs.
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) {
      updateCartCount();
      if (document.documentElement.classList.contains('drawer-open')) renderDrawer();
    }
  });

  window.Shop = { api, cart, money, moneyShort, escapeHtml, productCard, toast, store: storePromise, icons, allProducts, openBag, checkout };
})();
