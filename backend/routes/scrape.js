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

// ─── How long before we allow a re-scrape of the same URL (30 minutes) ────────
const RESCRAPE_COOLDOWN_MS = 30 * 60 * 1000;

// ─── POST /api/scrape ──────────────────────────────────────────────────────────
router.post('/scrape', async (req, res) => {
  try {
    const { restaurant_url, restaurant_name, force_refresh = false } = req.body;

    if (!restaurant_url || !validateUrl(restaurant_url)) {
      return res.status(400).json({
        success: false,
        error: 'Valid restaurant URL is required'
      });
    }

    const name = restaurant_name ||
      new URL(restaurant_url).hostname.replace('www.', '').split('.')[0];

    // ── 1. Check if restaurant already exists ────────────────────────────────
    const { data: existing } = await supabase
      .from('restaurants')
      .select('*')
      .eq('website_url', restaurant_url)
      .single();

    // ── 2. Freshness Check: return cached data if scraped recently ───────────
    if (existing && !force_refresh) {
      const lastScraped = existing.last_scraped_at
        ? new Date(existing.last_scraped_at).getTime()
        : 0;
      const timeSinceScrape = Date.now() - lastScraped;

      if (timeSinceScrape < RESCRAPE_COOLDOWN_MS) {
        const minutesAgo = Math.floor(timeSinceScrape / 60000);
        console.log(`Returning cached menu for ${restaurant_url} (scraped ${minutesAgo}m ago)`);

        const { data: cachedItems } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', existing.id)
          .order('name');

        return res.json({
          success: true,
          restaurant_id: existing.id,
          menu_items_count: cachedItems?.length || 0,
          scrape_method: 'cache',
          cached: true,
          cached_minutes_ago: minutesAgo,
          data: {
            restaurant: existing,
            menu_items: cachedItems || []
          }
        });
      }
    }

    // ── 3. Upsert the restaurant record ─────────────────────────────────────
    let restaurant;
    if (existing) {
      restaurant = existing;
      console.log(`Re-scraping ${restaurant_url} after cooldown period`);
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

    // ── 4. Run scrapers with fallback chain ──────────────────────────────────
    let scrapeResult = null;

    // 4a. Intelligent scraper (heuristics + Groq)
    try {
      scrapeResult = await intelligentScraper.scrapeMenu(restaurant_url);
      console.log(`Intelligent scraper: ${scrapeResult.items?.length || 0} items`);
      
      // Update restaurant branding if found
      if (scrapeResult.restaurantName || scrapeResult.logoUrl) {
        const updateData = {};
        if (scrapeResult.restaurantName && (!restaurant.name || restaurant.name.length < 5)) {
          updateData.name = sanitizeString(scrapeResult.restaurantName);
        }
        if (scrapeResult.logoUrl) {
          updateData.logo_url = scrapeResult.logoUrl;
        }
        
        if (Object.keys(updateData).length > 0) {
          const { data: updated } = await supabase
            .from('restaurants')
            .update(updateData)
            .eq('id', restaurant.id)
            .select()
            .single();
          if (updated) restaurant = updated;
        }
      }
    } catch (e) {
      console.log(`Intelligent scraper failed: ${e.message}`);
    }

    // 4b. Playwright dynamic scraper
    if (!scrapeResult?.items?.length && playwrightScraper) {
      try {
        scrapeResult = await playwrightScraper.scrapeMenuDynamic(restaurant_url, 2);
        console.log(`Dynamic scraper: ${scrapeResult.items?.length || 0} items`);
      } catch (e) {
        console.log(`Dynamic scraper failed: ${e.message}`);
      }
    }

    // 4c. Static scraper
    if (!scrapeResult?.items?.length) {
      try {
        scrapeResult = await scraperService.scrapeMenu(restaurant_url);
        console.log(`Static scraper: ${scrapeResult.items?.length || 0} items`);
      } catch (e) {
        console.log(`Static scraper failed: ${e.message}`);
      }
    }

    // 4d. Stealth mode
    if (!scrapeResult?.items?.length && playwrightScraper) {
      try {
        scrapeResult = await playwrightScraper.scrapeMenuStealth(restaurant_url);
        console.log(`Stealth scraper: ${scrapeResult.items?.length || 0} items`);
      } catch (e) {
        console.log(`Stealth scraper failed: ${e.message}`);
      }
    }

    if (!scrapeResult?.items?.length) {
      scrapeResult = { items: [], method: 'failed' };
    }

    // ── 5. Heuristic filter ──────────────────────────────────────────────────
    if (scrapeResult.items?.length) {
      scrapeResult.items = intelligentScraper.heuristicFilter(scrapeResult.items);
      console.log(`After heuristic filter: ${scrapeResult.items.length} items`);
    }

    // ── 6. Persist menu items with deduplication ─────────────────────────────
    if (scrapeResult.items?.length > 0) {
      // Delete ALL existing menu items for this restaurant first (clean slate)
      await supabase
        .from('menu_items')
        .delete()
        .eq('restaurant_id', restaurant.id);

      // De-duplicate scraped items by name (case-insensitive) before insert
      const seenNames = new Set();
      const uniqueItems = [];

      for (const item of scrapeResult.items) {
        const normalizedName = (item.name || '').toLowerCase().trim();
        if (!normalizedName || seenNames.has(normalizedName)) continue;
        seenNames.add(normalizedName);

        uniqueItems.push({
          restaurant_id: restaurant.id,
          name: sanitizeString(item.name),
          category: sanitizeString(item.category || 'Menu'),
          price: item.price || null,
          description: sanitizeString(item.description || ''),
          image_url: item.image_url || null
        });
      }

      console.log(`Inserting ${uniqueItems.length} unique items (deduped from ${scrapeResult.items.length})`);

      if (uniqueItems.length > 0) {
        const { error: menuError } = await supabase
          .from('menu_items')
          .insert(uniqueItems);

        if (menuError) console.error('Menu insert error:', menuError);
      }
    }

    // ── 7. Update restaurant timestamp ───────────────────────────────────────
    await supabase
      .from('restaurants')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', restaurant.id);

    // ── 8. Return final result from DB ───────────────────────────────────────
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('name');

    res.json({
      success: true,
      restaurant_id: restaurant.id,
      menu_items_count: menuItems?.length || 0,
      scrape_method: scrapeResult.method || 'unknown',
      cached: false,
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

// ─── POST /api/cleanup-duplicates ─────────────────────────────────────────────
// Removes duplicate menu_items for a restaurant (keeps the first occurrence)
router.post('/cleanup-duplicates', async (req, res) => {
  try {
    const { restaurant_id } = req.body;

    // Build query
    let query = supabase
      .from('menu_items')
      .select('id, name, restaurant_id')
      .order('id'); // keep the lowest (oldest) id

    if (restaurant_id) {
      query = query.eq('restaurant_id', restaurant_id);
    }

    const { data: allItems, error } = await query;
    if (error) throw error;

    const seenKeys = new Set();
    const toDelete = [];

    for (const item of allItems || []) {
      const key = `${item.restaurant_id}|${(item.name || '').toLowerCase().trim()}`;
      if (seenKeys.has(key)) {
        toDelete.push(item.id);
      } else {
        seenKeys.add(key);
      }
    }

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('menu_items')
        .delete()
        .in('id', toDelete);

      if (deleteError) throw deleteError;
    }

    res.json({
      success: true,
      duplicates_removed: toDelete.length,
      message: `Removed ${toDelete.length} duplicate menu items from the database`
    });

  } catch (error) {
    console.error('Cleanup duplicates error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
