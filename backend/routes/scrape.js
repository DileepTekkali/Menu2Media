const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraper');
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

    let restaurant;
    const { data: existing } = await supabase
      .from('restaurants')
      .select('*')
      .eq('website_url', restaurant_url)
      .single();

    if (existing) {
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

    const scrapeResult = await scraperService.scrapeMenu(restaurant_url);

    if (scrapeResult.items.length > 0) {
      const menuItems = scrapeResult.items.map(item => ({
        restaurant_id: restaurant.id,
        name: sanitizeString(item.name),
        category: sanitizeString(item.category),
        price: item.price,
        description: sanitizeString(item.description),
        image_url: item.image_url || null
      }));

      const { error: menuError } = await supabase
        .from('menu_items')
        .insert(menuItems);

      if (menuError) console.error('Menu insert error:', menuError);
    }

    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id);

    res.json({
      success: true,
      restaurant_id: restaurant.id,
      menu_items_count: menuItems?.length || 0,
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
