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
      <h1 class="page-title">Thank you!</h1>
      <p class="center">Your order has been received. You'll get a confirmation email from Stripe shortly.</p>
      <p class="center"><a class="btn" href="/products">Continue shopping</a></p>`;
    return;
  }

  const rows = order.items
    .map((l) => `<div class="summary-row"><span>${escapeHtml(l.name)} × ${l.qty}</span><span>${money(l.total)}</span></div>`)
    .join('');
  root.innerHTML = `
    <h1 class="page-title">Thank you for your order!</h1>
    <p class="center">Order reference <strong>${escapeHtml(order.reference)}</strong></p>
    <p class="center">${order.status === 'pending'
      ? 'We\'re confirming your payment. You\'ll get an email as soon as it\'s done.'
      : `We've received your payment${order.email ? ` and sent a receipt to <strong>${escapeHtml(order.email)}</strong>` : ''}. We'll email you again when your order ships.`}</p>
    <div class="summary" style="position:static;margin:32px 0">
      <h2>Order summary</h2>
      ${rows}
      <div class="summary-row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
      ${order.discountAmount ? `<div class="summary-row discount"><span>Discount</span><span>−${money(order.discountAmount)}</span></div>` : ''}
      <div class="summary-row"><span>Shipping</span><span>${order.shippingAmount ? money(order.shippingAmount) : 'Free'}</span></div>
      <div class="summary-row total"><span>Total paid</span><span>${money(order.total)}</span></div>
    </div>
    <p class="center"><a class="btn" href="/products">Continue shopping</a></p>`;
})();
