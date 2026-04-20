# Restaurant Menu to Social Media Creatives

AI-powered restaurant marketing platform that transforms restaurant menus into stunning social media creatives.

## Features

- **Intelligent Menu Scraping** - Extract menus from restaurant websites using AI-powered scraping
- **AI Caption Generation** - Generate catchy captions for your dishes using Groq AI
- **AI Image Generation** - Create beautiful food images using Pollinations AI
- **Multi-Format Creatives** - Generate creatives in Square, Story, and Landscape formats
- **Brand Customization** - Custom colors and branding for your restaurant

## Tech Stack

- **Backend**: Node.js, Express, Sharp (image processing)
- **Frontend**: Flutter Web
- **AI**: Groq AI (captions), Pollinations AI (images)
- **Database**: Supabase (optional)

## Getting Started

### Prerequisites

- Node.js 18+
- Flutter SDK
- API keys (see .env.example)

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install Flutter dependencies
cd ../flutter_app
flutter pub get
```

### Environment Variables

Create a `.env` file in the `backend` directory:

```
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

### Running the Application

```bash
# Start backend
cd backend
npm start

# Build and serve Flutter web (in another terminal)
cd flutter_app
flutter build web
flutter run -d chrome
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scrape` | POST | Scrape restaurant menu |
| `/api/process-menu` | POST | Process/edit menu items |
| `/api/generate-captions` | POST | Generate AI captions |
| `/api/generate-images` | POST | Generate food images |
| `/api/create-creatives` | POST | Build final creatives |
| `/api/download/:id` | GET | Download creative assets |

## Project Structure

```
restaurant-scrapper/
├── backend/
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   ├── utils/         # Utilities
│   └── server.js      # Entry point
├── flutter_app/       # Flutter web app
├── .env               # Environment variables
└── package.json      # Root dependencies
```

## Usage

1. Enter a restaurant URL
2. Review and edit scraped menu items
3. Select dishes for your campaign
4. Choose formats (Square, Story, Landscape)
5. Generate creatives with AI
6. Download or share directly

## License

MIT