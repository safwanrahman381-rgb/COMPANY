(async function () {
  const { api, store, escapeHtml } = window.Shop;
  const root = document.getElementById('policy-root');
  const slug = location.pathname.split('/').filter(Boolean).pop();
  try {
    const [s, page] = await Promise.all([store, api(`/api/pages/${encodeURIComponent(slug)}`)]);
    document.title = `${page.title} | ${s.name}`;
    // Policy HTML comes from the shop's own data/pages.json.
    root.innerHTML = `
      <header class="page-head"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <span>${escapeHtml(page.title)}</span></nav><h1>${escapeHtml(page.title)}</h1></header>
      <div class="prose">${page.html}</div>`;
  } catch {
    root.innerHTML = '<div style="padding:96px 0;text-align:center"><h1>Page not <em>found</em></h1><p><a class="btn" href="/">Back to home</a></p></div>';
  }
})();
