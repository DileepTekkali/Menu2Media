# Restaurant Menu Scraper - Complete Application Flow

## 1. ENTRY POINT: API Endpoints

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        REST API ENDPOINTS                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  POST /api/scrape              → Extract menu from restaurant URL       │
│  POST /api/process-menu        → Process/edit scraped menu items      │
│  POST /api/select-content     → Select items for campaign              │
│  POST /api/generate-captions  → AI generate ad captions                │
│  POST /api/generate-images    → Generate ad images                     │
│  POST /api/create-creatives  → Build final ad creatives              │
│  GET  /api/download/:id      → Download generated assets           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. SCRAPE FLOW

```
USER: POST /api/scrape
body: { "restaurant_url": "https://example.com" }

    │
    ▼
    
┌─────────────────────────────────────────────────────────────────┐
│ 1. VALIDATE INPUT                                       │
│    - Check URL is valid                                │
│    - Extract restaurant name from URL                  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
    
┌─────────────────────────────────────────────────────────────────┐
│ 2. CHECK DATABASE (Supabase)                        │
│    - Find existing restaurant by URL                 │
│    - If exists: Clear old menu_items               │
│    - If new: Create restaurant record              │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
    
┌─────────────────────────────────────────────────────────────────┐
│ 3. SCRAPE MENU (scraperService.scrapeMenu)          │
│                                                         │
│    ┌────────────────────────────────────────────┐        │
│    │ A. URL TYPE DETECTION                    │        │
│    ├────────────────────────────────────────────┤        │
│    │ • PDF URL  → pdfMenuExtractor             │        │
│    │ • Image URL → ocrMenuExtractor           │        │
│    │ • HTML URL → Continue to scraping       │        │
│    └────────────────────────────────────────────┘        │
│                        │                                │
│    ┌────────────────────────────────────────────┐        │
│    │ B. STATIC SCRAPING (axios + cheerio)        │        │
│    ├────────────────────────────────────────────┤        │
│    │ Strategy 1: JSON-LD Schema             │        │
│    │ Strategy 2: CSS Selectors              │        │
│    │ Strategy 3: Discovery Links          │        │
│    │ Strategy 4: List Items             │        │
│    │ Strategy 5: Text Content           │        │
│    │ Strategy 6: Image Links (OCR)       │        │
│    └────────────────────────────────────────────┘        │
│                        │                                │
│    ┌────────────────────────────────────────────┐        │
│    │ C. FALLBACK: PLAYWRIGHT                  │        │
│    ├────────────────────────────────────────────┤        │
│    │ • If static yields <3 items              │        │
│    │ • If blocked/timeout                   │        │
│    │ • Launches headless Chrome              │        │
│    │ • Waits for JS rendering              │        │
│    │ • Extracts dynamic content            │        │
│    └────────────────────────────────────────────┘        │
│                        │                                │
│    ┌────────────────────────────────────────────┐        │
│    │ D. DEDUPLICATION                      │        │
│    ├────────────────────────────────────────────┤        │
│    │ • Remove duplicate menu items          │        │
│    │ • Filter noise (menu, home, etc.)     │        │
│    └────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
    
┌─────────────────────────────────────────────────────────────────┐
│ 4. SAVE TO DATABASE                               │
│    - Insert menu_items to Supabase              │
│    - Link to restaurant_id                  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
    
RESPONSE:
{
  "success": true,
  "restaurant_id": "xxx",
  "menu_items_count": 63,
  "scrape_method": "pdf_parse",
  "data": {
    "restaurant": {...},
    "menu_items": [
      { "name": "Pizza", "price": 12.99, "category": "Main" },
      ...
    ]
  }
}
```

## 3. SCRAPING STRATEGIES (In Detail)

### Strategy 1: JSON-LD Schema
- Looks for `<script type="application/ld+json">`
- Extracts @type: "MenuItem" or "FoodEstablishment"
- Works with structured data

### Strategy 2: CSS Selectors
- Targets: h2, h3, .menu-item, .dish-item, .grid-item
- Extracts name, price, description, image

### Strategy 3: Link Discovery
- Finds links with "menu" in text/href
- Follows and scrapes those pages

### Strategy 4: List Items
- Parses `<li>`, `<p>`, `<div>` with price patterns
- Pattern: "Dish Name .... $12.95"

### Strategy 5: Text Content
- Scans full page text for menu patterns

### Strategy 6: Image Links (OCR)
- Finds images of menus
- Uses Tesseract OCR to extract text

## 4. PLAYWRIGHT FALLBACK (Dynamic Sites)

```
When static scraping returns <3 items:
    │
    ▼
Launch Chrome Browser (headless)
    │
    ▼
Inject Cookies/Bypass Detection
    │
    ▼
page.goto(url) + waitForContent
    │
    ▼
Scroll to trigger lazy loading
    │
    ▼
Extract HTML after JS render
    │
    ▼
Run same selectors as static
    │
    ▼
Follow menu links if found
```

## 5. COMPLETE API FLOW CHAIN

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  /scrape   │────▶│ /process   │────▶│/select-content │────▶│/generate-       │
│            │     │  -menu    │     │               │     │ captions       │
└─────────────┘     └─────────────┘     └─────────────────┘     └──────────────────┘
                         │                   │                         │
                         ▼                   ▼                         ▼
                    Edit items in       Select items        AI generates
                    database          for campaign      captions for
                                                     │
                                                     ▼
                                         ┌──────────────────────────────────┐
                                         │/generate-images                   │
                                         └──────────────────────────────────┘
                                                      │
                                                      ▼
                                         ┌──────────────────────────────────┐
                                         │/create-creatives                 │
                                         └──────────────────────────────────┘
                                                      │
                                                      ▼
                                         ┌──────────────────────────────────┐
                                         │/download/:id                     │
                                         └──────────────────────────────────┘
```

## 6. DATABASE SCHEMA (Supabase)

```
restaurants
├── id (UUID)
├── name (string)
├── website_url (string)
├── theme (string)
├── created_at (timestamp)
└── updated_at (timestamp)

menu_items
├── id (UUID)
├── restaurant_id (FK→restaurants)
├── name (string)
├── category (string)
├── price (decimal)
├── description (text)
├── image_url (string)
├── created_at (timestamp)
└── updated_at (timestamp)

campaigns
├── id (UUID)
├── restaurant_id (FK→restaurants)
├── name (string)
├── status (string)
└── created_at (timestamp)

captions
├── id (UUID)
├── campaign_id (FK→campaigns)
├── menu_item_id (FK→menu_items)
├── content (text)
├── platform (string)
└── created_at (timestamp)

creatives
├── id (UUID)
├── campaign_id (FK→campaigns)
├── caption_id (FK→captions)
├── image_url (string)
├── status (string)
└── created_at (timestamp)
```

## 7. ERROR HANDLING

```
┌─────────────────────────────────────────┐
│           ERROR CASES                    │
├─────────────────────────────────────────┤
│ 1. Timeout (30s)                    │
│    → Return method: timeout           │
│                                  │
│ 2. Blocked (403/503)             │
│    → Return method: blocked        │
│                                  │
│ 3. No items found                │
│    → Try Playwright fallback     │
│                                  │
│ 4. JS-rendered content         │
│    → Playwright required       │
│                                  │
│ 5. Protected sites            │
│    → Return available data     │
│    → Note in response         │
└─────────────────────────────────────────┘
```

## 8. TESTING

```bash
# Test single URL
node testFinalAll.js

# Test specific sites  
node test4sites.js

# Debug individual site
node -e "scraper.scrapeMenu('https://example.com').then(console.log)"
```

## 9. STARTING THE APPLICATION

```bash
cd backend
npm start

# Then call API:
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"restaurant_url": "https://fratellinos.com"}'
```

This is the complete flow. The application:
1. Accepts URL → 2. Detects type → 3. Scrapes using multiple strategies → 4. Falls back to Playwright if needed → 5. Saves to database → 6. Returns data