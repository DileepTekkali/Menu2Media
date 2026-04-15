const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { validateUuid } = require('../utils/validators');

// GET /api/campaigns/restaurant/:restaurant_id — list campaigns for a restaurant
router.get('/campaigns/restaurant/:restaurant_id', async (req, res) => {
  try {
    const { restaurant_id } = req.params;
    if (!validateUuid(restaurant_id)) {
      return res.status(400).json({ success: false, error: 'Valid restaurant_id is required' });
    }

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (campaigns || []).map(c => ({
      id: c.id,
      campaign_type: c.campaign_type,
      platform: c.platform,
      status: c.status,
      total_creatives: c.total_creatives || 0,
      zip_url: c.zip_url,
      created_at: c.created_at
    }));

    res.json({ success: true, campaigns: formatted });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Support legacy route: GET /api/campaigns/:restaurant_id
router.get('/campaigns/:restaurant_id', async (req, res) => {
  try {
    const { restaurant_id } = req.params;
    if (!validateUuid(restaurant_id)) {
      return res.status(400).json({ success: false, error: 'Valid restaurant_id is required' });
    }

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      campaigns: (campaigns || []).map(c => ({
        id: c.id,
        campaign_type: c.campaign_type,
        platform: c.platform,
        status: c.status,
        total_creatives: c.total_creatives || 0,
        zip_url: c.zip_url,
        created_at: c.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/campaigns/:campaign_id/creatives — list creatives for a campaign
router.get('/campaign/:campaign_id/creatives', async (req, res) => {
  try {
    const { campaign_id } = req.params;
    if (!validateUuid(campaign_id)) {
      return res.status(400).json({ success: false, error: 'Valid campaign_id is required' });
    }

    const { data: creatives, error } = await supabase
      .from('creatives')
      .select('*, menu_items(name, price, description)')
      .eq('campaign_id', campaign_id);

    if (error) throw error;
    res.json({ success: true, creatives: creatives || [] });
  } catch (error) {
    console.error('Get creatives error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/menu/:restaurant_id — list menu items
router.get('/menu/:restaurant_id', async (req, res) => {
  try {
    const { restaurant_id } = req.params;
    if (!validateUuid(restaurant_id)) {
      return res.status(400).json({ success: false, error: 'Valid restaurant_id is required' });
    }

    const { data: items, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .order('is_bestseller', { ascending: false })
      .order('price', { ascending: false });

    if (error) throw error;
    res.json({ success: true, menu_items: items || [] });
  } catch (error) {
    console.error('Get menu error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/restaurants/:id/branding — update brand info
router.patch('/restaurants/:id/branding', async (req, res) => {
  try {
    const { id } = req.params;
    const { brand_colors, theme, logo_url } = req.body;

    if (!validateUuid(id)) {
      return res.status(400).json({ success: false, error: 'Valid restaurant id is required' });
    }

    const updates = {};
    if (brand_colors) updates.brand_colors = brand_colors;
    if (theme) updates.theme = theme;
    if (logo_url) updates.logo_url = logo_url;

    const { error } = await supabase.from('restaurants').update(updates).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/campaigns/:campaign_id
router.delete('/campaigns/:campaign_id', async (req, res) => {
  try {
    const { campaign_id } = req.params;
    if (!validateUuid(campaign_id)) {
      return res.status(400).json({ success: false, error: 'Valid campaign_id is required' });
    }
    const { error } = await supabase.from('campaigns').delete().eq('id', campaign_id);
    if (error) throw error;
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
