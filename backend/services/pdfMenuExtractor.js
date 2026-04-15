const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const pdf = require('pdf-parse');

class PdfMenuExtractor {
  async extractFromUrl(pdfUrl) {
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const buffer = Buffer.from(response.data);
    
    let text = '';
    let fallbackMode = false;
    try {
      // Check for valid PDF header
      const header = buffer.slice(0, 5).toString('latin1');
      if (!header.startsWith('%PDF') && !header.startsWith('\x25PDF')) {
        throw new Error('Not a valid PDF');
      }
      
      // Handle pdf-parse as class (newer versions)
      if (pdf && pdf.PDFParse && typeof pdf.PDFParse === 'function') {
        const parser = new pdf.PDFParse(buffer, { verbosityLevel: pdf.VerbosityLevel.ERROR });
        if (typeof parser.parse === 'function') {
          const data = await parser.parse();
          text = data.text || '';
        }
      }
      
      // If still no text, try function style
      if (!text && typeof pdf === 'function') {
        const data = await pdf(buffer);
        text = data?.text || '';
      }
      
      if (!text) {
        fallbackMode = true;
        text = buffer.toString('latin1').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      }
    } catch (parseErr) {
      console.warn(`PDF Parse error for ${pdfUrl}, using fallback:`, parseErr.message);
      text = buffer.toString('latin1').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    }

    const items = this.parseTextMenu(text);

    return {
      success: items.length > 0,
      items,
      total: items.length,
      method: 'pdf_parse'
    };
  }

  parseTextMenu(text) {
    const items = [];
    let currentCategory = 'Menu';
    
    // Normalize text
    const cleanText = String(text || '').replace(/\r/g, '\n');
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

    // Categories we care about
    const catKeywords = ['starter', 'appetizer', 'main course', 'dessert', 'beverage', 'drink', 'pasta', 'pizza', 'salad', 'soup', 'entree', 'specialty'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Category detection
      if (line.length < 30 && catKeywords.some(k => line.toLowerCase().includes(k))) {
        currentCategory = this.titleCase(line);
        continue;
      }

      // Improved Price Detection
      const priceRegex = /(?:(?:\$|₹|Rs\.?|INR)\s*)?(\d{1,3}(?:,\d{3})*\.\d{2})(?:\s|$)/i;
      const match = line.match(priceRegex);
      
      if (match) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        let namePart = line.replace(match[0], '').trim();
        namePart = namePart.replace(/[.\-\s_]{2,}/g, ' ').replace(/[.:-]+$/, '').trim();
        
        if (namePart.length >= 3 && namePart.length < 100 && !this.isNoise(namePart)) {
          items.push({
            name: namePart,
            category: currentCategory,
            price,
            description: '',
            image_url: ''
          });
        }
      }
    }

    const seen = new Set();
    return items.filter(item => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  isNoise(text) {
    const lower = text.toLowerCase();
    const noise = ['menu', 'page', 'fratellino', 'restaurant', 'tel:', 'phone', 'website', 'address', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'prices subject to change'];
    return noise.some(n => lower === n || lower.includes('copyright') || lower.includes('subject to change'));
  }

  titleCase(text) {
    return String(text)
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

module.exports = new PdfMenuExtractor();
