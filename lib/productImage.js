// Generates a product shot (boxed tube on marble) as SVG, so the shop looks finished
// before real photos exist. Drop a real photo at public/images/products/<slug>.jpg|png|webp
// and it will be used instead.
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hash(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function productSvg(product, storeName) {
  const seed = hash(product.slug) % 100;
  const accent = product.accent || '#333';
  const label = esc(product.boxLabel || product.name);
  const strength = esc(product.strength || '');
  const size = esc((product.name.match(/(\d+\s?g)\s*$/i) || [])[1] || '');
  const brand = esc(storeName);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="${esc(product.name)}">
  <defs>
    <filter id="marble" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.0028" numOctaves="4" seed="${seed}"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0"/>
      <!-- Only a thin band of the noise field becomes opaque, which draws veins. -->
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0.15 0.85 0.15 0 0 0 0 0 0 0 0 0 0"/>
      </feComponentTransfer>
      <feGaussianBlur stdDeviation="1.8"/>
    </filter>
    <filter id="veins2" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.0025" numOctaves="4" seed="${seed + 7}"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0 0 0.5 0 0 0 0 0 0 0 0 0 0"/>
      </feComponentTransfer>
      <feGaussianBlur stdDeviation="2.5"/>
    </filter>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f4f2"/><stop offset="1" stop-color="#e3e3e0"/>
    </linearGradient>
    <linearGradient id="box" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ecebe6"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-30%" width="120%" height="180%">
      <feDropShadow dx="6" dy="14" stdDeviation="12" flood-color="#000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect width="800" height="800" fill="#5a5a5a" filter="url(#veins2)" opacity="0.35"/>
  <rect width="800" height="800" fill="#222" filter="url(#marble)" opacity="0.7"/>
  <g filter="url(#shadow)" transform="translate(110 320)">
    <rect width="580" height="160" rx="3" fill="url(#box)"/>
    <rect x="14" y="0" width="12" height="160" fill="${accent}"/>
    <rect x="32" y="0" width="5" height="160" fill="${accent}" opacity="0.7"/>
    <text x="60" y="52" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#3a3a3a" letter-spacing="0.5">${label}</text>
    <text x="60" y="90" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="700" fill="${accent}">${brand.toUpperCase()}</text>
    <text x="60" y="138" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#777">${size}</text>
    <circle cx="500" cy="80" r="62" fill="${accent}"/>
    <circle cx="500" cy="80" r="46" fill="#fff" opacity="0.18"/>
    <text x="500" y="89" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${strength.length > 4 ? 22 : 28}" font-weight="700" fill="#fff">${strength}</text>
  </g>
</svg>`;
}

module.exports = { productSvg };
