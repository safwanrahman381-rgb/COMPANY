(function () {
  const { api, escapeHtml, store } = window.Shop;
  const form = document.getElementById('contact-form');
  const status = document.getElementById('contact-status');

  store.then((s) => {
    document.querySelector('[data-contact-email]').innerHTML = `<a href="mailto:${escapeHtml(s.contactEmail)}">${escapeHtml(s.contactEmail)}</a>`;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.name.trim() || !data.message.trim() || !/^\S+@\S+\.\S+$/.test(data.email)) {
      status.innerHTML = '<p class="notice error">Please fill in your name, a valid email and a message.</p>';
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await api('/api/contact', { method: 'POST', body: data });
      form.reset();
      form.hidden = true;
      status.innerHTML = '<p class="notice success">Thanks! Your message has been sent and we\'ll get back to you within 1 working day.</p>';
    } catch (err) {
      status.innerHTML = `<p class="notice error">${escapeHtml(err.message)}</p>`;
    } finally {
      button.disabled = false;
      button.textContent = 'Send message';
    }
  });
})();
