const sharp = require('sharp');

class CreativeBuilderService {
  getDimensions(format) {
    const dimensions = {
      'instagram_square': { width: 1080, height: 1080 },
      'instagram_story':  { width: 1080, height: 1920 },
      'facebook_post':    { width: 1200, height: 630  },
      'whatsapp_post':    { width: 1080, height: 1080 }
    };
    return dimensions[format] || dimensions['instagram_square'];
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 255, g: 107, b: 107 };
  }

  escapeXml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  wrapText(text, maxCharsPerLine) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length <= maxCharsPerLine) {
        current = (current + ' ' + word).trim();
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3); // max 3 lines
  }

  sanitizeHex(hex, fallback = '#FF6B35') {
    return /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : fallback;
  }

  getInitials(name) {
    return String(name || 'R')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('') || 'R';
  }

  getThemeStyle(theme = 'casual', colors = []) {
    const palettes = {
      luxury: ['#111111', '#C8A24A'],
      casual: ['#FF6B35', '#2E4057'],
      fast_food: ['#E63946', '#FFBE0B'],
      indian_ethnic: ['#B91C1C', '#0F766E']
    };
    const fallback = palettes[theme] || palettes.casual;
    const accent = this.sanitizeHex(colors[0] || fallback[0], fallback[0]);
    const secondary = this.sanitizeHex(colors[1] || fallback[1], fallback[1]);
    return {
      accent,
      secondary,
      colors: [accent, secondary],
      fontFamily: theme === 'luxury'
        ? 'Georgia, Times New Roman, serif'
        : 'Arial, sans-serif',
      headlineFamily: theme === 'luxury'
        ? 'Georgia, Times New Roman, serif'
        : "'Arial Black', Arial, sans-serif"
    };
  }

  // Gradient background SVG
  buildGradientSvg(width, height, colors) {
    const c1 = this.hexToRgb(colors[0] || '#FF6B35');
    const c2 = this.hexToRgb(colors[1] || '#2E4057');
    return Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   style="stop-color:rgb(${c1.r},${c1.g},${c1.b});stop-opacity:1"/>
      <stop offset="100%" style="stop-color:rgb(${c2.r},${c2.g},${c2.b});stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad)"/>
</svg>`);
  }

  // Full overlay SVG with text, badges, CTA — laid over the composited image
  buildOverlaySvg(width, height, dish, caption, format, style) {
    const isStory = format === 'instagram_story';
    const isFacebook = format === 'facebook_post';

    const name = this.escapeXml(dish.name || 'Special Dish');
    const price = dish.price ? `\u20B9${Math.round(dish.price)}` : '';
    const headline = this.escapeXml(caption?.headline?.replace(/^[^\w]*/, '') || dish.name || '');
    const cta = this.escapeXml(caption?.cta || 'Order Now!');
    const rawRestaurantName = dish.restaurant_name || 'Our Restaurant';
    const restaurantName = this.escapeXml(rawRestaurantName);
    const logoInitials = this.escapeXml(this.getInitials(rawRestaurantName));
    const isBestseller = dish.is_bestseller || false;
    const accent = style?.accent || '#FF6B35';
    const accentRgb = this.hexToRgb(accent);
    const fontFamily = style?.fontFamily || 'Arial, sans-serif';
    const headlineFamily = style?.headlineFamily || "'Arial Black', Arial, sans-serif";

    // --- Instagram Square (1080x1080) ---
    if (!isStory && !isFacebook) {
      const nameLines = this.wrapText(name, 22);
      const nameY = 780;
      const lineH = 70;
      const nameSvg = nameLines.map((line, i) =>
        `<text x="540" y="${nameY + i * lineH}" font-family="${headlineFamily}" font-size="62" font-weight="900" fill="white" text-anchor="middle" filter="url(#shadow)">${this.escapeXml(line)}</text>`
      ).join('\n');

      return Buffer.from(`
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.8)"/>
    </filter>
    <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="50%" stop-color="rgba(0,0,0,0.6)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.92)"/>
    </linearGradient>
  </defs>

  <!-- Bottom overlay -->
  <rect x="0" y="580" width="1080" height="500" fill="url(#overlay)"/>

  <!-- Top bar: restaurant name -->
  <rect x="0" y="0" width="1080" height="80" fill="rgba(0,0,0,0.45)"/>
  <rect x="32" y="14" width="52" height="52" rx="8" fill="${accent}"/>
  <text x="58" y="48" font-family="${headlineFamily}" font-size="22" fill="white" font-weight="900" text-anchor="middle">${logoInitials}</text>
  <text x="104" y="52" font-family="${fontFamily}" font-size="28" fill="rgba(255,255,255,0.9)" font-weight="bold">${restaurantName}</text>

  ${isBestseller ? `
  <!-- BESTSELLER badge -->
  <rect x="830" y="12" width="230" height="56" rx="28" fill="${accent}"/>
  <text x="945" y="47" font-family="${fontFamily}" font-size="24" font-weight="bold" fill="white" text-anchor="middle">★ BESTSELLER</text>
  ` : ''}

  ${price ? `
  <!-- Price badge -->
  <rect x="30" y="680" width="180" height="64" rx="32" fill="${accent}"/>
  <text x="120" y="722" font-family="${headlineFamily}" font-size="34" font-weight="900" fill="white" text-anchor="middle">${this.escapeXml(price)}</text>
  ` : ''}

  <!-- Dish name lines -->
  ${nameSvg}

  <!-- CTA bar -->
  <rect x="0" y="1000" width="1080" height="80" fill="rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.92)"/>
  <text x="540" y="1050" font-family="${fontFamily}" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${cta}</text>
</svg>`);
    }

    // --- Instagram Story (1080x1920) ---
    if (isStory) {
      const nameLines = this.wrapText(name, 20);
      const nameBaseY = 1300;
      const lineH = 80;
      const nameSvg = nameLines.map((line, i) =>
        `<text x="540" y="${nameBaseY + i * lineH}" font-family="${headlineFamily}" font-size="70" font-weight="900" fill="white" text-anchor="middle" filter="url(#shadow)">${this.escapeXml(line)}</text>`
      ).join('\n');
      const headlineLines = this.wrapText(headline, 24);
      const headlineSvg = headlineLines.map((line, i) =>
        `<text x="540" y="${1170 + i * 56}" font-family="${fontFamily}" font-size="44" fill="rgba(255,255,255,0.85)" text-anchor="middle">${this.escapeXml(line)}</text>`
      ).join('\n');

      return Buffer.from(`
<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="2" dy="2" stdDeviation="5" flood-color="rgba(0,0,0,0.9)"/>
    </filter>
    <linearGradient id="overlay" x1="0" y1="0.5" x2="0" y2="1">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="40%" stop-color="rgba(0,0,0,0.55)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.95)"/>
    </linearGradient>
  </defs>

  <rect x="0" y="900" width="1080" height="1020" fill="url(#overlay)"/>

  <!-- Top bar -->
  <rect x="0" y="0" width="1080" height="100" fill="rgba(0,0,0,0.5)"/>
  <rect x="54" y="20" width="62" height="62" rx="8" fill="${accent}"/>
  <text x="85" y="61" font-family="${headlineFamily}" font-size="25" fill="white" font-weight="900" text-anchor="middle">${logoInitials}</text>
  <text x="138" y="65" font-family="${fontFamily}" font-size="36" fill="white" font-weight="bold">${restaurantName}</text>

  ${isBestseller ? `
  <rect x="730" y="18" width="310" height="68" rx="34" fill="${accent}"/>
  <text x="885" y="62" font-family="${fontFamily}" font-size="30" font-weight="bold" fill="white" text-anchor="middle">★ BESTSELLER</text>
  ` : ''}

  ${headlineSvg}
  ${nameSvg}

  ${price ? `
  <rect x="54" y="1490" width="220" height="80" rx="40" fill="${accent}"/>
  <text x="164" y="1542" font-family="${headlineFamily}" font-size="40" font-weight="900" fill="white" text-anchor="middle">${this.escapeXml(price)}</text>
  ` : ''}

  <!-- CTA -->
  <rect x="0" y="1820" width="1080" height="100" fill="rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.95)"/>
  <text x="540" y="1880" font-family="${fontFamily}" font-size="42" font-weight="bold" fill="white" text-anchor="middle">${cta}</text>
</svg>`);
    }

    // --- Facebook Post (1200x630) ---
    const nameLines = this.wrapText(name, 18);
    const nameBaseY = 340;
    const lineH = 64;
    const nameSvg = nameLines.map((line, i) =>
      `<text x="640" y="${nameBaseY + i * lineH}" font-family="${headlineFamily}" font-size="56" font-weight="900" fill="white" text-anchor="middle" filter="url(#shadow)">${this.escapeXml(line)}</text>`
    ).join('\n');

    return Buffer.from(`
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="1" dy="1" stdDeviation="4" flood-color="rgba(0,0,0,0.85)"/>
    </filter>
    <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="45%" stop-color="rgba(0,0,0,0.5)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.9)"/>
    </linearGradient>
  </defs>

  <rect x="0" y="200" width="1200" height="430" fill="url(#overlay)"/>

  <!-- Top bar -->
  <rect x="0" y="0" width="1200" height="70" fill="rgba(0,0,0,0.5)"/>
  <rect x="30" y="10" width="50" height="50" rx="8" fill="${accent}"/>
  <text x="55" y="43" font-family="${headlineFamily}" font-size="20" fill="white" font-weight="900" text-anchor="middle">${logoInitials}</text>
  <text x="98" y="47" font-family="${fontFamily}" font-size="28" fill="white" font-weight="bold">${restaurantName}</text>

  ${isBestseller ? `
  <rect x="910" y="10" width="260" height="50" rx="25" fill="${accent}"/>
  <text x="1040" y="43" font-family="${fontFamily}" font-size="22" font-weight="bold" fill="white" text-anchor="middle">★ BESTSELLER</text>
  ` : ''}

  ${nameSvg}

  ${price ? `
  <rect x="30" y="${nameBaseY + nameLines.length * lineH + 10}" width="180" height="58" rx="29" fill="${accent}"/>
  <text x="120" y="${nameBaseY + nameLines.length * lineH + 50}" font-family="${headlineFamily}" font-size="30" font-weight="900" fill="white" text-anchor="middle">${this.escapeXml(price)}</text>
  ` : ''}

  <!-- CTA bottom -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.92)"/>
  <text x="600" y="610" font-family="${fontFamily}" font-size="26" font-weight="bold" fill="white" text-anchor="middle">${cta}</text>
</svg>`);
  }

  async buildCreative(options) {
    const { dish, format, imageBuffer, colors, caption } = options;
    const { width, height } = this.getDimensions(format);
    const style = this.getThemeStyle(dish.restaurant_theme, colors || ['#FF6B35', '#2E4057']);

    try {
      // 1. Gradient background
      const gradSvg = this.buildGradientSvg(width, height, style.colors);
      let base = await sharp(gradSvg).resize(width, height).png().toBuffer();

      // 2. Composite food image (upper portion)
      const composites = [];
      if (imageBuffer && imageBuffer.length > 1000) {
        const imgH = format === 'facebook_post'
          ? Math.floor(height * 0.75)
          : Math.floor(height * 0.62);
        const imgW = format === 'facebook_post'
          ? Math.floor(width * 0.55)
          : width;

        const resized = await sharp(imageBuffer)
          .resize(imgW, imgH, { fit: 'cover', position: 'centre' })
          .png()
          .toBuffer();

        const left = format === 'facebook_post' ? Math.floor((width - imgW) / 2) : 0;
        composites.push({ input: resized, top: 0, left });
      }

      // 3. Overlay SVG (text, badges, CTA)
      const overlaySvg = this.buildOverlaySvg(width, height, dish, caption, format, style);
      composites.push({ input: overlaySvg, top: 0, left: 0 });

      const finalBuffer = await sharp(base)
        .composite(composites)
        .png()
        .toBuffer();

      return { success: true, buffer: finalBuffer, dimensions: `${width}x${height}` };
    } catch (error) {
      console.error('Creative build error:', error.message);
      // Return gradient-only fallback
      try {
        const gradSvg = this.buildGradientSvg(width, height, style.colors);
        const overlaySvg = this.buildOverlaySvg(width, height, dish, caption, format, style);
        const fallback = await sharp(gradSvg)
          .composite([{ input: overlaySvg, top: 0, left: 0 }])
          .png()
          .toBuffer();
        return { success: true, buffer: fallback, dimensions: `${width}x${height}` };
      } catch (e2) {
        return { success: false, error: e2.message };
      }
    }
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
    if (exportType === 'jpg') return 'image/jpeg';
    if (exportType === 'webp') return 'image/webp';
    return 'image/png';
  }
}

module.exports = new CreativeBuilderService();
