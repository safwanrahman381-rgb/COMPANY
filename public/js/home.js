(async function () {
  const { api, productCard, store } = window.Shop;
  const grid = document.getElementById('featured');
  try {
    const [s, featured] = await Promise.all([store, api('/api/products?featured=1')]);
    document.querySelector('[data-store-name]').textContent = s.name;
    grid.innerHTML = featured.slice(0, s.featuredLimit).map(productCard).join('') || '<p class="empty">New products coming soon.</p>';
  } catch {
    grid.innerHTML = '<p class="empty">Couldn\'t load products. Please refresh the page.</p>';
  }
})();
