const Groq = require('groq-sdk');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

class AIProcessorService {

  async generateDescription(dishName, existingDescription) {
    if (existingDescription && existingDescription.length > 20) {
      return existingDescription;
    }

    // Try Groq
    if (groq && process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('xxx')) {
      try {
        const completion = await Promise.race([
          groq.chat.completions.create({
            messages: [{ role: 'user', content: `Write a 2-sentence appetizing description for restaurant dish: "${dishName}". Focus on flavors and ingredients. Max 25 words.` }],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 60
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
        ]);
        return completion.choices[0]?.message?.content?.trim() || this.generateSmartFallback(dishName);
      } catch (error) {
        console.log('Groq error:', error.message);
      }
    }

    return this.generateSmartFallback(dishName);
  }

  generateSmartFallback(dishName) {
    const lower = dishName.toLowerCase();
    
    // Pizza descriptions
    if (/pizza|pie/i.test(lower)) {
      if (/four cheese|quattro formaggi|cheese pizza/i.test(lower)) return 'Rich blend of four premium cheeses melted to perfection on a crisp, golden crust.';
      if (/pepperoni/i.test(lower)) return 'Classic pepperoni pizza with savory, slightly spicy cured meat on melted mozzarella and zesty tomato sauce.';
      if (/margherita/i.test(lower)) return 'Fresh basil, creamy mozzarella, and San Marzano tomatoes on a perfectly crispy crust.';
      if (/veggie|vegetable/i.test(lower)) return 'Garden-fresh vegetables on melted cheese and herb-infused tomato sauce.';
      if (/meat|pepperoni|sausage/i.test(lower)) return 'Loaded with premium meats and melted cheese on our signature sauce.';
      if (/white|bianca/i.test(lower)) return 'Rich ricotta, mozzarella, and Parmesan without tomato sauce for a creamy, indulgent bite.';
      if (/sicilian/i.test(lower)) return 'Thick, fluffy crust with a crisp bottom, topped with premium ingredients and aged cheese.';
      if (/hawaiian/i.test(lower)) return 'Sweet pineapple and smoky ham on melted mozzarella and tangy tomato sauce.';
      if (/bbq|barbecue/i.test(lower)) return 'Smoky barbecue sauce with tender chicken or beef and melted cheese.';
      if (/buffalo/i.test(lower)) return 'Spicy buffalo sauce with chicken and creamy blue cheese crumbles.';
      return 'Hand-tossed pizza with premium toppings and melted mozzarella on a crisp, golden crust.';
    }
    
    // Pasta descriptions
    if (/pasta|spaghetti|penne|rigatoni|fettuccine/i.test(lower)) {
      if (/alfredo/i.test(lower)) return 'Creamy Parmesan sauce tossed with perfectly cooked pasta for a rich, comforting bite.';
      if (/marinara|bolognese|meatball/i.test(lower)) return 'Rich, slow-cooked tomato sauce with savory meatballs over al dente pasta.';
      if (/primavera/i.test(lower)) return 'Fresh seasonal vegetables in a light garlic and olive oil sauce.';
      return 'Al dente pasta in a flavorful sauce with premium ingredients.';
    }
    
    // Appetizers
    if (/garlic bread|bruschetta|crostini/i.test(lower)) return 'Warm, crispy bread with aromatic garlic butter, finished with a sprinkle of herbs.';
    if (/mozzarella sticks?|fried mozzarella/i.test(lower)) return 'Golden crispy exterior with stretchy, melted mozzarella cheese inside. Served with marinara.';
    if (/wings?/i.test(lower)) {
      if (/buffalo/i.test(lower)) return 'Crispy wings tossed in tangy, spicy buffalo sauce with a cooling blue cheese dip.';
      if (/bbq|barbecue/i.test(lower)) return 'Smoky, sweet barbecue-glazed wings with a crispy texture.';
      if (/garlic/i.test(lower)) return 'Crispy wings glazed in savory garlic butter with fresh parsley.';
      return 'Crispy fried chicken wings with your choice of delicious dipping sauce.';
    }
    if (/calamari|squid/i.test(lower)) return 'Lightly floured and crispy fried, served with lemon wedge and zesty marinara sauce.';
    if (/nachos|tacos|burrito/i.test(lower)) return 'Loaded with melted cheese, fresh toppings, and house-made salsas.';
    if (/soup/i.test(lower)) return 'House-made soup with fresh ingredients and aromatic seasonings.';
    if (/salad/i.test(lower)) {
      if (/caesar/i.test(lower)) return 'Crisp romaine, shaved Parmesan, crunchy croutons, and creamy Caesar dressing.';
      if (/greek/i.test(lower)) return 'Fresh cucumbers, tomatoes, olives, feta, and herb vinaigrette.';
      if (/garden|house/i.test(lower)) return 'Mixed greens with fresh vegetables and house vinaigrette.';
      return 'Fresh mixed greens with seasonal vegetables and your choice of dressing.';
    }
    
    // Burgers/Sandwiches
    if (/burger/i.test(lower)) return 'Juicy beef patty with fresh toppings on a toasted brioche bun.';
    if (/sandwich|sub|hoagie/i.test(lower)) return 'Layers of premium meats, cheeses, and crisp vegetables on fresh bread.';
    
    // Main courses
    if (/chicken/i.test(lower)) {
      if (/tenders|strips/i.test(lower)) return 'Crispy golden tenders made with premium chicken breast. Perfect for dipping.';
      if (/wings/i.test(lower)) return 'Tender chicken prepared with bold, flavorful seasonings.';
      if (/grilled|blackened/i.test(lower)) return 'Perfectly grilled chicken breast with smoky char and juicy meat.';
      if (/tikka/i.test(lower)) return 'Tender marinated chicken cooked in a clay oven with aromatic spices.';
      if (/curry/i.test(lower)) return 'Rich, aromatic curry with tender chicken pieces in a flavorful sauce.';
      if (/alfredo/i.test(lower)) return 'Grilled chicken over fettuccine in a creamy Parmesan sauce.';
      return 'Premium chicken prepared with fresh herbs and seasonings.';
    }
    
    if (/steak|ribeye|sirloin|filet/i.test(lower)) {
      if (/ribeye/i.test(lower)) return 'Premium ribeye with rich marbling, grilled to perfection with herb butter.';
      if (/filet|mignon/i.test(lower)) return 'Tender, lean beef tenderloin with a buttery, melt-in-your-mouth texture.';
      if (/ny strip|new york/i.test(lower)) return 'Bold, beefy NY strip steak with a perfectly seared crust.';
      return 'Premium steak grilled to your preferred doneness with herb butter.';
    }
    
    if (/fish|salmon|tilapia|cod/i.test(lower)) {
      if (/salmon/i.test(lower)) return 'Fresh Atlantic salmon with a crispy skin and tender, flaky interior.';
      if (/fish and chips/i.test(lower)) return 'Beer-battered fish with crispy fries and creamy tartar sauce.';
      return 'Fresh catch prepared with lemon, herbs, and your choice of preparation.';
    }
    
    // Desserts
    if (/cheesecake/i.test(lower)) return 'Creamy, velvety cheesecake on a buttery graham cracker crust.';
    if (/brownie/i.test(lower)) return 'Rich, fudgy chocolate brownie with a crackly top and gooey center.';
    if (/cookie/i.test(lower)) return 'Warm, chewy chocolate chip cookie baked fresh daily.';
    if (/ice cream|gelato/i.test(lower)) return 'Creamy, handcrafted ice cream in seasonal flavors.';
    if (/cake/i.test(lower)) return 'Moist layers of cake with rich, decadent frosting.';
    if (/tiramisu/i.test(lower)) return 'Layers of espresso-soaked ladyfingers and mascarpone cream.';
    if (/cannoli/i.test(lower)) return 'Crispy shell filled with sweet, creamy ricotta and chocolate chips.';
    
    // Beverages
    if (/coffee|espresso/i.test(lower)) return 'Rich, bold coffee brewed from premium roasted beans.';
    if (/smoothie/i.test(lower)) return 'Fresh fruit blended with yogurt for a refreshing, healthy drink.';
    if (/lemonade/i.test(lower)) return 'Fresh-squeezed lemons with just the right balance of sweet and tart.';
    if (/shake|milkshake/i.test(lower)) return 'Thick, creamy milkshake made with real ice cream and premium toppings.';
    
    // Generic fallback with dish name
    const words = dishName.split(/\s+/).filter(w => w.length > 2 && !/^[™®©]$/.test(w));
    if (words.length > 0) {
      // Reconstruct meaningful name, skip special chars and trademark symbols
      const cleanName = words.slice(0, 3).join(' ');
      return `Delicious ${cleanName} prepared with care using the finest ingredients for authentic flavor.`;
    }
    
    return `A delicious dish prepared with fresh ingredients and bold flavors.`;
  }

  async generateCaptions(dishes, tone = 'casual') {
    // Fallback captions (fast, always works)
    const buildFallback = (dish, i) => ({
      dish_index: i,
      dish_id: dish.id,
      headline: `🔥 ${dish.name}`,
      caption: `Savor the flavors of our ${dish.name}${dish.price ? ` at just ₹${dish.price}` : ''}! Made with love and the finest ingredients.`,
      cta: '📍 Order Now | Visit Today'
    });

    if (!groq) {
      return dishes.map(buildFallback);
    }

    try {
      const dishList = dishes.map((d, i) =>
        `${i + 1}. ${d.name}${d.price ? ` (₹${d.price})` : ''}${d.description ? `: ${d.description.substring(0, 80)}` : ''}`
      ).join('\n');

      const prompt = `You are a social media content creator for Indian restaurants. Generate Instagram captions for these ${dishes.length} dishes.
Tone: ${tone}. 
Return a JSON array with exactly ${dishes.length} objects in the SAME ORDER as the dishes below.
Each object must have: dish_index (0-based number), headline (max 10 words, include emoji), caption (2-3 sentences, engaging, include price if given), cta (call to action with emoji).
Dishes:
${dishList}
Return ONLY valid JSON array, no extra text.`;

      const completion = await Promise.race([
        groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Groq timeout')), 15000))
      ]);

      const responseText = completion.choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Merge by index — if Groq returned items by position, assign dish_id from our list
        return parsed.map((item, i) => ({
          ...item,
          dish_id: dishes[item.dish_index ?? i]?.id || dishes[i]?.id,
          dish_index: item.dish_index ?? i
        }));
      }
      throw new Error('No JSON array in response');
    } catch (error) {
      console.error('Caption generation error:', error.message);
      return dishes.map(buildFallback);
    }
  }

  async generateContentPlan(menuItems, campaignType = 'daily') {
    const postTypes = {
      daily: ['Top 5 Bestsellers', "Today's Chef Special", 'Value Pick', 'New Arrival', 'Customer Favourite'],
      new_arrivals: ['New Arrival Spotlight', 'Fresh From The Kitchen', 'Just Added', 'First Taste'],
      weekend: ['Weekend Feast', 'Family Special', 'Group Combo', 'Weekend Bestseller'],
      festive: ['Festive Special', 'Celebration Dish', 'Traditional Favourite', 'Party Platter'],
      combo: ['Best Value Combo', 'Family Deal', 'Lunch Special', 'Dinner Package']
    };

    const types = postTypes[campaignType] || postTypes.daily;
    const bestsellers = menuItems.filter(i => i.is_bestseller);
    const highPrice = [...menuItems].sort((a, b) => (b.price || 0) - (a.price || 0));
    const categories = [...new Set(menuItems.map(i => i.category))];

    return types.map((typeLabel, index) => ({
      post_type: typeLabel,
      suggested_items: bestsellers.slice(index, index + 1).concat(highPrice.slice(0, 2)),
      category_focus: categories[index % categories.length]
    }));
  }

  standardizeDishName(dishName) {
    if (!dishName) return '';

    const keepUpper = new Set(['BBQ', 'VIP', 'XL', 'ML', '2PC', '3PC']);
    return dishName
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => {
        const cleaned = word.trim();
        if (!cleaned) return '';
        if (keepUpper.has(cleaned.toUpperCase())) return cleaned.toUpperCase();
        if (/^[A-Z]{2,}$/.test(cleaned)) return cleaned;
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
      })
      .join(' ');
  }

  inferTags(item) {
    const name = item.name || '';
    const description = item.description || '';
    const category = item.category || '';
    const lower = `${name} ${description} ${category}`.toLowerCase();
    const tags = new Set(Array.isArray(item.tags) ? item.tags : []);

    if (item.is_bestseller || this.isBestseller(name, item.price)) tags.add('bestseller');
    if (/(chef|signature|special|recommended|must try|house)/i.test(lower)) tags.add('chef_special');
    if (/(combo|meal|deal|platter|bucket|family|pack)/i.test(lower)) tags.add('combo_deal');
    if (/(new|arrival|fresh|seasonal|limited|today)/i.test(lower)) tags.add('new_arrival');
    if (/(trending|popular|favourite|favorite|classic|viral|top)/i.test(lower)) tags.add('trending');
    if (/(festival|festive|diwali|eid|christmas|pongal|ugadi|holi|celebration)/i.test(lower)) tags.add('festive');
    if (category === 'Desserts') tags.add('dessert_spotlight');
    if (item.price && Number(item.price) >= 300) tags.add('premium_pick');

    if (!tags.size) tags.add('menu_pick');
    return Array.from(tags);
  }

  categorizeDish(dishName) {
    const lower = dishName.toLowerCase();
    const categories = {
      'Starters': ['starter', 'appetizer', 'snack', 'crispy', 'chaat', 'chat', 'pakora', 'samosa', 'tikka', 'kabab', 'kebab', 'vada', 'bhel', 'pani puri', 'spring roll', 'soup'],
      'Main Course': ['biryani', 'curry', 'rice', 'dal', 'daal', 'roti', 'naan', 'paratha', 'pulao', 'paneer', 'chicken', 'mutton', 'fish', 'prawn', 'lamb', 'sabzi', 'subzi', 'gravy', 'kadai', 'masala', 'korma', 'butter'],
      'Beverages': ['drink', 'juice', 'shake', 'milkshake', 'lassi', 'soda', 'water', 'tea', 'chai', 'coffee', 'lemonade', 'nimbu', 'mocktail'],
      'Desserts': ['dessert', 'sweet', 'ice cream', 'cake', 'pastry', 'gulab jamun', 'rasgulla', 'kulfi', 'kheer', 'halwa', 'barfi', 'ladoo', 'mithai', 'payasam'],
      'Breads': ['roti', 'naan', 'paratha', 'puri', 'kulcha', 'bhatura', 'chapati'],
      'Salads & Raita': ['salad', 'raita', 'papad', 'pickle', 'achar', 'slaw']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lower.includes(keyword))) {
        return category;
      }
    }
    return 'Other';
  }

  isBestseller(dishName, price) {
    const lower = dishName.toLowerCase();
    let score = 0;
    const popularKeywords = ['bestseller', 'best seller', 'signature', 'special', 'popular', 'chef', 'recommended', 'must try', 'favourite', 'favorite', 'classic', 'star'];
    if (popularKeywords.some(k => lower.includes(k))) score += 3;
    if (price && price > 300) score += 1;
    if (price && price > 500) score += 1;
    return score >= 2;
  }
}

module.exports = new AIProcessorService();
