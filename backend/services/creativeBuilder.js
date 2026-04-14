const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

class CreativeBuilderService {
  getDimensions(format) {
    const dimensions = {
      'instagram_square': { width: 1080, height: 1080 },
      'instagram_story': { width: 1080, height: 1920 },
      'facebook_post': { width: 1200, height: 630 }
    };
    return dimensions[format] || dimensions['instagram_square'];
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 107, b: 107 };
  }

  createGradientBuffer(width, height, colors) {
    const color1 = this.hexToRgb(colors[0] || '#FF6B6B');
    const color2 = this.hexToRgb(colors[1] || '#4ECDC4');
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(${color1.r},${color1.g},${color1.b});stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(${color2.r},${color2.g},${color2.b});stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
      </svg>
    `;
    
    return Buffer.from(svg);
  }

  async buildCreative(options) {
    const { dish, format, imageBuffer, colors, logoBuffer, caption } = options;
    const { width, height } = this.getDimensions(format);
    
    try {
      const gradientBuffer = this.createGradientBuffer(width, height, colors);
      let background = await sharp(gradientBuffer).toBuffer();
      
      let composite = [{ input: background, blend: 'over' }];
      
      if (imageBuffer && imageBuffer.length > 0) {
        const resizedImage = await sharp(imageBuffer)
          .resize(Math.floor(width * 0.7), Math.floor(height * 0.5), { fit: 'cover' })
          .toBuffer();
        composite.push({
          input: resizedImage,
          gravity: 'center'
        });
      }

      const finalBuffer = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
      .composite(composite)
      .png()
      .toBuffer();

      return {
        success: true,
        buffer: finalBuffer,
        dimensions: `${width}x${height}`
      };
    } catch (error) {
      console.error('Creative build error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addTextOverlay(buffer, text, options = {}) {
    const { x = 50, y = 100, fontSize = 48, color = '#FFFFFF' } = options;
    
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <style>
          .text { fill: ${color}; font-size: ${fontSize}px; font-weight: bold; font-family: Arial, sans-serif; }
        </style>
        <text x="${x}" y="${y}" class="text">${this.escapeXml(text)}</text>
      </svg>
    `;
    
    return sharp(buffer)
      .composite([{ input: Buffer.from(svgText), top: y, left: x }])
      .png()
      .toBuffer();
  }

  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = new CreativeBuilderService();
