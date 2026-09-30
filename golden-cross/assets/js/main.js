/* The Golden Cross — site behaviour. No dependencies. */
(function () {
  "use strict";
  var C = window.GC_CONFIG || {};
  var doc = document.documentElement;
  doc.classList.remove("no-js");

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Header on scroll + mobile action bar ---------- */
  var header = $(".site-header");
  var bar = $(".action-bar");
  var hero = $(".hero");
  function onScroll() {
    var y = window.scrollY;
    if (header && !header.classList.contains("solid")) header.classList.toggle("scrolled", y > 40);
    if (bar) {
      var threshold = hero ? hero.offsetHeight * 0.6 : 200;
      bar.classList.toggle("show", y > threshold);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav ---------- */
  var toggle = $(".menu-toggle");
  var mnav = $(".mobile-nav");
  function setNav(open) {
    if (!toggle || !mnav) return;
    toggle.setAttribute("aria-expanded", String(open));
    mnav.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open && header) header.classList.add("scrolled");
    else onScroll();
  }
  if (toggle) toggle.addEventListener("click", function () { setNav(toggle.getAttribute("aria-expanded") !== "true"); });
  if (mnav) mnav.addEventListener("click", function (e) { if (e.target.closest("a")) setNav(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });

  /* ---------- Reveal on scroll ---------- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    $$(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Menu tabs ---------- */
  var tabs = $$(".menu-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
    });
    tab.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(tab);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var n = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
        n.focus(); n.click();
      }
    });
  });

  /* ---------- Opening hours ---------- */
  var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var LABEL = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  function fmt(t) {
    var p = t.split(":"), h = +p[0], m = p[1];
    var s = h >= 12 ? "pm" : "am"; h = h % 12 || 12;
    return h + (m === "00" ? "" : ":" + m) + s;
  }
  var hoursEl = $("[data-hours]");
  var openEl = $("[data-open-now]");
  if (hoursEl) {
    if (C.hours) {
      var today = DAYS[new Date().getDay()];
      var rows = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(function (d) {
        var r = C.hours[d] || [];
        var txt = r.length ? r.map(function (x) { return fmt(x[0]) + "–" + fmt(x[1]); }).join(", ") : "Closed";
        return '<tr class="' + (d === today ? "today" : "") + '"><th scope="row">' + LABEL[d] + "</th><td>" + txt + "</td></tr>";
      }).join("");
      hoursEl.innerHTML = '<caption class="sr-only">Opening hours</caption><tbody>' + rows + "</tbody>";
      if (openEl) {
        var now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
        var open = (C.hours[today] || []).some(function (r) {
          var a = r[0].split(":"), b = r[1].split(":");
          return mins >= +a[0] * 60 + +a[1] && mins < +b[0] * 60 + +b[1];
        });
        openEl.textContent = open ? "Open now" : "Closed right now";
        openEl.classList.toggle("is-open", open);
        openEl.hidden = false;
      }
    } else {
      hoursEl.outerHTML = '<p class="form-note" style="margin-bottom:20px">Opening times vary with the seasons — give us a ring on <a href="tel:' +
        C.phoneTel + '">' + C.phoneDisplay + "</a> and we'll tell you when the kitchen's open.</p>";
    }
  }

  /* ---------- Booking form ---------- */
  var dateInputs = $$('input[type="date"]');
  var iso = function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  dateInputs.forEach(function (i) { i.min = iso(new Date()); });

  // Hero quick-book → prefill main form and scroll
  var quick = $("#quick-book");
  if (quick) quick.addEventListener("submit", function (e) {
    e.preventDefault();
    var main = $("#booking-form");
    if (main) {
      ["date", "time", "guests"].forEach(function (k) {
        var src = quick.elements[k], dst = main.elements[k];
        if (src && dst && src.value) dst.value = src.value;
      });
    }
    var target = $("#book");
    if (target) target.scrollIntoView({ behavior: "smooth" });
    setTimeout(function () { var n = main && main.elements.name; if (n) n.focus({ preventScroll: true }); }, 600);
  });

  // Table / room toggle
  $$(".segmented button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".segmented button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      var type = b.getAttribute("data-type");
      var form = $("#booking-form");
      if (!form) return;
      form.elements.type.value = type;
      $$("[data-for]", form).forEach(function (el) {
        var show = el.getAttribute("data-for") === type;
        el.hidden = !show;
        $$("input,select", el).forEach(function (inp) { inp.disabled = !show; });
      });
      var btn = $("[data-submit-label]", form);
      if (btn) btn.textContent = type === "room" ? "Check room availability" : "Request my table";
    });
  });

  // Any "check rooms" link switches the form to room mode
  $$("[data-open-room]").forEach(function (a) {
    a.addEventListener("click", function () { var b = $('.segmented [data-type="room"]'); if (b) b.click(); });
  });

  var form = $("#booking-form");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = $(".form-status", form);
    var show = function (msg, ok) { status.innerHTML = msg; status.className = "form-status show " + (ok ? "ok" : "err"); };
    if (form.elements.company && form.elements.company.value) return; // honeypot
    if (!form.checkValidity()) { form.reportValidity(); return; }

    var data = new FormData(form);
    data.delete("company");
    var btn = form.querySelector('button[type="submit"]');
    var label = btn.textContent;

    var lines = [];
    data.forEach(function (v, k) { if (v) lines.push(k.charAt(0).toUpperCase() + k.slice(1) + ": " + v); });
    var subject = (data.get("type") === "room" ? "Room enquiry" : "Table request") + " — " + (data.get("name") || "");

    var fallback = function () {
      window.location.href = "mailto:" + C.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      show("We've opened your email app with your request filled in — just press send. Prefer to talk? Call <a href=\"tel:" + C.phoneTel + "\">" + C.phoneDisplay + "</a>.", true);
    };

    if (!C.formEndpoint) { fallback(); return; }

    btn.disabled = true; btn.textContent = "Sending…";
    data.append("_subject", subject);
    fetch(C.formEndpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        show("<strong>Thank you!</strong> Your request is with us. We'll confirm by email or phone shortly — a booking is only confirmed once you hear back from us.", true);
        if (typeof window.gtag === "function") window.gtag("event", "generate_lead", { form: data.get("type") });
      })
      .catch(function () {
        show("Sorry, that didn't send. Please call us on <a href=\"tel:" + C.phoneTel + "\">" + C.phoneDisplay + "</a> or <a href=\"#\" data-mailto>email us instead</a>.", false);
        var m = $("[data-mailto]", status); if (m) m.addEventListener("click", function (ev) { ev.preventDefault(); fallback(); });
      })
      .finally(function () { btn.disabled = false; btn.textContent = label; });
  });

  /* ==========================================================================
     Cookie consent (UK GDPR + PECR)
     - Nothing non-essential loads before an explicit opt-in.
     - "Reject" is as easy as "Accept" (same size, same layer).
     - Choice stored for 6 months, then we ask again.
     - Visitors can change their mind any time via [data-cookie-settings].
     ========================================================================== */
  var KEY = "gc_consent_v1";
  var MAX_AGE = 1000 * 60 * 60 * 24 * 182;
  function readConsent() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || "null");
      if (c && Date.now() - c.ts < MAX_AGE) return c;
    } catch (e) {}
    return null;
  }
  function saveConsent(c) {
    c.ts = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    return c;
  }
  var banner = $("#cookie-banner");
  var prefs = banner && $(".cookie-prefs", banner);
  var consent = readConsent();

  function apply(c) {
    // Third-party map embeds (Google sets cookies)
    $$("[data-map]").forEach(function (box) {
      if (c && c.maps && !box.querySelector("iframe")) loadMap(box);
    });
    // Analytics
    if (c && c.analytics && C.analytics && C.analytics.ga4Id && !window.__gaLoaded) {
      window.__gaLoaded = true;
      var s = document.createElement("script");
      s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(C.analytics.ga4Id);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", C.analytics.ga4Id, { anonymize_ip: true });
    }
  }
  function loadMap(box) {
    var f = document.createElement("iframe");
    f.src = C.mapsEmbed; f.loading = "lazy"; f.title = "Map showing The Golden Cross, 14 Princess Street, Shrewsbury";
    f.referrerPolicy = "no-referrer-when-downgrade"; f.allowFullscreen = true;
    box.appendChild(f);
    var ov = $(".map-consent", box); if (ov) ov.remove();
  }
  function openBanner(showPrefs) {
    if (!banner) return;
    var c = readConsent() || {};
    $$("input[data-cat]", banner).forEach(function (i) { i.checked = !!c[i.getAttribute("data-cat")]; });
    if (prefs) prefs.classList.toggle("open", !!showPrefs);
    banner.classList.add("show");
    banner.removeAttribute("aria-hidden");
  }
  function closeBanner() { if (banner) { banner.classList.remove("show"); banner.setAttribute("aria-hidden", "true"); } }
  function choose(c) {
    var prev = readConsent();
    consent = saveConsent(c);
    closeBanner();
    // If consent was withdrawn, reload so already-loaded third-party content is removed.
    if (prev && ((prev.analytics && !c.analytics) || (prev.maps && !c.maps))) { window.location.reload(); return; }
    apply(consent);
  }

  if (banner) {
    banner.addEventListener("click", function (e) {
      var a = e.target.closest("[data-consent]");
      if (!a) return;
      var act = a.getAttribute("data-consent");
      if (act === "accept") choose({ necessary: true, analytics: true, maps: true });
      else if (act === "reject") choose({ necessary: true, analytics: false, maps: false });
      else if (act === "manage") {
        if (prefs && prefs.classList.contains("open")) {
          var c = { necessary: true };
          $$("input[data-cat]", banner).forEach(function (i) { c[i.getAttribute("data-cat")] = i.checked; });
          choose(c);
        } else {
          prefs && prefs.classList.add("open");
          a.textContent = "Save my choices";
        }
      }
    });
  }
  $$("[data-cookie-settings]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      openBanner(true);
      var m = banner && $('[data-consent="manage"]', banner); if (m) m.textContent = "Save my choices";
    });
  });
  // One-off map load without changing wider consent
  $$("[data-map-once]").forEach(function (b) {
    b.addEventListener("click", function () { var box = b.closest("[data-map]"); if (box) loadMap(box); });
  });

  if (consent) apply(consent);
  else setTimeout(function () { openBanner(false); }, 900);
})();
