const axios = require('axios');
const cheerio = require('cheerio');

class ScraperService {
  async scrapeMenu(restaurantUrl) {
    try {
      const response = await axios.get(restaurantUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000
      });

      const $ = cheerio.load(response.data);
      const menuItems = [];
      let currentCategory = 'Menu';

      $('[class*="category"], [class*="section"], [class*="group"]').each((i, el) => {
        const heading = $(el).find('h1, h2, h3, h4').first().text().trim();
        if (heading && heading.length < 50) {
          currentCategory = heading;
        }
      });

      const selectors = [
        '.menu-item', '.dish-item', '.food-item', '.product-item', '.item-card',
        '[class*="menu-item"]', '[class*="dish"]', '[class*="food-item"]',
        '[class*="product"]', 'article.menu-card', '.card[data-item]'
      ];

      for (const selector of selectors) {
        $(selector).each((i, el) => {
          const $el = $(el);
          
          let name = $el.find('h2, h3, h4, .title, .name, [class*="title"], [class*="name"], [itemprop="name"]').first().text().trim();
          let price = $el.find('.price, [class*="price"], [itemprop="price"], .amount').first().text().trim();
          let description = $el.find('p, .description, [class*="desc"], [itemprop="description"], .item-desc').first().text().trim();
          let image = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || $el.find('img').first().attr('data-lazy');
          
          let category = $el.closest('[class*="category"], [class*="section"], [class*="group"], .menu-section').find('h2, h3, h4').first().text().trim();
          category = category || currentCategory;

          if (!name) {
            name = $el.find('[class*="dish-name"], [class*="item-name"], .dishTitle, .itemTitle').first().text().trim();
          }
          if (!price) {
            price = $el.find('[class*="dish-price"], [class*="item-price"], .dishPrice, .itemPrice').first().text().trim();
          }

          if (name && name.length > 2 && name.length < 100 && !this.isNoise(name)) {
            const priceValue = this.extractPrice(price);
            const existing = menuItems.find(item => 
              item.name.toLowerCase() === name.toLowerCase()
            );

            if (!existing) {
              menuItems.push({
                name: this.cleanText(name),
                price: priceValue,
                description: this.cleanText(description),
                image_url: image ? this.fixImageUrl(image, restaurantUrl) : '',
                category: this.cleanText(category) || 'Menu'
              });
            }
          }
        });

        if (menuItems.length > 5) break;
      }

      if (menuItems.length < 3) {
        const altSelectors = [
          'li[class*="item"]', '.menu li', '.food-list li',
          '[data-dish]', '[data-item]', '.dish-card'
        ];
        
        for (const selector of altSelectors) {
          $(selector).each((i, el) => {
            const $el = $(el);
            let name = $el.clone().children().remove().end().text().trim();
            
            if (!name) {
              name = $el.find('span, div').first().text().trim();
            }
            
            let price = $el.find('[class*="price"]').text().trim() ||
                        $el.text().match(/₹[\d,]+|[\d,]+\s*₹|\$[\d.]+/)?.[0] || '';
            
            if (name && name.length > 2 && name.length < 80 && !this.isNoise(name)) {
              const priceValue = this.extractPrice(price);
              const existing = menuItems.find(item => 
                item.name.toLowerCase() === name.toLowerCase()
              );
              
              if (!existing) {
                menuItems.push({
                  name: this.cleanText(name),
                  price: priceValue,
                  description: '',
                  image_url: '',
                  category: 'Menu'
                });
              }
            }
          });
          
          if (menuItems.length > 5) break;
        }
      }

      return {
        success: true,
        items: menuItems.slice(0, 100),
        total: menuItems.length
      };
    } catch (error) {
      console.error('Scraping error:', error.message);
      return {
        success: false,
        error: error.message,
        items: []
      };
    }
  }

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').replace(/[^\x20-\x7E\n]/g, '').trim();
  }

  fixImageUrl(imageUrl, baseUrl) {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('//')) return 'https:' + imageUrl;
    if (imageUrl.startsWith('/')) {
      const url = new URL(baseUrl);
      return url.origin + imageUrl;
    }
    return imageUrl;
  }

  isNoise(text) {
    const noisePatterns = [
      /^(menu|cart|order|home|contact|about|login|signup|sign in|sign up)$/i,
      /^(view|edit|delete|add|cancel|confirm|submit|save|close)$/i,
      /^\d+$/,
      /^[a-z]\)$/i,
    ];
    return noisePatterns.some(pattern => pattern.test(text.trim()));
  }

  extractPrice(priceString) {
    if (!priceString) return 0;
    const cleaned = priceString.replace(/[^\d,.]/g, '');
    const match = cleaned.match(/[\d,]+\.?\d*/);
    if (match) {
      return parseFloat(match[0].replace(/,/g, ''));
    }
    return 0;
  }
}

module.exports = new ScraperService();
