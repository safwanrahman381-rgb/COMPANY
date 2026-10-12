(async function () {
  const { api, productCard, escapeHtml, store } = window.Shop;
  const params = new URLSearchParams(location.search);
  const category = params.get('category') || '';
  const q = params.get('q') || '';
  const grid = document.getElementById('product-grid');
  const sortSelect = document.getElementById('sort');
  let products = [];

  function render() {
    const list = products.slice();
    const sort = sortSelect.value;
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    // In-stock items first, so sold-out products don't crowd the top of the page.
    if (sort === 'featured') list.sort((a, b) => Number(b.inStock) - Number(a.inStock));
    grid.innerHTML = list.map(productCard).join('') || `<p class="empty">No products found${q ? ` for “${escapeHtml(q)}”` : ''}.</p>`;
  }

  try {
    const query = new URLSearchParams();
    if (category) query.set('category', category);
    if (q) query.set('q', q);
    const [s, list] = await Promise.all([store, api(`/api/products?${query}`)]);
    products = list;

    const current = s.categories.find((c) => c.slug === category);
    const title = q ? `Search: “${q}”` : current ? current.name : 'Products';
    document.getElementById('products-title').textContent = title;
    document.title = `${title} | ${s.name}`;
    const search = document.getElementById('site-search');
    if (search && q) search.value = q;

    const chip = (slug, name) =>
      `<a class="chip${slug === category && !q ? ' active' : ''}" href="/products${slug ? `?category=${encodeURIComponent(slug)}` : ''}">${escapeHtml(name)}</a>`;
    document.getElementById('category-chips').innerHTML = chip('', 'All') + s.categories.map((c) => chip(c.slug, c.name)).join('');
    render();
  } catch {
    grid.innerHTML = '<p class="empty">Couldn\'t load products. Please refresh the page.</p>';
  }

  sortSelect.addEventListener('change', render);
})();
