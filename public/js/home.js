(async function () {
  const { allProducts, productCard, escapeHtml, money, moneyShort, icons, store } = window.Shop;
  const grid = document.getElementById('featured');
  let s;
  let products;
  try {
    [s, products] = await Promise.all([store, allProducts()]);
  } catch {
    grid.innerHTML = '<p class="empty">Couldn\'t load products. Please refresh the page.</p>';
    return;
  }

  const freeOver = s.shipping.freeOver;
  const standard = s.shipping.options[0];
  document.querySelector('[data-hero-points]').innerHTML = [
    'Genuine, sealed products',
    standard ? `UK delivery from ${money(standard.amount)}` : 'Tracked UK delivery',
    'Secure checkout',
  ].map((t) => `<li>${icons.check}${escapeHtml(t)}</li>`).join('');

  document.querySelector('[data-trust]').innerHTML = [
    [icons.shield, 'Genuine products', 'Sourced from licensed manufacturers'],
    [icons.truck, freeOver ? `Free delivery over ${moneyShort(freeOver)}` : 'Tracked delivery', standard ? `Otherwise ${money(standard.amount)}, ${standard.minDays}–${standard.maxDays} working days` : 'Across the UK'],
    [icons.box, 'Discreet packaging', 'Plain, unbranded parcels'],
    [icons.chat, 'Real support', 'Replies within 1 working day'],
  ].map(([icon, title, text]) => `<div class="trust-item">${icon}<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div></div>`).join('');

  if (standard) {
    document.querySelector('[data-faq-delivery]').textContent =
      `Standard UK delivery is ${money(standard.amount)} (${standard.minDays}–${standard.maxDays} working days)${freeOver ? `, and free on orders over ${moneyShort(freeOver)}` : ''}.`;
  }

  // Hero: the first two featured in-stock products.
  const heroes = products.filter((p) => p.featured && p.inStock).slice(0, 2);
  if (heroes.length) {
    const [main, side] = heroes;
    document.querySelector('[data-hero-visual]').innerHTML = `
      <div class="main-shot"><img src="${escapeHtml(main.image)}" alt="${escapeHtml(main.name)}" width="700" height="700"></div>
      ${side ? `<div class="side-shot"><img src="${escapeHtml(side.image)}" alt="${escapeHtml(side.name)}" width="700" height="700"></div>` : ''}
      <a class="float-card" href="/products/${encodeURIComponent(main.slug)}">
        <div><strong>${escapeHtml(main.name)}</strong><span>${escapeHtml(main.badge || main.form)} · ${money(main.price)}</span></div>
        <span class="go" aria-hidden="true">→</span>
      </a>`;
  }

  document.querySelector('[data-concerns]').innerHTML = s.categories
    .map((c, i) => {
      const inCat = products.filter((p) => p.category === c.slug);
      const from = inCat.length ? Math.min(...inCat.map((p) => p.price)) : null;
      return `
        <a class="concern" href="/products?category=${encodeURIComponent(c.slug)}">
          <span class="num">0${i + 1}</span>
          <h3>${escapeHtml(c.concern)}</h3>
          <p>${escapeHtml(c.blurb)}</p>
          <span class="meta"><span>${inCat.length} ${inCat.length === 1 ? 'product' : 'products'}</span><span>${from != null ? `from ${moneyShort(from)}` : 'Shop'} →</span></span>
        </a>`;
    })
    .join('');

  const featured = products.filter((p) => p.featured);
  const list = featured.filter((p) => p.inStock).concat(featured.filter((p) => !p.inStock)).slice(0, s.featuredLimit);
  grid.innerHTML = list.map(productCard).join('') || '<p class="empty">New treatments coming soon.</p>';
})();
