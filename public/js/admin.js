(function () {
  const { money, escapeHtml } = window.Shop;
  const root = document.getElementById('admin-root');
  const KEY = 'shop.adminPassword';
  let password = '';
  try {
    password = sessionStorage.getItem(KEY) || '';
  } catch {
    /* session storage unavailable: log in each visit */
  }
  let tab = 'orders';

  async function adminApi(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(`admin:${password}`)}` },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function login(message) {
    root.innerHTML = `
      <form class="login" id="login-form">
        <h1 class="page-title">Shop admin</h1>
        ${message ? `<p class="notice error">${escapeHtml(message)}</p>` : ''}
        <div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-block" type="submit">Log in</button>
      </form>`;
    document.getElementById('pw').focus();
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      password = document.getElementById('pw').value;
      try {
        sessionStorage.setItem(KEY, password);
      } catch {
        /* ignore */
      }
      render();
    });
  }

  const date = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');

  function address(a) {
    if (!a) return '';
    return [a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).map(escapeHtml).join('<br>');
  }

  async function ordersTab() {
    const orders = await adminApi('/api/admin/orders');
    if (!orders.length) return '<p class="empty">No orders yet.</p>';
    return `<div class="table-wrap"><table>
      <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Fulfilment</th></tr></thead>
      <tbody>${orders.map((o) => `
        <tr>
          <td><strong>${escapeHtml(o.id.slice(0, 8).toUpperCase())}</strong><br><span class="small">${date(o.paidAt || o.createdAt)}</span>${o.demo ? '<br><span class="small">demo</span>' : ''}</td>
          <td>${escapeHtml(o.customer ? o.customer.name : '')}<br>
            ${o.customer && o.customer.email ? `<a href="mailto:${escapeHtml(o.customer.email)}">${escapeHtml(o.customer.email)}</a>` : ''}
            ${o.customer && o.customer.phone ? `<br>${escapeHtml(o.customer.phone)}` : ''}
            <br><span class="small">${address(o.customer && o.customer.address)}</span></td>
          <td>${o.items.map((l) => `${l.qty} × ${escapeHtml(l.name)}`).join('<br>')}${o.discountCode ? `<br><span class="small">Code: ${escapeHtml(o.discountCode)}</span>` : ''}</td>
          <td>${money(o.total)}</td>
          <td><span class="status ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></td>
          <td>
            <input class="input" placeholder="Tracking no." value="${escapeHtml(o.trackingNumber || '')}" data-tracking="${escapeHtml(o.id)}" style="margin-bottom:6px">
            <select class="select input" data-order-status="${escapeHtml(o.id)}">
              ${['paid', 'shipped', 'refunded', 'cancelled'].map((s) => `<option value="${s}"${o.status === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('')}
      </tbody></table></div>
      <p class="small">Refunds are issued in your Stripe dashboard. Mark the order "refunded" here afterwards.</p>`;
  }

  async function productsTab() {
    const products = await adminApi('/api/admin/products');
    return `<div class="table-wrap"><table>
      <thead><tr><th>Product</th><th>Price (pence)</th><th>Stock</th><th>Featured</th><th></th></tr></thead>
      <tbody>${products.map((p) => `
        <tr data-product="${escapeHtml(p.slug)}">
          <td><a href="/products/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">${escapeHtml(p.name)}</a></td>
          <td><input class="input" type="number" min="0" step="1" name="price" value="${p.price}" style="width:110px"> <span class="small">${money(p.price)}</span></td>
          <td><input class="input" type="number" min="0" step="1" name="stock" value="${p.stock}" style="width:90px"></td>
          <td><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''} aria-label="Featured"></td>
          <td><button class="btn btn-small" type="button" data-save-product>Save</button></td>
        </tr>`).join('')}
      </tbody></table></div>
      <p class="small">To add products or change names, descriptions and categories, edit <code>data/products.json</code>.</p>`;
  }

  async function messagesTab() {
    const messages = await adminApi('/api/admin/messages');
    if (!messages.length) return '<p class="empty">No messages yet.</p>';
    return messages.map((m) => `
      <div class="summary" style="position:static;margin-bottom:16px;${m.read ? 'opacity:.65' : ''}">
        <div class="summary-row"><strong>${escapeHtml(m.name)}</strong><span class="small">${date(m.createdAt)}</span></div>
        <p class="small"><a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>${m.orderNumber ? ` · Order ${escapeHtml(m.orderNumber)}` : ''}</p>
        <p style="white-space:pre-wrap">${escapeHtml(m.message)}</p>
        <button class="btn btn-small btn-outline" type="button" data-read="${escapeHtml(m.id)}" data-value="${m.read ? '' : '1'}">${m.read ? 'Mark unread' : 'Mark read'}</button>
      </div>`).join('');
  }

  async function render() {
    if (!password) return login();
    let summary;
    try {
      summary = await adminApi('/api/admin/summary');
    } catch (err) {
      if (err.status === 401) {
        password = '';
        try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
        return login('Wrong password.');
      }
      root.innerHTML = `<p class="notice error">${escapeHtml(err.message)}</p>`;
      return;
    }

    let body;
    try {
      body = await { orders: ordersTab, products: productsTab, messages: messagesTab }[tab]();
    } catch (err) {
      body = `<p class="notice error">${escapeHtml(err.message)}</p>`;
    }

    const tabBtn = (id, label) => `<button class="btn btn-small ${tab === id ? '' : 'btn-outline'}" type="button" data-tab="${id}">${label}</button>`;
    root.innerHTML = `
      <div class="summary-row" style="align-items:center"><h1 style="margin:0">Dashboard</h1><button class="link-btn" type="button" id="logout">Log out</button></div>
      ${summary.demoMode ? '<p class="notice">Demo mode: Stripe isn\'t configured, so orders here are test orders.</p>' : ''}
      <div class="stats" style="margin-top:24px">
        <div class="stat"><div class="num">${money(summary.revenue)}</div><div class="lbl">Revenue</div></div>
        <div class="stat"><div class="num">${summary.paidOrders}</div><div class="lbl">Paid orders</div></div>
        <div class="stat"><div class="num">${summary.toShip}</div><div class="lbl">To ship</div></div>
        <div class="stat"><div class="num">${summary.unreadMessages}</div><div class="lbl">Unread messages</div></div>
      </div>
      ${summary.lowStock.length ? `<p class="notice">Low stock: ${summary.lowStock.map((p) => `${escapeHtml(p.name)} (${p.stock})`).join(', ')}</p>` : ''}
      <div class="tabs">${tabBtn('orders', 'Orders')}${tabBtn('products', 'Products & stock')}${tabBtn('messages', `Messages${summary.unreadMessages ? ` (${summary.unreadMessages})` : ''}`)}</div>
      <div id="flash" aria-live="polite"></div>
      ${body}`;
  }

  function flash(text, ok = true) {
    const el = document.getElementById('flash');
    if (el) el.innerHTML = `<p class="notice ${ok ? 'success' : 'error'}">${escapeHtml(text)}</p>`;
  }

  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.tab) {
      tab = t.dataset.tab;
      return render();
    }
    if (t.id === 'logout') {
      password = '';
      try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
      return login();
    }
    if (t.dataset.saveProduct !== undefined) {
      const row = t.closest('[data-product]');
      try {
        await adminApi(`/api/admin/products/${encodeURIComponent(row.dataset.product)}`, {
          method: 'PATCH',
          body: {
            price: Number(row.querySelector('[name=price]').value),
            stock: Number(row.querySelector('[name=stock]').value),
            featured: row.querySelector('[name=featured]').checked,
          },
        });
        await render();
        flash('Product saved.');
      } catch (err) {
        flash(err.message, false);
      }
    }
    if (t.dataset.read !== undefined) {
      await adminApi(`/api/admin/messages/${encodeURIComponent(t.dataset.read)}`, { method: 'PATCH', body: { read: !!t.dataset.value } });
      render();
    }
  });

  root.addEventListener('change', async (e) => {
    const t = e.target;
    const id = t.dataset.orderStatus || t.dataset.tracking;
    if (!id) return;
    try {
      await adminApi(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: t.dataset.orderStatus ? { status: t.value } : { trackingNumber: t.value },
      });
      await render();
      flash('Order updated.');
    } catch (err) {
      flash(err.message, false);
    }
  });

  render();
})();
