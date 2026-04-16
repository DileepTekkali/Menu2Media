const axios = require('axios');
const sharp = require('sharp');

const FESTIVE_THEMES = {
  diwali: "diyas, candles, warm golden lighting, festive lights, rangoli",
  christmas: "christmas tree, snow, red and green theme, fairy lights",
  eid: "crescent moon, lanterns, royal decor, warm lighting",
  sankranti: "kites, rural theme, bright colors, traditional setup",
  ugadi: "mango leaves decoration, traditional indian setup, fresh vibes",
  ramzan: "iftar table, dates, lanterns, night ambiance",
  holi: "colorful powders, festive colors, celebration, flowers",
  pongal: "pot decoration, harvest theme, traditional setup, bright colors"
};

const BASE_PROMPT = `{food_item}, photorealistic, ultra realistic food photography, professional DSLR camera, 4k resolution, ultra detailed texture, natural soft lighting, shallow depth of field, macro lens, high dynamic range, realistic shadows, restaurant style plating, elegant composition, top view on wooden table, cinematic color grading, sharp focus, commercial food photography`;

class ImageGeneratorService {
  constructor() {
    this.lastRequestTime = 0;
    this.minRequestInterval = 30000;
    this.rateLimitCooldown = 60000;
    this.lastRateLimitTime = 0;
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`Rate limiting: waiting ${waitTime/1000}s before next request`);
      await new Promise(r => setTimeout(r, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  async generateImage(dishName, description = '', retries = 3, campaignType = 'daily', festivalType = null) {
    return this.generateFromPollinations(dishName, campaignType, festivalType);
  }

  buildPrompt(dishName, campaignType, festivalType) {
    // Base prompt with photorealistic food photography
    const basePrompt = BASE_PROMPT.replace('{food_item}', dishName);
    
    // Only add festival themes for festive campaign type
    if (campaignType === 'festive' && festivalType && FESTIVE_THEMES[festivalType]) {
      return `${basePrompt}, ${FESTIVE_THEMES[festivalType]}, festive themed`;
    }
    
    // Daily, new_arrival, combo, weekend - just the base photorealistic prompt
    return basePrompt;
  }

  async generateFromPollinations(dishName, campaignType = 'daily', festivalType = null) {
    const isRateLimited = (Date.now() - this.lastRateLimitTime) < this.rateLimitCooldown;
    if (isRateLimited) {
      console.log(`Rate limited, using placeholder for: ${dishName}`);
      return {
        success: true,
        buffer: await this.generateFoodPlaceholder(dishName, 1080, 1080, campaignType),
        method: 'placeholder'
      };
    }

    await this.waitForRateLimit();

    const prompt = this.buildPrompt(dishName, campaignType, festivalType);
    console.log(`Generating from Pollinations: ${dishName}`);
    console.log(`Prompt: ${prompt}`);
    
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Date.now() + attempt * 1000;
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&nologo=true&seed=${seed}`;

        console.log(`Pollinations attempt ${attempt + 1} for: ${dishName}`);
        
        // NO TIMEOUT - let it take as long as needed
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer'
        });

        if (response.data && response.data.byteLength > 5000) {
          const buffer = await sharp(Buffer.from(response.data))
            .resize(1080, 1080, { fit: 'cover' })
            .jpeg({ quality: 90 })
            .toBuffer();
            
          console.log(`Success: Generated image for ${dishName}`);
          return {
            success: true,
            buffer,
            method: 'pollinations'
          };
        }
      } catch (error) {
        const is429 = error.response?.status === 429;
        if (is429) {
          console.log(`Rate limited (429), cooling down for 60s`);
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
      buffer: await this.generateFoodPlaceholder(dishName, 1080, 1080, campaignType),
      method: 'placeholder'
    };
  }

  detectFoodType(dishName, description) {
    const text = (dishName + ' ' + description).toLowerCase();
    
    if (/pizza/i.test(text)) return 'pizza';
    if (/burger/i.test(text)) return 'burger';
    if (/pasta|noodle|spaghetti|alfredo/i.test(text)) return 'pasta';
    if (/chicken|tandoor|tikka/i.test(text)) return 'grilled chicken';
    if (/biryani|rice/i.test(text)) return 'biryani rice';
    if (/curry/i.test(text)) return 'curry';
    if (/salad|greens/i.test(text)) return 'fresh salad';
    if (/sandwich|sub|wrap/i.test(text)) return 'sandwich';
    if (/soup/i.test(text)) return 'soup';
    if (/coffee|espresso/i.test(text)) return 'coffee';
    if (/tea|chai/i.test(text)) return 'tea';
    if (/dessert|cake|ice cream/i.test(text)) return 'dessert';
    if (/bread|garlic|naan/i.test(text)) return 'bread';
    if (/salmon|fish/i.test(text)) return 'fish';
    if (/steak|beef/i.test(text)) return 'steak';
    if (/shrimp|prawn/i.test(text)) return 'shrimp';
    if (/samosa/i.test(text)) return 'indian snack';
    if (/roll|kathi/i.test(text)) return 'wrap';
    if (/dal|daal/i.test(text)) return 'lentils';
    
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
        .resize(1024, 1024, { fit: 'cover' })
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
    const foodType = this.detectFoodType(dishName, '');
    const foodEmoji = this.getFoodEmoji(foodType);
    
    const colorThemes = {
      daily: { bg: '#FF6B35', accent: '#FFFFFF', text: '#FFFFFF' },
      new_arrival: { bg: '#8B5CF6', accent: '#F0ABFC', text: '#FFFFFF' },
      combo: { bg: '#F59E0B', accent: '#FEF3C7', text: '#78350F' },
      festive: { bg: '#DC2626', accent: '#FDE68A', text: '#FFFFFF' },
      weekend: { bg: '#059669', accent: '#FFFFFF', text: '#FFFFFF' },
      default: { bg: '#FF6B35', accent: '#FFFFFF', text: '#FFFFFF' }
    };
    
    const theme = colorThemes[campaignType] || colorThemes.default;
    const shortName = dishName.length > 25 ? dishName.substring(0, 22) + '...' : dishName;

    const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${theme.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${this.darkenColor(theme.bg)};stop-opacity:1"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  
  <circle cx="100" cy="100" r="150" fill="rgba(255,255,255,0.1)"/>
  <circle cx="${width - 100}" cy="${height - 100}" r="200" fill="rgba(255,255,255,0.08)"/>
  
  <circle cx="${width/2}" cy="${height * 0.38}" r="120" fill="rgba(255,255,255,0.2)" filter="url(#shadow)"/>
  <text x="${width/2}" y="${height * 0.42}" 
    font-family="Arial" font-size="100" text-anchor="middle">${foodEmoji}</text>
  
  <text x="${width/2}" y="${height * 0.65}"
    font-family="Arial Black, Arial, sans-serif" font-size="56" font-weight="bold"
    fill="${theme.text}" text-anchor="middle">${this.escapeXml(shortName)}</text>
  
  <text x="${width/2}" y="${height * 0.73}"
    font-family="Arial, sans-serif" font-size="28"
    fill="rgba(255,255,255,0.8)" text-anchor="middle">Delicious &amp; Fresh</text>
  
  <rect x="${width/2 - 80}" y="${height * 0.78}" width="160" height="4" rx="2" fill="rgba(255,255,255,0.5)"/>
</svg>`;

    return sharp(Buffer.from(svg))
      .resize(width, height)
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  getFoodEmoji(foodType) {
    const emojis = {
      'pizza': '🍕',
      'burger': '🍔',
      'pasta': '🍝',
      'grilled chicken': '🍗',
      'biryani rice': '🍚',
      'curry': '🍛',
      'fresh salad': '🥗',
      'sandwich': '🥪',
      'soup': '🍲',
      'coffee': '☕',
      'tea': '🍵',
      'dessert': '🍰',
      'bread': '🥖',
      'fish': '🐟',
      'steak': '🥩',
      'shrimp': '🦐',
      'indian snack': '🥟',
      'wrap': '🌯',
      'lentils': '🫘',
      'gourmet dish': '🍽️'
    };
    return emojis[foodType] || '🍽️';
  }

  darkenColor(hex) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - 30);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - 30);
    const b = Math.max(0, (num & 0x0000FF) - 30);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  escapeXml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = new ImageGeneratorService();
