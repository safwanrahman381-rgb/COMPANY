(function () {
  const { api, cart, money, escapeHtml, icons, store } = window.Shop;
  const root = document.getElementById('cart-root');
  let notices = [];
  let codeMessage = null;

  function emptyState() {
    root.innerHTML = `
      <div class="prose center">
        ${notices.map((n) => `<p class="notice">${escapeHtml(n)}</p>`).join('')}
        <p>Your cart is empty.</p>
        <p><a class="btn" href="/products">Continue shopping</a></p>
      </div>`;
  }

  // Drops products that no longer exist or sold out, and caps quantities at what's in stock.
  function reconcile(products) {
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const items = [];
    for (const item of cart.items()) {
      const p = bySlug.get(item.slug);
      if (!p) {
        notices.push('An item in your cart is no longer available and was removed.');
      } else if (!p.inStock) {
        notices.push(`${p.name} has sold out and was removed from your cart.`);
      } else if (item.qty > p.maxQty) {
        notices.push(`We only have ${p.maxQty} of ${p.name} available, so we've updated your cart.`);
        items.push({ slug: item.slug, qty: p.maxQty });
      } else {
        items.push({ slug: item.slug, qty: item.qty });
      }
    }
    cart.save(items);
    return { items, bySlug };
  }

  async function render() {
    let products;
    try {
      await store;
      products = await api('/api/products');
    } catch {
      root.innerHTML = '<p class="notice error">Couldn\'t load your cart. Please refresh the page.</p>';
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

    const s = await store;
    const freeOver = quote.freeShippingOver;
    const remaining = freeOver ? Math.max(0, freeOver - quote.afterDiscount) : 0;

    const lines = quote.lines
      .map((l) => {
        const p = bySlug.get(l.slug);
        return `
        <div class="cart-line">
          <a href="/products/${encodeURIComponent(l.slug)}"><img src="${escapeHtml(p.image)}" alt="" width="96" height="96"></a>
          <div>
            <h3><a href="/products/${encodeURIComponent(l.slug)}">${escapeHtml(l.name)}</a></h3>
            <p class="unit">${money(l.unitPrice)}</p>
            <div class="qty">
              <button type="button" data-qty="${escapeHtml(l.slug)}" data-step="-1" aria-label="Decrease quantity of ${escapeHtml(l.name)}">−</button>
              <input type="number" value="${l.qty}" min="1" max="${p.maxQty}" data-qty-input="${escapeHtml(l.slug)}" aria-label="Quantity of ${escapeHtml(l.name)}">
              <button type="button" data-qty="${escapeHtml(l.slug)}" data-step="1" aria-label="Increase quantity of ${escapeHtml(l.name)}" ${l.qty >= p.maxQty ? 'disabled' : ''}>+</button>
            </div>
            <button class="link-btn" type="button" data-remove="${escapeHtml(l.slug)}">Remove</button>
          </div>
          <div class="line-total">${money(l.total)}</div>
        </div>`;
      })
      .join('');

    root.innerHTML = `
      ${notices.map((n) => `<p class="notice">${escapeHtml(n)}</p>`).join('')}
      <div class="cart">
        <div>${lines}<p style="margin-top:24px"><a href="/products">← Continue shopping</a></p></div>
        <aside class="summary" aria-label="Order summary">
          <h2>Order summary</h2>
          <form class="code-form" id="code-form">
            <label class="visually-hidden" for="code">Discount code</label>
            <input class="input" id="code" name="code" placeholder="Discount code" value="${escapeHtml(quote.discount ? quote.discount.code : '')}" autocomplete="off">
            <button class="btn btn-outline" type="submit">Apply</button>
          </form>
          <p class="code-msg ${codeMessage ? (codeMessage.ok ? 'ok' : 'error') : ''}">${codeMessage ? escapeHtml(codeMessage.text) : ''}</p>
          <div class="summary-row"><span>Subtotal</span><span>${money(quote.subtotal)}</span></div>
          ${quote.discount ? `
            <div class="summary-row discount">
              <span>Discount (${escapeHtml(quote.discount.code)}) <button class="link-btn" type="button" id="remove-code">Remove</button></span>
              <span>−${money(quote.discount.amount)}</span>
            </div>` : ''}
          <div class="summary-row"><span>Shipping</span><span>${quote.shippingFrom === 0 ? 'Free' : `from ${money(quote.shippingFrom)}`}</span></div>
          ${freeOver ? `
            <p class="small" style="margin:12px 0 0">${remaining > 0 ? `Spend ${money(remaining)} more for free UK shipping.` : 'You qualify for free UK shipping.'}</p>
            <div class="progress" aria-hidden="true"><span style="width:${Math.min(100, (quote.afterDiscount / freeOver) * 100)}%"></span></div>` : ''}
          <div class="summary-row total"><span>Total</span><span>${money(quote.afterDiscount + quote.shippingFrom)}</span></div>
          <p class="small">Tax included. Shipping options are chosen at checkout.</p>
          <div id="checkout-error"></div>
          <button class="btn btn-block" type="button" id="checkout">Check out</button>
          <p class="small secure">${icons.lock} Secure payment by Stripe${s.demoMode ? ' (demo mode)' : ''}</p>
        </aside>
      </div>`;
    notices = [];
  }

  root.addEventListener('click', async (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      const slug = step.dataset.qty;
      const item = cart.items().find((i) => i.slug === slug);
      if (item) {
        cart.setQty(slug, item.qty + Number(step.dataset.step));
        render();
      }
      return;
    }
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      cart.remove(remove.dataset.remove);
      render();
      return;
    }
    if (e.target.id === 'remove-code') {
      cart.setCode('');
      codeMessage = null;
      render();
      return;
    }
    if (e.target.id === 'checkout') {
      const button = e.target;
      const errorBox = document.getElementById('checkout-error');
      button.disabled = true;
      button.textContent = 'Redirecting to secure checkout…';
      try {
        const { url } = await api('/api/checkout', { method: 'POST', body: { items: cart.items(), code: cart.code() } });
        location.href = url;
      } catch (err) {
        errorBox.innerHTML = `<p class="notice error">${escapeHtml(err.message)}</p>`;
        button.disabled = false;
        button.textContent = 'Check out';
        if (err.status === 409) setTimeout(render, 2500);
      }
    }
  });

  root.addEventListener('change', (e) => {
    const input = e.target.closest('[data-qty-input]');
    if (!input) return;
    const max = Number(input.max) || 99;
    const qty = Math.max(0, Math.min(Math.round(Number(input.value)) || 0, max));
    cart.setQty(input.dataset.qtyInput, qty);
    render();
  });

  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'code-form') return;
    e.preventDefault();
    const code = e.target.code.value.trim().toUpperCase();
    cart.setCode(code);
    codeMessage = code ? { ok: true, text: `Code ${code} applied.` } : null;
    render();
  });

  window.addEventListener('storage', render);
  render();
})();
