require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scrapeRoutes = require('./routes/scrape');
const processRoutes = require('./routes/process');
const generateRoutes = require('./routes/generate');
const campaignsRoutes = require('./routes/campaigns');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/test-data', async (req, res) => {
  const supabase = require('./utils/supabase');
  const { restaurant_id } = req.body;
  
  const sampleItems = [
    { name: 'Butter Chicken', category: 'Main Course', price: 320, description: 'Tender chicken in rich tomato gravy', is_bestseller: true },
    { name: 'Paneer Tikka', category: 'Starters', price: 250, description: 'Grilled cottage cheese with spices', is_bestseller: true },
    { name: 'Biryani', category: 'Main Course', price: 280, description: 'Fragrant rice with spices and meat', is_bestseller: true },
    { name: 'Gulab Jamun', category: 'Desserts', price: 120, description: 'Sweet milk dumplings in sugar syrup' },
    { name: 'Masala Chai', category: 'Beverages', price: 50, description: 'Traditional spiced Indian tea' },
  ];
  
  const items = sampleItems.map(item => ({
    restaurant_id,
    ...item
  }));
  
  const { error } = await supabase.from('menu_items').insert(items);
  
  res.json({ success: !error, error });
});

app.use('/api', scrapeRoutes);
app.use('/api', processRoutes);
app.use('/api', generateRoutes);
app.use('/api', campaignsRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
