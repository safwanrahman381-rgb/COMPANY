(async function () {
  const { allProducts, productCard, escapeHtml, store } = window.Shop;
  const params = new URLSearchParams(location.search);
  const category = params.get('category') || '';
  const q = (params.get('q') || '').trim();
  const grid = document.getElementById('product-grid');
  const sortSelect = document.getElementById('sort');
  const inStockBox = document.getElementById('in-stock');
  let products = [];

  function render() {
    let list = products.slice();
    if (inStockBox.checked) list = list.filter((p) => p.inStock);
    const sort = sortSelect.value;
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    // Recommended: in stock first, featured next, then the order in the catalogue.
    if (sort === 'featured') list.sort((a, b) => Number(b.inStock) - Number(a.inStock) || Number(b.featured) - Number(a.featured));
    document.getElementById('result-count').textContent = `${list.length} ${list.length === 1 ? 'product' : 'products'}`;
    grid.innerHTML = list.map(productCard).join('') || `<p class="empty">No products found${q ? ` for “${escapeHtml(q)}”` : ''}. <a class="arrow-link" href="/products">See all treatments →</a></p>`;
  }

  try {
    const [s, all] = await Promise.all([store, allProducts()]);
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    products = all.filter((p) => {
      if (category && p.category !== category) return false;
      const hay = `${p.name} ${p.categoryName} ${p.concern} ${p.form} ${p.summary}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });

    const current = s.categories.find((c) => c.slug === category);
    const title = q ? `Results for “${q}”` : current ? current.name : 'All treatments';
    document.getElementById('products-title').textContent = title;
    document.getElementById('products-intro').textContent = current ? current.blurb : q ? 'Matching treatments from our range.' : 'Clinical-strength treatments for acne, texture, redness and pigmentation.';
    document.title = `${title} | ${s.name}`;
    const search = document.getElementById('site-search');
    if (search && q) search.value = q;

    const link = (slug, name, count) =>
      `<li><a class="${slug === category && !q ? 'active' : ''}" href="/products${slug ? `?category=${encodeURIComponent(slug)}` : ''}">${escapeHtml(name)} <span class="count">${count}</span></a></li>`;
    document.getElementById('category-filter').innerHTML =
      link('', 'All treatments', all.length) + s.categories.map((c) => link(c.slug, c.name, all.filter((p) => p.category === c.slug).length)).join('');
    render();
  } catch {
    grid.innerHTML = '<p class="empty">Couldn\'t load products. Please refresh the page.</p>';
  }

  sortSelect.addEventListener('change', render);
  inStockBox.addEventListener('change', render);
})();
