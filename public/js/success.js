(async function () {
  const { api, cart, money, escapeHtml, store } = window.Shop;
  const root = document.getElementById('success-root');
  const params = new URLSearchParams(location.search);
  const query = params.get('session_id') ? `session_id=${encodeURIComponent(params.get('session_id'))}` : `order=${encodeURIComponent(params.get('order') || '')}`;

  // Reaching this page means checkout completed, so the cart is done with.
  cart.clear();
  cart.setCode('');

  // Stripe's webhook can land a moment after the customer is redirected back, so poll briefly.
  let order;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      order = await api(`/api/order?${query}`);
      if (order.status !== 'pending') break;
    } catch {
      order = null;
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  await store;

  if (!order) {
    root.innerHTML = `
      <p class="eyebrow">Order received</p>
      <h1>Thank <em>you!</em></h1>
      <p>Your order has been received. We'll email you when it ships.</p>
      <p><a class="btn" href="/products">Continue shopping</a></p>`;
    return;
  }

  const rows = order.items
    .map((l) => `<div class="row"><span>${escapeHtml(l.name)} × ${l.qty}</span><span>${money(l.total)}</span></div>`)
    .join('');
  root.innerHTML = `
    <p class="eyebrow">Order ${escapeHtml(order.reference)}</p>
    <h1>Thank you for <em>your order</em></h1>
    <p>${order.status === 'pending'
      ? 'We\'re confirming your payment. This page will update in a moment.'
      : 'We\'ve received your payment. We\'ll email you when your order ships.'}</p>
    <div class="summary" style="position:static;margin:32px 0">
      <h2>Order summary</h2>
      ${rows}
      <div class="row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
      ${order.discountAmount ? `<div class="row discount"><span>Discount</span><span>−${money(order.discountAmount)}</span></div>` : ''}
      <div class="row"><span>Shipping</span><span>${order.shippingAmount ? money(order.shippingAmount) : 'Free'}</span></div>
      <div class="row total"><span>Total paid</span><span>${money(order.total)}</span></div>
    </div>
    <p><a class="btn" href="/products">Continue shopping</a></p>`;
})();
