(() => {
'use strict';

/* ---------------------------------------------------------
   CONFIG — connect real services here when deployed.
   Nothing secret ever goes in this file.
   --------------------------------------------------------- */
const CONFIG = {
  // Serverless endpoint for the "Talk to Blackline" demo, e.g. '/api/ai'.
  // Should accept POST {message} and return {headline, steps:[[title, detail, isHuman]], notes:[[label, text]]}.
  // Keep the model API key on the server, never in this file. Leave null to use the in-browser rule engine.
  // If you turn it on: the Talk badge switches to a "text is sent to an AI provider" notice, privacy.html must
  // name the AI provider, and an endpoint on another origin must be added to connect-src in _headers.
  aiEndpoint: null,
  // Formspree form that receives project briefs (POSTed as JSON). Replace the placeholder with the
  // form ID from your Formspree dashboard. Until then nothing is sent and visitors get the email fallback.
  contactEndpoint: 'https://formspree.io/f/[FORMSPREE_FORM_ID]',
  // Shown with a mailto: link if sending fails.
  contactEmail: '[CONTACT_EMAIL]',
  // Analytics or marketing trackers that need consent. Keep this EMPTY until you need one: while it's empty
  // no cookie banner renders, no cookies are set and nothing third-party loads. See "Consent" below.
  trackers: []
};

/* ---------------------------------------------------------
   Core
   --------------------------------------------------------- */
const doc = document, root = doc.documentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (RM) root.classList.add('rm');
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = doc) => r.querySelector(s);
const $$ = (s, r = doc) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eout = t => 1 - Math.pow(1 - t, 3);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, RM ? 0 : ms));
let VW = innerWidth, VH = innerHeight;

// one IntersectionObserver for everything
const watchers = new Map();
const io = new IntersectionObserver(es => es.forEach(e => { const cb = watchers.get(e.target); if (cb) cb(e.isIntersecting, e); }), { rootMargin: '120px 0px' });
const watch = (el, cb) => { watchers.set(el, cb); io.observe(el); };

// one scroll loop for everything
const scrollFns = [], resizeFns = [];
let ticking = false;
const runScroll = () => { ticking = false; const y = scrollY; for (const f of scrollFns) f(y); };
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }, { passive: true });
let rzT;
addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { VW = innerWidth; VH = innerHeight; resizeFns.forEach(f => f()); runScroll(); }, 120); });
const pinProgress = el => { const r = el.getBoundingClientRect(); const tot = r.height - VH; return tot <= 0 ? 1 : clamp(-r.top / tot); };

// pause CSS animations in sections that are off screen
$$('.sec, .thesis, .chaos').forEach(s => watch(s, v => s.classList.toggle('is-off', !v)));

function countTo(el, from, to, dur = 700) {
  if (RM) { el.textContent = to; return; }
  const t0 = performance.now();
  const f = now => { const k = clamp((now - t0) / dur); el.textContent = Math.round(lerp(from, to, eout(k))); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function scramble(el, text, dur = 520) {
  if (RM) { el.textContent = text; return; }
  const G = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#';
  const t0 = performance.now();
  const f = now => {
    const k = clamp((now - t0) / dur), n = Math.floor(text.length * k);
    let out = text.slice(0, n);
    for (let i = n; i < text.length; i++) out += text[i] === ' ' ? ' ' : G[(Math.random() * G.length) | 0];
    el.textContent = out;
    if (k < 1) requestAnimationFrame(f); else el.textContent = text;
  };
  requestAnimationFrame(f);
}
const norm = s => Array.isArray(s) ? s : [s];
function flowHTML(steps) {
  return `<ol class="flow${RM ? '' : ' run'}">${steps.map((s, i) => {
    const [t, sub, h] = norm(s);
    return `<li class="fnode${h ? ' is-human' : ''}" style="--i:${i}"><span class="ft">${esc(t)}${h ? ' <span class="tag ht">Human</span>' : ''}</span>${sub ? `<span class="fs">${esc(sub)}</span>` : ''}</li>`;
  }).join('')}</ol>`;
}
function mountFlow(el, steps) {
  el.innerHTML = flowHTML(steps);
  const ol = el.firstElementChild;
  requestAnimationFrame(() => ol.style.setProperty('--fh', Math.max(40, ol.offsetHeight - 14) + 'px'));
  return ol;
}
function chainHTML(steps) {
  return `<ol class="chain">${steps.map((s, i) => { const [t, , h] = norm(s); return `<li style="--i:${i}">${i ? '<span class="ar" aria-hidden="true">→</span>' : ''}<span class="cn${h ? ' h' : ''}">${esc(t)}</span></li>`; }).join('')}</ol>`;
}
const joinAnd = a => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}

/* ---------------------------------------------------------
   Word reveal on headings
   --------------------------------------------------------- */
$$('[data-reveal]').forEach(el => {
  const text = el.textContent.trim();
  el.innerHTML = `<span class="sr">${esc(text)}</span>` + text.split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true"><span style="--wi:${i}">${esc(w)}</span></span>`).join(' ');
  if (RM) el.classList.add('in'); else watch(el, v => { if (v) el.classList.add('in'); });
});

/* ---------------------------------------------------------
   04 Loader — ~1.9s on arrival. Skipped when coming from another page of this site
   (e.g. back from the privacy policy) or with reduced motion. Nothing is stored on the device.
   --------------------------------------------------------- */
(() => {
  const L = $('#loader');
  let fromHere = false;
  try { fromHere = !!doc.referrer && new URL(doc.referrer).origin === location.origin; } catch (e) {}
  const done = () => { doc.body.classList.remove('is-loading'); };
  if (RM || fromHere) { L.classList.add('done'); done(); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    L.classList.add('s1');
    setTimeout(() => L.classList.add('s2'), 420);
    setTimeout(() => { L.classList.add('s3'); done(); }, 1250);
    setTimeout(() => L.classList.add('done'), 2100);
  }));
})();

/* ---------------------------------------------------------
   Consent — dormant. Nothing below runs while CONFIG.trackers is empty.
   When it has entries: a banner with equal Accept / Reject buttons, the choice kept in a
   first-party cookie (bl_consent, 6 months), every tracker blocked until Accept, and a
   "Cookie settings" link in the footer (or /#cookie-settings from any page) to reopen it.

   Adding the Meta Pixel later:
   1. Update privacy.html at the same time: what the pixel collects, that Meta receives it,
      how long it's kept, and that the lawful basis is your consent.
   2. Add an entry to CONFIG.trackers:
        { name: 'the Meta Pixel', load() {
            // Meta's base code, but built here instead of pasted into the page: define window.fbq,
            // add <script src="https://connect.facebook.net/en_US/fbevents.js"> with
            // document.createElement('script'), then fbq('init', 'YOUR_PIXEL_ID'); fbq('track', 'PageView');
        } }
      The pixel must only ever run inside load(), which is only called after Accept.
      Don't paste Meta's <script> or <noscript> snippet into the HTML.
   3. Allow Meta in the Content-Security-Policy in _headers:
        script-src https://connect.facebook.net; img-src https://www.facebook.com; connect-src https://www.facebook.com
   4. Add <a href="/#cookie-settings">Cookie settings</a> to the footers of privacy.html, terms.html,
      accessibility.html and 404.html (they don't run this script).
   --------------------------------------------------------- */
(() => {
  const T = CONFIG.trackers;
  if (!Array.isArray(T) || !T.length) return;
  const KEY = 'bl_consent', MAX_AGE = 60 * 60 * 24 * 182;
  const read = () => (doc.cookie.match(/(?:^|;\s*)bl_consent=(accept|reject)(?:;|$)/) || [])[1] || null;
  const write = v => { doc.cookie = `${KEY}=${v}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; };
  let loaded = false;
  const load = () => { if (loaded) return; loaded = true; T.forEach(t => { try { t.load(); } catch (e) { /* one tracker failing shouldn't break the page */ } }); };
  const names = joinAnd(T.map(t => t.name));
  const bar = doc.createElement('div');
  bar.className = 'consent'; bar.hidden = true;
  bar.setAttribute('role', 'region'); bar.setAttribute('aria-labelledby', 'consentT');
  bar.innerHTML = `<p class="mono" id="consentT">Cookies</p><p>We'd like to use ${esc(names)} to understand how the site is used. This sets cookies, and nothing runs unless you accept. You can change your mind at any time from "Cookie settings" at the bottom of the page. <a href="privacy.html">Privacy Policy</a></p>
    <div class="btn-row"><button type="button" class="btn btn-g btn-s" data-c="reject"><span>Reject</span></button><button type="button" class="btn btn-g btn-s" data-c="accept"><span>Accept</span></button></div>`;
  doc.body.appendChild(bar);
  const open = focus => { bar.hidden = false; if (focus) $('button', bar).focus(); };
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const v = b.dataset.c;
    write(v); bar.hidden = true;
    if (location.hash === '#cookie-settings') history.replaceState(null, '', location.pathname + location.search);
    if (v === 'accept') load();
    else if (loaded) location.reload(); // trackers can't be unloaded, so reload the page without them
  });
  const link = $('#cookieSettings');
  if (link) { link.hidden = false; link.addEventListener('click', () => open(true)); }
  addEventListener('hashchange', () => { if (location.hash === '#cookie-settings') open(true); });
  const choice = read();
  if (choice === 'accept') load();
  if (!choice || location.hash === '#cookie-settings') open(location.hash === '#cookie-settings');
})();

/* ---------------------------------------------------------
   Nav, rail, progress
   --------------------------------------------------------- */
(() => {
  const nav = $('#nav'), tog = $('#navTog'), links = $('#navLinks');
  const setOpen = o => { links.classList.toggle('open', o); tog.setAttribute('aria-expanded', o); doc.body.style.overflow = o ? 'hidden' : ''; };
  tog.addEventListener('click', () => setOpen(!links.classList.contains('open')));
  links.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && links.classList.contains('open')) { setOpen(false); tog.focus(); } });

  const rail = $('#rail'), track = $('.track', rail), fill = $('#railFill'), bar = $('#topbar');
  const secs = $$('[data-rail]');
  const ticks = secs.map(s => {
    const a = doc.createElement('a');
    a.className = 'tick'; a.href = '#' + s.id; a.innerHTML = `<span>${esc(s.dataset.rail)}</span>`;
    a.setAttribute('aria-label', s.dataset.rail);
    track.appendChild(a); return a;
  });
  let fr = [];
  const wide = matchMedia('(min-width:1100px)');
  const layout = () => {
    if (!wide.matches) { fr = []; return; } // the rail is hidden below 1100px
    const max = doc.documentElement.scrollHeight - VH;
    fr = secs.map(s => clamp((s.getBoundingClientRect().top + scrollY) / max));
    ticks.forEach((t, i) => t.style.top = `calc(${fr[i] * 100}% - 4px)`);
  };
  resizeFns.push(layout);
  scrollFns.push(y => {
    const max = doc.documentElement.scrollHeight - VH, p = clamp(y / max);
    fill.style.transform = `scaleY(${p})`; bar.style.transform = `scaleX(${p})`;
    nav.classList.toggle('scrolled', y > 30);
    let here = 0;
    fr.forEach((f, i) => { if (p + 0.004 >= f) here = i; });
    ticks.forEach((t, i) => { t.classList.toggle('on', i <= here); t.classList.toggle('here', i === here); });
  });
  addEventListener('load', layout); // also measured in the start-up frame (resizeFns)
})();

/* ---------------------------------------------------------
   03 Cursor: light, lit borders, magnetic buttons
   --------------------------------------------------------- */
if (FINE && !RM) {
  doc.body.classList.add('has-cursor');
  const light = $('.cursor-light');
  let tx = VW / 2, ty = VH / 2, x = tx, y = ty, moving = false;
  const loop = () => {
    x = lerp(x, tx, .14); y = lerp(y, ty, .14);
    light.style.transform = `translate3d(${x}px,${y}px,0)`;
    if (Math.abs(x - tx) + Math.abs(y - ty) > .5) requestAnimationFrame(loop); else moving = false;
  };
  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    if (!moving) { moving = true; requestAnimationFrame(loop); }
    const lit = e.target.closest && e.target.closest('.lit');
    if (lit) { const r = lit.getBoundingClientRect(); lit.style.setProperty('--mx', (e.clientX - r.left) + 'px'); lit.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
  }, { passive: true });

  $$('[data-magnetic]').forEach(b => {
    const inner = b.firstElementChild;
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      b.style.transition = 'transform .15s ease-out'; b.style.transform = `translate(${dx * .22}px, ${dy * .32}px)`;
      if (inner) { inner.style.transition = 'transform .15s ease-out'; inner.style.transform = `translate(${dx * .1}px, ${dy * .12}px)`; }
    });
    b.addEventListener('pointerleave', () => {
      b.style.transition = 'transform .6s cubic-bezier(.2,.9,.2,1)'; b.style.transform = '';
      if (inner) { inner.style.transition = 'transform .6s cubic-bezier(.2,.9,.2,1)'; inner.style.transform = ''; }
    });
  });
}

/* ---------------------------------------------------------
   05 + 06 Hero system — canvas network, zooms into LEAD on scroll
   --------------------------------------------------------- */
(() => {
  const sec = $('#top'), stage = $('#heroStage'), cv = $('#heroCanvas'), ctx = cv.getContext('2d');
  const wrap = $('#hnodes'), tip = $('#htip'), copy = $('#heroCopy'), cap = $('#heroCap'), hint = $('#heroHint');
  const DATA = [
    { k: 'Lead', d: "An enquiry lands: web form, email, portal or call. It's captured the moment it arrives, not when someone next checks the inbox.", s: ['form', 'email', 'portal', 'call'] },
    { k: 'AI', d: 'Reads the message, works out what it is, and pulls out the name, job, location and urgency.', s: ['classify', 'extract'] },
    { k: 'Decision', d: 'Rules you set pick the route: book a viewing, log a repair, escalate it or politely decline.', s: ['route', 'score'] },
    { k: 'CRM', d: 'A clean record is created or updated automatically. No copying, no re-typing.', s: ['record', 'sync'] },
    { k: 'Follow-up', d: 'Replies and reminders go out on time, in your tone, and stop when the customer answers.', s: ['sms', 'email', 'reminder'] },
    { k: 'Customer', d: 'A person on your team takes it from here, with the full picture. The customer never feels processed.', s: ['handoff'] }
  ];
  const LAY_D = [[.55, .17], [.74, .25], [.61, .39], [.86, .45], [.75, .61], [.9, .76]];
  const LAY_M = [[.15, .20], [.50, .15], [.85, .21], [.80, .38], [.47, .42], [.15, .36]];
  let W = 0, H = 0, dpr = 1, mob = false, nodes = [], parts = [], sats = [], hover = -1, pinned = -1;
  let live = true, raf = 0, last = 0, spawn = 0, satT = 0, p = 0, px = 0, py = 0, tpx = 0, tpy = 0;
  let grid = null, glow = null;
  const t0 = performance.now();

  const btns = DATA.map((n, i) => {
    const b = doc.createElement('button');
    b.className = 'hnode'; b.type = 'button';
    b.setAttribute('aria-label', `${n.k}: ${n.d}`);
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setHover(i); });
    b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && pinned < 0) setHover(-1); });
    b.addEventListener('focus', () => setHover(i));
    b.addEventListener('blur', () => { if (pinned < 0) setHover(-1); });
    b.addEventListener('click', () => { pinned = pinned === i ? -1 : i; setHover(pinned); });
    wrap.appendChild(b); return b;
  });
  doc.addEventListener('pointerdown', e => { if (pinned >= 0 && !e.target.closest('.hnode')) { pinned = -1; setHover(-1); } });

  function setHover(i) {
    hover = i;
    if (i < 0) { tip.classList.remove('on'); kick(); return; }
    const n = nodes[i], d = DATA[i];
    tip.innerHTML = `<div class="k"><b>${esc(d.k.toUpperCase())}</b><span class="mono dim">${String(i + 1).padStart(2, '0')} / 06</span></div><p>${esc(d.d)}</p>`;
    const tw = Math.min(300, W * .78), th = 130;
    let l, t;
    if (mob) { l = clamp(n.bx - tw / 2, 12, W - tw - 12); t = n.by + 30; }
    else { l = n.bx + 34; if (l + tw > W - 16) l = n.bx - 34 - tw; t = clamp(n.by - 30, 80, H - th - 20); }
    tip.style.transform = ''; tip.style.left = l + 'px'; tip.style.top = t + 'px';
    tip.classList.add('on'); kick();
  }

  function makeSprites() {
    glow = doc.createElement('canvas'); glow.width = glow.height = 64;
    const g = glow.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(169,190,255,.9)'); rg.addColorStop(.25, 'rgba(77,124,255,.45)'); rg.addColorStop(1, 'rgba(77,124,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    grid = doc.createElement('canvas');
    const gw = W + 120, gh = H + 120, step = mob ? 28 : 36;
    grid.width = gw * dpr; grid.height = gh * dpr;
    const gg = grid.getContext('2d'); gg.scale(dpr, dpr); gg.fillStyle = 'rgba(255,255,255,.11)';
    for (let x = 0; x < gw; x += step) for (let y = 0; y < gh; y += step) gg.fillRect(x, y, 1, 1);
  }

  function resize() {
    W = stage.clientWidth; H = stage.clientHeight; mob = W < 760;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const lay = mob ? LAY_M : LAY_D;
    nodes = DATA.map((d, i) => { const o = nodes[i] || { r: 0, f: 0 }; return Object.assign(o, { bx: lay[i][0] * W, by: lay[i][1] * H, x: lay[i][0] * W, y: lay[i][1] * H }); });
    btns.forEach((b, i) => b.style.transform = `translate(${nodes[i].bx}px, ${nodes[i].by}px)`);
    makeSprites();
    if (hover >= 0) setHover(hover);
    kick();
  }

  const bez = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
  function edge(i) {
    const a = nodes[i], b = nodes[i + 1], mx = (a.x + b.x) / 2;
    return [a.x, a.y, mx, a.y, mx, b.y, b.x, b.y];
  }

  function draw(now) {
    raf = 0;
    const dt = Math.min(48, now - (last || now)); last = now;
    const t = (now - t0) / 1000;
    const motion = !RM;
    px = lerp(px, tpx, .06); py = lerp(py, tpy, .06);

    nodes.forEach((n, i) => {
      n.x = n.bx + (motion ? Math.sin(t * .6 + i * 1.7) * 6 : 0);
      n.y = n.by + (motion ? Math.cos(t * .5 + i * 1.3) * 5 : 0);
      n.r = lerp(n.r, hover === i ? 1 : 0, RM ? 1 : .16);
      n.f = Math.max(0, n.f - dt / 700);
    });

    // zoom into LEAD (scroll-driven)
    const z = eio(clamp((p - .06) / .9));
    const L = nodes[0], S = 1 + Math.pow(z, 2.3) * 280;
    const cx = lerp(L.x, W / 2, eout(clamp(z * 1.5))), cy = lerp(L.y, H / 2, eout(clamp(z * 1.5)));
    const P = (x, y) => [cx + (x - L.x) * S, cy + (y - L.y) * S];
    const fade = 1 - clamp(z * 2.4);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // dot field, gently parallaxed to the pointer
    ctx.save();
    ctx.globalAlpha = .9 * (1 - clamp(z * 1.3));
    const gs = Math.pow(S, .35);
    ctx.translate(cx, cy); ctx.scale(gs, gs); ctx.translate(-L.x + px * 14, -L.y + py * 14);
    ctx.drawImage(grid, -60, -60, W + 120, H + 120);
    ctx.restore();

    // edges
    for (let i = 0; i < nodes.length - 1; i++) {
      const e = edge(i), a = P(e[0], e[1]), c1 = P(e[2], e[3]), c2 = P(e[4], e[5]), b = P(e[6], e[7]);
      const hot = hover >= 0 && i < hover;
      ctx.strokeStyle = hot ? `rgba(169,190,255,${.7 * fade + .1})` : `rgba(255,255,255,${.16 * fade + .05 * (1 - fade)})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]); ctx.stroke();
    }

    // satellites: short-lived events around nodes (the system keeps evolving)
    if (motion && fade > .2) {
      satT -= dt;
      if (satT <= 0) {
        satT = mob ? 1300 : 800;
        const i = (Math.random() * nodes.length) | 0, a = Math.random() * Math.PI * 2, d = (mob ? 26 : 44) + Math.random() * (mob ? 18 : 40);
        sats.push({ i, a, d, life: 0, max: 2600 + Math.random() * 1800, label: DATA[i].s[(Math.random() * DATA[i].s.length) | 0] });
      }
    }
    ctx.font = `500 ${mob ? 8.5 : 9.5}px "JetBrains Mono", ui-monospace, monospace`;
    sats = sats.filter(s => (s.life += dt) < s.max);
    for (const s of sats) {
      const n = nodes[s.i], k = s.life / s.max, al = Math.sin(k * Math.PI) * fade;
      const sx = n.x + Math.cos(s.a) * s.d, sy = n.y + Math.sin(s.a) * s.d;
      const A = P(n.x, n.y), B = P(sx, sy);
      ctx.strokeStyle = `rgba(255,255,255,${.22 * al})`;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${.7 * al})`; ctx.fillRect(B[0] - 1.5, B[1] - 1.5, 3, 3);
      if (!mob) { ctx.fillStyle = `rgba(244,244,241,${.45 * al})`; ctx.fillText(s.label, B[0] + 6, B[1] + 3); }
    }

    // particles travel the whole path
    if (motion) {
      spawn -= dt;
      if (spawn <= 0 && fade > .1) { spawn = 650 + Math.random() * 500; parts.push({ e: 0, u: 0, v: .0006 + Math.random() * .0004 }); }
      for (const q of parts) {
        q.u += q.v * dt;
        if (q.u >= 1) { q.u = 0; q.e++; if (nodes[q.e]) nodes[q.e].f = 1; }
      }
      parts = parts.filter(q => q.e < nodes.length - 1);
    }
    for (const q of parts) {
      const e = edge(q.e);
      const X = bez(e[0], e[2], e[4], e[6], q.u), Y = bez(e[1], e[3], e[5], e[7], q.u);
      const [x, y] = P(X, Y);
      ctx.globalAlpha = fade; ctx.drawImage(glow, x - 14, y - 14, 28, 28);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 2, 2); ctx.globalAlpha = 1;
    }

    // nodes
    ctx.font = `500 ${mob ? 9.5 : 10.5}px "JetBrains Mono", ui-monospace, monospace`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    nodes.forEach((n, i) => {
      const [x, y] = P(n.x, n.y);
      const base = 5 + n.r * 5;
      const rr = i === 0 ? base * S : base;
      const al = i === 0 ? 1 : fade;
      if (al <= 0.01) return;
      if (n.r > .02 || n.f > .02) {
        const g = Math.max(n.r, n.f);
        ctx.globalAlpha = g * .9 * al; ctx.drawImage(glow, x - 30 - n.r * 10, y - 30 - n.r * 10, 60 + n.r * 20, 60 + n.r * 20); ctx.globalAlpha = 1;
      }
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fillStyle = '#000'; ctx.fill();
      ctx.lineWidth = i === 0 && z > 0 ? 1.5 : 1;
      ctx.strokeStyle = (i === 0 && z > .02) || n.r > .5 ? `rgba(169,190,255,${al})` : `rgba(244,244,241,${.8 * al})`;
      ctx.stroke();
      if (i === 0 && z > .02) { ctx.beginPath(); ctx.arc(x, y, rr * 1.04 + 6, 0, Math.PI * 2); ctx.strokeStyle = `rgba(77,124,255,${.35 * (1 - clamp(z * 1.2))})`; ctx.stroke(); }
      if (n.r > .02 && !(i === 0 && z > .02)) {
        ctx.beginPath(); ctx.arc(x, y, 2 * n.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(169,190,255,${al})`; ctx.fill();
      }
      // labels
      const la = fade * (.7 + n.r * .3);
      if (la > .02) {
        ctx.fillStyle = `rgba(244,244,241,${la})`;
        const label = DATA[i].k.toUpperCase();
        if (mob) { ctx.textAlign = 'center'; ctx.fillText(label, x, y + 22); ctx.textAlign = 'left'; }
        else ctx.fillText(label, x + 16 + n.r * 6, y + 4);
      }
    });
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    if (live && motion) raf = requestAnimationFrame(draw);
  }
  function kick() { if (!raf && live) raf = requestAnimationFrame(draw); }

  function onScroll() {
    const r = sec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > VH) return;
    p = RM ? 0 : pinProgress(sec);
    const a = clamp(p * 3.2);
    copy.style.opacity = 1 - a;
    copy.style.transform = `translate3d(0,${-p * 90}px,0)`;
    copy.style.filter = a > 0.01 ? `blur(${a * 6}px)` : '';
    copy.style.visibility = a >= 1 ? 'hidden' : '';
    hint.style.opacity = 1 - clamp(p * 6);
    const c = clamp((p - .52) / .2);
    cap.style.opacity = c;
    cap.style.transform = `translate(-50%,-50%) scale(${lerp(.94, 1, eout(c))})`;
    wrap.style.visibility = p > .04 ? 'hidden' : '';
    if (p > .03 && hover >= 0) { pinned = -1; setHover(-1); }
    kick();
  }

  if (FINE) stage.addEventListener('pointermove', e => { tpx = e.clientX / W - .5; tpy = e.clientY / H - .5; }, { passive: true });
  let inView = true;
  watch(sec, v => { inView = v; live = v && !doc.hidden; if (live) kick(); });
  doc.addEventListener('visibilitychange', () => { live = inView && !doc.hidden; if (live) kick(); });
  resizeFns.push(resize); scrollFns.push(onScroll);
  resize(); onScroll();
})();

/* ---------------------------------------------------------
   07 Where is your business losing time? (What we fix)
   k: problem · w: who starts it (first manual step) · m: manual steps
   a: automated steps [title, detail, isHuman] · fx: service cards that fix it
   --------------------------------------------------------- */
const LEAKS = [
  { k: 'Enquiries', w: 'Applicant', fx: ['AI Agent', 'Lead to Booking'],
    m: ['Enquiry arrives from a portal, email or phone', 'Someone reads it when they get a minute', 'Works out which property it is about', 'Re-types the details into the CRM', 'Writes a reply from scratch', 'Sets a reminder to chase'],
    a: [['Enquiry from any source', 'Portal, website, email or call'], ['AI', 'Reads it and works out which property'], ['Qualification', 'Property, move-in date, occupants, pets'], ['CRM', 'Record created automatically'], ['Reply in minutes', 'With viewing options, in your tone'], ['Team takes over', 'With the full picture', 1]] },
  { k: 'Viewings', w: 'Applicant', fx: ['Lead to Booking'],
    m: ['Applicant asks to view a property', 'Check the diary', 'Email back a few times that might work', 'Go back and forth until one sticks', 'Add it to the calendar by hand', "Forget the reminder, and they don't show"],
    a: [['Viewing request', 'From a portal, the website or email'], ['Availability check', 'Against your real calendar'], ['Applicant picks a slot', 'No back-and-forth'], ['Calendar + CRM', 'Viewing and record created'], ['Reminders', 'Sent automatically, fewer no-shows'], ['Day sheet', "Your team sees the day's viewings", 1]] },
  { k: 'Follow-ups', w: 'Lead', fx: ['Automation', 'Lead to Booking'],
    m: ['Applicant or landlord lead goes quiet', 'Try to remember to chase', 'Search the inbox for the thread', 'Write a follow-up', 'Update the spreadsheet', 'Do it all again next week'],
    a: [['Lead goes quiet', 'Logged in the CRM'], ['Timer starts', 'Your follow-up schedule'], ['AI drafts follow-up', 'With the property and enquiry in context'], ['Sent on schedule', 'Email or SMS'], ['Reply detected', 'Sequence stops automatically'], ['Person alerted', 'Picks up the conversation', 1]] },
  { k: 'Rent & payment chasing', w: 'Tenant', fx: ['Operations'],
    m: ['Rent falls due', 'Check the bank for who has paid', 'Work out who is late', 'Write reminders one by one', 'Chase again a week later', 'Escalate arrears by hand'],
    a: [['Due date passes', 'Checked against payments received'], ['Polite reminder', 'Sent automatically, in your tone'], ['Escalating sequence', 'Firmer at each step, on your schedule'], ['Stops when paid', 'Payment detected, sequence ends'], ['Logged', 'Every reminder on the tenant record'], ['Arrears flagged', 'A person handles anything overdue', 1]] },
  { k: 'Maintenance requests', w: 'Tenant', fx: ['AI Agent', 'Operations'],
    m: ['Tenant reports a repair', 'Take the call, or find the email or WhatsApp', 'Write the details down somewhere', 'Work out the property and how urgent it is', 'Decide which contractor to send', 'Ring the tenant back with an update'],
    a: [['Repair request', 'Phone, email or WhatsApp'], ['AI extraction', 'Property, issue, urgency'], ['Routed to a contractor', 'The right trade for the job'], ['Tenant updated', 'Told who is coming and when'], ['Logged', 'Against the property record'], ['Emergencies', 'Go straight to a person', 1]] },
  { k: 'Data entry', w: 'Applicant', fx: ['Automation', 'Integration'],
    m: ['Applicant sends a form or email', 'Open it', 'Copy the name, contact details and property', 'Paste into the spreadsheet', 'Paste into the CRM', 'Paste into the accounts'],
    a: [['Form or email', 'Arrives by webhook or inbox rule'], ['AI extraction', 'Pulls out the fields you need'], ['Validation', 'Missing or odd data flagged'], ['CRM', 'Written once'], ['Sync', 'Spreadsheet and accounts updated'], ['Exceptions', 'A person checks only what looks wrong', 1]] },
  { k: 'Landlord reporting', w: 'Landlord', fx: ['Operations', 'Integration'],
    m: ['Landlords expect their monthly statement', 'Export rent from the accounts', 'Export repairs from the job log', 'Paste it all into a spreadsheet', 'Build each statement by hand', 'Email them out one by one'],
    a: [['Scheduled monthly', 'First working day of the month'], ['Pull data', 'Rent, repairs and costs from each tool'], ['Combine', 'Calculated the same way every time'], ['AI summary', 'What happened, in plain English'], ['Statement per landlord', 'Their property, their numbers'], ['Reviewed and sent', 'A person checks before it goes out', 1]] },
  { k: 'Tenant questions', w: 'Tenant', fx: ['AI Agent'],
    m: ['Tenant asks a question', 'Search old emails for the answer', 'Check the tenancy agreement', 'Type the same answer again', 'Chase a colleague for details', 'Nothing gets logged'],
    a: [['Tenant question', 'Bin days, deposits, contract dates'], ['AI answer', 'From approved information only'], ['Confidence check', "Unsure means it doesn't guess"], ['Logged', 'On the tenant record'], ['Escalation', 'Hard ones go to a person'], ['Resolution', 'A human owns anything unusual', 1]] }
];
const Services = {}; // filled in by the services section; "Fixed by" chips call Services.select
(() => {
  const grid = $('#leakGrid'), man = $('#leakManual'), auto = $('#leakAuto'), fx = $('#leakFx'), cA = $('#leakCountA'), cB = $('#leakCountB'), reset = $('#leakReset');
  let cur = 0, done = false, autoPlayed = false, timer;
  grid.innerHTML = LEAKS.map((l, i) => `<button class="leak-b lit" aria-pressed="${i === 0}" data-i="${i}"><span class="drip" style="--dd:${(i * .37) % 2.4}s"></span><b>${esc(l.k)}</b><span class="lk">${l.m.length - 1} steps by hand</span></button>`).join('');
  function show(i) {
    cur = i; done = false; clearTimeout(timer);
    $$('.leak-b', grid).forEach((b, j) => b.setAttribute('aria-pressed', j === i));
    const L = LEAKS[i];
    man.classList.remove('collapse');
    man.innerHTML = L.m.map((s, j) => `<li style="--i:${j}"${j === 0 ? ' class="cust"' : ''}><span class="n">${j === 0 ? '→' : String(j).padStart(2, '0')}</span><span>${esc(s)}</span><span class="who">${j === 0 ? esc(L.w || 'Customer') : 'You'}</span></li>`).join('');
    countTo(cA, 0, L.m.length - 1, 600);
    cB.textContent = '–';
    auto.innerHTML = `<div class="auto-empty"><div><p>${L.m.length - 1} steps a person repeats, every time.</p><button class="btn btn-p btn-s" id="leakGo" data-magnetic><span>Systemise it</span></button></div></div>`;
    $('#leakGo').addEventListener('click', systemise);
    fx.innerHTML = `<span class="mono dim">Fixed by:</span>${L.fx.map(k => `<button class="chip" type="button" data-k="${esc(k)}">${esc(k)}<span aria-hidden="true">→</span></button>`).join('')}`;
    reset.hidden = true;
  }
  function systemise() {
    if (done) return; done = true;
    const L = LEAKS[cur];
    $$('li', man).forEach((li, j) => li.style.transitionDelay = (j * 60) + 'ms');
    man.classList.add('collapse');
    mountFlow(auto, L.a);
    const humans = L.a.filter(s => s[2]).length;
    countTo(cB, L.m.length - 1, humans, 1100);
    reset.hidden = false;
  }
  grid.addEventListener('click', e => { const b = e.target.closest('.leak-b'); if (b) show(+b.dataset.i); });
  fx.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b && Services.select) Services.select(b.dataset.k); });
  reset.addEventListener('click', () => show(cur));
  show(0);
  // play the transformation once, the first time the section is properly on screen
  watch($('#leakStage'), v => {
    if (v && !autoPlayed) { autoPlayed = true; timer = setTimeout(() => { if (cur === 0 && !done) systemise(); }, RM ? 400 : 2600); }
  });
})();

/* ---------------------------------------------------------
   08 Build a system
   --------------------------------------------------------- */
const Intake = {}; // filled in later; the builder can hand work to it
(() => {
  const OPTS = {
    trigger: [['web', 'Website enquiry'], ['form', 'Form submission'], ['email', 'New email'], ['lead', 'New lead'], ['appt', 'Appointment request']],
    ai: [['classify', 'Classify enquiry'], ['qualify', 'Qualify lead'], ['summarise', 'Summarise message'], ['extract', 'Extract information'], ['respond', 'Generate response']],
    action: [['crm', 'CRM update'], ['email', 'Email'], ['notify', 'Notification'], ['calendar', 'Calendar booking'], ['task', 'Create task'], ['handoff', 'Human handoff']]
  };
  const MAX = { trigger: 1, ai: 2, action: 3 };
  const VERB = {
    classify: 'classify it', qualify: 'qualify the lead', summarise: 'summarise the message', extract: 'pull out the key details', respond: 'draft a response',
    crm: 'update your CRM', email: 'send an email', notify: 'notify your team', calendar: 'book it into the calendar', task: 'create a task', handoff: 'hand it to a person'
  };
  const SAMPLE = {
    web: { src: 'webhook · existing website form', who: 'Sarah Jones', pay: '{ name: "Sarah Jones", property: "2-bed flat, Maple Court", message: "Is this still available? I\'d like to view it this week." }', cat: 'viewing request', score: '82/100 · move-in date fits, budget fits, no pets', sum: 'Wants to view the 2-bed at Maple Court this week.', fields: 'name=Sarah Jones · property=2-bed, Maple Court · move_in=next month · occupants=2 · pets=none', reply: 'Hi Sarah, thanks for your interest in the 2-bed at Maple Court. We have viewings on Thursday at 2:00pm or Friday at 10:00am. Which suits you?' },
    form: { src: 'form · landlord enquiry', who: 'Alys Price', pay: '{ property: "3-bed house, Station Road", service: "Fully managed", available: "January" }', cat: 'landlord lead', score: '74/100 · in area, wants full management', sum: 'Landlord with a 3-bed on Station Road wants it fully managed from January.', fields: 'name=Alys Price · property=3-bed, Station Road · service=fully managed · from=January', reply: 'Hi Alys, thanks for getting in touch about Station Road. The next step is a short visit so we can talk through rent and management.' },
    email: { src: 'inbox · new message', who: 'Flat 4, Maple Court', existing: true, pay: '{ subject: "Deposit question", body: "When will my deposit come back after I move out?" }', cat: 'tenant question', score: 'n/a · existing tenant', sum: 'Tenant at Flat 4 asks when their deposit comes back after moving out.', fields: 'property=Flat 4, Maple Court · topic=deposit · tenant=existing', reply: "Thanks for your message. We're checking the check-out details for Flat 4 and will confirm the timings today." },
    lead: { src: 'lead · property portal', who: 'J. Morgan', pay: '{ property: "1-bed flat, Quay Street", move_in: "As soon as possible" }', cat: 'portal enquiry', score: '68/100 · wants to move fast, budget not given', sum: 'Interested in the 1-bed on Quay Street, wants to move as soon as possible.', fields: 'name=J. Morgan · property=1-bed, Quay Street · move_in=asap · budget=unknown', reply: 'Hi, thanks for your enquiry about the 1-bed on Quay Street. Two quick questions so we can book you a viewing…' },
    appt: { src: 'booking widget', who: 'Sarah Jones', pay: '{ requested: "Thursday afternoon", reason: "Viewing, 2-bed flat, Maple Court" }', cat: 'viewing request', score: 'n/a · applicant already qualified', sum: 'Wants to view the 2-bed at Maple Court on Thursday afternoon.', fields: 'name=Sarah Jones · type=viewing · property=2-bed, Maple Court · preferred=Thu pm', reply: 'Hi Sarah, Thursday works. Here are the free viewing slots that afternoon.' }
  };
  const sel = { trigger: ['web'], ai: ['qualify', 'respond'], action: ['crm', 'notify', 'handoff'] };
  const gridEl = $('#bGrid'), svg = $('#bSvg'), chain = $('#bChain'), sent = $('#bSent'), log = $('#bLog');
  const runB = $('#bRun'), specB = $('#bSpec'), specBox = $('#bSpecBox'), specTxt = $('#bSpecTxt'), copyB = $('#bCopy'), sendB = $('#bSend');
  let running = false;
  const label = (col, id) => OPTS[col].find(o => o[0] === id)[1];

  $$('.b-opts').forEach(box => {
    const col = box.dataset.col;
    box.innerHTML = OPTS[col].map(([id, t]) => `<button class="b-opt" data-id="${id}" aria-pressed="false"><span class="pt"></span><span>${esc(t)}</span><span class="ix"></span></button>`).join('');
    box.addEventListener('click', e => {
      const b = e.target.closest('.b-opt'); if (!b || running) return;
      const id = b.dataset.id, arr = sel[col], at = arr.indexOf(id);
      if (MAX[col] === 1) sel[col] = at >= 0 ? [] : [id];
      else if (at >= 0) arr.splice(at, 1);
      else { arr.push(id); if (arr.length > MAX[col]) arr.shift(); }
      update();
    });
  });

  function steps() {
    const s = [];
    if (sel.trigger[0]) s.push([label('trigger', sel.trigger[0])]);
    sel.ai.forEach(a => s.push(['AI · ' + label('ai', a)]));
    sel.action.forEach(a => s.push([label('action', a), '', a === 'handoff' ? 1 : 0]));
    return s;
  }
  function sentence() {
    if (!sel.trigger[0]) return 'Pick a trigger to start.';
    if (!sel.action.length) return 'Now pick at least one action.';
    const tr = label('trigger', sel.trigger[0]).toLowerCase();
    const a = sel.ai.map(x => VERB[x]), b = sel.action.map(x => VERB[x]);
    let s = `When a <em>${esc(tr)}</em> comes in, `;
    s += a.length ? `AI will <em>${esc(joinAnd(a))}</em>, then the system will <em>${esc(joinAnd(b))}</em>.` : `the system will <em>${esc(joinAnd(b))}</em>, with no AI step.`;
    s += sel.action.includes('handoff') ? ' A person takes it from there.' : " We'd normally add a human checkpoint before anything goes to a customer.";
    return s;
  }
  function spec() {
    return JSON.stringify({
      name: sel.trigger[0] ? label('trigger', sel.trigger[0]) + ' workflow' : 'Untitled workflow',
      trigger: sel.trigger[0] || null,
      ai_steps: sel.ai,
      actions: sel.action,
      human_checkpoint: sel.action.includes('handoff'),
      note: 'Draft spec from the Blackline builder. A real build is scoped around your tools and rules.'
    }, null, 2);
  }
  function draw() {
    const g = gridEl.getBoundingClientRect();
    const stacked = getComputedStyle(gridEl).gridTemplateColumns.split(' ').length < 2;
    const pt = (col, id, side) => {
      const el = $(`.b-opts[data-col="${col}"] [data-id="${id}"]`); if (!el) return null;
      const r = el.getBoundingClientRect();
      if (stacked) return [r.left - g.left, r.top - g.top + r.height / 2];
      return [(side ? r.right : r.left) - g.left, r.top - g.top + r.height / 2];
    };
    const path = (a, b, soft) => {
      if (!a || !b) return '';
      let d;
      if (stacked) { const bx = Math.min(a[0], b[0]) - 18; d = `M${a[0]},${a[1]} C${bx},${a[1]} ${bx},${b[1]} ${b[0]},${b[1]}`; }
      else { const m = (a[0] + b[0]) / 2; d = `M${a[0]},${a[1]} C${m},${a[1]} ${m},${b[1]} ${b[0]},${b[1]}`; }
      return `<path d="${d}"${soft ? ' class="soft"' : ''}/>`;
    };
    let out = '';
    const t = sel.trigger[0];
    if (t) {
      if (sel.ai.length) {
        sel.ai.forEach(a => out += path(pt('trigger', t, 1), pt('ai', a, 0)));
        sel.ai.forEach(a => sel.action.forEach(x => out += path(pt('ai', a, 1), pt('action', x, 0))));
      } else sel.action.forEach(x => out += path(pt('trigger', t, 1), pt('action', x, 0), 1));
    }
    svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`);
    svg.innerHTML = out;
  }
  function update(init) {
    ['trigger', 'ai', 'action'].forEach(col => $$(`.b-opts[data-col="${col}"] .b-opt`).forEach(b => {
      const i = sel[col].indexOf(b.dataset.id);
      b.setAttribute('aria-pressed', i >= 0);
      $('.ix', b).textContent = i >= 0 && MAX[col] > 1 ? String(i + 1).padStart(2, '0') : '';
    }));
    const ok = sel.trigger.length && sel.action.length;
    chain.innerHTML = ok ? chainHTML(steps()) : '<p class="dim">Your workflow will appear here.</p>';
    sent.innerHTML = sentence();
    runB.disabled = sendB.disabled = !ok;
    specTxt.value = spec();
    if (!init) draw(); // at start-up, resizeFns draws once the whole page exists
  }
  async function run() {
    if (running) return; running = true; runB.disabled = true;
    const s = SAMPLE[sel.trigger[0]];
    const nodes = $$('.cn', chain);
    nodes.forEach(n => n.classList.remove('hot'));
    log.innerHTML = '';
    let ms = 0;
    const line = (txt, cls = '') => { log.insertAdjacentHTML('beforeend', `<div class="l"><span class="t">+${(ms / 1000).toFixed(2)}s</span><span class="${cls}">${esc(txt)}</span></div>`); log.scrollTop = log.scrollHeight; };
    const step = async (i, txt, cls) => { const d = 250 + Math.random() * 450; ms += d; await sleep(d); nodes.forEach((n, j) => n.classList.toggle('hot', j === i)); line(txt, cls); };
    line('[sample data · nothing is sent]', 'dim');
    let i = 0;
    await step(i++, `trigger   ${s.src}\n          ${s.pay}`);
    const AI = { classify: `ai        category: ${s.cat}`, qualify: `ai        score: ${s.score}`, summarise: `ai        summary: "${s.sum}"`, extract: `ai        fields: ${s.fields}`, respond: `ai        draft: "${s.reply}"` };
    for (const a of sel.ai) await step(i++, AI[a]);
    const ACT = {
      crm: `crm       record for ${s.who} ${s.existing ? 'updated · message logged' : 'created · stage "New"'}`,
      email: `email     ${sel.ai.includes('respond') ? 'AI draft' : 'template reply'} sent to ${s.who}`,
      notify: `notify    team channel: "New ${s.cat} from ${s.who}"`,
      calendar: 'calendar  3 free slots offered · 1 held for 24h',
      task: `task      "Follow up with ${s.who}" assigned, due today`,
      handoff: 'handoff   routed to a person with summary and history'
    };
    for (const a of sel.action) await step(i++, ACT[a], a === 'handoff' ? 'hu' : '');
    ms += 200; await sleep(200);
    const humans = sel.action.includes('handoff') ? 1 : 0;
    line(`done      ${nodes.length} steps · ${humans} human ${humans === 1 ? 'step' : 'steps'}`, 'ok');
    nodes.forEach(n => n.classList.add('hot'));
    running = false; runB.disabled = false;
  }
  runB.addEventListener('click', run);
  specB.addEventListener('click', () => { const on = specBox.classList.toggle('on'); $('span', specB).textContent = on ? 'Hide spec' : 'View spec'; });
  copyB.addEventListener('click', async () => {
    const ok = await copyText(specTxt.value);
    if (!ok) { specTxt.focus(); specTxt.select(); }
    $('span', copyB).textContent = ok ? 'Copied' : 'Selected, press Ctrl+C';
    setTimeout(() => $('span', copyB).textContent = 'Copy spec', 1800);
  });
  sendB.addEventListener('click', () => {
    const plain = sent.textContent;
    Intake.prefill && Intake.prefill({ svc: 'automation', man: 'From the builder: ' + plain });
  });
  resizeFns.push(draw);
  watch(gridEl, v => { if (v) draw(); });
  update(true);
})();

/* ---------------------------------------------------------
   09 We don't sell AI
   --------------------------------------------------------- */
(() => {
  const sec = $('#thesis'), A = $('#thA'), B = $('#thB'), line = $('#thLine'), eq = $$('#thEq span'), note = $('#thNote');
  if (RM) { eq.forEach(s => s.classList.add('on')); note.classList.add('on'); return; }
  scrollFns.push(() => {
    const r = sec.getBoundingClientRect(); if (r.bottom < 0 || r.top > VH) return;
    const p = pinProgress(sec);
    const a = clamp((p - .2) / .2);
    A.style.opacity = 1 - a * .72;
    A.style.transform = `translateY(${-a * 8}px)`;
    const b = clamp((p - .18) / .22);
    B.style.clipPath = `inset(0 0 ${100 - b * 100}% 0)`;
    line.style.transform = `scaleX(${eout(clamp((p - .4) / .14))})`;
    eq.forEach((s, i) => s.classList.toggle('on', p > .5 + i * .03));
    note.classList.toggle('on', p > .8);
  });
})();

/* ---------------------------------------------------------
   10 Services as interactive systems
   --------------------------------------------------------- */
(() => {
  // fixes: the "What we fix" problems each card solves; mirror LEAKS[].fx
  const SV = [
    { k: 'Integration', d: 'We plug into the website, inbox and tools you already use. No rebuild, no new software for your team to learn.', foot: 'Your existing tools · one connected system',
      fixes: ['Data entry', 'Landlord reporting'],
      html: () => {
        const S = [[18, 20, 'Your website'], [82, 20, 'Portal enquiries'], [93, 52, 'Phone'], [78, 84, 'CRM'], [22, 84, 'Calendar'], [7, 52, 'Inbox']];
        return `<div class="scene sc-biz"><div class="hub"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${S.map(([x, y], i) => `<line x1="50" y1="50" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.18)" vector-effect="non-scaling-stroke"/><circle class="pkt" r=".9"><animateMotion dur="2.4s" begin="${(i * .4).toFixed(1)}s" repeatCount="indefinite" path="M${x} ${y} L50 50"/></circle>`).join('')}</svg>
        ${S.map(([x, y, t]) => `<span class="sat" style="left:${x}%;top:${y}%">${t}</span>`).join('')}<div class="core"><b>BLACKLINE</b><div class="mono dim" style="margin-top:4px">no rebuild needed</div></div></div></div>`;
      } },
    { k: 'Automation', d: 'Workflows that move information between your apps, so nobody has to copy and paste it.', foot: 'Event stream · form → sheet → CRM → email',
      fixes: ['Follow-ups', 'Data entry'],
      html: () => `<div class="scene sc-auto"><div class="ticker"><div>→ enquiry.received · 2-bed, Maple Court<br>→ sheets.row_added · row 212<br>→ crm.contact_upserted · stage New<br>→ email.sent · viewing options<br>→ enquiry.received · 2-bed, Maple Court<br>→ sheets.row_added · row 213</div></div>
        <div class="apps"><div class="wire"><span class="pk" style="--d:0s"></span><span class="pk" style="--d:1.07s"></span><span class="pk" style="--d:2.13s"></span></div>
        <div class="app pulse" style="--d:0s"><b>FORM</b></div><div class="app pulse" style="--d:.95s"><b>SHEET</b></div><div class="app pulse" style="--d:1.95s"><b>CRM</b></div><div class="app pulse" style="--d:2.95s"><b>EMAIL</b></div></div></div>` },
    { k: 'AI Agent', d: 'Agents that answer tenants and applicants, ask the right questions and pass anything serious to a person.', foot: 'Message → questions → details → handoff',
      fixes: ['Enquiries', 'Maintenance requests', 'Tenant questions'],
      seq: true,
      html: () => `<div class="scene sc-agent"><div class="chat">
        <div class="msg c" data-t="200">Hi, the boiler in my flat has started banging. Flat 4, Maple Court.</div>
        <div class="typing" data-t="1100" data-off="2200"><i></i><i></i><i></i></div>
        <div class="msg a" data-t="2200">Sorry about that. Is it still heating water, or has it stopped completely?</div>
        <div class="msg c" data-t="3900">Still heating, just loud. Friday would be best for someone to come.</div>
        <div class="typing" data-t="4700" data-off="5800"><i></i><i></i><i></i></div>
        <div class="msg a" data-t="5800">Thanks. I've logged it and sent it to our heating contractor. They'll confirm a Friday slot with you shortly.</div>
        </div><div class="fields" data-t="6900"><div><span>Property</span><b>Flat 4, Maple Court</b></div><div><span>Issue</span><b>Boiler banging</b></div><div><span>Urgency</span><b>Routine</b></div><div><span>Handoff</span><b>Contractor · Fri</b></div></div></div>` },
    { k: 'Lead to Booking', d: 'Every lead answered in seconds, qualified, and booked straight into your calendar, with reminders sent automatically. Nobody chases, nothing slips.', foot: 'One lead · enquiry → qualified → booked → reminded',
      fixes: ['Enquiries', 'Viewings', 'Follow-ups'],
      html: () => `<div class="scene sc-lead"><div class="lanes"><div class="lane"><span>New</span></div><div class="lane"><span>Qualified</span></div><div class="lane"><span>Booked</span></div><div class="lane"><span>Reminded</span></div>
        <div class="lcard"><b>Sarah Jones</b><small>2-bed viewing · score 82</small></div>
        <div class="lslot"><span>Viewing</span><b>Thu 2:00pm</b></div>
        <div class="ltick"><i aria-hidden="true">✓</i><span>Confirmation + reminder sent</span></div></div></div>` },
    { k: 'Operations', d: 'The back-office jobs that eat your week — chasing payments, routing repairs, building reports — running on their own.', foot: 'Back office · chase → route → report',
      fixes: ['Rent & payment chasing', 'Maintenance requests', 'Landlord reporting'],
      seq: true,
      html: () => {
        const R = [['Chase', 'Rent due · Flat 2', 'Reminder sent', 'Paid ✓'], ['Route', 'Repair logged · Flat 4', 'Contractor assigned', 'Tenant updated ✓'], ['Report', 'Month end', 'Landlord statement built', 'Sent to 12 landlords ✓']];
        return `<div class="scene sc-ops"><div class="ops">${R.map(([l, ...st], r) => `<div class="ops-r"><span class="mono dim">${l}</span><div class="chain">${st.map((t, i) => {
          const at = 200 + r * 2200 + i * 650;
          return `${i ? `<span class="ar" aria-hidden="true" data-t="${at}">→</span>` : ''}<span class="cn${i === st.length - 1 ? ' ok' : ''}" data-t="${at}">${t}</span>`;
        }).join('')}</div></div>`).join('')}</div></div>`;
      } },
    { k: 'Custom Build', d: "APIs, webhooks, databases and AI, for the jobs off-the-shelf software doesn't fit.", foot: 'Toggle modules to configure the architecture',
      fixes: ['Anything else'],
      html: () => {
        const M = [['wh', 'Webhooks', 'Events in'], ['api', 'REST API', 'Connect tools'], ['q', 'Queue', 'Retries, order'], ['ai', 'AI model', 'Read, decide'], ['db', 'Database', 'Store, query'], ['dash', 'Dashboard', 'See it all']];
        return `<div class="scene sc-cus"><div class="arch">${M.map(([id, t, s]) => `<div class="mod on" data-m="${id}"><span>${s}</span><b>${t}</b></div>`).join('')}</div>
        <div class="cus-tg" role="group" aria-label="Modules">${M.map(([id, t]) => `<button class="chip is-on" aria-pressed="true" data-m="${id}">${t}</button>`).join('')}</div></div>`;
      } }
  ];
  const list = $('#svcList'), stage = $('#svcStage'), cap = $('#svcCap');
  let cur = -1, timers = [], inView = false;
  const fixesLine = s => `<span class="svc-fx">Fixes: ${s.fixes.map(esc).join(' · ')}</span>`;
  list.innerHTML = SV.map((s, i) => `<button class="svc-t" role="tab" id="svc-t${i}" aria-controls="svcStage" aria-selected="false" tabindex="-1" data-i="${i}"><b>${esc(s.k)}</b><span class="ar" aria-hidden="true">→</span><small>${esc(s.d)}${fixesLine(s)}</small></button>`).join('');
  const tabs = $$('.svc-t', list);
  const clearT = () => { timers.forEach(clearTimeout); timers = []; };
  function playSeq() {
    clearT();
    const els = $$('[data-t]', stage); if (!els.length) return;
    els.forEach(e => e.classList.remove('on'));
    if (RM) { els.forEach(e => { if (!e.dataset.off) e.classList.add('on'); }); return; }
    let end = 0;
    els.forEach(e => {
      const t = +e.dataset.t; end = Math.max(end, t);
      timers.push(setTimeout(() => e.classList.add('on'), t));
      if (e.dataset.off) timers.push(setTimeout(() => e.classList.remove('on'), +e.dataset.off));
    });
    timers.push(setTimeout(() => { if (inView) playSeq(); }, end + 3800));
  }
  function show(i, focus) {
    if (i === cur) return; const first = cur < 0; cur = i; clearT();
    tabs.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
    if (focus) tabs[i].focus();
    stage.setAttribute('aria-labelledby', 'svc-t' + i);
    const s = SV[i];
    stage.innerHTML = s.html() + `<div class="foot mono"><span>${esc(s.k)}</span><span>${esc(s.foot)}</span></div>`;
    cap.innerHTML = esc(s.d) + fixesLine(s);
    if (s.seq && inView) playSeq();
    const tg = $('.cus-tg', stage);
    if (tg) tg.addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on); b.classList.toggle('is-on', on);
      const m = $(`.mod[data-m="${b.dataset.m}"]`, stage); m.classList.toggle('on', on); m.classList.toggle('off', !on);
    });
    if (!first && window.innerWidth < 1000 && list.scrollWidth > list.clientWidth) list.scrollTo({ left: Math.max(0, tabs[i].offsetLeft - 8), behavior: RM ? 'auto' : 'smooth' });
  }
  list.addEventListener('click', e => { const t = e.target.closest('.svc-t'); if (t) show(+t.dataset.i); });
  list.addEventListener('keydown', e => {
    const k = e.key, n = SV.length;
    if (['ArrowDown', 'ArrowRight'].includes(k)) { e.preventDefault(); show((cur + 1) % n, 1); }
    if (['ArrowUp', 'ArrowLeft'].includes(k)) { e.preventDefault(); show((cur + n - 1) % n, 1); }
    if (k === 'Home') { e.preventDefault(); show(0, 1); }
    if (k === 'End') { e.preventDefault(); show(n - 1, 1); }
  });
  // used by the "Fixed by" chips in What we fix
  Services.select = k => {
    const i = SV.findIndex(s => s.k === k); if (i < 0) return;
    show(i);
    tabs[i].focus({ preventScroll: true });
    $('.svc', $('#services')).scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  };
  watch(stage, v => {
    inView = v;
    const s = $('svg', stage); if (s && s.pauseAnimations) v ? s.unpauseAnimations() : s.pauseAnimations();
    if (v && SV[cur] && SV[cur].seq) playSeq(); else if (!v) clearT();
  });
  show(0);
})();

/* ---------------------------------------------------------
   Shared catalogue — what Blackline builds
   Used by: Talk, Finder, Intake brief
   --------------------------------------------------------- */
const SYSTEMS = {
  followup: { name: 'Lead follow-up system', line: 'Every lead gets followed up on time, until they reply or say no.', auto: 'Follow-up emails and texts, reminders, and stopping the sequence when someone replies.',
    kw: ['follow up', 'follow-up', 'followup', 'follows up', 'follow up with', 'follows up with', 'chase', 'chasing', 'nurture', 'quotes go', 'go quiet', 'goes quiet', 'ghost', 'no reply', 'never reply', 'reminder', 'sequence', 'quote'],
    steps: [['Lead captured', 'Any source, one place'], ['AI qualification', 'Is it real, is it a fit'], ['CRM', 'Record created'], ['Follow-up', 'On a schedule you set'], ['Reminder', 'Nudges before it goes cold'], ['Human handoff', 'Replies go to a person', 1]] },
  agent: { name: 'AI enquiry agent', line: 'Answers enquiries straight away, asks the right questions, and passes the serious ones to you.', auto: 'First replies, qualifying questions, pulling out details and logging everything in the CRM.',
    kw: ['receptionist', 'answer the phone', 'answering', 'phone', 'calls', 'chatbot', 'chat', 'enquiries', 'enquiry', 'inquiries', 'out of hours', 'after hours', '24/7', 'agent', 'messages', 'whatsapp', 'respond', 'reply'],
    steps: [['Enquiry', 'Web, chat or email'], ['AI agent replies', 'In minutes, in your tone'], ['Qualifying questions', 'The ones you would ask'], ['Details extracted', 'Name, need, location, urgency'], ['CRM', 'Logged automatically'], ['Human handoff', 'Your team takes over', 1]] },
  integration: { name: 'Connect your existing website', np: 'a connection to your existing website', line: 'We plug into the site you already have. No rebuild.', auto: 'Capturing enquiries from the forms you already have, confirmations and routing them into your CRM.',
    kw: ['website', 'web site', 'site', 'landing page', 'redesign', 'rebuild', 'online presence', 'contact form', 'web form', 'web design', 'webpage'],
    steps: [['Your existing site', 'Left exactly as it is'], ['Enquiry form', 'Connected, not replaced'], ['AI', 'Sorts and summarises'], ['CRM', 'Every enquiry logged'], ['Automation', 'Replies, bookings and follow-up']] },
  booking: { name: 'Booking system', line: 'People book themselves in, reminders go out, and your calendar stays right.', auto: 'Availability checks, confirmations, reminders and rescheduling.',
    kw: ['book', 'booking', 'bookings', 'appointment', 'appointments', 'calendar', 'schedule', 'diary', 'reschedule', 'no-show', 'no show', 'slots', 'viewing', 'viewings'],
    steps: [['Booking request', 'Site, email or chat'], ['Availability', 'Checked live'], ['Slot confirmed', 'No back-and-forth'], ['Calendar + CRM', 'Both updated'], ['Reminders', 'Fewer no-shows'], ['Day sheet', 'Your team sees the day', 1]] },
  support: { name: 'Support agent', line: 'Answers the questions you get every day, from your own information, and escalates the rest.', auto: 'Answers to routine questions from approved information, logging and escalation.',
    kw: ['support', 'customer service', 'questions', 'same questions', 'faq', 'tickets', 'helpdesk', 'returns', 'refund', 'order status', 'where is my order', 'delivery'],
    steps: [['Question', 'Email, chat or form'], ['AI answer', 'From your approved knowledge'], ['Confidence check', 'No guessing'], ['Escalation', 'When unsure, a person', 1], ['Logged', 'Helpdesk or CRM'], ['Resolved', 'They get an answer']] },
  sync: { name: 'Connected business system', line: 'Information entered once, then moved between your tools automatically.', auto: 'Moving data between tools, validation and keeping records in sync.',
    kw: ['data entry', 'copy', 'paste', 'copying', 'spreadsheet', 'spreadsheets', 'sheets', 'excel', 'sync', 'duplicate', 're-type', 'retype', 'tools', 'integrate', 'connect', 'invoice', 'invoicing', 'xero', 'quickbooks', 'admin'],
    steps: [['Event in one tool', 'A form, payment or update'], ['Webhook or API', 'Picked up instantly'], ['Mapped and validated', 'Right fields, right format'], ['Written everywhere', 'CRM, sheets, accounts'], ['Exceptions flagged', 'Only odd ones need you', 1]] },
  arrears: { name: 'Rent and payment chasing system', line: 'Reminders go out when payments are late, stay polite, and stop the moment the money arrives.', auto: 'Spotting late payments, sending reminders on a schedule, escalating politely and stopping when paid.',
    kw: ['arrears', 'late rent', 'rent', 'overdue', 'unpaid', 'late payment', 'late payments', 'payment chasing', 'chasing payments', 'chase payments', 'credit control', 'debtors', 'outstanding invoices'],
    steps: [['Due date passes', 'Checked against payments received'], ['Polite reminder', 'In your tone'], ['Escalating sequence', 'Firmer at each step'], ['Stops when paid', 'Payment detected automatically'], ['Arrears flagged', 'A person decides what happens next', 1]] },
  maintenance: { name: 'Maintenance routing system', line: 'Repair requests from every channel captured, sorted by urgency and sent to the right contractor.', auto: 'Capturing repair reports from any channel, pulling out the property, issue and urgency, routing to contractors and keeping tenants updated.',
    kw: ['repair', 'repairs', 'maintenance', 'contractor', 'contractors', 'leak', 'leaks', 'broken', 'fault', 'faults', 'damp', 'mould', 'work order', 'job sheet'],
    steps: [['Repair request', 'Phone, email or WhatsApp'], ['AI extraction', 'Property, issue, urgency'], ['Routed', 'To the right contractor'], ['Tenant updated', 'Who is coming and when'], ['Emergencies', 'Straight to a person', 1]] },
  reporting: { name: 'Reporting automation', line: 'The numbers you need, pulled together and explained, without the Monday spreadsheet.', auto: 'Pulling data, calculating it the same way every time and writing a plain-English summary.',
    kw: ['report', 'reports', 'reporting', 'dashboard', 'kpi', 'numbers', 'metrics', 'analytics', 'weekly update', 'statement', 'statements', 'month end', 'month-end'],
    steps: [['Schedule', 'Weekly, monthly or daily'], ['Pull data', 'From each tool'], ['Combine', 'Same maths every time'], ['AI summary', 'What changed and why'], ['Delivered', 'Inbox or chat'], ['Decisions', 'Made by people', 1]] },
  docs: { name: 'Document and onboarding system', line: 'Forms and documents read, checked and filed, so onboarding stops being an email chain.', auto: 'Collecting documents, extracting details, chasing missing items and filing.',
    kw: ['document', 'documents', 'pdf', 'paperwork', 'onboarding', 'onboard', 'contracts', 'forms', 'receipts', 'id check', 'engagement letter', 'referencing', 'right to rent'],
    steps: [['Form or document', 'Uploaded or emailed'], ['AI extraction', 'Pulls out the details'], ['Checks', 'Missing items chased'], ['Filed and recorded', 'Right folder, right record'], ['Next step', 'Triggered automatically'], ['Review', 'A person signs off', 1]] },
  qualify: { name: 'Lead qualification system', line: 'Leads scored and routed before anyone picks up the phone.', auto: 'Qualifying questions, scoring against your criteria and routing to the right person.',
    kw: ['qualify', 'qualification', 'qualifying', 'score', 'scoring', 'leads', 'lead', 'time wasters', 'tyre kickers', 'sales team', 'salesperson', 'pipeline', 'setter', 'closer'],
    steps: [['New lead', 'Any source'], ['AI qualification', 'Your questions'], ['Scoring', 'Your criteria'], ['CRM', 'Answers on the record'], ['Salesperson notified', 'Hot leads first'], ['Sales call', 'With full context', 1]] },
  custom: { name: 'Custom build', line: 'When off-the-shelf tools don’t fit, we build the piece that does.', auto: 'Whatever the process needs: APIs, webhooks, a database and AI where it helps.',
    kw: ['custom', 'api', 'database', 'client portal', 'customer portal', 'internal tool', 'bespoke', 'integration', 'webhook', 'app', 'platform'],
    steps: [['Your events', 'From any tool'], ['API and webhooks', 'Connected properly'], ['Logic and AI', 'Your rules'], ['Database', 'Stored and queryable'], ['Dashboard', 'See what is happening'], ['Your team', 'In control', 1]] }
};
function rankSystems(text) {
  const q = ' ' + text.toLowerCase().replace(/[^a-z0-9/+ -]/g, ' ') + ' ';
  return Object.entries(SYSTEMS).map(([id, s]) => {
    let score = 0;
    s.kw.forEach(k => { if (q.includes(k.length < 5 ? ' ' + k : k)) score += 1 + k.length / 10; });
    return { id, score };
  }).sort((a, b) => b.score - a.score);
}
// Industries are detected by keyword (matched at the start of a word); the one with most hits wins, ties go to the earlier entry.
// prefer: [pattern, system id] checked in order, for industries where a phrase points clearly at one system.
// sys: industry wording for a system (name, np, line, steps) layered over SYSTEMS.
const INDUSTRIES = [
  { id: 'property', label: 'property business', def: 'agent', kw: ['propert', 'tenant', 'landlord', 'viewing', 'arrears', 'portfolio', 'estate agent', 'block management', 'hmo', 'rent', 'rental'],
    prefer: [
      [/\barrears|\blate rent|\brent (?:is |was |that's |thats |gets |goes )?(?:late|overdue|unpaid)|\bchas\w* (?:late |the |up )?(?:rent|payments?)|\boverdue|\bunpaid/, 'arrears'],
      [/\brepair|\bmaintenance|\bcontractor|\bleak|\bbroken|\bboiler/, 'maintenance'],
      [/\bstatement|\blandlord reports?\b|\breporting\b|\bmonth[- ]end/, 'reporting'],
      [/\bviewing/, 'booking']
    ],
    sys: {
      agent: { steps: [['Enquiry', 'Portal, website, email or call'], ['AI agent replies', 'In minutes, in your tone'], ['Qualifying questions', 'Move-in date, occupants, pets, budget'], ['Details extracted', 'Property, dates, contact'], ['CRM', 'Logged automatically'], ['Human handoff', 'Your team takes over', 1]] },
      booking: { name: 'Viewing booking system', auto: 'Replies to viewing requests, slots offered from your real calendar, confirmations and reminders.',
        steps: [['Viewing request', 'Portal, website or email'], ['AI qualification', 'Move-in date, occupants, pets'], ['Availability', 'Checked against your calendar'], ['Viewing booked', 'Calendar and CRM updated'], ['Reminders', 'Fewer no-shows'], ['Your team', 'Shows them round', 1]] },
      reporting: { name: 'Landlord statement system', line: 'Monthly landlord statements pulled together, explained in plain English and checked by a person before they go out.', auto: "Pulling rent, repairs and costs from your tools, building each landlord's statement and writing a plain-English summary.",
        steps: [['Month end', 'Runs on a schedule'], ['Pull data', 'Rent, repairs and costs'], ['Statement assembled', 'One per landlord'], ['AI summary', 'What happened, in plain English'], ['Reviewed', 'A person checks before sending', 1]] }
    },
    human: 'Viewings, tenant disputes, arrears decisions and anything urgent.', tools: 'Your inbox and phone, portal enquiry emails, your calendar, a CRM, and your property management software where it has an API.',
    first: { agent: 'Enquiry handling first, then viewing booking.', booking: 'Viewing booking first, then follow-ups for applicants who go quiet.', maintenance: 'Repair intake and routing first, then tenant updates.', arrears: 'Rent reminders first, then arrears flagged to your team.', reporting: 'Landlord statements first, then rent and repair data feeding into them.', _: 'Enquiry handling and viewing booking, then repairs and rent chasing.' } },
  { id: 'clinic', label: 'appointment-based business', def: 'booking', kw: ['dental', 'dentist', 'physio', 'clinic', 'salon', 'beauty', 'barber', 'spa', 'therap', 'vet', 'gym', 'personal train', 'aesthetic', 'optician', 'chiropract'],
    human: 'Treatment decisions, complaints and anything sensitive.', tools: 'Your booking system or Calendly, email or SMS, and your client list.', first: 'Online booking with reminders, then enquiry handling.' },
  { id: 'shop', label: 'online shop', def: 'support', kw: ['shop', 'store', 'ecommerce', 'e-commerce', 'shopify', 'woocommerce', 'products', 'orders', 'online retail'],
    human: 'Refund exceptions, unhappy customers and anything outside your policy.', tools: 'Your store platform, a helpdesk inbox and order data through its API.', first: 'A support agent for order and product questions, with escalation.' },
  { id: 'pro', label: 'professional services firm', def: 'docs', kw: ['accountan', 'solicitor', 'law firm', 'legal', 'consult', 'architect', 'surveyor', 'financial advi', 'mortgage', 'insurance', 'bookkeep', 'recruit'],
    human: 'Advice, sign-off and anything regulated.', tools: 'Google Workspace or Microsoft 365, plus your practice software where it has an API.', first: 'Enquiry intake and onboarding: forms, document collection and reminders.' },
  { id: 'hosp', label: 'hospitality business', def: 'booking', kw: ['restaurant', 'cafe', 'café', 'bar', 'hotel', 'pub', 'venue', 'events', 'wedding', 'catering'],
    human: 'Large or unusual bookings and complaints.', tools: 'Your booking tool, email and a simple CRM.', first: 'Enquiry and booking handling for events and groups.' },
  { id: 'sales', label: 'sales-led business', def: 'qualify', kw: ['sales team', 'b2b', 'saas', 'coaching', 'coach', 'course', 'high ticket', 'high-ticket', 'closers', 'setters', 'agency'],
    human: 'The sales conversation itself.', tools: 'Your CRM (HubSpot, Salesforce or similar) and your calendar.', first: 'Lead qualification and routing, then follow-up.' },
  { id: 'trade', label: 'trade business', def: 'agent', kw: ['roof', 'plumb', 'electric', 'builder', 'building', 'joiner', 'carpent', 'plaster', 'landscap', 'garden', 'heating', 'boiler', 'hvac', 'scaffold', 'window', 'driveway', 'kitchen', 'bathroom', 'decorat', 'trade', 'contractor', 'clean', 'removal', 'mechanic', 'garage', 'solar', 'pest'],
    human: 'Site visits, pricing and anything that needs judgement.', tools: 'Your inbox and phone, a CRM such as HubSpot, and your calendar.', first: 'Enquiry capture, qualification and CRM, then quote follow-up.', capture: ['Web form, missed calls and messages', 'Captured in one place'] }
];
const GENERIC = { label: 'business', def: 'agent', human: 'Decisions, exceptions and relationships.', tools: 'The tools you already use, connected through their APIs.', first: 'Pick the most repetitive task and systemise that first.' };
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function detectIndustry(q) {
  let best = GENERIC, top = 0;
  for (const ind of INDUSTRIES) {
    const hits = ind.kw.filter(k => new RegExp('\\b' + reEsc(k)).test(q)).length;
    if (hits > top) { top = hits; best = ind; }
  }
  return best;
}
const sysFor = (id, ind) => Object.assign({}, SYSTEMS[id], ind && ind.sys && ind.sys[id]);
const article = w => /^[aeiou]/i.test(w) ? 'an' : 'a';
function parseVolume(text) {
  const q = text.toLowerCase();
  const UNIT = '(enquir\\w*|inquir\\w*|leads?|calls?|emails?|bookings?|orders?|messages?|requests?|tickets?|appointments?|jobs?|quotes?|customers?|clients?|viewings?|repairs?)';
  // a number, up to two describing words, then a unit: "40 viewing requests", "30 enquiries"
  let m = q.match(new RegExp('(\\d[\\d,]{0,5})\\s*(?:\\+|-\\s*\\d+|to\\s*\\d+)?\\s+((?:[a-z-]+\\s+){0,2})' + UNIT + '\\b'));
  let what;
  if (m) what = (m[2] + m[3]).trim();
  else {
    // "40 a week" with no unit: assume enquiries
    m = q.match(/(\d[\d,]{0,5})\s*\+?\s+(?:a|per|every|each)\s+(?:day|week|month)\b/);
    if (!m) return null;
    what = 'enquiries';
  }
  const num = parseInt(m[1].replace(/,/g, ''), 10); if (!num || num > 100000) return null;
  const per = q.match(/\b(day|daily|week|weekly|month|monthly)\b/);
  const period = per ? per[1].replace(/ly$/, '').replace('dai', 'day') : null;
  return { n: num, period, text: `${num} ${what}${period ? ' a ' + period : ''}` };
}
function localPlan(text) {
  const q = ' ' + text.toLowerCase() + ' ';
  const ind = detectIndustry(q);
  const vol = parseVolume(text);
  const ranked = rankSystems(text);
  let id = ranked[0].score >= 1.4 ? ranked[0].id : ind.def;
  const pref = ind.prefer && ind.prefer.find(([re]) => re.test(q));
  if (pref) id = pref[1];
  if (ind.id === 'trade' && (id === 'qualify' || id === 'maintenance')) id = 'agent';
  const S = sysFor(id, ind);
  let steps = S.steps.map(s => s.slice());
  if (ind.capture && ['agent', 'followup', 'qualify'].includes(id)) steps[0] = ind.capture.slice();
  const second = ranked.find(r => r.id !== id && r.score >= 1.4);
  const first = typeof ind.first === 'object' ? ind.first[id] || ind.first._ : ind.first;
  const notes = [['What gets automated', S.auto], ['What stays human', ind.human], ['Could run on', ind.tools], ['Sensible first build', first]];
  if (second) { const S2 = sysFor(second.id, ind); notes.push(['Worth adding later', S2.name + '. ' + S2.line]); }
  if (vol) {
    let extra = '';
    if (vol.period === 'week') extra = ` Roughly ${Math.round(vol.n * 4.3)} a month.`;
    if (vol.period === 'month') extra = ` Roughly ${Math.max(1, Math.round(vol.n / 4.3))} a week.`;
    notes.unshift(['Why it matters', `That's ${vol.text}, and each one currently needs someone to read it, log it and reply.${extra}`]);
  }
  const who = ind === GENERIC ? 'For a business like yours' : `For ${article(ind.label)} ${ind.label}`;
  const caps = t => t.replace(/\bai\b/g, 'AI').replace(/\bcrm\b/g, 'CRM');
  const what = S.np ? caps(S.np) : `${article(S.name)} ${caps(S.name.toLowerCase())}`;
  return { headline: `${who}${vol ? ' handling ' + vol.text : ''}, a realistic first system is ${what}.`, steps, notes, system: S.name };
}

/* ---------------------------------------------------------
   11 Talk to Blackline
   --------------------------------------------------------- */
(() => {
  const input = $('#talkIn'), go = $('#talkGo'), out = $('#talkOut'), ex = $('#talkEx'), mode = $('#talkMode');
  const EX = ['We manage 300 properties and get around 40 viewing requests a week.', 'Tenants report repairs by phone, email and WhatsApp and things get lost.', 'We spend days every month chasing late rent.', 'Landlords want monthly statements and we build them all by hand.'];
  ex.innerHTML = EX.map(e => `<button class="chip" type="button">${esc(e)}</button>`).join('');
  ex.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { input.value = b.textContent; send(); } });
  if (CONFIG.aiEndpoint) {
    $('.tag', mode.parentElement).lastChild.textContent = 'Live AI';
    mode.textContent = "What you type here is sent to an AI provider to write the reply. Please don't enter personal details.";
  }
  let busy = false;
  async function getPlan(text) {
    if (CONFIG.aiEndpoint) {
      try {
        const r = await fetch(CONFIG.aiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        if (j && j.headline && Array.isArray(j.steps)) return j;
      } catch (e) { /* fall through to the local engine */ }
    }
    return localPlan(text);
  }
  async function send() {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    if (busy) return; busy = true; go.disabled = true;
    out.innerHTML = `<div class="resp"><div><span class="mono dim">Blackline</span><h3 id="talkH" class="caret"></h3><dl id="talkDl"></dl></div><div><span class="mono dim">Proposed system</span><div id="talkFlow" style="margin-top:18px"></div></div></div>`;
    const plan = await getPlan(text);
    const h = $('#talkH', out);
    if (RM) h.textContent = plan.headline;
    else for (let i = 0; i <= plan.headline.length; i += 2) { h.textContent = plan.headline.slice(0, i); await sleep(12); }
    h.textContent = plan.headline; h.classList.remove('caret');
    mountFlow($('#talkFlow', out), plan.steps);
    const dl = $('#talkDl', out);
    for (const [k, v] of plan.notes || []) {
      dl.insertAdjacentHTML('beforeend', `<div class="fi"><dt class="mono dim">${esc(k)}</dt><dd>${esc(v)}</dd></div>`);
      await sleep(160);
    }
    dl.insertAdjacentHTML('beforeend', `<div><button class="btn btn-g btn-s" id="talkSend" type="button"><span>Start a project with this</span></button></div>`);
    $('#talkSend', out).addEventListener('click', () => Intake.prefill && Intake.prefill({ man: text }));
    busy = false; go.disabled = false;
  }
  go.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
})();

/* ---------------------------------------------------------
   16 What can Blackline build?
   --------------------------------------------------------- */
(() => {
  const input = $('#finderIn'), res = $('#finderRes'), ex = $('#finderEx');
  const EX = ['I need something that automatically follows up with leads.', 'I need an AI receptionist.', "I need my website's form to actually do something.", 'I spend hours copying data between tools.'];
  ex.innerHTML = EX.map(e => `<button class="chip" type="button">${esc(e)}</button>`).join('');
  let t, lastId = null;
  function render(force) {
    const q = input.value.trim();
    if (!q) { res.innerHTML = `<p class="dim">Try one of the examples, or describe the job in your own words.</p>`; lastId = null; return; }
    const r = rankSystems(q);
    if (r[0].score < 1) {
      if (lastId === 'none' && !force) return; lastId = 'none';
      res.innerHTML = `<span class="mono dim">No direct match</span><div class="finder-name">Probably a custom build</div><p class="finder-line">Nothing in the usual set fits that exactly, which normally means it's worth a proper look. Describe it in the project form and we'll tell you honestly whether it can be built.</p><a href="#intake" class="btn btn-g btn-s" id="finderGo"><span>Describe it</span></a>`;
      $('#finderGo').addEventListener('click', () => Intake.prefill && Intake.prefill({ svc: 'custom', man: q }));
      return;
    }
    const id = r[0].id; if (id === lastId && !force) return; lastId = id;
    const S = SYSTEMS[id];
    const alts = r.slice(1).filter(x => x.score >= 1).slice(0, 3);
    res.innerHTML = `<span class="mono dim">Best fit</span><div class="finder-name" id="finderName"></div><p class="finder-line">${esc(S.line)}</p><div id="finderFlow"></div>
      ${alts.length ? `<div class="finder-alt"><span class="mono dim">Also relevant</span>${alts.map(a => `<button class="chip" type="button" data-id="${a.id}">${esc(SYSTEMS[a.id].name)}</button>`).join('')}</div>` : ''}`;
    scramble($('#finderName'), S.name.toUpperCase());
    $('#finderFlow').innerHTML = chainHTML(S.steps);
    $$('.finder-alt .chip', res).forEach(c => c.addEventListener('click', () => show(c.dataset.id)));
  }
  function show(id) {
    const S = SYSTEMS[id]; lastId = id;
    scramble($('#finderName'), S.name.toUpperCase());
    $('.finder-line', res).textContent = S.line;
    $('#finderFlow').innerHTML = chainHTML(S.steps);
  }
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 220); });
  ex.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { input.value = b.textContent; render(true); } });
  render();
})();

/* ---------------------------------------------------------
   12 From chaos to system (scroll-driven)
   --------------------------------------------------------- */
(() => {
  const sec = $('#chaos'), stage = $('#chaosStage'), field = $('#chaosField'), lblL = $('#chaosL'), lblR = $('#chaosR');
  const FR = [['Leads_FINAL_v3.xlsx', 'm'], ['"Viewing request — which flat?"', ''], ['3 missed calls', ''], ['"Did anyone reply to her?"', ''], ['WhatsApp · 14 unread', 'm'], ['Rent overdue · 3 tenants', 'm'],
    ['Copy → paste → CRM', 'm'], ['Landlord statements due Fri', ''], ['Voicemail 0:48', 'm'], ['Follow up… when?', 'x'], ['Two bookings, one slot', ''], ['"Leak at Maple Ct — who\'s on it?"', '']];
  const SN = [['Lead'], ['AI'], ['Automation'], ['CRM'], ['Human', 1], ['Customer']];
  field.innerHTML = FR.map(([t, c]) => `<div class="frag ${c}">${esc(t)}</div>`).join('') + SN.map(([t, h]) => `<div class="snode${h ? ' h' : ''}"><i></i><b>${t}</b></div>`).join('') + '<div class="chaos-wire"></div>';
  const frags = $$('.frag', field), snodes = $$('.snode', field), wire = $('.chaos-wire', field);
  let A = [], T = [];
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  function layout() {
    seed = 7;
    const W = stage.clientWidth, H = stage.clientHeight, mob = W < 760;
    const x0 = (W >= 1100 ? 72 : 0) + Math.min(64, W * .044);
    const top = H * (mob ? .34 : .36), bot = H * .9;
    A = frags.map((f, i) => {
      const w = f.offsetWidth;
      const xmax = mob ? W - w - 16 : W * .5 - w;
      const cols = mob ? 2 : 3, cx = i % cols, cy = Math.floor(i / cols), rows = Math.ceil(frags.length / cols);
      return { x: x0 + (xmax - x0) * ((cx + rnd() * .8) / cols) + (mob ? 0 : rnd() * 20), y: top + (bot - top - 30) * ((cy + rnd() * .6) / rows), r: (rnd() - .5) * 16 };
    });
    const sx = mob ? W * .34 : W * .66;
    T = snodes.map((n, i) => ({ x: sx, y: top + (bot - top - 20) * (i / (snodes.length - 1)) }));
    wire.style.left = (sx + 5.5) + 'px'; wire.style.top = (T[0].y + 12) + 'px'; wire.style.height = (T[T.length - 1].y - T[0].y) + 'px';
    snodes.forEach((n, i) => n.style.transform = `translate3d(${T[i].x}px, ${T[i].y}px, 0)`);
    update(true);
  }
  function update(force) {
    if (!A.length) return;
    const r = sec.getBoundingClientRect();
    if (!force && (r.bottom < 0 || r.top > VH)) return;
    const p = RM ? 1 : pinProgress(sec);
    frags.forEach((f, i) => {
      const a = A[i], tgt = T[i % T.length];
      const k = eio(clamp((p - .12 - i * .014) / .42));
      const x = lerp(a.x, tgt.x, k), y = lerp(a.y, tgt.y, k);
      f.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${lerp(a.r, 0, k)}deg) scale(${lerp(1, .5, k)})`;
      f.style.opacity = 1 - clamp((k - .72) / .28);
    });
    snodes.forEach((n, i) => n.style.opacity = clamp((p - .48 - i * .03) / .1));
    wire.style.transform = `scaleY(${clamp((p - .52) / .3)})`;
    lblL.style.opacity = 1 - clamp((p - .15) / .25) * .75;
    lblR.style.opacity = clamp((p - .55) / .15);
  }
  resizeFns.push(layout); scrollFns.push(() => update());
  addEventListener('load', layout); // also laid out in the start-up frame (resizeFns)
})();

/* ---------------------------------------------------------
   13 System demos (clearly labelled examples)
   --------------------------------------------------------- */
(() => {
  const D = [
    { k: 'Applicants & viewings', s: 'Enquiry to booked viewing', d: 'For a team answering the same viewing requests from the portals, the website and the phone. Every applicant gets a reply, the right questions and a slot in the diary, even out of hours.',
      steps: [['Portal or website enquiry', 'Any portal, your site or email'], ['AI qualification', 'Move-in date, occupants, pets, budget'], ['CRM', 'Applicant record created'], ['Viewing booked', 'Straight into the calendar'], ['Reminders', 'Fewer no-shows'], ['Viewing confirmed with the team', 'Your team sees who is coming', 1]] },
    { k: 'Maintenance requests', s: 'Repairs from any channel', d: 'For a team where repairs arrive by phone, email and WhatsApp and get written down wherever someone happens to be. Every report is captured, sorted by urgency and sent to the right contractor.',
      steps: [['Tenant report', 'Phone, email or WhatsApp'], ['AI extraction', 'Property, issue, urgency'], ['Routed to contractor', 'The right trade, with the details'], ['Tenant kept updated', 'Who is coming and when'], ['Emergencies to a person', 'Anything urgent or unclear', 1]] },
    { k: 'Rent & arrears', s: 'Chasing without the awkwardness', d: 'For a team that spends the first week of every month checking the bank and writing reminders. Reminders go out on time, stay polite, and stop the moment the rent arrives.',
      steps: [['Due date passes', 'Checked against payments received'], ['Polite reminder', 'In your tone'], ['Escalating sequence', 'Firmer at each step, on your schedule'], ['Stops when paid', 'No reminders after payment'], ['Arrears flagged to a person', 'Your team decides what happens next', 1]] },
    { k: 'Landlord reporting', s: 'Monthly statements, built for you', d: 'For a team that builds every landlord statement by hand at month end. The numbers are pulled together automatically, explained in plain English and checked by a person before they go out.',
      steps: [['Month end', 'Runs on a schedule'], ['Data pulled from your tools', 'Rent, repairs and costs'], ['Statement assembled', 'One per landlord, per property'], ['AI summary in plain English', 'What happened this month'], ['Reviewed by a person before sending', 'Nothing goes out unchecked', 1]] }
  ];
  const tabs = $('#demoTabs'), panel = $('#demoPanel');
  let cur = -1, runT = [];
  tabs.innerHTML = D.map((d, i) => `<button class="demo-t" role="tab" id="demo-t${i}" aria-controls="demoPanel" aria-selected="false" tabindex="-1" data-i="${i}"><b>${esc(d.k)}</b><span>${esc(d.s)}</span></button>`).join('');
  const tb = $$('.demo-t', tabs);
  function show(i, focus) {
    if (i === cur) return; cur = i; runT.forEach(clearTimeout);
    tb.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
    if (focus) tb[i].focus();
    panel.setAttribute('aria-labelledby', 'demo-t' + i);
    const d = D[i];
    panel.innerHTML = `<div><span class="tag"><i></i>Demo system · example, not a client result</span><h3 class="d d-m">${esc(d.k)}</h3><p class="body">${esc(d.d)}</p><div class="btn-row" style="margin-top:26px"><button class="btn btn-p btn-s" id="demoRun" type="button"><span>Run it</span></button></div></div><div id="demoFlow"></div>`;
    mountFlow($('#demoFlow', panel), d.steps);
    $('#demoRun', panel).addEventListener('click', () => {
      runT.forEach(clearTimeout); runT = [];
      const ns = $$('.fnode', panel);
      ns.forEach(n => n.classList.remove('hot'));
      ns.forEach((n, j) => runT.push(setTimeout(() => { ns.forEach(m => m.classList.remove('hot')); n.classList.add('hot'); }, RM ? 0 : j * 520)));
      runT.push(setTimeout(() => ns.forEach(m => m.classList.add('hot')), RM ? 0 : ns.length * 520));
    });
  }
  tabs.addEventListener('click', e => { const t = e.target.closest('.demo-t'); if (t) show(+t.dataset.i); });
  tabs.addEventListener('keydown', e => {
    const n = D.length;
    if (['ArrowDown', 'ArrowRight'].includes(e.key)) { e.preventDefault(); show((cur + 1) % n, 1); }
    if (['ArrowUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); show((cur + n - 1) % n, 1); }
  });
  show(0);
})();

/* ---------------------------------------------------------
   14 Existing website demo — responsive preview + simulated pipeline
   --------------------------------------------------------- */
(() => {
  const dev = $('#device'), url = $('#dUrl'), sw = $$('.web-sw button'), form = $('#mkForm'), ok = $('#mkOk'), pipe = $$('#pipe li'), log = $('#pipeLog');
  sw.forEach(b => b.addEventListener('click', () => { sw.forEach(x => x.setAttribute('aria-pressed', x === b)); dev.dataset.d = b.dataset.d; url.textContent = `harbourside-pm.demo · ${b.dataset.d}`; }));
  let busy = false;
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return;
    const f = new FormData(form), name = (f.get('name') || '').trim(), email = (f.get('email') || '').trim(), prop = f.get('prop'), intent = f.get('intent');
    if (!name || !email) { ok.style.display = 'block'; ok.style.color = '#a4332a'; ok.textContent = 'Add a name and email to send the demo enquiry.'; return; }
    busy = true; ok.style.display = 'none';
    pipe.forEach(l => { l.classList.remove('hot', 'done'); $('em', l).textContent = ''; });
    log.innerHTML = '';
    const view = /viewing/i.test(intent);
    const S = [
      ['form', 'received', `form      enquiry received from the existing site's form`],
      ['ai', view ? 'viewing' : 'question', `ai        property="${prop}" · wants=${view ? 'viewing' : 'answer'} · applicant=${name}`],
      ['crm', 'created', `crm       contact created for ${name} · stage "New enquiry"`],
      ['cal', view ? 'Thu 2:00pm' : 'not needed', view ? 'calendar  viewing offered Thu 2:00pm · slot held for 24h' : 'calendar  no booking needed · question passed to the team'],
      ['follow', 'scheduled', view ? 'follow-up confirmation sent · reminder scheduled for Wed 2:00pm' : 'follow-up reply drafted from approved info · chase in 48h if unanswered']
    ];
    let ms = 0;
    for (const [k, em, txt] of S) {
      const d = 380 + Math.random() * 380; ms += d; await sleep(d);
      pipe.forEach(l => { if (l.classList.contains('hot')) { l.classList.remove('hot'); l.classList.add('done'); } });
      const li = pipe.find(l => l.dataset.k === k); li.classList.add('hot'); $('em', li).textContent = em;
      log.insertAdjacentHTML('beforeend', `<div class="l"><span class="t">+${(ms / 1000).toFixed(2)}s</span>${esc(txt)}</div>`);
      log.scrollTop = log.scrollHeight;
    }
    await sleep(300);
    log.insertAdjacentHTML('beforeend', `<div class="l"><span class="t">done</span><span class="ok">one human step left: ${view ? 'showing ' + esc(name) + ' round' : 'checking the reply to ' + esc(name)}</span></div>`);
    log.scrollTop = log.scrollHeight;
    ok.style.color = ''; ok.textContent = "Thanks. We've got it and we'll be in touch shortly."; ok.style.display = 'block';
    busy = false;
  });
})();

/* ---------------------------------------------------------
   15 Built around your stack
   --------------------------------------------------------- */
(() => {
  const TOOLS = [
    ['OpenAI', 'AI model', 'Connected through the OpenAI API for classification, extraction and drafting', [2, 3, 7]],
    ['Anthropic', 'AI model', 'Connected through the Anthropic API for reading, summarising and drafting', [2, 5, 13]],
    ['n8n', 'Automation', 'Workflows, self-hosted or cloud, calling APIs and webhooks', [0, 7, 11, 13]],
    ['Make', 'Automation', 'Scenarios triggered by webhooks and app events', [0, 5, 9]],
    ['Zapier', 'Automation', 'Zaps between apps, with webhooks for anything custom', [7, 9, 10]],
    ['Google Workspace', 'Workspace', 'Gmail, Sheets, Calendar and Drive through Google APIs', [1, 3, 9]],
    ['Microsoft 365', 'Workspace', 'Outlook, Excel and Teams through Microsoft Graph', [2, 8, 12]],
    ['HubSpot', 'CRM', 'CRM API and webhooks for contacts, deals and tasks', [0, 2, 4, 9]],
    ['Salesforce', 'CRM', 'REST API for records, with platform events where needed', [6, 12, 13]],
    ['Calendly', 'Scheduling', 'API and webhooks for bookings and cancellations', [3, 4, 5, 7]],
    ['Stripe', 'Payments', 'API and webhooks for payments, invoices and subscriptions', [4, 11, 13]],
    ['Webhooks', 'Custom', 'Any tool that can send a webhook can start a workflow', [2, 10, 12]],
    ['REST APIs', 'Custom', 'Documented APIs, connected directly or through a small service', [6, 8, 11, 13]],
    ['Databases', 'Custom', 'Postgres, Supabase or Airtable for data that needs a proper home', [1, 2, 8, 10]]
  ];
  const box = $('#stackBox'), gridEl = $('#stackGrid'), svg = $('#stackSvg'), info = $('#stackInfo');
  gridEl.innerHTML = TOOLS.map(([n, c], i) => `<button class="tool" type="button" data-i="${i}" aria-pressed="false"><b>${esc(n)}</b><small>${esc(c)}</small></button>`).join('');
  const tb = $$('.tool', gridEl);
  let cur = -1, auto = true, cyc, inView = false;
  function lines() {
    if (cur < 0) { svg.innerHTML = ''; return; }
    const g = box.getBoundingClientRect(), c = r => [r.left - g.left + r.width / 2, r.top - g.top + r.height / 2];
    const a = c(tb[cur].getBoundingClientRect());
    svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`);
    svg.innerHTML = TOOLS[cur][3].map(j => { const b = c(tb[j].getBoundingClientRect()); return `<line class="on" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-dasharray="3 6"><animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1s" repeatCount="indefinite"/></line>`; }).join('');
  }
  function sel(i) {
    cur = i;
    tb.forEach((b, j) => { const on = j === i || (i >= 0 && TOOLS[i][3].includes(j)); b.classList.toggle('on', on); b.setAttribute('aria-pressed', j === i); });
    if (i >= 0) { const [n, , how, pairs] = TOOLS[i]; info.textContent = `${n}: ${how}. Often paired with ${joinAnd(pairs.map(j => TOOLS[j][0]))}.`; }
    lines();
  }
  gridEl.addEventListener('click', e => { const b = e.target.closest('.tool'); if (!b) return; auto = false; clearInterval(cyc); sel(+b.dataset.i); });
  if (FINE) gridEl.addEventListener('pointerover', e => { const b = e.target.closest('.tool'); if (b && !auto) sel(+b.dataset.i); });
  const startCycle = () => { clearInterval(cyc); if (!auto || RM) return; cyc = setInterval(() => sel((cur + 1) % TOOLS.length), 2600); };
  watch(box, v => { inView = v; if (v) { if (cur < 0) sel(0); startCycle(); } else clearInterval(cyc); });
  resizeFns.push(lines);
})();

/* ---------------------------------------------------------
   17 Process
   --------------------------------------------------------- */
(() => {
  const el = $('#proc'), fill = $('#procFill'), st = $$('.pst', el);
  scrollFns.push(() => {
    const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > VH + 200) return;
    const vert = innerWidth <= 900;
    const p = RM ? 1 : clamp((VH * .78 - r.top) / (r.height + VH * .2));
    fill.style.transform = vert ? `scaleY(${p})` : `scaleX(${p})`;
    st.forEach((s, i) => s.classList.toggle('on', p >= (i + .3) / st.length));
  });
})();

/* ---------------------------------------------------------
   19 Project intake
   --------------------------------------------------------- */
(() => {
  const SV = [['integration', 'Integration', 'Connect the tools you already have'], ['automation', 'Automation', 'Remove repetitive work'], ['agent', 'AI Agent', 'Enquiries, tenants, support'],
    ['booking', 'Lead to Booking', 'Every lead answered and booked'], ['operations', 'Operations', 'Payments, repairs, reports'], ['custom', 'Custom Build', 'Bespoke systems'], ['unsure', 'Not sure', 'Help me work it out']];
  const BIZ = ['Property management', 'Trade or home services', 'Clinic or salon', 'Professional services', 'Agency', 'Sales team'];
  const MAN = ['Replying to enquiries', 'Booking viewings or appointments', 'Chasing follow-ups', 'Chasing payments', 'Routing repair requests', 'Copying data between tools', 'Building reports', 'Answering the same questions'];
  const PREF = ['Email', 'Phone', 'Either'];
  const st = { step: 0, svc: null, pref: 'Email', ref: '' };
  const form = $('#inForm'), steps = $$('.in-step', form), prog = $$('#inProg i'), back = $('#inBack'), next = $('#inNext'), err = $('#inErr');
  const biz = $('#inBiz'), man = $('#inMan'), nm = $('#inName'), em = $('#inEmail'), ph = $('#inPhone'), brief = $('#brief'), sentEl = $('#inSent');
  $('#inSvc').innerHTML = SV.map(([id, t, s]) => `<button type="button" class="in-opt" data-id="${id}" aria-pressed="false"><b>${esc(t)}</b><span>${esc(s)}</span></button>`).join('');
  $('#inBizQ').innerHTML = BIZ.map(b => `<button type="button" class="chip">${esc(b)}</button>`).join('');
  $('#inManQ').innerHTML = MAN.map(b => `<button type="button" class="chip">${esc(b)}</button>`).join('');
  $('#inPref').innerHTML = PREF.map(b => `<button type="button" class="chip" aria-pressed="${b === st.pref}">${esc(b)}</button>`).join('');
  const setSvc = id => { st.svc = id; $$('.in-opt').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id)); };
  $('#inSvc').addEventListener('click', e => { const b = e.target.closest('.in-opt'); if (!b) return; setSvc(b.dataset.id); err.textContent = ''; setTimeout(() => go(1), RM ? 0 : 260); });
  $('#inBizQ').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { biz.value = b.textContent; biz.focus(); } });
  $('#inManQ').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; const v = man.value.trim(); if (!v.includes(b.textContent)) man.value = v ? v.replace(/[.\s]*$/, '') + '. ' + b.textContent + '.' : b.textContent + '.'; man.focus(); });
  $('#inPref').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; st.pref = b.textContent; $$('#inPref .chip').forEach(c => c.setAttribute('aria-pressed', c === b)); });

  // Spam protection: a honeypot field and a time-trap. Either one quietly fakes success and sends nothing.
  const hp = $('#inHp'), renderedAt = performance.now(), MIN_MS = 3000;
  const LIMITS = { name: 100, email: 254, phone: 30, text: 2000 };
  const val = el => el.value.trim();
  // returns [[field or null, message], ...]; field null means a step-level message
  function validate(s) {
    const out = [];
    if (s === 0 && !st.svc) out.push([null, 'Choose what you need, or pick "Not sure".']);
    if (s === 1) {
      if (val(biz).length < 2) out.push([biz, 'Tell us briefly what the business does.']);
      else if (val(biz).length > LIMITS.text) out.push([biz, `Keep this under ${LIMITS.text} characters.`]);
    }
    if (s === 2) {
      if (val(man).length < 4) out.push([man, "Describe what's being done by hand, even roughly."]);
      else if (val(man).length > LIMITS.text) out.push([man, `Keep this under ${LIMITS.text} characters.`]);
    }
    if (s === 3) {
      const n = val(nm), e = val(em), p = val(ph), digits = p.replace(/\D/g, '');
      if (n.length < 2) out.push([nm, 'Add your name.']);
      else if (n.length > LIMITS.name) out.push([nm, `Keep your name under ${LIMITS.name} characters.`]);
      if (!e) out.push([em, 'Add an email address we can reply to.']);
      else if (e.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) out.push([em, 'That email address doesn\u2019t look right. Check it and try again.']);
      if (p && (p.length > LIMITS.phone || !/^[+\d][\d\s().-]*$/.test(p) || digits.length < 7 || digits.length > 15)) out.push([ph, 'That phone number doesn\u2019t look right. Use digits, spaces and an optional +.']);
      else if (!p && st.pref === 'Phone') out.push([ph, 'Add a phone number, or choose email.']);
    }
    return out;
  }
  const fieldsOf = s => ({ 1: [biz], 2: [man], 3: [nm, em, ph] }[s] || []);
  function showErrors(s, list) {
    err.textContent = '';
    fieldsOf(s).forEach(f => { f.removeAttribute('aria-invalid'); const fe = $('#' + f.id + 'Err'); if (fe) fe.textContent = ''; });
    list.forEach(([f, m]) => {
      if (!f) { err.textContent = m; return; }
      f.setAttribute('aria-invalid', 'true');
      const fe = $('#' + f.id + 'Err');
      if (fe) fe.textContent = m; else err.textContent = m;
    });
    const first = list.find(([f]) => f);
    if (first) first[0].focus();
  }
  // the service picked narrows which systems the brief can suggest
  const FITS = { booking: ['booking', 'followup', 'qualify', 'agent'], operations: ['arrears', 'maintenance', 'reporting', 'docs', 'sync'] };
  function potential() {
    const map = { integration: 'sync', agent: 'agent', custom: 'custom' };
    let id = map[st.svc];
    if (!id) {
      const r = rankSystems(man.value + ' ' + biz.value).filter(x => x.score >= 1 && (!FITS[st.svc] || FITS[st.svc].includes(x.id)));
      id = r.length ? r[0].id : FITS[st.svc] ? FITS[st.svc][0] : 'sync';
    }
    return sysFor(id, detectIndustry(' ' + (biz.value + ' ' + man.value).toLowerCase() + ' '));
  }
  function data() {
    const S = potential();
    return {
      ref: st.ref, service: SV.find(s => s[0] === st.svc)[1], business: val(biz).slice(0, LIMITS.text), manual_work: val(man).slice(0, LIMITS.text),
      potential_system: { name: S.name, steps: S.steps.map(s => s[0]) },
      contact: { name: val(nm).slice(0, LIMITS.name), email: val(em).slice(0, LIMITS.email), phone: val(ph).slice(0, LIMITS.phone), preferred: st.pref },
      submitted_at: new Date().toISOString()
    };
  }
  // flat fields read cleanly in the Formspree email; "email" becomes the reply-to address
  const payload = d => ({
    _subject: $('#inSubject').value, reference: d.ref, name: d.contact.name, email: d.contact.email, phone: d.contact.phone, preferred_contact: d.contact.preferred,
    service: d.service, business: d.business, manual_work: d.manual_work,
    potential_system: `${d.potential_system.name} (${d.potential_system.steps.join(' → ')})`, submitted_at: d.submitted_at
  });
  function renderBrief() {
    if (!st.ref) st.ref = 'BL-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const d = data();
    const row = (k, v) => `<div class="brief-r"><span class="mono dim">${k}</span><div class="v">${v}</div></div>`;
    brief.innerHTML = `<div class="brief-h"><b>BLACKLINE PROJECT BRIEF</b><span class="mono dim">${esc(d.ref)}</span></div><div class="brief-b">
      ${row('Service', esc(d.service))}${row('Business', esc(d.business))}${row('Problem', esc(d.manual_work.length > 260 ? d.manual_work.slice(0, 257) + '…' : d.manual_work))}
      ${row('Potential system', `<div style="margin-bottom:10px">${esc(d.potential_system.name)}</div>${chainHTML(d.potential_system.steps)}`)}
      ${row('Contact', esc([d.contact.name, d.contact.email, d.contact.phone].filter(Boolean).join(' · ')) + `<div class="dim" style="font-size:.86rem">Prefers ${esc(d.contact.preferred.toLowerCase())}</div>`)}
      </div>`;
    sentEl.innerHTML = '<p class="dim" style="margin-top:14px;font-size:.88rem">This is a first sketch. We\u2019ll confirm what\u2019s realistic before anything is quoted.</p>';
  }
  function go(s) {
    st.step = s; showErrors(s, []);
    steps.forEach((el, i) => el.classList.toggle('on', i === s));
    prog.forEach((p, i) => p.classList.toggle('on', i <= s));
    back.style.visibility = s === 0 ? 'hidden' : '';
    next.style.display = s === 0 ? 'none' : '';
    $('span', next).textContent = s === 3 ? 'Create brief' : s === 4 ? 'Submit brief →' : 'Next';
    $('#inPriv').hidden = s < 3;
    if (s === 4) renderBrief();
    const f = steps[s].querySelector('input, textarea');
    if (f && s > 0) setTimeout(() => f.focus({ preventScroll: true }), 50);
  }
  function sent(d) {
    sentEl.innerHTML = `<div class="sent"><div class="d d-m">Brief sent.</div><p class="lede" style="margin-top:12px">Reference ${esc(d.ref)}. We'll be in touch by ${esc(d.contact.preferred === 'Phone' ? 'phone' : 'email')} to talk it through.</p></div>`;
    $('.in-nav', form).style.display = 'none';
    err.textContent = '';
  }
  let sending = false;
  async function submit() {
    if (sending) return;
    const d = data();
    // bots: filled the hidden field, or got here faster than a person could
    if (hp.value || performance.now() - renderedAt < MIN_MS) { sent(d); return; }
    sending = true; next.disabled = true; $('span', next).textContent = 'Sending…'; err.textContent = '';
    let ok = false;
    const configured = CONFIG.contactEndpoint && !CONFIG.contactEndpoint.includes('[');
    if (configured) {
      try {
        const r = await fetch(CONFIG.contactEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload(d)) });
        ok = r.status >= 200 && r.status < 300;
      } catch (e) { ok = false; }
    }
    sending = false;
    if (ok) { sent(d); return; }
    // never show success here: say what happened, keep everything typed, offer email instead
    const text = `BLACKLINE PROJECT BRIEF ${d.ref}\nService: ${d.service}\nBusiness: ${d.business}\nProblem: ${d.manual_work}\nPotential system: ${d.potential_system.name} (${d.potential_system.steps.join(' → ')})\nContact: ${d.contact.name}, ${d.contact.email}${d.contact.phone ? ', ' + d.contact.phone : ''} (prefers ${d.contact.preferred})`;
    const mail = CONFIG.contactEmail;
    const body = text.length > 1800 ? text.slice(0, 1790) + '…' : text;
    err.innerHTML = `Sorry, your brief didn't send. Nothing you typed has been lost: try again${mail ? `, or email it to <a href="mailto:${esc(mail)}?subject=${encodeURIComponent('Project brief ' + d.ref)}&body=${encodeURIComponent(body)}">${esc(mail)}</a>` : ''}.`;
    sentEl.innerHTML = `<div class="btn-row" style="margin-top:14px"><button type="button" class="btn btn-g btn-s" id="inCopy"><span>Copy brief</span></button></div>
      <textarea class="field" id="inCopyTxt" rows="6" readonly style="margin-top:12px;display:none;font-family:var(--m);font-size:.74rem" aria-label="Your brief">${esc(text)}</textarea>`;
    $('#inCopy').addEventListener('click', async () => {
      const done = await copyText(text);
      const ta = $('#inCopyTxt'); if (!done) { ta.style.display = 'block'; ta.select(); }
      $('#inCopy span').textContent = done ? 'Copied' : 'Selected below, press Ctrl+C';
    });
    next.disabled = false; $('span', next).textContent = 'Try again';
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (st.step === 4) { submit(); return; }
    const problems = validate(st.step);
    showErrors(st.step, problems);
    if (problems.length) return;
    go(st.step + 1);
  });
  back.addEventListener('click', () => { if (st.step > 0) go(st.step - 1); });
  Intake.prefill = ({ svc, man: m }) => {
    if (svc) setSvc(svc);
    if (m) man.value = m;
    go(st.svc ? 1 : 0);
    $('#intake').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  };
  go(0);
})();

requestAnimationFrame(() => { resizeFns.forEach(f => f()); runScroll(); });
})();
