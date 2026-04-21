-- Restaurant Menu to Social Media Creatives Generator
-- Database Schema for Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: restaurants
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  website_url TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  brand_colors JSONB DEFAULT '[]',
  theme TEXT DEFAULT 'casual',
  brand_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: menu_items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(10,2),
  description TEXT,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_bestseller BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_bestseller ON menu_items(is_bestseller) WHERE is_bestseller = TRUE;

-- Table 3: campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('daily', 'new_arrivals', 'festive', 'combo')),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'whatsapp')),
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  selected_dishes JSONB DEFAULT '[]',
  total_creatives INT DEFAULT 0,
  zip_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_restaurant ON campaigns(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Table 4: creatives
CREATE TABLE IF NOT EXISTS creatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  format TEXT NOT NULL CHECK (format IN ('instagram_square', 'instagram_story', 'facebook_post', 'whatsapp_post')),
  export_type TEXT DEFAULT 'png' CHECK (export_type IN ('png', 'jpg', 'webp')),
  image_url TEXT,
  caption_headline TEXT,
  caption_body TEXT,
  cta_text TEXT,
  dimensions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creatives_campaign ON creatives(campaign_id);

-- Row Level Security (RLS) Policies
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE creatives ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (adjust as needed)
CREATE POLICY "Public read access restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Public insert restaurants" ON restaurants FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update restaurants" ON restaurants FOR UPDATE USING (true);
CREATE POLICY "Public delete restaurants" ON restaurants FOR DELETE USING (true);

CREATE POLICY "Public read access menu_items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Public insert menu_items" ON menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update menu_items" ON menu_items FOR UPDATE USING (true);
CREATE POLICY "Public delete menu_items" ON menu_items FOR DELETE USING (true);

CREATE POLICY "Public read access campaigns" ON campaigns FOR SELECT USING (true);
CREATE POLICY "Public insert campaigns" ON campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update campaigns" ON campaigns FOR UPDATE USING (true);
CREATE POLICY "Public delete campaigns" ON campaigns FOR DELETE USING (true);

CREATE POLICY "Public read access creatives" ON creatives FOR SELECT USING (true);
CREATE POLICY "Public insert creatives" ON creatives FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update creatives" ON creatives FOR UPDATE USING (true);
CREATE POLICY "Public delete creatives" ON creatives FOR DELETE USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for restaurants updated_at
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
CREATE TRIGGER update_restaurants_updated_at
    BEFORE UPDATE ON restaurants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
