const axios = require('axios');
const sharp = require('sharp');

const FESTIVE_THEMES = {
  diwali:    'diyas, candles, warm golden lighting, festive lights, rangoli',
  christmas: 'christmas tree, snow, red and green theme, fairy lights',
  eid:       'crescent moon, lanterns, royal decor, warm lighting',
  sankranti: 'kites, rural theme, bright colors, traditional setup',
  ugadi:     'mango leaves decoration, traditional indian setup, fresh vibes',
  ramzan:    'iftar table, dates, lanterns, night ambiance',
  holi:      'colorful powders, festive colors, celebration, flowers',
  pongal:    'pot decoration, harvest theme, traditional setup, bright colors'
};

const SIZE_CONFIG = {
  square:    { width: 1080, height: 1080 },
  story:     { width: 1080, height: 1920 },
  landscape: { width: 1200, height: 630 }
};

class ImageGeneratorService {
  constructor() {
    this.lastRequestTime  = 0;
    this.minRequestInterval = 30000;
    this.rateLimitCooldown  = 60000;
    this.lastRateLimitTime  = 0;
  }

  async waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      const wait = this.minRequestInterval - elapsed;
      console.log(`Rate limiting: waiting ${wait / 1000}s before next request`);
      await new Promise(r => setTimeout(r, wait));
    }
    this.lastRequestTime = Date.now();
  }

  async generateImage(dishName, description = '', retries = 3, campaignType = 'daily', festivalType = null, sizeType = 'square') {
    const size = SIZE_CONFIG[sizeType] || SIZE_CONFIG.square;
    return this.generateFromPollinations(dishName, campaignType, festivalType, sizeType, size);
  }

  getSizeConfig() {
    return SIZE_CONFIG;
  }

  // ── Prompt builders ──────────────────────────────────────────────────────

  buildDarkPremiumPrompt(dish, sizeType = 'square') {
    const layouts = {
      square: `
        square composition, subject slightly center-right,
        large dark empty negative space on left side,
        center-focused premium composition
      `,
      story: `
        vertical composition, subject placed lower middle,
        large dark empty negative space at the top third,
        cinematic vertical composition
      `,
      landscape: `
        horizontal composition, subject placed on far right side,
        wide dark empty negative space on left half,
        wide horizontal composition
      `
    };

    const layout = layouts[sizeType] || layouts.square;

    return `
dark premium food photography of ${dish},
pure black background with warm amber and golden rim lighting,
spotlight dramatically illuminating photorealistic ${dish},
cinematic deep shadows, ultra detailed, DSLR macro photography,
${layout},
clean composition with wide dark empty zones,
subtle warm gradients, upscale restaurant aesthetic,
8K ultra high resolution, absolutely NO text, no letters, no watermark
`.trim().replace(/\s+/g, ' ');
  }

  buildPrompt(dishName, campaignType, festivalType, sizeType) {
    let prompt = this.buildDarkPremiumPrompt(dishName, sizeType);
    if (campaignType === 'festive' && festivalType && FESTIVE_THEMES[festivalType]) {
      prompt += `, ${FESTIVE_THEMES[festivalType]}, festive themed`;
    }
    return prompt;
  }

  // ── Pollinations image generation ────────────────────────────────────────

  async generateFromPollinations(dishName, campaignType = 'daily', festivalType = null, sizeType = 'square', size = null) {
    const finalSize = size || SIZE_CONFIG[sizeType] || SIZE_CONFIG.square;

    const isRateLimited = (Date.now() - this.lastRateLimitTime) < this.rateLimitCooldown;
    if (isRateLimited) {
      console.log(`Rate limited, using placeholder for: ${dishName}`);
      return {
        success: true,
        buffer:  await this.generateFoodPlaceholder(dishName, finalSize.width, finalSize.height, campaignType),
        method:  'placeholder'
      };
    }

    await this.waitForRateLimit();

    const prompt = this.buildPrompt(dishName, campaignType, festivalType, sizeType);
    console.log(`Generating from Pollinations: ${dishName} (${sizeType})`);
    console.log(`Prompt: ${prompt.substring(0, 120)}...`);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed     = Date.now() + attempt * 1000;
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${finalSize.width}&height=${finalSize.height}&nologo=true&seed=${seed}`;

        console.log(`Pollinations attempt ${attempt + 1} for: ${dishName} (${sizeType})`);

        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

        if (response.data && response.data.byteLength > 5000) {
          const buffer = await sharp(Buffer.from(response.data))
            .resize(finalSize.width, finalSize.height, { fit: 'cover' })
            .jpeg({ quality: 90 })
            .toBuffer();

          console.log(`Success: Generated ${sizeType} image for ${dishName}`);
          return {
            success:    true,
            buffer,
            method:     'pollinations',
            sizeType,
            dimensions: `${finalSize.width}x${finalSize.height}`
          };
        }
      } catch (error) {
        if (error.response?.status === 429) {
          console.log('Rate limited (429), cooling down for 60s');
          this.lastRateLimitTime = Date.now();
          await new Promise(r => setTimeout(r, 60000));
          continue;
        }
        console.log(`Pollinations attempt ${attempt + 1} failed:`, error.message);
        if (attempt < 4) {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    console.log(`Using food-styled placeholder for: ${dishName}`);
    return {
      success: true,
      buffer:  await this.generateFoodPlaceholder(dishName, finalSize.width, finalSize.height, campaignType),
      method:  'placeholder'
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  detectFoodType(dishName, description) {
    const text = (dishName + ' ' + description).toLowerCase();
    if (/pizza/i.test(text))                         return 'pizza';
    if (/burger/i.test(text))                        return 'burger';
    if (/pasta|noodle|spaghetti|alfredo/i.test(text)) return 'pasta';
    if (/chicken|tandoor|tikka/i.test(text))          return 'grilled chicken';
    if (/biryani|rice/i.test(text))                   return 'biryani rice';
    if (/curry/i.test(text))                          return 'curry';
    if (/salad|greens/i.test(text))                   return 'fresh salad';
    if (/sandwich|sub|wrap/i.test(text))              return 'sandwich';
    if (/soup/i.test(text))                           return 'soup';
    if (/coffee|espresso/i.test(text))                return 'coffee';
    if (/tea|chai/i.test(text))                       return 'tea';
    if (/dessert|cake|ice cream/i.test(text))         return 'dessert';
    if (/bread|garlic|naan/i.test(text))              return 'bread';
    if (/salmon|fish/i.test(text))                    return 'fish';
    if (/steak|beef/i.test(text))                     return 'steak';
    if (/shrimp|prawn/i.test(text))                   return 'shrimp';
    if (/samosa/i.test(text))                         return 'indian snack';
    if (/roll|kathi/i.test(text))                     return 'wrap';
    if (/dal|daal/i.test(text))                       return 'lentils';
    return 'gourmet dish';
  }

  async enhanceImage(bufferOrUrl) {
    try {
      let buffer;
      if (Buffer.isBuffer(bufferOrUrl)) {
        buffer = bufferOrUrl;
      } else {
        const response = await axios.get(bufferOrUrl, { responseType: 'arraybuffer' });
        buffer = Buffer.from(response.data);
      }
      const enhanced = await sharp(buffer)
        .resize(1080, 1080, { fit: 'cover' })
        .sharpen({ sigma: 1.2 })
        .normalize()
        .modulate({ brightness: 1.05, saturation: 1.1 })
        .png()
        .toBuffer();
      return { success: true, buffer: enhanced, method: 'enhanced' };
    } catch (error) {
      console.error('Image enhancement error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async downloadAndProcess(imageUrl) {
    if (!imageUrl) return null;
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      if (response.data && response.data.byteLength > 1000) {
        return Buffer.from(response.data);
      }
      return null;
    } catch {
      return null;
    }
  }

  async generateFoodPlaceholder(dishName, width = 1080, height = 1080, campaignType = 'daily') {
    const foodType  = this.detectFoodType(dishName, '');
    const foodEmoji = this.getFoodEmoji(foodType);

    const colorThemes = {
      daily:       { bg: '#4A1A00', accent: '#FF6B35', text: '#FFFFFF' },
      new_arrival: { bg: '#1A0040', accent: '#C47AFF', text: '#FFFFFF' },
      combo:       { bg: '#3A2000', accent: '#F59E0B', text: '#FEF3C7' },
      festive:     { bg: '#4A0000', accent: '#FFD700', text: '#FFFFFF' },
      weekend:     { bg: '#002A14', accent: '#22C55E', text: '#FFFFFF' },
      default:     { bg: '#4A1A00', accent: '#FF6B35', text: '#FFFFFF' }
    };

    const theme     = colorThemes[campaignType] || colorThemes.default;
    const shortName = dishName.length > 24 ? dishName.substring(0, 21) + '...' : dishName;

    const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#0A0500;stop-opacity:1"/>
    </linearGradient>
    <radialGradient id="spotLight" cx="50%" cy="40%" r="45%">
      <stop offset="0%"   stop-color="${theme.accent}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-opacity="0.5"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  <rect width="${width}" height="${height}" fill="url(#spotLight)"/>
  <circle cx="${width / 2}" cy="${height * 0.38}" r="130"
    fill="rgba(255,255,255,0.06)" filter="url(#shadow)"/>
  <text x="${width / 2}" y="${height * 0.43}"
    font-family="Arial" font-size="${Math.round(height * 0.10)}" text-anchor="middle">${foodEmoji}</text>
  <text x="${width / 2}" y="${height * 0.63}"
    font-family="Arial Black, Arial, sans-serif" font-size="${Math.round(height * 0.055)}" font-weight="bold"
    fill="${theme.text}" text-anchor="middle">${this.escapeXml(shortName)}</text>
  <text x="${width / 2}" y="${height * 0.72}"
    font-family="Arial, sans-serif" font-size="${Math.round(height * 0.028)}"
    fill="rgba(255,255,255,0.65)" text-anchor="middle">Crafted with the Finest Ingredients</text>
  <rect x="${width / 2 - 90}" y="${height * 0.77}" width="180" height="3" rx="1.5"
    fill="${theme.accent}" opacity="0.7"/>
</svg>`;

    return sharp(Buffer.from(svg))
      .resize(width, height)
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  getFoodEmoji(foodType) {
    const emojis = {
      'pizza':          '🍕',
      'burger':         '🍔',
      'pasta':          '🍝',
      'grilled chicken':'🍗',
      'biryani rice':   '🍚',
      'curry':          '🍛',
      'fresh salad':    '🥗',
      'sandwich':       '🥪',
      'soup':           '🍲',
      'coffee':         '☕',
      'tea':            '🍵',
      'dessert':        '🍰',
      'bread':          '🥖',
      'fish':           '🐟',
      'steak':          '🥩',
      'shrimp':         '🦐',
      'indian snack':   '🥟',
      'wrap':           '🌯',
      'lentils':        '🫘',
      'gourmet dish':   '🍽️'
    };
    return emojis[foodType] || '🍽️';
  }

  escapeXml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  darkenColor(hex) {
    const num = parseInt((hex || '#FF6B35').replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - 30);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - 30);
    const b = Math.max(0, (num & 0x0000FF) - 30);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }
}

module.exports = new ImageGeneratorService();
