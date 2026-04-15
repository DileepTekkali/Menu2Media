const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const axios = require('axios');
const supabase = require('../utils/supabase');
const { validateUuid } = require('../utils/validators');

// GET /api/download/:campaign_id — stream ZIP of all creatives
router.get('/download/:campaign_id', async (req, res) => {
  try {
    const { campaign_id } = req.params;
    if (!validateUuid(campaign_id)) {
      return res.status(400).json({ success: false, error: 'Valid campaign_id is required' });
    }

    // Fetch campaign and its creatives
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campError || !campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const { data: creatives, error: creativesError } = await supabase
      .from('creatives')
      .select('*, menu_items(name)')
      .eq('campaign_id', campaign_id);

    if (creativesError) throw creativesError;
    if (!creatives || creatives.length === 0) {
      return res.status(404).json({ success: false, error: 'No creatives found for this campaign' });
    }

    // Set ZIP response headers
    const zipFilename = `campaign_${campaign.campaign_type}_${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    archive.pipe(res);

    // Download each creative and add to ZIP
    for (const creative of creatives) {
      if (!creative.image_url) continue;
      try {
        const response = await axios.get(creative.image_url, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        const dishName = creative.menu_items?.name || `dish_${creative.menu_item_id}`;
        const safeName = dishName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase();
        const extension = creative.export_type || 'png';
        const fileName = `${safeName}_${creative.format}.${extension}`;
        archive.append(Buffer.from(response.data), { name: fileName });
      } catch (downloadErr) {
        console.error('Failed to download creative:', creative.image_url, downloadErr.message);
      }
    }

    await archive.finalize();

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

module.exports = router;
