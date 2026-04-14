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

    let processedItems = menuItems || [];
    const categories = new Set();
    const bestsellers = [];

    if (options.remove_duplicates) {
      const seen = new Map();
      processedItems = processedItems.filter(item => {
        const key = item.name.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.set(key, item);
        return true;
      });
    }

    for (const item of processedItems) {
      if (options.auto_categorize) {
        const category = aiProcessor.categorizeDish(item.name);
        item.category = category;
        categories.add(category);
      }

      if (options.generate_missing_descriptions) {
        item.description = await aiProcessor.generateDescription(
          item.name,
          item.description
        );
      }

      if (aiProcessor.isBestseller(item.name, item.price)) {
        item.is_bestseller = true;
        bestsellers.push(item.name);
      }

      await supabase
        .from('menu_items')
        .update({
          category: item.category,
          description: item.description,
          is_bestseller: item.is_bestseller
        })
        .eq('id', item.id);
    }

    res.json({
      success: true,
      processed_items: processedItems.length,
      categories: Array.from(categories),
      bestsellers
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
