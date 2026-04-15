const { chromium } = require('playwright-core');
const Groq = require('groq-sdk');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

class IntelligentScraper {
  constructor() {
    this.foodKeywords = [
      'chicken', 'beef', 'pork', 'lamb', 'fish', 'shrimp', 'salmon', 'tofu', 'paneer',
      'veg', 'vegetarian', 'vegan', 'biryani', 'curry', 'tandoor', 'grill', 'roast',
      'pizza', 'pasta', 'burger', 'sandwich', 'wrap', 'salad', 'soup', 'rice', 'noodle',
      'lasagna', 'risotto', 'steak', 'ribs', 'wings', 'fries', 'sides',
      'dessert', 'cake', 'ice cream', 'coffee', 'tea', 'drink', 'beverage', 'shake',
      'breakfast', 'lunch', 'dinner', 'brunch', 'appetizer', 'entree', 'main', 'side',
      'taco', 'burrito', 'quesadilla', 'kebab', 'gyro', 'dumpling', 'sushi', 'ramen',
      'pho', 'pad thai', 'masala', 'tikka', 'balti', 'vindaloo', 'korma', 'sauce',
      'mozzarella', 'pepperoni', 'garlic', 'basil', 'ricotta', 'romano', 'cheese',
      'corn', 'chopped', 'sticks', 'bread', 'caesar', 'italian', 'chocolate', 'cookie',
      'cheesecake', 'cake', 'rainbow'
    ];

    this.noisePatterns = [
      { pattern: /^menu$/i, label: 'menu' },
      { pattern: /^home$/i, label: 'home' },
      { pattern: /^contact$/i, label: 'contact' },
      { pattern: /^about$/i, label: 'about' },
      { pattern: /^locations?$/i, label: 'location' },
      { pattern: /^order$/i, label: 'order' },
      { pattern: /^catering$/i, label: 'catering' },
      { pattern: /^rewards$/i, label: 'rewards' },
      { pattern: /^merch$/i, label: 'merch' },
      { pattern: /^faq$/i, label: 'faq' },
      { pattern: /^shipping$/i, label: 'shipping' },
      { pattern: /^pricing$/i, label: 'pricing' },
      { pattern: /location|address|hours|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i, label: 'location' },
      { pattern: /our hours|accepted payments|original location|slice shop/i, label: 'location' },
      { pattern: /get directions|call now|order online/i, label: 'nav' },
      { pattern: /copyright|all rights/i, label: 'footer' },
      { pattern: /^\s*\$?\s*\d+\s*(?:slice|piece|piece)/i, label: 'quantity' }
    ];

    this.locationNames = [
      'chicago', 'costa mesa', 'dallas', 'downtown', 'las vegas', 'malibu',
      'miami', 'new york', 'pasadena', 'san diego', 'toronto', 'venice',
      'houston', 'mercer', 'tempe', 'serene', 'charlotte', 'brooklyn',
      'west hollywood', 'westlake village', 'knox henderson', 'pacific beach', 'gaslamp'
    ];
  }

  async scrapeMenu(url) {
    let browser;
    try {
      browser = await chromium.launch({
        executablePath: this.defaultChromePath(),
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--disable-features=TranslateUI'
        ]
      });

      const page = await browser.newPage();
      
      // Block unnecessary resources
      await page.route('**/*', route => {
        const type = route.request().resourceType();
        if (['image', 'font', 'media', 'stylesheet', 'websocket'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);

      await this.clickMenuButton(page);

      const menuItems = await this.extractAllMenuItems(page);
      console.log(`Extracted ${menuItems.length} menu items`);

      // Filter using Groq AI to remove non-food items
      let filteredItems = menuItems;
      if (menuItems.length > 0 && groq) {
        try {
          filteredItems = await this.filterWithGroq(menuItems);
          console.log(`Groq filtered to ${filteredItems.length} food items`);
        } catch (e) {
          console.log('Groq filter failed, using heuristic filter:', e.message);
          filteredItems = this.heuristicFilter(menuItems);
        }
      } else {
        filteredItems = this.heuristicFilter(menuItems);
      }

      await browser.close();
      browser = null;

      return {
        success: filteredItems.length > 0,
        items: filteredItems.slice(0, 100),
        total: filteredItems.length,
        method: 'intelligent_heuristic'
      };

    } catch (error) {
      console.error('Intelligent scraper error:', error.message);
      return { success: false, error: error.message, items: [] };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  async clickMenuButton(page) {
    const selectors = [
      'a:has-text("MENU")',
      'button:has-text("MENU")',
      'a[href*="menu"]',
      '[role="tab"]:has-text("Menu")'
    ];

    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        for (const el of elements) {
          const text = await el.innerText().catch(() => '');
          if (/^\s*MENU\s*$/i.test(text?.trim() || '')) {
            console.log(`Clicking MENU: ${selector}`);
            await el.click().catch(() => {});
            await page.waitForTimeout(1000);
            return;
          }
        }
      } catch (e) {}
    }

    try {
      await page.click('text="MENU"', { timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(1000);
    } catch (e) {}
  }

  async extractAllMenuItems(page) {
    const noisePatterns = this.noisePatterns.map(np => np.pattern.source);
    const locationNames = this.locationNames;
    
    return await page.evaluate(({ noisePatterns, locationNames }) => {
      const items = [];
      const seen = new Set();
      
      const isNoise = (name) => {
        const lower = name.toLowerCase().trim();
        for (const pattern of noisePatterns) {
          if (new RegExp(pattern, 'i').test(lower)) return true;
        }
        for (const loc of locationNames) {
          if (lower === loc || lower.includes(loc + ' ')) return true;
        }
        if (name === name.toUpperCase() && name.length < 20 && /^[A-Z\s]+$/.test(name)) {
          return true;
        }
        return false;
      };
      
      const cleanText = (text) => (text || '').replace(/\s+/g, ' ').trim();

      // Strategy 1: Extract from headings
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      
      headings.forEach(heading => {
        if (!heading || !heading.innerText) return;
        let name = heading.innerText.trim();
        if (!name || name.length < 2 || name.length > 100) return;
        
        name = name.replace(/\s*\n\s*/g, ' ').trim();
        if (isNoise(name)) return;

        let price = 0;
        try {
          const parent = heading.closest('section, article, div, li') || heading.parentElement;
          const parentText = (parent && parent.innerText) ? parent.innerText : '';
          const priceMatch = parentText.match(/[\$₹€£¥]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
          if (priceMatch) {
            price = parseFloat(priceMatch[1].replace(/,/g, ''));
          }
        } catch(e) {}

        let description = '';
        try {
          let nextEl = heading.nextElementSibling;
          if (nextEl && nextEl.tagName && !['H1','H2','H3','H4','H5','H6'].includes(nextEl.tagName)) {
            const nextText = (nextEl.innerText || '').trim();
            if (nextText.length > 0 && nextText.length < 200 && !/[\$₹€£¥]/.test(nextText)) {
              description = nextText.replace(/\s*\n\s*/g, ' ').trim();
            }
          }
        } catch(e) {}

        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            name: cleanText(name),
            price,
            description: cleanText(description),
            category: 'Menu'
          });
        }
      });

      // Strategy 2: Extract from paragraphs/list items with prices
      // Pattern: Item Name $price or Item Name ... $price
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n');
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 3 || trimmed.length > 150) return;
        
        // Skip lines that look like descriptions (start with lowercase, prepositions, conjunctions)
        if (/^(with|and|or|for|from|served|served with|choice of|add|allow|includes|includes |topped)/i.test(trimmed)) return;
        
        // Match: "Item Name $12.34" or "Item Name ... $12.34"
        const match = trimmed.match(/^([A-Za-z][A-Za-z0-9\s&'™®.,()-]+?)\s*[.:\-…]*\s*\$(\d+\.\d{2})\s*$/);
        if (match) {
          let name = match[1].trim();
          const price = parseFloat(match[2]);
          
          // Clean up name - remove trailing punctuation
          name = name.replace(/[.:\-…]+$/, '').trim();
          
          // Also clean up common patterns like "Topped with X"
          name = name.replace(/\s+Topped with.+$/i, '');
          
          // Skip if name is too short, too long, or looks like description
          if (!name || name.length < 3 || name.length > 80) return;
          if (isNoise(name)) return;
          
          // Skip if name is mostly numbers or special chars
          if (!/^[A-Za-z]/.test(name)) return;
          
          const key = name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            items.push({
              name: cleanText(name),
              price,
              description: '',
              category: 'Menu'
            });
          }
        }
        
        // Also match: "Name $12.34" on same line (no dots before price)
        const inlineMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9\s&'™®.,()-]+?)\s+\$(\d+\.\d{2})\s*$/);
        if (inlineMatch) {
          let name = inlineMatch[1].trim();
          const price = parseFloat(inlineMatch[2]);
          
          if (name && name.length > 2 && name.length < 80 && !isNoise(name)) {
            if (!/^[A-Za-z]/.test(name)) return;
            const key = name.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              items.push({
                name: cleanText(name),
                price,
                description: '',
                category: 'Menu'
              });
            }
          }
        }
      });

      return items;
    }, { noisePatterns, locationNames });
  }

  async filterWithGroq(items) {
    // Use heuristic filter as primary (works well)
    const heuristicFiltered = this.heuristicFilter(items);
    
    // Use Groq only for additional quality check on already filtered items
    if (!groq || heuristicFiltered.length === 0) return heuristicFiltered;

    const itemNames = heuristicFiltered.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n');

    try {
      const completion = await Promise.race([
        groq.chat.completions.create({
          messages: [{
            role: 'user',
            content: `Review this restaurant menu. Remove only obvious NON-food items.

Menu items:
${itemNames}

Remove ONLY these types:
- Navigation/headers: "Menu", "Home", "Locations", "Order", "Contact", "About"
- Category names: "Small Plates", "Grills", "Breads", "Drinks", "Desserts"
- Location names: "Our Cafés", "Battersea", "King's Cross"
- Genericpromos: "Most Loved", "Discover", "Visit Us", "Follow Us"

Keep ALL actual food dishes like "Chicken Tikka", "Biryani", "Naan", "Curry", etc.

Return JSON array of NUMBERS to REMOVE (empty array [] to keep all):`
          }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          max_tokens: 200
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]);

      const responseText = completion.choices[0]?.message?.content?.trim() || '[]';
      
      // Parse JSON array
      const numbers = responseText.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        const toRemove = new Set(numbers.map(n => parseInt(n) - 1));
        return heuristicFiltered.filter((_, idx) => !toRemove.has(idx));
      }
      
      return heuristicFiltered;
    } catch (error) {
      console.log('Groq filter error:', error.message);
      return heuristicFiltered;
    }
  }

  heuristicFilter(items) {
    const nonFoodPatterns = [
      /^menu$/i, /^home$/i, /^contact$/i, /^about$/i, /^order$/i,
      /^catering$/i, /^rewards$/i, /^merch$/i, /^faq$/i, /^shipping$/i,
      /^reservations$/i, /^locations?$/i, /^our cafés$/i, /^permit rooms$/i,
      /^select a menu$/i, /^all day$/i, /^breakfast$/i, /^lunch$/i, /^dinner$/i,
      /^discover/i, /^visit us$/i, /^shop/i, /^follow us/i, /^most loved$/i,
      /^cake$/i, /^desserts$/i, /^drinks$/i, /^bread$/i, /^salads?$/i,
      /^grills$/i, /^small plates$/i, /^biryani and rice$/i, /^veg\.? side/i,
      /^cafe support$/i, /^store support$/i, /^group bookings$/i,
      /^delivery$/i, /^collection$/i, /^group feast$/i, /^children$/i, /^vegan$/i,
      /select a menu/i, /our menus/i, /café support/i, /store support/i,
      /^battersea|^carnaby|^covent|^kensington|^king|^shoreditch/i
    ];

    const foodIndicators = [
      'chicken', 'beef', 'lamb', 'pork', 'fish', 'shrimp', 'salmon', 'paneer',
      'biryani', 'curry', 'pizza', 'pasta', 'burger', 'salad', 'soup', 'rice',
      'naan', 'roti', 'tikka', 'masala', 'tandoor', 'garlic', 'mozzarella',
      'cheese', 'pepperoni', 'margherita', 'caesar', 'chai', 'tea', 'coffee',
      'samosa', 'kebab', 'dumpling', 'noodle', 'sandwich', 'wrap', 'taco',
      'wings', 'ribs', 'steak', 'cake', 'cookie', 'ice cream', 'cheesecake',
      'lasagna', 'risotto', 'alfredo', 'marinara', 'vellore', 'special'
    ];

    return items.filter(item => {
      const name = item.name.toLowerCase().trim();
      
      // Remove obvious non-food
      if (nonFoodPatterns.some(p => p.test(name))) return false;
      
      // Remove if too short (likely navigation)
      if (name.length < 4) return false;
      
      // Remove all-caps short items (likely headers)
      if (name === name.toUpperCase() && name.length < 20) return false;
      
      // Keep if has food indicator
      if (foodIndicators.some(f => name.includes(f))) return true;
      
      // Keep if has price (likely food item)
      if (item.price > 0) return true;
      
      // Remove if has words like "menu", "select", "our", "visit"
      if (/^(our|visit|select|discover|the|all)/i.test(name)) return false;
      
      // Remove location-like patterns
      if (/café|cafes|rooms|location/i.test(name)) return false;
      
      // Default: keep it (will be filtered by Groq on next run)
      return true;
    });
  }

  cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  defaultChromePath() {
    if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
    if (process.platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }
    if (process.platform === 'linux') {
      return '/usr/bin/google-chrome';
    }
    return null;
  }
}

module.exports = new IntelligentScraper();
