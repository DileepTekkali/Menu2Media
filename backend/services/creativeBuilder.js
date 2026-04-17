const sharp = require('sharp');

class CreativeBuilderService {
  getDimensions(format) {
    const dimensions = {
      'square':     { width: 1080, height: 1080 },
      'story':      { width: 1080, height: 1920 },
      'landscape':  { width: 1200, height: 630 }
    };
    return dimensions[format] || dimensions['square'];
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

  truncateText(text, maxLen) {
    if (!text || text.length <= maxLen) return text || '';
    return text.substring(0, Math.max(0, maxLen - 3)) + '...';
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

  darkenColor(hex) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - 25);
    const g = Math.max(0, ((num >> 8) & 0xFF) - 25);
    const b = Math.max(0, (num & 0xFF) - 25);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  buildGradientSvg(width, height, colors) {
    const c1 = this.hexToRgb(colors[0] || '#1A1A3E');
    const c2 = this.hexToRgb(colors[1] || '#3D2645');
    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(${c1.r},${c1.g},${c1.b});stop-opacity:1"/>
      <stop offset="100%" style="stop-color:rgb(${c2.r},${c2.g},${c2.b});stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad)"/>
</svg>`);
  }

  buildOverlaySvg(width, height, dish, caption, format, style, campaignType = 'daily') {
    const isStory = format === 'story';
    const isLandscape = format === 'landscape';

    const name = this.escapeXml(dish.name || 'Special Dish');
    const price = dish.price ? `₹${Math.round(dish.price)}` : '';
    const headline = this.escapeXml(caption?.headline?.replace(/^[^\w]*/, '') || "Today's Special");
    const cta = this.escapeXml(caption?.cta || 'Order Now');
    const restaurantName = this.escapeXml(dish.restaurant_name || 'Our Restaurant');
    const description = this.escapeXml(caption?.caption || dish.description || '');

    const accent = this.sanitizeHex(style?.accent || '#FF6B35', '#FF6B35');
    const fontFamily = "'Arial Black', Arial, sans-serif";

    // Reference image layout: Image on LEFT, Text panel on RIGHT
    if (isStory) {
      return this.buildStoryLayout(width, height, { headline, name, description, price, cta, restaurantName, accent, fontFamily });
    } else if (isLandscape) {
      return this.buildLandscapeLayout(width, height, { headline, name, description, price, cta, restaurantName, accent, fontFamily });
    } else {
      return this.buildSquareLayout(width, height, { headline, name, description, price, cta, restaurantName, accent, fontFamily });
    }
  }

  buildSquareLayout(width, height, params) {
    const { headline, name, description, price, cta, restaurantName, accent, fontFamily } = params;
    
    const imageWidth = width * 0.55;
    const panelX = imageWidth;
    const panelWidth = width - imageWidth;
    const padding = 30;
    
    const headingSize = 22;
    const nameSize = 38;
    const descSize = 16;
    const ctaSize = 18;
    
    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(0,0,0,0.85)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.9)"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  
  <!-- Dark text panel on right side -->
  <rect x="${panelX}" y="0" width="${panelWidth}" height="${height}" fill="url(#panelGrad)"/>
  
  <!-- Accent line on panel edge -->
  <rect x="${panelX}" y="0" width="4" height="${height}" fill="${accent}"/>
  
  <!-- TODAY'S SPECIAL heading -->
  <text x="${panelX + padding}" y="${height * 0.12}" 
        font-family="${fontFamily}" 
        font-size="${headingSize}" 
        font-weight="900"
        fill="${accent}"
        letter-spacing="1">${headline}</text>
  
  <!-- Dish name -->
  <text x="${panelX + padding}" y="${height * 0.28}" 
        font-family="${fontFamily}" 
        font-size="${nameSize}" 
        font-weight="900"
        fill="white"
        filter="url(#shadow)">${this.truncateText(name, 20)}</text>
  
  <!-- Description -->
  <text x="${panelX + padding}" y="${height * 0.48}" 
        font-family="Arial, sans-serif" 
        font-size="${descSize}"
        fill="rgba(255,255,255,0.8)">${this.truncateText(description, 60)}</text>
  
  <!-- Price -->
  ${price ? `
  <text x="${panelX + padding}" y="${height * 0.60}" 
        font-family="${fontFamily}" 
        font-size="28" 
        font-weight="900"
        fill="${accent}">${price}</text>
  ` : ''}
  
  <!-- CTA Button -->
  <rect x="${panelX + padding}" y="${height * 0.75}" width="${panelWidth - padding * 2}" height="50" rx="25" fill="${accent}"/>
  <text x="${panelX + padding + (panelWidth - padding * 2) / 2}" y="${height * 0.75 + 33}" 
        font-family="${fontFamily}" 
        font-size="${ctaSize}" 
        font-weight="900"
        fill="white"
        text-anchor="middle">${cta}</text>
  
  <!-- Restaurant branding -->
  <rect x="${panelX + padding}" y="${height * 0.90}" width="40" height="40" rx="8" fill="${accent}"/>
  <text x="${panelX + padding + 20}" y="${height * 0.90 + 27}" 
        font-family="${fontFamily}" 
        font-size="14" 
        fill="white"
        text-anchor="middle">${this.getInitials(restaurantName)}</text>
  <text x="${panelX + padding + 55}" y="${height * 0.90 + 27}" 
        font-family="Arial, sans-serif" 
        font-size="12"
        fill="rgba(255,255,255,0.7)">${this.truncateText(restaurantName, 15)}</text>
</svg>`);
  }

  buildStoryLayout(width, height, params) {
    const { headline, name, description, price, cta, restaurantName, accent, fontFamily } = params;
    
    const imageHeight = height * 0.55;
    const panelY = imageHeight;
    const panelHeight = height - imageHeight;
    const padding = 40;
    
    const headingSize = 32;
    const nameSize = 56;
    const descSize = 22;
    const ctaSize = 24;
    
    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(0,0,0,0.85)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.95)"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="rgba(0,0,0,0.6)"/>
    </filter>
  </defs>
  
  <!-- Dark text panel at bottom -->
  <rect x="0" y="${panelY}" width="${width}" height="${panelHeight}" fill="url(#panelGrad)"/>
  
  <!-- Accent line on panel top -->
  <rect x="0" y="${panelY}" width="${width}" height="4" fill="${accent}"/>
  
  <!-- TODAY'S SPECIAL heading -->
  <text x="${width / 2}" y="${panelY + 60}" 
        font-family="${fontFamily}" 
        font-size="${headingSize}" 
        font-weight="900"
        fill="${accent}"
        text-anchor="middle"
        letter-spacing="2">${headline}</text>
  
  <!-- Dish name -->
  <text x="${padding}" y="${panelY + 150}" 
        font-family="${fontFamily}" 
        font-size="${nameSize}" 
        font-weight="900"
        fill="white"
        filter="url(#shadow)">${this.truncateText(name, 25)}</text>
  
  <!-- Description -->
  <text x="${padding}" y="${panelY + 220}" 
        font-family="Arial, sans-serif" 
        font-size="${descSize}"
        fill="rgba(255,255,255,0.8)">${this.truncateText(description, 50)}</text>
  
  <!-- Price -->
  ${price ? `
  <text x="${padding}" y="${panelY + 280}" 
        font-family="${fontFamily}" 
        font-size="36" 
        font-weight="900"
        fill="${accent}">${price}</text>
  ` : ''}
  
  <!-- CTA Button -->
  <rect x="${padding}" y="${height - 140}" width="${width - padding * 2}" height="70" rx="35" fill="${accent}"/>
  <text x="${width / 2}" y="${height - 100}" 
        font-family="${fontFamily}" 
        font-size="${ctaSize}" 
        font-weight="900"
        fill="white"
        text-anchor="middle">${cta}</text>
  
  <!-- Restaurant branding -->
  <rect x="${width - 100}" y="${panelY + 40}" width="50" height="50" rx="10" fill="${accent}"/>
  <text x="${width - 75}" y="${panelY + 75}" 
        font-family="${fontFamily}" 
        font-size="18" 
        fill="white"
        text-anchor="middle">${this.getInitials(restaurantName)}</text>
</svg>`);
  }

  buildLandscapeLayout(width, height, params) {
    const { headline, name, description, price, cta, restaurantName, accent, fontFamily } = params;
    
    const imageWidth = width * 0.55;
    const panelX = imageWidth;
    const panelWidth = width - imageWidth;
    const padding = 25;
    
    const headingSize = 18;
    const nameSize = 32;
    const descSize = 14;
    const ctaSize = 16;
    
    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(0,0,0,0.85)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.9)"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>
  
  <!-- Dark text panel on right side -->
  <rect x="${panelX}" y="0" width="${panelWidth}" height="${height}" fill="url(#panelGrad)"/>
  
  <!-- Accent line on panel edge -->
  <rect x="${panelX}" y="0" width="3" height="${height}" fill="${accent}"/>
  
  <!-- TODAY'S SPECIAL heading -->
  <text x="${panelX + padding}" y="${height * 0.18}" 
        font-family="${fontFamily}" 
        font-size="${headingSize}" 
        font-weight="900"
        fill="${accent}"
        letter-spacing="1">${headline}</text>
  
  <!-- Dish name -->
  <text x="${panelX + padding}" y="${height * 0.38}" 
        font-family="${fontFamily}" 
        font-size="${nameSize}" 
        font-weight="900"
        fill="white"
        filter="url(#shadow)">${this.truncateText(name, 18)}</text>
  
  <!-- Description -->
  <text x="${panelX + padding}" y="${height * 0.55}" 
        font-family="Arial, sans-serif" 
        font-size="${descSize}"
        fill="rgba(255,255,255,0.8)">${this.truncateText(description, 40)}</text>
  
  <!-- Price -->
  ${price ? `
  <text x="${panelX + padding}" y="${height * 0.72}" 
        font-family="${fontFamily}" 
        font-size="22" 
        font-weight="900"
        fill="${accent}">${price}</text>
  ` : ''}
  
  <!-- CTA Button -->
  <rect x="${panelX + padding}" y="${height * 0.82}" width="${panelWidth - padding * 2}" height="40" rx="20" fill="${accent}"/>
  <text x="${panelX + padding + (panelWidth - padding * 2) / 2}" y="${height * 0.82 + 27}" 
        font-family="${fontFamily}" 
        font-size="${ctaSize}" 
        font-weight="900"
        fill="white"
        text-anchor="middle">${cta}</text>
  
  <!-- Restaurant branding -->
  <rect x="${panelX + padding}" y="${height * 0.92}" width="30" height="30" rx="6" fill="${accent}"/>
  <text x="${panelX + padding + 15}" y="${height * 0.92 + 20}" 
        font-family="${fontFamily}" 
        font-size="10" 
        fill="white"
        text-anchor="middle">${this.getInitials(restaurantName)}</text>
  <text x="${panelX + padding + 45}" y="${height * 0.92 + 20}" 
        font-family="Arial, sans-serif" 
        font-size="10"
        fill="rgba(255,255,255,0.7)">${this.truncateText(restaurantName, 12)}</text>
</svg>`);
  }

  async buildCreative(options) {
    const { dish, format, imageBuffer, colors, caption, campaignType } = options;
    const { width, height } = this.getDimensions(format);
    const style = {
      accent: colors?.[0] || '#FF6B35',
      secondary: colors?.[1] || '#2E4057'
    };

    try {
      // 1. Start with dark gradient background
      const gradSvg = this.buildGradientSvg(width, height, ['#1A1A3E', '#3D2645']);
      let base = await sharp(gradSvg).resize(width, height).png().toBuffer();
      
      const composites = [];

      // 2. Add food image (on left side for square/landscape, top for story)
      if (imageBuffer && imageBuffer.length > 1000) {
        const isStory = format === 'story';
        const isLandscape = format === 'landscape';
        
        let imgW, imgH, imgTop, imgLeft;
        
        if (isStory) {
          // Story: Full width image at top (55% of height)
          imgW = width;
          imgH = Math.floor(height * 0.55);
          imgTop = 0;
          imgLeft = 0;
        } else if (isLandscape) {
          // Landscape: Full height image on left (55% of width)
          imgW = Math.floor(width * 0.55);
          imgH = height;
          imgTop = 0;
          imgLeft = 0;
        } else {
          // Square: Full height image on left (55% of width)
          imgW = Math.floor(width * 0.55);
          imgH = height;
          imgTop = 0;
          imgLeft = 0;
        }

        const resized = await sharp(imageBuffer)
          .resize(imgW, imgH, { fit: 'cover', position: 'centre' })
          .png()
          .toBuffer();

        composites.push({ input: resized, top: imgTop, left: imgLeft });
      }

      // 3. Add text overlay
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
        const gradSvg = this.buildGradientSvg(width, height, ['#1A1A3E', '#3D2645']);
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
    if (exportType === 'jpg') return 'image/jpeg';
    if (exportType === 'webp') return 'image/webp';
    return 'image/png';
  }
}

module.exports = new CreativeBuilderService();
