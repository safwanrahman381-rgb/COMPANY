/* booked.html: personalised greeting.
   GoHighLevel redirects here as booked.html?name={{contact.first_name}}. If the name is missing,
   blank, or the merge field arrives unfilled (e.g. the literal "{{contact.first_name}}"), the
   default greeting in the HTML stays. The name is only ever inserted as text. */
(() => {
  'use strict';
  const title = document.getElementById('bookedTitle');
  if (!title) return;
  let name = '';
  try { name = (new URLSearchParams(location.search).get('name') || '').replace(/\s+/g, ' ').trim(); } catch (e) { return; }
  if (!name || /^\{\{[\s\S]*\}\}$/.test(name)) return;
  name = Array.from(name).slice(0, 40).join('').trim(); // 40 characters, without splitting an emoji in half
  title.textContent = `Thanks, ${name} — you're booked in.`;
})();
