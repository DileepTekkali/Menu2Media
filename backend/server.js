require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const scrapeRoutes = require('./routes/scrape');
const processRoutes = require('./routes/process');
const generateRoutes = require('./routes/generate');
const campaignsRoutes = require('./routes/campaigns');
const downloadRoutes = require('./routes/download');
const supabase = require('./utils/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/generated', express.static(supabase.storageDir || path.join(__dirname, 'output')));
app.use('/fixtures', express.static(path.join(__dirname, 'test-fixtures')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

app.use('/api', scrapeRoutes);
app.use('/api', processRoutes);
app.use('/api', generateRoutes);
app.use('/api', campaignsRoutes);
app.use('/api', downloadRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Restaurant Creatives API running on port ${PORT}`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`📡 Endpoints: /api/scrape | /api/process-menu | /api/select-content | /api/generate-captions | /api/generate-images | /api/create-creatives | /api/download/:id`);
  });
}

module.exports = app;
