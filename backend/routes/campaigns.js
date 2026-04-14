const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { validateUuid } = require('../utils/validators');

router.get('/campaigns/:restaurant_id', async (req, res) => {
  try {
    const { restaurant_id } = req.params;

    if (!validateUuid(restaurant_id)) {
      return res.status(400).json({
        success: false,
        error: 'Valid restaurant_id is required'
      });
    }

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        creatives(count)
      `)
      .eq('restaurant_id', restaurant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedCampaigns = (campaigns || []).map(c => ({
      id: c.id,
      campaign_type: c.campaign_type,
      platform: c.platform,
      status: c.status,
      total_creatives: c.total_creatives || 0,
      zip_url: c.zip_url,
      created_at: c.created_at
    }));

    res.json({
      success: true,
      campaigns: formattedCampaigns
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/campaigns/:campaign_id/creatives', async (req, res) => {
  try {
    const { campaign_id } = req.params;

    if (!validateUuid(campaign_id)) {
      return res.status(400).json({
        success: false,
        error: 'Valid campaign_id is required'
      });
    }

    const { data: creatives, error } = await supabase
      .from('creatives')
      .select(`
        *,
        menu_items(name, price, description)
      `)
      .eq('campaign_id', campaign_id);

    if (error) throw error;

    res.json({
      success: true,
      creatives: creatives || []
    });
  } catch (error) {
    console.error('Get creatives error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/campaigns/:campaign_id', async (req, res) => {
  try {
    const { campaign_id } = req.params;

    if (!validateUuid(campaign_id)) {
      return res.status(400).json({
        success: false,
        error: 'Valid campaign_id is required'
      });
    }

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaign_id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
