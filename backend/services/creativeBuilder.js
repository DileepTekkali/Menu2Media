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

  getFoodEmoji(dishName) {
    const text = (dishName || '').toLowerCase();
    
    if (/pizza/i.test(text)) return '🍕';
    if (/burger/i.test(text)) return '🍔';
    if (/pasta|noodle|spaghetti|alfredo/i.test(text)) return '🍝';
    if (/chicken|tandoor|tikka|seekh|kebab|malai|murgh/i.test(text)) return '🍗';
    if (/biryani|rice| pulao/i.test(text)) return '🍚';
    if (/curry|butter chicken|murgh/i.test(text)) return '🍛';
    if (/salad|greens/i.test(text)) return '🥗';
    if (/sandwich|sub|wrap|roll/i.test(text)) return '🥪';
    if (/soup/i.test(text)) return '🍲';
    if (/coffee|espresso/i.test(text)) return '☕';
    if (/tea|chai|maska/i.test(text)) return '🍵';
    if (/dessert|sweet|mithai/i.test(text)) return '🍰';
    if (/cake/i.test(text)) return '🎂';
    if (/bread|naan|roti|paratha/i.test(text)) return '🥖';
    if (/fish|salmon/i.test(text)) return '🐟';
    if (/steak|beef|meat/i.test(text)) return '🥩';
    if (/shrimp|prawn/i.test(text)) return '🦐';
    if (/samosa|vada|pau|bhel/i.test(text)) return '🥟';
    if (/dal|daal|black daal/i.test(text)) return '🫘';
    if (/paneer|i poster/i.test(text)) return '🧈';
    if (/ice cream|kulfi/i.test(text)) return '🍨';
    if (/juice|smoothie/i.test(text)) return '🥤';
    if (/drink|beverage/i.test(text)) return '🍹';
    
    return '🍽️';
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
  buildOverlaySvg(width, height, dish, caption, format, style, campaignType = 'daily') {
    const isStory = format === 'instagram_story';
    const isFacebook = format === 'facebook_post';

    const name = this.escapeXml(dish.name || 'Special Dish');
    const price = dish.price ? `₹${Math.round(dish.price)} Only` : '';
    const headline = this.escapeXml(caption?.headline?.replace(/^[^\w]*/, '') || 'Today\'s Special');
    const cta = this.escapeXml(caption?.cta || 'Order Now');
    const rawRestaurantName = dish.restaurant_name || 'Our Restaurant';
    const restaurantName = this.escapeXml(rawRestaurantName);
    const logoInitials = this.escapeXml(this.getInitials(rawRestaurantName));
    const isBestseller = dish.is_bestseller || false;
    const description = this.escapeXml(caption?.caption || dish.description || 'Delicious & Fresh');
    
    const contextThemes = {
      daily: { accent: '#E85D04', badge: 'Daily Special', gradient: ['#FF6B35', '#FF8C42'] },
      new_arrival: { accent: '#9D4EDD', badge: 'New Arrival', gradient: ['#8B5CF6', '#A78BFA'] },
      combo: { accent: '#FFB703', badge: 'Combo Deal', gradient: ['#F59E0B', '#FBBF24'] },
      festive: { accent: '#DC2626', badge: 'Festive Special', gradient: ['#DC2626', '#EF4444'] },
      weekend: { accent: '#059669', badge: 'Weekend Special', gradient: ['#059669', '#10B981'] }
    };
    
    const theme = contextThemes[campaignType] || contextThemes.daily;
    const accent = theme.accent;
    const accentRgb = this.hexToRgb(accent);
    const fontFamily = style?.fontFamily || 'Arial, sans-serif';
    const headlineFamily = style?.headlineFamily || "'Arial Black', Arial, sans-serif";
    const foodEmoji = this.getFoodEmoji(dish.name || '');

    // --- Instagram Square (1080x1080) - New Structure ---
    if (!isStory && !isFacebook) {
      // Image occupies top 60% of canvas (will be composited below)
      const imageAreaHeight = 650;
      const overlayStartY = imageAreaHeight - 20;
      
      // Price badge positioning (overlapping image bottom)
      const badgeWidth = price ? 200 : 0;
      const badgeX = (1080 - badgeWidth) / 2;
      const badgeY = imageAreaHeight - 60;
      
      // Description area starts below image
      const descY = imageAreaHeight + 80;
      
      // CTA section at bottom
      const ctaY = 980;
      const logoX = 880;

      return Buffer.from(`
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="2" dy="2" stdDeviation="5" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.gradient[0]};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${theme.gradient[1]};stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="fadeGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${theme.gradient[0]};stop-opacity:0"/>
      <stop offset="100%" stop-color="${theme.gradient[0]};stop-opacity:1"/>
    </linearGradient>
  </defs>

  <!-- Gradient Background -->
  <rect width="1080" height="1080" fill="url(#bgGrad)"/>
  
  <!-- Decorative elements -->
  <circle cx="-100" cy="200" r="250" fill="rgba(255,255,255,0.08)"/>
  <circle cx="1180" cy="600" r="300" fill="rgba(255,255,255,0.06)"/>
  <circle cx="100" cy="1000" r="150" fill="rgba(255,255,255,0.05)"/>

  <!-- TOP: Tagline -->
  <text x="540" y="60" font-family="${fontFamily}" font-size="28" font-weight="bold" fill="rgba(255,255,255,0.95)" text-anchor="middle" letter-spacing="3">🔥 ${headline.toUpperCase()}</text>
  
  <!-- Decorative line under tagline -->
  <rect x="340" y="75" width="400" height="3" rx="1.5" fill="rgba(255,255,255,0.5)"/>

  <!-- Food emoji + Dish name (above image) -->
  <text x="540" y="${imageAreaHeight - 100}" font-family="Arial" font-size="80" text-anchor="middle">${foodEmoji}</text>
  <text x="540" y="${imageAreaHeight - 30}" font-family="${headlineFamily}" font-size="52" font-weight="900" fill="white" text-anchor="middle" filter="url(#shadow)">${name.toUpperCase()}</text>

  <!-- Price Badge (overlapping image bottom) -->
  ${price ? `
  <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="55" rx="27" fill="white" filter="url(#shadow)"/>
  <text x="540" y="${badgeY + 38}" font-family="${headlineFamily}" font-size="32" font-weight="900" fill="${accent}" text-anchor="middle">${price}</text>
  ` : ''}

  <!-- Fade gradient to overlay area -->
  <rect x="0" y="${overlayStartY}" width="1080" height="100" fill="url(#fadeGrad)"/>
  
  <!-- Description text -->
  <text x="540" y="${descY}" font-family="${fontFamily}" font-size="28" fill="rgba(255,255,255,0.9)" text-anchor="middle">${this.truncateText(description, 50)}</text>
  
  <!-- Decorative dots -->
  <circle cx="440" cy="${descY + 20}" r="4" fill="rgba(255,255,255,0.4)"/>
  <circle cx="540" cy="${descY + 20}" r="4" fill="rgba(255,255,255,0.4)"/>
  <circle cx="640" cy="${descY + 20}" r="4" fill="rgba(255,255,255,0.4)"/>

  <!-- Bottom section: CTA + Logo -->
  <rect x="0" y="${ctaY}" width="1080" height="100" fill="rgba(0,0,0,0.4)"/>
  <rect x="0" y="${ctaY}" width="1080" height="6" fill="${accent}"/>
  
  <!-- CTA Button -->
  <rect x="60" y="${ctaY + 18}" width="240" height="64" rx="32" fill="${accent}"/>
  <text x="180" y="${ctaY + 58}" font-family="${headlineFamily}" font-size="26" font-weight="900" fill="white" text-anchor="middle">${cta}</text>
  
  <!-- Logo / Branding -->
  <rect x="${logoX}" y="${ctaY + 15}" width="70" height="70" rx="12" fill="rgba(255,255,255,0.2)"/>
  <text x="${logoX + 35}" y="${ctaY + 58}" font-family="${headlineFamily}" font-size="24" fill="white" font-weight="900" text-anchor="middle">${logoInitials}</text>
  <text x="${logoX - 10}" y="${ctaY + 55}" font-family="${fontFamily}" font-size="16" fill="rgba(255,255,255,0.8)" text-anchor="end">${restaurantName}</text>
</svg>`);
    }

    // --- Instagram Story (1080x1920) ---
    if (isStory) {
      const imageAreaHeight = 1100;
      const descY = imageAreaHeight + 100;
      const ctaY = 1750;
      
      return Buffer.from(`
<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="2" dy="2" stdDeviation="5" flood-color="rgba(0,0,0,0.9)"/>
    </filter>
    <linearGradient id="overlay" x1="0" y1="0.5" x2="0" y2="1">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="40%" stop-color="rgba(0,0,0,0.6)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.95)"/>
    </linearGradient>
  </defs>

  <!-- Top tagline -->
  <rect x="0" y="0" width="1080" height="120" fill="rgba(0,0,0,0.5)"/>
  <text x="540" y="80" font-family="${fontFamily}" font-size="36" font-weight="bold" fill="white" text-anchor="middle">🔥 ${headline.toUpperCase()}</text>

  <!-- Image overlay fade -->
  <rect x="0" y="${imageAreaHeight - 150}" width="1080" height="150" fill="url(#overlay)"/>

  <!-- Food emoji + name above image -->
  <text x="540" y="${imageAreaHeight - 200}" font-family="Arial" font-size="120" text-anchor="middle">${foodEmoji}</text>
  <text x="540" y="${imageAreaHeight - 90}" font-family="${headlineFamily}" font-size="72" font-weight="900" fill="white" text-anchor="middle" filter="url(#shadow)">${name}</text>

  <!-- Price badge -->
  ${price ? `
  <rect x="340" y="${imageAreaHeight - 40}" width="400" height="70" rx="35" fill="white" filter="url(#shadow)"/>
  <text x="540" y="${imageAreaHeight + 12}" font-family="${headlineFamily}" font-size="44" font-weight="900" fill="${accent}" text-anchor="middle">${price}</text>
  ` : ''}

  <!-- Description -->
  <text x="540" y="${descY}" font-family="${fontFamily}" font-size="36" fill="rgba(255,255,255,0.9)" text-anchor="middle">${this.truncateText(description, 60)}</text>

  <!-- Bottom CTA -->
  <rect x="60" y="${ctaY}" width="960" height="90" rx="45" fill="${accent}"/>
  <text x="540" y="${ctaY + 60}" font-family="${headlineFamily}" font-size="40" font-weight="900" fill="white" text-anchor="middle">${cta}</text>

  <!-- Logo -->
  <rect x="890" y="30" width="80" height="80" rx="16" fill="${accent}"/>
  <text x="930" y="82" font-family="${headlineFamily}" font-size="28" fill="white" font-weight="900" text-anchor="middle">${logoInitials}</text>
</svg>`);
    }

    // --- Facebook Post (1200x630) ---
    const imageAreaHeight = 400;
    const descY = imageAreaHeight + 80;
    const ctaY = 520;
    
    return Buffer.from(`
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="1" dy="1" stdDeviation="4" flood-color="rgba(0,0,0,0.85)"/>
    </filter>
    <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="60%" stop-color="rgba(0,0,0,0.7)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.9)"/>
    </linearGradient>
  </defs>

  <!-- Top tagline -->
  <text x="600" y="55" font-family="${fontFamily}" font-size="32" font-weight="bold" fill="white" text-anchor="middle">🔥 ${headline.toUpperCase()}</text>

  <!-- Image overlay fade -->
  <rect x="0" y="${imageAreaHeight - 120}" width="1200" height="120" fill="url(#overlay)"/>

  <!-- Food emoji + name -->
  <text x="600" y="${imageAreaHeight - 160}" font-family="Arial" font-size="90" text-anchor="middle">${foodEmoji}</text>
  <text x="600" y="${imageAreaHeight - 60}" font-family="${headlineFamily}" font-size="64" font-weight="900" fill="white" text-anchor="middle" filter="url(#shadow)">${name}</text>

  <!-- Price badge -->
  ${price ? `
  <rect x="480" y="${imageAreaHeight - 35}" width="240" height="60" rx="30" fill="white" filter="url(#shadow)"/>
  <text x="600" y="${imageAreaHeight + 10}" font-family="${headlineFamily}" font-size="36" font-weight="900" fill="${accent}" text-anchor="middle">${price}</text>
  ` : ''}

  <!-- Description -->
  <text x="600" y="${descY}" font-family="${fontFamily}" font-size="28" fill="rgba(255,255,255,0.9)" text-anchor="middle">${this.truncateText(description, 50)}</text>

  <!-- Bottom CTA -->
  <rect x="0" y="${ctaY}" width="1200" height="110" fill="rgba(0,0,0,0.4)"/>
  <rect x="0" y="${ctaY}" width="1200" height="6" fill="${accent}"/>
  <rect x="50" y="${ctaY + 18}" width="300" height="74" rx="37" fill="${accent}"/>
  <text x="200" y="${ctaY + 65}" font-family="${headlineFamily}" font-size="32" font-weight="900" fill="white" text-anchor="middle">${cta}</text>

  <!-- Logo -->
  <rect x="950" y="${ctaY + 15}" width="90" height="80" rx="16" fill="${accent}"/>
  <text x="995" y="${ctaY + 68}" font-family="${headlineFamily}" font-size="32" fill="white" font-weight="900" text-anchor="middle">${logoInitials}</text>
  <text x="940" y="${ctaY + 65}" font-family="${fontFamily}" font-size="18" fill="rgba(255,255,255,0.8)" text-anchor="end">${restaurantName}</text>
</svg>`);
  }
  
  truncateText(text, maxLen) {
    if (!text || text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + '...';
  }

  async buildCreative(options) {
    const { dish, format, imageBuffer, colors, caption, campaignType } = options;
    const { width, height } = this.getDimensions(format);
    const style = this.getThemeStyle(dish.restaurant_theme, colors || ['#FF6B35', '#2E4057']);

    try {
      // 1. Start with gradient background
      const gradSvg = this.buildGradientSvg(width, height, style.colors);
      let base = await sharp(gradSvg).resize(width, height).png().toBuffer();
      
      const composites = [];

      // 2. Add food image as MAIN visual (centered)
      if (imageBuffer && imageBuffer.length > 1000) {
        const isStory = format === 'instagram_story';
        const isFacebook = format === 'facebook_post';
        
        // Image dimensions based on format
        let imgW, imgH, imgTop, imgLeft;
        
        if (isStory) {
          imgW = 900;
          imgH = 1000;
          imgTop = 120;
          imgLeft = 90;
        } else if (isFacebook) {
          imgW = 600;
          imgH = 400;
          imgTop = 120;
          imgLeft = 300;
        } else {
          // Instagram Square - image in upper 55%
          imgW = 980;
          imgH = 600;
          imgTop = 100;
          imgLeft = 50;
        }

        // Resize image (sharp corners - overlay handles visual styling)
        const resized = await sharp(imageBuffer)
          .resize(imgW, imgH, { fit: 'cover', position: 'centre' })
          .png()
          .toBuffer();

        composites.push({ input: resized, top: imgTop, left: imgLeft });
      }

      // 3. Overlay SVG (text, badges, CTA) on top
      const overlaySvg = this.buildOverlaySvg(width, height, dish, caption, format, style, campaignType);
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
        const overlaySvg = this.buildOverlaySvg(width, height, dish, caption, format, style, campaignType);
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
