(async function () {
  const { api, cart, money, escapeHtml, productCard, toast, store } = window.Shop;
  const root = document.getElementById('product-root');
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop());

  let p;
  try {
    [, p] = await Promise.all([store, api(`/api/products/${encodeURIComponent(slug)}`)]);
  } catch (err) {
    root.innerHTML = `<div class="prose center"><h1 class="page-title">${err.status === 404 ? 'Product not found' : 'Something went wrong'}</h1><p><a class="btn" href="/products">Browse products</a></p></div>`;
    return;
  }

  const s = await store;
  document.title = `${p.name} | ${s.name}`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && p.description) desc.setAttribute('content', p.description);

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/products">Products</a>
      ${p.categoryName ? ` / <a href="/products?category=${encodeURIComponent(p.category)}">${escapeHtml(p.categoryName)}</a>` : ''}
    </nav>
    <div class="product">
      <div class="product-media">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" width="800" height="800">
        ${p.inStock ? '' : '<span class="badge">Sold out</span>'}
      </div>
      <div class="product-info">
        <h1>${escapeHtml(p.name)}</h1>
        <p class="product-price">${money(p.price)}</p>
        <p class="stock${p.inStock ? '' : ' out'}">${p.inStock ? (p.maxQty <= 3 ? `Only ${p.maxQty} left in stock` : 'In stock, ready to ship') : 'Sold out'}</p>
        ${p.inStock ? `
          <label for="qty">Quantity</label>
          <div class="buy-row">
            <div class="qty">
              <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
              <input id="qty" type="number" min="1" max="${p.maxQty}" value="1" inputmode="numeric">
              <button type="button" data-step="1" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn" type="button" id="add-to-cart">Add to cart</button>
          </div>
          <button class="btn btn-outline btn-block" type="button" id="buy-now">Buy it now</button>
        ` : '<button class="btn btn-block" type="button" disabled>Sold out</button>'}
        <p>${escapeHtml(p.description)}</p>
        <div class="details">
          ${p.howToUse ? `<details><summary>How to use</summary><div class="content">${escapeHtml(p.howToUse)}</div></details>` : ''}
          ${p.ingredients ? `<details><summary>Ingredients</summary><div class="content">${escapeHtml(p.ingredients)}</div></details>` : ''}
          <details><summary>Shipping and returns</summary><div class="content">
            UK delivery from ${money(Math.min(...s.shipping.options.map((o) => o.amount)))}${s.shipping.freeOver ? `, free on orders over ${money(s.shipping.freeOver)}` : ''}.
            Unopened items can be returned within 14 days. <a href="/policies/shipping">Shipping</a> · <a href="/policies/returns">Returns</a>
          </div></details>
        </div>
      </div>
    </div>`;

  if (p.inStock) {
    const qtyInput = document.getElementById('qty');
    const clampQty = () => {
      const n = Math.round(Number(qtyInput.value)) || 1;
      qtyInput.value = Math.max(1, Math.min(n, p.maxQty));
      return Number(qtyInput.value);
    };
    root.querySelectorAll('[data-step]').forEach((btn) =>
      btn.addEventListener('click', () => {
        qtyInput.value = Number(qtyInput.value) + Number(btn.dataset.step);
        clampQty();
      })
    );
    qtyInput.addEventListener('change', clampQty);

    document.getElementById('add-to-cart').addEventListener('click', () => {
      cart.add(p.slug, clampQty(), p.maxQty);
      toast(`Added to cart <a href="/cart">View cart</a>`);
    });
    document.getElementById('buy-now').addEventListener('click', () => {
      cart.add(p.slug, clampQty(), p.maxQty);
      location.href = '/cart';
    });
  }

  try {
    const sameCategory = await api(`/api/products?category=${encodeURIComponent(p.category)}`);
    let related = sameCategory.filter((x) => x.slug !== p.slug);
    if (related.length < 3) {
      const all = await api('/api/products');
      related = related.concat(all.filter((x) => x.slug !== p.slug && !related.some((r) => r.slug === x.slug)));
    }
    related = related.filter((x) => x.inStock).concat(related.filter((x) => !x.inStock)).slice(0, 3);
    if (related.length) {
      document.getElementById('related').innerHTML = related.map(productCard).join('');
      document.getElementById('related-section').hidden = false;
    }
  } catch {
    /* related products are optional */
  }
})();
