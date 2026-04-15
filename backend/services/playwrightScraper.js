const { chromium } = require('playwright-core');
const scraperService = require('./scraper');
const cheerio = require('cheerio');
const axios = require('axios');

class PlaywrightScraperService {
  async scrapeMenuDynamic(restaurantUrl, retries = 1) {
    let browser;
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} for ${restaurantUrl}...`);
          await this.sleep(attempt * 2000);
        }

        const result = await this.attemptScrape(restaurantUrl, attempt);
        
        if (result.success && result.items?.length > 0) {
          return result;
        }
        if (result.error) {
          lastError = result.error;
        } else {
          lastError = 'No items found';
        }
      } catch (e) {
        lastError = e.message;
        console.warn(`Attempt ${attempt + 1} failed:`, e.message);
      }
    }

    console.error(`All attempts failed for ${restaurantUrl}:`, lastError);
    return { success: false, error: lastError || 'Max retries exceeded', items: [], method: 'dynamic_failed' };
  }

  async attemptScrape(restaurantUrl, attemptNum) {
    let browser;
    try {
      const executablePath = this.defaultChromePath();
      
      browser = await chromium.launch({
        executablePath: executablePath || undefined,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });

      const page = await context.newPage();

      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('Browser error:', msg.text());
        }
      });

      console.log(`Navigating to ${restaurantUrl}...`);
      
      try {
        const response = await page.goto(restaurantUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        if (!response || !response.ok()) {
          const status = response?.status();
          if (status === 503 || status === 403) {
            throw new Error('Blocked - HTTP ' + status);
          }
        }
      } catch (gotoError) {
        console.log(`Navigation error: ${gotoError.message}`);
      }

      await page.waitForTimeout(2000);

      const cloudflareChallenge = await page.$('#cf-challenge-hcaptcha-container, .cf-challenge-hcaptcha, [id*="cf-challenge"]');
      if (cloudflareChallenge) {
        throw new Error('Cloudflare challenge detected');
      }

      // Try to click on a location if this is a multi-location site
      await this.handleLocationSelection(page);

      await this.scrollPage(page);
      await this.waitForContent(page);

      const html = await page.content();
      const $ = cheerio.load(html);

      let menuItems = this.extractMenuItems($, html, restaurantUrl);
      
      // Fix prices - look in full text for price patterns
      const fullText = html;
      menuItems = menuItems.map(item => {
        if (!item.price || item.price === 0) {
          const nameEscaped = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(nameEscaped + '[^<]{0,50}\\$([\\d,.]+)', 'i');
          const match = fullText.match(regex);
          if (match && match[1]) {
            item.price = parseFloat(match[1].replace(/,/g, ''));
          }
        }
        return item;
      });
      
      // Ultimate fallback: scan full HTML text for price patterns
      if (menuItems.filter(i => i.price > 0).length < 3) {
        const priceMatches = fullText.match(/\\$[\d,.]+/g) || [];
        const uniquePrices = [...new Set(priceMatches)].slice(0, 20);
        menuItems = menuItems.map((item, i) => {
          if (i < uniquePrices.length && (!item.price || item.price === 0)) {
            item.price = parseFloat(uniquePrices[i].replace('$', '').replace(/,/g, ''));
          }
          return item;
        });
      }

      if (menuItems.length < 3 && attemptNum === 0) {
        const menuLinks = await this.findMenuLinks(page, restaurantUrl);
        for (const link of menuLinks.slice(0, 3)) {
          try {
            console.log(`Following menu link: ${link}`);
            await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await this.handleLocationSelection(page);
            await this.scrollPage(page);
            const pageHtml = await page.content();
            const page$ = cheerio.load(pageHtml);
            const pageItems = this.extractMenuItems(page$, pageHtml, link);
            menuItems.push(...pageItems);
            await page.goBack();
          } catch (e) {
            console.warn(`Failed to follow link ${link}:`, e.message);
          }
        }
      }

      menuItems = this.deduplicateItems(menuItems);

      return {
        success: menuItems.length > 0,
        items: menuItems.slice(0, 100),
        total: menuItems.length,
        method: menuItems.length > 0 ? 'dynamic_playwright' : 'dynamic_failed'
      };

    } catch (error) {
      throw error;
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  async handleLocationSelection(page) {
    try {
      // First, look for and click the MENU button/tab to load menu content
      const menuSelectors = [
        'a:has-text("MENU")',
        'button:has-text("MENU")',
        '[class*="menu-nav"]',
        'nav a',
        '[role="tab"]:has-text("Menu")',
        'a[href*="menu"]'
      ];
      
      for (const selector of menuSelectors) {
        const elements = await page.$$(selector);
        for (const el of elements) {
          try {
            const text = await el.innerText();
            if (text && /^\s*MENU\s*$/i.test(text)) {
              console.log(`Clicking MENU: ${selector}`);
              await el.click();
              await page.waitForTimeout(1500);
              break;
            }
          } catch (e) {}
        }
      }
      
      // Also try clicking text="MENU" directly
      try {
        await page.click('text="MENU"', { timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(1500);
      } catch (e) {}
      
      // Then look for location-related buttons/links if needed
      const locationSelectors = [
        'button[class*="location"]',
        'a[class*="location"]',
        '[data-location]',
        '.location-button',
        '.location-item',
        'button:has-text("Select")',
        '.select-location'
      ];
      
      for (const selector of locationSelectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} location elements with selector: ${selector}`);
          await elements[0].click().catch(() => {});
          await page.waitForTimeout(1000);
          break;
        }
      }
    } catch (e) {
      console.log('Location selection attempt:', e.message);
    }
  }

  extractMenuItems($, html, url) {
    let items = [];

    // Priority 1: CSS selectors with specific class targeting
    items = scraperService.parseCssSelectors($, url);
    
    // Priority 2: List items with prices
    const listItems = scraperService.parseListItems($, url);
    items = [...items, ...listItems];
    
    // Priority 3: Text content scan for price patterns
    const textItems = scraperService.parseTextContent($, url);
    items = [...items, ...textItems];

    // Priority 4: Raw regex patterns
    const regexItems = scraperService.parseRegexPricePatterns(html);
    items = [...items, ...regexItems];

    // Fix prices - sometimes price is in the text but not extracted
    items = items.map(item => {
      if (!item.price || item.price === 0) {
        const text = item.name + ' ' + (item.description || '');
        const priceMatch = text.match(/\$[\d,.]+/);
        if (priceMatch) {
          item.price = scraperService.extractPrice(priceMatch[0]);
        }
      }
      return item;
    });

    return items;
  }

  async scrollPage(page) {
    try {
      await page.evaluate(async () => {
        const scroll = async () => {
          for (let i = 0; i < 10; i++) {
            window.scrollBy(0, 300);
            await new Promise(r => setTimeout(r, 200));
          }
          window.scrollTo(0, 0);
        };
        await scroll();
      });
    } catch (e) {}
  }

  async waitForContent(page) {
    try {
      await page.waitForTimeout(1500);
      
      const hasContent = await page.evaluate(() => {
        return document.body.innerText.length > 100;
      });
      
      if (!hasContent) {
        await page.waitForTimeout(2000);
      }
    } catch (e) {}
  }

  async findMenuLinks(page, baseUrl) {
    const links = [];
    try {
      const hrefs = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors.map(a => ({
          href: a.href,
          text: a.innerText
        })).filter(a => 
          a.href && 
          /menu|food|cardápio|meny|spisekort/i.test(a.href + a.text)
        );
      });

      for (const link of hrefs) {
        try {
          const fixed = new URL(link.href, baseUrl).href;
          if (fixed.startsWith('http') && !fixed.includes('#')) {
            links.push(fixed);
          }
        } catch (e) {}
      }
    } catch (e) {}

    return [...new Set(links)];
  }

  deduplicateItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = (item.name || '').toLowerCase().trim();
      if (!key || key.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

module.exports = new PlaywrightScraperService();