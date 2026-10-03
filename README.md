# BLACKLINE website

Static site for Netlify. No build step: deploy the repository root as it is.

## Files

| File | What it is |
|---|---|
| `index.html` | The home page (content and markup) |
| `styles.css` | All styles, shared by every page |
| `app.js` | All behaviour. Settings are in `CONFIG` at the top |
| `privacy.html`, `terms.html`, `accessibility.html` | Legal pages (drafts, no JavaScript) |
| `404.html` | Shown for any missing page |
| `booked.html`, `booked.js` | Thank-you page after booking a discovery call in GoHighLevel (not indexed by Google) |
| `fonts/` | Self-hosted Archivo and JetBrains Mono (SIL Open Font License), see `fonts/README.md` |
| `_headers` | Security headers and the Content-Security-Policy |
| `_redirects` | Redirects to the main domain (switched off until the domain is set) |
| `robots.txt`, `sitemap.xml` | For search engines |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `og.png` | Icons and the social sharing image |

## Netlify settings

- Publish directory: the repository root
- Build command: none

## Before launch

1. **Fill in every placeholder.** They're written in square brackets, e.g. `[CONTACT_EMAIL]`, and show up
   highlighted in yellow on the pages. Search the repository for `[` to find them all.
2. **Formspree:** create a form, then put its ID in `CONFIG.contactEndpoint` in `app.js`
   (`https://formspree.io/f/YOUR_ID`). Until then the enquiry form sends nothing and shows visitors an email fallback.
3. **Domain:** add blacklinehq.co.uk in Netlify's domain settings, then switch on the redirect rules in
   `_redirects` (instructions are in the file).
4. **Legal pages:** have them reviewed, then remove the `Draft — review before publishing` comment at the top of each.
5. **Check it live:** run Lighthouse (mobile) on the deployed site, and send a test enquiry.

## Turning things on later

- **Live AI for "Talk to Blackline":** set `CONFIG.aiEndpoint`. Keep the API key on the server. Add the endpoint to
  `connect-src` in `_headers` if it's on another domain, and name the AI provider in `privacy.html`.
- **Analytics or a Meta Pixel:** add it to `CONFIG.trackers`. A consent banner then appears automatically. Read the
  "Consent" comment in `app.js` first: it lists the privacy policy and `_headers` changes needed at the same time.
