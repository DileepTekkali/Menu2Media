const axios = require('axios');
const cheerio = require('cheerio');
const pdfMenuExtractor = require('./pdfMenuExtractor');
const ocrMenuExtractor = require('./ocrMenuExtractor');

class ScraperService {
  async scrapeMenu(restaurantUrl) {
    try {
      if (this.isPdfUrl(restaurantUrl)) {
        return await pdfMenuExtractor.extractFromUrl(restaurantUrl);
      }
      if (this.isImageUrl(restaurantUrl)) {
        const text = await ocrMenuExtractor.extractFromImageUrl(restaurantUrl);
        const items = pdfMenuExtractor.parseTextMenu(text);
        return { success: items.length > 0, items, total: items.length, method: 'ocr_direct' };
      }

      let response;
      try {
        response = await axios.get(restaurantUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
          },
          timeout: 30000,
          maxRedirects: 5
        });
      } catch (axiosError) {
        if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
          console.log(`Timeout for ${restaurantUrl}, returning empty with fallback`);
          return { success: false, error: 'timeout', items: [], method: 'timeout' };
        }
        if (axiosError.response?.status === 403 || axiosError.response?.status === 503) {
          console.log(`Blocked for ${restaurantUrl}, returning empty with fallback`);
          return { success: false, error: 'blocked', items: [], method: 'blocked' };
        }
        throw axiosError;
      }

      const html = response.data;
      const $ = cheerio.load(html);
      
      // Strategy 1: JSON-LD
      let menuItems = this.parseJsonLd($, restaurantUrl);
      if (menuItems.length >= 3) {
        return { success: true, items: menuItems.slice(0, 100), total: menuItems.length, method: 'json_ld' };
      }

      // Strategy 2: CSS Selectors
      menuItems = this.parseCssSelectors($, restaurantUrl);
      if (menuItems.length >= 5) {
        return { success: true, items: menuItems.slice(0, 100), total: menuItems.length, method: 'css_selectors' };
      }

      // Strategy 3: Discovery (Look for "Menu" links and follow them)
      console.log(`Initial scrape of ${restaurantUrl} found few items, starting discovery...`);
      const discoveredItems = await this.discoverAndScrapeMenuLinks($, restaurantUrl);
      if (discoveredItems.length > 0) {
        menuItems = [...menuItems, ...discoveredItems];
      }

      // Final fallbacks if discovery yielded few results
      if (menuItems.length < 5) {
        menuItems = [...menuItems, ...this.parseListItems($, restaurantUrl)];
        menuItems = [...menuItems, ...this.parseTextContent($, restaurantUrl)];
        menuItems = [...menuItems, ...(await this.parseImageLinks($, restaurantUrl))];
      }

      // Deduplicate
      const seen = new Set();
      menuItems = menuItems.filter(item => {
        const key = item.name.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return {
        success: menuItems.length > 0,
        items: menuItems.slice(0, 100),
        total: menuItems.length,
        method: 'combined_discovery'
      };
    } catch (error) {
      console.error('Scraping error:', error.message);
      return { success: false, error: error.message, items: [] };
    }
  }

  async discoverAndScrapeMenuLinks($, baseUrl) {
    const menuLinks = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (!href || href === '#' || href.startsWith('javascript:')) return;
      
      if (/menu/i.test(text) || /menu/i.test(href)) {
        const fixed = this.fixImageUrl(href, baseUrl);
        if (fixed.startsWith('http') && !fixed.includes('#')) {
          menuLinks.push(fixed);
        }
      }
    });

    const uniqueLinks = [...new Set(menuLinks)].filter(link => link !== baseUrl && !link.includes('logout'));
    const allItems = [];
    
    for (const link of uniqueLinks.slice(0, 4)) {
      try {
        console.log(`Visiting discovered link: ${link}`);
        const response = await axios.get(link, { timeout: 20000 });
        const sub$ = cheerio.load(response.data);
        
        // Try all sub-page strategies
        const pdfItems = await this.parsePdfLinks(sub$, link);
        if (pdfItems.length > 0) allItems.push(...pdfItems);

        const cssItems = this.parseCssSelectors(sub$, link);
        if (cssItems.length > 0) allItems.push(...cssItems);

        const listItems = this.parseListItems(sub$, link);
        if (listItems.length > 0) allItems.push(...listItems);

        if (allItems.length > 30) break;
      } catch (e) {
        console.error(`Error scraping discovered link ${link}:`, e.message);
      }
    }
    return allItems;
  }

  async parsePdfLinks($, baseUrl) {
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && this.isPdfUrl(href)) {
        links.push(this.fixImageUrl(href, baseUrl));
      }
    });

    const items = [];
    for (const link of [...new Set(links)].slice(0, 3)) {
      try {
        const result = await pdfMenuExtractor.extractFromUrl(link);
        if (result.success) items.push(...result.items);
      } catch (e) {}
    }
    return items;
  }

  async parseImageLinks($, baseUrl) {
    const images = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      const alt = $(el).attr('alt') || '';
      if (src && (/menu/i.test(alt) || /menu/i.test(src))) {
        images.push(this.fixImageUrl(src, baseUrl));
      }
    });

    const items = [];
    for (const imgUrl of [...new Set(images)].slice(0, 3)) {
      try {
        const text = await ocrMenuExtractor.extractFromImageUrl(imgUrl);
        const ocrItems = pdfMenuExtractor.parseTextMenu(text);
        if (ocrItems.length > 0) items.push(...ocrItems);
      } catch (e) {}
    }
    return items;
  }

parseCssSelectors($, baseUrl) {
    const items = [];
    
    // Target heading elements for menu items
    $('h2, h3').each((i, el) => {
      try {
        const $el = $(el);
        const name = $el.text().trim();
        
        // Skip noise, generic, or very long names
        if (!name || name.length < 3 || name.length > 80) return true;
        if (this.isNoise(name)) return true;
        
        // Get parent container
        const parent = $el.parent();
        if (!parent || parent.length === 0) return true;
        
        const parentText = parent.text() || '';
        const priceMatch = parentText.match(/\$[\d,.]+/);
        
        // Extract description
        let description = parent.find('p').first().text().trim();
        
        items.push({
          name: this.cleanText(name),
          price: priceMatch ? this.extractPrice(priceMatch[0]) : 0,
          description: this.cleanText(description),
          image_url: this.fixImageUrl(parent.find('img').first().attr('src'), baseUrl),
          category: 'Menu'
        });
      } catch (e) { return true; }
    });

    // Generic selectors as fallback
    if (items.length < 3) {
      const selectors = ['.menu-item', '.dish-item', '.food-item', '.product-item', '.food-card'];
      for (const selector of selectors) {
        $(selector).each((i, el) => {
          const $el = $(el);
          let name = $el.find('h2, h3, h4, .title, .name, strong').first().text().trim();
          if (!name || this.isNoise(name)) {
            name = $el.clone().children().remove().end().text().trim().split('\n')[0].trim();
          }
          if (name && name.length < 100 && !this.isNoise(name)) {
            const price = $el.find('.price, [class*="price"]').first().text().trim() || '';
            items.push({
              name: this.cleanText(name),
              price: this.extractPrice(price),
              description: this.cleanText($el.find('p, .description').first().text()),
              image_url: this.fixImageUrl($el.find('img').first().attr('src'), baseUrl),
              category: 'Menu'
            });
          }
        });
      }
    }
    
    return items;
  }

  parseListItems($, baseUrl) {
    const items = [];
    
    // Look for common patterns in paragraphs or list items (e.g., Fratellinos style)
    $('p, li, div.et_pb_text_inner').each((i, el) => {
      const $el = $(el);
      const text = $el.text();
      
      // Pattern: Dish Name .... $12.95 or Dish Name $12.95 or ₹250
      const priceMatch = text.match(/(?:(?:\$|₹|Rs\.?|INR)\s*)?(\d{1,3}(?:,\d{3})*\.\d{2})(?:\s|$)/i);
      let detectedCurrency = '';
      if (priceMatch && priceMatch[0]) {
        if (priceMatch[0].includes('₹') || priceMatch[0].includes('Rs') || priceMatch[0].includes('INR')) {
          detectedCurrency = 'INR';
        } else if (priceMatch[0].includes('$') && !priceMatch[0].includes('A$') && !priceMatch[0].includes('S$')) {
          detectedCurrency = 'USD';
        }
      }
      
      if (priceMatch) {
        // If there's a <strong> inside, it's likely the name
        let name = $el.find('strong').first().text().trim();
        
        // If no strong, take the text before the price
        if (!name) {
          name = text.split(priceMatch[0])[0].trim()
            .replace(/[.\-\s_]{2,}/g, ' ')
            .replace(/[.:-]+$/, '')
            .split('\n').pop().trim();
        }
        
        if (name && name.length >= 3 && name.length < 100 && !this.isNoise(name)) {
          items.push({
            name: this.cleanText(name),
            price: parseFloat(priceMatch[1].replace(/,/g, '')),
            currency: detectedCurrency,
            description: '',
            image_url: '',
            category: 'Menu'
          });
        }
      }
    });
    
    return items;
  }

  parseTextContent($, baseUrl) {
    const items = [];
    
    // Target grid-item and similar structures with descriptions containing prices
    $('.grid-item, .menu-item, .food-item, .dish-item, li[class*="item"]').each((i, el) => {
      const $el = $(el);
      const fullText = $el.text();
      
      // Match price anywhere in the item text
      const priceMatch = fullText.match(/\$[\d,.]+/);
      if (!priceMatch) return;
      
      // Try to get name from heading
      let name = $el.find('h2, h3, h4, .title, .name').first().text().trim();
      
      // If no heading, try alt text from images
      if (!name) {
        const imgAlt = $el.find('img').first().attr('alt');
        if (imgAlt) name = imgAlt;
      }
      
      // If still no name, derive from text before price
      if (!name) {
        name = fullText.split('$')[0].trim().split('\n').pop().trim();
      }
      
      if (name && name.length >= 3 && name.length < 80 && !this.isNoise(name)) {
        const description = $el.find('p').first().text().trim();
        
        items.push({
          name: this.cleanText(name),
          price: this.extractPrice(priceMatch[0]),
          description: this.cleanText(description),
          image_url: this.fixImageUrl($el.find('img').first().attr('src'), baseUrl),
          category: 'Menu'
        });
      }
    });
    
    return items;
  }

  isPdfUrl(url) { return /\.pdf(?:$|\?)/i.test(url || ''); }
  isImageUrl(url) { return /\.(png|jpg|jpeg|webp)(?:$|\?)/i.test(url || ''); }

  parseJsonLd($, baseUrl) {
    const items = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const schemas = Array.isArray(data) ? data : [data];
        for (const schema of schemas) {
          if (schema.hasMenu) this.extractFromMenuSchema(schema.hasMenu, items);
          if (schema['@type'] === 'Menu') this.extractFromMenuSchema(schema, items);
        }
      } catch (e) {}
    });
    return items;
  }

  extractFromMenuSchema(menu, items) {
    const sections = menu.hasMenuSection || (Array.isArray(menu) ? menu : []);
    const walk = (section) => {
      const entries = section.hasMenuItem || section.hasMenuSection || [];
      for (const entry of (Array.isArray(entries) ? entries : [entry])) {
        if (entry.hasMenuSection) walk(entry);
        else if (entry.name) {
          items.push({
            name: this.cleanText(entry.name),
            price: entry.offers?.price ? parseFloat(entry.offers.price) : 0,
            description: this.cleanText(entry.description || ''),
            image_url: entry.image || '',
            category: 'Menu'
          });
        }
      }
    };
    if (Array.isArray(sections)) sections.forEach(s => walk(s));
  }

  cleanText(text) { return (text || '').replace(/\s+/g, ' ').trim(); }

  fixImageUrl(imageUrl, baseUrl) {
    if (!imageUrl || imageUrl.startsWith('data:')) return '';
    try { return new URL(imageUrl, baseUrl).href; } catch { return imageUrl; }
  }

  isNoise(text) {
    const lower = text.toLowerCase().trim();
    const noise = [
      'menu', 'home', 'contact', 'about', 'cart', 'order', 'login', 'signup', 'page',
      'tel', 'phone', 'icon', 'chevron', 'arrow', 'bag', 'search', 'email', 'user',
      'account', 'hamburger', 'x', 'close', 'open', 'read more', 'click here', 'learn more',
      'discover', 'explore', 'gallery', 'welcome', 'follow us', 'facebook', 'instagram',
      'youtube', 'twitter', 'tiktok', 'locations', 'reservations', 'catering', 'gift card',
      'rewards', 'privacy', 'terms', 'policy', 'copyright', 'all rights', 'sitemap',
      'facebook page', 'instagram page', 'opens in new', 'order now', 'delivering',
      'shop', 'merch', 'rewards', 'what people', 'we are different', 'we deliver',
      'address', 'street', 'avenue', 'blvd', 'boulevard', 'suite', 'floor', 'building',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'hours', 'am', 'pm', 'minute', 'pickup', 'takeout',
      'minimize', 'maximize', 'fullscreen', 'print', 'share', 'view', 'map', 'directions',
      'get directions', 'call now', 'send message', 'book now', 'reserve', 'order online',
      'pricing', 'shipping', 'catering', 'rewards', 'merch',
      'location details', 'location info', 'our hours', 'contact', 'faq', 'frequently asked',
      'accepted payments', 'nearby neighborhoods', 'available by the slice', 'available in gluten-free',
      'our recipes', 'original location', 'slice shop', 'lunch', 'dinner', 'late night',
      'whole pie', 'slices', 'click to expand', 'collapsed', 'new york', 'los angeles'
    ];
    
    const usStates = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming'];
    
    if (lower.length < 3 || lower.length > 60) return true;
    if (noise.some(n => lower === n || lower.includes(n))) return true;
    if (/^[a-z\s]{3,15}$/i.test(lower)) return true;
    if (/^(our|my|the|your|buy|get|go|see|find)[a-z\s]{0,10}$/i.test(lower)) return true;
    if (/[0-9]{4,}/.test(lower)) return true;
    if (/\b\d{5}(-\d{4})?\b/.test(lower)) return true;
    if (/\b\d+\s+\w+\s+(st|ave|rd|dr|blvd|way|ln|ct|pl)\b/i.test(lower)) return true;
    
    // Filter US city/state names (all caps navigation items)
    if (lower === lower.toUpperCase() && lower.length < 20) {
      if (usStates.some(s => lower.includes(s))) return true;
    }
    
    return false;
  }

  extractPrice(priceString) {
    if (!priceString) return 0;
    const match = priceString.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
  }

  parseRegexPricePatterns(html) {
    const items = [];
    try {
      const priceRegex = /(?:(?:\$|₹|Rs\.?|INR)\s*)?(\d{1,3}(?:,\d{3})*\.\d{2})(?:\s|$)/gi;
      const lines = html.split(/<p[^>]*>|<\/p>|<li[^>]*>|<\/li>|<div[^>]*>|<\/div>/i);
      
      for (const line of lines) {
        const match = priceRegex.exec(line);
        if (match && match[1]) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          const text = (line || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const name = text.split('$')[0].split('₹')[0].trim();
          
          if (name && name.length >= 3 && name.length < 100 && !this.isNoise(name)) {
            items.push({
              name: this.cleanText(name),
              price,
              description: '',
              image_url: '',
              category: 'Menu'
            });
          }
        }
      }
    } catch (e) {
      console.warn('parseRegexPricePatterns error:', e.message);
    }
    return items;
  }
}

module.exports = new ScraperService();
