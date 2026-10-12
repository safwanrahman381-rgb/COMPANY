// Shared site chrome (announcement bar, header, footer), cart storage and helpers.
(function () {
  const CART_KEY = 'shop.cart';
  const CODE_KEY = 'shop.discountCode';

  const icons = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="M16 16l5.5 5.5"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1 2.5h3.2l.6 2.5H22l-2.6 9.2a1.5 1.5 0 0 1-1.4 1.1H8a1.5 1.5 0 0 1-1.5-1.2L4.1 4.5H1z"/><circle cx="9" cy="20" r="2"/><circle cx="17.5" cy="20" r="2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
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
        /* storage unavailable: cart lasts for this page only */
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

  function money(pence) {
    const symbol = storeInfo ? storeInfo.currencySymbol : '£';
    return `${symbol}${(pence / 100).toFixed(2)}`;
  }

  function productCard(p) {
    return `
      <a class="card" href="/products/${encodeURIComponent(p.slug)}">
        <div class="card-media">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" width="800" height="800">
          ${p.inStock ? '' : '<span class="badge">Sold out</span>'}
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(p.name)}</h3>
          <p class="card-price">${money(p.price)}</p>
        </div>
      </a>`;
  }

  let toastTimer;
  function toast(html) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  function updateCartCount() {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = cart.count();
    });
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard blocked: the code is still applied to the cart below */
    }
    cart.setCode(code);
    toast(`Code <strong>${escapeHtml(code)}</strong> copied and added to your cart`);
  }

  function renderAnnouncement(s) {
    const a = s.announcement;
    if (!a || !a.enabled) return '';
    const code = escapeHtml(a.code);
    return `
      <div class="announcement">
        <div class="announcement-inner">
          <strong>${escapeHtml(a.headline)}</strong>
          <span class="dot">•</span>
          <span>Use code</span>
          <button class="code-chip" type="button" data-copy-code="${code}" aria-label="Copy code ${code}">${code} ${icons.copy}</button>
          <span class="hide-sm">at checkout</span>
          <button class="copy-btn" type="button" data-copy-code="${code}">Copy code</button>
        </div>
      </div>`;
  }

  function renderHeader(s) {
    const path = location.pathname;
    const current = (href) => (path === href || (href !== '/' && path.startsWith(href + '/')) ? ' aria-current="page"' : '');
    return `
      ${s.demoMode ? '<div class="demo-banner">Demo mode: no payment keys configured, so checkout won\'t charge anything.</div>' : ''}
      ${renderAnnouncement(s)}
      <header class="site-header">
        <div class="container header-inner">
          <nav class="nav" aria-label="Main">
            <a href="/products"${current('/products')}>Products</a>
            <a href="/contact"${current('/contact')}>Contact</a>
          </nav>
          <div class="header-actions">
            <button class="icon-btn" type="button" data-search-toggle aria-label="Search" aria-expanded="false">${icons.search}</button>
            <a class="icon-btn" href="/cart" aria-label="Cart">${icons.cart}<span data-cart-count>0</span></a>
          </div>
        </div>
        <div class="search-panel" data-search-panel>
          <form class="search-form" action="/products" role="search">
            <label class="visually-hidden" for="site-search">Search products</label>
            <input class="input" id="site-search" type="search" name="q" placeholder="Search products…" autocomplete="off">
            <button class="btn" type="submit">Search</button>
          </form>
        </div>
      </header>`;
  }

  function renderFooter(s) {
    const cats = s.categories
      .filter((c) => c.inFooter)
      .map((c) => `<li><a href="/products?category=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a></li>`)
      .join('');
    return `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-cols">
            <div>
              <h3>Shop</h3>
              <ul><li><a href="/">Home</a></li><li><a href="/products">Products</a></li></ul>
            </div>
            <div>
              <h3>Categories</h3>
              <ul>${cats}</ul>
            </div>
            <div>
              <h3>More</h3>
              <ul>
                <li><a href="/contact">Contact</a></li>
                <li><a href="/policies/shipping">Shipping and delivery</a></li>
                <li><a href="/policies/returns">Returns and refunds</a></li>
                <li><a href="/policies/privacy">Privacy policy</a></li>
                <li><a href="/policies/terms">Terms and conditions</a></li>
                <li><a href="/policies/legal">Legal notice</a></li>
              </ul>
            </div>
          </div>
          <p class="footer-tagline">${escapeHtml(s.tagline)}</p>
          <p class="footer-copy">© ${new Date().getFullYear()} ${escapeHtml(s.name)}</p>
        </div>
      </footer>`;
  }

  storePromise
    .then((s) => {
      const header = document.getElementById('site-header');
      const footer = document.getElementById('site-footer');
      document.title = document.title === 'Home' ? s.name : `${document.title} | ${s.name}`;
      if (header) header.innerHTML = renderHeader(s);
      if (footer) footer.innerHTML = renderFooter(s);
      updateCartCount();

      document.addEventListener('click', (e) => {
        const copy = e.target.closest('[data-copy-code]');
        if (copy) copyCode(copy.dataset.copyCode);
        const toggle = e.target.closest('[data-search-toggle]');
        if (toggle) {
          const panel = document.querySelector('[data-search-panel]');
          const open = panel.classList.toggle('open');
          toggle.setAttribute('aria-expanded', String(open));
          if (open) panel.querySelector('input').focus();
        }
      });
    })
    .catch(() => {
      const main = document.querySelector('main');
      if (main) main.insertAdjacentHTML('afterbegin', '<div class="container"><p class="notice error">We couldn\'t load the shop. Please refresh the page.</p></div>');
    });

  // Keep the cart badge in sync across tabs.
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) updateCartCount();
  });

  window.Shop = { api, cart, money, escapeHtml, productCard, toast, store: storePromise, icons };
})();
