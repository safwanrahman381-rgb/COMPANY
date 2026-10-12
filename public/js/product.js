(async function () {
  const { api, allProducts, cart, money, moneyShort, escapeHtml, productCard, icons, openBag, store } = window.Shop;
  const root = document.getElementById('product-root');
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop());

  let p;
  let s;
  try {
    [s, p] = await Promise.all([store, api(`/api/products/${encodeURIComponent(slug)}`)]);
  } catch (err) {
    root.innerHTML = `<div style="padding:96px 0;text-align:center"><h1>${err.status === 404 ? 'Product not <em>found</em>' : 'Something went wrong'}</h1><p><a class="btn" href="/products">Shop treatments</a></p></div>`;
    return;
  }

  document.title = `${p.name} | ${s.name}`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && p.summary) desc.setAttribute('content', p.summary);

  const all = await allProducts().catch(() => []);
  const siblings = all.filter((x) => x.group === p.group);
  const standard = s.shipping.options[0];

  root.innerHTML = `
    <div class="product">
      <div class="product-media">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" width="700" height="700">
        ${p.inStock ? '' : '<span class="badge out">Sold out</span>'}
      </div>
      <div class="product-info">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a> / <a href="/products">Shop</a>
          ${p.categoryName ? ` / <a href="/products?category=${encodeURIComponent(p.category)}">${escapeHtml(p.categoryName)}</a>` : ''}
        </nav>
        <p class="eyebrow">${escapeHtml(p.concern)}</p>
        <h1>${escapeHtml(p.name)}</h1>
        <p class="product-summary">${escapeHtml(p.summary)}</p>
        <p class="product-price">${money(p.price)}</p>
        <p class="stock${p.inStock ? '' : ' out'}">${p.inStock ? (p.maxQty <= 3 ? `Only ${p.maxQty} left` : 'In stock · dispatched within 1 working day') : 'Sold out'}</p>

        ${siblings.length > 1 ? `
          <p class="option-label">Choose ${siblings.every((x) => x.form === p.form) ? 'strength' : 'option'}</p>
          <div class="pills">${siblings.map((x) => `
            <a class="pill${x.slug === p.slug ? ' active' : ''}${x.inStock ? '' : ' disabled'}" href="/products/${encodeURIComponent(x.slug)}"${x.slug === p.slug ? ' aria-current="page"' : ''}>
              ${escapeHtml(siblings.every((y) => y.form === p.form) ? x.strength : `${x.form} ${x.strength}`)}
            </a>`).join('')}
          </div>` : ''}

        <dl class="facts">
          <div><dt>Strength</dt><dd>${escapeHtml(p.strength || '–')}</dd></div>
          <div><dt>Form</dt><dd>${escapeHtml(p.form || '–')}</dd></div>
          <div><dt>Size</dt><dd>${escapeHtml(p.size || '–')}</dd></div>
        </dl>

        ${p.inStock ? `
          <div class="buy-row">
            <div class="qty">
              <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
              <input id="qty" type="number" min="1" max="${p.maxQty}" value="1" inputmode="numeric" aria-label="Quantity">
              <button type="button" data-step="1" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn" type="button" id="add-to-cart">Add to bag · ${money(p.price)}</button>
          </div>` : '<button class="btn btn-block btn-ghost" type="button" disabled>Sold out</button>'}

        <div class="delivery-box">
          <div>${icons.truck}<span>${standard ? `Standard delivery ${money(standard.amount)}, ${standard.minDays}–${standard.maxDays} working days` : 'Tracked UK delivery'}${s.shipping.freeOver ? ` · free over ${moneyShort(s.shipping.freeOver)}` : ''}</span></div>
          <div>${icons.box}<span>Sent in plain, discreet packaging</span></div>
          <div>${icons.return}<span>Unopened items can be returned within 14 days</span></div>
        </div>

        <div class="accordion">
          <details open><summary>About this product</summary><div class="content">${escapeHtml(p.description)}</div></details>
          ${p.howToUse ? `<details><summary>How to use</summary><div class="content">${escapeHtml(p.howToUse)}</div></details>` : ''}
          ${p.ingredients ? `<details><summary>Ingredients</summary><div class="content">${escapeHtml(p.ingredients)} Always read the leaflet in the pack before use.</div></details>` : ''}
          <details><summary>Delivery &amp; returns</summary><div class="content">See our <a href="/policies/shipping">delivery</a> and <a href="/policies/returns">returns</a> policies.</div></details>
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
      openBag();
    });
  }

  // Related: other treatments first (siblings already have the strength picker), then anything else.
  const related = all.filter((x) => x.group !== p.group && x.inStock).slice(0, 4);
  if (related.length) {
    document.getElementById('related').innerHTML = related.map(productCard).join('');
    document.getElementById('related-section').hidden = false;
  }
})();
