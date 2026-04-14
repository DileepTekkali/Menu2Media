const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

class AIProcessorService {
  async generateDescription(dishName, existingDescription) {
    if (existingDescription && existingDescription.length > 20) {
      return existingDescription;
    }

    // Try Gemini first
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const prompt = `Write a short appetizing description (2 sentences) for ${dishName}:`;
        const result = await model.generateContent(prompt);
        return (await result.response).text().trim();
      } catch (error) {
        console.log('Gemini failed, trying Groq...');
      }
    }

    // Use Groq as fallback (fast and working)
    if (groq) {
      try {
        const completion = await Promise.race([
          groq.chat.completions.create({
            messages: [{ role: 'user', content: `Write a short appetizing description for ${dishName} (max 20 words):` }],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 50
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        return completion.choices[0]?.message?.content?.trim() || `Delicious ${dishName} prepared with fresh ingredients.`;
      } catch (error) {
        console.log('Groq fallback error:', error.message);
      }
    }

    // Final fallback
    return `Delicious ${dishName} prepared with fresh ingredients.`;
  }

  async generateCaptions(dishes, tone = 'casual') {
    if (!groq) {
      return dishes.map(dish => ({
        dish_id: dish.id,
        headline: `🔥 ${dish.name}`,
        caption: `Savor the flavors of ${dish.name}${dish.price ? ` at just ₹${dish.price}` : ''}!`,
        cta: '📍 Order Now'
      }));
    }

    try {
      const dishList = dishes.map((d, i) => 
        `${i + 1}. ${d.name}${d.price ? ` (₹${d.price})` : ''}${d.description ? `: ${d.description}` : ''}`
      ).join('\n');

      const prompt = `Generate Instagram captions for these dishes. Tone: ${tone}.
Return JSON array with objects containing: dish_id, headline (max 10 words with emoji), caption (2-3 sentences, engaging), cta (call to action with emoji).
Dishes:\n${dishList}`;

      const completion = await Promise.race([
        groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          max_tokens: 2000
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Groq timeout')), 10000))
      ]);

      const response = completion.choices[0]?.message?.content || '[]';
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Invalid JSON response');
    } catch (error) {
      console.error('Groq error:', error.message);
      return dishes.map(dish => ({
        dish_id: dish.id,
        headline: `🔥 ${dish.name}`,
        caption: `Savor the flavors of ${dish.name}!`,
        cta: '📍 Order Now'
      }));
    }
  }

  categorizeDish(dishName) {
    const lower = dishName.toLowerCase();
    
    const categories = {
      'Starters': ['starter', 'appetizer', 'starter', 'snack', 'crispy', 'chat', 'pakora', 'samosa', 'tikka', 'kabab', 'kebab'],
      'Main Course': ['biryani', 'curry', 'rice', 'dal', 'roti', 'naan', 'pulao', 'paneer', 'chicken', 'mutton', 'fish', 'prawn'],
      'Beverages': ['drink', 'juice', 'shake', 'lassi', 'soda', 'water', 'tea', 'coffee'],
      'Desserts': ['dessert', 'sweet', 'ice cream', 'cake', 'pastry', 'gulab', 'rasgulla', 'kulfi']
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
    const popularKeywords = ['bestseller', 'signature', 'special', 'popular', 'chef'];
    const hasKeyword = popularKeywords.some(k => lower.includes(k));
    
    if (hasKeyword) return true;
    if (price && price > 300) return true;
    
    return false;
  }
}

module.exports = new AIProcessorService();
