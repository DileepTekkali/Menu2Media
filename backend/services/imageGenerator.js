const axios = require('axios');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

class ImageGeneratorService {
  async generateImage(dishName, description = '') {
    try {
      const contextPrompt = description ? `${dishName}: ${description}` : dishName;
      const prompt = encodeURIComponent(
        `close-up professional food photography of ${contextPrompt}, ` +
        `appetizing Indian cuisine, warm restaurant lighting, ` +
        `shallow depth of field, high resolution, 4K, mouth-watering, ` +
        `wooden table background, garnished with herbs`
      );
      const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

      console.log(`Generating image for: ${dishName}`);
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 90000 });
      
      return {
        success: true,
        buffer: Buffer.from(response.data),
        method: 'ai_generated'
      };
    } catch (error) {
      console.error('Image generation error:', error.message);
      return {
        success: false,
        error: error.message,
        method: 'ai_generated'
      };
    }
  }

  async enhanceImage(imageUrl) {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(response.data);
      
      const enhanced = await sharp(buffer)
        .resize(1024, 1024, { fit: 'cover' })
        .sharpen(1.5)
        .normalize()
        .toBuffer();

      return {
        success: true,
        buffer: enhanced,
        method: 'enhanced_existing'
      };
    } catch (error) {
      console.error('Image enhancement error:', error.message);
      return {
        success: false,
        error: error.message,
        method: 'enhanced_existing'
      };
    }
  }

  async downloadAndProcess(imageUrl) {
    if (!imageUrl) {
      return null;
    }

    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      return Buffer.from(response.data);
    } catch {
      return null;
    }
  }

  generatePlaceholder(dishName, width = 1024, height = 1024) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const bgColor = colors[Math.floor(Math.random() * colors.length)];
    
    return sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    })
    .png()
    .toBuffer();
  }
}

module.exports = new ImageGeneratorService();
