const axios = require('axios');
const sharp = require('sharp');

class ImageGeneratorService {

  async generateImage(dishName, description = '', retries = 1) {
    // Skip external API - use placeholder immediately
    console.log(`Using placeholder for: ${dishName}`);
    return {
      success: true,
      buffer: await this.generatePlaceholder(dishName),
      method: 'placeholder'
    };
  }

  async enhanceImage(bufferOrUrl) {
    try {
      let buffer;
      if (Buffer.isBuffer(bufferOrUrl)) {
        buffer = bufferOrUrl;
      } else {
        const response = await axios.get(bufferOrUrl, { responseType: 'arraybuffer', timeout: 30000 });
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
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      if (response.data && response.data.byteLength > 1000) {
        return Buffer.from(response.data);
      }
      return null;
    } catch {
      return null;
    }
  }

  async generatePlaceholder(dishName, width = 1024, height = 1024) {
    // Generate a visually appealing gradient placeholder with dish name
    const colorSets = [
      ['#FF6B35', '#F7C59F'], // warm orange
      ['#2E4057', '#048A81'], // teal blue
      ['#6B2D8B', '#E040FB'], // purple
      ['#1B4332', '#52B788'], // forest green
      ['#B5451B', '#F4A261'], // terracotta
      ['#0D1B2A', '#E43F6F'], // dark rose
    ];
    const colors = colorSets[Math.floor(Math.random() * colorSets.length)];
    const shortName = dishName.length > 20 ? dishName.substring(0, 20) + '...' : dishName;

    const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <text x="${width / 2}" y="${height * 0.42}" 
    font-family="Arial, sans-serif" font-size="48" font-weight="bold"
    fill="rgba(255,255,255,0.3)" text-anchor="middle">🍽️</text>
  <text x="${width / 2}" y="${height * 0.55}"
    font-family="Arial, sans-serif" font-size="52" font-weight="bold"
    fill="white" text-anchor="middle" opacity="0.9">${this.escapeXml(shortName)}</text>
  <text x="${width / 2}" y="${height * 0.63}"
    font-family="Arial, sans-serif" font-size="28"
    fill="rgba(255,255,255,0.7)" text-anchor="middle">Restaurant Special</text>
</svg>`;

    return sharp(Buffer.from(svg))
      .resize(width, height)
      .png()
      .toBuffer();
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
