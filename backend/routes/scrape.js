const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraper');
const intelligentScraper = require('../services/intelligentScraper');
let playwrightScraper;
try {
  playwrightScraper = require('../services/playwrightScraper');
} catch (e) {
  console.warn('Playwright scraper not available:', e.message);
}
const supabase = require('../utils/supabase');
const { validateUrl, sanitizeString } = require('../utils/validators');

router.post('/scrape', async (req, res) => {
  try {
    const { restaurant_url, restaurant_name } = req.body;

    if (!restaurant_url || !validateUrl(restaurant_url)) {
      return res.status(400).json({
        success: false,
        error: 'Valid restaurant URL is required'
      });
    }

    const name = restaurant_name || new URL(restaurant_url).hostname.replace('www.', '').split('.')[0];

    // Manage restaurant record
    let restaurant;
    const { data: existing } = await supabase
      .from('restaurants')
      .select('*')
      .eq('website_url', restaurant_url)
      .single();

    if (existing) {
      // Clear out existing menu items so we start fresh
      await supabase.from('menu_items').delete().eq('restaurant_id', existing.id);
      restaurant = existing;
    } else {
      const { data: newRestaurant, error } = await supabase
        .from('restaurants')
        .insert({
          name: sanitizeString(name),
          website_url: restaurant_url,
          theme: 'casual'
        })
        .select()
        .single();

      if (error) throw error;
      restaurant = newRestaurant;
    }

    // Try multiple scrapers with fallbacks
    let scrapeResult = null;
    
    // 1. Try intelligent scraper (heuristics + Groq)
    try {
      scrapeResult = await intelligentScraper.scrapeMenu(restaurant_url);
      console.log(`Intelligent scraper: ${scrapeResult.items?.length || 0} items`);
    } catch (e) {
      console.log(`Intelligent scraper failed: ${e.message}`);
    }
    
    // 2. If no items, try playwright dynamic scraper
    if (!scrapeResult?.items?.length && playwrightScraper) {
      try {
        console.log(`Trying dynamic scraper for ${restaurant_url}...`);
        scrapeResult = await playwrightScraper.scrapeMenuDynamic(restaurant_url, 2);
        console.log(`Dynamic scraper: ${scrapeResult.items?.length || 0} items`);
      } catch (e) {
        console.log(`Dynamic scraper failed: ${e.message}`);
      }
    }
    
    // 3. If still no items, try static scraper
    if (!scrapeResult?.items?.length) {
      try {
        console.log(`Trying static scraper for ${restaurant_url}...`);
        scrapeResult = await scraperService.scrapeMenu(restaurant_url);
        console.log(`Static scraper: ${scrapeResult.items?.length || 0} items`);
      } catch (e) {
        console.log(`Static scraper failed: ${e.message}`);
      }
    }
    
    // 4. If still no items, try with longer timeout and stealth mode
    if (!scrapeResult?.items?.length && playwrightScraper) {
      try {
        console.log(`Trying stealth scraper with stealth mode...`);
        scrapeResult = await playwrightScraper.scrapeMenuStealth(restaurant_url);
        console.log(`Stealth scraper: ${scrapeResult.items?.length || 0} items`);
      } catch (e) {
        console.log(`Stealth scraper failed: ${e.message}`);
      }
    }
    
    // If all scrapers failed, create empty result
    if (!scrapeResult?.items?.length) {
      scrapeResult = { items: [], method: 'failed' };
    }
    
    // Apply heuristic filter to remove blocked page content from all scrapers
    if (scrapeResult?.items?.length) {
      scrapeResult.items = intelligentScraper.heuristicFilter(scrapeResult.items);
      console.log(`After heuristic filter: ${scrapeResult.items.length} items`);
    }

    if (scrapeResult && scrapeResult.items && scrapeResult.items.length > 0) {
      const menuItems = scrapeResult.items.map(item => ({
        restaurant_id: restaurant.id,
        name: sanitizeString(item.name),
        category: sanitizeString(item.category),
        price: item.price,
        description: sanitizeString(item.description),
        image_url: item.image_url || null
      }));

      // Insert all found menu items
      const { error: menuError } = await supabase
        .from('menu_items')
        .insert(menuItems);

      if (menuError) console.error('Menu insert error:', menuError);
    }

    // Refetch the menu items from DB
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id);

    res.json({
      success: true,
      restaurant_id: restaurant.id,
      menu_items_count: menuItems?.length || 0,
      scrape_method: scrapeResult.method || 'unknown',
      data: {
        restaurant,
        menu_items: menuItems || []
      }
    });
  } catch (error) {
    console.error('Scrape endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
