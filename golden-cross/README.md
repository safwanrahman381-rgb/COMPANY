# The Golden Cross, Shrewsbury: website

A static website with no build step and no dependencies. You can host it anywhere: Netlify, Cloudflare Pages, GitHub Pages or any web host. Drag the `golden-cross/` folder onto Netlify or Cloudflare Pages and it's live.

Preview it locally:

```bash
cd golden-cross && python3 -m http.server 8000   # open http://localhost:8000
```

## What's included

| File | Purpose |
|---|---|
| `index.html` | One-page site: hero with quick booking, reviews ticker, story, menu tabs, Google reviews, rooms, booking form, FAQ, find us/map, final call to action |
| `privacy.html` | UK GDPR / DPA 2018 privacy policy: lawful bases, retention, rights, ICO complaints, hotel guest-register duty |
| `cookies.html` | PECR cookie policy with a cookie table |
| `terms.html` | Website terms plus table and room booking conditions (Consumer Contracts Regs exemption, Licensing Act / Challenge 25, smoke-free, CRA 2015) |
| `allergens.html` | 14 major allergens (Food Information Regulations 2014) and cross-contamination notice |
| `accessibility.html` | Accessibility statement (WCAG 2.2 AA target, Equality Act 2010 adjustments, assistance dogs) |
| `404.html` | Custom not-found page |
| `_headers` | Security headers (HSTS, CSP, etc.) for Netlify / Cloudflare Pages |
| `robots.txt`, `sitemap.xml`, `site.webmanifest` | SEO basics |
| `assets/js/config.js` | **The one file to edit**: phone, email, form endpoint, opening hours, analytics |

### Built for conversion
- A "Book a table" button is always in view: header button, hero quick-book card, and a sticky Call / Directions / Book bar on mobile.
- Social proof comes first: the 4.7★ from 114 Google reviews sits in the hero, followed by a quote ticker, real review quotes and the topics guests mention.
- One form covers both table and room enquiries. It works without a backend: if no form endpoint is set, it opens the guest's email app with the request filled in.
- Click-to-call and directions links everywhere.
- FAQ answers common objections and doubles as FAQPage structured data.
- `Restaurant` schema.org markup for local SEO. Self-serving review stars are deliberately left out because Google ignores them for your own business and can penalise them.

### Built to stay legal (UK)
- **Cookie consent that actually blocks.** Google Maps and analytics load only after the visitor opts in. "Reject all" is the same size as "Accept all". Consent expires after 6 months. A "Cookie settings" link in every footer lets visitors withdraw consent.
- Fonts are self-hosted, so visitors' IP addresses aren't sent to Google Fonts.
- The form has a privacy notice, an unticked marketing opt-in and a honeypot for spam.
- The site aims for accessibility: skip link, keyboard-navigable tabs, visible focus, reduced-motion support and alt text.

## Launch checklist: confirm with the owner first

Search the code for `TODO` to find every spot.

1. **Permission.** Get the owner's go-ahead to publish, and to use their name, reviews and photos.
2. **Legal entity.** Add the business name and, if it's a limited company, the company number, registered office and VAT number. They go in the footer of each page, `privacy.html` and `terms.html`. The Companies Act 2006 requires this on the website of any Ltd company.
3. **ICO registration number** in `privacy.html`. Most businesses that handle personal data must pay the ICO data protection fee.
4. **Email address** in `assets/js/config.js` and `privacy.html`.
5. **Opening hours** in `assets/js/config.js`. Until they're set, the site says "call to check" rather than guessing. Once set, it also shows a live "Open now" badge.
6. **Form endpoint.** Create a free Formspree (or similar) form and paste its URL into `formEndpoint`. Add its origin to `connect-src` in `_headers` if it isn't formspree.io.
7. **Photos.** Drop these into `assets/images/`. Each slot shows a styled gradient until its photo is added. Use landscape JPGs around 1600px wide, compressed to under 300 KB each.
   `hero.jpg`, `passage.jpg`, `dining-room.jpg`, `room.jpg`, `shrewsbury.jpg`, `wine.jpg`, `crab-tian.jpg`, `ham-hock-terrine.jpg`, `goats-cheese.jpg`, `onion-soup.jpg`, `fish-and-chips.jpg`, `hake.jpg`, `steak-confit-duck.jpg`, `tempura.jpg`, `og.jpg` (1200×630, for social sharing) and `apple-touch-icon.png` (180×180).
   Only use photos you have rights to. Google Maps user photos belong to the people who took them.
8. **Menu and dish descriptions.** Check them against the current menu.
9. **Room details.** Add check-in and check-out times, cancellation and deposit terms (they go in confirmations), and whether rooms are on site.
10. **Accessibility specifics** in `accessibility.html`: accessible toilet, step-free routes and so on.
11. **CCTV.** If there is any, add a CCTV section to the privacy policy.
12. **Analytics** is optional. Add a GA4 ID to `config.js`. If you don't use analytics, delete the analytics paragraph in `cookies.html`.
13. **Domain.** The canonical and sitemap URLs assume `https://goldencrosshotel.co.uk/`.

> These legal pages are solid, standard templates written for a UK restaurant with rooms. They aren't a substitute for advice from a solicitor on the owner's specific circumstances.
