const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const aiProcessor = require('../services/aiProcessor');
const { validateUuid } = require('../utils/validators');

router.post('/process-menu', async (req, res) => {
  try {
    const { restaurant_id, options = {} } = req.body;

    if (!restaurant_id || !validateUuid(restaurant_id)) {
      return res.status(400).json({
        success: false,
        error: 'Valid restaurant_id is required'
      });
    }

    const { data: menuItems, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant_id);

    if (error) throw error;

    let processedItems = (menuItems || []).map(item => ({
      ...item,
      name: aiProcessor.standardizeDishName(item.name)
    }));
    const categories = new Set();
    const bestsellers = [];
    const contentGroups = {
      best_sellers: [],
      chef_specials: [],
      trending_dishes: [],
      combo_deals: [],
      new_arrivals: []
    };
    const duplicateIds = [];

    if (options.remove_duplicates) {
      const seen = new Map();
      processedItems = processedItems.filter(item => {
        const key = item.name.toLowerCase().trim();
        if (seen.has(key)) {
          duplicateIds.push(item.id);
          return false;
        }
        seen.set(key, item);
        return true;
      });

      if (duplicateIds.length > 0) {
        await supabase.from('menu_items').delete().in('id', duplicateIds);
      }
    }

    for (const item of processedItems) {
      if (options.auto_categorize) {
        const category = aiProcessor.categorizeDish(item.name);
        item.category = category;
      }
      categories.add(item.category || 'Other');

      if (options.generate_missing_descriptions) {
        item.description = await aiProcessor.generateDescription(
          item.name,
          item.description
        );
      }

      if (aiProcessor.isBestseller(item.name, item.price)) {
        item.is_bestseller = true;
      }
      if (item.is_bestseller) bestsellers.push(item.name);

      item.tags = aiProcessor.inferTags(item);
      if (item.tags.includes('bestseller')) contentGroups.best_sellers.push(item.name);
      if (item.tags.includes('chef_special')) contentGroups.chef_specials.push(item.name);
      if (item.tags.includes('trending')) contentGroups.trending_dishes.push(item.name);
      if (item.tags.includes('combo_deal')) contentGroups.combo_deals.push(item.name);
      if (item.tags.includes('new_arrival')) contentGroups.new_arrivals.push(item.name);

      await supabase
        .from('menu_items')
        .update({
          name: item.name,
          category: item.category,
          description: item.description,
          is_bestseller: item.is_bestseller,
          tags: item.tags
        })
        .eq('id', item.id);
    }

    res.json({
      success: true,
      processed_items: processedItems.length,
      removed_duplicates: duplicateIds.length,
      categories: Array.from(categories),
      bestsellers,
      content_groups: contentGroups
    });
  } catch (error) {
    console.error('Process menu error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
