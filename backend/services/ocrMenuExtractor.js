const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { execFile } = require('child_process');
const sharp = require('sharp');

const execFileAsync = promisify(execFile);

let Tesseract = null;
try {
  Tesseract = require('tesseract.js');
} catch (_) {
  Tesseract = null;
}

class OcrMenuExtractor {
  async extractFromImageUrl(imageUrl) {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    return this.extractTextFromImageBuffer(Buffer.from(response.data), this.extensionFromUrl(imageUrl));
  }

  async extractTextFromImageBuffer(buffer, extension = '.png') {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-ocr-'));
    const inputPath = path.join(tempDir, `input_${crypto.randomUUID()}${extension}`);
    const processedPath = path.join(tempDir, `processed_${crypto.randomUUID()}.png`);
    
    fs.writeFileSync(inputPath, buffer);

    try {
      // Preprocess image for better OCR: grayscale, contrast, and resize
      await sharp(inputPath)
        .resize({ width: 2000, withoutEnlargement: true }) // Upscale if small
        .grayscale()
        .normalize()
        .threshold(128) // Convert to black and white
        .png()
        .toFile(processedPath);

      return await this.extractTextFromImagePath(processedPath);
    } catch (err) {
      console.warn('Image preprocessing failed, falling back to raw image:', err.message);
      return await this.extractTextFromImagePath(inputPath);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async extractTextFromImagePath(imagePath) {
    if (await this.commandExists('tesseract')) {
      const outputBase = path.join(os.tmpdir(), `menu-ocr-${crypto.randomUUID()}`);
      try {
        // Use PSM 1 (Automatic page segmentation with OSD) or PSM 3 (Fully automatic page segmentation)
        await execFileAsync('tesseract', [imagePath, outputBase, '-l', 'eng', '--psm', '3'], {
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024
        });
        const textPath = `${outputBase}.txt`;
        return fs.existsSync(textPath) ? fs.readFileSync(textPath, 'utf8') : '';
      } finally {
        fs.rmSync(`${outputBase}.txt`, { force: true });
      }
    }

    if (!Tesseract) {
      throw new Error('OCR is unavailable. Install tesseract.js or the tesseract CLI.');
    }

    const result = await Tesseract.recognize(imagePath, 'eng', {
      logger: () => {}
    });
    return result?.data?.text || '';
  }

  async commandExists(command) {
    try {
      await execFileAsync('which', [command], { timeout: 5000 });
      return true;
    } catch (_) {
      return false;
    }
  }

  extensionFromUrl(imageUrl) {
    try {
      const ext = path.extname(new URL(imageUrl).pathname).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'].includes(ext) ? ext : '.png';
    } catch (_) {
      return '.png';
    }
  }
}

module.exports = new OcrMenuExtractor();
