const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const aiProcessor = require('../services/aiProcessor');
const imageGenerator = require('../services/imageGenerator');
const creativeBuilder = require('../services/creativeBuilder');
const { validateUuid, validateCampaignType, validateFormat } = require('../utils/validators');

// POST /api/select-content
router.post('/select-content', async (req, res) => {
  try {
    const { restaurant_id, campaign_type = 'daily', dish_count = 5 } = req.body;

    if (!restaurant_id || !validateUuid(restaurant_id)) {
      return res.status(400).json({ success: false, error: 'Valid restaurant_id is required' });
    }
    if (!validateCampaignType(campaign_type)) {
      return res.status(400).json({ success: false, error: 'Invalid campaign_type' });
    }

    let query = supabase.from('menu_items').select('*').eq('restaurant_id', restaurant_id);

    const { data: menuItems, error } = await query;
    if (error) throw error;

    if (!menuItems || menuItems.length === 0) {
      return res.status(404).json({ success: false, error: 'No menu items found for this restaurant' });
    }

    // Filter items based on campaign type after fetching all (more lenient than SQL)
    let filteredItems = menuItems;
    if (campaign_type === 'combo' || campaign_type === 'combo_offer') {
      filteredItems = menuItems.filter(item => Number(item.price) > 0);
    } else if (campaign_type === 'festive' || campaign_type === 'festive_offer') {
      const festiveCats = ['dessert', 'main', 'starter', 'sweet', 'biryani', 'special', 'platter'];
      filteredItems = menuItems.filter(item => {
        const cat = (item.category || '').toLowerCase();
        return festiveCats.some(fc => cat.includes(festiveCat));
      });
      // Fallback if no matching categories
      if (filteredItems.length === 0) filteredItems = menuItems.slice(0, 20);
    }

    let selected = filteredItems.sort((a, b) => contentScore(b, campaign_type) - contentScore(a, campaign_type));

    selected = selected.slice(0, Math.min(dish_count, 10));

    const selectedWithReasons = selected.map(item => ({
      ...item,
      reason: selectionReason(item, campaign_type),
      post_type: postTypeForCampaign(campaign_type, item)
    }));

    res.json({ success: true, selected_dishes: selectedWithReasons });
  } catch (error) {
    console.error('Select content error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function contentScore(item, campaignType) {
  const tags = new Set(item.tags || []);
  let score = 0;

  if (item.is_bestseller || tags.has('bestseller')) score += 80;
  if (tags.has('chef_special')) score += 45;
  if (tags.has('trending')) score += 35;
  if (tags.has('premium_pick')) score += Math.min(Number(item.price || 0) / 10, 60);
  score += Math.min(Number(item.price || 0) / 20, 35);

  if (campaignType === 'combo' && tags.has('combo_deal')) score += 100;
  if (campaignType === 'festive' && tags.has('festive')) score += 100;
  if (campaignType === 'new_arrivals' && tags.has('new_arrival')) score += 100;
  if (campaignType === 'daily' && tags.has('menu_pick')) score += 10;

  if (item.created_at && campaignType === 'new_arrivals') {
    const createdAt = new Date(item.created_at).getTime();
    if (!Number.isNaN(createdAt)) score += Math.max(0, 30 - ((Date.now() - createdAt) / 86400000));
  }

  return score;
}

function selectionReason(item, campaignType) {
  const tags = new Set(item.tags || []);
  if (campaignType === 'combo' && tags.has('combo_deal')) return 'Combo Deal';
  if (campaignType === 'festive' && tags.has('festive')) return 'Festive Pick';
  if (campaignType === 'new_arrivals' && tags.has('new_arrival')) return 'New Arrival';
  if (item.is_bestseller || tags.has('bestseller')) return 'Bestseller';
  if (tags.has('chef_special')) return 'Chef Special';
  if (tags.has('trending')) return 'Trending Dish';
  if (tags.has('premium_pick')) return 'Premium Pick';
  return 'Top Pick';
}

function postTypeForCampaign(campaignType, item) {
  const tags = new Set(item.tags || []);
  if (campaignType === 'combo') return 'Combo Offer';
  if (campaignType === 'festive') return 'Festive Promotion';
  if (campaignType === 'new_arrivals') return 'New Arrival Spotlight';
  if (tags.has('chef_special')) return "Today's Chef Special";
  if (tags.has('bestseller')) return 'Top Bestselling Dish';
  if (tags.has('dessert_spotlight')) return 'Dessert Spotlight';
  return 'Daily Special';
}

// POST /api/generate-captions
router.post('/generate-captions', async (req, res) => {
  try {
    const { dishes, tone = 'casual', campaign_type = 'daily' } = req.body;

    if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
      return res.status(400).json({ success: false, error: 'Dishes array is required' });
    }

    const captions = await aiProcessor.generateCaptions(dishes, tone, campaign_type);
    res.json({ success: true, captions });
  } catch (error) {
    console.error('Generate captions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/generate-images
router.post('/generate-images', async (req, res) => {
  try {
    const { dishes, campaign_type = 'daily', festival_type } = req.body;

    if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
      return res.status(400).json({ success: false, error: 'Dishes array is required' });
    }

    const images = [];

    for (const dish of dishes) {
      try {
        let imageBuffer = null;
        let method = 'ai_generated';

        if (dish.image_url) {
          const enhanced = await imageGenerator.enhanceImage(dish.image_url);
          if (enhanced.success) {
            imageBuffer = enhanced.buffer;
            method = 'enhanced_existing';
          }
        }

        if (!imageBuffer) {
          const generated = await imageGenerator.generateImage(dish.name, dish.description, 3, campaign_type, festival_type);
          imageBuffer = generated.buffer;
          method = generated.method;
        }

        // Upload to Supabase storage if available
        let uploadedUrl = null;
        if (imageBuffer && supabase.storage) {
          try {
            const fileName = `dishes/${dish.id || Date.now()}_${Date.now()}.png`;
            const { data, error } = await supabase.storage
              .from('creatives')
              .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true });

            if (!error && data) {
              const { data: urlData } = supabase.storage.from('creatives').getPublicUrl(fileName);
              uploadedUrl = urlData.publicUrl;
            }
          } catch (uploadErr) {
            console.error('Image upload error for dish:', dish.name, uploadErr.message);
          }
        }

        images.push({
          dish_id: dish.id,
          image_url: uploadedUrl,
          image_buffer_b64: imageBuffer ? imageBuffer.toString('base64') : null,
          method
        });
      } catch (dishErr) {
        console.error('Image gen failed for dish:', dish.name, dishErr.message);
        images.push({ dish_id: dish.id, image_url: null, method: 'failed' });
      }
    }

    res.json({ success: true, images });
  } catch (error) {
    console.error('Generate images error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/create-creatives
router.post('/create-creatives', async (req, res) => {
  try {
    const { restaurant_id, dishes, formats = ['square'], branding = {}, export_types } = req.body;

    if (!restaurant_id || !validateUuid(restaurant_id)) {
      return res.status(400).json({ success: false, error: 'Valid restaurant_id is required' });
    }
    if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
      return res.status(400).json({ success: false, error: 'Dishes array is required' });
    }
    const rawCampaignType = req.body.campaign_type || branding.campaign_type || 'daily';
    let campaignType = rawCampaignType.toLowerCase();
    
    // Normalize aliases
    const typeMap = {
      'daily': 'daily',
      'daily_special': 'daily',
      'daily_specials': 'daily',
      'new_arrival': 'new_arrivals',
      'new_arrivals': 'new_arrivals',
      'festive': 'festive',
      'festive_offer': 'festive',
      'combo': 'combo',
      'combo_offer': 'combo',
  };
    if (typeMap[campaignType]) {
      campaignType = typeMap[campaignType];
    }
    
    const festivalType = req.body.festival_type || branding.festival_type || null;
    if (!validateCampaignType(campaignType)) {
      return res.status(400).json({ success: false, error: 'Invalid campaign_type' });
    }

    const colors = branding.colors || ['#FF6B35', '#2E4057'];

    // Fetch restaurant info for branding
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name, brand_colors, theme, logo_url')
      .eq('id', restaurant_id)
      .single();

    const brandColors = (restaurant?.brand_colors?.length > 0)
      ? restaurant.brand_colors
      : colors;

    // Create campaign record
    const validFormats = formats.filter(validateFormat);
    if (validFormats.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one valid format is required' });
    }
    const exportTypes = normalizeExportTypes(export_types || branding.export_types || ['png']);
    if (exportTypes.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one valid export type is required' });
    }
    const platform = validFormats.includes('landscape') ? 'social'
      : 'social';

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        restaurant_id,
        campaign_type: campaignType,
        platform,
        status: 'processing',
        selected_dishes: dishes.map(d => d.id)
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // PRE-FETCH LOGO: Optimize by fetching ONCE before the loop
    let globalLogoBuffer = null;
    const masterLogoUrl = restaurant?.logo_url || branding.logo_url;
    if (masterLogoUrl) {
      try {
        const { fetchLogoBuffer } = require('../services/creativeBuilder');
        globalLogoBuffer = await fetchLogoBuffer(masterLogoUrl);
        console.log('Global logo pre-fetched for batch processing');
      } catch (err) {
        console.error('Failed to pre-fetch global logo:', err.message);
      }
    }

    let generationQueue = dishes;
    
    // COMBO LOGIC: If it's a combo, we generate ONE creative for the set, not one per item
    if (campaignType === 'combo') {
      const comboName = dishes.map(d => d.name).join(' & ');
      const comboPrice = dishes.reduce((sum, d) => sum + (Number(d.price) || 0), 0);
      const comboDesc = `A special combo featuring: ${dishes.map(d => d.name).join(', ')}.`;
      
      generationQueue = [{
        id: dishes[0].id, // Use valid UUID to prevent DB constraint violation
        name: comboName,
        description: comboDesc,
        price: comboPrice,
        dish_names: dishes.map(d => d.name), // for the prompt builder
        is_combo: true
      }];
      console.log('Detected Combo Campaign: Flattening dishes into single creative with base ID:', dishes[0].id);
    }

    const creatives = [];

    for (const dish of generationQueue) {
      // Enrich dish with restaurant name for overlay
      const enrichedDish = {
        ...dish,
        restaurant_name: restaurant?.name || 'Our Restaurant',
        restaurant_theme: restaurant?.theme || branding.theme || 'casual',
        logo_url: restaurant?.logo_url || branding.logo_url || null
      };

      for (const format of validFormats) {
        try {
          // Map format to canonical sizeType for high-end prompts
          const sizeType = format === 'square' ? '1:1' 
                        : format === 'story' ? '4:5' 
                        : format === 'landscape' ? '16:9' 
                        : format;
          
          // Get image buffer - download from url or use buffer
          let imageBuffer = null;
          
          // First try to download from dish.image_url
          if (dish.image_url) {
            imageBuffer = await imageGenerator.downloadAndProcess(dish.image_url);
          }
          
          // If no image from URL, try to use image_buffer from generateImages
          if (!imageBuffer && dish.image_buffer) {
            imageBuffer = Buffer.from(dish.image_buffer, 'base64');
          }
          
          // If still no image, generate a new one for this format
          if (!imageBuffer) {
            console.log(`Generating image for ${dish.name} (${format}) campaignType=${campaignType} festivalType=${festivalType}`);
            try {
              const generated = await imageGenerator.generateImage(
                dish.name,
                dish.description,
                3,
                campaignType,
                festivalType,
                sizeType,
                dish.dish_names // Pass array of names for combo prompts
              );
              if (generated && generated.success) {
                imageBuffer = generated.buffer;
              } else {
                console.error(`Image generation failed for ${dish.name}: ${generated?.error}`);
              }
            } catch (genErr) {
              console.error(`Image generation exception for ${dish.name}:`, genErr.message);
            }
          }

          // If still no image after generation attempts, create a placeholder
          if (!imageBuffer) {
            console.warn(`No image available for ${dish.name}, using placeholder`);
            try {
              const placeholder = await imageGenerator.generateFoodPlaceholder(dish.name, 1080, 1080, campaignType);
              imageBuffer = placeholder;
            } catch (phErr) {
              console.error(`Placeholder generation failed:`, phErr.message);
              // Continue with null - creativeBuilder has fallback handling
            }
          }

          const caption = {
            headline: dish.headline || dish.name,
            caption: dish.caption || dish.description || '',
            cta: dish.cta || 'Order Now!'
          };

          const creative = await creativeBuilder.buildCreative({
            dish: enrichedDish,
            format,
            imageBuffer,
            colors: brandColors,
            caption,
            campaignType: campaignType,
            festivalType: festivalType,
            logoBuffer: globalLogoBuffer // Injected pre-fetched buffer
          });

          if (!creative.success) {
            console.error('Creative build failed for dish:', dish.name, format);
            continue;
          }

          for (const exportType of exportTypes) {
            const outputBuffer = await creativeBuilder.convertOutput(creative.buffer, exportType);

            // Upload creative to Supabase or local storage
            let creativeUrl = null;
            if (supabase.storage) {
              try {
                const fileName = `creatives/${campaign.id}/${dish.id}_${format}_${Date.now()}.${exportType}`;
                const { error: uploadErr } = await supabase.storage
                  .from('creatives')
                  .upload(fileName, outputBuffer, {
                    contentType: creativeBuilder.getMimeType(exportType),
                    upsert: true
                  });

                if (!uploadErr) {
                  const { data: urlData } = supabase.storage.from('creatives').getPublicUrl(fileName);
                  creativeUrl = urlData.publicUrl;
                }
              } catch (uploadErr) {
                console.error('Creative upload error:', uploadErr.message);
              }
            }

            // Save creative record to DB
            const creativeRecord = {
              campaign_id: campaign.id,
              menu_item_id: dish.id,
              format,
              image_url: creativeUrl,
              caption_headline: caption.headline,
              caption_body: caption.caption,
              cta_text: caption.cta,
              dimensions: creative.dimensions
            };

            try {
              const { data, error } = await supabase.from('creatives').insert(creativeRecord).select();
              if (error) {
                console.error('DB insert error:', error.message);
              }
            } catch (dbErr) {
              console.error('DB insert catch error:', dbErr.message);
            }

            // Add to response
            creatives.push({
              menu_item_id: dish.id,
              menu_item_name: dish.name,
              format,
              export_type: exportType,
              image_url: creativeUrl,
              download_url: creativeUrl,
              image_b64: creativeUrl ? null : outputBuffer.toString('base64')
            });
          }
        } catch (dishFormatErr) {
          console.error('Error for dish/format:', dish.name, format, dishFormatErr.message);
        }
      }
    }

    // Update campaign status
    await supabase.from('campaigns').update({
      status: 'completed',
      total_creatives: creatives.length
    }).eq('id', campaign.id);

    res.json({
      success: true,
      campaign_id: campaign.id,
      creatives,
      total_creatives: creatives.length
    });
  } catch (error) {
    console.error('Create creatives error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function normalizeExportTypes(exportTypes) {
  const allowed = new Set(['png', 'jpg', 'jpeg', 'webp']);
  return (Array.isArray(exportTypes) ? exportTypes : [exportTypes])
    .map(type => String(type || '').toLowerCase().replace(/^\./, ''))
    .filter(type => allowed.has(type))
    .map(type => type === 'jpeg' ? 'jpg' : type)
    .filter((type, index, all) => all.indexOf(type) === index);
}

module.exports = router;
