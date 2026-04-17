const sharp  = require('sharp');
const axios  = require('axios');
const https  = require('https');
const http   = require('http');

// ─────────────────────────────────────────────────────────────────────────────
// Logo fetcher – tries favicon.ico then Open Graph image
// ─────────────────────────────────────────────────────────────────────────────
async function fetchLogoBuffer(websiteUrl) {
  if (!websiteUrl) return null;
  try {
    const origin = new URL(websiteUrl).origin;

    // Candidates in priority order
    const candidates = [
      `${origin}/favicon.ico`,
      `${origin}/logo.png`,
      `${origin}/logo.svg`,
      `${origin}/images/logo.png`,
      `${origin}/assets/logo.png`,
      `${origin}/wp-content/uploads/logo.png`
    ];

    // Also try Open Graph image from the page HTML
    try {
      const html = await fetchText(websiteUrl, 6000);
      const ogMatch  = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      const logoMatch = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);

      if (ogMatch?.[1])   candidates.unshift(resolveUrl(origin, ogMatch[1]));
      if (logoMatch?.[1]) candidates.splice(1, 0, resolveUrl(origin, logoMatch[1]));
    } catch (_) {}

    for (const url of candidates.slice(0, 6)) {
      try {
        const buf = await downloadBuffer(url, 5000);
        if (buf && buf.length > 500) {
          // Convert to PNG and resize to 80×80
          const png = await sharp(buf)
            .resize(80, 80, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
          return png;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

function resolveUrl(origin, href) {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('/')) return origin + href;
  return origin + '/' + href;
}

function fetchText(url, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
      timeout
    }, res => {
      let data = '';
      res.on('data', c => { data += c; if (data.length > 50000) req.destroy(); });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function downloadBuffer(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout
    }, res => {
      if (res.statusCode !== 200) return res.resume(), reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Currency detection – keeps the original symbol from the scraped price
// If the dish.price is a number, we check dish.currency or website_url country
// ─────────────────────────────────────────────────────────────────────────────
// Currency code → symbol map
const CURRENCY_SYMBOLS = {
  INR: '\u20B9', USD: '$', EUR: '\u20AC', GBP: '\u00A3',
  JPY: '\u00A5', AED: 'AED', SGD: 'S$', AUD: 'A$', CAD: 'C$'
};

function formatPrice(rawPrice, currencySymbol) {
  if (!rawPrice && rawPrice !== 0) return '';
  // If rawPrice is already a string with a currency symbol, use it as-is
  if (typeof rawPrice === 'string' && /[$\u20B9\u20AC\u00A3\u00A5]/.test(rawPrice)) return rawPrice.trim();
  // Map 3-letter ISO code to symbol
  const sym = CURRENCY_SYMBOLS[String(currencySymbol || '').toUpperCase()] || currencySymbol || '\u20B9';
  const num = parseFloat(String(rawPrice).replace(/[^\d.]/g, ''));
  if (isNaN(num)) return '';
  return `${sym}${Math.round(num)}`;
}

function detectCurrencySymbol(dish) {
  // Explicit ISO currency code field
  if (dish.currency)       return dish.currency;       // e.g. 'INR', 'USD'
  if (dish.price_currency) return dish.price_currency;

  // Detect from price string that already has a symbol
  const priceStr = String(dish.price || '');
  if (/\$/.test(priceStr))       return 'USD';
  if (/\u20AC/.test(priceStr))   return 'EUR';
  if (/\u00A3/.test(priceStr))   return 'GBP';
  if (/\u00A5/.test(priceStr))   return 'JPY';
  if (/\u20B9/.test(priceStr))   return 'INR';

  // Heuristic from price magnitude
  const num = parseFloat(priceStr.replace(/[^\d.]/g, ''));
  if (num > 0 && num <= 100)  return 'USD'; // small number → dollars
  if (num > 100)              return 'INR'; // large number → rupees

  return 'INR'; // default
}

// ─────────────────────────────────────────────────────────────────────────────

class CreativeBuilderService {
  getDimensions(format) {
    const dimensions = {
      'square':    { width: 1080, height: 1080 },
      'story':     { width: 1080, height: 1920 },
      'landscape': { width: 1200, height: 630  }
    };
    return dimensions[format] || dimensions['square'];
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 255, g: 107, b: 53 };
  }

  escapeXml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  sanitizeHex(hex, fallback = '#FF6B35') {
    return /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : fallback;
  }

  lightenColor(hex) {
    const num = parseInt((hex || '#FF6B35').replace('#', ''), 16);
    return `#${[
      Math.min(255, (num >> 16) + 45),
      Math.min(255, ((num >> 8) & 0xFF) + 45),
      Math.min(255, (num & 0xFF) + 45)
    ].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  darkenColor(hex) {
    const num = parseInt((hex || '#FF6B35').replace('#', ''), 16);
    return `#${[
      Math.max(0, (num >> 16) - 45),
      Math.max(0, ((num >> 8) & 0xFF) - 45),
      Math.max(0, (num & 0xFF) - 45)
    ].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  // Word-wrap to lines, no overflow
  wrapText(text, maxCharsPerLine, maxLines = 3) {
    if (!text) return [];
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (test.length <= maxCharsPerLine) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word.length > maxCharsPerLine
          ? word.substring(0, maxCharsPerLine - 3) + '...'
          : word;
        if (lines.length >= maxLines - 1) break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (!lines.length) lines.push('');
    return lines;
  }

  renderWrappedText(lines, x, startY, fontSize, lineHeight, fill, fontFamily, fontWeight = 'normal', anchor = 'start', filter = '') {
    const fa = filter ? `filter="url(#${filter})"` : '';
    const tspans = lines.map((line, i) =>
      `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${this.escapeXml(line)}</tspan>`
    ).join('');
    return `<text x="${x}" y="${startY}"
      font-family="${fontFamily}"
      font-size="${fontSize}"
      font-weight="${fontWeight}"
      fill="${fill}"
      text-anchor="${anchor}"
      ${fa}>${tspans}</text>`;
  }

  buildGradientSvg(width, height) {
    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0E0500"/>
      <stop offset="100%" stop-color="#1A0A00"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
</svg>`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SHARED FILTER DEFINITIONS (same across all layouts)
  // ──────────────────────────────────────────────────────────────────────────
  sharedDefs(accent, accent2) {
    return `
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${accent}"/>
      <stop offset="100%" stop-color="${accent2}"/>
    </linearGradient>
    <filter id="ds" x="-12%" y="-12%" width="124%" height="136%">
      <feDropShadow dx="0" dy="4" stdDeviation="7"  flood-color="rgba(0,0,0,0.92)"/>
    </filter>
    <filter id="gf" x="-18%" y="-18%" width="136%" height="160%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="bg" x="-25%" y="-25%" width="150%" height="175%">
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${accent}" flood-opacity="0.75"/>
    </filter>
    <filter id="cs" x="-5%" y="-5%" width="110%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="12" flood-color="rgba(0,0,0,0.65)"/>
    </filter>
    <filter id="qs" x="-5%" y="-5%" width="110%" height="120%">
      <feDropShadow dx="1" dy="2" stdDeviation="4"  flood-color="rgba(0,0,0,0.7)"/>
    </filter>`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SQUARE LAYOUT  1080×1080
  // Left panel 44%, food image right 56%
  // ──────────────────────────────────────────────────────────────────────────
  buildSquareLayout(width, height, params) {
    const { headline, name, description, price, cta, restaurantName, accent, hasLogo } = params;
    const accent2 = this.lightenColor(accent);

    const panelW = Math.floor(width * 0.44);
    const px     = 38;
    const innerW = panelW - px * 2;

    // Font sizes – generous for 1080px
    const rNameFs  = 22;
    const hdlFs    = 21;
    const nameFs   = 44;
    const descFs   = 21;   // BIGGER than before
    const priceFs  = 40;
    const ctaFs    = 18;
    const nameLineH = Math.round(nameFs * 1.2);
    const descLineH = Math.round(descFs * 1.5);

    const nameLines = this.wrapText(name.toUpperCase(), Math.floor(innerW / (nameFs * 0.60)), 2);
    const descLines = this.wrapText(description,        Math.floor(innerW / (descFs * 0.54)), 3);

    // Vertical layout
    const logoY    = hasLogo ? 20 : -1;
    const rNameY   = hasLogo ? 120 : 70;
    const divY1    = rNameY + 14;

    let y = rNameY + 52;
    const badgeY = y; const badgeH = 42; y += badgeH + 24;
    const divY2  = y; y += 18;
    const nameY  = y + nameFs + (nameLines.length > 1 ? nameLineH : 0);
    y = nameY + (nameLines.length > 1 ? nameLineH : 5) + 22;

    // Quoted description opening mark
    const descY      = y + descFs;
    y = descY + descLines.length * descLineH + 16;

    // Bottom decorative area
    const priceY   = price ? y + priceFs : y; if (price) y = priceY + 28;
    const ornY     = Math.min(y + 30, height - 200); // ornament line
    const ctaBoxT  = height - 128;
    const ctaTextY = ctaBoxT + 36;

    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="rgba(7,3,1,0.98)"/>
      <stop offset="80%"  stop-color="rgba(12,5,1,0.94)"/>
      <stop offset="100%" stop-color="rgba(20,8,1,0.0)"/>
    </linearGradient>
    <linearGradient id="vigBot" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="55%"  stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.88)"/>
    </linearGradient>
    <linearGradient id="ornGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${accent}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    ${this.sharedDefs(accent, accent2)}
  </defs>

  <!-- Panel scrim -->
  <rect x="0" y="0" width="${panelW + 70}" height="${height}" fill="url(#panelGrad)"/>
  <!-- Bottom vignette (full width) -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#vigBot)"/>
  <!-- Left accent stripe -->
  <rect x="0" y="0" width="6" height="${height}" fill="url(#accentGrad)"/>

  <!-- ── RESTAURANT NAME ── -->
  <text x="${px}" y="${rNameY}"
    font-family="Georgia,'Times New Roman',serif"
    font-size="${rNameFs}" font-weight="bold"
    fill="white" text-anchor="start"
    filter="url(#bg)">${this.escapeXml(restaurantName.substring(0, 28).toUpperCase())}</text>
  <line x1="${px}" y1="${divY1}" x2="${panelW - px}" y2="${divY1}"
    stroke="${accent}" stroke-width="1.5" opacity="0.55"/>

  <!-- ── TODAY'S SPECIAL BADGE (single instance) ── -->
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="7" fill="${accent}" opacity="0.13"/>
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="7" fill="none" stroke="${accent}" stroke-width="1.3" opacity="0.65"/>
  <text x="${panelW / 2}" y="${badgeY + badgeH / 2 + 7}"
    font-family="'Trebuchet MS',Arial,sans-serif"
    font-size="${hdlFs}" font-weight="bold"
    fill="${accent}" text-anchor="middle"
    filter="url(#gf)">- ${this.escapeXml(headline.substring(0, 22))} -</text>

  <!-- Thin rule -->
  <line x1="${px}" y1="${divY2}" x2="${panelW - px}" y2="${divY2}"
    stroke="${accent}" stroke-width="1" opacity="0.35"/>

  <!-- ── DISH NAME ── -->
  ${this.renderWrappedText(nameLines, px, nameY, nameFs, nameLineH, 'white',
    "'Arial Black',Impact,sans-serif", '900', 'start', 'ds')}

  <!-- ── QUOTED DESCRIPTION ── -->
  ${this.renderWrappedText(
    descLines,
    px + 6, descY, descFs, descLineH,
    'rgba(248,232,210,0.92)', "Georgia,'Times New Roman',serif",
    'normal', 'start', 'ds')}

  <!-- ── PRICE ── -->
  ${price ? `
  <rect x="${px - 4}" y="${priceY - priceFs + 4}" height="${priceFs + 10}" rx="4"
    fill="${accent}" opacity="0.10"/>
  <text x="${px}" y="${priceY}"
    font-family="'Arial Black',Arial,sans-serif"
    font-size="${priceFs}" font-weight="900"
    fill="${accent}" filter="url(#gf)">${this.escapeXml(price)}</text>
  <text x="${px}" y="${priceY + 18}"
    font-family="Arial,sans-serif" font-size="12"
    fill="rgba(255,255,255,0.45)" letter-spacing="2">ONLY</text>
  ` : ''}

  <!-- ── ORNAMENTAL DIVIDER ── -->
  <line x1="${px}" y1="${ornY}" x2="${panelW - px}" y2="${ornY}"
    stroke="url(#ornGrad)" stroke-width="1.2"/>
  <text x="${panelW / 2}" y="${ornY + 22}"
    font-family="Georgia,serif" font-size="11"
    fill="rgba(255,255,255,0.20)" text-anchor="middle"
    letter-spacing="4">-- EST --</text>

  <!-- ── CTA BUTTON ── -->
  <rect x="${px}" y="${ctaBoxT}" width="${innerW}" height="52" rx="26"
    fill="url(#accentGrad)" filter="url(#cs)"/>
  <text x="${panelW / 2}" y="${ctaTextY}"
    font-family="'Trebuchet MS',Arial,sans-serif"
    font-size="${ctaFs}" font-weight="bold"
    fill="white" text-anchor="middle"
    letter-spacing="1.8">${this.escapeXml(cta.substring(0, 22))}</text>

  <!-- ── FOOTER ── -->
  <text x="${px}" y="${height - 16}"
    font-family="Georgia,serif" font-size="12"
    fill="rgba(255,255,255,0.28)">${this.escapeXml(restaurantName.substring(0, 32))}</text>
</svg>`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STORY LAYOUT  1080×1920
  // Food image top 60%, full-width text panel bottom 40%
  // ──────────────────────────────────────────────────────────────────────────
  buildStoryLayout(width, height, params) {
    const { headline, name, description, price, cta, restaurantName, accent, hasLogo } = params;
    const accent2 = this.lightenColor(accent);

    const panelY = Math.floor(height * 0.60);
    const panelH = height - panelY;
    const px     = 60;
    const innerW = width - px * 2;

    const rNameFs  = 32;
    const hdlFs    = 30;
    const nameFs   = 60;
    const descFs   = 26;   // BIGGER
    const priceFs  = 52;
    const ctaFs    = 24;
    const nameLineH = Math.round(nameFs * 1.18);
    const descLineH = Math.round(descFs * 1.55);

    const nameLines = this.wrapText(name.toUpperCase(), Math.floor(innerW / (nameFs * 0.58)), 2);
    const descLines = this.wrapText(description,        Math.floor(innerW / (descFs * 0.52)), 2);

    // Image-area: restaurant name at top
    const rNameY = hasLogo ? 130 : 80;

    // Panel-area layout
    let py = panelY + 28;
    const badgeY = py; const badgeH = 56; py += badgeH + 26;
    const divY   = py; py += 18;
    const nameY  = py + nameFs + (nameLines.length > 1 ? nameLineH : 0);
    py = nameY + (nameLines.length > 1 ? nameLineH : 6) + 24;

    
    const descY      = py + descFs;
    py = descY + descLines.length * descLineH + 22;

    const priceY   = price ? py + priceFs : py; if (price) py = priceY + 30;
    const ctaBoxT  = height - 158;
    const ctaTextY = ctaBoxT + 46;

    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="rgba(7,3,1,0.97)"/>
      <stop offset="100%" stop-color="rgba(10,4,1,0.99)"/>
    </linearGradient>
    <linearGradient id="fadeEdge" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="rgba(0,0,0,0)"/>
      <stop offset="65%"  stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(7,3,1,0.98)"/>
    </linearGradient>
    <linearGradient id="topVig" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="rgba(0,0,0,0.80)"/>
      <stop offset="28%"  stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
    <linearGradient id="ornGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${accent}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    ${this.sharedDefs(accent, accent2)}
  </defs>

  <!-- Top vignette (for name readable) -->
  <rect x="0" y="0" width="${width}" height="${Math.floor(height * 0.26)}" fill="url(#topVig)"/>
  <!-- Fade from image into panel -->
  <rect x="0" y="${Math.floor(height * 0.44)}" width="${width}" height="${Math.floor(height * 0.20)}" fill="url(#fadeEdge)"/>
  <!-- Dark panel -->
  <rect x="0" y="${panelY}" width="${width}" height="${panelH}" fill="url(#panelGrad)"/>
  <!-- Accent top stripe -->
  <rect x="0" y="${panelY}" width="${width}" height="5" fill="url(#accentGrad)"/>

  <!-- ── RESTAURANT NAME (over image top) ── -->
  <text x="${width / 2}" y="${rNameY}"
    font-family="Georgia,'Times New Roman',serif"
    font-size="${rNameFs}" font-weight="bold"
    fill="white" text-anchor="middle"
    filter="url(#bg)">${this.escapeXml(restaurantName.substring(0, 30).toUpperCase())}</text>

  <!-- ── TODAY'S SPECIAL BADGE ── -->
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="9" fill="${accent}" opacity="0.14"/>
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="9" fill="none" stroke="${accent}" stroke-width="1.6" opacity="0.60"/>
  <text x="${width / 2}" y="${badgeY + badgeH / 2 + 10}"
    font-family="'Trebuchet MS',Arial,sans-serif"
    font-size="${hdlFs}" font-weight="bold"
    fill="${accent}" text-anchor="middle"
    filter="url(#gf)">- ${this.escapeXml(headline.substring(0, 25))} -</text>

  <line x1="${px}" y1="${divY}" x2="${width - px}" y2="${divY}"
    stroke="${accent}" stroke-width="1.2" opacity="0.38"/>

  <!-- ── DISH NAME ── -->
  ${this.renderWrappedText(nameLines, px, nameY, nameFs, nameLineH, 'white',
    "'Arial Black',Impact,sans-serif", '900', 'start', 'ds')}

  <!-- ── QUOTED DESCRIPTION ── -->
  ${this.renderWrappedText(descLines, px + 8, descY, descFs, descLineH,
    'rgba(248,232,210,0.90)', "Georgia,'Times New Roman',serif",
    'normal', 'start', 'ds')}

  <!-- ── PRICE ── -->
  ${price ? `
  <text x="${px}" y="${priceY}"
    font-family="'Arial Black',Arial,sans-serif"
    font-size="${priceFs}" font-weight="900"
    fill="${accent}" filter="url(#gf)">${this.escapeXml(price)}</text>
  <text x="${px}" y="${priceY + 22}"
    font-family="Arial,sans-serif" font-size="14"
    fill="rgba(255,255,255,0.40)" letter-spacing="3">ONLY</text>
  ` : ''}

  <!-- ── CTA BUTTON ── -->
  <rect x="${px}" y="${ctaBoxT}" width="${innerW}" height="68" rx="34"
    fill="url(#accentGrad)" filter="url(#cs)"/>
  <text x="${width / 2}" y="${ctaTextY}"
    font-family="'Trebuchet MS',Arial,sans-serif"
    font-size="${ctaFs}" font-weight="bold"
    fill="white" text-anchor="middle"
    letter-spacing="2.5">${this.escapeXml(cta.substring(0, 22))}</text>

  <!-- ── FOOTER ── -->
  <text x="${px}" y="${height - 20}"
    font-family="Georgia,serif" font-size="15"
    fill="rgba(255,255,255,0.25)">${this.escapeXml(restaurantName.substring(0, 34))}</text>
</svg>`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LANDSCAPE LAYOUT  1200×630
  // Text panel left 44%, food image right 56%
  // ──────────────────────────────────────────────────────────────────────────
  buildLandscapeLayout(width, height, params) {
    const { headline, name, description, price, cta, restaurantName, accent, hasLogo } = params;
    const accent2 = this.lightenColor(accent);

    const panelW = Math.floor(width * 0.44);
    const px     = 34;
    const innerW = panelW - px * 2;

    const rNameFs  = 18;
    const hdlFs    = 17;
    const nameFs   = 32;
    const descFs   = 16;   // BIGGER than 14
    const priceFs  = 32;
    const ctaFs    = 15;
    const nameLineH = Math.round(nameFs * 1.18);
    const descLineH = Math.round(descFs * 1.55);

    const nameLines = this.wrapText(name.toUpperCase(), Math.floor(innerW / (nameFs * 0.61)), 2);
    const descLines = this.wrapText(description,        Math.floor(innerW / (descFs * 0.54)), 3);

    const rNameY = hasLogo ? 108 : 50;
    const divY1  = rNameY + 10;

    let y = rNameY + 42;
    const badgeY = y; const badgeH = 36; y += badgeH + 18;
    const divY2  = y; y += 14;
    const nameY  = y + nameFs + (nameLines.length > 1 ? nameLineH : 0);
    y = nameY + (nameLines.length > 1 ? nameLineH : 4) + 16;
    const descY      = y + descFs;
    y = descY + descLines.length * descLineH + 14;

    const priceY   = price ? y + priceFs : y; if (price) y = priceY + 20;
    const ornY     = Math.min(y + 14, height - 115);
    const ctaBoxT  = height - 96;
    const ctaTextY = ctaBoxT + 30;

    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="rgba(7,3,1,0.98)"/>
      <stop offset="80%"  stop-color="rgba(12,5,1,0.93)"/>
      <stop offset="100%" stop-color="rgba(20,8,1,0.0)"/>
    </linearGradient>
    <linearGradient id="vigBot" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="52%"  stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.84)"/>
    </linearGradient>
    <linearGradient id="ornGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${accent}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    ${this.sharedDefs(accent, accent2)}
  </defs>

  <!-- Panel scrim -->
  <rect x="0" y="0" width="${panelW + 60}" height="${height}" fill="url(#panelGrad)"/>
  <!-- Bottom vignette -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#vigBot)"/>
  <!-- Left accent stripe -->
  <rect x="0" y="0" width="5" height="${height}" fill="url(#accentGrad)"/>

  <!-- ── RESTAURANT NAME ── -->
  <text x="${px}" y="${rNameY}"
    font-family="Georgia,'Times New Roman',serif"
    font-size="${rNameFs}" font-weight="bold"
    fill="white" text-anchor="start"
    filter="url(#bg)">${this.escapeXml(restaurantName.substring(0, 30).toUpperCase())}</text>
  <line x1="${px}" y1="${divY1}" x2="${panelW - px}" y2="${divY1}"
    stroke="${accent}" stroke-width="1" opacity="0.50"/>

  <!-- ── TODAY'S SPECIAL BADGE ── -->
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="5" fill="${accent}" opacity="0.13"/>
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="5" fill="none" stroke="${accent}" stroke-width="1" opacity="0.55"/>
  <text x="${panelW / 2}" y="${badgeY + badgeH / 2 + 6}"
    font-family="'Trebuchet MS',Arial,sans-serif"
    font-size="${hdlFs}" font-weight="bold"
    fill="${accent}" text-anchor="middle"
    filter="url(#gf)">- ${this.escapeXml(headline.substring(0, 22))} -</text>

  <line x1="${px}" y1="${divY2}" x2="${panelW - px}" y2="${divY2}"
    stroke="${accent}" stroke-width="1" opacity="0.32"/>

  <!-- ── DISH NAME ── -->
  ${this.renderWrappedText(nameLines, px, nameY, nameFs, nameLineH, 'white',
    "'Arial Black',Impact,sans-serif", '900', 'start', 'ds')}

  <!-- ── QUOTED DESCRIPTION ── -->
  ${this.renderWrappedText(descLines, px + 6, descY, descFs, descLineH,
    'rgba(248,232,210,0.90)', "Georgia,'Times New Roman',serif",
    'normal', 'start', 'ds')}

  <!-- ── PRICE ── -->
  ${price ? `
  <text x="${px}" y="${priceY}"
    font-family="'Arial Black',Arial,sans-serif"
    font-size="${priceFs}" font-weight="900"
    fill="${accent}" filter="url(#gf)">${this.escapeXml(price)}</text>
  <text x="${px}" y="${priceY + 16}"
    font-family="Arial,sans-serif" font-size="10"
    fill="rgba(255,255,255,0.38)" letter-spacing="2">ONLY</text>
  ` : ''}

  <!-- ── ORNAMENTAL DIVIDER ── -->
  <line x1="${px}" y1="${ornY}" x2="${panelW - px}" y2="${ornY}"
    stroke="url(#ornGrad)" stroke-width="1"/>

  <!-- ── CTA BUTTON ── -->
  <rect x="${px}" y="${ctaBoxT}" width="${innerW}" height="46" rx="23"
    fill="url(#accentGrad)" filter="url(#cs)"/>
  <text x="${panelW / 2}" y="${ctaTextY}"
    font-family="'Trebuchet MS',Arial,sans-serif"
    font-size="${ctaFs}" font-weight="bold"
    fill="white" text-anchor="middle"
    letter-spacing="1.8">${this.escapeXml(cta.substring(0, 20))}</text>

  <!-- ── FOOTER ── -->
  <text x="${px}" y="${height - 12}"
    font-family="Georgia,serif" font-size="11"
    fill="rgba(255,255,255,0.25)">${this.escapeXml(restaurantName.substring(0, 32))}</text>
</svg>`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Logo circular badge SVG (placed as composite over panel top-left)
  // ──────────────────────────────────────────────────────────────────────────
  buildLogoPlaceholderSvg(size, accent) {
    // Used only when no logo image available but we want a brand circle
    const initials = 'R';
    return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 3}"
    fill="${accent}" opacity="0.25" stroke="${accent}" stroke-width="2"/>
  <text x="${size/2}" y="${size/2 + 8}" font-family="Georgia,serif"
    font-size="${Math.round(size*0.38)}" font-weight="bold"
    fill="white" text-anchor="middle">${initials}</text>
</svg>`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // buildOverlaySvg – entry point called by buildCreative
  // ──────────────────────────────────────────────────────────────────────────
  buildOverlaySvg(width, height, dish, caption, format, style, campaignType = 'daily') {
    const name           = dish.name || 'Special Dish';
    const currencySymbol = detectCurrencySymbol(dish);
    const price          = formatPrice(dish.price, currencySymbol);
    const headline       = (caption?.headline || "Today's Special").replace(/^[^\w]*/, '');
    const cta            = caption?.cta || 'Order Now';
    const restaurantName = dish.restaurant_name || 'Our Restaurant';
    const rawDesc        = caption?.caption || dish.description || '';
    const description    = rawDesc ? `\u201c${rawDesc}\u201d` : '';
    const accent         = this.sanitizeHex(style?.accent || '#FF6B35', '#FF6B35');
    const hasLogo        = !!(dish.logo_url || dish.logo_buffer);

    const params = { headline, name, description, price, cta, restaurantName, accent, hasLogo };

    if (format === 'story')     return this.buildStoryLayout(width, height, params);
    if (format === 'landscape') return this.buildLandscapeLayout(width, height, params);
    return this.buildSquareLayout(width, height, params);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Main creative builder
  // ──────────────────────────────────────────────────────────────────────────
  async buildCreative(options) {
    const { dish, format, imageBuffer, colors, caption, campaignType } = options;
    const { width, height } = this.getDimensions(format);
    const style = {
      accent:    this.sanitizeHex(colors?.[0] || '#FF6B35', '#FF6B35'),
      secondary: colors?.[1] || '#2E4057'
    };
    const accent = style.accent;

    try {
      // 1. Base canvas
      const gradSvg = this.buildGradientSvg(width, height);
      const base    = await sharp(gradSvg).resize(width, height).png().toBuffer();

      const composites = [];

      // 2. Food photo
      if (imageBuffer && imageBuffer.length > 1000) {
        let imgW, imgH, imgTop, imgLeft;
        if (format === 'story') {
          imgW = width; imgH = Math.floor(height * 0.60);
          imgTop = 0;   imgLeft = 0;
        } else {
          // square & landscape: food on the RIGHT
          imgW    = Math.floor(width * 0.60);
          imgH    = height;
          imgTop  = 0;
          imgLeft = Math.floor(width * 0.40);
        }
        const resized = await sharp(imageBuffer)
          .resize(imgW, imgH, { fit: 'cover', position: 'centre' })
          .png()
          .toBuffer();
        composites.push({ input: resized, top: imgTop, left: imgLeft });
      }

      // 3. Text/panel overlay (NO secondary "Today's Special" ribbon – single badge only)
      const overlaySvg = this.buildOverlaySvg(width, height, dish, caption, format, style, campaignType);
      composites.push({ input: overlaySvg, top: 0, left: 0 });

      // 4. Logo (fetched from website_url or restaurant.logo_url)
      const logoUrl = dish.logo_url || dish.website_url;
      let logoBuf   = null;
      if (logoUrl) {
        try {
          logoBuf = await fetchLogoBuffer(logoUrl);
        } catch (_) { logoBuf = null; }
      }

      if (logoBuf) {
        // Place logo top-left inside panel (80×80, with 6px left-stripe offset)
        const logoSize = format === 'story' ? 90 : 80;
        const resizedLogo = await sharp(logoBuf)
          .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

        const logoTop  = 20;
        const logoLeft = format === 'story' ? Math.floor(width / 2) - Math.floor(logoSize / 2) : 14;
        composites.push({ input: resizedLogo, top: logoTop, left: logoLeft });
      }

      // 5. Compose
      const finalBuffer = await sharp(base)
        .composite(composites)
        .png()
        .toBuffer();

      return { success: true, buffer: finalBuffer, dimensions: `${width}x${height}` };

    } catch (error) {
      console.error('Creative build error:', error.message);
      try {
        const gradSvg    = this.buildGradientSvg(width, height);
        const overlaySvg = this.buildOverlaySvg(width, height, dish, caption, format, style, campaignType);
        const fallback   = await sharp(gradSvg)
          .composite([{ input: overlaySvg, top: 0, left: 0 }])
          .png()
          .toBuffer();
        return { success: true, buffer: fallback, dimensions: `${width}x${height}` };
      } catch (e2) {
        return { success: false, error: e2.message };
      }
    }
  }

  buildCreativeDailySpecial(options) {
    return this.buildCreative(options);
  }

  async convertOutput(buffer, exportType = 'png') {
    if (exportType === 'jpg')  return sharp(buffer).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    if (exportType === 'webp') return sharp(buffer).webp({ quality: 92 }).toBuffer();
    return sharp(buffer).png().toBuffer();
  }

  getMimeType(exportType = 'png') {
    if (exportType === 'jpg')  return 'image/jpeg';
    if (exportType === 'webp') return 'image/webp';
    return 'image/png';
  }
}

module.exports = new CreativeBuilderService();
