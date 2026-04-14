const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const aiProcessor = require('../services/aiProcessor');
const imageGenerator = require('../services/imageGenerator');
const creativeBuilder = require('../services/creativeBuilder');
const { validateUuid, validateCampaignType, validateFormat } = require('../utils/validators');

router.post('/select-content', async (req, res) => {
  try {
    const { restaurant_id, campaign_type = 'daily', dish_count = 5 } = req.body;

    if (!restaurant_id || !validateUuid(restaurant_id)) {
      return res.status(400).json({
        success: false,
        error: 'Valid restaurant_id is required'
      });
    }

    let query = supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant_id);

    if (campaign_type === 'weekend') {
      query = query.in('category', ['Main Course', 'Starters']);
    }

    const { data: menuItems, error } = await query;
    if (error) throw error;

    let selected = menuItems || [];
    
    selected = selected.sort((a, b) => {
      if (a.is_bestseller && !b.is_bestseller) return -1;
      if (!a.is_bestseller && b.is_bestseller) return 1;
      return (b.price || 0) - (a.price || 0);
    });

    selected = selected.slice(0, Math.min(dish_count, 10));

    const selectedWithReasons = selected.map(item => ({
      ...item,
      reason: item.is_bestseller ? 'Bestseller' : 'Popular choice'
    }));

    res.json({
      success: true,
      selected_dishes: selectedWithReasons
    });
  } catch (error) {
    console.error('Select content error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/generate-captions', async (req, res) => {
  try {
    const { dishes, tone = 'casual' } = req.body;

    if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Dishes array is required'
      });
    }

    const captions = await aiProcessor.generateCaptions(dishes, tone);

    res.json({
      success: true,
      captions
    });
  } catch (error) {
    console.error('Generate captions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/generate-images', async (req, res) => {
  try {
    const { dishes } = req.body;

    if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Dishes array is required'
      });
    }

    const images = [];

    for (const dish of dishes) {
      let imageBuffer = null;
      let method = 'ai_generated';

      if (dish.image_url) {
        const existingImage = await imageGenerator.downloadAndProcess(dish.image_url);
        if (existingImage) {
          const enhanced = await imageGenerator.enhanceImage(dish.image_url);
          imageBuffer = enhanced.buffer;
          method = enhanced.success ? 'enhanced_existing' : 'ai_generated';
        }
      }

      if (!imageBuffer) {
        const generated = await imageGenerator.generateImage(dish.name, dish.description);
        imageBuffer = generated.buffer;
        method = generated.method;
      }

      if (imageBuffer && supabase.storage) {
        try {
          const fileName = `dishes/${dish.id}_${Date.now()}.png`;
          const { data, error } = await supabase.storage
            .from('creatives')
            .upload(fileName, imageBuffer, {
              contentType: 'image/png',
              upsert: true
            });

          if (!error && data) {
            const { data: urlData } = supabase.storage
              .from('creatives')
              .getPublicUrl(fileName);

            images.push({
              dish_id: dish.id,
              image_url: urlData.publicUrl,
              method
            });
          } else {
            images.push({
              dish_id: dish.id,
              image_url: null,
              method
            });
          }
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          images.push({
            dish_id: dish.id,
            image_url: null,
            method
          });
        }
      } else {
        images.push({
          dish_id: dish.id,
          image_url: null,
          method
        });
      }
    }

    res.json({
      success: true,
      images
    });
  } catch (error) {
    console.error('Generate images error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/create-creatives', async (req, res) => {
  try {
    const { restaurant_id, dishes, formats = ['instagram_square'], branding = {} } = req.body;

    if (!restaurant_id || !validateUuid(restaurant_id)) {
      return res.status(400).json({
        success: false,
        error: 'Valid restaurant_id is required'
      });
    }

    const colors = branding.colors || ['#FF6B6B', '#4ECDC4'];

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        restaurant_id,
        campaign_type: branding.campaign_type || 'daily',
        platform: branding.platform || 'instagram',
        status: 'processing',
        selected_dishes: dishes.map(d => d.id)
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    const creatives = [];

    for (const dish of dishes) {
      for (const format of formats) {
        if (!validateFormat(format)) continue;

        const { width, height } = creativeBuilder.getDimensions(format);
        
        let imageBuffer = null;
        if (dish.image_url) {
          imageBuffer = await imageGenerator.downloadAndProcess(dish.image_url);
        }

        if (!imageBuffer) {
          const generated = await imageGenerator.generateImage(dish.name);
          imageBuffer = generated.buffer;
        }

        const creative = await creativeBuilder.buildCreative({
          dish,
          format,
          imageBuffer,
          colors,
          caption: dish.caption
        });

        if (creative.success && supabase.storage) {
          try {
            const fileName = `creatives/${campaign.id}/${dish.id}_${format}_${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage
              .from('creatives')
              .upload(fileName, creative.buffer, {
                contentType: 'image/png',
                upsert: true
              });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('creatives')
                .getPublicUrl(fileName);

              await supabase.from('creatives').insert({
                campaign_id: campaign.id,
                menu_item_id: dish.id,
                format,
                image_url: urlData.publicUrl,
                caption_headline: dish.headline || dish.name,
                caption_body: dish.caption,
                cta_text: dish.cta,
                dimensions: creative.dimensions
              });

              creatives.push({
                menu_item_id: dish.id,
                format,
                image_url: urlData.publicUrl,
                download_url: urlData.publicUrl
              });
            }
          } catch (uploadErr) {
            console.error('Creative upload error:', uploadErr);
          }
        }
      }
    }

    await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        total_creatives: creatives.length
      })
      .eq('id', campaign.id);

    res.json({
      success: true,
      campaign_id: campaign.id,
      creatives,
      total_creatives: creatives.length
    });
  } catch (error) {
    console.error('Create creatives error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
