const axios = require('axios');
const sharp = require('sharp');

// ── Festive visual themes (purely visual — NO text mentions) ─────────────────
const FESTIVE_VISUAL_THEMES = {
  diwali:    'surrounded by golden diyas, oil lamps, warm festive glow, marigold flowers, traditional diwali decorations, deep amber and gold lighting, rangoli patterns',
  christmas: 'nested in pine branches, fairy lights bokeh, festive red and green accents, cozy winter ambient light, snowflakes, candy cane',
  eid:       'with ornate gold lanterns, crescent moon motifs, rich velvet textures, royal emerald and gold atmosphere, star and crescent',
  sankranti: 'with rustic sugarcane stalks, harvest festival warmth, traditional earthen vessels, bright morning sunlight, kites in background',
  ugadi:     'with fresh mango leaf garlands, brass bells, traditional temple decor, vibrant spring colors, neem leaves',
  ramzan:    'iftar table setting, golden hour glow, delicate lanterns casting warm light, deep night aesthetic, dates and prayer beads',
  holi:      'with bursts of vibrant colored powders in background, joyful rainbow hues, festive celebration atmosphere, gulal colors',
  pongal:    'with traditional clay pots, rice stalks, harvest decorations, rustic village morning vibes, sugarcane bundles',
  onam:      'with pookalam flower arrangements, traditional Kerala sadya setting, banana leaves, festive Onam decorations, golden hues',
  navratri: 'with garba dandiya dance elements, colorful drapes, traditional lamps, durga puja ambiance, vibrant marigold',
  dussehra: 'with ramayan decorative elements, victory symbols, traditional festive setting, durga idol backdrop, Vijayadashami vibes',
  ganesh_chaturthi: 'with lord ganesh idol, modak sweets, flower garlands, festive puja setup, marigold and durva grass',
  independence_day: 'with tricolor decorations, national flag colors, patriotic bunting,celebration atmosphere',
  republic_day: 'with parade elements, national flag, patriotic decorations, celebration fervor'
};

// ── Dynamic Size Configs ─────────────────────────────────────────────────────
const SIZE_CONFIG = {
  '1:1':  { width: 1080, height: 1080 }, // standard square
  '4:5':  { width: 1080, height: 1350 }, // portrait / social feed
  '16:9': { width: 1920, height: 1080 }, // landscape / banner
  // Compatibility fallbacks
  square:    { width: 1080, height: 1080 },
  story:     { width: 1080, height: 1350 }, // Standardized to 4:5 for high-end composition
  landscape: { width: 1920, height: 1080 }  // Standardized to 16:9
};

// ── Strict Composition Rules for Text Overlays ───────────────────────────────
const COMPOSITIONS = {
  '1:1': {
    daily:       'subject placed in center-right, large dark empty negative space on top-left for text',
    new_arrival: 'dish in bottom-center, dynamic angled plating, large clean open space in top half',
    festive:     'dish centered, festive decor framing right side, clear clean space on left side',
    combo:       'spread of two distinct dishes in lower-right, clear empty space in top-left quadrant'
  },
  '4:5': {
    daily:       'dish in lower-right quadrant, cinematic spotlight, top and left regions completely clear and dark',
    new_arrival: 'dish in bottom-center, fresh modern plating, upper 40% of image strictly empty background',
    festive:     'festive platter in lower half, bokeh celebration elements, wide empty top half',
    combo:       'abundant meal spread with two main dishes in lower two-thirds, top third of frame perfectly clean and dark'
  },
  '16:9': {
    daily:       'dish on far right side, extreme horizontal negative space filling left 65% of frame',
    new_arrival: 'dish angled on right side, vibrant highlights, wide clean left-side background',
    festive:     'festive dish on far right, cultural accents, entire left half empty and cinematic',
    combo:       'two distinct dishes spanning the right side of frame, culinary flat-lay style, wide empty left zone'
  }
};

class ImageGeneratorService {
  constructor() {
    this.lastRequestTime    = 0;
    this.minRequestInterval = 30000;
  }

  async waitForRateLimit() {
    const now     = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise(r => setTimeout(r, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  getSizeConfig() { return SIZE_CONFIG; }

  // ── Master entry point ────────────────────────────────────────────────────

  async generateImage(dishName, description = '', retries = 3, campaignType = 'daily', festivalType = null, sizeType = '1:1', extraDishes = null) {
    const size = SIZE_CONFIG[sizeType] || SIZE_CONFIG['1:1'];
    return this.generateFromPollinations({ dishName, campaignType, festivalType, sizeType, size, extraDishes });
  }

  // ── Prompt builders (STRICTLY NO TEXT) ────────────────────────────────────

  buildDailyPrompt(dishName, sizeType) {
    const comp = (COMPOSITIONS[sizeType] || COMPOSITIONS['1:1']).daily;
    return `
photorealistic premium food photography of ${dishName},
cinematic lighting with warm golden rim light and deep moody shadows,
DSLR macro focus on textures, glistening sauce and fresh garnish,
minimalist high-end restaurant plating,
${comp},
pure black or dark charcoal background, clean zones for text overlay,
8K resolution, ultra-detailed, sharp focus, absolutely no text, no watermark, no symbols
`.trim().replace(/\s+/g, ' ');
  }

  buildNewArrivalPrompt(dishName, sizeType) {
    const comp = (COMPOSITIONS[sizeType] || COMPOSITIONS['1:1']).new_arrival;
    return `
vibrant fresh modern food photography of ${dishName},
energetic bright studio lighting with soft colored gel highlights,
dynamic plating style, crisp details, fresh herbs and ingredients,
${comp},
bright minimalist background with subtle gradient, clean zones for text overlay,
8K resolution, stunning culinary aesthetics, absolutely no text, no watermark, no labels
`.trim().replace(/\s+/g, ' ');
  }

  buildFestivePrompt(dishName, sizeType, festivalType) {
    const comp = (COMPOSITIONS[sizeType] || COMPOSITIONS['1:1']).festive;
    const festiveVisual = FESTIVE_VISUAL_THEMES[festivalType?.toLowerCase()] || 'elegant festive celebration lighting and decor';
    return `
premium photorealistic food photography of ${dishName} ${festiveVisual},
rich traditional celebratory atmosphere, glowing ambient light,
ornate premium plating, cultural aesthetic,
${comp},
cinematic bokeh background, clean area for overlay,
8K resolution, deeply detailed, absolutely no text, no watermark, no typography
`.trim().replace(/\s+/g, ' ');
  }

  buildComboPrompt(dishNames, sizeType) {
    const comp = (COMPOSITIONS[sizeType] || COMPOSITIONS['1:1']).combo;
    const labels = Array.isArray(dishNames) ? dishNames.slice(0, 2).join(' and ') : dishNames;
    console.log(`[Combo Prompt] Building with labels: ${labels} (type: ${typeof dishNames})`);
    return `
professional food photography of a generous restaurant meal combo featuring two complete dishes: ${labels},
both dishes beautifully presented together on a luxury serving platter or rustic wooden board,
artfully arranged with garnishes and sauces, rich inviting lighting highlighting the complete meal deal,
${comp},
overhead angled culinary composition, sharp focus on both food items, clean dark background zones for text overlay,
8K resolution, ultra-detailed, absolutely no text, no watermark, no branding, no letters
`.trim().replace(/\s+/g, ' ');
  }

buildPrompt({ dishName, campaignType, festivalType, sizeType, extraDishes }) {
    const type = String(campaignType || 'daily').toLowerCase();

    console.log(`[buildPrompt] type=${type}, dishName=${dishName}, extraDishes=${JSON.stringify(extraDishes)}`);

    if (type === 'new_arrival' || type === 'new_arrivals')
      return this.buildNewArrivalPrompt(dishName, sizeType);
    if (type === 'festive' || type === 'festive_offer')
      return this.buildFestivePrompt(dishName, sizeType, festivalType);
    if (type === 'combo' || type === 'combo_offer') {
      const comboLabels = Array.isArray(extraDishes) && extraDishes.length > 0
        ? extraDishes
        : (Array.isArray(dishName) ? dishName : [dishName]);
      return this.buildComboPrompt(comboLabels, sizeType);
    }

    return this.buildDailyPrompt(dishName, sizeType);
}

  // ── Pollinations Generation ───────────────────────────────────────────────

  async generateFromPollinations({ dishName, campaignType, festivalType, sizeType, size, extraDishes }) {
    const finalSize = size || SIZE_CONFIG['1:1'];
    await this.waitForRateLimit();

    const prompt = this.buildPrompt({ dishName, campaignType, festivalType, sizeType, extraDishes });
    console.log(`[Pollinations] ${campaignType.toUpperCase()} | ${sizeType} | Prompt: ${prompt.substring(0, 100)}...`);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${finalSize.width}&height=${finalSize.height}&nologo=true&seed=${Date.now()}`;
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });

        if (response.data && response.data.byteLength > 5000) {
          const buffer = await sharp(Buffer.from(response.data))
            .resize(finalSize.width, finalSize.height, { fit: 'cover' })
            .jpeg({ quality: 95 })
            .toBuffer();

          return { success: true, buffer, method: 'pollinations', sizeType };
        }
      } catch (err) {
        console.error(`Attempt ${attempt + 1} failed:`, err.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    return { success: false, error: 'Generation failed' };
  }

  async downloadAndProcess(url) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      return await sharp(Buffer.from(response.data))
        .resize(1080, 1080, { fit: 'cover' })
        .png()
        .toBuffer();
    } catch (e) {
      console.error('Download and process failed:', e.message);
      return null;
    }
  }

  async enhanceImage(url) {
    const buffer = await this.downloadAndProcess(url);
    if (buffer) {
      return { success: true, buffer };
    }
    return { success: false };
  }

  // ── Placeholder Fallback ──────────────────────────────────────────────────

  async generateFoodPlaceholder(dishName, width, height, campaignType) {
    // Simple colored rect fallback if API fails
    return sharp({
      create: {
        width, height, channels: 4,
        background: { r: 26, g: 26, b: 26, alpha: 1 }
      }
    }).jpeg().toBuffer();
  }
}

module.exports = new ImageGeneratorService();
