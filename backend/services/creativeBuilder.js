const sharp = require('sharp');

class CreativeBuilderService {
  getDimensions(format) {
    const dimensions = {
      'square':    { width: 1080, height: 1080 },
      'story':     { width: 1080, height: 1920 },
      'landscape': { width: 1200, height: 630 }
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
    const r = Math.min(255, (num >> 16) + 40);
    const g = Math.min(255, ((num >> 8) & 0xFF) + 40);
    const b = Math.min(255, (num & 0xFF) + 40);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  darkenColor(hex) {
    const num = parseInt((hex || '#FF6B35').replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - 40);
    const g = Math.max(0, ((num >> 8) & 0xFF) - 40);
    const b = Math.max(0, (num & 0xFF) - 40);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  /**
   * Wraps text into SVG <tspan> lines without exceeding maxWidth chars per line.
   * Returns array of strings (lines).
   */
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
        // If single word is too long, truncate it
        current = word.length > maxCharsPerLine ? word.substring(0, maxCharsPerLine - 3) + '...' : word;
        if (lines.length >= maxLines - 1) break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.length === 0) lines.push('');
    return lines;
  }

  /**
   * Renders wrapped text as SVG tspan elements, returns the SVG snippet and total height used.
   */
  renderWrappedText(lines, x, startY, fontSize, lineHeight, fill, fontFamily, fontWeight = 'normal', anchor = 'start', filter = '') {
    const filterAttr = filter ? `filter="url(#${filter})"` : '';
    const tspans = lines.map((line, i) =>
      `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${this.escapeXml(line)}</tspan>`
    ).join('');
    return `<text x="${x}" y="${startY}"
      font-family="${fontFamily}"
      font-size="${fontSize}"
      font-weight="${fontWeight}"
      fill="${fill}"
      text-anchor="${anchor}"
      ${filterAttr}>${tspans}</text>`;
  }

  buildGradientSvg(width, height, colors) {
    const c1 = this.hexToRgb(colors[0] || '#1A1A3E');
    const c2 = this.hexToRgb(colors[1] || '#2D1B00');
    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(${c1.r},${c1.g},${c1.b});stop-opacity:1"/>
      <stop offset="100%" style="stop-color:rgb(${c2.r},${c2.g},${c2.b});stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
</svg>`);
  }

  // ==========================================================================
  // SQUARE LAYOUT  1080×1080
  // Layout: food image fills right 58%, dark gradient panel on left 45%
  // Restaurant name top-center (above image), Today's Special badge,
  // Dish name (2 lines), description (3 lines), price, CTA button
  // ==========================================================================
  buildSquareLayout(width, height, params) {
    const { headline, name, description, price, cta, restaurantName, accent } = params;

    const panelW = Math.floor(width * 0.44);
    const px = 36; // horizontal padding inside panel
    const innerW = panelW - px * 2; // usable text width

    // Font sizes tuned for 1080 canvas
    const restaurantFontSize = 24;
    const headlineFontSize   = 20;
    const nameFontSize       = 42;
    const descFontSize       = 17;
    const priceFontSize      = 36;
    const ctaFontSize        = 17;
    const lineHeight = nameFontSize * 1.18;
    const descLineH  = descFontSize * 1.5;

    // Wrap texts
    const nameLines = this.wrapText(name.toUpperCase(), Math.floor(innerW / (nameFontSize * 0.62)), 2);
    const descLines = this.wrapText(description, Math.floor(innerW / (descFontSize * 0.56)), 3);

    // Vertical layout positions (from top of panel area)
    let y = 160; // start below top space

    const restNameY     = 80;
    const badgeBox      = { x: px, y: y, w: innerW, h: 38 };      y += 56;
    const nameY         = y + nameLines.length * lineHeight;       y = nameY + (nameLines.length > 1 ? lineHeight : 0) + 20;
    const descY         = y;                                        y += descLines.length * descLineH + 28;
    const priceY        = price ? y + priceFontSize : y;           y = price ? priceY + 22 : y;
    const ctaBoxTop     = height - 130;
    const ctaTextY      = ctaBoxTop + 36;

    const accent2 = this.lightenColor(accent);

    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Deep scrim on the panel side -->
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(8,4,2,0.97)"/>
      <stop offset="85%" stop-color="rgba(12,6,2,0.92)"/>
      <stop offset="100%" stop-color="rgba(20,8,2,0.0)"/>
    </linearGradient>
    <!-- Accent gradient -->
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${accent2}"/>
    </linearGradient>
    <!-- Bottom vignette so food image fades into black at bottom -->
    <linearGradient id="vigBot" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.85)"/>
    </linearGradient>
    <!-- Elegant deep text shadow -->
    <filter id="deepShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.85)"/>
    </filter>
    <!-- Soft glow for headlines -->
    <filter id="glowFilter" x="-15%" y="-15%" width="130%" height="150%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <!-- Brand name glow -->
    <filter id="brandGlow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${accent}" flood-opacity="0.7"/>
    </filter>
    <!-- Strong CTA shadow -->
    <filter id="ctaShadow" x="-5%" y="-5%" width="110%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="rgba(0,0,0,0.6)"/>
    </filter>
  </defs>

  <!-- Full panel scrim (left side) -->
  <rect x="0" y="0" width="${panelW + 60}" height="${height}" fill="url(#panelGrad)"/>

  <!-- Bottom vignette across full width -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#vigBot)"/>

  <!-- Accent left border stripe -->
  <rect x="0" y="0" width="6" height="${height}" fill="url(#accentGrad)" opacity="0.9"/>

  <!-- ── Restaurant Name (top of panel) ── -->
  <text x="${panelW / 2}" y="${restNameY}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${restaurantFontSize}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    filter="url(#brandGlow)">${this.escapeXml(restaurantName.toUpperCase().substring(0, 28))}</text>

  <!-- Thin divider under restaurant name -->
  <line x1="${px}" y1="${restNameY + 12}" x2="${panelW - px}" y2="${restNameY + 12}"
    stroke="${accent}" stroke-width="1.5" opacity="0.5"/>

  <!-- ── TODAY'S SPECIAL badge ── -->
  <rect x="${badgeBox.x}" y="${badgeBox.y}" width="${badgeBox.w}" height="${badgeBox.h}"
    rx="6" fill="${accent}" opacity="0.15"/>
  <rect x="${badgeBox.x}" y="${badgeBox.y}" width="${badgeBox.w}" height="${badgeBox.h}"
    rx="6" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.6"/>
  <text x="${panelW / 2}" y="${badgeBox.y + badgeBox.h / 2 + 7}"
    font-family="'Trebuchet MS', Arial, sans-serif"
    font-size="${headlineFontSize}"
    font-weight="bold"
    fill="${accent}"
    text-anchor="middle"
    filter="url(#glowFilter)">* ${this.escapeXml(headline.substring(0, 22))} *</text>

  <!-- Decorative rule -->
  <line x1="${px}" y1="${badgeBox.y + badgeBox.h + 14}" x2="${panelW - px}" y2="${badgeBox.y + badgeBox.h + 14}"
    stroke="${accent}" stroke-width="1" opacity="0.4"/>

  <!-- ── Dish Name (multi-line) ── -->
  ${this.renderWrappedText(nameLines, px, nameY, nameFontSize, lineHeight, 'white',
    "'Arial Black', Impact, sans-serif", '900', 'start', 'deepShadow')}

  <!-- ── Description (multi-line) ── -->
  ${this.renderWrappedText(descLines, px, descY, descFontSize, descLineH,
    'rgba(240,220,200,0.88)', 'Arial, sans-serif', 'normal', 'start', 'deepShadow')}

  <!-- ── Price ── -->
  ${price ? `
  <text x="${px}" y="${priceY}"
    font-family="'Arial Black', Arial, sans-serif"
    font-size="${priceFontSize}"
    font-weight="900"
    fill="${accent}"
    filter="url(#glowFilter)">${this.escapeXml(price)}</text>
  <text x="${px + priceFontSize * (price.length) * 0.62 + 6}" y="${priceY}"
    font-family="Arial, sans-serif"
    font-size="14"
    fill="rgba(255,255,255,0.55)"
    dominant-baseline="middle">only</text>
  ` : ''}

  <!-- ── CTA Button ── -->
  <rect x="${px}" y="${ctaBoxTop}" width="${panelW - px * 2}" height="52" rx="26"
    fill="url(#accentGrad)" filter="url(#ctaShadow)"/>
  <text x="${panelW / 2}" y="${ctaTextY}"
    font-family="'Trebuchet MS', Arial, sans-serif"
    font-size="${ctaFontSize}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    letter-spacing="1.5">>> ${this.escapeXml(cta.substring(0, 20))}</text>

  <!-- ── Restaurant name watermark footer ── -->
  <text x="${px}" y="${height - 18}"
    font-family="Georgia, serif"
    font-size="13"
    fill="rgba(255,255,255,0.35)">${this.escapeXml(restaurantName.substring(0, 30))}</text>
</svg>`);
  }

  // ==========================================================================
  // STORY LAYOUT  1080×1920
  // Food image fills top 60%, full-width text panel at bottom 40%
  // ==========================================================================
  buildStoryLayout(width, height, params) {
    const { headline, name, description, price, cta, restaurantName, accent } = params;

    const panelY = Math.floor(height * 0.60);
    const panelH = height - panelY;
    const px = 56;
    const innerW = width - px * 2;

    const restaurantFontSize = 34;
    const headlineFontSize   = 28;
    const nameFontSize       = 58;
    const descFontSize       = 24;
    const priceFontSize      = 48;
    const ctaFontSize        = 22;
    const nameLineH = nameFontSize * 1.18;
    const descLineH = descFontSize * 1.5;

    const nameLines = this.wrapText(name.toUpperCase(), Math.floor(innerW / (nameFontSize * 0.60)), 2);
    const descLines = this.wrapText(description, Math.floor(innerW / (descFontSize * 0.54)), 2);

    // Vertical coords inside panel
    let py = panelY + 30;
    const restNameY = 70;
    const badgeY    = py + 20;           const badgeH = 52;   py = badgeY + badgeH + 30;
    const nameY     = py + (nameLines.length > 1 ? nameLineH : nameFontSize); py += nameLines.length * nameLineH + 24;
    const descY     = py + descFontSize; py += descLines.length * descLineH + 28;
    const priceY    = price ? py + priceFontSize : py;
    if (price) py = priceY + 24;
    const ctaBoxTop = height - 160;
    const ctaTextY  = ctaBoxTop + 44;

    const accent2 = this.lightenColor(accent);

    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Panel gradient -->
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(6,3,1,0.96)"/>
      <stop offset="100%" stop-color="rgba(10,5,2,0.99)"/>
    </linearGradient>
    <!-- Top fade so food image blends into panel -->
    <linearGradient id="fadeEdge" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="70%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(6,3,1,0.97)"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${accent2}"/>
    </linearGradient>
    <!-- Top vignette for restaurant name readability -->
    <linearGradient id="topVig" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(0,0,0,0.75)"/>
      <stop offset="30%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
    <filter id="deepShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.9)"/>
    </filter>
    <filter id="glowFilter" x="-15%" y="-15%" width="130%" height="150%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="brandGlow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${accent}" flood-opacity="0.7"/>
    </filter>
    <filter id="ctaShadow" x="-5%" y="-5%" width="110%" height="130%">
      <feDropShadow dx="0" dy="5" stdDeviation="12" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>

  <!-- Top vignette over food image for restaurant name -->
  <rect x="0" y="0" width="${width}" height="${Math.floor(height * 0.28)}" fill="url(#topVig)"/>

  <!-- Fade from image into panel -->
  <rect x="0" y="${Math.floor(height * 0.44)}" width="${width}" height="${Math.floor(height * 0.20)}" fill="url(#fadeEdge)"/>

  <!-- Dark panel -->
  <rect x="0" y="${panelY}" width="${width}" height="${panelH}" fill="url(#panelGrad)"/>

  <!-- Accent stripe at panel top -->
  <rect x="0" y="${panelY}" width="${width}" height="5" fill="url(#accentGrad)"/>

  <!-- ── Restaurant Name (top of image, reverse side) ── -->
  <text x="${width / 2}" y="${restNameY}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${restaurantFontSize}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    filter="url(#brandGlow)">${this.escapeXml(restaurantName.toUpperCase().substring(0, 30))}</text>

  <!-- ── Today's Special Badge ── -->
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="8" fill="${accent}" opacity="0.14"/>
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="8" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.55"/>
  <text x="${width / 2}" y="${badgeY + badgeH / 2 + 9}"
    font-family="'Trebuchet MS', Arial, sans-serif"
    font-size="${headlineFontSize}"
    font-weight="bold"
    fill="${accent}"
    text-anchor="middle"
    filter="url(#glowFilter)">* ${this.escapeXml(headline.substring(0, 25))} *</text>

  <!-- Decorative rule -->
  <line x1="${px}" y1="${badgeY + badgeH + 16}" x2="${width - px}" y2="${badgeY + badgeH + 16}"
    stroke="${accent}" stroke-width="1.2" opacity="0.4"/>

  <!-- ── Dish Name ── -->
  ${this.renderWrappedText(nameLines, px, nameY, nameFontSize, nameLineH, 'white',
    "'Arial Black', Impact, sans-serif", '900', 'start', 'deepShadow')}

  <!-- ── Description ── -->
  ${this.renderWrappedText(descLines, px, descY, descFontSize, descLineH,
    'rgba(240,220,200,0.85)', 'Arial, sans-serif', 'normal', 'start', 'deepShadow')}

  <!-- ── Price ── -->
  ${price ? `
  <text x="${px}" y="${priceY}"
    font-family="'Arial Black', Arial, sans-serif"
    font-size="${priceFontSize}"
    font-weight="900"
    fill="${accent}"
    filter="url(#glowFilter)">${this.escapeXml(price)}</text>
  ` : ''}

  <!-- ── CTA Button ── -->
  <rect x="${px}" y="${ctaBoxTop}" width="${innerW}" height="70" rx="35"
    fill="url(#accentGrad)" filter="url(#ctaShadow)"/>
  <text x="${width / 2}" y="${ctaTextY}"
    font-family="'Trebuchet MS', Arial, sans-serif"
    font-size="${ctaFontSize}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    letter-spacing="2">>> ${this.escapeXml(cta.substring(0, 22))}</text>

  <!-- ── Footer watermark ── -->
  <text x="${px}" y="${height - 22}"
    font-family="Georgia, serif"
    font-size="16"
    fill="rgba(255,255,255,0.3)">${this.escapeXml(restaurantName.substring(0, 32))}</text>
</svg>`);
  }

  // ==========================================================================
  // LANDSCAPE LAYOUT  1200×630
  // Food image right 58%, text panel left 44%
  // ==========================================================================
  buildLandscapeLayout(width, height, params) {
    const { headline, name, description, price, cta, restaurantName, accent } = params;

    const panelW = Math.floor(width * 0.44);
    const px = 32;
    const innerW = panelW - px * 2;

    const restaurantFontSize = 19;
    const headlineFontSize   = 17;
    const nameFontSize       = 34;
    const descFontSize       = 14;
    const priceFontSize      = 30;
    const ctaFontSize        = 15;
    const nameLineH = nameFontSize * 1.18;
    const descLineH = descFontSize * 1.55;

    const nameLines = this.wrapText(name.toUpperCase(), Math.floor(innerW / (nameFontSize * 0.61)), 2);
    const descLines = this.wrapText(description, Math.floor(innerW / (descFontSize * 0.56)), 3);

    let y = 80;
    const restNameY = 50;
    const badgeY    = y; const badgeH = 36;  y += badgeH + 22;
    const nameY     = y + nameFontSize;       y += nameLines.length * nameLineH + 16;
    const descY     = y + descFontSize;       y += descLines.length * descLineH + 18;
    const priceY    = price ? y + priceFontSize : y;
    if (price) y = priceY + 18;
    const ctaBoxTop = height - 100;
    const ctaTextY  = ctaBoxTop + 30;

    const accent2 = this.lightenColor(accent);

    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(6,3,1,0.98)"/>
      <stop offset="82%" stop-color="rgba(10,5,2,0.93)"/>
      <stop offset="100%" stop-color="rgba(20,8,2,0.0)"/>
    </linearGradient>
    <linearGradient id="vigBot" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="55%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.8)"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${accent2}"/>
    </linearGradient>
    <filter id="deepShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="rgba(0,0,0,0.88)"/>
    </filter>
    <filter id="glowFilter" x="-15%" y="-15%" width="130%" height="150%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="brandGlow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="${accent}" flood-opacity="0.7"/>
    </filter>
    <filter id="ctaShadow" x="-5%" y="-5%" width="110%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="9" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>

  <!-- Left panel scrim -->
  <rect x="0" y="0" width="${panelW + 55}" height="${height}" fill="url(#panelGrad)"/>

  <!-- Bottom vignette on food side -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#vigBot)"/>

  <!-- Accent left stripe -->
  <rect x="0" y="0" width="5" height="${height}" fill="url(#accentGrad)"/>

  <!-- ── Restaurant Name ── -->
  <text x="${panelW / 2}" y="${restNameY}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${restaurantFontSize}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    filter="url(#brandGlow)">${this.escapeXml(restaurantName.toUpperCase().substring(0, 30))}</text>

  <!-- Thin divider -->
  <line x1="${px}" y1="${restNameY + 9}" x2="${panelW - px}" y2="${restNameY + 9}"
    stroke="${accent}" stroke-width="1" opacity="0.45"/>

  <!-- ── Today's Special Badge ── -->
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="5" fill="${accent}" opacity="0.13"/>
  <rect x="${px}" y="${badgeY}" width="${innerW}" height="${badgeH}"
    rx="5" fill="none" stroke="${accent}" stroke-width="1" opacity="0.5"/>
  <text x="${panelW / 2}" y="${badgeY + badgeH / 2 + 6}"
    font-family="'Trebuchet MS', Arial, sans-serif"
    font-size="${headlineFontSize}"
    font-weight="bold"
    fill="${accent}"
    text-anchor="middle"
    filter="url(#glowFilter)">* ${this.escapeXml(headline.substring(0, 22))} *</text>

  <!-- Decorative rule -->
  <line x1="${px}" y1="${badgeY + badgeH + 12}" x2="${panelW - px}" y2="${badgeY + badgeH + 12}"
    stroke="${accent}" stroke-width="1" opacity="0.4"/>

  <!-- ── Dish Name ── -->
  ${this.renderWrappedText(nameLines, px, nameY, nameFontSize, nameLineH, 'white',
    "'Arial Black', Impact, sans-serif", '900', 'start', 'deepShadow')}

  <!-- ── Description ── -->
  ${this.renderWrappedText(descLines, px, descY, descFontSize, descLineH,
    'rgba(240,220,200,0.86)', 'Arial, sans-serif', 'normal', 'start', 'deepShadow')}

  <!-- ── Price ── -->
  ${price ? `
  <text x="${px}" y="${priceY}"
    font-family="'Arial Black', Arial, sans-serif"
    font-size="${priceFontSize}"
    font-weight="900"
    fill="${accent}"
    filter="url(#glowFilter)">${this.escapeXml(price)}</text>
  ` : ''}

  <!-- ── CTA Button ── -->
  <rect x="${px}" y="${ctaBoxTop}" width="${innerW}" height="46" rx="23"
    fill="url(#accentGrad)" filter="url(#ctaShadow)"/>
  <text x="${panelW / 2}" y="${ctaTextY}"
    font-family="'Trebuchet MS', Arial, sans-serif"
    font-size="${ctaFontSize}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    letter-spacing="1.5">>> ${this.escapeXml(cta.substring(0, 20))}</text>

  <!-- ── Footer watermark ── -->
  <text x="${px}" y="${height - 14}"
    font-family="Georgia, serif"
    font-size="11"
    fill="rgba(255,255,255,0.3)">${this.escapeXml(restaurantName.substring(0, 32))}</text>
</svg>`);
  }

  // ==========================================================================
  // Top heading overlay – "Today's Special" ribbon at top of food image area
  // Used for square and landscape formats only
  // ==========================================================================
  buildTopHeadingOverlay(width, height, headline, accent) {
    // This renders a semi-transparent top ribbon on the food-photo side
    // For square: food is on the LEFT (0 .. width*0.58), ribbon spans full width
    // We place it at the very top, centered, so it floats over the food image
    const ribbonH = 54;
    const accent2 = this.lightenColor(accent);
    const fontSize = Math.max(18, Math.round(width * 0.028));

    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.0"/>
      <stop offset="28%" stop-color="${accent}" stop-opacity="0.88"/>
      <stop offset="72%" stop-color="${accent2}" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="${accent2}" stop-opacity="0.0"/>
    </linearGradient>
    <filter id="ribbonShadow">
      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  <!-- Ribbon bar -->
  <rect x="0" y="0" width="${width}" height="${ribbonH}" fill="url(#ribbonGrad)"/>
  <!-- Headline text on ribbon -->
  <text x="${width / 2}" y="${ribbonH / 2 + fontSize * 0.36}"
    font-family="'Trebuchet MS', Georgia, serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    letter-spacing="2"
    filter="url(#ribbonShadow)">*  ${this.escapeXml(headline.substring(0, 28))}  *</text>
</svg>`);
  }

  buildOverlaySvg(width, height, dish, caption, format, style, campaignType = 'daily') {
    const name        = dish.name || 'Special Dish';
    const price       = dish.price ? `₹${Math.round(dish.price)}` : '';
    const headline    = caption?.headline?.replace(/^[^\w]*/, '') || "Today's Special";
    const cta         = caption?.cta || 'Order Now!';
    const restaurantName = dish.restaurant_name || 'Our Restaurant';
    const description = caption?.caption || dish.description || '';
    const accent      = this.sanitizeHex(style?.accent || '#FF6B35', '#FF6B35');

    const params = { headline, name, description, price, cta, restaurantName, accent };

    if (format === 'story')     return this.buildStoryLayout(width, height, params);
    if (format === 'landscape') return this.buildLandscapeLayout(width, height, params);
    return this.buildSquareLayout(width, height, params);
  }

  async buildCreative(options) {
    const { dish, format, imageBuffer, colors, caption, campaignType } = options;
    const { width, height } = this.getDimensions(format);
    const style = {
      accent:    colors?.[0] || '#FF6B35',
      secondary: colors?.[1] || '#2E4057'
    };

    const headline = caption?.headline?.replace(/^[^\w]*/, '') || "Today's Special";
    const accent   = style.accent;

    try {
      // Build warm dark base canvas
      const gradSvg = this.buildGradientSvg(width, height, ['#120800', '#2D1200']);
      let base = await sharp(gradSvg).resize(width, height).png().toBuffer();

      const composites = [];

      // ── Place food image ──
      if (imageBuffer && imageBuffer.length > 1000) {
        let imgW, imgH, imgTop, imgLeft;

        if (format === 'story') {
          imgW    = width;
          imgH    = Math.floor(height * 0.60);
          imgTop  = 0;
          imgLeft = 0;
        } else if (format === 'landscape') {
          imgW    = Math.floor(width * 0.60);
          imgH    = height;
          imgTop  = 0;
          imgLeft = Math.floor(width * 0.40);
        } else {
          // square
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

      // ── Top heading ribbon over food image ──
      const headingOverlay = this.buildTopHeadingOverlay(width, height, headline, accent);
      composites.push({ input: headingOverlay, top: 0, left: 0 });

      // ── Text + panel overlay ──
      const overlaySvg = this.buildOverlaySvg(width, height, dish, caption, format, style, campaignType);
      composites.push({ input: overlaySvg, top: 0, left: 0 });

      const finalBuffer = await sharp(base)
        .composite(composites)
        .png()
        .toBuffer();

      return { success: true, buffer: finalBuffer, dimensions: `${width}x${height}` };

    } catch (error) {
      console.error('Creative build error:', error.message);
      try {
        const gradSvg    = this.buildGradientSvg(width, height, ['#120800', '#2D1200']);
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
    if (exportType === 'jpg') {
      return sharp(buffer).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    }
    if (exportType === 'webp') {
      return sharp(buffer).webp({ quality: 92 }).toBuffer();
    }
    return sharp(buffer).png().toBuffer();
  }

  getMimeType(exportType = 'png') {
    if (exportType === 'jpg')  return 'image/jpeg';
    if (exportType === 'webp') return 'image/webp';
    return 'image/png';
  }
}

module.exports = new CreativeBuilderService();
