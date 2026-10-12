(async function () {
  const { api, store } = window.Shop;
  const root = document.getElementById('policy-root');
  const slug = location.pathname.split('/').filter(Boolean).pop();
  try {
    const [s, page] = await Promise.all([store, api(`/api/pages/${encodeURIComponent(slug)}`)]);
    document.title = `${page.title} | ${s.name}`;
    const h1 = document.createElement('h1');
    h1.className = 'page-title';
    h1.textContent = page.title;
    const body = document.createElement('div');
    body.innerHTML = page.html; // policy HTML comes from the shop's own data/pages.json
    root.replaceChildren(h1, body);
  } catch {
    root.innerHTML = '<h1 class="page-title">Page not found</h1><p class="center"><a href="/">Back to home</a></p>';
  }
})();
