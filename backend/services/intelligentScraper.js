const { chromium } = require('playwright-core');
const Groq = require('groq-sdk');

const groqApiKey = process.env.GROQ_API_KEY;
const hasValidGroq = groqApiKey && !groqApiKey.includes('xxx') && !groqApiKey.includes('your_groq');
const groq = hasValidGroq ? new Groq({ apiKey: groqApiKey }) : null;

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
      
      // Block unnecessary resources (but keep some images for logo extraction)
      await page.route('**/*', route => {
        const type = route.request().resourceType();
        if (['media', 'font', 'websocket'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      // Extract Restaurant Branded Info
      const restaurantInfo = await this.extractRestaurantBranding(page);
      console.log('Extracted Branding:', restaurantInfo);

      // Try selecting location first to get actual prices
      await this.selectLocation(page);

      // Click menu button if needed
      await this.clickMenuButton(page);

      // Scroll to trigger lazy loading
      await this.scrollToLoadContent(page);

      // Wait for dynamic prices to load
      await page.waitForTimeout(2000);

      // Try navigating through categories
      let categoryItems = [];
      console.log('Attempting to navigate through menu categories...');
      try {
        categoryItems = await this.navigateAndScrapeCategories(page);
        console.log(`Found ${categoryItems.length} items from category navigation`);
      } catch (e) {
        console.log('Category navigation error:', e.message);
      }

      const menuItems = await this.extractAllMenuItems(page);
      
      // Merge and De-duplicate
      const allExtracted = [...menuItems, ...categoryItems];
      const uniqueItems = [];
      const seenNames = new Set();
      
      for (const item of allExtracted) {
        const key = `${item.name.toLowerCase()}|${item.category?.toLowerCase() || 'menu'}`;
        if (!seenNames.has(key)) {
          seenNames.add(key);
          uniqueItems.push(item);
        }
      }
      console.log(`Extracted total: ${allExtracted.length}, Unique: ${uniqueItems.length}`);

      // Filter using Groq AI to remove non-food items
      let filteredItems = uniqueItems;
      if (uniqueItems.length > 0 && groq) {
        try {
          filteredItems = await this.filterWithGroq(uniqueItems);
          console.log(`Groq filtered to ${filteredItems.length} food items`);
        } catch (e) {
          console.log('Groq filter failed, using heuristic filter:', e.message);
          filteredItems = this.heuristicFilter(uniqueItems);
        }
      } else {
        filteredItems = this.heuristicFilter(uniqueItems);
      }

      await browser.close();
      browser = null;

      return {
        success: filteredItems.length > 0,
        items: filteredItems.slice(0, 100),
        total: filteredItems.length,
        method: 'intelligent_heuristic',
        restaurantName: restaurantInfo.name,
        logoUrl: restaurantInfo.logoUrl
      };

    } catch (error) {
      console.error('Intelligent scraper error:', error.message);
      return { success: false, error: error.message, items: [] };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  async extractRestaurantBranding(page) {
    return await page.evaluate(() => {
      // 1. Extract Name
      let name = '';
      
      // Try meta tags first
      const ogTitle = document.querySelector('meta[property="og:site_name"]')?.content || 
                    document.querySelector('meta[property="og:title"]')?.content;
      
      if (ogTitle) name = ogTitle.split('|')[0].split('-')[0].trim();
      
      if (!name || name.length < 3) {
        // Try h1 with logo or brand class
        const h1 = document.querySelector('h1');
        if (h1 && h1.innerText.length < 50) name = h1.innerText.trim();
      }
      
      if (!name || name.length < 3) {
        name = document.title.split('|')[0].split('-')[0].trim();
      }

      // 2. Extract Logo
      let logoUrl = '';
      const logoSelectors = [
        'img[src*="logo" i]',
        'img[class*="logo" i]',
        'img[id*="logo" i]',
        'a[class*="logo" i] img',
        '.navbar-brand img',
        '.header-logo img'
      ];

      for (const selector of logoSelectors) {
        const img = document.querySelector(selector);
        if (img && img.src && img.src.startsWith('http')) {
          logoUrl = img.src;
          break;
        }
      }

      if (!logoUrl) {
        // Try og:image
        logoUrl = document.querySelector('meta[property="og:image"]')?.content || '';
      }

      if (!logoUrl) {
        // Try shortcut icon
        logoUrl = document.querySelector('link[rel*="icon"]')?.href || '';
      }

      return { name, logoUrl };
    });
  }

  async selectLocation(page) {
    const locationSelectors = [
      '[class*="location"]',
      '[id*="location"]',
      'select[name*="location"]',
      'select[id*="city"]',
      'select[class*="city"]',
      '[data-location]',
      '[class*="branch"]',
      '[id*="branch"]'
    ];
    
    for (const selector of locationSelectors) {
      try {
        const select = await page.$(selector);
        if (select) {
          const tagName = await select.evaluate(el => el.tagName);
          if (tagName === 'SELECT') {
            const options = await select.$$('option');
            if (options.length > 1) {
              // Select a valid location (skip "Select location" placeholder)
              const option = await page.evaluateHandle(sel => {
                const opts = sel.querySelectorAll('option');
                for (const opt of opts) {
                  if (opt.value && opt.value.length > 0 && !opt.textContent.toLowerCase().includes('select')) {
                    return opt.value;
                  }
                }
                return null;
              }, select);
              
              if (option) {
                await select.selectOption(option);
                await page.waitForTimeout(2000);
                console.log('Location selected to get actual prices');
                return;
              }
            }
          }
        }
      } catch (e) {}
    }
    
    // Try clicking location button and selecting from dropdown
    try {
      const locationButtons = await page.$$('button:has-text("Location"), a:has-text("Location")');
      for (const btn of locationButtons.slice(0, 2)) {
        await btn.click();
        await page.waitForTimeout(1000);
        
        const dropdownOptions = await page.$$('[class*="option"], [class*="item"], ul li');
        for (const opt of dropdownOptions.slice(0, 10)) {
          const text = await opt.innerText().catch(() => '');
          if (text && text.length > 2 && text.length < 50) {
            await opt.click();
            await page.waitForTimeout(1500);
            console.log('Selected location:', text.trim());
            return;
          }
        }
      }
    } catch (e) {}
  }

  async scrollToLoadContent(page) {
    try {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 0.5);
        });
        await page.waitForTimeout(500);
      }
      
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
    } catch (e) {}
  }

  async clickItemsToRevealPrices(page) {
    try {
      const itemSelectors = [
        '[class*="menu-item"]',
        '[class*="product-item"]',
        '[class*="dish-item"]',
        '[class*="food-item"] li',
        'ul li[class*="item"]'
      ];
      
      for (const selector of itemSelectors) {
        const items = await page.$$(selector);
        
        // Parallelize clicks for performance (max 5 at a time)
        const batch = items.slice(0, 10);
        await Promise.all(batch.map(async (item) => {
          try {
            await item.click({ delay: 50 });
            // Wait briefly for UI update
            await new Promise(r => setTimeout(r, 600));
            // Close any modal that might have opened
            await page.keyboard.press('Escape').catch(() => {});
          } catch (e) {}
        }));
      }
    } catch (e) {}
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
    
    // Try clicking some items to reveal prices in modals
    await this.clickItemsToRevealPrices(page);
    
    return await page.evaluate(({ noisePatterns, locationNames }) => {
      const items = [];
      const seen = new Set();
      let currentCategory = 'Menu';
      
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
      
      const isCategoryHeader = (name) => {
        const lower = name.toLowerCase().trim();
        const categoryWords = [
          'starters', 'appetizers', 'mains', 'main course', 'main dishes', 'entrees',
          'desserts', 'sweet', 'sweets', 'drinks', 'beverages', 'cocktails', 'mocktails',
          'sides', 'side dishes', 'bread', 'breads', 'soups', 'salads',
          'breakfast', 'lunch', 'dinner', 'brunch', 'combos', 'combos',
          'grills', 'tandoor', 'biryani', 'rice', 'curry', 'veg', 'non-veg',
          'veg items', 'non-veg items', 'special', 'specials', 'chef\'s special',
          'street food', 'chaat', 'snacks', 'fast food', 'desserts & drinks'
        ];
        return categoryWords.some(cat => lower === cat || lower.includes(cat + 's') || lower.includes(' ' + cat));
      };
      
      const cleanText = (text) => (text || '').replace(/\s+/g, ' ').trim();

      // Get all headings and their hierarchy
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="category"], [class*="section"], [class*="heading"]');
      
      // Also get items from common menu item selectors
      const menuItemSelectors = [
        '[class*="menu-item"]',
        '[class*="dish-item"]',
        '[class*="product-item"]',
        '[class*="food-item"]',
        '[class*="prices-item"]',
        'p.p-maintext:not(.p-title)',
        '[class*="menu-list"] li',
        '[class*="item"]'
      ];
      
      // Collect menu items from various selectors
      menuItemSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (!el || !el.innerText) return;
            let name = el.innerText.trim();
            if (!name || name.length < 3 || name.length > 150) return;
            
            // Skip category titles
            if (el.classList && el.classList.contains('p-title')) return;
            
            name = name.replace(/\s*\n\s*/g, ' ').trim();
            
            // Skip if already in items
            if (items.some(i => i.name.toLowerCase() === name.toLowerCase())) return;
            
            // Check if this is a category
            if (isCategoryHeader(name)) {
              currentCategory = cleanText(name);
              return;
            }
            
            if (isNoise(name)) return;
            
            // Try to get description
            let description = '';
            const descEl = el.querySelector('[class*="subtext"], [class*="description"], [class*="desc"]');
            if (descEl) {
              description = descEl.innerText.trim();
            }
            
            // Try to get price
            let price = 0;
            
            // Try data attributes first
            const dataPrice = el.getAttribute('data-price') || el.getAttribute('data-price-amount');
            if (dataPrice) {
              price = parseFloat(dataPrice.replace(/,/g, ''));
            }
            
            // Try regular text price patterns
            if (!price) {
              const priceMatch = el.innerText.match(/[\$₹€£¥]\s*(\d+(?:[.,]\d+)?)/);
              if (priceMatch) {
                price = parseFloat(priceMatch[1].replace(/,/g, ''));
              }
            }
            
            // Try plain number (some sites show just digits)
            if (!price) {
              const plainMatch = el.innerText.match(/(?:Rs\.?|INR|USD|EUR|GBP)?\s*(\d{2,4}(?:[.,]\d{2})?)\s*(?:\/|per)/i);
              if (plainMatch) {
                price = parseFloat(plainMatch[1].replace(/,/g, ''));
              }
            }
            
            items.push({
              name: cleanText(name),
              price,
              description: cleanText(description),
              category: currentCategory
            });
          });
        } catch(e) {}
      });
      
      headings.forEach(heading => {
        if (!heading || !heading.innerText) return;
        let name = heading.innerText.trim();
        if (!name || name.length < 2 || name.length > 100) return;
        
        name = name.replace(/\s*\n\s*/g, ' ').trim();
        
        // Check if this is a category header
        if (isCategoryHeader(name)) {
          currentCategory = cleanText(name);
          console.log('Found category:', currentCategory);
          return;
        }
        
        if (isNoise(name)) return;

        let price = 0;
        let description = '';
        let itemCategory = currentCategory;
        
        try {
          const parent = heading.closest('section, article, div, li') || heading.parentElement;
          const parentText = (parent && parent.innerText) ? parent.innerText : '';
          
          // Try data attributes first
          const dataPrice = parent.getAttribute('data-price') || 
                          parent.querySelector('[data-price]')?.getAttribute('data-price') ||
                          parent.querySelector('[data-price-amount]')?.getAttribute('data-price-amount');
          if (dataPrice) {
            price = parseFloat(dataPrice.replace(/,/g, ''));
          }
          
          // Extract price from text
          if (!price) {
            const priceMatch = parentText.match(/[\$₹€£¥]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
            if (priceMatch) {
              price = parseFloat(priceMatch[1].replace(/,/g, ''));
            }
          }
          
          // Try Indian rupee格式
          if (!price) {
            const inrMatch = parentText.match(/(?:Rs\.?|INR)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
            if (inrMatch) {
              price = parseFloat(inrMatch[1].replace(/,/g, ''));
            }
          }
          
          // Try to get description from next sibling
          let nextEl = heading.nextElementSibling;
          if (nextEl && nextEl.tagName && !['H1','H2','H3','H4','H5','H6'].includes(nextEl.tagName)) {
            const nextText = (nextEl.innerText || '').trim();
            if (nextText.length > 0 && nextText.length < 200 && !/[\$₹€£¥]/.test(nextText)) {
              if (!isCategoryHeader(nextText)) {
                description = nextText.replace(/\s*\n\s*/g, ' ').trim();
              }
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
            category: itemCategory
          });
        }
      });

      // Strategy 2: Extract from paragraphs/list items with prices
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n');
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 3 || trimmed.length > 150) return;
        
        if (/^(with|and|or|for|from|served|served with|choice of|add|allow|includes|includes |topped)/i.test(trimmed)) return;
        
        // Match: "Item Name $12.34"
        const match = trimmed.match(/^([A-Za-z][A-Za-z0-9\s&'™®.,()-]+?)\s*[.:\-…]*\s*\$(\d+\.\d{2})\s*$/);
        if (match) {
          let name = match[1].trim();
          const price = parseFloat(match[2]);
          
          name = name.replace(/[.:\-…]+$/, '').trim();
          name = name.replace(/\s+Topped with.+$/i, '');
          
          if (!name || name.length < 3 || name.length > 80) return;
          if (isNoise(name)) return;
          if (!/^[A-Za-z]/.test(name)) return;
          
          const key = name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            items.push({
              name: cleanText(name),
              price,
              description: '',
              category: currentCategory
            });
          }
        }
        
        // Also match: "Name $12.34"
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
                category: currentCategory
              });
            }
          }
        }
      });

      return items;
    }, { noisePatterns, locationNames });
  }

  async filterWithGroq(items) {
    // Use heuristic filter as primary
    let filtered = this.heuristicFilter(items);
    
    if (!groq || filtered.length === 0) return filtered;

    try {
      const completion = await Promise.race([
        groq.chat.completions.create({
          messages: [{
            role: 'system',
            content: `You are a restaurant menu expert. Your job is to:
1. REMOVE only OBVIOUS non-food items (navigation, headers, locations, promotions)
2. KEEP all food dishes - even if you're unsure, keep it
3. CATEGORIZE items into these categories: "Starters", "Main Course", "Biryani & Rice", "Breads & Sides", "Desserts", "Beverages", "Combos", "Specials"
4. ADD brief descriptions for items missing them

BE LENIENT - When in doubt, KEEP the item. Only remove clearly non-food items.`
          }, {
            role: 'user',
            content: `Analyze this restaurant menu. Remove ONLY these types of non-food items:
- Navigation: "Menu", "Home", "About", "Contact", "Locations", "Order Now", "Cart"
- Headers: "Our Menu", "Browse", "Filter", "Sort"
- Promotions: "Limited Time", "Special Offer", "Buy One Get One"
- Locations: City names, addresses
- Footer links: "Privacy", "Terms", "Careers"

Menu items to analyze:
${filtered.map((item, idx) => `${idx}: "${item.name}" | Category: ${item.category} | Price: ${item.price || 'N/A'}`).join('\n')}

Return ONLY valid JSON with a "refined" array. Each item should have name, category, description, and price:
{"refined": [{"name":"Chicken Tikka","category":"Starters","description":"Tandoor-grilled marinated chicken","price":0},{"name":"Naan Bread","category":"Breads & Sides","description":"Fresh baked flatbread","price":0}]}

If you cannot determine the food items, return ALL items in the "refined" array.`
          }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          max_tokens: 3000,
          response_format: { type: 'json_object' }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000))
      ]);

      const responseText = completion.choices[0]?.message?.content?.trim() || '';
      
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          
          if (result.refined && Array.isArray(result.refined) && result.refined.length > 0) {
            console.log(`Groq refined ${result.refined.length} items`);
            return result.refined.map(item => ({
              name: item.name,
              category: item.category || 'Menu',
              description: item.description || '',
              price: item.price || item.Price || 0
            }));
          }
        }
      } catch (parseError) {
        console.log('Groq JSON parse error:', parseError.message);
      }
      
      // If Groq fails, return heuristic filtered items
      console.log('Groq failed, using heuristic filter results');
      return filtered;
    } catch (error) {
      console.log('Groq error:', error.message);
      return filtered;
    }
  }

  heuristicFilter(items) {
    // Blocked page detection patterns
    const blockedPatterns = [
      /blocked|block/i,
      /access denied/i,
      /challenge/i,
      /cloudflare/i,
      /captcha|recaptcha/i,
      /security check/i,
      /unusual traffic/i,
      /permission denied/i,
      /forbidden/i,
      /please wait/i,
      /verifying/i,
      /ray id/i,
      /error 403/i,
      /datadome/i
    ];

    const nonFoodPatterns = [
      /^menu$/i, /^home$/i, /^contact$/i, /^about$/i, /^order$/i,
      /^catering$/i, /^rewards$/i, /^merch$/i, /^faq$/i, /^shipping$/i,
      /^reservations$/i, /^locations?$/i, /^our cafés$/i, /^permit rooms$/i,
      /^select a menu$/i, /^all day$/i, /^breakfast$/i, /^lunch$/i, /^dinner$/i,
      /^discover/i, /^visit us$/i, /^shop/i, /^follow us$/i, /^most loved$/i,
      /^cake$/i, /^desserts$/i, /^drinks$/i, /^bread$/i, /^salads?$/i,
      /^grills$/i, /^small plates$/i, /^biryani and rice$/i, /^veg\.? side/i,
      /^cafe support$/i, /^store support$/i, /^group bookings$/i,
      /^delivery$/i, /^collection$/i, /^group feast$/i, /^children$/i, /^vegan$/i,
      /select a menu/i, /our menus/i, /café support/i, /store support/i,
      /^battersea|^carnaby|^covent|^kensington|^king|^shoreditch/i,
      /^sorry.*blocked/i, /^you.*unable.*access/i, /^why.*blocked/i, /^what.*do.*resolve/i,
      /gift cards?/i, /franchise/i, /careers?/i, /privacy policy/i, /terms.*conditions/i,
      /accessibility/i, /press releases?/i, /in the news/i, /contact us/i, /about us/i,
      /corporate responsibility/i, /disclaimer/i, /certification/i
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
      const desc = (item.description || '').toLowerCase();
      
      // Remove blocked page content
      if (blockedPatterns.some(p => p.test(name) || p.test(desc))) return false;
      
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

  async navigateAndScrapeCategories(page) {
    const allItems = [];
    
    // More specific selectors for menu tabs/categories
    const categorySelectors = [
      '.menu-category-tabs a',
      '.category-tabs a',
      '.food-category a',
      '[data-category]',
      '.menu-nav a',
      '.category-menu a',
      'ul.menu li a',
      '.navbar-menu a'
    ];
    
    let categoryLinks = [];
    
    // Try each selector
    for (const selector of categorySelectors) {
      try {
        const elements = await page.$$(selector);
        for (const el of elements) {
          const text = await el.innerText();
          if (text && text.trim().length > 2 && text.trim().length < 40) {
            categoryLinks.push({ text: text.trim(), element: el });
          }
        }
        if (categoryLinks.length > 0) break;
      } catch (e) {}
    }
    
    // If no categories found, try clicking common menu items/tabs
    if (categoryLinks.length === 0) {
      try {
        const tabElements = await page.$$('[class*="tab"], [class*="menu-item"]');
        for (const el of tabElements.slice(0, 8)) {
          const text = await el.innerText();
          if (text && text.trim().length > 2 && text.trim().length < 30) {
            categoryLinks.push({ text: text.trim(), element: el });
          }
        }
      } catch (e) {}
    }
    
    // Filter to likely food categories
    const menuKeywords = ['pizza', 'burger', 'chicken', 'biryani', 'rice', 'starter', 'dessert', 'beverage', 'drink', 'combo', 'special', 'veg', 'paneer', 'mughlai', 'tandoor', 'wrap', 'sandwich', 'salad', 'soup', 'pasta', 'noodle', 'thali', 'curry', 'tikka', 'kebab'];
    
    const likelyCategories = categoryLinks.filter(c => {
      const lower = c.text.toLowerCase();
      return menuKeywords.some(k => lower.includes(k)) && 
             !lower.includes('login') && 
             !lower.includes('sign') && 
             !lower.includes('cart') &&
             !lower.includes('order') &&
             !lower.includes('contact') &&
             !lower.includes('about');
    }).slice(0, 6); // Max 6 categories
    
    console.log(`Found ${likelyCategories.length} menu categories:`, likelyCategories.map(c => c.text).join(', '));
    
    // Navigate each category
    for (const cat of likelyCategories) {
      try {
        await cat.element.click();
        await page.waitForTimeout(2000);
        
        // Get page content after click
        const content = await page.evaluate(() => {
          const texts = [];
          const els = document.querySelectorAll('[class*="item"] p, [class*="item"] h3, [class*="item"] h4, .menu-item, .product-item');
          els.forEach(el => {
            const t = el.innerText?.trim();
            if (t && t.length > 5 && t.length < 150) texts.push(t);
          });
          return texts;
        });
        
        // Parse content for items with prices
        for (const text of content) {
          const priceMatch = text.match(/[\$₹€£¥]\s*(\d+(?:[.,]\d+)?)/);
          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
            const name = text.split(priceMatch[0])[0].trim().split('\n')[0];
            if (name.length > 3) {
              allItems.push({
                name: name.substring(0, 60),
                price,
                description: '',
                category: cat.text
              });
            }
          }
        }
        
      } catch (e) {
        console.log(`Error category ${cat.text}:`, e.message);
      }
    }
    
    return allItems;
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
