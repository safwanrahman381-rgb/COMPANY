(function () {
  const { api, cart, money, escapeHtml, icons, store, checkout, allProducts } = window.Shop;
  const root = document.getElementById('cart-root');
  let notices = [];
  let codeMessage = null;

  function emptyState() {
    root.innerHTML = `
      ${notices.map((n) => `<p class="notice">${escapeHtml(n)}</p>`).join('')}
      <div class="drawer-empty" style="padding-bottom:120px">${icons.bag}<p>Your bag is empty.</p><a class="btn" href="/products">Shop treatments</a></div>`;
    notices = [];
  }

  // Drops products that no longer exist or sold out, and caps quantities at what's in stock.
  function reconcile(products) {
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const items = [];
    for (const item of cart.items()) {
      const p = bySlug.get(item.slug);
      if (!p) {
        notices.push('An item in your bag is no longer available and was removed.');
      } else if (!p.inStock) {
        notices.push(`${p.name} has sold out and was removed from your bag.`);
      } else if (item.qty > p.maxQty) {
        notices.push(`We only have ${p.maxQty} of ${p.name} available, so we've updated your bag.`);
        items.push({ slug: item.slug, qty: p.maxQty });
      } else {
        items.push({ slug: item.slug, qty: item.qty });
      }
    }
    const before = JSON.stringify(cart.items());
    if (JSON.stringify(items) !== before) cart.save(items);
    return { items, bySlug };
  }

  async function render() {
    let products;
    let s;
    try {
      [s, products] = await Promise.all([store, allProducts(true)]);
    } catch {
      root.innerHTML = '<p class="notice error">Couldn\'t load your bag. Please refresh the page.</p>';
      return;
    }
    const { items, bySlug } = reconcile(products);
    if (!items.length) return emptyState();

    let quote;
    try {
      quote = await api('/api/cart/quote', { method: 'POST', body: { items, code: cart.code() } });
    } catch (err) {
      root.innerHTML = `<p class="notice error">${escapeHtml(err.message)}</p>`;
      return;
    }
    if (quote.invalidCode) {
      codeMessage = { ok: false, text: `“${cart.code()}” isn't a valid discount code.` };
      cart.setCode('');
    }

    const freeOver = quote.freeShippingOver;
    const remaining = freeOver ? Math.max(0, freeOver - quote.afterDiscount) : 0;
    const multipleRates = s.shipping.options.length > 1;

    const lines = quote.lines
      .map((l) => {
        const p = bySlug.get(l.slug);
        const href = `/products/${encodeURIComponent(l.slug)}`;
        return `
        <div class="line">
          <a href="${href}"><img src="${escapeHtml(p.image)}" alt="" width="96" height="96"></a>
          <div>
            <h3><a href="${href}">${escapeHtml(l.name)}</a></h3>
            <p class="meta">${escapeHtml([p.form, p.size].filter(Boolean).join(' · '))} · ${money(l.unitPrice)} each</p>
            <div class="controls">
              <div class="qty small">
                <button type="button" data-qty="${escapeHtml(l.slug)}" data-step="-1" aria-label="Decrease quantity of ${escapeHtml(l.name)}">−</button>
                <input type="number" value="${l.qty}" min="1" max="${p.maxQty}" data-qty-input="${escapeHtml(l.slug)}" aria-label="Quantity of ${escapeHtml(l.name)}">
                <button type="button" data-qty="${escapeHtml(l.slug)}" data-step="1" aria-label="Increase quantity of ${escapeHtml(l.name)}" ${l.qty >= p.maxQty ? 'disabled' : ''}>+</button>
              </div>
              <button class="link-btn" type="button" data-remove="${escapeHtml(l.slug)}">Remove</button>
            </div>
          </div>
          <span class="line-price">${money(l.total)}</span>
        </div>`;
      })
      .join('');

    root.innerHTML = `
      ${notices.map((n) => `<p class="notice">${escapeHtml(n)}</p>`).join('')}
      <div class="bag">
        <div>${lines}<p style="margin-top:28px"><a class="arrow-link" href="/products">← Continue shopping</a></p></div>
        <aside class="summary" aria-label="Order summary">
          <h2>Summary</h2>
          ${s.hasDiscounts ? `
            <form class="code-form" id="code-form">
              <label class="visually-hidden" for="code">Discount code</label>
              <input class="input" id="code" name="code" placeholder="Discount code" value="${escapeHtml(quote.discount ? quote.discount.code : '')}" autocomplete="off">
              <button class="btn btn-ghost" type="submit">Apply</button>
            </form>
            <p class="code-msg ${codeMessage ? (codeMessage.ok ? 'ok' : 'error') : ''}">${codeMessage ? escapeHtml(codeMessage.text) : ''}</p>` : ''}
          <div class="row"><span>Subtotal</span><span>${money(quote.subtotal)}</span></div>
          ${quote.discount ? `
            <div class="row discount">
              <span>Discount (${escapeHtml(quote.discount.code)}) <button class="link-btn" type="button" id="remove-code">Remove</button></span>
              <span>−${money(quote.discount.amount)}</span>
            </div>` : ''}
          <div class="row"><span>Delivery</span><span>${quote.shippingFrom === 0 ? 'Free' : `${multipleRates ? 'from ' : ''}${money(quote.shippingFrom)}`}</span></div>
          <div class="row total"><span>Total</span><span>${money(quote.afterDiscount + quote.shippingFrom)}</span></div>
          ${freeOver ? `
            <p class="ship-progress" style="margin-top:16px">${remaining > 0 ? `Add <strong>${money(remaining)}</strong> more for free delivery` : '<strong>Free UK delivery unlocked</strong>'}</p>
            <div class="progress" aria-hidden="true"><span style="width:${Math.min(100, (quote.afterDiscount / freeOver) * 100)}%"></span></div>` : ''}
          <div id="checkout-error"></div>
          <button class="btn btn-block" type="button" id="checkout">Checkout</button>
          <p class="small secure">${icons.lock} Secure checkout by Stripe${s.demoMode ? ' (demo mode)' : ''}</p>
        </aside>
      </div>`;
    notices = [];
  }

  root.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      const slug = step.dataset.qty;
      const item = cart.items().find((i) => i.slug === slug);
      if (item) cart.setQty(slug, item.qty + Number(step.dataset.step));
      return;
    }
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      cart.remove(remove.dataset.remove);
      return;
    }
    if (e.target.id === 'remove-code') {
      cart.setCode('');
      codeMessage = null;
      render();
      return;
    }
    if (e.target.id === 'checkout') {
      checkout(e.target, document.getElementById('checkout-error')).then(() => {
        if (document.querySelector('#checkout-error .notice')) setTimeout(render, 2500);
      });
    }
  });

  root.addEventListener('change', (e) => {
    const input = e.target.closest('[data-qty-input]');
    if (!input) return;
    const max = Number(input.max) || 99;
    cart.setQty(input.dataset.qtyInput, Math.max(0, Math.min(Math.round(Number(input.value)) || 0, max)));
  });

  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'code-form') return;
    e.preventDefault();
    const code = e.target.code.value.trim().toUpperCase();
    cart.setCode(code);
    codeMessage = code ? { ok: true, text: `Code ${code} applied.` } : null;
    render();
  });

  // Re-render whenever the bag changes here, in the drawer, or in another tab.
  document.addEventListener('cart:change', render);
  window.addEventListener('storage', render);
  render();
})();
